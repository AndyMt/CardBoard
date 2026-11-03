// Simple logger utility
const logger = {
  log: (...args) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}]`, ...args);
  },
  
  selection: (message) => {
    logger.log('SELECTION:', message);
  },
  
  card: (message) => {
    logger.log('CARD:', message);
  },
  
  group: (message) => {
    logger.log('GROUP:', message);
  }
};

module.exports = logger;