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

  private readBoardUnlocked(): BoardModel {
    if (!fs.existsSync(this.filePath)) {
      return createDefaultBoard();
    }
    const data = fs.readJsonSync(this.filePath);
    return this.createBoardFromData(data);
  }

  private writeBoardUnlocked(board: BoardModel): BoardModel {
    const boardToSave: BoardModel = {
      ...board,
      lastUpdated: new Date().toISOString()
    };
    fs.writeJsonSync(this.filePath, boardToSave, { spaces: 2 });
    return boardToSave;
  }

  async readBoard(): Promise<BoardModel> {
    try {
      await this.acquireLock();
      try {
        return this.readBoardUnlocked();
      } finally {
        this.releaseLock();
      }
    } catch (err) {
      console.error(`Failed to read board: ${(err as Error).message}`);
      return createDefaultBoard();
    }
  }

  async mutateBoard(mutator: (board: BoardModel) => BoardModel | void | Promise<BoardModel | void>): Promise<BoardModel> {
    await this.acquireLock();
    try {
      const current = this.readBoardUnlocked();
      const result = await mutator(current);
      const next = (result && typeof result === 'object' && 'cards' in result && 'groups' in result)
        ? result as BoardModel
        : current;
      return this.writeBoardUnlocked(next);
    } finally {
      this.releaseLock();
    }
  }

  async saveBoard(board: BoardModel): Promise<BoardModel> {
    try {
      await this.acquireLock();
      try {
        return this.writeBoardUnlocked(board);
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
      return await this.readBoard();
    } catch (readErr) {
      console.error(`Failed to load board: ${(readErr as Error).message}`);
      return createDefaultBoard();
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