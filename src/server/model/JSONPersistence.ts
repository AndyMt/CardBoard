import fs from 'fs-extra';
import lockfile from 'lockfile';
import { Board } from '@/types/Board';

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
      // Return empty board if file doesn't exist
      return { cards: [], groups: [], groupCards: [] };
    }
  }

  async write(board: Board): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      lockfile.lock(this.lockPath, (err) => {
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