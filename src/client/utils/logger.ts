// Client-side logger that sends logs to the server
const API_BASE_URL = '/api';

const logger = {
  log: async (type: string, message: string) => {
    try {
      await fetch(`${API_BASE_URL}/log`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ type, message }),
      });
    } catch (error) {
      // Fallback to console if server logging fails
      console.log(`[${type}] ${message}`);
    }
  },
  
  selection: (message: string) => {
    logger.log('selection', message);
  },
  
  card: (message: string) => {
    logger.log('card', message);
  },
  
  group: (message: string) => {
    logger.log('group', message);
  }
};

export default logger;