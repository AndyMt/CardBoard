import fs from 'fs-extra';
import lockfile from 'lockfile';
import path from 'path';
import { BoardModel } from '../model/BoardModel';

export class JSONPersistence {
  private filePath: string;
  private lockPath: string;
  private backupDir: string;

  constructor(filePath: string = 'data/board.json') {
    this.filePath = path.resolve(filePath);
    this.lockPath = `${this.filePath}.lock`;
    this.backupDir = path.resolve('data/backups');
    this.ensureDataDirectory();
  }

  private ensureDataDirectory(): void {
    // Ensure data directory exists
    const dataDir = path.dirname(this.filePath);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    
    // Ensure backup directory exists
    if (!fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true });
    }
  }

  async saveBoard(board: BoardModel): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      // Acquire lock with 5 second timeout
      lockfile.lock(this.lockPath, { wait: 5000 }, async (lockErr) => {
        if (lockErr) {
          reject(new Error(`Could not acquire lock for saving board: ${lockErr.message}`));
          return;
        }
        
        try {
          // Save the board data
          await fs.writeJson(this.filePath, board, { spaces: 2 });
          resolve();
        } catch (writeErr) {
          reject(new Error(`Failed to save board: ${writeErr.message}`));
        } finally {
          // Always release the lock
          lockfile.unlock(this.lockPath, () => {});
        }
      });
    });
  }

  async loadBoard(): Promise<BoardModel> {
    return new Promise<BoardModel>((resolve, reject) => {
      // Acquire lock with 5 second timeout
      lockfile.lock(this.lockPath, { wait: 5000 }, async (lockErr) => {
        if (lockErr) {
          reject(new Error(`Could not acquire lock for loading board: ${lockErr.message}`));
          return;
        }
        
        try {
          // Check if file exists
          if (!await fs.pathExists(this.filePath)) {
            // Return default board if file doesn't exist
            resolve(this.createDefaultBoard());
            return;
          }
          
          // Load and parse the board data
          const data = await fs.readJson(this.filePath);
          resolve(this.createBoardFromData(data));
        } catch (readErr) {
          // If there's an error reading, return default board
          resolve(this.createDefaultBoard());
        } finally {
          // Always release the lock
          lockfile.unlock(this.lockPath, () => {});
        }
      });
    });
  }

  async createBackup(): Promise<void> {
    // Generate timestamp for backup file
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(this.backupDir, `board-${timestamp}.json`);
    
    try {
      // Copy current board file to backup location
      await fs.copy(this.filePath, backupPath);
    } catch (backupErr) {
      // If backup fails, just log the error but don't fail the operation
      console.error(`Failed to create backup: ${backupErr.message}`);
    }
  }

  private createDefaultBoard(): BoardModel {
    return {
      cards: [],
      groups: [],
      lastUpdated: new Date().toISOString()
    };
  }

  private createBoardFromData(data: any): BoardModel {
    return {
      cards: Array.isArray(data.cards) ? data.cards : [],
      groups: Array.isArray(data.groups) ? data.groups : [],
      lastUpdated: data.lastUpdated || new Date().toISOString()
    };
  }
}