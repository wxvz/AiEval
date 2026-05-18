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
      answer: ['llama-3.1-8b-instant', 'gemma2-9b-it', 'llama-3.2-3b'],
      judge: 'llama-3.3-70b-versatile',
    },
    fast: {
      answer: ['llama-3.1-8b-instant', 'llama-3.1-8b-instant', 'llama-3.2-3b'],
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

function parseModelList(raw: string): string[] | null {
  const trimmed = raw.trim();

  if (!trimmed) {
    return null;
  }

  return trimmed.split(',').map((entry) => {
    const colon = entry.indexOf(':');
    return colon >= 0 ? entry.slice(colon + 1).trim() : entry.trim();
  });
}

export function resolveModelsForProvider(providerName: ProviderName): {
  answerModels: ModelRef[];
  judgeModel: ModelRef;
} {
  const preset = PRESETS[providerName][config.llmPreset];
  const customAnswers = parseModelList(config.llmAnswerModels);
  const customJudge = config.llmJudgeModel.trim();
  const judgeFromEnv =
    customJudge.includes(':') ? customJudge.slice(customJudge.indexOf(':') + 1).trim() : customJudge;

  const answerIds = customAnswers ?? preset.answer;
  const judgeId = judgeFromEnv || preset.judge;

  return {
    answerModels: answerIds.map((model) => ({ model, label: toLabel(model) })),
    judgeModel: { model: judgeId, label: toLabel(judgeId) },
  };
}
