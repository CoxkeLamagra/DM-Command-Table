export class ApiRequestError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}

export async function requestJson<T>(
  input: RequestInfo | URL,
  init: RequestInit = {},
  options: { fallback: string; network?: string; serverErrors?: boolean },
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(input, init);
  } catch {
    throw new ApiRequestError(options.network ?? options.fallback, 0);
  }
  const body = (await response.json().catch(() => ({}))) as T & {
    error?: string;
  };
  if (!response.ok)
    throw new ApiRequestError(
      options.serverErrors === false ? options.fallback : body.error ?? options.fallback,
      response.status,
    );
  return body;
}

export function jsonRequest(method: string, body: unknown): RequestInit {
  return {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  };
}
