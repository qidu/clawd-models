const inquirer = require('inquirer').default;
const chalk = require('chalk').default;
const Table = require('cli-table3');
const { constants } = require('../../../core');

class ProvidersListScreen {
  constructor(tuiController) {
    this.tuiController = tuiController;
  }

  async render() {
    const choices = [
      { name: '➕ Add Provider', value: 'add' },
      { name: '✏️  Edit Provider', value: 'edit' },
      { name: '🗑️  Remove Provider', value: 'remove' },
      new inquirer.Separator(),
      { name: '🔙 Back to Main Menu', value: 'back' },
      { name: '❌ Exit', value: 'exit' }
    ];

    // Get providers list
    const providers = this.tuiController.providerManager.listProviders();

    if (providers.length === 0) {
      console.log(chalk.yellow('\nNo providers configured.'));
      console.log(chalk.gray('Add a provider to get started.\n'));
    } else {
      this.displayProvidersTable(providers);
    }

    const { action } = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: 'Providers Management',
        choices,
        pageSize: 10
      }
    ]);

    await this.handleAction(action);
  }

  displayProvidersTable(providers) {
    console.log('\n' + chalk.bold.cyan('📋 Configured Providers'));

    const table = new Table({
      head: [
        chalk.cyan('Name'),
        chalk.cyan('Base URL'),
        chalk.cyan('API'),
        chalk.cyan('Auth'),
        chalk.cyan('Models'),
        chalk.cyan('API Key')
      ],
      colWidths: [20, 40, 20, 15, 10, 15],
      style: { head: ['cyan'], border: ['gray'] }
    });

    providers.forEach(provider => {
      table.push([
        chalk.bold(provider.name),
        provider.baseUrl,
        provider.api,
        provider.auth,
        provider.modelCount.toString(),
        provider.hasApiKey ? chalk.green('✓') : chalk.red('✗')
      ]);
    });

    console.log(table.toString());
    console.log();
  }

  async handleAction(action) {
    switch (action) {
      case 'add':
        await this.tuiController.navigateToScreen(constants.SCREEN_IDS.PROVIDERS_ADD);
        break;
      case 'edit':
        await this.promptEditProvider();
        break;
      case 'remove':
        await this.tuiController.navigateToScreen(constants.SCREEN_IDS.PROVIDERS_REMOVE);
        break;
      case 'back':
        await this.tuiController.navigateToScreen(constants.SCREEN_IDS.MAIN_MENU);
        break;
      case 'exit':
        await this.tuiController.exitApplication();
        break;
    }
  }

  async promptEditProvider() {
    const providers = this.tuiController.providerManager.listProviders();

    if (providers.length === 0) {
      this.tuiController.showWarning('No Providers', 'No providers available to edit.');
      await this.tuiController.waitForContinue();
      await this.tuiController.navigateToScreen(constants.SCREEN_IDS.PROVIDERS_LIST);
      return;
    }

    const providerChoices = providers.map(p => ({
      name: `${p.name} (${p.baseUrl})`,
      value: p.name
    }));

    providerChoices.push(new inquirer.Separator());
    providerChoices.push({ name: '🔙 Back', value: 'back' });

    const { providerName } = await inquirer.prompt([
      {
        type: 'list',
        name: 'providerName',
        message: 'Select provider to edit:',
        choices: providerChoices,
        pageSize: 15
      }
    ]);

    if (providerName === 'back') {
      await this.tuiController.navigateToScreen(constants.SCREEN_IDS.PROVIDERS_LIST);
      return;
    }

    await this.tuiController.navigateToScreen(constants.SCREEN_IDS.PROVIDERS_EDIT, { providerName });
  }
}

module.exports = ProvidersListScreen;