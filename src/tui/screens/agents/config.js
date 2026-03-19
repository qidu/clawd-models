const inquirer = require('inquirer').default;
const chalk = require('chalk').default;
const path = require('path');
const os = require('os');
const { constants } = require('../../../core');

class AgentsConfigScreen {
  constructor(tuiController) {
    this.tuiController = tuiController;
  }

  async render() {
    console.log(chalk.bold.cyan('\n⚙️  Agent Configuration'));
    console.log(chalk.gray('Configure default settings for agents'));

    const agents = this.tuiController.agentManager.listAgents();
    const mainAgent = agents.find(a => a.id === 'main');

    if (!mainAgent) {
      this.tuiController.showError('Configuration Error', 'Main agent not found in configuration.');
      await this.tuiController.waitForContinue();
      await this.tuiController.navigateToScreen(constants.SCREEN_IDS.AGENTS_LIST);
      return;
    }

    const questions = [
      {
        type: 'input',
        name: 'workspace',
        message: 'Workspace directory for main agent:',
        default: mainAgent.workspace || path.join(os.homedir(), '.openclaw', 'workspace')
      },
      {
        type: 'input',
        name: 'maxConcurrent',
        message: 'Max concurrent tasks for main agent:',
        default: (mainAgent.maxConcurrent || 4).toString(),
        validate: (input) => {
          const num = parseInt(input);
          if (isNaN(num) || num < 1) {
            return 'Must be a positive number';
          }
          return true;
        }
      },
      {
        type: 'input',
        name: 'subagentsConcurrent',
        message: 'Max concurrent subagents for main agent:',
        default: (mainAgent.subagents?.maxConcurrent || 8).toString(),
        validate: (input) => {
          const num = parseInt(input);
          if (isNaN(num) || num < 1) {
            return 'Must be a positive number';
          }
          return true;
        }
      },
      {
        type: 'confirm',
        name: 'confirm',
        message: 'Save configuration?',
        default: true
      }
    ];

    const answers = await inquirer.prompt(questions);

    if (!answers.confirm) {
      this.tuiController.showInfo('Cancelled', 'Configuration update cancelled.');
      await this.tuiController.waitForContinue();
      await this.tuiController.navigateToScreen(constants.SCREEN_IDS.AGENTS_LIST);
      return;
    }

    const spinner = this.tuiController.showSpinner('Saving configuration...');

    try {
      // Update workspace
      this.tuiController.agentManager.setAgentWorkspace('main', answers.workspace);

      // Update concurrency limits
      this.tuiController.agentManager.setAgentConcurrency('main',
        parseInt(answers.maxConcurrent),
        parseInt(answers.subagentsConcurrent)
      );

      spinner.succeed('Agent configuration updated successfully');
    } catch (error) {
      spinner.fail(`Failed to update configuration: ${error.message}`);
    }

    await this.tuiController.waitForContinue();
    await this.tuiController.navigateToScreen(constants.SCREEN_IDS.AGENTS_LIST);
  }
}

module.exports = AgentsConfigScreen;