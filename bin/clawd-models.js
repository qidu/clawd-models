#!/usr/bin/env node

const { DEFAULT_CONFIG_PATH, ensureConfigShape, loadConfig, providerEntries, resolveConfigPath } = require('../src/openclaw-config');

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

  // ANSI color codes
  const bold = '\x1b[1m';
  const white = '\x1b[37m';
  const dim = '\x1b[2m';
  const reset = '\x1b[0m';

  console.log('Configured Providers:\n');
  for (const [name, provider] of entries) {
    console.log(`- ${bold}${white}${name}${reset}`);
    console.log(`  ${dim}Base URL:${reset} ${white}${provider.baseUrl || ''}${reset}`);
    console.log(`  ${dim}API Schema:${reset} ${white}${provider.api || ''}${reset}`);
    console.log(`  ${dim}API Key:${reset} ${white}${provider.apiKey ? 'set' : 'empty'}${reset}`);
    console.log(`  ${dim}Models:${reset} ${white}${providerModels(provider).length}${reset}`);
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

  const primary = config.agents?.defaults?.model?.primary;
  const fallbacks = config.agents?.defaults?.model?.fallbacks;
  const fallbackSet = new Set(Array.isArray(fallbacks) ? fallbacks : fallbacks ? [fallbacks] : []);

  // ANSI color codes
  const bold = '\x1b[1m';
  const white = '\x1b[37m';
  const dim = '\x1b[2m';
  const reset = '\x1b[0m';

  console.log('Configured Models:\n');
  for (const { providerName, model } of models) {
    const modelName = `${providerName}/${model.id}`;
    const displayName = model.name || '';
    const ctx = model.contextWindow !== undefined ? `${dim}ctx ${formatTokenCount(model.contextWindow)}${reset}` : '';
    const max = model.maxTokens !== undefined ? `${dim}max ${formatTokenCount(model.maxTokens)}${reset}` : '';
    const tags = [];
    if (modelName === primary) tags.push(`${dim}primary${reset}`);
    if (fallbackSet.has(modelName)) tags.push(`${dim}fallback${reset}`);
    const tagStr = tags.length > 0 ? ` [${tags.join(', ')}]` : '';
    // Show cost values if any is non-zero (use '-' for undefined)
    const cost = model.cost;
    const inputCost = cost?.input !== undefined ? cost.input : '-';
    const outputCost = cost?.output !== undefined ? cost.output : '-';
    const cacheReadCost = cost?.cacheRead !== undefined ? cost.cacheRead : '-';
    const cacheWriteCost = cost?.cacheWrite !== undefined ? cost.cacheWrite : '-';
    const hasNonZero = (cost?.input && cost.input !== 0) || (cost?.output && cost.output !== 0) || (cost?.cacheRead && cost.cacheRead !== 0) || (cost?.cacheWrite && cost.cacheWrite !== 0);
    const costStr = hasNonZero ? ` ${dim}[${inputCost}/${outputCost}/${cacheReadCost}/${cacheWriteCost}]${reset}` : '';
    // Name as last item
    const nameStr = displayName ? `  ${dim}${displayName}${reset}` : '';
    console.log(`- ${bold}${white}${modelName}${reset}  ${[ctx, max].filter(Boolean).join('  ')}${costStr}${tagStr}${nameStr}`);
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
