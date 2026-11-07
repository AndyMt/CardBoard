import { User } from '../../types/User.js';

const API_BASE_URL = '/api';
const LOCAL_STORAGE_KEY = 'cardboard_user';

class UserService {
  private static instance: UserService;

  private constructor() {}

  public static getInstance(): UserService {
    if (!UserService.instance) {
      UserService.instance = new UserService();
    }
    return UserService.instance;
  }

  getStoredUser(): User | null {
    try {
      const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (!raw) {
        return null;
      }
      return JSON.parse(raw) as User;
    } catch {
      return null;
    }
  }

  setStoredUser(user: User): void {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(user));
    } catch (err) {
      console.error('Failed to store user in localStorage:', err);
    }
  }

  clearStoredUser(): void {
    try {
      localStorage.removeItem(LOCAL_STORAGE_KEY);
    } catch (err) {
      console.error('Failed to clear user from localStorage:', err);
    }
  }

  // ---- Cached directory -------------------------------------------------

  private cachedUsers: User[] | null = null;
  private usersSubscribers = new Set<(users: User[]) => void>();

  /** Returns the cached directory, fetching from the server on first access. */
  async getUsers(): Promise<User[]> {
    if (this.cachedUsers) {
      return this.cachedUsers;
    }
    return this.refreshUsers();
  }

  /** Fetch the directory from the server, update the cache, and notify subscribers. */
  async refreshUsers(): Promise<User[]> {
    const response = await fetch(`${API_BASE_URL}/users`);
    if (!response.ok) {
      throw new Error(`Failed to fetch users: ${response.statusText}`);
    }
    const data = await response.json();
    const users = data.users || [];
    this.cachedUsers = users;
    this.usersSubscribers.forEach((handler) => handler(users));
    return users;
  }

  /** Clear the cached directory so the next getUsers() re-fetches. */
  invalidateUsers(): void {
    this.cachedUsers = null;
  }

  /** Set the directory directly (e.g. from a WebSocket push) and notify subscribers. */
  setUsers(users: User[]): void {
    this.cachedUsers = users;
    this.usersSubscribers.forEach((handler) => handler(users));
  }

  /** Subscribe to directory changes. Returns an unsubscribe function. */
  onUsersDirectoryUpdate(handler: (users: User[]) => void): () => void {
    this.usersSubscribers.add(handler);
    return () => this.usersSubscribers.delete(handler);
  }

  // ---- Single user ------------------------------------------------------

  async getUserByName(name: string): Promise<User | null> {
    try {
      const response = await fetch(`${API_BASE_URL}/users/${encodeURIComponent(name)}`);
      if (response.status === 404) {
        return null;
      }
      if (!response.ok) {
        throw new Error(`Failed to fetch user: ${response.statusText}`);
      }
      return await response.json();
    } catch (error) {
      if ((error as Error).message === 'Failed to fetch user: 404') {
        return null;
      }
      throw error;
    }
  }

  async registerUser(name: string, color: string): Promise<{ user: User; created: boolean }> {
    const response = await fetch(`${API_BASE_URL}/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name, color }),
    });

    if (response.status === 400) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Failed to register user');
    }

    if (response.status === 409) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Color already taken');
    }

    if (!response.ok) {
      throw new Error(`Failed to register user: ${response.statusText}`);
    }

    const data = await response.json();
    const { user } = data;
    this.setStoredUser(user);
    this.invalidateUsers();

    return {
      user: data.user,
      created: data.created ?? false,
    };
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User> {
    const response = await fetch(`${API_BASE_URL}/users/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updates),
    });

    if (!response.ok) {
      throw new Error(`Failed to update user: ${response.statusText}`);
    }

    const user = await response.json();
    this.invalidateUsers();
    return user;
  }

  async removeUser(id: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/users/${id}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      throw new Error(`Failed to delete user: ${response.statusText}`);
    }

    this.invalidateUsers();
  }
}

export default UserService;
