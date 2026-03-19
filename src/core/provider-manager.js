class ProviderManager {
  constructor(configManager) {
    this.configManager = configManager;
  }

  /**
   * Validate provider name
   * @param {string} name - Provider name
   * @returns {boolean} True if valid
   */
  validateName(name) {
    if (!name || name.trim().length === 0) {
      throw new Error('Provider name is required');
    }

    // Check for duplicates
    const config = this.configManager.loadConfig();
    const providers = this.configManager.getProviders(config);
    if (providers[name]) {
      throw new Error(`Provider "${name}" already exists`);
    }

    return true;
  }

  /**
   * Validate base URL
   * @param {string} url - Base URL
   * @returns {boolean} True if valid
   */
  validateBaseUrl(url) {
    if (!url || url.trim().length === 0) {
      throw new Error('Base URL is required');
    }

    // Basic URL validation
    try {
      // Check if it starts with http:// or https://
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        throw new Error('URL must start with http:// or https://');
      }

      // Try to create a URL object (Node.js built-in)
      new URL(url);
    } catch (error) {
      throw new Error(`Invalid URL format: ${error.message}`);
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
   * Validate auth method
   * @param {string} authMethod - Auth method
   * @returns {boolean} True if valid
   */
  validateAuthMethod(authMethod) {
    const validMethods = ['api-key', 'bearer'];
    if (!validMethods.includes(authMethod)) {
      throw new Error(`Auth method must be one of: ${validMethods.join(', ')}`);
    }
    return true;
  }

  /**
   * Create provider object
   * @param {Object} data - Provider data
   * @returns {Object} Provider object
   */
  createProvider(data) {
    this.validateName(data.name);
    this.validateBaseUrl(data.baseUrl);
    this.validateApiType(data.api);
    this.validateAuthMethod(data.auth);

    const provider = {
      baseUrl: data.baseUrl,
      api: data.api,
      auth: data.auth,
      models: []
    };

    if (data.apiKey) {
      provider.apiKey = data.apiKey;
    }

    return provider;
  }

  /**
   * Add a provider
   * @param {Object} data - Provider data
   * @returns {boolean} True if successful
   */
  addProvider(data) {
    const config = this.configManager.loadConfig();
    const provider = this.createProvider(data);

    const updatedConfig = this.configManager.setProvider(config, data.name, provider);
    this.configManager.saveConfig(updatedConfig);

    return true;
  }

  /**
   * Update a provider
   * @param {string} name - Provider name
   * @param {Object} data - Provider data
   * @returns {boolean} True if successful
   */
  updateProvider(name, data) {
    const config = this.configManager.loadConfig();
    const existingProvider = this.configManager.getProvider(config, name);

    if (!existingProvider) {
      throw new Error(`Provider "${name}" not found`);
    }

    // Validate inputs (except name which we're updating existing)
    this.validateBaseUrl(data.baseUrl);
    this.validateApiType(data.api);
    this.validateAuthMethod(data.auth);

    const updatedProvider = {
      ...existingProvider,
      baseUrl: data.baseUrl,
      api: data.api,
      auth: data.auth
    };

    if (data.apiKey) {
      updatedProvider.apiKey = data.apiKey;
    } else if (existingProvider.apiKey && !data.apiKey) {
      // Keep existing API key if not specified
      updatedProvider.apiKey = existingProvider.apiKey;
    }

    const updatedConfig = this.configManager.setProvider(config, name, updatedProvider);
    this.configManager.saveConfig(updatedConfig);

    return true;
  }

  /**
   * Remove a provider
   * @param {string} name - Provider name
   * @returns {boolean} True if successful
   */
  removeProvider(name) {
    const config = this.configManager.loadConfig();
    const provider = this.configManager.getProvider(config, name);

    if (!provider) {
      throw new Error(`Provider "${name}" not found`);
    }

    // Check if provider has models
    if (provider.models && provider.models.length > 0) {
      throw new Error(`Provider "${name}" has ${provider.models.length} models. Remove models first or confirm deletion.`);
    }

    const updatedConfig = this.configManager.removeProvider(config, name);
    this.configManager.saveConfig(updatedConfig);

    return true;
  }

  /**
   * List all providers
   * @returns {Array} Array of providers with details
   */
  listProviders() {
    const config = this.configManager.loadConfig();
    const providers = this.configManager.getProviders(config);

    const result = [];
    for (const [name, provider] of Object.entries(providers)) {
      result.push({
        name,
        baseUrl: provider.baseUrl,
        api: provider.api,
        auth: provider.auth,
        hasApiKey: !!provider.apiKey,
        modelCount: provider.models?.length || 0
      });
    }

    return result;
  }

  /**
   * Get provider details
   * @param {string} name - Provider name
   * @returns {Object} Provider details
   */
  getProviderDetails(name) {
    const config = this.configManager.loadConfig();
    const provider = this.configManager.getProvider(config, name);

    if (!provider) {
      throw new Error(`Provider "${name}" not found`);
    }

    return {
      name,
      baseUrl: provider.baseUrl,
      api: provider.api,
      auth: provider.auth,
      apiKey: provider.apiKey,
      models: provider.models || []
    };
  }

  /**
   * Check if provider exists
   * @param {string} name - Provider name
   * @returns {boolean} True if exists
   */
  providerExists(name) {
    const config = this.configManager.loadConfig();
    return !!this.configManager.getProvider(config, name);
  }

  /**
   * Get all providers with their models
   * @returns {Object} Providers with model lists
   */
  getProvidersWithModels() {
    const config = this.configManager.loadConfig();
    const providers = this.configManager.getProviders(config);

    const result = {};
    for (const [name, provider] of Object.entries(providers)) {
      result[name] = {
        ...provider,
        models: provider.models || []
      };
    }

    return result;
  }
}

module.exports = ProviderManager;