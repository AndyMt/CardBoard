import fs from 'fs-extra';
import lockfile from 'lockfile';
import path from 'path';
import { BoardModel } from '../model/BoardModel';

// Define the default board structure
export const createDefaultBoard = (): BoardModel => ({
  cards: [],
  groups: [],
  lastUpdated: new Date().toISOString()
});

export class JSONPersistence {
  private filePath: string;
  private lockPath: string;
  private backupDir: string;

  constructor(filePath: string = 'data/board.json') {
    // Use absolute paths to ensure consistency
    this.filePath = path.resolve(process.cwd(), filePath);
    this.lockPath = `${this.filePath}.lock`;
    this.backupDir = path.resolve(process.cwd(), 'data/backups');
    this.ensureDataDirectory();
  }

  private ensureDataDirectory(): void {
    try {
      // Ensure data directory exists
      const dataDir = path.dirname(this.filePath);
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }
      
      // Ensure backup directory exists
      if (!fs.existsSync(this.backupDir)) {
        fs.mkdirSync(this.backupDir, { recursive: true });
      }
    } catch (err) {
      console.error('Failed to create data directories:', err);
    }
  }

  async saveBoard(board: BoardModel): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      // Acquire lock with 5 second timeout
      lockfile.lock(this.lockPath, { wait: 5000 }, async (lockErr) => {
        if (lockErr) {
          console.error(`Could not acquire lock for saving board: ${lockErr.message}`);
          reject(new Error(`Could not acquire lock for saving board: ${lockErr.message}`));
          return;
        }
        
        try {
          // Update lastUpdated timestamp
          const boardToSave = {
            ...board,
            lastUpdated: new Date().toISOString()
          };
          
          // Save the board data
          await fs.writeJson(this.filePath, boardToSave, { spaces: 2 });
          resolve();
        } catch (writeErr) {
          console.error(`Failed to save board: ${writeErr.message}`);
          reject(new Error(`Failed to save board: ${writeErr.message}`));
        } finally {
          // Always release the lock
          try {
            lockfile.unlockSync(this.lockPath);
          } catch (unlockErr) {
            console.error(`Failed to release lock: ${unlockErr.message}`);
          }
        }
      });
    });
  }

  async loadBoard(): Promise<BoardModel> {
    return new Promise<BoardModel>((resolve, reject) => {
      // Acquire lock with 5 second timeout
      lockfile.lock(this.lockPath, { wait: 5000 }, async (lockErr) => {
        if (lockErr) {
          console.error(`Could not acquire lock for loading board: ${lockErr.message}`);
          reject(new Error(`Could not acquire lock for loading board: ${lockErr.message}`));
          return;
        }
        
        try {
          // Check if file exists
          if (!await fs.pathExists(this.filePath)) {
            // Return default board if file doesn't exist
            const defaultBoard = createDefaultBoard();
            // Save the default board for future use
            await this.saveBoard(defaultBoard);
            resolve(defaultBoard);
            return;
          }
          
          // Load and parse the board data
          const data = await fs.readJson(this.filePath);
          resolve(this.createBoardFromData(data));
        } catch (readErr) {
          console.error(`Failed to load board: ${readErr.message}`);
          // If there's an error reading, return default board
          const defaultBoard = createDefaultBoard();
          // Save the default board for future use
          await this.saveBoard(defaultBoard);
          resolve(defaultBoard);
        } finally {
          // Always release the lock
          try {
            lockfile.unlockSync(this.lockPath);
          } catch (unlockErr) {
            console.error(`Failed to release lock: ${unlockErr.message}`);
          }
        }
      });
    });
  }

  async createBackup(): Promise<void> {
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

  private createBoardFromData(data: any): BoardModel {
    return {
      cards: Array.isArray(data.cards) ? data.cards : [],
      groups: Array.isArray(data.groups) ? data.groups : [],
      lastUpdated: data.lastUpdated || new Date().toISOString()
    };
  }
}