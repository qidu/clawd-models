const inquirer = require('inquirer').default;
const chalk = require('chalk').default;
const { constants } = require('../../../core');

class ModelsRemoveScreen {
  constructor(tuiController) {
    this.tuiController = tuiController;
  }

  async render() {
    console.log(chalk.bold.cyan('\nRemove Model'));
    console.log(chalk.gray('Remove a model from a provider'));

    const models = this.tuiController.modelManager.listModels();

    if (models.length === 0) {
      this.tuiController.showWarning('No Models', 'No models available to remove.');
      await this.tuiController.waitForContinue();
      await this.tuiController.navigateToScreen(constants.SCREEN_IDS.MODELS_LIST);
      return;
    }

    const modelChoices = models.map(m => ({
      name: `${m.provider}/${m.id} (${m.name})`,
      value: { provider: m.provider, modelId: m.id }
    }));

    modelChoices.push(new inquirer.Separator());
    modelChoices.push({ name: '🔙 Back', value: 'back' });

    const { selected } = await inquirer.prompt([
      {
        type: 'list',
        name: 'selected',
        message: 'Select model to remove:',
        choices: modelChoices,
        pageSize: 15
      }
    ]);

    if (selected === 'back') {
      await this.tuiController.navigateToScreen(constants.SCREEN_IDS.MODELS_LIST);
      return;
    }

    await this.confirmRemove(selected.provider, selected.modelId);
  }

  async confirmRemove(providerName, modelId) {
    const modelDetails = this.tuiController.modelManager.getModelDetails(providerName, modelId);

    console.log(chalk.yellow('\n⚠️  Model Details:'));
    console.log(chalk.gray(`Provider: ${providerName}`));
    console.log(chalk.gray(`Model ID: ${modelId}`));
    console.log(chalk.gray(`Name: ${modelDetails.name}`));
    console.log(chalk.gray(`API: ${modelDetails.api}`));
    console.log(chalk.gray(`Reasoning: ${modelDetails.reasoning ? 'Yes' : 'No'}`));
    console.log(chalk.gray(`Input Types: ${modelDetails.input.join(', ')}`));
    console.log(chalk.gray(`Context Window: ${modelDetails.contextWindow}`));
    console.log(chalk.gray(`Max Tokens: ${modelDetails.maxTokens}`));

    const { confirm } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message: chalk.red('Are you sure you want to remove this model?'),
        default: false
      }
    ]);

    if (!confirm) {
      this.tuiController.showInfo('Cancelled', 'Model removal cancelled.');
      await this.tuiController.waitForContinue();
      await this.tuiController.navigateToScreen(constants.SCREEN_IDS.MODELS_LIST);
      return;
    }

    await this.removeModel(providerName, modelId);
  }

  async removeModel(providerName, modelId) {
    const spinner = this.tuiController.showSpinner('Removing model...');

    try {
      this.tuiController.modelManager.removeModel(providerName, modelId);
      spinner.succeed(`Model "${modelId}" removed successfully from provider "${providerName}"`);
    } catch (error) {
      spinner.fail(`Failed to remove model: ${error.message}`);
    }

    await this.tuiController.waitForContinue();
    await this.tuiController.navigateToScreen(constants.SCREEN_IDS.MODELS_LIST);
  }
}

module.exports = ModelsRemoveScreen;