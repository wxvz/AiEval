import { config } from '../config.js';
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

function printSummary(
  probes: ProviderProbeStatus[],
  active: Extract<ProviderProbeStatus, { status: 'ready' }> | null,
): void {
  console.log('Startup checks');
  console.log(formatLine('MongoDB', `ok (${config.dbName})`));

  for (const probe of probes) {
    console.log(formatLine(PROVIDER_LABELS[probe.name], formatProviderStatus(probe)));
  }

  if (active) {
    console.log(formatLine('Automation provider', formatActiveProvider(active)));
  } else {
    console.warn(
      '  Warning: no LLM provider available. Automated evaluation will fail until Ollama is running or a cloud API key is set.',
    );
  }
}

export async function runStartupPreflight(): Promise<void> {
  if (!config.startupPreflight) {
    return;
  }

  const probes = await probeAllProviders();
  const active =
    probes.find((probe): probe is Extract<ProviderProbeStatus, { status: 'ready' }> =>
      probe.status === 'ready',
    ) ?? null;

  printSummary(probes, active);

  logEvent('info', LogEvents.startupPreflight, {
    dbName: config.dbName,
    providers: probes,
    activeProvider: active?.status === 'ready' ? active.name : null,
    ...(active?.status === 'ready'
      ? { answerModels: active.answerModels, judgeModel: active.judgeModel }
      : {}),
  });
}
