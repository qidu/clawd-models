#!/usr/bin/env node

const { program } = require('commander');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');

const OPENCLAW_CONFIG_PATH = path.join(os.homedir(), '.openclaw', 'openclaw.json');

const CURRENT_VERSION = '2026.2.1';

program
  .name('clawd-models')
  .description('CLI tool to manage OpenClaw model configurations')
  .version('1.0.2')
  .showHelpAfterError();

// ============ Core Commands ============

program
  .command('init')
  .description('Initialize OpenClaw configuration with defaults')
  .action(() => {
    if (fs.existsSync(OPENCLAW_CONFIG_PATH)) {
      console.log(`Configuration already exists at ${OPENCLAW_CONFIG_PATH}`);
      console.log('Use "clawd-models edit" to modify or "clawd-models reset" to start fresh.');
      return;
    }

    const initialConfig = {
      meta: {
        lastTouchedVersion: CURRENT_VERSION,
        lastTouchedAt: new Date().toISOString()
      },
      wizard: {
        lastRunAt: null,
        lastRunVersion: null,
        lastRunCommand: null,
        lastRunMode: null
      },
      auth: {
        profiles: {}
      },
      models: {
        mode: 'merge',
        providers: {}
      },
      agents: {
        defaults: {
          model: { primary: null },
          models: {},
          workspace: path.join(os.homedir(), '.openclaw', 'workspace'),
          maxConcurrent: 4,
          subagents: { maxConcurrent: 8 }
        },
        list: []
      },
      messages: {
        ackReactionScope: 'group-mentions'
      },
      commands: {
        native: 'auto',
        nativeSkills: 'auto'
      },
      gateway: {
        port: 18789,
        mode: 'local',
        bind: 'lan',
        auth: {
          mode: 'token',
          token: generateToken()
        },
        tailscale: {
          mode: 'off',
          resetOnExit: false
        }
      }
    };

    saveConfig(initialConfig);
    console.log(`Initialized new configuration at ${OPENCLAW_CONFIG_PATH}`);
  });

program
  .command('view')
  .description('View current configuration')
  .action(() => {
    const config = loadConfig();
    console.log(JSON.stringify(config, null, 2));
    console.log(`\n${OPENCLAW_CONFIG_PATH}`);
  });

program
  .command('edit')
  .description('Edit configuration in default editor')
  .action(() => {
    const config = loadConfig();
    config.meta.lastTouchedVersion = CURRENT_VERSION;
    config.meta.lastTouchedAt = new Date().toISOString();
    saveConfig(config);

    const editor = process.env.EDITOR || 'vi';
    require('child_process').execSync(`${editor} "${OPENCLAW_CONFIG_PATH}"`, { stdio: 'inherit' });

    console.log(`Configuration updated at ${OPENCLAW_CONFIG_PATH}`);
  });

// ============ Provider Commands ============

program
  .command('providers:add')
  .description('Add a new model provider')
  .requiredOption('-n, --name <name>', 'Provider name (e.g., qiniu, minimax)')
  .requiredOption('-u, --base-url <url>', 'Base API URL')
  .option('-k, --api-key <key>', 'API Key for the provider endpoint')
  .option('--api <api-type>', 'API type (e.g., openai-completions, anthropic-messages)', 'openai-completions')
  .option('--auth <auth-type>', 'Auth method (e.g., api-key, bearer)', 'api-key')
  .action((options) => {
    const config = loadConfig();
    config.models.providers = config.models.providers || {};

    const provider = {
      baseUrl: options.baseUrl,
      api: options.api,
      auth: options.auth,
      models: []
    };

    if (options.apiKey) {
      provider.apiKey = options.apiKey;
    }

    config.models.providers[options.name] = provider;

    config.meta.lastTouchedAt = new Date().toISOString();
    saveConfig(config);
    console.log(`Provider "${options.name}" added. Use "clawd-models models:add" to add models.`);
  });

program
  .command('providers:remove')
  .description('Remove a model provider')
  .requiredOption('-n, --name <name>', 'Provider name')
  .action((options) => {
    const config = loadConfig();
    if (config.models.providers && config.models.providers[options.name]) {
      delete config.models.providers[options.name];
      config.meta.lastTouchedAt = new Date().toISOString();
      saveConfig(config);
      console.log(`Provider "${options.name}" removed.`);
    } else {
      console.log(`Provider "${options.name}" not found.`);
    }
  });

program
  .command('providers:list')
  .description('List all configured providers')
  .action(() => {
    const config = loadConfig();
    const providers = config.models?.providers || {};

    if (Object.keys(providers).length === 0) {
      console.log('No providers configured.');
      return;
    }

    console.log('Configured providers:');
    for (const [name, provider] of Object.entries(providers)) {
      console.log(`\n${name}:`);
      console.log(`  Base URL: ${provider.baseUrl}`);
      console.log(`  API: ${provider.api}`);
      console.log(`  Auth: ${provider.auth}`);
      console.log(`  Models: ${provider.models?.length || 0}`);
    }
  });

// ============ Model Commands ============

program
  .command('models:add')
  .description('Add a model to a provider')
  .requiredOption('-p, --provider <provider>', 'Provider name')
  .requiredOption('-i, --id <id>', 'Model ID (e.g., minimax/minimax-m2.1)')
  .requiredOption('--name <name>', 'Display name')
  .option('--api <api>', 'API type for model', 'openai-completions')
  .option('--reasoning', 'Model has reasoning capability', false)
  .option('--input <types>', 'Input types (comma-separated: text,image,audio,video)', 'text')
  .option('--input-cost <cost>', 'Input cost per 1M tokens')
  .option('--output-cost <cost>', 'Output cost per 1M tokens')
  .option('--cache-read <cost>', 'Cache read cost per 1M tokens')
  .option('--cache-write <cost>', 'Cache write cost per 1M tokens')
  .option('--context <tokens>', 'Context window size', '200000')
  .option('--max-tokens <tokens>', 'Max output tokens', '8192')
  .action((options) => {
    const config = loadConfig();

    if (!config.models.providers || !config.models.providers[options.provider]) {
      console.log(`Provider "${options.provider}" not found. Add it first with "clawd-models providers:add".`);
      return;
    }

    const provider = config.models.providers[options.provider];
    provider.models = provider.models || [];

    const model = {
      id: options.id,
      name: options.name,
      api: options.api,
      reasoning: options.reasoning,
      input: options.input.split(',').map(s => s.trim()),
      cost: {
        input: parseInt(options.inputCost) || 0,
        output: parseInt(options.outputCost) || 0,
        cacheRead: parseInt(options.cacheRead) || 0,
        cacheWrite: parseInt(options.cacheWrite) || 0
      },
      contextWindow: parseInt(options.context),
      maxTokens: parseInt(options.maxTokens)
    };

    // Check for duplicate
    if (provider.models.find(m => m.id === options.id)) {
      console.log(`Model "${options.id}" already exists in provider "${options.provider}".`);
      return;
    }

    provider.models.push(model);
    config.meta.lastTouchedAt = new Date().toISOString();
    saveConfig(config);
    console.log(`Model "${options.id}" added to provider "${options.provider}".`);
  });

program
  .command('models:remove')
  .description('Remove a model from a provider')
  .requiredOption('-p, --provider <provider>', 'Provider name')
  .requiredOption('-i, --id <id>', 'Model ID')
  .action((options) => {
    const config = loadConfig();

    if (!config.models.providers || !config.models.providers[options.provider]) {
      console.log(`Provider "${options.provider}" not found.`);
      return;
    }

    const provider = config.models.providers[options.provider];
    const idx = provider.models?.findIndex(m => m.id === options.id);

    if (idx === undefined || idx === -1) {
      console.log(`Model "${options.id}" not found in provider "${options.provider}".`);
      return;
    }

    provider.models.splice(idx, 1);
    config.meta.lastTouchedAt = new Date().toISOString();
    saveConfig(config);
    console.log(`Model "${options.id}" removed from provider "${options.provider}".`);
  });

program
  .command('models:list')
  .description('List all configured models')
  .option('--provider <provider>', 'Filter by provider')
  .action((options) => {
    const config = loadConfig();
    const providers = config.models?.providers || {};

    if (options.provider) {
      const provider = providers[options.provider];
      if (!provider) {
        console.log(`Provider "${options.provider}" not found.`);
        return;
      }
      console.log(`Models in "${options.provider}":`);
      for (const model of (provider.models || [])) {
        console.log(`  ${model.id} (${model.name})`);
      }
      return;
    }

    console.log('All configured models:');
    for (const [pname, provider] of Object.entries(providers)) {
      console.log(`\n${pname}:`);
      for (const model of (provider.models || [])) {
        console.log(`  ${model.id} (${model.name})`);
      }
    }
  });

// ============ Agent Commands ============

program
  .command('agents:add')
  .description('Add a new agent')
  .requiredOption('-i, --id <id>', 'Agent ID')
  .option('--name <name>', 'Display name')
  .option('--model <model>', 'Default model (format: provider/model-id)')
  .option('--workspace <path>', 'Workspace directory')
  .option('--agent-dir <path>', 'Agent directory')
  .action((options) => {
    const config = loadConfig();
    config.agents = config.agents || { defaults: {}, list: [] };

    const existing = config.agents.list.find(a => a.id === options.id);
    if (existing) {
      console.log(`Agent "${options.id}" already exists.`);
      return;
    }

    const agent = { id: options.id };
    if (options.name) agent.name = options.name;
    if (options.model) agent.model = options.model;
    if (options.workspace) agent.workspace = options.workspace;
    if (options.agentDir) agent.agentDir = options.agentDir;

    config.agents.list.push(agent);
    config.meta.lastTouchedAt = new Date().toISOString();
    saveConfig(config);
    console.log(`Agent "${options.id}" added.`);
  });

program
  .command('agents:remove')
  .description('Remove an agent')
  .requiredOption('-i, --id <id>', 'Agent ID')
  .action((options) => {
    const config = loadConfig();
    if (!config.agents?.list) {
      console.log('No agents configured.');
      return;
    }

    const idx = config.agents.list.findIndex(a => a.id === options.id);
    if (idx === -1) {
      console.log(`Agent "${options.id}" not found.`);
      return;
    }

    config.agents.list.splice(idx, 1);
    config.meta.lastTouchedAt = new Date().toISOString();
    saveConfig(config);
    console.log(`Agent "${options.id}" removed.`);
  });

program
  .command('agents:list')
  .description('List all configured agents')
  .action(() => {
    const config = loadConfig();
    const agents = config.agents?.list || [];
    const defaults = config.agents?.defaults || {};

    if (agents.length === 0) {
      console.log('No agents configured.');
      return;
    }

    console.log('Configured agents:');
    for (const agent of agents) {
      console.log(`\n${agent.id}:`);
      if (agent.name) console.log(`  Name: ${agent.name}`);

      if (agent.id === 'main' && defaults.model?.primary) {
        console.log(`  Model: ${defaults.model.primary}`);
      } else if (agent.model) {
        console.log(`  Model: ${agent.model}`);
      }

      if (agent.id === 'main') {
        if (defaults.workspace) console.log(`  Workspace: ${defaults.workspace}`);
        if (defaults.maxConcurrent) console.log(`  Max Concurrent: ${defaults.maxConcurrent}`);
        if (defaults.subagents?.maxConcurrent) console.log(`  Subagents Max Concurrent: ${defaults.subagents.maxConcurrent}`);
      } else {
        if (agent.workspace) console.log(`  Workspace: ${agent.workspace}`);
      }

      if (agent.agentDir) console.log(`  Agent Dir: ${agent.agentDir}`);
    }
  });

program
  .command('agents:set-default')
  .description('Set default model for an agent type')
  .requiredOption('-a, --agent <agent>', 'Agent type (e.g., main, code)')
  .requiredOption('-m, --model <model>', 'Model ID')
  .action((options) => {
    const config = loadConfig();
    config.agents = config.agents || { defaults: {}, list: [] };
    config.agents.defaults = config.agents.defaults || {};
    config.agents.defaults.model = config.agents.defaults.model || {};
    config.agents.defaults.model.primary = options.model;

    config.meta.lastTouchedAt = new Date().toISOString();
    saveConfig(config);
    console.log(`Default model for agent "${options.agent}" set to "${options.model}".`);
  });

// ============ Gateway Commands ============

program
  .command('gateway:view')
  .description('View gateway configuration')
  .action(() => {
    const config = loadConfig();
    const gw = config.gateway || {};
    console.log(`Port: ${gw.port || 18789}`);
    console.log(`Mode: ${gw.mode || 'local'}`);
    console.log(`Bind: ${gw.bind || 'lan'}`);
    console.log(`Auth Mode: ${gw.auth?.mode || 'token'}`);
    if (gw.auth?.token) {
      console.log(`Token: ${gw.auth.token.slice(0, 8)}...${gw.auth.token.slice(-4)}`);
    }
  });

program
  .command('gateway:refresh-token')
  .description('Refresh gateway auth token')
  .action(() => {
    const config = loadConfig();
    config.gateway = config.gateway || {};
    config.gateway.auth = config.gateway.auth || { mode: 'token' };
    config.gateway.auth.token = generateToken();
    config.meta.lastTouchedAt = new Date().toISOString();
    saveConfig(config);
    console.log('Gateway auth token refreshed.');
  });

// ============ Auth Profile Commands ============

program
  .command('auth:profiles')
  .description('List all auth profiles (configured and supported)')
  .action(() => {
    const config = loadConfig();
    const providers = config.models?.providers || {};
    const profiles = config.auth?.profiles || {};

    // Show configured profiles
    console.log('Configured in auth:');
    if (Object.keys(profiles).length === 0) {
      console.log('  (none)');
    } else {
      for (const [name, profile] of Object.entries(profiles)) {
        console.log(`  [configured] ${name}: provider=${profile.provider}, mode=${profile.mode}`);
      }
    }

    // Show supported profiles from providers
    console.log('\nSupported (from providers):');
    const providerNames = Object.keys(providers);
    if (providerNames.length === 0) {
      console.log('  (none)');
    } else {
      for (const [pname, provider] of Object.entries(providers)) {
        const authMode = provider.auth || 'api-key';
        const isConfigured = profiles[`${pname}:default`] ? '[default]' : '[provider]';
        console.log(`  ${isConfigured} ${pname}:default: provider=${pname}, mode=${authMode}`);
      }
    }
  });

program
  .command('auth:add-profile')
  .description('Add an auth profile')
  .requiredOption('-n, --name <name>', 'Profile name (e.g., minimax:default)')
  .requiredOption('-p, --provider <provider>', 'Auth provider')
  .requiredOption('-m, --mode <mode>', 'Auth mode (api_key, bearer)')
  .action((options) => {
    const config = loadConfig();
    config.auth = config.auth || { profiles: {} };

    config.auth.profiles[options.name] = {
      provider: options.provider,
      mode: options.mode
    };

    config.meta.lastTouchedAt = new Date().toISOString();
    saveConfig(config);
    console.log(`Auth profile "${options.name}" added.`);
  });

// ============ Import/Export ============

program
  .command('import')
  .description('Import configuration from a JSON file')
  .requiredOption('-f, --file <file>', 'Path to JSON file')
  .action((options) => {
    if (!fs.existsSync(options.file)) {
      console.error(`File not found: ${options.file}`);
      return;
    }

    const imported = fs.readFileSync(options.file, 'utf8');
    const config = JSON.parse(imported);

    config.meta = {
      lastTouchedVersion: CURRENT_VERSION,
      lastTouchedAt: new Date().toISOString()
    };

    saveConfig(config);
    console.log(`Configuration imported from ${options.file}`);
  });

program
  .command('export')
  .description('Export configuration to stdout')
  .action(() => {
    const config = loadConfig();
    console.log(JSON.stringify(config, null, 2));
  });

// ============ Helpers ============

function loadConfig() {
  try {
    if (fs.existsSync(OPENCLAW_CONFIG_PATH)) {
      const content = fs.readFileSync(OPENCLAW_CONFIG_PATH, 'utf8');
      return JSON.parse(content);
    }
    return {};
  } catch (error) {
    console.error(`Error loading configuration: ${error.message}`);
    return {};
  }
}

function saveConfig(config) {
  try {
    const dir = path.dirname(OPENCLAW_CONFIG_PATH);
    fs.ensureDirSync(dir);
    fs.writeFileSync(OPENCLAW_CONFIG_PATH, JSON.stringify(config, null, 2));
  } catch (error) {
    console.error(`Error saving configuration: ${error.message}`);
    process.exit(1);
  }
}

function generateToken() {
  const chars = 'abcdef0123456789';
  let token = '';
  for (let i = 0; i < 40; i++) {
    token += chars[Math.floor(Math.random() * chars.length)];
  }
  return token;
}

program.parse();
