#!/usr/bin/env node

const { DEFAULT_CONFIG_PATH, ensureConfigShape, getDefaultModelIds, loadConfig, providerEntries, resolveConfigPath } = require('../src/openclaw-config');

function providerModels(provider) {
  return Array.isArray(provider?.models) ? provider.models : [];
}
function formatTokenCount(value) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(value % 1_000_000 === 0 ? 0 : 1)}m`;
  if (value >= 1_000) return `${Math.round(value / 1_000)}k`;
  return String(value);
}
const { startOpenClawTUI, testModelDirect } = require('../src/openclaw-tui');

function resolveModelRef(config, ref) {
  if (!ref) return null;
  const value = String(ref);
  if (value.includes('/')) {
    const [providerName, ...parts] = value.split('/');
    const modelId = parts.join('/');
    if (!providerName || !modelId) return null;
    return { providerName, modelId, fullId: value };
  }
  const matches = [];
  for (const [providerName, provider] of providerEntries(config)) {
    for (const model of providerModels(provider)) {
      if (model.id === value) matches.push({ providerName, modelId: model.id });
    }
  }
  if (matches.length === 0) return null;
  if (matches.length === 1) {
    const m = matches[0];
    return { ...m, fullId: `${m.providerName}/${m.modelId}` };
  }
  return { ambiguous: true, matches };
}

function printHelp() {
  console.log(`
clawd-models - OpenClaw Model Configuration Tool

Usage:
  clawd-models              # Run interactive TUI
  clawd-models --tui        # Run interactive TUI
  clawd-models --test       # Test primary model with a sample prompt + tool call
  clawd-models --list-providers   # List configured providers
  clawd-models --list-models      # List configured models
  clawd-models --view-config      # View full configuration

Options:
  -t, --test           Test API connection
  -p, --list-providers List providers
  -m, --list-models    List models
  -v, --view-config    View configuration
  -h, --help           Show this help

Note: Interactive TUI requires a real terminal.
`);
}

function getConfigPath() {
  return resolveConfigPath(process.env.OPENCLAW_CONFIG_PATH || DEFAULT_CONFIG_PATH);
}

function loadOpenClaw() {
  return ensureConfigShape(loadConfig(getConfigPath()));
}

async function runTest() {
  const config = loadOpenClaw();
  const primary = config.agents?.defaults?.model?.primary;
  if (!primary) {
    console.error('Error: No primary model configured.');
    process.exit(1);
  }

  const resolved = resolveModelRef(config, primary);
  if (!resolved) {
    console.error(`Error: Model "${primary}" not found in any provider.`);
    process.exit(1);
  }
  if (resolved.ambiguous) {
    const options = resolved.matches.map((m) => `${m.providerName}/${m.modelId}`).join(', ');
    console.error(`Error: Model "${primary}" is ambiguous across providers. Use one of: ${options}`);
    process.exit(1);
  }
  const { providerName, modelId, fullId } = resolved;

  console.log(`Testing primary model: ${fullId}\n`);

  try {
    const result = await testModelDirect(config, providerName, modelId, 'say hi');
    console.log('✅ Test complete');
    console.log(`Model: ${result.modelId}`);
    console.log(`Provider: ${result.providerName}`);
    console.log(`Schema: ${result.apiSchema}`);
    console.log(`Endpoint: ${result.endpoint}`);
    console.log(`First status: ${result.firstStatus}`);
    console.log(`Final status: ${result.finalStatus}`);
    console.log(`Tool calls: ${Array.isArray(result.toolCalls) ? result.toolCalls.length : 0}`);
    if (result.finalResponse) {
      console.log('\nResponse:');
      console.log(JSON.stringify(result.finalResponse, null, 2));
    }
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

async function runListProviders() {
  const config = loadOpenClaw();
  const entries = providerEntries(config);

  if (entries.length === 0) {
    console.log('No providers configured.');
    return;
  }

  console.log('Configured Providers:\n');
  for (const [name, provider] of entries) {
    console.log(`- ${name}`);
    console.log(`  Base URL: ${provider.baseUrl || ''}`);
    console.log(`  API Schema: ${provider.apiSchema || ''}`);
    console.log(`  API Key: ${provider.apiKey ? 'set' : 'empty'}`);
    console.log(`  Models: ${providerModels(provider).length}`);
    console.log();
  }
}

async function runListModels() {
  const config = loadOpenClaw();
  const entries = providerEntries(config);
  const models = [];
  for (const [providerName, provider] of entries) {
    for (const model of providerModels(provider)) {
      models.push({ providerName, model });
    }
  }

  if (models.length === 0) {
    console.log('No models configured.');
    return;
  }

  console.log('Configured Models:\n');
  for (const { providerName, model } of models) {
    const ctx = model.contextWindow !== undefined ? `ctx ${formatTokenCount(model.contextWindow)}` : '';
    const max = model.maxTokens !== undefined ? `max ${formatTokenCount(model.maxTokens)}` : '';
    console.log(`- ${providerName}/${model.id}  ${[ctx, max].filter(Boolean).join('  ')}`);
  }
}

async function runViewConfig() {
  const config = loadOpenClaw();
  console.log(JSON.stringify(config, null, 2));
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command || command === '--tui') {
    await startOpenClawTUI({ configPath: process.env.OPENCLAW_CONFIG_PATH });
    return;
  }

  switch (command) {
    case '--test':
    case '-t':
      await runTest();
      break;
    case '--list-providers':
    case '-p':
      await runListProviders();
      break;
    case '--list-models':
    case '-m':
      await runListModels();
      break;
    case '--view-config':
    case '-v':
      await runViewConfig();
      break;
    case '--help':
    case '-h':
      printHelp();
      break;
    default:
      console.error(`Unknown command: ${command}`);
      console.log('Run "clawd-models --help" for usage information.');
      process.exit(1);
  }
}

process.on('SIGINT', () => {
  console.log('\n\nExiting clawd-models...');
  process.exit(0);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

main();
