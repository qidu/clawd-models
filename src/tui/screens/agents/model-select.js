const inquirer = require('inquirer').default;
const chalk = require('chalk').default;
const Table = require('cli-table3');
const { constants } = require('../../../core');

class AgentsModelSelectScreen {
  constructor(tuiController) {
    this.tuiController = tuiController;
  }

  async render() {
    console.log(chalk.bold.cyan('\n🤖 Model Selection'));
    console.log(chalk.gray('Select primary and fallback models for agents'));

    // Get current configuration
    const defaultModel = this.tuiController.agentManager.getDefaultModel();
    const fallbackModels = this.tuiController.agentManager.getFallbackModels();
    const availableModels = this.tuiController.agentManager.getAvailableModels();

    if (availableModels.length === 0) {
      this.tuiController.showError('No Models', 'No models available. Add models first.');
      await this.tuiController.waitForContinue();
      await this.tuiController.navigateToScreen(constants.SCREEN_IDS.AGENTS_LIST);
      return;
    }

    // Display current configuration
    console.log(chalk.bold('\n📋 Current Configuration:'));
    if (defaultModel) {
      console.log(chalk.green(`✓ Primary Model: ${defaultModel}`));
    } else {
      console.log(chalk.yellow('⚠️  No primary model selected'));
    }

    if (fallbackModels.length > 0) {
      console.log(chalk.cyan(`✓ Fallback Models: ${fallbackModels.length}`));
      fallbackModels.forEach((model, index) => {
        console.log(chalk.gray(`  ${index + 1}. ${model}`));
      });
    } else {
      console.log(chalk.yellow('⚠️  No fallback models configured'));
    }

    const choices = [
      { name: '🎯 Select Primary Model', value: 'primary' },
      { name: '🔄 Configure Fallback Models', value: 'fallback' },
      { name: '🧪 Test Current Configuration', value: 'test' },
      new inquirer.Separator(),
      { name: '🔙 Back to Agents', value: 'back' },
      { name: '❌ Exit', value: 'exit' }
    ];

    const { action } = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: 'Model Selection',
        choices,
        pageSize: 10
      }
    ]);

    await this.handleAction(action, availableModels, defaultModel, fallbackModels);
  }

  async handleAction(action, availableModels, defaultModel, fallbackModels) {
    switch (action) {
      case 'primary':
        await this.selectPrimaryModel(availableModels, defaultModel);
        break;
      case 'fallback':
        await this.configureFallbackModels(availableModels, defaultModel, fallbackModels);
        break;
      case 'test':
        await this.testConfiguration();
        break;
      case 'back':
        await this.tuiController.navigateToScreen(constants.SCREEN_IDS.AGENTS_LIST);
        break;
      case 'exit':
        await this.tuiController.exitApplication();
        break;
    }
  }

  async selectPrimaryModel(availableModels, currentDefault) {
    console.log(chalk.bold.cyan('\n🎯 Select Primary Model'));
    console.log(chalk.gray('Choose the default model for the main agent'));

    const modelChoices = availableModels.map(model => ({
      name: model.name,
      value: model.value
    }));

    modelChoices.push(new inquirer.Separator());
    modelChoices.push({ name: '🔙 Back', value: 'back' });

    const { selectedModel } = await inquirer.prompt([
      {
        type: 'list',
        name: 'selectedModel',
        message: 'Select primary model:',
        choices: modelChoices,
        pageSize: 15,
        default: currentDefault
      }
    ]);

    if (selectedModel === 'back') {
      await this.tuiController.navigateToScreen(constants.SCREEN_IDS.AGENTS_MODEL_SELECT);
      return;
    }

    const spinner = this.tuiController.showSpinner('Setting primary model...');

    try {
      this.tuiController.agentManager.setDefaultModel(selectedModel);
      spinner.succeed(`Primary model set to: ${selectedModel}`);
    } catch (error) {
      spinner.fail(`Failed to set primary model: ${error.message}`);
    }

    await this.tuiController.waitForContinue();
    await this.tuiController.navigateToScreen(constants.SCREEN_IDS.AGENTS_MODEL_SELECT);
  }

  async configureFallbackModels(availableModels, primaryModel, currentFallbacks) {
    console.log(chalk.bold.cyan('\n🔄 Configure Fallback Models'));
    console.log(chalk.gray('Select models to use as fallbacks (in order of preference)'));

    if (!primaryModel) {
      this.tuiController.showWarning('No Primary Model', 'Set a primary model first.');
      await this.tuiController.waitForContinue();
      await this.tuiController.navigateToScreen(constants.SCREEN_IDS.AGENTS_MODEL_SELECT);
      return;
    }

    // Filter out the primary model from available models
    const availableForFallback = availableModels.filter(
      model => model.value !== primaryModel
    );

    if (availableForFallback.length === 0) {
      this.tuiController.showWarning('No Models Available', 'No other models available for fallback.');
      await this.tuiController.waitForContinue();
      await this.tuiController.navigateToScreen(constants.SCREEN_IDS.AGENTS_MODEL_SELECT);
      return;
    }

    const modelChoices = availableForFallback.map(model => ({
      name: model.name,
      value: model.value,
      checked: currentFallbacks.includes(model.value)
    }));

    const { selectedModels } = await inquirer.prompt([
      {
        type: 'checkbox',
        name: 'selectedModels',
        message: 'Select fallback models (use space to select, enter to confirm):',
        choices: modelChoices,
        pageSize: 15
      }
    ]);

    const { confirm } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message: `Set ${selectedModels.length} fallback model(s)?`,
        default: true
      }
    ]);

    if (!confirm) {
      this.tuiController.showInfo('Cancelled', 'Fallback configuration cancelled.');
      await this.tuiController.waitForContinue();
      await this.tuiController.navigateToScreen(constants.SCREEN_IDS.AGENTS_MODEL_SELECT);
      return;
    }

    const spinner = this.tuiController.showSpinner('Setting fallback models...');

    try {
      this.tuiController.agentManager.setFallbackModels(selectedModels);
      spinner.succeed(`Set ${selectedModels.length} fallback model(s)`);
    } catch (error) {
      spinner.fail(`Failed to set fallback models: ${error.message}`);
    }

    await this.tuiController.waitForContinue();
    await this.tuiController.navigateToScreen(constants.SCREEN_IDS.AGENTS_MODEL_SELECT);
  }

  async testConfiguration() {
    const defaultModel = this.tuiController.agentManager.getDefaultModel();

    if (!defaultModel) {
      this.tuiController.showWarning('No Configuration', 'No primary model configured to test.');
      await this.tuiController.waitForContinue();
      await this.tuiController.navigateToScreen(constants.SCREEN_IDS.AGENTS_MODEL_SELECT);
      return;
    }

    console.log(chalk.bold.cyan('\n🧪 Testing Configuration'));
    console.log(chalk.gray(`Testing primary model: ${defaultModel}`));

    const { confirm } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message: 'Send test request to primary model?',
        default: true
      }
    ]);

    if (!confirm) {
      await this.tuiController.navigateToScreen(constants.SCREEN_IDS.AGENTS_MODEL_SELECT);
      return;
    }

    const spinner = this.tuiController.showSpinner('Testing model...');

    try {
      const result = await this.tuiController.apiTester.testModel(defaultModel);

      if (result.success) {
        spinner.succeed('Test successful!');
        console.log(chalk.green(`\n✓ Model: ${result.modelId}`));
        console.log(chalk.green(`✓ Provider: ${result.provider}`));
        console.log(chalk.green(`✓ Status: ${result.response.status}`));

        if (result.response.status === 200) {
          console.log(chalk.green('✓ API endpoint is working correctly'));
        } else {
          console.log(chalk.yellow(`⚠️  API returned status: ${result.response.status}`));
        }
      } else {
        spinner.fail('Test failed');
        console.log(chalk.red(`\n✗ Error: ${result.error}`));
      }
    } catch (error) {
      spinner.fail('Test failed');
      console.log(chalk.red(`\n✗ Error: ${error.message}`));
    }

    await this.tuiController.waitForContinue();
    await this.tuiController.navigateToScreen(constants.SCREEN_IDS.AGENTS_MODEL_SELECT);
  }
}

module.exports = AgentsModelSelectScreen;