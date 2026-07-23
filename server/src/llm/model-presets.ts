import { config } from '../config.js';
import { getLlmPreset, type LlmPreset } from '../runtime-settings.js';
import type { ModelRef, ProviderName } from './types.js';

export type ModelRole = 'answer' | 'judge';

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
      judge: 'llama3.1:8b',
    },
  },
  groq: {
    // Scout + Qwen3-32B shut down 2026-07-17; Llama 3.x judge path deprecates 2026-08-16.
    // Replacements per https://console.groq.com/docs/deprecations
    balanced: {
      answer: [
        'llama-3.1-8b-instant',
        'qwen/qwen3.6-27b',
        'openai/gpt-oss-20b',
      ],
      judge: 'openai/gpt-oss-120b',
    },
    fast: {
      answer: [
        'llama-3.1-8b-instant',
        'qwen/qwen3.6-27b',
        'openai/gpt-oss-20b',
      ],
      judge: 'openai/gpt-oss-120b',
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
      judge: 'meta-llama/llama-3.3-70b-instruct:free',
    },
  },
  gemini: {
    balanced: {
      answer: ['gemini-2.0-flash', 'gemini-2.0-flash', 'gemini-2.0-flash'],
      judge: 'gemini-2.5-flash',
    },
    fast: {
      answer: ['gemini-2.0-flash', 'gemini-2.0-flash', 'gemini-2.0-flash'],
      judge: 'gemini-2.5-flash',
    },
  },
  huggingface: {
    balanced: {
      answer: [
        'Qwen/Qwen2.5-7B-Instruct',
        'microsoft/Phi-3-mini-4k-instruct',
        'google/gemma-2-2b-it',
      ],
      judge: 'meta-llama/Meta-Llama-3.1-8B-Instruct',
    },
    fast: {
      answer: [
        'Qwen/Qwen2.5-7B-Instruct',
        'Qwen/Qwen2.5-7B-Instruct',
        'google/gemma-2-2b-it',
      ],
      judge: 'meta-llama/Meta-Llama-3.1-8B-Instruct',
    },
  },
};

/** Short display label for a provider model id (answer cards, progress UI). */
export function modelIdToLabel(model: string): string {
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

function coerceJudgeNotAnswerModel(
  judgeId: string,
  answerIds: readonly string[],
  providerName: ProviderName,
): string {
  if (!answerIds.includes(judgeId)) {
    return judgeId;
  }

  for (const preset of ['balanced', 'fast'] as const) {
    const candidate = PRESETS[providerName][preset].judge;

    if (!answerIds.includes(candidate)) {
      return candidate;
    }
  }

  return judgeId;
}

function resolveJudgeModelForProvider(
  providerName: ProviderName,
  preset: LlmPreset,
  answerIds: readonly string[],
): string {
  const fallbackJudge = PRESETS[providerName][preset].judge;
  const judgeId = resolveJudgeModel(config.llmJudgeModel, providerName, fallbackJudge);

  return coerceJudgeNotAnswerModel(judgeId, answerIds, providerName);
}

export function resolveModelsForProvider(
  providerName: ProviderName,
  preset: LlmPreset = getLlmPreset(),
): {
  answerModels: ModelRef[];
  judgeModel: ModelRef;
} {
  const providerPreset = PRESETS[providerName][preset];
  const customAnswerEntries = parseModelEntries(config.llmAnswerModels);
  const answerIds = resolveModelsFromEntries(customAnswerEntries, providerName, providerPreset.answer);
  const judgeId = resolveJudgeModelForProvider(providerName, preset, answerIds);

  return {
    answerModels: answerIds.map((model) => ({ model, label: modelIdToLabel(model) })),
    judgeModel: { model: judgeId, label: modelIdToLabel(judgeId) },
  };
}

/** Resolve one model id for a slot/role without building the full answer model list. */
export function resolveSingleModel(
  providerName: ProviderName,
  role: ModelRole,
  slotIndex: number,
  preset: LlmPreset = getLlmPreset(),
): string {
  const providerPreset = PRESETS[providerName][preset];

  const customAnswerEntries = parseModelEntries(config.llmAnswerModels);
  const answerIds = resolveModelsFromEntries(
    customAnswerEntries,
    providerName,
    providerPreset.answer,
  );

  if (role === 'judge') {
    return resolveJudgeModelForProvider(providerName, preset, answerIds);
  }

  return answerIds[slotIndex] ?? answerIds[answerIds.length - 1]!;
}
