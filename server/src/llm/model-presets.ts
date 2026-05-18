import { config } from '../config.js';
import type { ModelRef, ProviderName } from './types.js';

interface ProviderPreset {
  balanced: { answer: string[]; judge: string };
  fast: { answer: string[]; judge: string };
}

const PRESETS: Record<ProviderName, ProviderPreset> = {
  ollama: {
    balanced: {
      answer: ['llama3.2:3b', 'qwen2.5:3b', 'gemma2:2b'],
      judge: 'llama3.1:8b',
    },
    fast: {
      answer: ['llama3.2:3b', 'llama3.2:3b', 'gemma2:2b'],
      judge: 'llama3.2:3b',
    },
  },
  groq: {
    balanced: {
      answer: [
        'llama-3.1-8b-instant',
        'meta-llama/llama-4-scout-17b-16e-instruct',
        'qwen/qwen3-32b',
      ],
      judge: 'llama-3.3-70b-versatile',
    },
    fast: {
      answer: [
        'llama-3.1-8b-instant',
        'meta-llama/llama-4-scout-17b-16e-instruct',
        'qwen/qwen3-32b',
      ],
      judge: 'llama-3.1-8b-instant',
    },
  },
  openrouter: {
    balanced: {
      answer: [
        'meta-llama/llama-3.2-3b-instruct:free',
        'google/gemma-2-9b-it:free',
        'qwen/qwen-2.5-7b-instruct:free',
      ],
      judge: 'meta-llama/llama-3.3-70b-instruct:free',
    },
    fast: {
      answer: [
        'meta-llama/llama-3.2-3b-instruct:free',
        'meta-llama/llama-3.2-3b-instruct:free',
        'google/gemma-2-9b-it:free',
      ],
      judge: 'meta-llama/llama-3.2-3b-instruct:free',
    },
  },
  gemini: {
    balanced: {
      answer: ['gemini-2.0-flash', 'gemini-2.0-flash', 'gemini-2.0-flash'],
      judge: 'gemini-2.0-flash',
    },
    fast: {
      answer: ['gemini-2.0-flash', 'gemini-2.0-flash', 'gemini-2.0-flash'],
      judge: 'gemini-2.0-flash',
    },
  },
  huggingface: {
    balanced: {
      answer: [
        'Qwen/Qwen2.5-7B-Instruct',
        'microsoft/Phi-3-mini-4k-instruct',
        'google/gemma-2-2b-it',
      ],
      judge: 'Qwen/Qwen2.5-7B-Instruct',
    },
    fast: {
      answer: [
        'Qwen/Qwen2.5-7B-Instruct',
        'Qwen/Qwen2.5-7B-Instruct',
        'google/gemma-2-2b-it',
      ],
      judge: 'Qwen/Qwen2.5-7B-Instruct',
    },
  },
};

function toLabel(model: string): string {
  const short = model.includes('/') ? (model.split('/').pop() ?? model) : model;
  return short.replace(':free', '').replace(/-instruct$/, '');
}

const PROVIDER_NAMES: ProviderName[] = [
  'ollama',
  'groq',
  'openrouter',
  'gemini',
  'huggingface',
];

function isProviderName(value: string): value is ProviderName {
  return (PROVIDER_NAMES as string[]).includes(value);
}

interface ModelEntry {
  provider?: ProviderName;
  model: string;
}

function parseModelEntry(segment: string): ModelEntry | null {
  const trimmed = segment.trim();

  if (!trimmed) {
    return null;
  }

  const colon = trimmed.indexOf(':');

  if (colon < 0) {
    return { model: trimmed };
  }

  const prefix = trimmed.slice(0, colon).trim();

  if (isProviderName(prefix)) {
    const model = trimmed.slice(colon + 1).trim();

    return model.length > 0 ? { provider: prefix, model } : null;
  }

  return { model: trimmed };
}

function parseModelEntries(raw: string): ModelEntry[] | null {
  const trimmed = raw.trim();

  if (!trimmed) {
    return null;
  }

  const entries = trimmed
    .split(',')
    .map(parseModelEntry)
    .filter((entry): entry is ModelEntry => entry !== null);

  return entries.length > 0 ? entries : null;
}

function resolveModelsFromEntries(
  entries: ModelEntry[] | null,
  providerName: ProviderName,
  fallback: string[],
): string[] {
  if (!entries) {
    return fallback;
  }

  const models = entries
    .filter((entry) => !entry.provider || entry.provider === providerName)
    .map((entry) => entry.model);

  return models.length > 0 ? models : fallback;
}

function resolveJudgeModel(raw: string, providerName: ProviderName, fallback: string): string {
  const trimmed = raw.trim();

  if (!trimmed) {
    return fallback;
  }

  const entry = parseModelEntry(trimmed);

  if (!entry) {
    return fallback;
  }

  if (entry.provider && entry.provider !== providerName) {
    return fallback;
  }

  return entry.model;
}

export function resolveModelsForProvider(providerName: ProviderName): {
  answerModels: ModelRef[];
  judgeModel: ModelRef;
} {
  const preset = PRESETS[providerName][config.llmPreset];
  const customAnswerEntries = parseModelEntries(config.llmAnswerModels);
  const answerIds = resolveModelsFromEntries(customAnswerEntries, providerName, preset.answer);
  const judgeId = resolveJudgeModel(config.llmJudgeModel, providerName, preset.judge);

  return {
    answerModels: answerIds.map((model) => ({ model, label: toLabel(model) })),
    judgeModel: { model: judgeId, label: toLabel(judgeId) },
  };
}
