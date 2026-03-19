const inquirer = require('inquirer').default;
const chalk = require('chalk').default;
const Table = require('cli-table3');
const { constants } = require('../../../core');

class ModelsListScreen {
  constructor(tuiController) {
    this.tuiController = tuiController;
  }

  async render() {
    const choices = [
      { name: '➕ Add Model', value: 'add' },
      { name: '✏️  Edit Model', value: 'edit' },
      { name: '🗑️  Remove Model', value: 'remove' },
      new inquirer.Separator(),
      { name: '🔙 Back to Main Menu', value: 'back' },
      { name: '❌ Exit', value: 'exit' }
    ];

    // Get models list
    const models = this.tuiController.modelManager.listModels();

    if (models.length === 0) {
      console.log(chalk.yellow('\nNo models configured.'));
      console.log(chalk.gray('Add a model to get started.\n'));
    } else {
      this.displayModelsTable(models);
    }

    const { action } = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: 'Models Management',
        choices,
        pageSize: 10
      }
    ]);

    await this.handleAction(action);
  }

  displayModelsTable(models) {
    console.log('\n' + chalk.bold.cyan('🤖 Configured Models'));

    const table = new Table({
      head: [
        chalk.cyan('Provider'),
        chalk.cyan('Model ID'),
        chalk.cyan('Name'),
        chalk.cyan('API'),
        chalk.cyan('Reasoning'),
        chalk.cyan('Input Types')
      ],
      colWidths: [15, 30, 25, 20, 10, 20],
      style: { head: ['cyan'], border: ['gray'] }
    });

    models.forEach(model => {
      table.push([
        chalk.bold(model.provider),
        model.id,
        model.name,
        model.api,
        model.reasoning ? chalk.green('✓') : chalk.red('✗'),
        model.input.join(', ')
      ]);
    });

    console.log(table.toString());
    console.log();
  }

  async handleAction(action) {
    switch (action) {
      case 'add':
        await this.tuiController.navigateToScreen(constants.SCREEN_IDS.MODELS_ADD);
        break;
      case 'edit':
        await this.promptEditModel();
        break;
      case 'remove':
        await this.tuiController.navigateToScreen(constants.SCREEN_IDS.MODELS_REMOVE);
        break;
      case 'back':
        await this.tuiController.navigateToScreen(constants.SCREEN_IDS.MAIN_MENU);
        break;
      case 'exit':
        await this.tuiController.exitApplication();
        break;
    }
  }

  async promptEditModel() {
    const models = this.tuiController.modelManager.listModels();

    if (models.length === 0) {
      this.tuiController.showWarning('No Models', 'No models available to edit.');
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
        message: 'Select model to edit:',
        choices: modelChoices,
        pageSize: 15
      }
    ]);

    if (selected === 'back') {
      await this.tuiController.navigateToScreen(constants.SCREEN_IDS.MODELS_LIST);
      return;
    }

    await this.tuiController.navigateToScreen(constants.SCREEN_IDS.MODELS_EDIT, {
      providerName: selected.provider,
      modelId: selected.modelId
    });
  }
}

module.exports = ModelsListScreen;