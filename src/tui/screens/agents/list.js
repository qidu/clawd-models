const inquirer = require('inquirer').default;
const chalk = require('chalk').default;
const Table = require('cli-table3');
const { constants } = require('../../../core');

class AgentsListScreen {
  constructor(tuiController) {
    this.tuiController = tuiController;
  }

  async render() {
    const choices = [
      { name: '⚙️  Configure Agent Defaults', value: 'config' },
      { name: '🤖 Select Primary/Fallback Models', value: 'model-select' },
      { name: '➕ Add Agent', value: 'add' },
      { name: '✏️  Edit Agent', value: 'edit' },
      { name: '🗑️  Remove Agent', value: 'remove' },
      new inquirer.Separator(),
      { name: '🔙 Back to Main Menu', value: 'back' },
      { name: '❌ Exit', value: 'exit' }
    ];

    // Get agents list
    const agents = this.tuiController.agentManager.listAgents();
    const defaultModel = this.tuiController.agentManager.getDefaultModel();

    console.log(chalk.bold.cyan('\n👥 Agents Configuration'));

    if (defaultModel) {
      console.log(chalk.green(`✓ Default Model: ${defaultModel}`));
    } else {
      console.log(chalk.yellow('⚠️  No default model configured'));
    }

    if (agents.length === 0) {
      console.log(chalk.yellow('\nNo agents configured.'));
      console.log(chalk.gray('The main agent is always available.\n'));
    } else {
      this.displayAgentsTable(agents);
    }

    const { action } = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: 'Agents Management',
        choices,
        pageSize: 10
      }
    ]);

    await this.handleAction(action);
  }

  displayAgentsTable(agents) {
    const table = new Table({
      head: [
        chalk.cyan('ID'),
        chalk.cyan('Name'),
        chalk.cyan('Model'),
        chalk.cyan('Workspace'),
        chalk.cyan('Agent Dir')
      ],
      colWidths: [15, 20, 30, 30, 30],
      style: { head: ['cyan'], border: ['gray'] }
    });

    agents.forEach(agent => {
      table.push([
        chalk.bold(agent.id === 'main' ? '📌 ' + agent.id : agent.id),
        agent.name || '-',
        agent.model || '-',
        agent.workspace || '-',
        agent.agentDir || '-'
      ]);
    });

    console.log(table.toString());
    console.log();
  }

  async handleAction(action) {
    switch (action) {
      case 'config':
        await this.tuiController.navigateToScreen(constants.SCREEN_IDS.AGENTS_CONFIG);
        break;
      case 'model-select':
        await this.tuiController.navigateToScreen(constants.SCREEN_IDS.AGENTS_MODEL_SELECT);
        break;
      case 'add':
        await this.promptAddAgent();
        break;
      case 'edit':
        await this.promptEditAgent();
        break;
      case 'remove':
        await this.promptRemoveAgent();
        break;
      case 'back':
        await this.tuiController.navigateToScreen(constants.SCREEN_IDS.MAIN_MENU);
        break;
      case 'exit':
        await this.tuiController.exitApplication();
        break;
    }
  }

  async promptAddAgent() {
    const questions = [
      {
        type: 'input',
        name: 'id',
        message: 'Agent ID:',
        validate: (input) => {
          if (!input || input.trim().length === 0) {
            return 'Agent ID is required';
          }
          if (input === 'main') {
            return '"main" is reserved for the default agent';
          }
          try {
            this.tuiController.agentManager.validateAgentId(input, true);
            return true;
          } catch (error) {
            return error.message;
          }
        }
      },
      {
        type: 'input',
        name: 'name',
        message: 'Display name (optional):'
      },
      {
        type: 'input',
        name: 'model',
        message: 'Model ID (provider/model-id, optional):',
        validate: (input) => {
          if (!input || input.trim().length === 0) {
            return true; // Optional
          }
          try {
            this.tuiController.agentManager.validateModelId(input);
            return true;
          } catch (error) {
            return error.message;
          }
        }
      },
      {
        type: 'input',
        name: 'workspace',
        message: 'Workspace directory (optional):'
      },
      {
        type: 'input',
        name: 'agentDir',
        message: 'Agent directory (optional):'
      },
      {
        type: 'confirm',
        name: 'confirm',
        message: 'Create this agent?',
        default: true
      }
    ];

    const answers = await inquirer.prompt(questions);

    if (!answers.confirm) {
      this.tuiController.showInfo('Cancelled', 'Agent creation cancelled.');
      await this.tuiController.waitForContinue();
      await this.tuiController.navigateToScreen(constants.SCREEN_IDS.AGENTS_LIST);
      return;
    }

    await this.saveAgent(answers);
  }

  async promptEditAgent() {
    const agents = this.tuiController.agentManager.listAgents();

    if (agents.length === 0) {
      this.tuiController.showWarning('No Agents', 'No agents available to edit.');
      await this.tuiController.waitForContinue();
      await this.tuiController.navigateToScreen(constants.SCREEN_IDS.AGENTS_LIST);
      return;
    }

    const agentChoices = agents.map(a => ({
      name: `${a.id}${a.name ? ` (${a.name})` : ''}`,
      value: a.id
    }));

    agentChoices.push(new inquirer.Separator());
    agentChoices.push({ name: '🔙 Back', value: 'back' });

    const { agentId } = await inquirer.prompt([
      {
        type: 'list',
        name: 'agentId',
        message: 'Select agent to edit:',
        choices: agentChoices,
        pageSize: 15
      }
    ]);

    if (agentId === 'back') {
      await this.tuiController.navigateToScreen(constants.SCREEN_IDS.AGENTS_LIST);
      return;
    }

    await this.editAgent(agentId);
  }

  async promptRemoveAgent() {
    const agents = this.tuiController.agentManager.listAgents();

    // Filter out main agent
    const removableAgents = agents.filter(a => a.id !== 'main');

    if (removableAgents.length === 0) {
      this.tuiController.showWarning('No Agents', 'No agents available to remove (main agent cannot be removed).');
      await this.tuiController.waitForContinue();
      await this.tuiController.navigateToScreen(constants.SCREEN_IDS.AGENTS_LIST);
      return;
    }

    const agentChoices = removableAgents.map(a => ({
      name: `${a.id}${a.name ? ` (${a.name})` : ''}`,
      value: a.id
    }));

    agentChoices.push(new inquirer.Separator());
    agentChoices.push({ name: '🔙 Back', value: 'back' });

    const { agentId } = await inquirer.prompt([
      {
        type: 'list',
        name: 'agentId',
        message: 'Select agent to remove:',
        choices: agentChoices,
        pageSize: 15
      }
    ]);

    if (agentId === 'back') {
      await this.tuiController.navigateToScreen(constants.SCREEN_IDS.AGENTS_LIST);
      return;
    }

    await this.removeAgent(agentId);
  }

  async editAgent(agentId) {
    const agentDetails = this.tuiController.agentManager.getAgentDetails(agentId);

    const questions = [
      {
        type: 'input',
        name: 'name',
        message: 'Display name:',
        default: agentDetails.name || ''
      },
      {
        type: 'input',
        name: 'model',
        message: 'Model ID (provider/model-id):',
        default: agentDetails.model || '',
        validate: (input) => {
          if (!input || input.trim().length === 0) {
            return true; // Optional
          }
          try {
            this.tuiController.agentManager.validateModelId(input);
            return true;
          } catch (error) {
            return error.message;
          }
        }
      },
      {
        type: 'input',
        name: 'workspace',
        message: 'Workspace directory:',
        default: agentDetails.workspace || ''
      },
      {
        type: 'input',
        name: 'agentDir',
        message: 'Agent directory:',
        default: agentDetails.agentDir || ''
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
      this.tuiController.showInfo('Cancelled', 'Agent update cancelled.');
      await this.tuiController.waitForContinue();
      await this.tuiController.navigateToScreen(constants.SCREEN_IDS.AGENTS_LIST);
      return;
    }

    const spinner = this.tuiController.showSpinner('Updating agent...');

    try {
      this.tuiController.agentManager.updateAgent(agentId, answers);
      spinner.succeed(`Agent "${agentId}" updated successfully`);
    } catch (error) {
      spinner.fail(`Failed to update agent: ${error.message}`);
    }

    await this.tuiController.waitForContinue();
    await this.tuiController.navigateToScreen(constants.SCREEN_IDS.AGENTS_LIST);
  }

  async saveAgent(data) {
    const spinner = this.tuiController.showSpinner('Creating agent...');

    try {
      this.tuiController.agentManager.addAgent(data);
      spinner.succeed(`Agent "${data.id}" created successfully`);
    } catch (error) {
      spinner.fail(`Failed to create agent: ${error.message}`);
    }

    await this.tuiController.waitForContinue();
    await this.tuiController.navigateToScreen(constants.SCREEN_IDS.AGENTS_LIST);
  }

  async removeAgent(agentId) {
    const agentDetails = this.tuiController.agentManager.getAgentDetails(agentId);

    console.log(chalk.yellow('\n⚠️  Agent Details:'));
    console.log(chalk.gray(`ID: ${agentId}`));
    if (agentDetails.name) console.log(chalk.gray(`Name: ${agentDetails.name}`));
    if (agentDetails.model) console.log(chalk.gray(`Model: ${agentDetails.model}`));
    if (agentDetails.workspace) console.log(chalk.gray(`Workspace: ${agentDetails.workspace}`));
    if (agentDetails.agentDir) console.log(chalk.gray(`Agent Dir: ${agentDetails.agentDir}`));

    const { confirm } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message: chalk.red('Are you sure you want to remove this agent?'),
        default: false
      }
    ]);

    if (!confirm) {
      this.tuiController.showInfo('Cancelled', 'Agent removal cancelled.');
      await this.tuiController.waitForContinue();
      await this.tuiController.navigateToScreen(constants.SCREEN_IDS.AGENTS_LIST);
      return;
    }

    const spinner = this.tuiController.showSpinner('Removing agent...');

    try {
      this.tuiController.agentManager.removeAgent(agentId);
      spinner.succeed(`Agent "${agentId}" removed successfully`);
    } catch (error) {
      spinner.fail(`Failed to remove agent: ${error.message}`);
    }

    await this.tuiController.waitForContinue();
    await this.tuiController.navigateToScreen(constants.SCREEN_IDS.AGENTS_LIST);
  }
}

module.exports = AgentsListScreen;