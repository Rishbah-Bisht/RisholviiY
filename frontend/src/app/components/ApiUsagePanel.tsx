"use client";

import React, { useState, useEffect } from "react";
import {
  Activity,
  AlertCircle,
  Clock,
  Database,
  TrendingUp,
  Zap,
  RefreshCw,
  Search,
  ArrowRightLeft
} from "lucide-react";

type ApiStat = {
  name: string;
  requestsToday: number;
  tokensUsedToday: number;
  limit: number;
  remaining: number;
  percentage: number;
  status: "safe" | "moderate" | "critical";
};

type TokenUsageData = {
  combinedSummary: {
    totalRequests: number;
    totalTokensUsed: number;
    totalLimit: number;
    totalRemaining: number;
    percentage: number;
    status: "safe" | "moderate" | "critical";
  };
  apiBreakdown: {
    groq: ApiStat;
    gemini: ApiStat;
    openrouter: ApiStat;
  };
  suggestions: string[];
  hoursUntilReset: number;
  recentLogs: Array<{
    _id: string;
    apiName: "groq" | "gemini" | "openrouter";
    model: string;
    tokensUsed: number;
    user?: {
      name: string;
      email: string;
    };
    createdAt: string;
  }>;
};

export default function ApiUsagePanel({
  token,
  authed,
  notify,
}: {
  token: string;
  authed: <T>(path: string, options?: object) => Promise<T>;
  notify: (toast: { type: "success" | "error"; text: string } | null) => void;
}) {
  const [data, setData] = useState<TokenUsageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [apiFilter, setApiFilter] = useState<"all" | "groq" | "gemini" | "openrouter">("all");

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await authed<TokenUsageData>("/admin/token-usage");
      setData(res);
    } catch (err: any) {
      notify({ type: "error", text: err.message || "Failed to fetch token usage data" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchData();
    }
  }, [token]);

  if (loading && !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-3">
        <RefreshCw className="animate-spin text-[var(--brand)]" size={32} />
        <p className="text-sm font-medium text-gray-500">Loading real-time API logs & metrics...</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-8 text-center bg-white border border-[var(--line)] rounded-lg">
        <AlertCircle className="mx-auto text-red-500 mb-2" size={36} />
        <h3 className="text-base font-bold text-gray-800">Metrics Unavailable</h3>
        <p className="text-sm text-gray-500 mt-1">Failed to load real-time API usage metrics.</p>
        <button
          onClick={fetchData}
          className="mt-4 px-4 py-2 text-xs font-bold text-white bg-[var(--brand)] rounded-lg hover:bg-[var(--brand-dark)]"
        >
          Try Again
        </button>
      </div>
    );
  }

  const { combinedSummary, apiBreakdown, suggestions, hoursUntilReset, recentLogs } = data;

  // Filter logs locally
  const filteredLogs = recentLogs.filter((log) => {
    const matchesSearch =
      !searchTerm ||
      log.model.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (log.user?.email && log.user.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (log.user?.name && log.user.name.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesApi = apiFilter === "all" || log.apiName === apiFilter;

    return matchesSearch && matchesApi;
  });

  const getStatusColor = (status: "safe" | "moderate" | "critical") => {
    if (status === "critical") return "bg-rose-50 text-rose-700 border-rose-100 bg-rose-500";
    if (status === "moderate") return "bg-amber-50 text-amber-800 border-amber-100 bg-amber-500";
    return "bg-emerald-50 text-emerald-700 border-emerald-100 bg-emerald-500";
  };

  const getBadgeColor = (status: "safe" | "moderate" | "critical") => {
    if (status === "critical") return "bg-rose-50 text-rose-700 border-rose-100";
    if (status === "moderate") return "bg-amber-50 text-amber-850 border-amber-100";
    return "bg-emerald-50 text-emerald-700 border-emerald-100";
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">

      {/* Upper row: Header with Refresh button & Reset Countdown */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <Activity className="text-[var(--brand)]" size={20} />
            AI API usage & Routing Panel
          </h2>
          <p className="text-xs text-gray-500">Monitor model requests, token consumption and daily limit states.</p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-center">
          <div className="flex items-center gap-1.5 bg-gray-100 px-3 py-1.5 rounded-lg text-xs font-semibold text-gray-600">
            <Clock size={14} className="text-gray-400" />
            <span>Reset in {hoursUntilReset}h</span>
          </div>
          <button
            onClick={fetchData}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--brand)]/10 text-[var(--brand)] hover:bg-[var(--brand)]/15 text-xs font-bold transition active:scale-95 disabled:opacity-50"
          >
            <RefreshCw className={`shrink-0 ${loading ? "animate-spin" : ""}`} size={14} />
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </div>

      {/* Suggestion & Failover Alert Boxes */}
      {suggestions.length > 0 && (
        <div className="space-y-2">
          {suggestions.map((suggestion, idx) => (
            <div
              key={idx}
              className={`flex items-start gap-2.5 px-4 py-3 rounded-xl border text-xs font-medium ${suggestion.includes("⚠️")
                  ? "bg-rose-50 border-rose-100 text-rose-800"
                  : "bg-amber-50 border-amber-100 text-amber-800"
                }`}
            >
              <AlertCircle className="shrink-0 mt-0.5" size={15} />
              <div>{suggestion}</div>
            </div>
          ))}
        </div>
      )}

      {/* Combined System Summary Card */}
      <div className="relative overflow-hidden rounded-lg bg-gradient-to-tr from-[var(--brand)] to-[var(--brand-dark)] text-white p-5 shadow-lg">
        {/* Glow decorative design bubble */}
        <div className="absolute right-0 top-0 h-40 w-40 rounded-full bg-white/5 blur-xl -translate-y-12 translate-x-12" />
        <div className="relative z-10 grid gap-5 md:grid-cols-4">
          <div className="space-y-1">
            <p className="text-[10px] uppercase tracking-wider text-white/60 font-bold">Total System Requests</p>
            <h3 className="text-2xl font-black">{combinedSummary.totalRequests}</h3>
            <p className="text-[10px] text-white/50">Across all providers today</p>
          </div>
          <div className="space-y-1">
            <p className="text-[10px] uppercase tracking-wider text-white/60 font-bold">Total Tokens Used</p>
            <h3 className="text-2xl font-black">{combinedSummary.totalTokensUsed.toLocaleString()}</h3>
            <p className="text-[10px] text-white/50">Cumulative usage today</p>
          </div>
          <div className="space-y-1">
            <p className="text-[10px] uppercase tracking-wider text-white/60 font-bold">Daily Allowed Capacity</p>
            <h3 className="text-2xl font-black">{combinedSummary.totalLimit.toLocaleString()}</h3>
            <p className="text-[10px] text-white/50">Allocated maximum pool</p>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between items-baseline">
              <p className="text-[10px] uppercase tracking-wider text-white/60 font-bold">System Load</p>
              <span className="text-xs font-extrabold">{combinedSummary.percentage}%</span>
            </div>
            <div className="w-full bg-white/20 h-2 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${getStatusColor(combinedSummary.status)}`}
                style={{ width: `${combinedSummary.percentage}%` }}
              />
            </div>
            <p className="text-[10px] text-white/60 flex items-center justify-between">
              <span>Remaining: {combinedSummary.totalRemaining.toLocaleString()} tokens</span>
              <span className="capitalize text-white/80 font-bold">{combinedSummary.status} zone</span>
            </p>
          </div>
        </div>
      </div>

      {/* Individual Provider Breakdown Cards */}
      <div className="grid gap-5 sm:grid-cols-3">
        {Object.entries(apiBreakdown).map(([key, item]) => {
          const apiStat = item as ApiStat;
          return (
            <div key={key} className="bg-white border border-[var(--line)] rounded-lg p-5 shadow-sm space-y-4 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-gray-800 text-sm capitalize">{key}</h4>
                  <p className="text-[10px] text-gray-400 font-medium">Provider Service</p>
                </div>
                <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded border capitalize tracking-wider ${getBadgeColor(apiStat.status)}`}>
                  {apiStat.status}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-gray-50 p-2 rounded-xl">
                  <span className="text-[10px] font-bold text-gray-400 block uppercase">Requests</span>
                  <span className="font-bold text-gray-700 text-sm mt-0.5 block">{apiStat.requestsToday}</span>
                </div>
                <div className="bg-gray-50 p-2 rounded-xl">
                  <span className="text-[10px] font-bold text-gray-400 block uppercase">Used Today</span>
                  <span className="font-bold text-gray-700 text-sm mt-0.5 block truncate" title={apiStat.tokensUsedToday.toLocaleString()}>
                    {apiStat.tokensUsedToday.toLocaleString()}
                  </span>
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between items-baseline text-xs">
                  <span className="text-gray-400 font-medium">Limit: {apiStat.limit.toLocaleString()}</span>
                  <span className="font-bold text-gray-700">{apiStat.percentage}%</span>
                </div>
                <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${getStatusColor(apiStat.status)}`}
                    style={{ width: `${apiStat.percentage}%` }}
                  />
                </div>
                <span className="text-[10px] text-gray-400 block text-right font-medium">
                  {apiStat.remaining.toLocaleString()} tokens left
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Comparative Charts: Custom CSS-Only Bar Chart */}
      <div className="bg-white border border-[var(--line)] rounded-lg p-5 shadow-sm space-y-4">
        <div>
          <h3 className="font-bold text-gray-800 text-sm flex items-center gap-1.5">
            <TrendingUp size={16} className="text-[var(--brand)]" />
            Comparison & Allocation Summary
          </h3>
          <p className="text-[10px] text-gray-400">Comparing token utilization across active providers.</p>
        </div>

        <div className="space-y-3.5 pt-1.5">
          {Object.entries(apiBreakdown).map(([key, item]) => {
            const apiStat = item as ApiStat;
            return (
              <div key={key} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="capitalize text-gray-600 font-bold">{key} API</span>
                  <span className="text-gray-500 font-medium">
                    {apiStat.tokensUsedToday.toLocaleString()} / {apiStat.limit.toLocaleString()} ({apiStat.percentage}%)
                  </span>
                </div>
                <div className="relative w-full bg-gray-100 h-3 rounded-lg overflow-hidden flex">
                  <div
                    className={`h-full rounded-lg transition-all duration-500 ${apiStat.status === "critical" ? "bg-rose-500" :
                        apiStat.status === "moderate" ? "bg-amber-500" : "bg-[var(--brand)]"
                      }`}
                    style={{ width: `${apiStat.percentage}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Usage Logs & Audit Log Table */}
      <div className="bg-white border border-[var(--line)] rounded-lg p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-3">
          <div>
            <h3 className="font-bold text-gray-800 text-sm flex items-center gap-1.5">
              <Database size={16} className="text-[var(--brand)]" />
              API Request Logs
            </h3>
            <p className="text-[10px] text-gray-400">Detailed list of recent AI assistant completions and tokens consumed.</p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-450" size={13} />
              <input
                type="text"
                placeholder="Search user email or model..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 pr-2.5 py-1 text-xs border border-gray-250 rounded-lg outline-none bg-gray-50/50 focus:bg-white focus:border-[var(--brand)] transition w-48 sm:w-56"
              />
            </div>

            <select
              value={apiFilter}
              onChange={(e: any) => setApiFilter(e.target.value)}
              className="text-xs font-bold text-gray-650 bg-gray-50 border border-gray-250 rounded-lg px-2.5 py-1 cursor-pointer outline-none focus:border-[var(--brand)] transition"
            >
              <option value="all">All APIs</option>
              <option value="groq">Groq</option>
              <option value="gemini">Gemini</option>
              <option value="openrouter">OpenRouter</option>
            </select>
          </div>
        </div>

        {/* Table representation */}
        <div className="overflow-x-auto">
          {filteredLogs.length > 0 ? (
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-gray-100 text-gray-400 font-bold uppercase tracking-wider bg-gray-50/50">
                  <th className="py-2.5 px-3">Timestamp</th>
                  <th className="py-2.5 px-3">User</th>
                  <th className="py-2.5 px-3">API Name</th>
                  <th className="py-2.5 px-3">Model Name</th>
                  <th className="py-2.5 px-3 text-right">Tokens Consumed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredLogs.map((log) => (
                  <tr key={log._id} className="hover:bg-gray-50/50 transition">
                    <td className="py-2 px-3 text-gray-500 whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleString(undefined, {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit"
                      })}
                    </td>
                    <td className="py-2 px-3">
                      {log.user ? (
                        <div className="flex flex-col">
                          <span className="font-bold text-gray-700">{log.user.name}</span>
                          <span className="text-[10px] text-gray-400">{log.user.email}</span>
                        </div>
                      ) : (
                        <span className="text-gray-400 italic">Unknown User</span>
                      )}
                    </td>
                    <td className="py-2 px-3">
                      <span className="capitalize font-bold text-gray-650">{log.apiName}</span>
                    </td>
                    <td className="py-2 px-3 font-mono text-[10px] text-gray-500 truncate max-w-[150px]" title={log.model}>
                      {log.model}
                    </td>
                    <td className="py-2 px-3 text-right font-bold text-gray-700">
                      {log.tokensUsed.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="py-8 text-center text-gray-400">
              No recent logs found matching search/filter criteria.
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
