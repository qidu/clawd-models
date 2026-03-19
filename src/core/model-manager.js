class ModelManager {
  constructor(configManager) {
    this.configManager = configManager;
  }

  /**
   * Validate provider exists
   * @param {string} providerName - Provider name
   * @returns {boolean} True if valid
   */
  validateProviderExists(providerName) {
    const config = this.configManager.loadConfig();
    const provider = this.configManager.getProvider(config, providerName);

    if (!provider) {
      throw new Error(`Provider "${providerName}" not found`);
    }

    return true;
  }

  /**
   * Validate model ID
   * @param {string} providerName - Provider name
   * @param {string} modelId - Model ID
   * @param {boolean} isUpdate - Whether this is an update operation
   * @returns {boolean} True if valid
   */
  validateModelId(providerName, modelId, isUpdate = false) {
    if (!modelId || modelId.trim().length === 0) {
      throw new Error('Model ID is required');
    }

    // Check for duplicates (only for new models)
    if (!isUpdate) {
      const config = this.configManager.loadConfig();
      const existingModel = this.configManager.getModel(config, providerName, modelId);
      if (existingModel) {
        throw new Error(`Model "${modelId}" already exists in provider "${providerName}"`);
      }
    }

    return true;
  }

  /**
   * Validate display name
   * @param {string} name - Display name
   * @returns {boolean} True if valid
   */
  validateDisplayName(name) {
    if (!name || name.trim().length === 0) {
      throw new Error('Display name is required');
    }
    return true;
  }

  /**
   * Validate API type
   * @param {string} apiType - API type
   * @returns {boolean} True if valid
   */
  validateApiType(apiType) {
    const validTypes = ['openai-completions', 'anthropic-messages'];
    if (!validTypes.includes(apiType)) {
      throw new Error(`API type must be one of: ${validTypes.join(', ')}`);
    }
    return true;
  }

  /**
   * Validate input types
   * @param {Array|string} inputTypes - Input types
   * @returns {Array} Validated input types array
   */
  validateInputTypes(inputTypes) {
    const validTypes = ['text', 'image', 'audio', 'video'];

    let typesArray;
    if (Array.isArray(inputTypes)) {
      typesArray = inputTypes;
    } else if (typeof inputTypes === 'string') {
      typesArray = inputTypes.split(',').map(s => s.trim());
    } else {
      throw new Error('Input types must be an array or comma-separated string');
    }

    // Validate each type
    for (const type of typesArray) {
      if (!validTypes.includes(type)) {
        throw new Error(`Invalid input type: "${type}". Valid types: ${validTypes.join(', ')}`);
      }
    }

    // Ensure at least text is included
    if (!typesArray.includes('text')) {
      typesArray.push('text');
    }

    return typesArray;
  }

  /**
   * Validate cost value
   * @param {number|string} cost - Cost value
   * @param {string} fieldName - Field name for error messages
   * @returns {number} Validated cost
   */
  validateCost(cost, fieldName = 'cost') {
    if (cost === undefined || cost === null || cost === '') {
      return 0;
    }

    const num = parseFloat(cost);
    if (isNaN(num)) {
      throw new Error(`${fieldName} must be a valid number`);
    }

    if (num < 0) {
      throw new Error(`${fieldName} cannot be negative`);
    }

    return num;
  }

  /**
   * Validate context window
   * @param {number|string} contextWindow - Context window size
   * @returns {number} Validated context window
   */
  validateContextWindow(contextWindow) {
    if (!contextWindow) {
      return 200000; // Default
    }

    const num = parseInt(contextWindow);
    if (isNaN(num)) {
      throw new Error('Context window must be a valid number');
    }

    if (num < 1) {
      throw new Error('Context window must be at least 1');
    }

    return num;
  }

  /**
   * Validate max tokens
   * @param {number|string} maxTokens - Max tokens
   * @returns {number} Validated max tokens
   */
  validateMaxTokens(maxTokens) {
    if (!maxTokens) {
      return 8192; // Default
    }

    const num = parseInt(maxTokens);
    if (isNaN(num)) {
      throw new Error('Max tokens must be a valid number');
    }

    if (num < 1) {
      throw new Error('Max tokens must be at least 1');
    }

    return num;
  }

  /**
   * Create model object
   * @param {string} providerName - Provider name
   * @param {Object} data - Model data
   * @returns {Object} Model object
   */
  createModel(providerName, data) {
    this.validateProviderExists(providerName);
    this.validateModelId(providerName, data.id);
    this.validateDisplayName(data.name);
    this.validateApiType(data.api);

    const inputTypes = this.validateInputTypes(data.input || 'text');

    const model = {
      id: data.id,
      name: data.name,
      api: data.api,
      reasoning: !!data.reasoning,
      input: inputTypes,
      cost: {
        input: this.validateCost(data.inputCost, 'input cost'),
        output: this.validateCost(data.outputCost, 'output cost'),
        cacheRead: this.validateCost(data.cacheRead, 'cache read cost'),
        cacheWrite: this.validateCost(data.cacheWrite, 'cache write cost')
      },
      contextWindow: this.validateContextWindow(data.contextWindow),
      maxTokens: this.validateMaxTokens(data.maxTokens)
    };

    return model;
  }

  /**
   * Add a model
   * @param {string} providerName - Provider name
   * @param {Object} data - Model data
   * @returns {boolean} True if successful
   */
  addModel(providerName, data) {
    const model = this.createModel(providerName, data);
    const config = this.configManager.loadConfig();

    const updatedConfig = this.configManager.setModel(config, providerName, model);
    this.configManager.saveConfig(updatedConfig);

    return true;
  }

  /**
   * Update a model
   * @param {string} providerName - Provider name
   * @param {string} modelId - Model ID
   * @param {Object} data - Model data
   * @returns {boolean} True if successful
   */
  updateModel(providerName, modelId, data) {
    const config = this.configManager.loadConfig();
    const existingModel = this.configManager.getModel(config, providerName, modelId);

    if (!existingModel) {
      throw new Error(`Model "${modelId}" not found in provider "${providerName}"`);
    }

    // Validate provider exists
    this.validateProviderExists(providerName);

    // Validate display name if provided
    if (data.name !== undefined) {
      this.validateDisplayName(data.name);
    }

    // Validate API type if provided
    if (data.api !== undefined) {
      this.validateApiType(data.api);
    }

    // Validate input types if provided
    let inputTypes = existingModel.input;
    if (data.input !== undefined) {
      inputTypes = this.validateInputTypes(data.input);
    }

    // Merge with existing model
    const updatedModel = {
      ...existingModel,
      ...data,
      input: inputTypes,
      reasoning: data.reasoning !== undefined ? !!data.reasoning : existingModel.reasoning
    };

    // Validate costs if provided
    if (data.inputCost !== undefined) {
      updatedModel.cost.input = this.validateCost(data.inputCost, 'input cost');
    }
    if (data.outputCost !== undefined) {
      updatedModel.cost.output = this.validateCost(data.outputCost, 'output cost');
    }
    if (data.cacheRead !== undefined) {
      updatedModel.cost.cacheRead = this.validateCost(data.cacheRead, 'cache read cost');
    }
    if (data.cacheWrite !== undefined) {
      updatedModel.cost.cacheWrite = this.validateCost(data.cacheWrite, 'cache write cost');
    }

    // Validate context window if provided
    if (data.contextWindow !== undefined) {
      updatedModel.contextWindow = this.validateContextWindow(data.contextWindow);
    }

    // Validate max tokens if provided
    if (data.maxTokens !== undefined) {
      updatedModel.maxTokens = this.validateMaxTokens(data.maxTokens);
    }

    // If model ID is changing, check for duplicates
    if (data.id && data.id !== modelId) {
      this.validateModelId(providerName, data.id);
      updatedModel.id = data.id;
    }

    const updatedConfig = this.configManager.setModel(config, providerName, updatedModel);
    this.configManager.saveConfig(updatedConfig);

    return true;
  }

  /**
   * Remove a model
   * @param {string} providerName - Provider name
   * @param {string} modelId - Model ID
   * @returns {boolean} True if successful
   */
  removeModel(providerName, modelId) {
    const config = this.configManager.loadConfig();
    const model = this.configManager.getModel(config, providerName, modelId);

    if (!model) {
      throw new Error(`Model "${modelId}" not found in provider "${providerName}"`);
    }

    const updatedConfig = this.configManager.removeModel(config, providerName, modelId);
    this.configManager.saveConfig(updatedConfig);

    return true;
  }

  /**
   * List all models
   * @param {string} [providerName] - Optional provider filter
   * @returns {Array} Array of models with details
   */
  listModels(providerName = null) {
    const config = this.configManager.loadConfig();

    if (providerName) {
      this.validateProviderExists(providerName);
      const models = this.configManager.getModels(config, providerName);
      return models.map(model => ({
        ...model,
        provider: providerName,
        fullId: `${providerName}/${model.id}`
      }));
    }

    // List all models from all providers
    const providers = this.configManager.getProviders(config);
    const allModels = [];

    for (const [pname, provider] of Object.entries(providers)) {
      const models = provider.models || [];
      for (const model of models) {
        allModels.push({
          ...model,
          provider: pname,
          fullId: `${pname}/${model.id}`
        });
      }
    }

    return allModels;
  }

  /**
   * Get model details
   * @param {string} providerName - Provider name
   * @param {string} modelId - Model ID
   * @returns {Object} Model details
   */
  getModelDetails(providerName, modelId) {
    const config = this.configManager.loadConfig();
    const model = this.configManager.getModel(config, providerName, modelId);

    if (!model) {
      throw new Error(`Model "${modelId}" not found in provider "${providerName}"`);
    }

    return {
      ...model,
      provider: providerName,
      fullId: `${providerName}/${model.id}`
    };
  }

  /**
   * Get all models grouped by provider
   * @returns {Object} Models grouped by provider
   */
  getModelsByProvider() {
    const config = this.configManager.loadConfig();
    const providers = this.configManager.getProviders(config);

    const result = {};
    for (const [name, provider] of Object.entries(providers)) {
      result[name] = {
        provider: name,
        models: provider.models || []
      };
    }

    return result;
  }

  /**
   * Search models
   * @param {string} query - Search query
   * @returns {Array} Matching models
   */
  searchModels(query) {
    const allModels = this.listModels();
    const lowerQuery = query.toLowerCase();

    return allModels.filter(model => {
      return (
        model.id.toLowerCase().includes(lowerQuery) ||
        model.name.toLowerCase().includes(lowerQuery) ||
        model.provider.toLowerCase().includes(lowerQuery)
      );
    });
  }

  /**
   * Get models for selection (for agent configuration)
   * @returns {Array} Models formatted for selection
   */
  getModelsForSelection() {
    const allModels = this.listModels();
    return allModels.map(model => ({
      name: `${model.provider}/${model.id} (${model.name})`,
      value: `${model.provider}/${model.id}`,
      provider: model.provider,
      modelId: model.id
    }));
  }
}

module.exports = ModelManager;