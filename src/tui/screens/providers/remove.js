const inquirer = require('inquirer').default;
const chalk = require('chalk').default;
const { constants } = require('../../../core');

class ProvidersRemoveScreen {
  constructor(tuiController) {
    this.tuiController = tuiController;
  }

  async render() {
    console.log(chalk.bold.cyan('\nRemove Provider'));
    console.log(chalk.gray('Remove a model provider from configuration'));

    const providers = this.tuiController.providerManager.listProviders();

    if (providers.length === 0) {
      this.tuiController.showWarning('No Providers', 'No providers available to remove.');
      await this.tuiController.waitForContinue();
      await this.tuiController.navigateToScreen(constants.SCREEN_IDS.PROVIDERS_LIST);
      return;
    }

    const providerChoices = providers.map(p => ({
      name: `${p.name} (${p.baseUrl}) - ${p.modelCount} models`,
      value: p.name
    }));

    providerChoices.push(new inquirer.Separator());
    providerChoices.push({ name: '🔙 Back', value: 'back' });

    const { providerName } = await inquirer.prompt([
      {
        type: 'list',
        name: 'providerName',
        message: 'Select provider to remove:',
        choices: providerChoices,
        pageSize: 15
      }
    ]);

    if (providerName === 'back') {
      await this.tuiController.navigateToScreen(constants.SCREEN_IDS.PROVIDERS_LIST);
      return;
    }

    await this.confirmRemove(providerName);
  }

  async confirmRemove(providerName) {
    const providerDetails = this.tuiController.providerManager.getProviderDetails(providerName);

    console.log(chalk.yellow('\n⚠️  Provider Details:'));
    console.log(chalk.gray(`Name: ${providerName}`));
    console.log(chalk.gray(`Base URL: ${providerDetails.baseUrl}`));
    console.log(chalk.gray(`API: ${providerDetails.api}`));
    console.log(chalk.gray(`Models: ${providerDetails.models.length}`));

    if (providerDetails.models.length > 0) {
      console.log(chalk.red('\n⚠️  Warning: This provider has models configured!'));
      console.log(chalk.gray('Removing the provider will also remove all its models.'));

      console.log(chalk.gray('\nModels in this provider:'));
      providerDetails.models.forEach(model => {
        console.log(chalk.gray(`  ${model.id} (${model.name})`));
      });
    }

    const { confirm } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message: chalk.red('Are you sure you want to remove this provider?'),
        default: false
      }
    ]);

    if (!confirm) {
      this.tuiController.showInfo('Cancelled', 'Provider removal cancelled.');
      await this.tuiController.waitForContinue();
      await this.tuiController.navigateToScreen(constants.SCREEN_IDS.PROVIDERS_LIST);
      return;
    }

    await this.removeProvider(providerName);
  }

  async removeProvider(providerName) {
    const spinner = this.tuiController.showSpinner('Removing provider...');

    try {
      this.tuiController.providerManager.removeProvider(providerName);
      spinner.succeed(`Provider "${providerName}" removed successfully`);
    } catch (error) {
      spinner.fail(`Failed to remove provider: ${error.message}`);
    }

    await this.tuiController.waitForContinue();
    await this.tuiController.navigateToScreen(constants.SCREEN_IDS.PROVIDERS_LIST);
  }

  showSpinner(message) {
    return {
      start: () => console.log(chalk.cyan(`\n${message}`)),
      succeed: (msg) => console.log(chalk.green(`✓ ${msg}`)),
      fail: (msg) => console.log(chalk.red(`✗ ${msg}`))
    };
  }
}

module.exports = ProvidersRemoveScreen;