const inquirer = require('inquirer').default;
const chalk = require('chalk').default;
const { constants } = require('../../../core');

class ProvidersAddEditScreen {
  constructor(tuiController) {
    this.tuiController = tuiController;
  }

  async render() {
    const isEdit = this.tuiController.dataContext.providerName;
    const title = isEdit ? 'Edit Provider' : 'Add Provider';

    console.log(chalk.bold.cyan(`\n${title}`));
    console.log(chalk.gray('Configure a new model provider'));

    if (isEdit) {
      await this.renderEditForm();
    } else {
      await this.renderAddForm();
    }
  }

  async renderAddForm() {
    const questions = [
      {
        type: 'input',
        name: 'name',
        message: 'Provider name:',
        validate: (input) => {
          if (!input || input.trim().length === 0) {
            return 'Provider name is required';
          }
          try {
            this.tuiController.providerManager.validateName(input);
            return true;
          } catch (error) {
            return error.message;
          }
        }
      },
      {
        type: 'input',
        name: 'baseUrl',
        message: 'Base API URL:',
        default: 'https://api.example.com/v1',
        validate: (input) => {
          if (!input || input.trim().length === 0) {
            return 'Base URL is required';
          }
          try {
            this.tuiController.providerManager.validateBaseUrl(input);
            return true;
          } catch (error) {
            return error.message;
          }
        }
      },
      {
        type: 'list',
        name: 'api',
        message: 'API type:',
        choices: [
          { name: 'OpenAI Completions', value: constants.API_TYPES.OPENAI_COMPLETIONS },
          { name: 'Anthropic Messages', value: constants.API_TYPES.ANTHROPIC_MESSAGES }
        ],
        default: constants.API_TYPES.OPENAI_COMPLETIONS
      },
      {
        type: 'list',
        name: 'auth',
        message: 'Auth method:',
        choices: [
          { name: 'API Key', value: constants.AUTH_METHODS.API_KEY },
          { name: 'Bearer Token', value: constants.AUTH_METHODS.BEARER }
        ],
        default: constants.AUTH_METHODS.API_KEY
      },
      {
        type: 'password',
        name: 'apiKey',
        message: 'API Key (optional, press Enter to skip):',
        mask: '*'
      },
      {
        type: 'confirm',
        name: 'confirm',
        message: 'Save this provider?',
        default: true
      }
    ];

    const answers = await inquirer.prompt(questions);

    if (!answers.confirm) {
      this.tuiController.showInfo('Cancelled', 'Provider creation cancelled.');
      await this.tuiController.waitForContinue();
      await this.tuiController.navigateToScreen(constants.SCREEN_IDS.PROVIDERS_LIST);
      return;
    }

    await this.saveProvider(answers);
  }

  async renderEditForm() {
    const providerName = this.tuiController.dataContext.providerName;
    const providerDetails = this.tuiController.providerManager.getProviderDetails(providerName);

    const questions = [
      {
        type: 'input',
        name: 'baseUrl',
        message: 'Base API URL:',
        default: providerDetails.baseUrl,
        validate: (input) => {
          if (!input || input.trim().length === 0) {
            return 'Base URL is required';
          }
          try {
            this.tuiController.providerManager.validateBaseUrl(input);
            return true;
          } catch (error) {
            return error.message;
          }
        }
      },
      {
        type: 'list',
        name: 'api',
        message: 'API type:',
        choices: [
          { name: 'OpenAI Completions', value: constants.API_TYPES.OPENAI_COMPLETIONS },
          { name: 'Anthropic Messages', value: constants.API_TYPES.ANTHROPIC_MESSAGES }
        ],
        default: providerDetails.api
      },
      {
        type: 'list',
        name: 'auth',
        message: 'Auth method:',
        choices: [
          { name: 'API Key', value: constants.AUTH_METHODS.API_KEY },
          { name: 'Bearer Token', value: constants.AUTH_METHODS.BEARER }
        ],
        default: providerDetails.auth
      },
      {
        type: 'password',
        name: 'apiKey',
        message: 'API Key (press Enter to keep current, type "clear" to remove):',
        mask: '*',
        default: providerDetails.apiKey ? '********' : ''
      },
      {
        type: 'confirm',
        name: 'confirm',
        message: 'Save changes?',
        default: true
      }
    ];

    const answers = await inquirer.prompt(questions);

    if (!answers.confirm) {
      this.tuiController.showInfo('Cancelled', 'Provider update cancelled.');
      await this.tuiController.waitForContinue();
      await this.tuiController.navigateToScreen(constants.SCREEN_IDS.PROVIDERS_LIST);
      return;
    }

    // Handle API key
    if (answers.apiKey === '********') {
      // Keep existing API key
      answers.apiKey = providerDetails.apiKey;
    } else if (answers.apiKey === 'clear' || answers.apiKey === '') {
      // Clear API key
      answers.apiKey = null;
    }

    await this.updateProvider(providerName, answers);
  }

  async saveProvider(data) {
    const spinner = this.tuiController.showSpinner('Saving provider...');

    try {
      this.tuiController.providerManager.addProvider(data);
      spinner.succeed(`Provider "${data.name}" added successfully`);
    } catch (error) {
      spinner.fail(`Failed to add provider: ${error.message}`);
    }

    await this.tuiController.waitForContinue();
    await this.tuiController.navigateToScreen(constants.SCREEN_IDS.PROVIDERS_LIST);
  }

  async updateProvider(providerName, data) {
    const spinner = this.tuiController.showSpinner('Updating provider...');

    try {
      this.tuiController.providerManager.updateProvider(providerName, data);
      spinner.succeed(`Provider "${providerName}" updated successfully`);
    } catch (error) {
      spinner.fail(`Failed to update provider: ${error.message}`);
    }

    await this.tuiController.waitForContinue();
    await this.tuiController.navigateToScreen(constants.SCREEN_IDS.PROVIDERS_LIST);
  }

  showSpinner(message) {
    // This would use ora spinner, but we'll implement it in the controller
    return {
      start: () => console.log(chalk.cyan(`\n${message}`)),
      succeed: (msg) => console.log(chalk.green(`✓ ${msg}`)),
      fail: (msg) => console.log(chalk.red(`✗ ${msg}`))
    };
  }
}

module.exports = ProvidersAddEditScreen;