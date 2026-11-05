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

  async getUsers(): Promise<User[]> {
    const response = await fetch(`${API_BASE_URL}/users`);
    if (!response.ok) {
      throw new Error(`Failed to fetch users: ${response.statusText}`);
    }
    const data = await response.json();
    return data.users || [];
  }

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
    return {
      user: data.user,
      created: data.created ?? false,
    };
  }
}

export default UserService;
