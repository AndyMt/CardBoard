import fs from 'fs-extra';
import lockfile from 'lockfile';
import path from 'path';
import { BoardModel } from '../model/BoardModel';
import { quantizeGeometry } from '../../shared/geometry.js';

// Define the default board structure
export const createDefaultBoard = (): BoardModel => ({
  cards: [],
  groups: [],
  lastUpdated: new Date().toISOString()
});

/** Lock files older than this are considered stale (e.g. from a killed process). */
const STALE_LOCK_MS = 5000;
const LOCK_WAIT_MS = 5000;

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

  /**
   * Remove a lock file that is older than the stale threshold. This keeps the
   * server alive after a hard kill (e.g. Ctrl+C mid-write) instead of blocking
   * on a lock that will never be released.
   */
  private clearStaleLock(): void {
    try {
      if (!fs.existsSync(this.lockPath)) return;
      const stats = fs.statSync(this.lockPath);
      const ageMs = Date.now() - stats.mtimeMs;
      if (ageMs > STALE_LOCK_MS) {
        fs.removeSync(this.lockPath);
      }
    } catch {
      // Best-effort; ignore errors
    }
  }

  private async acquireLock(): Promise<void> {
    this.clearStaleLock();
    await new Promise<void>((resolve, reject) => {
      lockfile.lock(this.lockPath, { wait: LOCK_WAIT_MS }, (lockErr) => {
        if (lockErr) {
          reject(new Error(`Could not acquire lock: ${lockErr.message}`));
          return;
        }
        resolve();
      });
    });
  }

  private releaseLock(): void {
    try {
      lockfile.unlockSync(this.lockPath);
    } catch (unlockErr) {
      console.error(`Failed to release lock: ${(unlockErr as Error).message}`);
    }
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
    try {
      await this.acquireLock();
      try {
        // Update lastUpdated timestamp
        const boardToSave = {
          ...board,
          lastUpdated: new Date().toISOString()
        };

        // Save the board data
        await fs.writeJson(this.filePath, boardToSave, { spaces: 2 });
      } finally {
        this.releaseLock();
      }
    } catch (err) {
      console.error(`Failed to save board: ${(err as Error).message}`);
      throw err;
    }
  }

  async loadBoard(): Promise<BoardModel> {
    try {
      await this.acquireLock();
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
      } finally {
        this.releaseLock();
      }
    } catch (readErr) {
      console.error(`Failed to load board: ${(readErr as Error).message}`);
      // If there's an error reading, return default board
      const defaultBoard = createDefaultBoard();
      try {
        await this.saveBoard(defaultBoard);
      } catch {
        // ignore
      }
      return defaultBoard;
    }
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
      console.error(`Failed to create backup: ${(backupErr as Error).message}`);
    }
  }

  private createBoardFromData(data: any): BoardModel {
    const cards = Array.isArray(data.cards) ? data.cards.map((card: any) => quantizeGeometry(card)) : [];
    const groups = Array.isArray(data.groups) ? data.groups.map((group: any) => quantizeGeometry(group)) : [];
    return {
      cards,
      groups,
      lastUpdated: data.lastUpdated || new Date().toISOString()
    };
  }
}