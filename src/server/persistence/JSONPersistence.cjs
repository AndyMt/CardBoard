const fs = require('fs-extra');
const path = require('path');

// Define the default board structure
const createDefaultBoard = () => ({
  cards: [],
  groups: [],
  lastUpdated: new Date().toISOString()
});

class JSONPersistence {
  constructor(filePath = 'data/board.json') {
    // Use absolute paths to ensure consistency
    this.filePath = path.resolve(process.cwd(), filePath);
    this.lockPath = `${this.filePath}.lock`;
    this.backupDir = path.resolve(process.cwd(), 'data/backups');
    this.lockTimeout = 5000; // 5 seconds lock timeout
    this.maxRetries = 3; // Maximum number of retries for lock acquisition
    
    // Initialize the persistence
    this.initialize();
  }

  async initialize() {
    try {
      // Ensure data directory exists
      await this.ensureDataDirectory();
      
      // Clean up any stale lock files
      await this.cleanupStaleLock();
      
      // Initialize the board file if it doesn't exist
      if (!await fs.pathExists(this.filePath)) {
        const defaultBoard = createDefaultBoard();
        await this.saveBoard(defaultBoard);
      }
    } catch (err) {
      console.error('Failed to initialize persistence:', err);
    }
  }

  async ensureDataDirectory() {
    try {
      // Ensure data directory exists
      const dataDir = path.dirname(this.filePath);
      if (!await fs.pathExists(dataDir)) {
        await fs.mkdir(dataDir, { recursive: true });
      }
      
      // Ensure backup directory exists
      if (!await fs.pathExists(this.backupDir)) {
        await fs.mkdir(this.backupDir, { recursive: true });
      }
    } catch (err) {
      console.error('Failed to create data directories:', err);
      throw err;
    }
  }

  async cleanupStaleLock() {
    try {
      // Check if lock file exists
      if (await fs.pathExists(this.lockPath)) {
        // Check if the lock is stale (older than 1 minute)
        const stats = await fs.stat(this.lockPath);
        const now = new Date();
        const age = now - stats.mtime;
        
        if (age > 60000) { // 1 minute
          console.log('Found stale lock file, removing it...');
          await fs.remove(this.lockPath);
        }
      }
    } catch (err) {
      console.error('Failed to cleanup stale lock:', err);
    }
  }

  async acquireLock(retryCount = 0) {
    return new Promise((resolve, reject) => {
      // Try to create the lock file exclusively
      fs.open(this.lockPath, 'wx', (err, fd) => {
        if (err) {
          if (err.code === 'EEXIST') {
            // Lock file already exists
            if (retryCount < this.maxRetries) {
              // Wait a bit and retry with exponential backoff
              const delay = Math.pow(2, retryCount) * 100;
              console.log(`Lock file exists, retrying in ${delay}ms... (attempt ${retryCount + 1}/${this.maxRetries})`);
              setTimeout(() => {
                this.acquireLock(retryCount + 1).then(resolve).catch(reject);
              }, delay);
            } else {
              // Max retries reached
              reject(new Error(`Could not acquire lock after ${this.maxRetries} attempts`));
            }
          } else {
            // Other error
            reject(new Error(`Failed to acquire lock: ${err.message}`));
          }
          return;
        }
        
        // Successfully acquired lock
        // Close the file descriptor but keep the file
        fs.close(fd, (closeErr) => {
          if (closeErr) {
            console.error('Warning: Failed to close lock file descriptor:', closeErr);
          }
          resolve();
        });
      });
    });
  }

  async releaseLock() {
    try {
      if (await fs.pathExists(this.lockPath)) {
        await fs.remove(this.lockPath);
      }
    } catch (err) {
      console.error('Failed to release lock:', err);
    }
  }

  async withLock(callback) {
    try {
      // Acquire lock with retry logic
      await this.acquireLock();
      
      // Execute the callback
      const result = await callback();
      
      // Return the result
      return result;
    } finally {
      // Always release the lock
      await this.releaseLock();
    }
  }

  async saveBoard(board) {
    return this.withLock(async () => {
      try {
        // Update lastUpdated timestamp
        const boardToSave = {
          ...board,
          lastUpdated: new Date().toISOString()
        };
        
        // Save the board data
        await fs.writeJson(this.filePath, boardToSave, { spaces: 2 });
        
        // Create a backup
        await this.createBackup();
      } catch (writeErr) {
        console.error(`Failed to save board: ${writeErr.message}`);
        throw new Error(`Failed to save board: ${writeErr.message}`);
      }
    });
  }

  async loadBoard() {
    return this.withLock(async () => {
      try {
        // Check if file exists
        if (!await fs.pathExists(this.filePath)) {
          // Return default board if file doesn't exist
          const defaultBoard = createDefaultBoard();
          // Save the default board for future use
          await this.saveBoard(defaultBoard);
          return defaultBoard;
        }
        
        // Load and parse the board data
        const data = await fs.readJson(this.filePath);
        return this.createBoardFromData(data);
      } catch (readErr) {
        console.error(`Failed to load board: ${readErr.message}`);
        // If there's an error reading, return default board
        const defaultBoard = createDefaultBoard();
        // Save the default board for future use
        await this.saveBoard(defaultBoard);
        return defaultBoard;
      }
    });
  }

  async createBackup() {
    try {
      // Generate timestamp for backup file
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupPath = path.join(this.backupDir, `board-${timestamp}.json`);
      
      // Check if the main file exists before creating backup
      if (await fs.pathExists(this.filePath)) {
        // Copy current board file to backup location
        await fs.copy(this.filePath, backupPath);
      }
    } catch (backupErr) {
      // If backup fails, just log the error but don't fail the operation
      console.error(`Failed to create backup: ${backupErr.message}`);
    }
  }

  createBoardFromData(data) {
    return {
      cards: Array.isArray(data.cards) ? data.cards : [],
      groups: Array.isArray(data.groups) ? data.groups : [],
      lastUpdated: data.lastUpdated || new Date().toISOString()
    };
  }
}

module.exports = { JSONPersistence, createDefaultBoard };