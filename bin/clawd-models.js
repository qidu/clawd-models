#!/usr/bin/env node

const { program } = require('commander');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');

const OPENCLAW_CONFIG_PATH = path.join(os.homedir(), '.openclaw', 'openclaw.json');
const CLAWD_MODELS_DIR = path.join(os.homedir(), '.clawd-models');
const CLAWD_MODELS_BOT_FILE = path.join(CLAWD_MODELS_DIR, 'bot.json');

const CURRENT_VERSION = '2026.2.1';

// Supported bot configurations
const BOT_CONFIGS = [
  { id: 'openclaw', name: 'OpenClaw', path: '.openclaw/openclaw.json' },
  { id: 'clawdbot', name: 'ClawdBot', path: '.clawdbot/clawdbot.json' },
  { id: 'moltbot', name: 'MoltBot', path: '.moltbot/moltbot.json' }
];

function getBotConfigPath(botId) {
  const bot = BOT_CONFIGS.find(b => b.id === botId);
  if (!bot) return null;
  return path.join(os.homedir(), bot.path);
}

function loadPreferredBot() {
  if (fs.existsSync(CLAWD_MODELS_BOT_FILE)) {
    try {
      const content = JSON.parse(fs.readFileSync(CLAWD_MODELS_BOT_FILE, 'utf8'));
      const botId = content.bot;
      // Validate it's a known bot
      if (botId && BOT_CONFIGS.some(b => b.id === botId)) {
        return botId;
      }
    } catch (e) {
      return null;
    }
  }
  return null;
}

function savePreferredBot(botId) {
  // Validate bot ID
  if (!BOT_CONFIGS.some(b => b.id === botId)) {
    console.error(`Unknown bot: ${botId}. Valid options: ${BOT_CONFIGS.map(b => b.id).join(', ')}`);
    process.exit(1);
  }
  fs.ensureDirSync(CLAWD_MODELS_DIR);
  fs.writeFileSync(CLAWD_MODELS_BOT_FILE, JSON.stringify({ bot: botId }, null, 2));
}

function clearPreferredBot() {
  if (fs.existsSync(CLAWD_MODELS_BOT_FILE)) {
    fs.unlinkSync(CLAWD_MODELS_BOT_FILE);
  }
}

async function promptBotSelection() {
  const available = [];
  for (const bot of BOT_CONFIGS) {
    const configPath = getBotConfigPath(bot.id);
    if (fs.existsSync(configPath)) {
      available.push(bot);
    }
  }

  if (available.length === 0) {
    console.log('No bot configurations found.');
    console.log('Expected locations:');
    for (const bot of BOT_CONFIGS) {
      console.log(`  ${bot.name}: ${getBotConfigPath(bot.id)}`);
    }
    return null;
  }

  if (available.length === 1) {
    return available[0];
  }

  console.log('Multiple bot configurations found. Select one:');
  for (let i = 0; i < available.length; i++) {
    console.log(`  ${i + 1}. ${available[i].name} (${getBotConfigPath(available[i].id)})`);
  }

  const { promisify } = require('util');
  const readline = require('readline');
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const question = promisify(rl.question).bind(rl);

  while (true) {
    const answer = await question('\nEnter number (1-' + available.length + '): ');
    const idx = parseInt(answer) - 1;
    if (idx >= 0 && idx < available.length) {
      rl.close();
      return available[idx];
    }
    console.log('Invalid selection. Please try again.');
  }
}

async function resolveConfig(botOption) {
  if (botOption) {
    const bot = BOT_CONFIGS.find(b => b.id === botOption);
    if (!bot) {
      throw new Error(`Unknown bot: ${botOption}. Available: ${BOT_CONFIGS.map(b => b.id).join(', ')}`);
    }
    const configPath = getBotConfigPath(bot.id);
    if (!fs.existsSync(configPath)) {
      throw new Error(`${bot.name} config not found at ~/.${bot.name}/${bot.name}.json`);
    }
    return { bot, configPath };
  }

  // No bot specified, prompt or auto-detect
  const bot = await promptBotSelection();
  if (!bot) {
    throw new Error('No bot configurations available');
  }
  return { bot, configPath: getBotConfigPath(bot.id) };
}

function loadBotConfig(botOption) {
  const { configPath } = resolveConfigSync(botOption);
  const content = fs.readFileSync(configPath, 'utf8');
  return JSON.parse(content);
}

function resolveConfigSync(botOption) {
  // If botOption is provided, validate and use it
  if (botOption) {
    const bot = BOT_CONFIGS.find(b => b.id === botOption);
    if (!bot) {
      throw new Error(`Unknown bot: ${botOption}. Available: ${BOT_CONFIGS.map(b => b.id).join(', ')}`);
    }
    const configPath = getBotConfigPath(bot.id);
    if (!fs.existsSync(configPath)) {
      throw new Error(`${bot.name} config not found at ${configPath}`);
    }
    return { bot, configPath };
  }

  // Auto-detect: try saved preference first, then priority order
  const savedBot = loadPreferredBot();
  if (savedBot) {
    const bot = BOT_CONFIGS.find(b => b.id === savedBot);
    const configPath = getBotConfigPath(savedBot);
    if (bot && fs.existsSync(configPath)) {
      return { bot, configPath };
    }
  }

  // Try bots in priority order: openclaw -> clawdbot -> moltbot
  const priorityOrder = ['openclaw', 'clawdbot', 'moltbot'];
  for (const botId of priorityOrder) {
    const configPath = getBotConfigPath(botId);
    if (fs.existsSync(configPath)) {
      const bot = BOT_CONFIGS.find(b => b.id === botId);
      // Auto-detected and valid, save as preference
      savePreferredBot(bot.id);
      console.log(`Auto-detected bot: ${bot.id}`);
      return { bot, configPath };
    }
  }

  throw new Error('No bot configurations found');
}

async function resolveConfig(botOption) {
  return resolveConfigSync(botOption);
}

function getBotFromArgs() {
  const botIdx = process.argv.indexOf('--bot');
  if (botIdx !== -1 && botIdx + 1 < process.argv.length) {
    const botId = process.argv[botIdx + 1];
    // Validate bot ID
    const bot = BOT_CONFIGS.find(b => b.id === botId);
    if (!bot) {
      console.error(`Unknown bot: ${botId}. Valid options: ${BOT_CONFIGS.map(b => b.id).join(', ')}`);
      process.exit(1);
    }
    // Verify config file exists
    const configPath = getBotConfigPath(botId);
    if (!fs.existsSync(configPath)) {
      console.error(`${bot.name} config not found at ${configPath}`);
      process.exit(1);
    }
    // Save to bot.json
    fs.ensureDirSync(CLAWD_MODELS_DIR);
    fs.writeFileSync(CLAWD_MODELS_BOT_FILE, JSON.stringify({ bot: botId }, null, 2));
    console.log(`Default bot set to: ${botId}`);
    return botId;
  }
  return null;
}

program
  .name('clawd-models')
  .description('CLI tool to manage OpenClaw model configurations')
  .version('1.0.4')
  .showHelpAfterError()
  .option('--bot <bot-id>', 'Target bot: openclaw, clawdbot, moltbot (also sets as default)')
  .option('--clear-bot', 'Clear the default bot setting');

// Handle --clear-bot before normal command parsing
const clearBotIdx = process.argv.indexOf('--clear-bot');
if (clearBotIdx !== -1) {
  clearPreferredBot();
  console.log('Default bot cleared.');
  process.exit(0);
}

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
  .action((cmdOptions) => {
    const botOption = getBotFromArgs();
    const { bot, configPath } = resolveConfigSync(botOption);
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    console.log(JSON.stringify(config, null, 2));
    console.log(`\n${bot.name}: ${configPath}`);
  });

program
  .command('edit')
  .description('Edit configuration in default editor')
  .action(() => {
    const botOption = getBotFromArgs();
    const { bot, configPath } = resolveConfigSync(botOption);
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    config.meta.lastTouchedVersion = CURRENT_VERSION;
    config.meta.lastTouchedAt = new Date().toISOString();
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

    const editor = process.env.EDITOR || 'vi';
    require('child_process').execSync(`${editor} "${configPath}"`, { stdio: 'inherit' });

    console.log(`Configuration updated at ${bot.name}: ${configPath}`);
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
    const botOption = getBotFromArgs();
    const { bot, configPath } = resolveConfigSync(botOption);
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
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
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    console.log(`Provider "${options.name}" added to ${bot.name}.`);
  });

program
  .command('providers:remove')
  .description('Remove a model provider')
  .requiredOption('-n, --name <name>', 'Provider name')
  .action((options) => {
    const botOption = getBotFromArgs();
    const { bot, configPath } = resolveConfigSync(botOption);
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    if (config.models.providers && config.models.providers[options.name]) {
      delete config.models.providers[options.name];
      config.meta.lastTouchedAt = new Date().toISOString();
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
      console.log(`Provider "${options.name}" removed from ${bot.name}.`);
    } else {
      console.log(`Provider "${options.name}" not found.`);
    }
  });

program
  .command('providers:list')
  .description('List all configured providers')
  .action((options) => {
    const botOption = getBotFromArgs();
    const { configPath } = resolveConfigSync(botOption);
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
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
    const botOption = getBotFromArgs();
    const { bot, configPath } = resolveConfigSync(botOption);
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

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
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    console.log(`Model "${options.id}" added to provider "${options.provider}" in ${bot.name}.`);
  });

program
  .command('models:remove')
  .description('Remove a model from a provider')
  .requiredOption('-p, --provider <provider>', 'Provider name')
  .requiredOption('-i, --id <id>', 'Model ID')
  .action((options) => {
    const botOption = getBotFromArgs();
    const { bot, configPath } = resolveConfigSync(botOption);
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

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
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    console.log(`Model "${options.id}" removed from provider "${options.provider}" in ${bot.name}.`);
  });

program
  .command('models:list')
  .description('List all configured models')
  .option('--provider <provider>', 'Filter by provider')
  .action((options) => {
    const botOption = getBotFromArgs();
    const { configPath } = resolveConfigSync(botOption);
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
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

program
  .command('models:test')
  .description('Test the default model configuration by sending a test message')
  .action(async () => {
    const botOption = getBotFromArgs();
    const { bot, configPath } = await resolveConfig(botOption);
    console.log(`\nUsing ${bot.name} configuration`);

    let config;
    try {
      config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    } catch (error) {
      console.error(`Error loading configuration: ${error.message}`);
      return;
    }

    const defaultModel = config.agents?.defaults?.model?.primary;

    if (!defaultModel) {
      console.log('No default model configured. Use "clawd-models agents:set-default" to set one.');
      return;
    }

    // Parse provider/model from default model
    const [providerName, ...modelPath] = defaultModel.split('/');
    const modelId = modelPath.join('/');

    const provider = config.models?.providers?.[providerName];
    if (!provider) {
      console.log(`Provider "${providerName}" not found in configuration.`);
      return;
    }

    console.log(`Testing model: ${defaultModel}`);
    console.log(`Provider: ${providerName}`);
    console.log(`Base URL: ${provider.baseUrl}`);
    console.log(`API: ${provider.api}`);

    const apiKey = provider.apiKey;
    if (!apiKey) {
      console.log('\nWarning: No API key configured for this provider.');
    }

    // Build the endpoint URL based on API type
    let endpoint;
    if (provider.api === 'openai-completions') {
      endpoint = `${provider.baseUrl.replace(/\/$/, '')}/chat/completions`;
    } else if (provider.api === 'anthropic-messages') {
      endpoint = `${provider.baseUrl.replace(/\/$/, '')}/v1/messages`;
    } else {
      console.log(`Unsupported API type: ${provider.api}`);
      return;
    }

    console.log(`\nEndpoint: ${endpoint}`);

    // Prepare the request body
    let body;
    let headers = {};

    if (apiKey) {
      if (provider.auth === 'bearer') {
        headers['Authorization'] = `Bearer ${apiKey}`;
      } else {
        headers['Authorization'] = `Bearer ${apiKey}`;
        headers['X-API-Key'] = apiKey;
      }
    }

    if (provider.api === 'openai-completions') {
      body = JSON.stringify({
        model: modelId,
        messages: [{ role: 'user', content: 'hi, there' }],
        max_tokens: 10
      });
      headers['Content-Type'] = 'application/json';
    } else if (provider.api === 'anthropic-messages') {
      body = JSON.stringify({
        model: modelId,
        messages: [{ role: 'user', content: 'hi, there' }],
        max_tokens: 10
      });
      headers['Content-Type'] = 'application/json';
      headers['anthropic-version'] = '2023-06-01';
    }

    console.log('\n--- Request Headers ---');
    for (const [key, value] of Object.entries(headers)) {
      // Mask API key for display - hide last 32 chars
      const displayValue = key.toLowerCase().includes('api') || key.toLowerCase().includes('authorization')
        ? value.length > 32 ? value.slice(0, -32) + '********************************' : '********************************'
        : value;
      console.log(`${key}: ${displayValue}`);
    }

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body
      });

      const status = response.status;
      const contentType = response.headers.get('content-type');

      console.log('\n--- Response Headers ---');
      for (const [key, value] of response.headers.entries()) {
        console.log(`${key}: ${value}`);
      }

      let responseBody;

      if (contentType && contentType.includes('application/json')) {
        responseBody = await response.json();
      } else {
        responseBody = await response.text();
      }

      console.log(`\nStatus: ${status}`);
      console.log('Response body:');
      console.log(JSON.stringify(responseBody, null, 2));

      // Provide helpful advice on 404 errors
      if (status === 404) {
        console.log('\n--- Troubleshooting ---');
        if (provider.api === 'openai-completions') {
          console.log('For OpenAI-compatible APIs, ensure your base URL ends with /v1');
          console.log('Expected format: <schema>://<hostname>[:port]/v1');
          console.log('Example: https://api.example.com/v1');
        } else if (provider.api === 'anthropic-messages') {
          console.log('For Anthropic Messages APIs, ensure your base URL ends with /v1');
          console.log('Expected format: <schema>://<hostname>[:port]/v1');
          console.log('Example: https://api.anthropic.com/v1');
        }
      }
    } catch (error) {
      console.error(`\nRequest failed: ${error.message}`);
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
    const botOption = getBotFromArgs();
    const { bot, configPath } = resolveConfigSync(botOption);
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
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
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    console.log(`Agent "${options.id}" added to ${bot.name}.`);
  });

program
  .command('agents:remove')
  .description('Remove an agent')
  .requiredOption('-i, --id <id>', 'Agent ID')
  .action((options) => {
    const botOption = getBotFromArgs();
    const { configPath } = resolveConfigSync(botOption);
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
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
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    console.log(`Agent "${options.id}" removed.`);
  });

program
  .command('agents:list')
  .description('List all configured agents')
  .action((options) => {
    const botOption = getBotFromArgs();
    const { configPath } = resolveConfigSync(botOption);
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
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
    const botOption = getBotFromArgs();
    const { bot, configPath } = resolveConfigSync(botOption);
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    config.agents = config.agents || { defaults: {}, list: [] };
    config.agents.defaults = config.agents.defaults || {};
    config.agents.defaults.model = config.agents.defaults.model || {};
    config.agents.defaults.model.primary = options.model;

    config.meta.lastTouchedAt = new Date().toISOString();
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    console.log(`Default model for agent "${options.agent}" set to "${options.model}" in ${bot.name}.`);
  });

// ============ Gateway Commands ============

program
  .command('gateway:view')
  .description('View gateway configuration')
  .action((options) => {
    const botOption = getBotFromArgs();
    const { configPath } = resolveConfigSync(botOption);
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
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
  .action((options) => {
    const botOption = getBotFromArgs();
    const { bot, configPath } = resolveConfigSync(botOption);
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    config.gateway = config.gateway || {};
    config.gateway.auth = config.gateway.auth || { mode: 'token' };
    config.gateway.auth.token = generateToken();
    config.meta.lastTouchedAt = new Date().toISOString();
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    console.log('Gateway auth token refreshed.');
  });

// ============ Auth Profile Commands ============

program
  .command('auth:profiles')
  .description('List all auth profiles (configured and supported)')
  .action((options) => {
    const botOption = getBotFromArgs();
    const { configPath } = resolveConfigSync(botOption);
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
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
    const botOption = getBotFromArgs();
    const { bot, configPath } = resolveConfigSync(botOption);
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    config.auth = config.auth || { profiles: {} };

    config.auth.profiles[options.name] = {
      provider: options.provider,
      mode: options.mode
    };

    config.meta.lastTouchedAt = new Date().toISOString();
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    console.log(`Auth profile "${options.name}" added to ${bot.name}.`);
  });

// ============ Import/Export ============

program
  .command('import')
  .description('Import configuration from a JSON file')
  .requiredOption('-f, --file <file>', 'Path to JSON file')
  .action((options) => {
    const botOption = getBotFromArgs();
    const { bot, configPath } = resolveConfigSync(botOption);
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

    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    console.log(`Configuration imported from ${options.file} to ${bot.name}.`);
  });

program
  .command('export')
  .description('Export configuration to stdout')
  .action((options) => {
    const botOption = getBotFromArgs();
    const { configPath } = resolveConfigSync(botOption);
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    console.log(JSON.stringify(config, null, 2));
  });

// ============ Helpers ============

function generateToken() {
  const chars = 'abcdef0123456789';
  let token = '';
  for (let i = 0; i < 40; i++) {
    token += chars[Math.floor(Math.random() * chars.length)];
  }
  return token;
}

program.parse();
