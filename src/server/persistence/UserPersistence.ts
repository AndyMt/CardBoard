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

  constructor(filePath: string = 'data/users.json') {
    this.filePath = path.resolve(process.cwd(), filePath);
    this.lockPath = `${this.filePath}.lock`;
    this.ensureDataDirectory();
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
    return new Promise<{ users: User[] }>((resolve, reject) => {
      lockfile.lock(this.lockPath, { wait: 0 }, async (lockErr) => {
        if (lockErr) {
          console.error(`Could not acquire lock for loading users: ${lockErr.message}`);
          reject(new Error(`Could not acquire lock for loading users: ${lockErr.message}`));
          return;
        }

        try {
          if (!await fs.pathExists(this.filePath)) {
            const defaultUsers = createDefaultUsers();
            await fs.writeJson(this.filePath, defaultUsers, { spaces: 2 });
            resolve(defaultUsers);
            return;
          }

          try {
            const data = await fs.readJson(this.filePath);
            resolve({
              users: Array.isArray(data.users) ? data.users : [],
            });
          } catch (readErr) {
            console.error(`Failed to load users: ${readErr.message}`);
            const defaultUsers = createDefaultUsers();
            await fs.writeJson(this.filePath, defaultUsers, { spaces: 2 });
            resolve(defaultUsers);
          }
        } finally {
          try {
            lockfile.unlockSync(this.lockPath);
          } catch (unlockErr) {
            console.error(`Failed to release lock: ${unlockErr.message}`);
          }
        }
      });
    });
  }

  async saveUsers(data: { users: User[] }): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      lockfile.lock(this.lockPath, { wait: 0 }, async (lockErr) => {
        if (lockErr) {
          console.error(`Could not acquire lock for saving users: ${lockErr.message}`);
          reject(new Error(`Could not acquire lock for saving users: ${lockErr.message}`));
          return;
        }

        try {
          await fs.writeJson(this.filePath, data, { spaces: 2 });
          resolve();
        } catch (writeErr) {
          console.error(`Failed to save users: ${writeErr.message}`);
          reject(new Error(`Failed to save users: ${writeErr.message}`));
        } finally {
          try {
            lockfile.unlockSync(this.lockPath);
          } catch (unlockErr) {
            console.error(`Failed to release lock: ${unlockErr.message}`);
          }
        }
      });
    });
  }

  async findUserByName(name: string): Promise<User | null> {
    const data = await this.loadUsers();
    return data.users.find(user => user.name === name) || null;
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
    return data.users.find(user => user.id === id) || null;
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User | null> {
    const data = await this.loadUsers();
    const index = data.users.findIndex(user => user.id === id);
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
    const index = data.users.findIndex(user => user.id === id);
    if (index === -1) {
      return false;
    }

    data.users.splice(index, 1);
    await this.saveUsers(data);

    return true;
  }
}
