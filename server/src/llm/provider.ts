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

function createProvider(name: ProviderName): LlmProvider {
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
    provider: createProvider(name),
    answerModels,
    judgeModel,
  };
}

const PROVIDER_ORDER: ProviderName[] = [
  'ollama',
  'groq',
  'openrouter',
  'gemini',
  'huggingface',
];

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
