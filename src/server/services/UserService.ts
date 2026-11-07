import { UserPersistence } from '../persistence/UserPersistence.js';
import type { User } from '../../types/User.js';

export interface UserServiceOptions {
  onUsersChanged?: () => void;
}

export class UserService {
  private persistence: UserPersistence;
  private onUsersChanged?: () => void;

  constructor(options: UserServiceOptions = {}) {
    this.persistence = new UserPersistence();
    this.onUsersChanged = options.onUsersChanged;
  }

  async listUsers(): Promise<User[]> {
    const data = await this.persistence.loadUsers();
    return data.users;
  }

  async findUserById(id: string): Promise<User | null> {
    return this.persistence.findUserById(id);
  }

  async findUserByName(name: string): Promise<User | null> {
    return this.persistence.findUserByName(name);
  }

  async createUser(name: string, color: string): Promise<{ user: User; created: boolean }> {
    const result = await this.persistence.createUser(name, color);
    this.onUsersChanged?.();
    return result;
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User | null> {
    const result = await this.persistence.updateUser(id, updates);
    if (result) {
      this.onUsersChanged?.();
    }
    return result;
  }

  async removeUser(id: string): Promise<boolean> {
    const result = await this.persistence.removeUser(id);
    if (result) {
      this.onUsersChanged?.();
    }
    return result;
  }
}

export default UserService;
