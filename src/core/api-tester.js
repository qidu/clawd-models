class ApiTester {
  constructor(configManager, providerManager, modelManager) {
    this.configManager = configManager;
    this.providerManager = providerManager;
    this.modelManager = modelManager;
  }

  /**
   * Test a model by sending a "hello" request
   * @param {string} modelId - Model ID (format: provider/model-id)
   * @returns {Object} Test results
   */
  async testModel(modelId) {
    try {
      // Parse provider and model ID
      const [providerName, ...modelPath] = modelId.split('/');
      const modelName = modelPath.join('/');

      if (!providerName || !modelName) {
        throw new Error('Invalid model ID format. Expected: provider/model-id');
      }

      // Get configuration
      const config = this.configManager.loadConfig();

      // Get provider
      const provider = this.configManager.getProvider(config, providerName);
      if (!provider) {
        throw new Error(`Provider "${providerName}" not found`);
      }

      // Get model
      const model = this.configManager.getModel(config, providerName, modelName);
      if (!model) {
        throw new Error(`Model "${modelName}" not found in provider "${providerName}"`);
      }

      // Build the endpoint URL based on API type
      let endpoint;
      if (provider.api === 'openai-completions') {
        endpoint = `${provider.baseUrl.replace(/\/$/, '')}/chat/completions`;
      } else if (provider.api === 'anthropic-messages') {
        endpoint = `${provider.baseUrl.replace(/\/$/, '')}/v1/messages`;
      } else {
        throw new Error(`Unsupported API type: ${provider.api}`);
      }

      // Prepare request body and headers
      const { body, headers } = this.prepareRequest(provider, model);

      // Make the request
      const response = await this.makeRequest(endpoint, headers, body);

      return {
        success: true,
        modelId,
        provider: providerName,
        endpoint,
        request: { headers: this.maskSensitiveHeaders(headers), body },
        response
      };
    } catch (error) {
      return {
        success: false,
        modelId,
        error: error.message,
        stack: error.stack
      };
    }
  }

  /**
   * Prepare request body and headers
   * @param {Object} provider - Provider configuration
   * @param {Object} model - Model configuration
   * @returns {Object} Request body and headers
   */
  prepareRequest(provider, model) {
    const apiKey = provider.apiKey;
    const headers = {};

    // Add authentication headers
    if (apiKey) {
      if (provider.auth === 'bearer') {
        headers['Authorization'] = `Bearer ${apiKey}`;
      } else {
        headers['Authorization'] = `Bearer ${apiKey}`;
        headers['X-API-Key'] = apiKey;
      }
    }

    let body;

    if (provider.api === 'openai-completions') {
      body = JSON.stringify({
        model: model.id,
        messages: [{ role: 'user', content: 'hi, there' }],
        max_tokens: 10
      });
      headers['Content-Type'] = 'application/json';
    } else if (provider.api === 'anthropic-messages') {
      body = JSON.stringify({
        model: model.id,
        messages: [{ role: 'user', content: 'hi, there' }],
        max_tokens: 10
      });
      headers['Content-Type'] = 'application/json';
      headers['anthropic-version'] = '2023-06-01';
    }

    return { body, headers };
  }

  /**
   * Make HTTP request
   * @param {string} endpoint - API endpoint URL
   * @param {Object} headers - Request headers
   * @param {string} body - Request body
   * @returns {Object} Response data
   */
  async makeRequest(endpoint, headers, body) {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body
    });

    const status = response.status;
    const responseHeaders = {};
    for (const [key, value] of response.headers.entries()) {
      responseHeaders[key] = value;
    }

    const contentType = response.headers.get('content-type');
    let responseBody;

    if (contentType && contentType.includes('application/json')) {
      responseBody = await response.json();
    } else {
      responseBody = await response.text();
    }

    return {
      status,
      headers: responseHeaders,
      body: responseBody
    };
  }

  /**
   * Mask sensitive headers for display
   * @param {Object} headers - Original headers
   * @returns {Object} Headers with sensitive data masked
   */
  maskSensitiveHeaders(headers) {
    const masked = { ...headers };

    for (const [key, value] of Object.entries(masked)) {
      const keyLower = key.toLowerCase();
      if (
        keyLower.includes('api') ||
        keyLower.includes('authorization') ||
        keyLower.includes('token')
      ) {
        // Mask the value - hide last 32 chars
        if (typeof value === 'string' && value.length > 32) {
          masked[key] = value.slice(0, -32) + '********************************';
        } else {
          masked[key] = '********************************';
        }
      }
    }

    return masked;
  }

  /**
   * Test default model
   * @returns {Object} Test results
   */
  async testDefaultModel() {
    const config = this.configManager.loadConfig();
    const defaultModelId = this.configManager.getAgentDefaultModel(config);

    if (!defaultModelId) {
      throw new Error('No default model configured');
    }

    return this.testModel(defaultModelId);
  }

  /**
   * Test multiple models
   * @param {Array} modelIds - Array of model IDs
   * @returns {Array} Test results for each model
   */
  async testModels(modelIds) {
    const results = [];

    for (const modelId of modelIds) {
      const result = await this.testModel(modelId);
      results.push(result);
    }

    return results;
  }

  /**
   * Get troubleshooting advice for common errors
   * @param {Object} testResult - Test result
   * @returns {string} Troubleshooting advice
   */
  getTroubleshootingAdvice(testResult) {
    if (!testResult.response || testResult.response.status !== 404) {
      return '';
    }

    const provider = testResult.provider;
    const config = this.configManager.loadConfig();
    const providerConfig = this.configManager.getProvider(config, provider);

    if (!providerConfig) {
      return '';
    }

    let advice = '\n--- Troubleshooting ---\n';

    if (providerConfig.api === 'openai-completions') {
      advice += 'For OpenAI-compatible APIs, ensure your base URL ends with /v1\n';
      advice += 'Expected format: <schema>://<hostname>[:port]/v1\n';
      advice += 'Example: https://api.example.com/v1\n';
    } else if (providerConfig.api === 'anthropic-messages') {
      advice += 'For Anthropic Messages APIs, ensure your base URL ends with /v1\n';
      advice += 'Expected format: <schema>://<hostname>[:port]/v1\n';
      advice += 'Example: https://api.anthropic.com/v1\n';
    }

    advice += '\nCommon issues:\n';
    advice += '1. Check if the API endpoint is accessible\n';
    advice += '2. Verify API key is valid and has required permissions\n';
    advice += '3. Ensure the model ID is correct\n';
    advice += '4. Check network connectivity and firewall settings\n';

    return advice;
  }

  /**
   * Validate API configuration
   * @param {string} providerName - Provider name
   * @param {string} baseUrl - Base URL
   * @param {string} apiType - API type
   * @param {string} apiKey - API key (optional)
   * @returns {Object} Validation results
   */
  async validateApiConfig(providerName, baseUrl, apiType, apiKey = null) {
    try {
      // Basic URL validation
      if (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) {
        return {
          valid: false,
          error: 'URL must start with http:// or https://'
        };
      }

      // Test endpoint connectivity
      let endpoint;
      if (apiType === 'openai-completions') {
        endpoint = `${baseUrl.replace(/\/$/, '')}/chat/completions`;
      } else if (apiType === 'anthropic-messages') {
        endpoint = `${baseUrl.replace(/\/$/, '')}/v1/messages`;
      } else {
        return {
          valid: false,
          error: `Unsupported API type: ${apiType}`
        };
      }

      // Try to connect to the endpoint
      const headers = {};
      if (apiKey) {
        headers['Authorization'] = `Bearer ${apiKey}`;
      }

      const response = await fetch(endpoint, {
        method: 'HEAD',
        headers
      });

      return {
        valid: true,
        endpoint,
        status: response.status,
        statusText: response.statusText
      };
    } catch (error) {
      return {
        valid: false,
        error: error.message
      };
    }
  }
}

module.exports = ApiTester;