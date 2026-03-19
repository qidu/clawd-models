const inquirer = require('inquirer').default;

// Check if we have a real TTY
const isInteractive = process.stdin.isTTY || process.stdout.isTTY;

// Create prompt module - use default settings
const prompt = inquirer.createPromptModule();
const chalk = require('chalk').default;
const ora = require('ora').default;
const boxen = require('boxen').default;
const Table = require('cli-table3');

const { ConfigManager, ProviderManager, ModelManager, AgentManager, ApiTester, constants } = require('../core');

class TUIController {
  constructor() {
    this.configManager = new ConfigManager();
    this.providerManager = new ProviderManager(this.configManager);
    this.modelManager = new ModelManager(this.configManager);
    this.agentManager = new AgentManager(this.configManager, this.modelManager);
    this.apiTester = new ApiTester(this.configManager, this.providerManager, this.modelManager);

    this.currentScreen = constants.SCREEN_IDS.MAIN_MENU;
    this.screenStack = [];
    this.dataContext = {};
  }

  /**
   * Initialize and run the TUI
   */
  async run() {
    try {
      await this.showWelcomeScreen();
      await this.navigateToScreen(constants.SCREEN_IDS.MAIN_MENU);
    } catch (error) {
      // Check if this is a user-initiated exit (e.g., Ctrl+C or prompt cancelled)
      if (error.message && (error.message.includes('User force closed') || error.message.includes('Cancelled'))) {
        console.log(chalk.gray('\nExiting...'));
        process.exit(0);
      }
      this.showError('Fatal error', error.message);
      process.exit(1);
    }
  }

  /**
   * Show welcome screen
   */
  async showWelcomeScreen() {
    console.clear();
    console.log(boxen(
      chalk.bold.cyan('clawd-models TUI') + '\n' +
      chalk.gray('Text User Interface for OpenClaw Model Configuration') + '\n\n' +
      chalk.gray('Version: 1.0.7') + '\n' +
      chalk.gray('Config: ') + chalk.cyan(this.configManager.getConfigPath()),
      {
        padding: 1,
        margin: 1,
        borderStyle: 'round',
        borderColor: 'cyan'
      }
    ));

    // Load configuration
    const spinner = ora('Loading configuration...').start();
    try {
      const configExists = this.configManager.configExists();
      if (!configExists) {
        spinner.warn('Configuration file not found. Creating default...');
        const defaultConfig = this.configManager.createDefaultConfig();
        this.configManager.saveConfig(defaultConfig);
        spinner.succeed('Default configuration created');
      } else {
        spinner.succeed('Configuration loaded');
      }
    } catch (error) {
      spinner.fail(`Failed to load configuration: ${error.message}`);
      throw error;
    }

    console.log('\n' + chalk.gray('Press Ctrl+C to exit at any time'));

    // Skip waitForContinue if not in interactive terminal
    if (isInteractive) {
      await this.waitForContinue();
    } else {
      console.log(chalk.gray('[Auto-continuing in non-interactive mode...]'));
    }
  }

  /**
   * Navigate to a screen
   * @param {string} screenId - Screen ID to navigate to
   * @param {Object} context - Data context for the screen
   */
  async navigateToScreen(screenId, context = {}) {
    // Push current screen to stack
    if (this.currentScreen !== screenId) {
      this.screenStack.push(this.currentScreen);
    }

    this.currentScreen = screenId;
    this.dataContext = { ...this.dataContext, ...context };

    await this.renderScreen(screenId);
  }

  /**
   * Go back to previous screen
   */
  async goBack() {
    if (this.screenStack.length > 0) {
      this.currentScreen = this.screenStack.pop();
      await this.renderScreen(this.currentScreen);
    } else {
      await this.navigateToScreen(constants.SCREEN_IDS.MAIN_MENU);
    }
  }

  /**
   * Render screen based on screen ID
   * @param {string} screenId - Screen ID to render
   */
  async renderScreen(screenId) {
    console.clear();

    // Show header
    this.showHeader();

    // Render screen content
    switch (screenId) {
      case constants.SCREEN_IDS.MAIN_MENU:
        await this.renderMainMenu();
        break;
      case constants.SCREEN_IDS.PROVIDERS_LIST:
        await this.renderProvidersList();
        break;
      case constants.SCREEN_IDS.PROVIDERS_ADD:
        await this.renderProvidersAdd();
        break;
      case constants.SCREEN_IDS.PROVIDERS_EDIT:
        await this.renderProvidersEdit();
        break;
      case constants.SCREEN_IDS.PROVIDERS_REMOVE:
        await this.renderProvidersRemove();
        break;
      case constants.SCREEN_IDS.MODELS_LIST:
        await this.renderModelsList();
        break;
      case constants.SCREEN_IDS.MODELS_ADD:
        await this.renderModelsAdd();
        break;
      case constants.SCREEN_IDS.MODELS_EDIT:
        await this.renderModelsEdit();
        break;
      case constants.SCREEN_IDS.MODELS_REMOVE:
        await this.renderModelsRemove();
        break;
      case constants.SCREEN_IDS.AGENTS_LIST:
        await this.renderAgentsList();
        break;
      case constants.SCREEN_IDS.AGENTS_CONFIG:
        await this.renderAgentsConfig();
        break;
      case constants.SCREEN_IDS.AGENTS_MODEL_SELECT:
        await this.renderAgentsModelSelect();
        break;
      case constants.SCREEN_IDS.TEST_API:
        await this.renderTestApi();
        break;
      default:
        this.showError('Unknown screen', `Screen "${screenId}" not found`);
        await this.navigateToScreen(constants.SCREEN_IDS.MAIN_MENU);
        break;
    }
  }

  /**
   * Show header with current screen and navigation info
   */
  showHeader() {
    const screenTitles = {
      [constants.SCREEN_IDS.MAIN_MENU]: 'Main Menu',
      [constants.SCREEN_IDS.PROVIDERS_LIST]: 'Providers',
      [constants.SCREEN_IDS.PROVIDERS_ADD]: 'Add Provider',
      [constants.SCREEN_IDS.PROVIDERS_EDIT]: 'Edit Provider',
      [constants.SCREEN_IDS.PROVIDERS_REMOVE]: 'Remove Provider',
      [constants.SCREEN_IDS.MODELS_LIST]: 'Models',
      [constants.SCREEN_IDS.MODELS_ADD]: 'Add Model',
      [constants.SCREEN_IDS.MODELS_EDIT]: 'Edit Model',
      [constants.SCREEN_IDS.MODELS_REMOVE]: 'Remove Model',
      [constants.SCREEN_IDS.AGENTS_LIST]: 'Agents',
      [constants.SCREEN_IDS.AGENTS_CONFIG]: 'Agent Configuration',
      [constants.SCREEN_IDS.AGENTS_MODEL_SELECT]: 'Select Models',
      [constants.SCREEN_IDS.TEST_API]: 'Test API'
    };

    const title = screenTitles[this.currentScreen] || 'Unknown Screen';
    const configPath = this.configManager.getConfigPath();

    console.log(boxen(
      chalk.bold.cyan(title) + '\n' +
      chalk.gray('Config: ') + chalk.cyan(configPath),
      {
        padding: { top: 0, bottom: 0, left: 1, right: 1 },
        margin: { top: 0, bottom: 1 },
        borderStyle: 'single',
        borderColor: 'gray'
      }
    ));
  }

  /**
   * Show main menu
   */
  async renderMainMenu() {
    const choices = [
      { name: '🚀 Quick Setup Wizard', value: 'quick-setup' },
      { name: '📋 Providers Management', value: constants.SCREEN_IDS.PROVIDERS_LIST },
      { name: '🤖 Models Management', value: constants.SCREEN_IDS.MODELS_LIST },
      { name: '👥 Agents Configuration', value: constants.SCREEN_IDS.AGENTS_LIST },
      { name: '🔧 Test API Connection', value: constants.SCREEN_IDS.TEST_API },
      new inquirer.Separator(),
      { name: '📊 View Configuration', value: 'view-config' },
      { name: '💾 Save Configuration', value: 'save-config' },
      { name: '🔄 Reset Configuration', value: 'reset-config' },
      new inquirer.Separator(),
      { name: '❌ Exit', value: 'exit' }
    ];

    let action;

    if (isInteractive) {
      const result = await prompt([
        {
          type: 'list',
          name: 'action',
          message: 'What would you like to do?',
          choices,
          pageSize: 12
        }
      ]);
      action = result.action;
    } else {
      // Non-interactive mode: show menu options and exit
      console.log(chalk.yellow('\n⚠️  Running in non-interactive mode'));
      console.log(chalk.gray('Available commands:'));
      console.log(chalk.gray('  1. quick-setup     - Run quick setup wizard'));
      console.log(chalk.gray('  2. providers       - Manage providers'));
      console.log(chalk.gray('  3. models          - Manage models'));
      console.log(chalk.gray('  4. agents          - Configure agents'));
      console.log(chalk.gray('  5. test            - Test API connection'));
      console.log(chalk.gray('  6. view-config     - View configuration'));
      console.log(chalk.gray('  7. exit            - Exit'));
      console.log(chalk.gray('\nNote: Full interactive TUI requires a real terminal.'));
      console.log(chalk.gray('Try: script -q /dev/null -c "clawd-models"\n'));
      action = 'exit';
    }

    await this.handleMainMenuAction(action);
  }

  /**
   * Handle main menu action
   * @param {string} action - Selected action
   */
  async handleMainMenuAction(action) {
    switch (action) {
      case 'quick-setup':
        await this.runQuickSetupWizard();
        break;
      case constants.SCREEN_IDS.PROVIDERS_LIST:
        await this.navigateToScreen(constants.SCREEN_IDS.PROVIDERS_LIST);
        break;
      case constants.SCREEN_IDS.MODELS_LIST:
        await this.navigateToScreen(constants.SCREEN_IDS.MODELS_LIST);
        break;
      case constants.SCREEN_IDS.AGENTS_LIST:
        await this.navigateToScreen(constants.SCREEN_IDS.AGENTS_LIST);
        break;
      case constants.SCREEN_IDS.TEST_API:
        await this.navigateToScreen(constants.SCREEN_IDS.TEST_API);
        break;
      case 'view-config':
        await this.viewConfiguration();
        break;
      case 'save-config':
        await this.saveConfiguration();
        break;
      case 'reset-config':
        await this.resetConfiguration();
        break;
      case 'exit':
        await this.exitApplication();
        break;
    }
  }

  /**
   * View configuration
   */
  async viewConfiguration() {
    console.clear();
    this.showHeader();

    try {
      const config = this.configManager.loadConfig();
      console.log(chalk.gray('Configuration JSON:'));
      console.log(JSON.stringify(config, null, 2));
    } catch (error) {
      this.showError('Failed to load configuration', error.message);
    }

    await this.waitForContinue();
    await this.navigateToScreen(constants.SCREEN_IDS.MAIN_MENU);
  }

  /**
   * Save configuration
   */
  async saveConfiguration() {
    const spinner = ora('Saving configuration...').start();
    try {
      const config = this.configManager.loadConfig();
      this.configManager.saveConfig(config);
      spinner.succeed('Configuration saved successfully');
    } catch (error) {
      spinner.fail(`Failed to save configuration: ${error.message}`);
    }

    await this.waitForContinue();
    await this.navigateToScreen(constants.SCREEN_IDS.MAIN_MENU);
  }

  /**
   * Reset configuration
   */
  async resetConfiguration() {
    const { confirm } = await prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message: chalk.yellow('⚠️  Are you sure you want to reset configuration to defaults?'),
        default: false
      }
    ]);

    if (!confirm) {
      await this.navigateToScreen(constants.SCREEN_IDS.MAIN_MENU);
      return;
    }

    const spinner = ora('Resetting configuration...').start();
    try {
      const defaultConfig = this.configManager.createDefaultConfig();
      this.configManager.saveConfig(defaultConfig);
      spinner.succeed('Configuration reset to defaults');
    } catch (error) {
      spinner.fail(`Failed to reset configuration: ${error.message}`);
    }

    await this.waitForContinue();
    await this.navigateToScreen(constants.SCREEN_IDS.MAIN_MENU);
  }

  /**
   * Exit application
   */
  async exitApplication() {
    console.log(chalk.gray('\nExiting clawd-models TUI...'));
    process.exit(0);
  }

  /**
   * Quick Setup Wizard - Streamlined flow to add provider, models, and test
   */
  async runQuickSetupWizard() {
    console.clear();
    this.showHeader();

    console.log(chalk.bold.cyan('\n🚀 Quick Setup Wizard'));
    console.log(chalk.gray('This wizard will help you:'));
    console.log(chalk.gray('  1. Add a new provider with example models'));
    console.log(chalk.gray('  2. Select a primary model'));
    console.log(chalk.gray('  3. Configure fallback models'));
    console.log(chalk.gray('  4. Test the primary model'));

    const { confirm } = await prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message: '\nStart the quick setup wizard?',
        default: true
      }
    ]);

    if (!confirm) {
      await this.navigateToScreen(constants.SCREEN_IDS.MAIN_MENU);
      return;
    }

    // Step 1: Add provider with example models
    await this.wizardAddProvider();

    // Step 2: Select primary model
    await this.wizardSelectPrimary();

    // Step 3: Select fallback models
    await this.wizardSelectFallbacks();

    // Step 4: Save configuration
    await this.wizardSaveConfig();

    // Step 5: Test primary model
    await this.wizardTestModel();

    // Done
    await this.navigateToScreen(constants.SCREEN_IDS.MAIN_MENU);
  }

  /**
   * Wizard step: Add provider with models
   */
  async wizardAddProvider() {
    console.clear();
    this.showHeader();
    console.log(chalk.bold.cyan('\n📋 Step 1: Add Provider with Models'));

    // Show example template
    console.log(chalk.gray('\nExample provider configuration:'));
    console.log(chalk.cyan(`
{
  "providerName": "proxy8788",
  "baseUrl": "http://localhost:8788/",
  "apiKey": "sk-hello",
  "auth": "api-key",
  "api": "anthropic-messages",
  "models": [
    { "id": "stepfun/step-flash", "name": "Step 3.5", ... },
    { "id": "meituan/longcat-flash", "name": "Longcat Flash", ... },
    { "id": "llama", "name": "Llama 3.1", ... }
  ]
}`));

    const answers = await prompt([
      {
        type: 'input',
        name: 'providerName',
        message: 'Provider name:',
        default: 'proxy8788',
        validate: (input) => {
          if (!input || input.trim().length === 0) return 'Provider name is required';
          if (!/^[a-zA-Z0-9_-]+$/.test(input)) return 'Provider name must be alphanumeric (letters, numbers, underscore, hyphen)';
          return true;
        }
      },
      {
        type: 'input',
        name: 'baseUrl',
        message: 'Base URL:',
        default: 'http://localhost:8788/',
        validate: (input) => {
          if (!input || input.trim().length === 0) return 'Base URL is required';
          if (!input.startsWith('http://') && !input.startsWith('https://')) {
            return 'URL must start with http:// or https://';
          }
          return true;
        }
      },
      {
        type: 'input',
        name: 'apiKey',
        message: 'API Key (optional, press Enter to skip):',
        default: ''
      },
      {
        type: 'list',
        name: 'auth',
        message: 'Auth method:',
        choices: [
          { name: 'API Key (X-API-Key header)', value: 'api-key' },
          { name: 'Bearer Token', value: 'bearer' }
        ],
        default: 'api-key'
      },
      {
        type: 'list',
        name: 'api',
        message: 'API type:',
        choices: [
          { name: 'OpenAI Chat Completions (OpenAI-compatible)', value: 'openai-completions' },
          { name: 'Anthropic Messages API', value: 'anthropic-messages' }
        ],
        default: 'anthropic-messages'
      }
    ]);

    // Now add models
    console.log(chalk.bold.cyan('\n📝 Add Models'));
    console.log(chalk.gray('Enter model details (press Enter to skip adding more):'));

    const models = [];
    let addMore = true;

    while (addMore) {
      const modelAnswers = await prompt([
        {
          type: 'input',
          name: 'modelId',
          message: 'Model ID (e.g., stepfun/step-flash):',
          validate: (input) => {
            if (!input || input.trim().length === 0) return 'Model ID is required';
            return true;
          }
        },
        {
          type: 'input',
          name: 'modelName',
          message: 'Display name (e.g., Step 3.5):',
          validate: (input) => {
            if (!input || input.trim().length === 0) return 'Display name is required';
            return true;
          }
        },
        {
          type: 'confirm',
          name: 'reasoning',
          message: 'Does this model support reasoning?',
          default: false
        },
        {
          type: 'input',
          name: 'contextWindow',
          message: 'Context window (tokens):',
          default: '200000'
        },
        {
          type: 'input',
          name: 'maxTokens',
          message: 'Max output tokens:',
          default: '8192'
        }
      ]);

      models.push({
        id: modelAnswers.modelId,
        name: modelAnswers.modelName,
        reasoning: modelAnswers.reasoning,
        input: ['text'],
        contextWindow: parseInt(modelAnswers.contextWindow) || 200000,
        maxTokens: parseInt(modelAnswers.maxTokens) || 8192
      });

      const { continueAdding } = await prompt([
        {
          type: 'confirm',
          name: 'continueAdding',
          message: 'Add another model?',
          default: true
        }
      ]);

      addMore = continueAdding;
    }

    // Save provider and models
    const spinner = ora('Saving provider and models...').start();

    try {
      const config = this.configManager.loadConfig();

      // Check if provider exists
      const existingProvider = this.configManager.getProvider(config, answers.providerName);
      if (existingProvider) {
        spinner.warn(`Provider "${answers.providerName}" already exists, updating...`);
      }

      // Set provider
      const providerData = {
        baseUrl: answers.baseUrl,
        api: answers.api,
        auth: answers.auth,
        models: models
      };

      if (answers.apiKey) {
        providerData.apiKey = answers.apiKey;
      }

      this.configManager.setProvider(config, answers.providerName, providerData);
      this.configManager.saveConfig(config);

      spinner.succeed(`Provider "${answers.providerName}" with ${models.length} model(s) saved!`);
    } catch (error) {
      spinner.fail(`Failed to save: ${error.message}`);
      this.showError('Error', error.message);
    }

    await this.waitForContinue();
  }

  /**
   * Wizard step: Select primary model
   */
  async wizardSelectPrimary() {
    console.clear();
    this.showHeader();
    console.log(chalk.bold.cyan('\n🎯 Step 2: Select Primary Model'));

    const allModels = this.modelManager.listModels();

    if (allModels.length === 0) {
      this.showError('No Models', 'No models available. Please add models first.');
      await this.waitForContinue();
      return;
    }

    const modelChoices = allModels.map(model => ({
      name: `${model.provider}/${model.id} (${model.name})`,
      value: `${model.provider}/${model.id}`
    }));

    const { selectedModel } = await prompt([
      {
        type: 'list',
        name: 'selectedModel',
        message: 'Select primary model:',
        choices: modelChoices,
        pageSize: 15
      }
    ]);

    const spinner = ora('Setting primary model...').start();

    try {
      this.agentManager.setDefaultModel(selectedModel);
      spinner.succeed(`Primary model set to: ${selectedModel}`);
    } catch (error) {
      spinner.fail(`Failed: ${error.message}`);
    }

    await this.waitForContinue();
  }

  /**
   * Wizard step: Select fallback models
   */
  async wizardSelectFallbacks() {
    console.clear();
    this.showHeader();
    console.log(chalk.bold.cyan('\n🔄 Step 3: Select Fallback Models'));

    const primaryModel = this.agentManager.getDefaultModel();
    if (!primaryModel) {
      this.showWarning('No Primary', 'No primary model selected. Skipping fallback configuration.');
      await this.waitForContinue();
      return;
    }

    const allModels = this.modelManager.listModels();

    // Filter out primary model
    const availableModels = allModels.filter(
      model => `${model.provider}/${model.id}` !== primaryModel
    );

    if (availableModels.length === 0) {
      this.showWarning('No Fallbacks', 'No other models available for fallbacks.');
      await this.waitForContinue();
      return;
    }

    const modelChoices = availableModels.map(model => ({
      name: `${model.provider}/${model.id} (${model.name})`,
      value: `${model.provider}/${model.id}`
    }));

    console.log(chalk.gray(`Primary model: ${chalk.cyan(primaryModel)}`));
    console.log(chalk.gray('Select fallback models (use space to select):\n'));

    const { selectedModels } = await prompt([
      {
        type: 'checkbox',
        name: 'selectedModels',
        message: 'Select fallback models:',
        choices: modelChoices,
        pageSize: 15
      }
    ]);

    const spinner = ora('Setting fallback models...').start();

    try {
      this.agentManager.setFallbackModels(selectedModels);
      spinner.succeed(`Set ${selectedModels.length} fallback model(s)`);
    } catch (error) {
      spinner.fail(`Failed: ${error.message}`);
    }

    await this.waitForContinue();
  }

  /**
   * Wizard step: Save configuration
   */
  async wizardSaveConfig() {
    console.clear();
    this.showHeader();
    console.log(chalk.bold.cyan('\n💾 Step 4: Save Configuration'));

    const spinner = ora('Saving configuration...').start();

    try {
      const config = this.configManager.loadConfig();
      this.configManager.saveConfig(config);
      spinner.succeed('Configuration saved!');
    } catch (error) {
      spinner.fail(`Failed: ${error.message}`);
    }

    await this.waitForContinue();
  }

  /**
   * Wizard step: Test primary model
   */
  async wizardTestModel() {
    console.clear();
    this.showHeader();
    console.log(chalk.bold.cyan('\n🧪 Step 5: Test Primary Model'));

    const primaryModel = this.agentManager.getDefaultModel();

    if (!primaryModel) {
      this.showWarning('No Model', 'No primary model configured to test.');
      await this.waitForContinue();
      return;
    }

    console.log(chalk.gray(`Testing model: ${chalk.cyan(primaryModel)}`));

    const { confirm } = await prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message: 'Send test request?',
        default: true
      }
    ]);

    if (!confirm) {
      console.log(chalk.yellow('Test skipped.'));
      await this.waitForContinue();
      return;
    }

    const spinner = ora('Testing model...').start();

    try {
      const result = await this.apiTester.testModel(primaryModel);

      spinner.stop();

      if (result.success) {
        console.log(chalk.green('\n✅ Test Successful!'));
        console.log(chalk.gray(`Model: ${result.modelId}`));
        console.log(chalk.gray(`Provider: ${result.provider}`));
        console.log(chalk.gray(`Endpoint: ${result.endpoint}`));
        console.log(chalk.gray(`Status: ${result.response.status}`));

        if (result.response.body) {
          console.log(chalk.bold('\n📝 Response:'));
          const responseStr = JSON.stringify(result.response.body, null, 2);
          if (responseStr.length > 500) {
            console.log(chalk.gray(responseStr.substring(0, 500) + '...'));
          } else {
            console.log(chalk.gray(responseStr));
          }
        }
      } else {
        console.log(chalk.red('\n❌ Test Failed!'));
        console.log(chalk.red(`Error: ${result.error}`));

        if (result.response?.status === 404) {
          const advice = this.apiTester.getTroubleshootingAdvice(result);
          if (advice) {
            console.log(chalk.yellow(advice));
          }
        }
      }
    } catch (error) {
      spinner.fail('Test failed');
      console.log(chalk.red(`Error: ${error.message}`));
    }

    await this.waitForContinue();
  }

  /**
   * Show error message
   * @param {string} title - Error title
   * @param {string} message - Error message
   */
  showError(title, message) {
    console.log('\n' + boxen(
      chalk.bold.red('❌ ' + title) + '\n\n' +
      chalk.red(message),
      {
        padding: 1,
        margin: 1,
        borderStyle: 'round',
        borderColor: 'red'
      }
    ));
  }

  /**
   * Show success message
   * @param {string} title - Success title
   * @param {string} message - Success message
   */
  showSuccess(title, message) {
    console.log('\n' + boxen(
      chalk.bold.green('✅ ' + title) + '\n\n' +
      chalk.green(message),
      {
        padding: 1,
        margin: 1,
        borderStyle: 'round',
        borderColor: 'green'
      }
    ));
  }

  /**
   * Show warning message
   * @param {string} title - Warning title
   * @param {string} message - Warning message
   */
  showWarning(title, message) {
    console.log('\n' + boxen(
      chalk.bold.yellow('⚠️  ' + title) + '\n\n' +
      chalk.yellow(message),
      {
        padding: 1,
        margin: 1,
        borderStyle: 'round',
        borderColor: 'yellow'
      }
    ));
  }

  /**
   * Show info message
   * @param {string} title - Info title
   * @param {string} message - Info message
   */
  showInfo(title, message) {
    console.log('\n' + boxen(
      chalk.bold.cyan('ℹ️  ' + title) + '\n\n' +
      chalk.cyan(message),
      {
        padding: 1,
        margin: 1,
        borderStyle: 'round',
        borderColor: 'cyan'
      }
    ));
  }

  /**
   * Show spinner (simple implementation without ora for now)
   * @param {string} message - Spinner message
   * @returns {Object} Spinner-like object
   */
  showSpinner(message) {
    console.log(chalk.cyan(`\n${message}`));
    return {
      start: () => console.log(chalk.cyan(`\n${message}`)),
      succeed: (msg) => console.log(chalk.green(`✓ ${msg}`)),
      fail: (msg) => console.log(chalk.red(`✗ ${msg}`))
    };
  }

  /**
   * Wait for user to continue
   */
  async waitForContinue() {
    if (!isInteractive) {
      console.log(chalk.gray('[Continuing...]'));
      return;
    }

    try {
      await prompt([
        {
          type: 'input',
          name: 'continue',
          message: chalk.gray('Press Enter to continue...'),
          prefix: ''
        }
      ]);
    } catch (error) {
      // In non-interactive mode or when stdin is closed, just continue
      console.log(chalk.gray('\n[Continuing in non-interactive mode...]'));
    }
  }

  /**
   * Create a table
   * @param {Array} headers - Table headers
   * @param {Array} rows - Table rows
   * @param {Object} options - Table options
   * @returns {Table} Table instance
   */
  createTable(headers, rows, options = {}) {
    const defaultOptions = {
      head: headers,
      style: { head: ['cyan'], border: ['gray'] },
      colWidths: headers.map(() => null)
    };

    const table = new Table({ ...defaultOptions, ...options });
    rows.forEach(row => table.push(row));
    return table;
  }

  // Screen rendering methods will be implemented in separate files
  async renderProvidersList() {
    const ProvidersListScreen = require('./screens/providers/list');
    const screen = new ProvidersListScreen(this);
    await screen.render();
  }

  async renderProvidersAdd() {
    const ProvidersAddEditScreen = require('./screens/providers/add-edit');
    const screen = new ProvidersAddEditScreen(this);
    await screen.render();
  }

  async renderProvidersEdit() {
    const ProvidersAddEditScreen = require('./screens/providers/add-edit');
    const screen = new ProvidersAddEditScreen(this);
    await screen.render();
  }

  async renderProvidersRemove() {
    const ProvidersRemoveScreen = require('./screens/providers/remove');
    const screen = new ProvidersRemoveScreen(this);
    await screen.render();
  }

  async renderModelsList() {
    const ModelsListScreen = require('./screens/models/list');
    const screen = new ModelsListScreen(this);
    await screen.render();
  }

  async renderModelsAdd() {
    const ModelsAddEditScreen = require('./screens/models/add-edit');
    const screen = new ModelsAddEditScreen(this);
    await screen.render();
  }

  async renderModelsEdit() {
    const ModelsAddEditScreen = require('./screens/models/add-edit');
    const screen = new ModelsAddEditScreen(this);
    await screen.render();
  }

  async renderModelsRemove() {
    const ModelsRemoveScreen = require('./screens/models/remove');
    const screen = new ModelsRemoveScreen(this);
    await screen.render();
  }

  async renderAgentsList() {
    const AgentsListScreen = require('./screens/agents/list');
    const screen = new AgentsListScreen(this);
    await screen.render();
  }

  async renderAgentsConfig() {
    const AgentsConfigScreen = require('./screens/agents/config');
    const screen = new AgentsConfigScreen(this);
    await screen.render();
  }

  async renderAgentsModelSelect() {
    const AgentsModelSelectScreen = require('./screens/agents/model-select');
    const screen = new AgentsModelSelectScreen(this);
    await screen.render();
  }

  async renderTestApi() {
    const ApiTestScreen = require('./screens/test/api-test');
    const screen = new ApiTestScreen(this);
    await screen.render();
  }
}

module.exports = TUIController;