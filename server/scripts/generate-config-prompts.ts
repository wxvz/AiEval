import 'dotenv/config';

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import type { ModelFallbackHandlers } from '../src/automation/resilient-llm.js';
import { config } from '../src/config.js';
import { closeDb, connectDb, getEvaluationsCollection } from '../src/db.js';
import {
  DEFAULT_EVALUATION_CONFIG,
  normalizeEvaluationConfig,
  responseConstraintsForGoal,
} from '../src/evaluation-config.js';
import { generateEvaluationPrompt } from '../src/llm/generate-prompt.js';
import { generateEvaluationTitle } from '../src/llm/generate-title.js';
import { resolveProvider } from '../src/llm/provider.js';
import { parseObjectId } from '../src/serialization.js';
import type { EvaluationConfig, EvaluationRecord } from '../src/types/evaluation.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const OUT_PATH = path.join(ROOT, 'evaluation-config-prompts.json');

/** Groq on-demand judge cap; each combo issues 2 judge calls (title + prompt). */
const GROQ_JUDGE_RPM = 30;
const JUDGE_CALLS_PER_COMBO = 2;
/** Min spacing between judge calls to stay under RPM (10% headroom). */
const DEFAULT_BATCH_DELAY_MS = Math.ceil((60_000 / GROQ_JUDGE_RPM) * 1.1);

function parseBatchDelayMs(): number {
  const raw = process.env['CONFIG_PROMPT_BATCH_DELAY_MS'];
  if (raw?.trim()) {
    const parsed = Number(raw);
    if (Number.isFinite(parsed) && parsed >= 0) {
      return Math.min(60_000, Math.round(parsed));
    }
  }
  return DEFAULT_BATCH_DELAY_MS;
}

const BATCH_DELAY_MS = Math.max(config.llmInterCallDelayMs, parseBatchDelayMs());

class BatchLlmPacer {
  private lastCallAt = 0;

  delayMs(): number {
    return BATCH_DELAY_MS;
  }

  async wait(): Promise<void> {
    const elapsed = Date.now() - this.lastCallAt;
    const wait = BATCH_DELAY_MS - elapsed;
    if (wait > 0) {
      await sleep(wait);
    }
    this.lastCallAt = Date.now();
  }

  async cooldownFromError(error: unknown): Promise<void> {
    const message = error instanceof Error ? error.message : String(error);
    if (!/429|rate limit/i.test(message)) {
      return;
    }

    const match = message.match(/try again in (?:(\d+)m)?([\d.]+)s/i);
    if (!match) {
      return;
    }

    const minutes = match[1] ? Number.parseInt(match[1], 10) : 0;
    const seconds = Number.parseFloat(match[2]);
    const waitMs = (minutes * 60 + seconds + 3) * 1000;
    console.log(`\nprovider cooldown ${Math.round(waitMs / 1000)}s…`);
    await sleep(waitMs);
    this.lastCallAt = Date.now();
  }
}

const GOALS = ['general', 'coding', 'reasoning', 'grounded', 'safety', 'creative'] as const;
const DIFFICULTIES = ['easy', 'balanced', 'hard'] as const;
const AUDIENCES = ['general', 'beginner', 'expert', 'executive'] as const;

type Goal = (typeof GOALS)[number];
type Difficulty = (typeof DIFFICULTIES)[number];
type Audience = (typeof AUDIENCES)[number];

interface ProgressEntry {
  evaluationConfig: EvaluationConfig;
  title?: string;
  prompt?: string;
  evaluationId?: string;
  /** @deprecated Legacy progress field from template-based runs. */
  templateId?: string;
  error?: string;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildConfig(goal: Goal, taskDifficulty: Difficulty, audience: Audience): EvaluationConfig {
  return {
    ...DEFAULT_EVALUATION_CONFIG,
    goal,
    taskDifficulty,
    audience,
    responseConstraints: responseConstraintsForGoal(goal, taskDifficulty),
  };
}

function responseConstraintsMatch(a: EvaluationConfig, b: EvaluationConfig): boolean {
  const ar = a.responseConstraints;
  const br = b.responseConstraints;

  return (
    ar.requireCitations === br.requireCitations &&
    ar.requireCode === br.requireCode &&
    ar.requireTests === br.requireTests
  );
}

function needsPromptGeneration(
  entry: ProgressEntry | undefined,
  evaluationConfig: EvaluationConfig,
): boolean {
  if (!entry?.title || !entry?.prompt) {
    return true;
  }

  return !responseConstraintsMatch(entry.evaluationConfig, evaluationConfig);
}

function configKey(evaluationConfig: EvaluationConfig): string {
  return `${evaluationConfig.goal}|${evaluationConfig.taskDifficulty}|${evaluationConfig.audience}`;
}

function label(evaluationConfig: EvaluationConfig): string {
  return `${evaluationConfig.goal} / ${evaluationConfig.taskDifficulty} / ${evaluationConfig.audience}`;
}

function configsMatch(a: EvaluationConfig, b: EvaluationConfig): boolean {
  return (
    a.goal === b.goal &&
    a.taskDifficulty === b.taskDifficulty &&
    a.audience === b.audience
  );
}

function savedEvaluationId(entry: ProgressEntry | undefined): string | undefined {
  return entry?.evaluationId ?? entry?.templateId;
}

async function runLlmCall<T>(pacer: BatchLlmPacer, fn: () => Promise<T>): Promise<T> {
  await pacer.wait();
  return fn();
}

async function loadProgress(): Promise<ProgressEntry[]> {
  try {
    const raw = await fs.readFile(OUT_PATH, 'utf8');
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as ProgressEntry[]) : [];
  } catch {
    return [];
  }
}

async function saveProgress(results: ProgressEntry[]): Promise<void> {
  await fs.writeFile(OUT_PATH, JSON.stringify(results, null, 2), 'utf8');
}

async function saveEvaluation({
  title,
  prompt,
  evaluationConfig,
  existingId,
}: {
  title: string;
  prompt: string;
  evaluationConfig: EvaluationConfig;
  existingId?: string;
}): Promise<string> {
  const now = new Date().toISOString();
  const normalizedConfig = normalizeEvaluationConfig(evaluationConfig);
  const collection = getEvaluationsCollection();
  const objectId = existingId ? parseObjectId(existingId) : undefined;

  if (objectId) {
    await collection.updateOne(
      { _id: objectId },
      {
        $set: {
          title,
          prompt,
          evaluationConfig: normalizedConfig,
          updatedAt: now,
        },
      },
    );
    return existingId!;
  }

  const document: EvaluationRecord = {
    title,
    prompt,
    criteriaMode: 'default',
    criteria: [],
    evaluationConfig: normalizedConfig,
    answers: [],
    createdAt: now,
    updatedAt: now,
  };
  const result = await collection.insertOne(document);
  return result.insertedId.toString();
}

async function main(): Promise<void> {
  const combinations: EvaluationConfig[] = [];
  for (const goal of GOALS) {
    for (const taskDifficulty of DIFFICULTIES) {
      for (const audience of AUDIENCES) {
        combinations.push(buildConfig(goal, taskDifficulty, audience));
      }
    }
  }

  await connectDb();

  const [progressFile, dbEvaluations] = await Promise.all([
    loadProgress(),
    getEvaluationsCollection().find().toArray(),
  ]);

  const resultsByKey = new Map<string, ProgressEntry>();

  for (const evaluationConfig of combinations) {
    const key = configKey(evaluationConfig);
    const fromFile = progressFile.find(
      (entry) => entry.evaluationConfig && configKey(entry.evaluationConfig) === key,
    );
    const fromDb = dbEvaluations.find(
      (evaluation) =>
        evaluation.evaluationConfig && configsMatch(evaluation.evaluationConfig, evaluationConfig),
    );

    if (fromDb || fromFile) {
      resultsByKey.set(key, {
        evaluationConfig,
        title: fromFile?.title ?? fromDb?.title,
        prompt: fromFile?.prompt ?? fromDb?.prompt,
        evaluationId: savedEvaluationId(fromFile) ?? fromDb?._id.toString(),
        ...(savedEvaluationId(fromFile) || fromDb ? {} : fromFile?.error ? { error: fromFile.error } : {}),
      });
    }
  }

  const setup = await resolveProvider();
  const handlers: ModelFallbackHandlers = {
    onModelFallback: (fromModel, toModel) => {
      console.log(`fallback ${fromModel} → ${toModel}`);
    },
  };
  const llmOptions = { setup, handlers };
  const pacer = new BatchLlmPacer();

  const needsWork = combinations.filter((evaluationConfig) => {
    const entry = resultsByKey.get(configKey(evaluationConfig));
    return !savedEvaluationId(entry) || needsPromptGeneration(entry, evaluationConfig);
  });

  console.log(
    `Total: ${combinations.length}. In DB: ${combinations.length - needsWork.length}. Remaining: ${needsWork.length}.`,
  );
  console.log(
    `Provider: ${setup.providerName} (${setup.judgeModel.model}). Batch delay: ${pacer.delayMs()}ms (${JUDGE_CALLS_PER_COMBO} judge calls/combo, ${GROQ_JUDGE_RPM} RPM cap).\n`,
  );

  let generated = 0;
  let saved = 0;
  let failed = 0;

  for (let i = 0; i < needsWork.length; i++) {
    const evaluationConfig = needsWork[i];
    const key = configKey(evaluationConfig);
    let entry = resultsByKey.get(key) ?? { evaluationConfig };
    entry = { ...entry, evaluationConfig };
    process.stdout.write(`[${i + 1}/${needsWork.length}] ${label(evaluationConfig)}… `);

    try {
      if (needsPromptGeneration(entry, evaluationConfig)) {
        const title = await runLlmCall(pacer, () =>
          generateEvaluationTitle({}, llmOptions, evaluationConfig),
        );
        const prompt = await runLlmCall(pacer, () =>
          generateEvaluationPrompt(title, {}, llmOptions, evaluationConfig),
        );
        entry = { ...entry, title, prompt, evaluationConfig };
        delete entry.error;
        generated++;
      }

      const evaluationId = await saveEvaluation({
        title: entry.title!,
        prompt: entry.prompt!,
        evaluationConfig,
        existingId: savedEvaluationId(entry),
      });
      entry = { ...entry, evaluationId };
      delete entry.templateId;
      resultsByKey.set(key, entry);
      saved++;
      console.log('saved');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      resultsByKey.set(key, { ...entry, error: message });
      failed++;
      console.log(`FAILED: ${message}`);
      await pacer.cooldownFromError(error);
    }

    const ordered = combinations.map((evaluationConfig) => {
      const result = resultsByKey.get(configKey(evaluationConfig));
      return result ?? { evaluationConfig, error: 'not generated yet' };
    });
    await saveProgress(ordered);
  }

  await closeDb();

  console.log(`\nDone. Generated ${generated} new prompts, saved ${saved} evaluations, ${failed} failed.`);
  console.log(`Progress file: ${OUT_PATH}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
