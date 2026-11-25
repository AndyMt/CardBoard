import fs from 'fs-extra';
import lockfile from 'lockfile';
import path from 'path';
import { BoardModel } from '../model/BoardModel.js';
import type { Card } from '../../types/Card.js';
import type { Group } from '../../types/Group.js';
import type { View } from '../../types/View.js';
import type { Reference } from '../../types/Reference.js';
import { quantizeGeometry } from '../../shared/geometry.js';

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
    cards: [],
    groups: [],
    views: [defaultView, functionalView],
    references: [],
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
    const legacyCards = Array.isArray(data.cards) ? data.cards : [];
    const legacyGroups = Array.isArray(data.groups) ? data.groups : [];

    // If views/references already present, use them as-is (quantized).
    if (Array.isArray(data.views) && Array.isArray(data.references)) {
      const cards = legacyCards.map((card: any) => quantizeGeometry(card)) as Card[];
      const groups = legacyGroups.map((group: any) => quantizeGeometry(group)) as Group[];
      const views = data.views as View[];
      const references = data.references.map((ref: any) => quantizeGeometry(ref)) as Reference[];
      return {
        cards,
        groups,
        views,
        references,
        lastUpdated: data.lastUpdated || new Date().toISOString(),
      };
    }

    // Legacy migration: no views/references. Build default Usecase view + one
    // reference per legacy card/group, preserving legacy x/y/width/height/groupId.
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
    const views: View[] = [defaultView, functionalView];

    const cards: Card[] = legacyCards.map((card: any) => ({
      id: card.id || `card-${Date.now()}`,
      text: card.text ?? '',
      createdBy: card.createdBy,
      createdColor: card.createdColor,
      connections: card.connections,
    })) as Card[];
    const groups: Group[] = legacyGroups.map((group: any) => ({
      id: group.id || `group-${Date.now()}`,
      label: group.label ?? '',
      createdBy: group.createdBy,
      createdColor: group.createdColor,
    })) as Group[];

    const references: Reference[] = [];
    let refSeq = Date.now();
    for (const card of cards) {
      const src = legacyCards.find((c: any) => c.id === card.id) || {};
      references.push({
        id: `ref-${refSeq++}`,
        elementId: card.id,
        elementType: 'card',
        x: src.x ?? 0,
        y: src.y ?? 0,
        width: src.width,
        height: src.height,
        viewId: defaultView.id,
        groupId: src.groupId,
      });
    }
    for (const group of groups) {
      const src = legacyGroups.find((g: any) => g.id === group.id) || {};
      references.push({
        id: `ref-${refSeq++}`,
        elementId: group.id,
        elementType: 'group',
        x: src.x ?? 0,
        y: src.y ?? 0,
        width: src.width,
        height: src.height,
        viewId: defaultView.id,
      });
    }

    return {
      cards,
      groups,
      views,
      references,
      lastUpdated: data.lastUpdated || new Date().toISOString(),
    };
  }
}
