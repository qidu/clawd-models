#!/usr/bin/env node

const TUIController = require('./index');

async function main() {
  try {
    const tui = new TUIController();
    await tui.run();
  } catch (error) {
    console.error('Fatal error:', error.message);
    process.exit(1);
  }
}

// Handle Ctrl+C gracefully
process.on('SIGINT', () => {
  console.log('\n\nExiting clawd-models TUI...');
  process.exit(0);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Run the TUI
if (require.main === module) {
  main();
}

module.exports = main;