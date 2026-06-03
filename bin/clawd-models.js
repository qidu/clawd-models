#!/usr/bin/env node

const { DEFAULT_CONFIG_PATH, ensureConfigShape, getDefaultModelIds, loadConfig, providerEntries, providerModels, resolveConfigPath } = require('../src/openclaw-config');
const { startOpenClawTUI, testModelDirect } = require('../src/openclaw-tui');

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

  const [providerName, ...modelParts] = String(primary).split('/');
  const modelId = modelParts.join('/');
  if (!providerName || !modelId) {
    console.error('Error: Primary model must be in provider/model-id format.');
    process.exit(1);
  }

  console.log(`Testing primary model: ${primary}\n`);

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
    console.log(`- ${providerName}/${model.id}`);
    console.log(`  Name: ${model.name || ''}`);
    console.log(`  Context: ${model.contextWindow ?? ''}`);
    console.log(`  Max Tokens: ${model.maxTokens ?? ''}`);
    console.log(`  Reasoning: ${model.reasoning === true ? 'true' : model.reasoning === false ? 'false' : ''}`);
    console.log();
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
