import fs from 'fs-extra';
import lockfile from 'lockfile';
import path from 'path';
import { BoardModel } from '../model/BoardModel.js';
import type { Card } from '../../types/Card.js';
import type { Group } from '../../types/Group.js';
import type { View } from '../../types/View.js';
import type { Reference } from '../../types/Reference.js';
import { quantizeGeometry } from '../../shared/geometry.js';

const MIN_BUILD_NUMBER = '202611271545';

export const createDefaultBoard = (): BoardModel => {
  const defaultView: View = {
    id: `view-${Date.now()}`,
    name: 'Usecase',
    type: 'Usecase',
    isDefault: true,
  };
  const functionalView: View = {
    id: `view-${Date.now() + 1}`,
    name: 'Functional',
    type: 'Functional',
  };
  return {
    elements: [],
    views: [defaultView, functionalView],
    references: [],
    version: undefined,
    lastUpdated: new Date().toISOString(),
  };
};

/** Lock files older than this are considered stale (e.g. from a killed process). */
const STALE_LOCK_MS = 5000;
const LOCK_WAIT_MS = 5000;

export class JSONPersistence {
  private filePath: string;
  private lockPath: string;
  private backupDir: string;

  constructor(filePath: string = 'data/board.json') {
    this.filePath = path.resolve(process.cwd(), filePath);
    this.lockPath = `${this.filePath}.lock`;
    this.backupDir = path.resolve(process.cwd(), 'data/backups');
    this.ensureDataDirectory();
  }

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
      const dataDir = path.dirname(this.filePath);
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }
      if (!fs.existsSync(this.backupDir)) {
        fs.mkdirSync(this.backupDir, { recursive: true });
      }
    } catch (err) {
      console.error('Failed to create data directories:', err);
    }
  }

  private rejectBoard(reason: string): void {
    try {
      if (fs.existsSync(this.filePath)) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupPath = path.join(this.backupDir, `board-rejected-${timestamp}.json`);
        fs.moveSync(this.filePath, backupPath, { overwrite: true });
        console.log(`Rejected board (${reason}) moved to ${backupPath}`);
      }
    } catch (moveErr) {
      console.error(`Failed to move rejected board to backup: ${(moveErr as Error).message}`);
    }
  }

  private versionIsStale(version: string | undefined): boolean {
    if (!version) return true;
    const min = Number(MIN_BUILD_NUMBER);
    const current = Number(version);
    if (Number.isNaN(min) || Number.isNaN(current)) return false;
    return current < min;
  }

  private readBoardUnlocked(): BoardModel {
    if (!fs.existsSync(this.filePath)) {
      console.log(`Board file not found at ${this.filePath}; loading default empty board`);
      return createDefaultBoard();
    }
    const data = fs.readJsonSync(this.filePath);

    // Version gating: disregard boards with missing or stale version
    if (this.versionIsStale(data.version)) {
      this.rejectBoard(`version ${data.version ?? 'missing'} below MIN_BUILD_NUMBER ${MIN_BUILD_NUMBER}`);
      return createDefaultBoard();
    }

    return this.createBoardFromData(data);
  }

  private writeBoardUnlocked(board: BoardModel): BoardModel {
    const version = process.env.BUILD_NUMBER ?? board.version ?? '1';
    const boardToSave: BoardModel = {
      ...board,
      version,
      lastUpdated: new Date().toISOString(),
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
      console.error(`Failed to read board from ${this.filePath}: ${(err as Error).message}`);
      return createDefaultBoard();
    }
  }

  async mutateBoard(mutator: (board: BoardModel) => BoardModel | void | Promise<BoardModel | void>): Promise<BoardModel> {
    await this.acquireLock();
    try {
      const current = this.readBoardUnlocked();
      const result = await mutator(current);
      const next = (result && typeof result === 'object' && 'elements' in result)
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
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupPath = path.join(this.backupDir, `board-${timestamp}.json`);
      if (await fs.pathExists(this.filePath)) {
        await fs.copy(this.filePath, backupPath);
      }
    } catch (backupErr) {
      console.error(`Failed to create backup: ${(backupErr as Error).message}`);
    }
  }

  private createBoardFromData(data: any): BoardModel {

    // If views/references already present (new format), use them as-is.
    // Only run legacy migration when views are missing (old format: cards/groups
    // carried their own x/y/width/height/groupId).
    if (Array.isArray(data.views) && Array.isArray(data.references)) {
      const views = data.views as View[];
      const references = data.references.map((ref: any) => quantizeGeometry(ref)) as Reference[];
      const elements = Array.isArray(data.elements) ? data.elements : [];
      return {
        elements,
        views,
        references,
        version: data.version,
        lastUpdated: data.lastUpdated || new Date().toISOString(),
      };
    }

    if (!Array.isArray(data.views)) {
      // Legacy format (no views): strip unknown legacy attributes (x/y/width/height/groupId)
      // and create no references. Elements become pure model entries, invisible until
      // dragged from the model panel into a view.
      const defaultView: View = {
        id: 'view-usecase',
        name: 'Usecase',
        type: 'Usecase',
        isDefault: true,
      };
      const functionalView: View = {
        id: 'view-functional',
        name: 'Functional',
        type: 'Functional',
      };
      const views: View[] = [defaultView, functionalView];

      const elements = Array.isArray(data.elements) ? data.elements : [];
      return {
        elements,
        views,
        references: [],
        version: data.version,
        lastUpdated: data.lastUpdated || new Date().toISOString(),
      };
    }

    // Views exist but references missing: keep views, start with empty references.
    // Cards no longer carry geometry, so positions cannot be recovered.
    const elements = Array.isArray(data.elements) ? data.elements : [];
    return {
      elements,
      views: data.views as View[],
      references: [],
      version: data.version,
      lastUpdated: data.lastUpdated || new Date().toISOString(),
    };
  }
}
