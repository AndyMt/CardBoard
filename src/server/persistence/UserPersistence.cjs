const fs = require('fs-extra');
const lockfile = require('lockfile');
const path = require('path');

const createDefaultUsers = () => ({
  users: [],
});

class UserPersistence {
  constructor(filePath = 'data/users.json') {
    this.filePath = path.resolve(process.cwd(), filePath);
    this.lockPath = `${this.filePath}.lock`;
    this.ensureDataDirectory();
  }

  ensureDataDirectory() {
    try {
      const dataDir = path.dirname(this.filePath);
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }
    } catch (err) {
      console.error('Failed to create data directories:', err);
    }
  }

  loadUsers() {
    return new Promise((resolve, reject) => {
      lockfile.lock(this.lockPath, { wait: 5000 }, async (lockErr) => {
        if (lockErr) {
          console.error(`Could not acquire lock for loading users: ${lockErr.message}`);
          reject(new Error(`Could not acquire lock for loading users: ${lockErr.message}`));
          return;
        }

        try {
          if (!(await fs.pathExists(this.filePath))) {
            const defaultUsers = createDefaultUsers();
            await this.saveUsers(defaultUsers);
            resolve(defaultUsers);
            return;
          }

          const data = await fs.readJson(this.filePath);
          resolve({
            users: Array.isArray(data.users) ? data.users : [],
          });
        } catch (readErr) {
          console.error(`Failed to load users: ${readErr.message}`);
          const defaultUsers = createDefaultUsers();
          await this.saveUsers(defaultUsers);
          resolve(defaultUsers);
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

  saveUsers(data) {
    return new Promise((resolve, reject) => {
      lockfile.lock(this.lockPath, { wait: 5000 }, async (lockErr) => {
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

  async findUserByName(name) {
    const data = await this.loadUsers();
    return data.users.find(user => user.name === name) || null;
  }

  async createUser(name, color) {
    const existing = await this.findUserByName(name);
    if (existing) {
      return { user: existing, created: false };
    }

    const data = await this.loadUsers();
    const user = {
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
}

module.exports = { UserPersistence, createDefaultUsers };
