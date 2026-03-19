#!/usr/bin/env node

// Main entry point for clawd-models TUI
// This replaces the old CLI with a new Text User Interface

const TUIController = require('../src/tui/index');
const { ConfigManager, ProviderManager, ModelManager, AgentManager, ApiTester } = require('../src/core');

async function runTest() {
  const configManager = new ConfigManager();
  const providerManager = new ProviderManager(configManager);
  const modelManager = new ModelManager(configManager);
  const agentManager = new AgentManager(configManager, modelManager);
  const apiTester = new ApiTester(configManager, providerManager, modelManager);

  const defaultModel = agentManager.getDefaultModel();

  if (!defaultModel) {
    console.error('Error: No default model configured.');
    console.log('Run "clawd-models" in interactive mode to configure a default model.');
    process.exit(1);
  }

  console.log(`Testing default model: ${defaultModel}\n`);

  try {
    const result = await apiTester.testModel(defaultModel);

    if (result.success) {
      console.log('✅ Test Successful!');
      console.log(`Model: ${result.modelId}`);
      console.log(`Provider: ${result.provider}`);
      console.log(`Endpoint: ${result.endpoint}`);
      console.log(`Status: ${result.response.status}`);

      if (result.response.body) {
        console.log('\n📝 Response:');
        console.log(JSON.stringify(result.response.body, null, 2));
      }
      process.exit(0);
    } else {
      console.log('❌ Test Failed!');
      console.log(`Error: ${result.error}`);
      if (result.response?.status === 404) {
        const advice = apiTester.getTroubleshootingAdvice(result);
        if (advice) {
          console.log(advice);
        }
      }
      process.exit(1);
    }
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

async function runListProviders() {
  const configManager = new ConfigManager();
  const providerManager = new ProviderManager(configManager);
  const providers = providerManager.listProviders();

  if (providers.length === 0) {
    console.log('No providers configured.');
    return;
  }

  console.log('Configured Providers:\n');
  providers.forEach(p => {
    console.log(`- ${p.name}`);
    console.log(`  Base URL: ${p.baseUrl}`);
    console.log(`  API: ${p.api}`);
    console.log(`  Auth: ${p.auth}`);
    console.log(`  Models: ${p.models?.length || 0}`);
    console.log();
  });
}

async function runListModels() {
  const configManager = new ConfigManager();
  const modelManager = new ModelManager(configManager);
  const models = modelManager.listModels();

  if (models.length === 0) {
    console.log('No models configured.');
    return;
  }

  console.log('Configured Models:\n');
  models.forEach(m => {
    console.log(`- ${m.provider}/${m.id}`);
    console.log(`  Name: ${m.name}`);
    console.log(`  Context: ${m.contextWindow?.toLocaleString()} tokens`);
    console.log();
  });
}

async function runViewConfig() {
  const configManager = new ConfigManager();
  const config = configManager.loadConfig();
  console.log(JSON.stringify(config, null, 2));
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  // If no arguments, run TUI
  if (!command) {
    try {
      const tui = new TUIController();
      await tui.run();
    } catch (error) {
      console.error('Fatal error:', error.message);
      process.exit(1);
    }
    return;
  }

  // Handle CLI commands
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
      console.log(`
clawd-models - OpenClaw Model Configuration Tool

Usage:
  clawd-models              # Run interactive TUI
  clawd-models --test       # Test default model API connection
  clawd-models --list-providers   # List configured providers
  clawd-models --list-models      # List configured models
  clawd-models --view-config      # View full configuration

Options:
  -t, --test           Test API connection
  -p, --list-providers List providers
  -m, --list-models   List models
  -v, --view-config   View configuration
  -h, --help          Show this help

Note: Interactive TUI requires a real terminal.
`);
      break;

    default:
      console.error(`Unknown command: ${command}`);
      console.log('Run "clawd-models --help" for usage information.');
      process.exit(1);
  }
}

// Handle Ctrl+C gracefully
process.on('SIGINT', () => {
  console.log('\n\nExiting clawd-models...');
  process.exit(0);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Run the CLI
main();
