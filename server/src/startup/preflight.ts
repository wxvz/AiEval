import { config } from '../config.js';
import { probeMongo, type MongoProbeStatus } from '../db.js';
import { probeAllProviders, type ProviderProbeStatus } from '../llm/provider.js';
import type { ProviderName } from '../llm/types.js';
import { LogEvents } from '../logging/events.js';
import { logEvent } from '../logging/logger.js';

const PROVIDER_LABELS: Record<ProviderName, string> = {
  ollama: 'Ollama',
  groq: 'Groq',
  openrouter: 'OpenRouter',
  gemini: 'Gemini',
  huggingface: 'Hugging Face',
};

function formatLine(label: string, value: string, labelWidth = 22): string {
  const dots = '.'.repeat(Math.max(1, labelWidth - label.length));
  return `  ${label} ${dots} ${value}`;
}

function formatProviderStatus(probe: ProviderProbeStatus): string {
  if (probe.status === 'unavailable') {
    return `unavailable (${probe.reason})`;
  }

  const models = probe.answerModels.join(', ');
  return `ok — ${models}`;
}

function formatActiveProvider(
  probe: Extract<ProviderProbeStatus, { status: 'ready' }>,
): string {
  const models = probe.answerModels.join(', ');
  return `${probe.name} (${models})`;
}

function formatMongoStatus(mongo: MongoProbeStatus): string {
  if (mongo.ok) {
    return `ok (${mongo.dbName})`;
  }

  return `unavailable (${mongo.reason})`;
}

function printSummary(
  mongo: MongoProbeStatus,
  probes: ProviderProbeStatus[],
  active: Extract<ProviderProbeStatus, { status: 'ready' }> | null,
): void {
  console.log('Startup checks');
  console.log(formatLine('MongoDB', formatMongoStatus(mongo)));

  for (const probe of probes) {
    console.log(formatLine(PROVIDER_LABELS[probe.name], formatProviderStatus(probe)));
  }

  if (active) {
    console.log(formatLine('Automation provider', formatActiveProvider(active)));
  } else {
    console.warn(
      '  Warning: no LLM provider available. Server starts anyway (fail-open) so local UI/API work without Ollama or cloud keys; automated evaluation will fail until a provider is ready.',
    );
  }
}

export async function runStartupPreflight(): Promise<void> {
  if (!config.startupPreflight) {
    logEvent('info', LogEvents.startupPreflight, {
      message: 'Startup preflight skipped (STARTUP_PREFLIGHT=false)',
      skipped: true,
    });
    return;
  }

  const mongo = await probeMongo();
  const probes = await probeAllProviders();
  const active =
    probes.find((probe): probe is Extract<ProviderProbeStatus, { status: 'ready' }> =>
      probe.status === 'ready',
    ) ?? null;

  printSummary(mongo, probes, active);

  logEvent('info', LogEvents.startupPreflight, {
    dbName: mongo.dbName,
    mongoOk: mongo.ok,
    ...(!mongo.ok ? { mongoReason: mongo.reason } : {}),
    providers: probes,
    activeProvider: active?.status === 'ready' ? active.name : null,
    ...(active?.status === 'ready'
      ? { answerModels: active.answerModels, judgeModel: active.judgeModel }
      : {}),
  });
}
