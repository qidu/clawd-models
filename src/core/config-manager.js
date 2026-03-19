const fs = require('fs-extra');
const path = require('path');
const os = require('os');

const OPENCLAW_CONFIG_PATH = path.join(os.homedir(), '.openclaw', 'openclaw.json');
const CURRENT_VERSION = '2026.2.10';

class ConfigManager {
  constructor() {
    this.configPath = OPENCLAW_CONFIG_PATH;
  }

  /**
   * Load configuration from file
   * @returns {Object} The configuration object
   */
  loadConfig() {
    try {
      if (!fs.existsSync(this.configPath)) {
        return this.createDefaultConfig();
      }

      const content = fs.readFileSync(this.configPath, 'utf8');
      const config = JSON.parse(content);

      // Ensure structure exists
      config.meta = config.meta || {};
      config.meta.lastTouchedVersion = CURRENT_VERSION;
      config.meta.lastTouchedAt = new Date().toISOString();

      config.models = config.models || { mode: 'merge', providers: {} };
      config.agents = config.agents || { defaults: {}, list: [] };
      config.auth = config.auth || { profiles: {} };
      config.gateway = config.gateway || this.getDefaultGatewayConfig();

      return config;
    } catch (error) {
      console.error(`Error loading configuration: ${error.message}`);
      throw error;
    }
  }

  /**
   * Save configuration to file
   * @param {Object} config - Configuration object to save
   */
  saveConfig(config) {
    try {
      // Update metadata
      config.meta = config.meta || {};
      config.meta.lastTouchedVersion = CURRENT_VERSION;
      config.meta.lastTouchedAt = new Date().toISOString();

      // Ensure directory exists
      fs.ensureDirSync(path.dirname(this.configPath));

      // Write to file
      fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2));
      return true;
    } catch (error) {
      console.error(`Error saving configuration: ${error.message}`);
      throw error;
    }
  }

  /**
   * Create default configuration
   * @returns {Object} Default configuration object
   */
  createDefaultConfig() {
    return {
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
      gateway: this.getDefaultGatewayConfig()
    };
  }

  /**
   * Get default gateway configuration
   * @returns {Object} Default gateway config
   */
  getDefaultGatewayConfig() {
    return {
      port: 18789,
      mode: 'local',
      bind: 'lan',
      auth: {
        mode: 'token',
        token: this.generateToken()
      },
      tailscale: {
        mode: 'off',
        resetOnExit: false
      }
    };
  }

  /**
   * Generate a random token
   * @returns {string} Generated token
   */
  generateToken() {
    const chars = 'abcdef0123456789';
    let token = '';
    for (let i = 0; i < 40; i++) {
      token += chars[Math.floor(Math.random() * chars.length)];
    }
    return token;
  }

  /**
   * Get configuration file path
   * @returns {string} Path to config file
   */
  getConfigPath() {
    return this.configPath;
  }

  /**
   * Check if configuration exists
   * @returns {boolean} True if config file exists
   */
  configExists() {
    return fs.existsSync(this.configPath);
  }

  /**
   * Get all providers from configuration
   * @param {Object} config - Configuration object
   * @returns {Object} Providers object
   */
  getProviders(config) {
    return config.models?.providers || {};
  }

  /**
   * Get provider by name
   * @param {Object} config - Configuration object
   * @param {string} providerName - Provider name
   * @returns {Object|null} Provider object or null if not found
   */
  getProvider(config, providerName) {
    return config.models?.providers?.[providerName] || null;
  }

  /**
   * Add or update a provider
   * @param {Object} config - Configuration object
   * @param {string} name - Provider name
   * @param {Object} providerData - Provider data
   * @returns {Object} Updated configuration
   */
  setProvider(config, name, providerData) {
    config.models = config.models || { mode: 'merge', providers: {} };
    config.models.providers[name] = providerData;
    return config;
  }

  /**
   * Remove a provider
   * @param {Object} config - Configuration object
   * @param {string} name - Provider name
   * @returns {Object} Updated configuration
   */
  removeProvider(config, name) {
    if (config.models?.providers?.[name]) {
      delete config.models.providers[name];
    }
    return config;
  }

  /**
   * Get all models for a provider
   * @param {Object} config - Configuration object
   * @param {string} providerName - Provider name
   * @returns {Array} Array of models
   */
  getModels(config, providerName) {
    const provider = this.getProvider(config, providerName);
    return provider?.models || [];
  }

  /**
   * Get model by ID
   * @param {Object} config - Configuration object
   * @param {string} providerName - Provider name
   * @param {string} modelId - Model ID
   * @returns {Object|null} Model object or null if not found
   */
  getModel(config, providerName, modelId) {
    const models = this.getModels(config, providerName);
    return models.find(model => model.id === modelId) || null;
  }

  /**
   * Add or update a model
   * @param {Object} config - Configuration object
   * @param {string} providerName - Provider name
   * @param {Object} modelData - Model data
   * @returns {Object} Updated configuration
   */
  setModel(config, providerName, modelData) {
    const provider = this.getProvider(config, providerName);
    if (!provider) {
      throw new Error(`Provider "${providerName}" not found`);
    }

    provider.models = provider.models || [];
    const existingIndex = provider.models.findIndex(m => m.id === modelData.id);

    if (existingIndex >= 0) {
      // Update existing model
      provider.models[existingIndex] = { ...provider.models[existingIndex], ...modelData };
    } else {
      // Add new model
      provider.models.push(modelData);
    }

    return config;
  }

  /**
   * Remove a model
   * @param {Object} config - Configuration object
   * @param {string} providerName - Provider name
   * @param {string} modelId - Model ID
   * @returns {Object} Updated configuration
   */
  removeModel(config, providerName, modelId) {
    const provider = this.getProvider(config, providerName);
    if (!provider || !provider.models) {
      return config;
    }

    const index = provider.models.findIndex(m => m.id === modelId);
    if (index >= 0) {
      provider.models.splice(index, 1);
    }

    return config;
  }

  /**
   * Get agent defaults
   * @param {Object} config - Configuration object
   * @returns {Object} Agent defaults
   */
  getAgentDefaults(config) {
    return config.agents?.defaults || {};
  }

  /**
   * Set agent default model
   * @param {Object} config - Configuration object
   * @param {string} modelId - Model ID (format: provider/model-id)
   * @returns {Object} Updated configuration
   */
  setAgentDefaultModel(config, modelId) {
    config.agents = config.agents || { defaults: {}, list: [] };
    config.agents.defaults = config.agents.defaults || {};
    config.agents.defaults.model = config.agents.defaults.model || {};
    config.agents.defaults.model.primary = modelId;
    return config;
  }

  /**
   * Get agent default model
   * @param {Object} config - Configuration object
   * @returns {string|null} Default model ID or null
   */
  getAgentDefaultModel(config) {
    return config.agents?.defaults?.model?.primary || null;
  }

  /**
   * Get all agents
   * @param {Object} config - Configuration object
   * @returns {Array} Array of agents
   */
  getAgents(config) {
    return config.agents?.list || [];
  }

  /**
   * Get agent by ID
   * @param {Object} config - Configuration object
   * @param {string} agentId - Agent ID
   * @returns {Object|null} Agent object or null if not found
   */
  getAgent(config, agentId) {
    const agents = this.getAgents(config);
    return agents.find(agent => agent.id === agentId) || null;
  }

  /**
   * Add or update an agent
   * @param {Object} config - Configuration object
   * @param {Object} agentData - Agent data
   * @returns {Object} Updated configuration
   */
  setAgent(config, agentData) {
    config.agents = config.agents || { defaults: {}, list: [] };
    const agents = config.agents.list;
    const existingIndex = agents.findIndex(a => a.id === agentData.id);

    if (existingIndex >= 0) {
      // Update existing agent
      agents[existingIndex] = { ...agents[existingIndex], ...agentData };
    } else {
      // Add new agent
      agents.push(agentData);
    }

    return config;
  }

  /**
   * Remove an agent
   * @param {Object} config - Configuration object
   * @param {string} agentId - Agent ID
   * @returns {Object} Updated configuration
   */
  removeAgent(config, agentId) {
    const agents = config.agents?.list || [];
    const index = agents.findIndex(a => a.id === agentId);

    if (index >= 0) {
      agents.splice(index, 1);
    }

    return config;
  }

  /**
   * Get gateway configuration
   * @param {Object} config - Configuration object
   * @returns {Object} Gateway configuration
   */
  getGatewayConfig(config) {
    return config.gateway || this.getDefaultGatewayConfig();
  }

  /**
   * Refresh gateway token
   * @param {Object} config - Configuration object
   * @returns {Object} Updated configuration
   */
  refreshGatewayToken(config) {
    config.gateway = config.gateway || this.getDefaultGatewayConfig();
    config.gateway.auth = config.gateway.auth || { mode: 'token' };
    config.gateway.auth.token = this.generateToken();
    return config;
  }

  /**
   * Get auth profiles
   * @param {Object} config - Configuration object
   * @returns {Object} Auth profiles
   */
  getAuthProfiles(config) {
    return config.auth?.profiles || {};
  }

  /**
   * Add or update auth profile
   * @param {Object} config - Configuration object
   * @param {string} name - Profile name
   * @param {Object} profileData - Profile data
   * @returns {Object} Updated configuration
   */
  setAuthProfile(config, name, profileData) {
    config.auth = config.auth || { profiles: {} };
    config.auth.profiles[name] = profileData;
    return config;
  }

  /**
   * Remove auth profile
   * @param {Object} config - Configuration object
   * @param {string} name - Profile name
   * @returns {Object} Updated configuration
   */
  removeAuthProfile(config, name) {
    if (config.auth?.profiles?.[name]) {
      delete config.auth.profiles[name];
    }
    return config;
  }
}

module.exports = ConfigManager;