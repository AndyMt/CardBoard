import { WebSocketService } from './WebSocketService.js';
import type { Card } from '../../types/Card.js';
import type { Group } from '../../types/Group.js';
import type { View } from '../../types/View.js';
import type { Reference } from '../../types/Reference.js';
import { quantizeGeometry, quantizeGeometryUpdates } from '../../shared/geometry.js';
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

  async getBoard(): Promise<{
    cards: Card[];
    groups: Group[];
    views: View[];
    references: Reference[];
  }> {
    try {
      const response = await fetch(`${API_BASE_URL}/board`);
      if (!response.ok) {
        throw new Error(`Failed to fetch board: ${response.statusText}`);
      }
      const board = await response.json();
      return {
        cards: board.cards || [],
        groups: board.groups || [],
        views: board.views || [],
        references: board.references || [],
      };
    } catch (error) {
      console.error('Failed to get board:', error);
      return { cards: [], groups: [], views: [], references: [] };
    }
  }

  async addCard(card: Card): Promise<{
    cards: Card[];
    groups: Group[];
    views: View[];
    references: Reference[];
  }> {
    try {
      WebSocketService.getInstance().markLocalMutation();
      const response = await fetch(`${API_BASE_URL}/board/card`, {
        method: 'POST',
        headers: { ...socketHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(card),
      });
      if (!response.ok) {
        throw new Error(`Failed to add card: ${response.statusText}`);
      }
      const board = await response.json();
      return {
        cards: board.cards || [],
        groups: board.groups || [],
        views: board.views || [],
        references: board.references || [],
      };
    } catch (error) {
      console.error('Failed to add card:', error);
      throw error;
    }
  }

  async addGroup(group: Group): Promise<{
    cards: Card[];
    groups: Group[];
    views: View[];
    references: Reference[];
  }> {
    try {
      WebSocketService.getInstance().markLocalMutation();
      const response = await fetch(`${API_BASE_URL}/board/group`, {
        method: 'POST',
        headers: { ...socketHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(group),
      });
      if (!response.ok) {
        throw new Error(`Failed to add group: ${response.statusText}`);
      }
      const board = await response.json();
      return {
        cards: board.cards || [],
        groups: board.groups || [],
        views: board.views || [],
        references: board.references || [],
      };
    } catch (error) {
      console.error('Failed to add group:', error);
      throw error;
    }
  }

  async addReference(reference: Reference): Promise<{
    cards: Card[];
    groups: Group[];
    views: View[];
    references: Reference[];
  }> {
    try {
      WebSocketService.getInstance().markLocalMutation();
      const response = await fetch(`${API_BASE_URL}/board/reference`, {
        method: 'POST',
        headers: { ...socketHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(quantizeGeometry(reference)),
      });
      if (!response.ok) {
        throw new Error(`Failed to add reference: ${response.statusText}`);
      }
      const board = await response.json();
      return {
        cards: board.cards || [],
        groups: board.groups || [],
        views: board.views || [],
        references: board.references || [],
      };
    } catch (error) {
      console.error('Failed to add reference:', error);
      throw error;
    }
  }

  async updateReference(referenceId: string, updates: Partial<Reference>): Promise<{
    cards: Card[];
    groups: Group[];
    views: View[];
    references: Reference[];
  }> {
    try {
      WebSocketService.getInstance().markLocalMutation();
      const response = await fetch(`${API_BASE_URL}/board/reference/${referenceId}`, {
        method: 'PUT',
        headers: { ...socketHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(quantizeGeometryUpdates(updates)),
      });
      if (!response.ok) {
        throw new Error(`Failed to update reference: ${response.statusText}`);
      }
      const board = await response.json();
      return {
        cards: board.cards || [],
        groups: board.groups || [],
        views: board.views || [],
        references: board.references || [],
      };
    } catch (error) {
      console.error('Failed to update reference:', error);
      throw error;
    }
  }

  async deleteReference(referenceId: string): Promise<{
    cards: Card[];
    groups: Group[];
    views: View[];
    references: Reference[];
  }> {
    try {
      WebSocketService.getInstance().markLocalMutation();
      const response = await fetch(`${API_BASE_URL}/board/reference/${referenceId}`, {
        method: 'DELETE',
        headers: socketHeaders(),
      });
      if (!response.ok) {
        throw new Error(`Failed to delete reference: ${response.statusText}`);
      }
      const board = await response.json();
      return {
        cards: board.cards || [],
        groups: board.groups || [],
        views: board.views || [],
        references: board.references || [],
      };
    } catch (error) {
      console.error('Failed to delete reference:', error);
      throw error;
    }
  }

  async updateCard(cardId: string, updates: Partial<Card>): Promise<{
    cards: Card[];
    groups: Group[];
    views: View[];
    references: Reference[];
  }> {
    try {
      WebSocketService.getInstance().markLocalMutation();
      const response = await fetch(`${API_BASE_URL}/board/card/${cardId}`, {
        method: 'PUT',
        headers: { ...socketHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (!response.ok) {
        throw new Error(`Failed to update card: ${response.statusText}`);
      }
      const board = await response.json();
      return {
        cards: board.cards || [],
        groups: board.groups || [],
        views: board.views || [],
        references: board.references || [],
      };
    } catch (error) {
      console.error('Failed to update card:', error);
      throw error;
    }
  }

  async updateGroup(groupId: string, updates: Partial<Group>): Promise<{
    cards: Card[];
    groups: Group[];
    views: View[];
    references: Reference[];
  }> {
    try {
      WebSocketService.getInstance().markLocalMutation();
      const response = await fetch(`${API_BASE_URL}/board/group/${groupId}`, {
        method: 'PUT',
        headers: { ...socketHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (!response.ok) {
        throw new Error(`Failed to update group: ${response.statusText}`);
      }
      const board = await response.json();
      return {
        cards: board.cards || [],
        groups: board.groups || [],
        views: board.views || [],
        references: board.references || [],
      };
    } catch (error) {
      console.error('Failed to update group:', error);
      throw error;
    }
  }

  async batchUpdate(payload: {
    references?: Array<{ id: string } & Partial<Reference>>;
  }): Promise<{
    cards: Card[];
    groups: Group[];
    views: View[];
    references: Reference[];
  }> {
    try {
      WebSocketService.getInstance().markLocalMutation();
      const response = await fetch(`${API_BASE_URL}/board/batch`, {
        method: 'PUT',
        headers: { ...socketHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          references: (payload.references || []).map((r) => ({
            ...r,
            ...quantizeGeometryUpdates(r),
          })),
        }),
      });
      if (!response.ok) {
        throw new Error(`Failed to batch update board: ${response.statusText}`);
      }
      const board = await response.json();
      return {
        cards: board.cards || [],
        groups: board.groups || [],
        views: board.views || [],
        references: board.references || [],
      };
    } catch (error) {
      console.error('Failed to batch update board:', error);
      throw error;
    }
  }

  async deleteCard(cardId: string): Promise<{
    cards: Card[];
    groups: Group[];
    views: View[];
    references: Reference[];
  }> {
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
        groups: board.groups || [],
        views: board.views || [],
        references: board.references || [],
      };
    } catch (error) {
      console.error('Failed to delete card:', error);
      throw error;
    }
  }

  async deleteGroup(groupId: string): Promise<{
    cards: Card[];
    groups: Group[];
    views: View[];
    references: Reference[];
  }> {
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
        groups: board.groups || [],
        views: board.views || [],
        references: board.references || [],
      };
    } catch (error) {
      console.error('Failed to delete group:', error);
      throw error;
    }
  }

  async addConnection(cardId: string, targetCardId: string): Promise<{
    cards: Card[];
    groups: Group[];
    views: View[];
    references: Reference[];
    connectionId?: string;
  }> {
    try {
      WebSocketService.getInstance().markLocalMutation();
      const response = await fetch(`${API_BASE_URL}/board/card/${cardId}/connections`, {
        method: 'PUT',
        headers: { ...socketHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetCardId }),
      });
      if (!response.ok) {
        throw new Error(`Failed to add connection: ${response.statusText}`);
      }
      const board = await response.json();
      const connectionId = board.connectionId;
      return {
        cards: board.cards || [],
        groups: board.groups || [],
        views: board.views || [],
        references: board.references || [],
        connectionId,
      };
    } catch (error) {
      console.error('Failed to add connection:', error);
      throw error;
    }
  }

  async removeConnection(cardId: string, connectionId: string): Promise<{
    cards: Card[];
    groups: Group[];
    views: View[];
    references: Reference[];
  }> {
    try {
      WebSocketService.getInstance().markLocalMutation();
      const response = await fetch(`${API_BASE_URL}/board/card/${cardId}/connections/${connectionId}`, {
        method: 'DELETE',
        headers: socketHeaders(),
      });
      if (!response.ok) {
        throw new Error(`Failed to remove connection: ${response.statusText}`);
      }
      const board = await response.json();
      return {
        cards: board.cards || [],
        groups: board.groups || [],
        views: board.views || [],
        references: board.references || [],
      };
    } catch (error) {
      console.error('Failed to remove connection:', error);
      throw error;
    }
  }

  async updateConnectionName(cardId: string, connectionId: string, name: string): Promise<{
    cards: Card[];
    groups: Group[];
    views: View[];
    references: Reference[];
  }> {
    try {
      WebSocketService.getInstance().markLocalMutation();
      const response = await fetch(`${API_BASE_URL}/board/card/${cardId}/connections/${connectionId}/name`, {
        method: 'PUT',
        headers: { ...socketHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      if (!response.ok) {
        throw new Error(`Failed to update connection name: ${response.statusText}`);
      }
      const board = await response.json();
      return {
        cards: board.cards || [],
        groups: board.groups || [],
        views: board.views || [],
        references: board.references || [],
      };
    } catch (error) {
      console.error('Failed to update connection name:', error);
      throw error;
    }
  }
}

export default BoardService;
