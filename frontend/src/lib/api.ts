export const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";
export const ASSET_URL = API_URL.replace(/\/api$/, "");

type ApiOptions = {
  token?: string;
  method?: string;
  body?: BodyInit | object;
};

export async function api<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const isForm = options.body instanceof FormData;
  const requestBody: BodyInit | undefined = isForm
    ? options.body as BodyInit
    : options.body
      ? JSON.stringify(options.body)
      : undefined;
  const response = await fetch(`${API_URL}${path}`, {
    method: options.method || "GET",
    credentials: "include",
    headers: {
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      ...(options.body && !isForm ? { "Content-Type": "application/json" } : {}),
    },
    body: requestBody,
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || "Request failed");
  }
  return data as T;
}

export function asset(path?: string) {
  if (!path) return "";
  if (path.startsWith("http")) return path;
  return `${ASSET_URL}${path}`;
}
