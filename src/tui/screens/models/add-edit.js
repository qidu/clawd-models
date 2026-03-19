const inquirer = require('inquirer').default;
const chalk = require('chalk').default;
const { constants } = require('../../../core');

class ModelsAddEditScreen {
  constructor(tuiController) {
    this.tuiController = tuiController;
  }

  async render() {
    const isEdit = this.tuiController.dataContext.providerName && this.tuiController.dataContext.modelId;
    const title = isEdit ? 'Edit Model' : 'Add Model';

    console.log(chalk.bold.cyan(`\n${title}`));
    console.log(chalk.gray('Configure a new model for a provider'));

    if (isEdit) {
      await this.renderEditForm();
    } else {
      await this.renderAddForm();
    }
  }

  async renderAddForm() {
    // Get available providers
    const providers = this.tuiController.providerManager.listProviders();

    if (providers.length === 0) {
      this.tuiController.showError('No Providers', 'No providers available. Add a provider first.');
      await this.tuiController.waitForContinue();
      await this.tuiController.navigateToScreen(constants.SCREEN_IDS.MODELS_LIST);
      return;
    }

    const providerChoices = providers.map(p => ({
      name: `${p.name} (${p.baseUrl})`,
      value: p.name
    }));

    const questions = [
      {
        type: 'list',
        name: 'providerName',
        message: 'Select provider:',
        choices: providerChoices,
        pageSize: 10
      },
      {
        type: 'input',
        name: 'id',
        message: 'Model ID (e.g., minimax/minimax-m2.1):',
        validate: (input, answers) => {
          if (!input || input.trim().length === 0) {
            return 'Model ID is required';
          }
          try {
            this.tuiController.modelManager.validateModelId(answers.providerName, input, false);
            return true;
          } catch (error) {
            return error.message;
          }
        }
      },
      {
        type: 'input',
        name: 'name',
        message: 'Display name:',
        validate: (input) => {
          if (!input || input.trim().length === 0) {
            return 'Display name is required';
          }
          return true;
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
        type: 'checkbox',
        name: 'input',
        message: 'Input types:',
        choices: [
          { name: 'Text', value: constants.INPUT_TYPES.TEXT, checked: true },
          { name: 'Image', value: constants.INPUT_TYPES.IMAGE },
          { name: 'Audio', value: constants.INPUT_TYPES.AUDIO },
          { name: 'Video', value: constants.INPUT_TYPES.VIDEO }
        ],
        validate: (input) => {
          if (input.length === 0) {
            return 'At least one input type is required';
          }
          return true;
        }
      },
      {
        type: 'confirm',
        name: 'reasoning',
        message: 'Does this model have reasoning capability?',
        default: false
      },
      {
        type: 'input',
        name: 'inputCost',
        message: 'Input cost per 1M tokens (default: 0):',
        default: '0',
        validate: (input) => {
          if (input === '' || input === '0') return true;
          const num = parseFloat(input);
          if (isNaN(num) || num < 0) {
            return 'Cost must be a non-negative number';
          }
          return true;
        }
      },
      {
        type: 'input',
        name: 'outputCost',
        message: 'Output cost per 1M tokens (default: 0):',
        default: '0',
        validate: (input) => {
          if (input === '' || input === '0') return true;
          const num = parseFloat(input);
          if (isNaN(num) || num < 0) {
            return 'Cost must be a non-negative number';
          }
          return true;
        }
      },
      {
        type: 'input',
        name: 'contextWindow',
        message: 'Context window size (default: 200000):',
        default: '200000',
        validate: (input) => {
          if (input === '' || input === '200000') return true;
          const num = parseInt(input);
          if (isNaN(num) || num < 1) {
            return 'Context window must be a positive number';
          }
          return true;
        }
      },
      {
        type: 'input',
        name: 'maxTokens',
        message: 'Max output tokens (default: 8192):',
        default: '8192',
        validate: (input) => {
          if (input === '' || input === '8192') return true;
          const num = parseInt(input);
          if (isNaN(num) || num < 1) {
            return 'Max tokens must be a positive number';
          }
          return true;
        }
      },
      {
        type: 'confirm',
        name: 'confirm',
        message: 'Save this model?',
        default: true
      }
    ];

    const answers = await inquirer.prompt(questions);

    if (!answers.confirm) {
      this.tuiController.showInfo('Cancelled', 'Model creation cancelled.');
      await this.tuiController.waitForContinue();
      await this.tuiController.navigateToScreen(constants.SCREEN_IDS.MODELS_LIST);
      return;
    }

    await this.saveModel(answers);
  }

  async renderEditForm() {
    const { providerName, modelId } = this.tuiController.dataContext;
    const modelDetails = this.tuiController.modelManager.getModelDetails(providerName, modelId);

    const questions = [
      {
        type: 'input',
        name: 'id',
        message: 'Model ID:',
        default: modelDetails.id,
        validate: (input) => {
          if (!input || input.trim().length === 0) {
            return 'Model ID is required';
          }
          if (input === modelDetails.id) return true;
          try {
            this.tuiController.modelManager.validateModelId(providerName, input, true);
            return true;
          } catch (error) {
            return error.message;
          }
        }
      },
      {
        type: 'input',
        name: 'name',
        message: 'Display name:',
        default: modelDetails.name,
        validate: (input) => {
          if (!input || input.trim().length === 0) {
            return 'Display name is required';
          }
          return true;
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
        default: modelDetails.api
      },
      {
        type: 'checkbox',
        name: 'input',
        message: 'Input types:',
        choices: [
          { name: 'Text', value: constants.INPUT_TYPES.TEXT, checked: modelDetails.input.includes(constants.INPUT_TYPES.TEXT) },
          { name: 'Image', value: constants.INPUT_TYPES.IMAGE, checked: modelDetails.input.includes(constants.INPUT_TYPES.IMAGE) },
          { name: 'Audio', value: constants.INPUT_TYPES.AUDIO, checked: modelDetails.input.includes(constants.INPUT_TYPES.AUDIO) },
          { name: 'Video', value: constants.INPUT_TYPES.VIDEO, checked: modelDetails.input.includes(constants.INPUT_TYPES.VIDEO) }
        ],
        validate: (input) => {
          if (input.length === 0) {
            return 'At least one input type is required';
          }
          return true;
        }
      },
      {
        type: 'confirm',
        name: 'reasoning',
        message: 'Does this model have reasoning capability?',
        default: modelDetails.reasoning
      },
      {
        type: 'input',
        name: 'inputCost',
        message: 'Input cost per 1M tokens:',
        default: modelDetails.cost.input.toString(),
        validate: (input) => {
          if (input === '') return true;
          const num = parseFloat(input);
          if (isNaN(num) || num < 0) {
            return 'Cost must be a non-negative number';
          }
          return true;
        }
      },
      {
        type: 'input',
        name: 'outputCost',
        message: 'Output cost per 1M tokens:',
        default: modelDetails.cost.output.toString(),
        validate: (input) => {
          if (input === '') return true;
          const num = parseFloat(input);
          if (isNaN(num) || num < 0) {
            return 'Cost must be a non-negative number';
          }
          return true;
        }
      },
      {
        type: 'input',
        name: 'contextWindow',
        message: 'Context window size:',
        default: modelDetails.contextWindow.toString(),
        validate: (input) => {
          if (input === '') return true;
          const num = parseInt(input);
          if (isNaN(num) || num < 1) {
            return 'Context window must be a positive number';
          }
          return true;
        }
      },
      {
        type: 'input',
        name: 'maxTokens',
        message: 'Max output tokens:',
        default: modelDetails.maxTokens.toString(),
        validate: (input) => {
          if (input === '') return true;
          const num = parseInt(input);
          if (isNaN(num) || num < 1) {
            return 'Max tokens must be a positive number';
          }
          return true;
        }
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
      this.tuiController.showInfo('Cancelled', 'Model update cancelled.');
      await this.tuiController.waitForContinue();
      await this.tuiController.navigateToScreen(constants.SCREEN_IDS.MODELS_LIST);
      return;
    }

    await this.updateModel(providerName, modelId, answers);
  }

  async saveModel(data) {
    const spinner = this.tuiController.showSpinner('Saving model...');

    try {
      this.tuiController.modelManager.addModel(data.providerName, data);
      spinner.succeed(`Model "${data.id}" added successfully to provider "${data.providerName}"`);
    } catch (error) {
      spinner.fail(`Failed to add model: ${error.message}`);
    }

    await this.tuiController.waitForContinue();
    await this.tuiController.navigateToScreen(constants.SCREEN_IDS.MODELS_LIST);
  }

  async updateModel(providerName, modelId, data) {
    const spinner = this.tuiController.showSpinner('Updating model...');

    try {
      this.tuiController.modelManager.updateModel(providerName, modelId, data);
      spinner.succeed(`Model "${modelId}" updated successfully in provider "${providerName}"`);
    } catch (error) {
      spinner.fail(`Failed to update model: ${error.message}`);
    }

    await this.tuiController.waitForContinue();
    await this.tuiController.navigateToScreen(constants.SCREEN_IDS.MODELS_LIST);
  }
}

module.exports = ModelsAddEditScreen;