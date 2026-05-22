import { createGeminiProvider, hasGeminiCredentials } from './gemini.js';
import { createGroqProvider, hasGroqCredentials } from './groq.js';
import {
  createHuggingFaceProvider,
  hasHuggingFaceCredentials,
} from './huggingface.js';
import { resolveModelsForProvider } from './model-presets.js';
import { createOllamaProvider, isOllamaHealthy } from './ollama.js';
import { createOpenRouterProvider, hasOpenRouterCredentials } from './openrouter.js';
import type { LlmProvider, ProviderName, ResolvedLlmSetup } from './types.js';

export type ProviderProbeStatus =
  | {
      name: ProviderName;
      status: 'ready';
      answerModels: string[];
      judgeModel: string;
    }
  | { name: ProviderName; status: 'unavailable'; reason: string };

export function createLlmProvider(name: ProviderName): LlmProvider {
  switch (name) {
    case 'ollama':
      return createOllamaProvider();
    case 'groq':
      return createGroqProvider();
    case 'openrouter':
      return createOpenRouterProvider();
    case 'gemini':
      return createGeminiProvider();
    case 'huggingface':
      return createHuggingFaceProvider();
  }
}

async function tryResolve(name: ProviderName): Promise<ResolvedLlmSetup | null> {
  if (name === 'ollama') {
    if (!(await isOllamaHealthy())) {
      return null;
    }
  } else if (name === 'groq' && !hasGroqCredentials()) {
    return null;
  } else if (name === 'openrouter' && !hasOpenRouterCredentials()) {
    return null;
  } else if (name === 'gemini' && !hasGeminiCredentials()) {
    return null;
  } else if (name === 'huggingface' && !hasHuggingFaceCredentials()) {
    return null;
  }

  const { answerModels, judgeModel } = resolveModelsForProvider(name);

  return {
    providerName: name,
    provider: createLlmProvider(name),
    answerModels,
    judgeModel,
  };
}

export const PROVIDER_ORDER: ProviderName[] = [
  'ollama',
  'groq',
  'openrouter',
  'gemini',
  'huggingface',
];

export async function isProviderAvailable(name: ProviderName): Promise<boolean> {
  if (name === 'ollama') {
    return isOllamaHealthy();
  }

  if (name === 'groq') {
    return hasGroqCredentials();
  }

  if (name === 'openrouter') {
    return hasOpenRouterCredentials();
  }

  if (name === 'gemini') {
    return hasGeminiCredentials();
  }

  if (name === 'huggingface') {
    return hasHuggingFaceCredentials();
  }

  return false;
}

export async function resolveProvider(): Promise<ResolvedLlmSetup> {
  for (const name of PROVIDER_ORDER) {
    const resolved = await tryResolve(name);

    if (resolved) {
      return resolved;
    }
  }

  throw new Error(
    'No LLM provider available. Start Ollama or set GROQ_API_KEY, OPENROUTER_API_KEY, GEMINI_API_KEY, or HUGGINGFACE_API_KEY.',
  );
}

export async function tryResolveGroq(): Promise<ResolvedLlmSetup | null> {
  return tryResolve('groq');
}

const CLOUD_PROVIDER_ORDER: ProviderName[] = ['groq', 'openrouter', 'gemini', 'huggingface'];

export async function resolveFirstCloudProvider(): Promise<ResolvedLlmSetup | null> {
  for (const name of CLOUD_PROVIDER_ORDER) {
    const resolved = await tryResolve(name);

    if (resolved) {
      return resolved;
    }
  }

  return null;
}

export async function resolveNextProvider(
  current: ProviderName,
): Promise<ResolvedLlmSetup | null> {
  const index = PROVIDER_ORDER.indexOf(current);
  const rest = PROVIDER_ORDER.slice(index + 1);

  for (const name of rest) {
    const resolved = await tryResolve(name);

    if (resolved) {
      return resolved;
    }
  }

  return null;
}

async function probeProvider(name: ProviderName): Promise<ProviderProbeStatus> {
  if (name === 'ollama') {
    if (!(await isOllamaHealthy())) {
      return { name, status: 'unavailable', reason: 'not reachable' };
    }
  } else if (name === 'groq' && !hasGroqCredentials()) {
    return { name, status: 'unavailable', reason: 'API key not set' };
  } else if (name === 'openrouter' && !hasOpenRouterCredentials()) {
    return { name, status: 'unavailable', reason: 'API key not set' };
  } else if (name === 'gemini' && !hasGeminiCredentials()) {
    return { name, status: 'unavailable', reason: 'API key not set' };
  } else if (name === 'huggingface' && !hasHuggingFaceCredentials()) {
    return { name, status: 'unavailable', reason: 'API key not set' };
  }

  const { answerModels, judgeModel } = resolveModelsForProvider(name);

  return {
    name,
    status: 'ready',
    answerModels: answerModels.map((model) => model.model),
    judgeModel: judgeModel.model,
  };
}

export async function probeAllProviders(): Promise<ProviderProbeStatus[]> {
  return Promise.all(PROVIDER_ORDER.map((name) => probeProvider(name)));
}

export async function probeActiveProvider(): Promise<ProviderProbeStatus | null> {
  for (const name of PROVIDER_ORDER) {
    const probe = await probeProvider(name);

    if (probe.status === 'ready') {
      return probe;
    }
  }

  return null;
}
