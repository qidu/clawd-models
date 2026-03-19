const inquirer = require('inquirer').default;
const chalk = require('chalk').default;
const Table = require('cli-table3');
const { constants } = require('../../../core');

class ApiTestScreen {
  constructor(tuiController) {
    this.tuiController = tuiController;
  }

  async render() {
    console.log(chalk.bold.cyan('\n🧪 API Testing'));
    console.log(chalk.gray('Test model API connections'));

    const choices = [
      { name: '🎯 Test Default Model', value: 'default' },
      { name: '📋 Test Specific Model', value: 'specific' },
      { name: '🔧 Test Provider Configuration', value: 'provider' },
      new inquirer.Separator(),
      { name: '🔙 Back to Main Menu', value: 'back' },
      { name: '❌ Exit', value: 'exit' }
    ];

    const { action } = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: 'API Testing Options',
        choices,
        pageSize: 10
      }
    ]);

    await this.handleAction(action);
  }

  async handleAction(action) {
    switch (action) {
      case 'default':
        await this.testDefaultModel();
        break;
      case 'specific':
        await this.testSpecificModel();
        break;
      case 'provider':
        await this.testProviderConfig();
        break;
      case 'back':
        await this.tuiController.navigateToScreen(constants.SCREEN_IDS.MAIN_MENU);
        break;
      case 'exit':
        await this.tuiController.exitApplication();
        break;
    }
  }

  async testDefaultModel() {
    console.log(chalk.bold.cyan('\n🎯 Testing Default Model'));

    const defaultModel = this.tuiController.agentManager.getDefaultModel();

    if (!defaultModel) {
      this.tuiController.showWarning('No Default Model', 'No default model configured. Set a default model first.');
      await this.tuiController.waitForContinue();
      await this.tuiController.navigateToScreen(constants.SCREEN_IDS.TEST_API);
      return;
    }

    console.log(chalk.gray(`Testing default model: ${defaultModel}`));

    const { confirm } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message: 'Send test request?',
        default: true
      }
    ]);

    if (!confirm) {
      await this.tuiController.navigateToScreen(constants.SCREEN_IDS.TEST_API);
      return;
    }

    await this.performTest(defaultModel, 'Default Model');
  }

  async testSpecificModel() {
    console.log(chalk.bold.cyan('\n📋 Testing Specific Model'));

    const models = this.tuiController.modelManager.listModels();

    if (models.length === 0) {
      this.tuiController.showError('No Models', 'No models available to test.');
      await this.tuiController.waitForContinue();
      await this.tuiController.navigateToScreen(constants.SCREEN_IDS.TEST_API);
      return;
    }

    const modelChoices = models.map(model => ({
      name: `${model.provider}/${model.id} (${model.name})`,
      value: `${model.provider}/${model.id}`
    }));

    modelChoices.push(new inquirer.Separator());
    modelChoices.push({ name: '🔙 Back', value: 'back' });

    const { selectedModel } = await inquirer.prompt([
      {
        type: 'list',
        name: 'selectedModel',
        message: 'Select model to test:',
        choices: modelChoices,
        pageSize: 15
      }
    ]);

    if (selectedModel === 'back') {
      await this.tuiController.navigateToScreen(constants.SCREEN_IDS.TEST_API);
      return;
    }

    console.log(chalk.gray(`Testing model: ${selectedModel}`));

    const { confirm } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message: 'Send test request?',
        default: true
      }
    ]);

    if (!confirm) {
      await this.tuiController.navigateToScreen(constants.SCREEN_IDS.TEST_API);
      return;
    }

    await this.performTest(selectedModel, 'Specific Model');
  }

  async testProviderConfig() {
    console.log(chalk.bold.cyan('\n🔧 Testing Provider Configuration'));

    const providers = this.tuiController.providerManager.listProviders();

    if (providers.length === 0) {
      this.tuiController.showError('No Providers', 'No providers available to test.');
      await this.tuiController.waitForContinue();
      await this.tuiController.navigateToScreen(constants.SCREEN_IDS.TEST_API);
      return;
    }

    const providerChoices = providers.map(provider => ({
      name: `${provider.name} (${provider.baseUrl})`,
      value: provider.name
    }));

    providerChoices.push(new inquirer.Separator());
    providerChoices.push({ name: '🔙 Back', value: 'back' });

    const { providerName } = await inquirer.prompt([
      {
        type: 'list',
        name: 'providerName',
        message: 'Select provider to test:',
        choices: providerChoices,
        pageSize: 15
      }
    ]);

    if (providerName === 'back') {
      await this.tuiController.navigateToScreen(constants.SCREEN_IDS.TEST_API);
      return;
    }

    const providerDetails = this.tuiController.providerManager.getProviderDetails(providerName);

    console.log(chalk.gray(`\nTesting provider: ${providerName}`));
    console.log(chalk.gray(`Base URL: ${providerDetails.baseUrl}`));
    console.log(chalk.gray(`API Type: ${providerDetails.api}`));
    console.log(chalk.gray(`Auth Method: ${providerDetails.auth}`));

    const { confirm } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message: 'Test provider configuration?',
        default: true
      }
    ]);

    if (!confirm) {
      await this.tuiController.navigateToScreen(constants.SCREEN_IDS.TEST_API);
      return;
    }

    await this.performProviderTest(providerName, providerDetails);
  }

  async performTest(modelId, testType) {
    const spinner = this.tuiController.showSpinner(`Testing ${testType}...`);

    try {
      const result = await this.tuiController.apiTester.testModel(modelId);

      spinner.stop();

      if (result.success) {
        console.log(chalk.green('\n✅ Test Successful!'));
        this.displayTestResults(result);
      } else {
        console.log(chalk.red('\n❌ Test Failed!'));
        console.log(chalk.red(`Error: ${result.error}`));
      }
    } catch (error) {
      spinner.fail('Test failed');
      console.log(chalk.red(`\nError: ${error.message}`));
    }

    // Show troubleshooting advice for 404 errors
    if (result?.response?.status === 404) {
      const advice = this.tuiController.apiTester.getTroubleshootingAdvice(result);
      if (advice) {
        console.log(chalk.yellow(advice));
      }
    }

    await this.tuiController.waitForContinue();
    await this.tuiController.navigateToScreen(constants.SCREEN_IDS.TEST_API);
  }

  async performProviderTest(providerName, providerDetails) {
    const spinner = this.tuiController.showSpinner('Testing provider configuration...');

    try {
      const result = await this.tuiController.apiTester.validateApiConfig(
        providerName,
        providerDetails.baseUrl,
        providerDetails.api,
        providerDetails.apiKey
      );

      spinner.stop();

      if (result.valid) {
        console.log(chalk.green('\n✅ Provider Configuration Valid!'));
        console.log(chalk.gray(`Endpoint: ${result.endpoint}`));
        console.log(chalk.gray(`Status: ${result.status} ${result.statusText}`));
      } else {
        console.log(chalk.red('\n❌ Provider Configuration Invalid!'));
        console.log(chalk.red(`Error: ${result.error}`));
      }
    } catch (error) {
      spinner.fail('Test failed');
      console.log(chalk.red(`\nError: ${error.message}`));
    }

    await this.tuiController.waitForContinue();
    await this.tuiController.navigateToScreen(constants.SCREEN_IDS.TEST_API);
  }

  displayTestResults(result) {
    console.log(chalk.bold('\n📊 Test Results:'));

    const table = new Table({
      head: [chalk.cyan('Property'), chalk.cyan('Value')],
      colWidths: [20, 60],
      style: { head: ['cyan'], border: ['gray'] }
    });

    table.push(
      ['Model', result.modelId],
      ['Provider', result.provider],
      ['Endpoint', result.endpoint],
      ['Status', this.getStatusColor(result.response.status)]
    );

    console.log(table.toString());

    // Display response details
    console.log(chalk.bold('\n📨 Response Details:'));

    const responseTable = new Table({
      head: [chalk.cyan('Header'), chalk.cyan('Value')],
      colWidths: [30, 50],
      style: { head: ['cyan'], border: ['gray'] }
    });

    for (const [key, value] of Object.entries(result.response.headers)) {
      responseTable.push([key, value]);
    }

    console.log(responseTable.toString());

    // Display response body (truncated if too long)
    console.log(chalk.bold('\n📝 Response Body:'));
    const bodyStr = JSON.stringify(result.response.body, null, 2);
    if (bodyStr.length > 500) {
      console.log(chalk.gray(bodyStr.substring(0, 500) + '...'));
      console.log(chalk.gray('(Response truncated for display)'));
    } else {
      console.log(chalk.gray(bodyStr));
    }
  }

  getStatusColor(status) {
    if (status >= 200 && status < 300) {
      return chalk.green(status.toString());
    } else if (status >= 400 && status < 500) {
      return chalk.yellow(status.toString());
    } else {
      return chalk.red(status.toString());
    }
  }
}

module.exports = ApiTestScreen;