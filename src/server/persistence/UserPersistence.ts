import fs from 'fs-extra';
import lockfile from 'lockfile';
import path from 'path';
import { User } from '../../types/User.js';

export const createDefaultUsers = (): { users: User[] } => ({
  users: [],
});

export class UserPersistence {
  private filePath: string;
  private lockPath: string;

  private static readonly STALE_LOCK_MS = 5000;
  private static readonly LOCK_WAIT_MS = 5000;

  constructor(filePath: string = 'data/users.json') {
    this.filePath = path.resolve(process.cwd(), filePath);
    this.lockPath = `${this.filePath}.lock`;
    this.ensureDataDirectory();
  }

  private clearStaleLock(): void {
    try {
      if (!fs.existsSync(this.lockPath)) return;
      const stats = fs.statSync(this.lockPath);
      const ageMs = Date.now() - stats.mtimeMs;
      if (ageMs > UserPersistence.STALE_LOCK_MS) {
        fs.removeSync(this.lockPath);
      }
    } catch {
      // Best-effort; ignore errors
    }
  }

  private acquireLock(): Promise<void> {
    this.clearStaleLock();
    return new Promise<void>((resolve, reject) => {
      lockfile.lock(this.lockPath, { wait: UserPersistence.LOCK_WAIT_MS }, (lockErr) => {
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
    } catch (err) {
      console.error('Failed to create data directories:', err);
    }
  }

  async loadUsers(): Promise<{ users: User[] }> {
    await this.acquireLock();
    try {
      if (!await fs.pathExists(this.filePath)) {
        const defaultUsers = createDefaultUsers();
        await fs.writeJson(this.filePath, defaultUsers, { spaces: 2 });
        return defaultUsers;
      }

      try {
        const data = await fs.readJson(this.filePath);
        return {
          users: Array.isArray(data.users) ? data.users : [],
        };
      } catch (readErr) {
        console.error(`Failed to load users: ${(readErr as Error).message}`);
        const defaultUsers = createDefaultUsers();
        await fs.writeJson(this.filePath, defaultUsers, { spaces: 2 });
        return defaultUsers;
      }
    } finally {
      this.releaseLock();
    }
  }

  async saveUsers(data: { users: User[] }): Promise<void> {
    await this.acquireLock();
    try {
      await fs.writeJson(this.filePath, data, { spaces: 2 });
    } finally {
      this.releaseLock();
    }
  }

  async findUserByName(name: string): Promise<User | null> {
    const data = await this.loadUsers();
    return data.users.find((user) => user.name === name) || null;
  }

  async createUser(name: string, color: string): Promise<{ user: User; created: boolean }> {
    const existing = await this.findUserByName(name);
    if (existing) {
      return { user: existing, created: false };
    }

    const data = await this.loadUsers();
    const user: User = {
      id: `user-${Date.now()}`,
      name,
      color,
      createdAt: new Date().toISOString(),
    };

    const updated = {
      users: [...data.users, user],
    };
    await this.saveUsers(updated);

    return { user, created: true };
  }

  async findUserById(id: string): Promise<User | null> {
    const data = await this.loadUsers();
    return data.users.find((user) => user.id === id) || null;
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User | null> {
    const data = await this.loadUsers();
    const index = data.users.findIndex((user) => user.id === id);
    if (index === -1) {
      return null;
    }

    const updated = { ...data.users[index], ...updates };
    data.users[index] = updated;
    await this.saveUsers(data);

    return updated;
  }

  async removeUser(id: string): Promise<boolean> {
    const data = await this.loadUsers();
    const index = data.users.findIndex((user) => user.id === id);
    if (index === -1) {
      return false;
    }

    data.users.splice(index, 1);
    await this.saveUsers(data);

    return true;
  }
}
