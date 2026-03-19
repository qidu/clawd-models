class AgentManager {
  constructor(configManager, modelManager) {
    this.configManager = configManager;
    this.modelManager = modelManager;
  }

  /**
   * Validate model ID format and existence
   * @param {string} modelId - Model ID (format: provider/model-id)
   * @returns {boolean} True if valid
   */
  validateModelId(modelId) {
    if (!modelId) {
      throw new Error('Model ID is required');
    }

    // Parse provider and model ID
    const [providerName, ...modelPath] = modelId.split('/');
    const modelName = modelPath.join('/');

    if (!providerName || !modelName) {
      throw new Error('Model ID must be in format: provider/model-id');
    }

    // Check if model exists
    const config = this.configManager.loadConfig();
    const model = this.configManager.getModel(config, providerName, modelName);

    if (!model) {
      throw new Error(`Model "${modelId}" not found`);
    }

    return true;
  }

  /**
   * Validate agent ID
   * @param {string} agentId - Agent ID
   * @param {boolean} checkDuplicate - Check for duplicates
   * @returns {boolean} True if valid
   */
  validateAgentId(agentId, checkDuplicate = false) {
    if (!agentId || agentId.trim().length === 0) {
      throw new Error('Agent ID is required');
    }

    // Check for duplicates
    if (checkDuplicate) {
      const config = this.configManager.loadConfig();
      const existingAgent = this.configManager.getAgent(config, agentId);
      if (existingAgent) {
        throw new Error(`Agent "${agentId}" already exists`);
      }
    }

    return true;
  }

  /**
   * Set default model for agent
   * @param {string} modelId - Model ID (format: provider/model-id)
   * @returns {boolean} True if successful
   */
  setDefaultModel(modelId) {
    this.validateModelId(modelId);

    const config = this.configManager.loadConfig();
    const updatedConfig = this.configManager.setAgentDefaultModel(config, modelId);
    this.configManager.saveConfig(updatedConfig);

    return true;
  }

  /**
   * Get default model
   * @returns {string|null} Default model ID or null
   */
  getDefaultModel() {
    const config = this.configManager.loadConfig();
    return this.configManager.getAgentDefaultModel(config);
  }

  /**
   * Get default model details
   * @returns {Object|null} Default model details or null
   */
  getDefaultModelDetails() {
    const defaultModelId = this.getDefaultModel();
    if (!defaultModelId) {
      return null;
    }

    // Parse provider and model ID
    const [providerName, ...modelPath] = defaultModelId.split('/');
    const modelName = modelPath.join('/');

    try {
      const modelDetails = this.modelManager.getModelDetails(providerName, modelName);
      return {
        ...modelDetails,
        fullId: defaultModelId
      };
    } catch (error) {
      // Model might have been deleted
      return null;
    }
  }

  /**
   * Add an agent
   * @param {Object} data - Agent data
   * @returns {boolean} True if successful
   */
  addAgent(data) {
    this.validateAgentId(data.id, true);

    // Validate model if provided
    if (data.model) {
      this.validateModelId(data.model);
    }

    const config = this.configManager.loadConfig();
    const updatedConfig = this.configManager.setAgent(config, data);
    this.configManager.saveConfig(updatedConfig);

    return true;
  }

  /**
   * Update an agent
   * @param {string} agentId - Agent ID
   * @param {Object} data - Agent data
   * @returns {boolean} True if successful
   */
  updateAgent(agentId, data) {
    const config = this.configManager.loadConfig();
    const existingAgent = this.configManager.getAgent(config, agentId);

    if (!existingAgent) {
      throw new Error(`Agent "${agentId}" not found`);
    }

    // Validate model if provided
    if (data.model) {
      this.validateModelId(data.model);
    }

    // Merge with existing agent
    const updatedAgent = {
      ...existingAgent,
      ...data
    };

    const updatedConfig = this.configManager.setAgent(config, updatedAgent);
    this.configManager.saveConfig(updatedConfig);

    return true;
  }

  /**
   * Remove an agent
   * @param {string} agentId - Agent ID
   * @returns {boolean} True if successful
   */
  removeAgent(agentId) {
    const config = this.configManager.loadConfig();
    const agent = this.configManager.getAgent(config, agentId);

    if (!agent) {
      throw new Error(`Agent "${agentId}" not found`);
    }

    // Prevent removal of main agent
    if (agentId === 'main') {
      throw new Error('Cannot remove the main agent');
    }

    const updatedConfig = this.configManager.removeAgent(config, agentId);
    this.configManager.saveConfig(updatedConfig);

    return true;
  }

  /**
   * List all agents
   * @returns {Array} Array of agents with details
   */
  listAgents() {
    const config = this.configManager.loadConfig();
    const agents = this.configManager.getAgents(config);
    const defaults = this.configManager.getAgentDefaults(config);

    const result = [];
    for (const agent of agents) {
      const agentData = { ...agent };

      // For main agent, use defaults
      if (agent.id === 'main') {
        agentData.model = defaults.model?.primary || null;
        agentData.workspace = defaults.workspace || null;
        agentData.maxConcurrent = defaults.maxConcurrent || null;
        agentData.subagents = defaults.subagents || null;
      }

      result.push(agentData);
    }

    return result;
  }

  /**
   * Get agent details
   * @param {string} agentId - Agent ID
   * @returns {Object} Agent details
   */
  getAgentDetails(agentId) {
    const config = this.configManager.loadConfig();
    const agent = this.configManager.getAgent(config, agentId);

    if (!agent) {
      throw new Error(`Agent "${agentId}" not found`);
    }

    const defaults = this.configManager.getAgentDefaults(config);
    const agentData = { ...agent };

    // For main agent, use defaults
    if (agentId === 'main') {
      agentData.model = defaults.model?.primary || null;
      agentData.workspace = defaults.workspace || null;
      agentData.maxConcurrent = defaults.maxConcurrent || null;
      agentData.subagents = defaults.subagents || null;
    }

    // Get model details if model is set
    if (agentData.model) {
      try {
        const [providerName, ...modelPath] = agentData.model.split('/');
        const modelName = modelPath.join('/');
        const modelDetails = this.modelManager.getModelDetails(providerName, modelName);
        agentData.modelDetails = modelDetails;
      } catch (error) {
        // Model might have been deleted
        agentData.modelDetails = null;
      }
    }

    return agentData;
  }

  /**
   * Set agent workspace
   * @param {string} agentId - Agent ID
   * @param {string} workspacePath - Workspace path
   * @returns {boolean} True if successful
   */
  setAgentWorkspace(agentId, workspacePath) {
    const config = this.configManager.loadConfig();

    if (agentId === 'main') {
      // For main agent, update defaults
      config.agents.defaults.workspace = workspacePath;
    } else {
      // For other agents, update agent-specific workspace
      const agent = this.configManager.getAgent(config, agentId);
      if (!agent) {
        throw new Error(`Agent "${agentId}" not found`);
      }

      const updatedAgent = { ...agent, workspace: workspacePath };
      this.configManager.setAgent(config, updatedAgent);
    }

    this.configManager.saveConfig(config);
    return true;
  }

  /**
   * Set agent concurrency limits
   * @param {string} agentId - Agent ID
   * @param {number} maxConcurrent - Max concurrent tasks
   * @param {number} subagentsConcurrent - Max concurrent subagents
   * @returns {boolean} True if successful
   */
  setAgentConcurrency(agentId, maxConcurrent, subagentsConcurrent = null) {
    const config = this.configManager.loadConfig();

    if (agentId === 'main') {
      // For main agent, update defaults
      config.agents.defaults.maxConcurrent = maxConcurrent;
      if (subagentsConcurrent !== null) {
        config.agents.defaults.subagents = config.agents.defaults.subagents || {};
        config.agents.defaults.subagents.maxConcurrent = subagentsConcurrent;
      }
    } else {
      // For other agents, these settings don't apply
      throw new Error('Concurrency settings only apply to main agent');
    }

    this.configManager.saveConfig(config);
    return true;
  }

  /**
   * Get available models for agent selection
   * @returns {Array} Available models for selection
   */
  getAvailableModels() {
    return this.modelManager.getModelsForSelection();
  }

  /**
   * Validate fallback models
   * @param {Array} fallbackModels - Array of fallback model IDs
   * @param {string} primaryModel - Primary model ID
   * @returns {boolean} True if valid
   */
  validateFallbackModels(fallbackModels, primaryModel) {
    if (!Array.isArray(fallbackModels)) {
      throw new Error('Fallback models must be an array');
    }

    // Check for duplicates
    const seen = new Set();
    for (const modelId of fallbackModels) {
      if (seen.has(modelId)) {
        throw new Error(`Duplicate fallback model: ${modelId}`);
      }
      seen.add(modelId);

      // Validate each model
      this.validateModelId(modelId);

      // Check that fallback is not the same as primary
      if (modelId === primaryModel) {
        throw new Error('Fallback model cannot be the same as primary model');
      }
    }

    return true;
  }

  /**
   * Set fallback models
   * @param {Array} fallbackModels - Array of fallback model IDs
   * @returns {boolean} True if successful
   */
  setFallbackModels(fallbackModels) {
    const primaryModel = this.getDefaultModel();
    if (!primaryModel) {
      throw new Error('Set primary model first');
    }

    this.validateFallbackModels(fallbackModels, primaryModel);

    const config = this.configManager.loadConfig();

    // Store fallback models in a separate field
    config.agents.defaults.fallbacks = fallbackModels;

    this.configManager.saveConfig(config);
    return true;
  }

  /**
   * Get fallback models
   * @returns {Array} Array of fallback model IDs
   */
  getFallbackModels() {
    const config = this.configManager.loadConfig();
    return config.agents?.defaults?.fallbacks || [];
  }

  /**
   * Get fallback models with details
   * @returns {Array} Array of fallback model details
   */
  getFallbackModelsDetails() {
    const fallbackModels = this.getFallbackModels();
    const result = [];

    for (const modelId of fallbackModels) {
      try {
        const [providerName, ...modelPath] = modelId.split('/');
        const modelName = modelPath.join('/');
        const modelDetails = this.modelManager.getModelDetails(providerName, modelName);
        result.push({
          id: modelId,
          details: modelDetails
        });
      } catch (error) {
        // Model might have been deleted
        result.push({
          id: modelId,
          details: null,
          error: 'Model not found'
        });
      }
    }

    return result;
  }
}

module.exports = AgentManager;