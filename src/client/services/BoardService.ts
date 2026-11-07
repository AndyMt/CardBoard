import { WebSocketService } from './WebSocketService';

// API configuration
const API_BASE_URL = '/api';

function socketHeaders(): Record<string, string> {
  const id = WebSocketService.getInstance().getSocketId();
  return id ? { 'X-Socket-Id': id } : {};
}

class BoardService {
  private static instance: BoardService;

  private constructor() {
    // Private constructor for singleton
  }

  public static getInstance(): BoardService {
    if (!BoardService.instance) {
      BoardService.instance = new BoardService();
    }
    return BoardService.instance;
  }

  async getBoard(): Promise<{ cards: Card[]; groups: Group[] }> {
    try {
      const response = await fetch(`${API_BASE_URL}/board`);
      if (!response.ok) {
        throw new Error(`Failed to fetch board: ${response.statusText}`);
      }
      const board = await response.json();
      return {
        cards: board.cards || [],
        groups: board.groups || []
      };
    } catch (error) {
      console.error('Failed to get board:', error);
      // Return empty board if there's an error
      return { cards: [], groups: [] };
    }
  }

  async addCard(card: Card): Promise<{ cards: Card[]; groups: Group[] }> {
    try {
      WebSocketService.getInstance().markLocalMutation();
      const response = await fetch(`${API_BASE_URL}/board/card`, {
        method: 'POST',
        headers: { ...socketHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(card),
      });
      
      if (!response.ok) {
        throw new Error(`Failed to add card: ${response.statusText}`);
      }
      
      const board = await response.json();
      return {
        cards: board.cards || [],
        groups: board.groups || []
      };
    } catch (error) {
      console.error('Failed to add card:', error);
      throw error;
    }
  }

  async addGroup(group: Group): Promise<{ cards: Card[]; groups: Group[] }> {
    try {
      WebSocketService.getInstance().markLocalMutation();
      const response = await fetch(`${API_BASE_URL}/board/group`, {
        method: 'POST',
        headers: { ...socketHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(group),
      });
      
      if (!response.ok) {
        throw new Error(`Failed to add group: ${response.statusText}`);
      }
      
      const board = await response.json();
      return {
        cards: board.cards || [],
        groups: board.groups || []
      };
    } catch (error) {
      console.error('Failed to add group:', error);
      throw error;
    }
  }

  async updateCard(cardId: string, updates: Partial<Card>): Promise<{ cards: Card[]; groups: Group[] }> {
    try {
      WebSocketService.getInstance().markLocalMutation();
      const response = await fetch(`${API_BASE_URL}/board/card/${cardId}`, {
        method: 'PUT',
        headers: { ...socketHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      });
      
      if (!response.ok) {
        throw new Error(`Failed to update card: ${response.statusText}`);
      }
      
      const board = await response.json();
      return {
        cards: board.cards || [],
        groups: board.groups || []
      };
    } catch (error) {
      console.error('Failed to update card:', error);
      throw error;
    }
  }

  async updateGroup(groupId: string, updates: Partial<Group>): Promise<{ cards: Card[]; groups: Group[] }> {
    try {
      WebSocketService.getInstance().markLocalMutation();
      const response = await fetch(`${API_BASE_URL}/board/group/${groupId}`, {
        method: 'PUT',
        headers: { ...socketHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      });
      
      if (!response.ok) {
        throw new Error(`Failed to update group: ${response.statusText}`);
      }
      
      const board = await response.json();
      return {
        cards: board.cards || [],
        groups: board.groups || []
      };
    } catch (error) {
      console.error('Failed to update group:', error);
      throw error;
    }
  }

  async deleteCard(cardId: string): Promise<{ cards: Card[]; groups: Group[] }> {
    try {
      WebSocketService.getInstance().markLocalMutation();
      const response = await fetch(`${API_BASE_URL}/board/card/${cardId}`, {
         method: 'DELETE',
         headers: socketHeaders(),
       });
      
      if (!response.ok) {
        throw new Error(`Failed to delete card: ${response.statusText}`);
      }
      
      const board = await response.json();
      return {
        cards: board.cards || [],
        groups: board.groups || []
      };
    } catch (error) {
      console.error('Failed to delete card:', error);
      throw error;
    }
  }

  async deleteGroup(groupId: string): Promise<{ cards: Card[]; groups: Group[] }> {
    try {
      WebSocketService.getInstance().markLocalMutation();
      const response = await fetch(`${API_BASE_URL}/board/group/${groupId}`, {
         method: 'DELETE',
         headers: socketHeaders(),
       });
      
      if (!response.ok) {
        throw new Error(`Failed to delete group: ${response.statusText}`);
      }
      
      const board = await response.json();
      return {
        cards: board.cards || [],
        groups: board.groups || []
      };
    } catch (error) {
      console.error('Failed to delete group:', error);
      throw error;
    }
  }
}

export default BoardService;
