import { config } from '../config.js';

function mergeFetchSignals(userSignal?: AbortSignal | null): AbortSignal {
  const timeoutSignal = AbortSignal.timeout(config.llmRequestTimeoutMs);

  if (!userSignal) {
    return timeoutSignal;
  }

  return AbortSignal.any([userSignal, timeoutSignal]);
}

export function llmFetch(url: string | URL, init?: RequestInit): Promise<Response> {
  const { signal: userSignal, ...rest } = init ?? {};

  return fetch(url, {
    ...rest,
    signal: mergeFetchSignals(userSignal),
  });
}
