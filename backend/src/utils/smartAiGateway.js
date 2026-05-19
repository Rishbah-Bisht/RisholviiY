/**
 * Smart AI Gateway for Google Gemini API
 * Implements exponential backoff, rate limiting & queueing (RPM, TPM, RPD),
 * smart fallback routing, and token checks using Bottleneck & @google/genai SDK.
 */

const { GoogleGenAI } = require("@google/genai");
const Bottleneck = require("bottleneck");

// Initialize Google GenAI SDK. It automatically uses process.env.GEMINI_API_KEY
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Define model constraints and specifications for the Free Tier
const MODEL_CONFIGS = {
  "gemini-2.5-pro": {
    name: "gemini-2.5-pro",
    rpm: 2,               // 2 Requests Per Minute
    tpm: 32000,           // TPM limit (Pro has a low safe TPM on Free Tier)
    rpd: 50,              // 50 Requests Per Day
    minTime: 30000,       // Minimum spacing between requests (60s / 2 = 30s)
    fallback: "gemini-2.5-flash",
  },
  "gemini-2.5-flash": {
    name: "gemini-2.5-flash",
    rpm: 15,              // 15 Requests Per Minute
    tpm: 250000,          // 250,000 Tokens Per Minute
    rpd: 500,             // 500 Requests Per Day
    minTime: 4000,        // Spacing: 4 seconds between requests
    fallback: "gemini-2.0-flash-lite", // Fallback to Lite model if this fails
  },
  "gemini-2.0-flash-lite": {
    name: "gemini-2.0-flash-lite",
    rpm: 30,              // 30 Requests Per Minute
    tpm: 1000000,         // 1,000,000 TPM
    rpd: 1500,            // 1500 Requests Per Day
    minTime: 2000,        // 2 seconds spacing
    fallback: null,       // End of the fallback chain
  }
};

// 1. Create Bottleneck Limiters (Throttlers) for each model to strictly enforce RPM and minTime spacing
const limiters = {};
Object.entries(MODEL_CONFIGS).forEach(([key, config]) => {
  limiters[key] = new Bottleneck({
    maxConcurrent: 1, // Max concurrent requests per model queue
    minTime: config.minTime, // Safe spacing between requests
    reservoir: config.rpd, // Track daily request quota
    reservoirRefreshAmount: config.rpd,
    reservoirRefreshInterval: 24 * 60 * 60 * 1000, // Refresh daily
  });

  // Listen to limiter events for transparency
  limiters[key].on("failed", async (error, info) => {
    console.warn(`[Smart AI Gateway] Limiter warning for ${key}:`, error.message);
  });
});

/**
 * Basic Token Estimator (Guards against breaching TPM)
 * 1 token is roughly 4 characters in English
 * @param {string} text 
 * @returns {number} estimated tokens
 */
function estimateTokens(text) {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

/**
 * Exponential Backoff and Retry Wrapper
 * Retries on 429 (Rate Limit / Resource Exhausted) or network transient errors.
 * @param {Function} apiCallFn - The function containing the api request to invoke
 * @param {number} retries - Number of retries left
 * @param {number} delay - Current delay in ms
 * @returns {Promise<any>}
 */
async function executeWithRetry(apiCallFn, retries = 3, delay = 2000) {
  try {
    return await apiCallFn();
  } catch (error) {
    const isRateLimit = error.status === 429 || 
                        error.statusCode === 429 || 
                        (error.message && error.message.includes("429")) || 
                        (error.message && error.message.toLowerCase().includes("quota"));

    if (isRateLimit && retries > 0) {
      console.warn(`[Smart AI Gateway] Rate limited (429). Retrying in ${delay}ms... (${retries} retries left)`);
      await new Promise((resolve) => setTimeout(resolve, delay));
      return executeWithRetry(apiCallFn, retries - 1, delay * 2);
    }
    
    // Throw error if no retries left or not a rate-limit error
    throw error;
  }
}

/**
 * Smart Gateway Generate Content function with fallback chain support.
 * @param {Object} options 
 * @param {string} options.model - Preferred model (e.g. 'gemini-2.5-pro')
 * @param {string} options.prompt - Prompt content
 * @param {Object} [options.config] - Optional model configuration options
 * @returns {Promise<Object>} The API response and the actual model that serviced the request
 */
async function generateContent(options) {
  const { prompt, config = {} } = options;
  let currentModelName = options.model || "gemini-2.5-flash";

  // Validate the model name
  if (!MODEL_CONFIGS[currentModelName]) {
    console.warn(`[Smart AI Gateway] Model "${currentModelName}" not configured. Defaulting to gemini-2.5-flash.`);
    currentModelName = "gemini-2.5-flash";
  }

  const estimatedPromptTokens = estimateTokens(prompt);

  // Traverse fallback chain if rate limits/quotas are exceeded
  while (currentModelName) {
    const modelConfig = MODEL_CONFIGS[currentModelName];
    const limiter = limiters[currentModelName];

    // Check TPM upfront
    if (estimatedPromptTokens > modelConfig.tpm) {
      console.warn(`[Smart AI Gateway] TPM Check Failed: Prompt (~${estimatedPromptTokens} tokens) exceeds ${currentModelName} limit (${modelConfig.tpm}). Moving to fallback...`);
      currentModelName = modelConfig.fallback;
      continue;
    }

    try {
      console.log(`[Smart AI Gateway] Queueing request on ${currentModelName}...`);
      
      // Schedule request via Bottleneck limiter
      const response = await limiter.schedule(() => {
        return executeWithRetry(async () => {
          // Official @google/genai SDK format
          return await ai.models.generateContent({
            model: currentModelName,
            contents: prompt,
            config: {
              temperature: config.temperature ?? 0.7,
              maxOutputTokens: config.maxOutputTokens,
              ...config
            }
          });
        });
      });

      console.log(`[Smart AI Gateway] Successfully processed request using ${currentModelName}`);
      return {
        response,
        modelUsed: currentModelName
      };

    } catch (error) {
      console.error(`[Smart AI Gateway] Failed on model ${currentModelName}:`, error.message);
      
      // If there is a fallback model, proceed to it, else throw error
      if (modelConfig.fallback) {
        console.warn(`[Smart AI Gateway] Triggering Fallback: ${currentModelName} -> ${modelConfig.fallback}`);
        currentModelName = modelConfig.fallback;
      } else {
        throw new Error(`Smart AI Gateway exhausted all models. Last error: ${error.message}`);
      }
    }
  }

  throw new Error("Smart AI Gateway configuration error: Fallback chain resulted in null model.");
}

module.exports = {
  generateContent,
  MODEL_CONFIGS
};
