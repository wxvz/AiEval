import { Agent, fetch } from 'undici';

import { config } from '../config.js';

const llmHttpAgent = new Agent({
  headersTimeout: config.llmRequestTimeoutMs,
  bodyTimeout: config.llmRequestTimeoutMs,
});

export function llmFetch(url: string | URL, init?: Parameters<typeof fetch>[1]): ReturnType<typeof fetch> {
  return fetch(url, { ...init, dispatcher: llmHttpAgent });
}
