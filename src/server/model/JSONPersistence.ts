import fs from 'fs-extra';
import lockfile from 'lockfile';
import { Board } from '../../types/Board.js';
import type { View } from '../../types/View.js';
import type { Reference } from '../../types/Reference.js';

export class JSONPersistence {
  private filePath: string;
  private lockPath: string;

  constructor(filePath: string) {
    this.filePath = filePath;
    this.lockPath = `${filePath}.lock`;
  }

  async read(): Promise<Board> {
    try {
      return await fs.readJson(this.filePath);
    } catch (error) {
      return { elements: [], views: [], references: [] };
    }
  }

  async write(board: Board): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      lockfile.lock(this.lockPath, (err: Error | null) => {
        if (err) reject(err);
        else resolve();
      });
    });

    try {
      await fs.writeJson(this.filePath, board, { spaces: 2 });
    } finally {
      lockfile.unlock(this.lockPath, () => {});
    }
  }
}
