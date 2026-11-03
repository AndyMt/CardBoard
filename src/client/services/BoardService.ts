import { Card } from '../../types/Card';
import { Group } from '../../types/Group';

// For now, let's use a simple in-memory solution with localStorage
// We'll implement the server-side persistence later

class BoardService {
  private static instance: BoardService;
  private STORAGE_KEY = 'cardboard-board';

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
      const boardData = localStorage.getItem(this.STORAGE_KEY);
      if (boardData) {
        const board = JSON.parse(boardData);
        return {
          cards: board.cards || [],
          groups: board.groups || []
        };
      }
      // Return empty board if no data exists
      return { cards: [], groups: [] };
    } catch (error) {
      console.error('Failed to get board:', error);
      // Return empty board if there's an error
      return { cards: [], groups: [] };
    }
  }

  async saveBoard(board: { cards: Card[]; groups: Group[] }): Promise<void> {
    try {
      const boardData = {
        cards: board.cards,
        groups: board.groups,
        lastUpdated: new Date().toISOString()
      };
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(boardData));
    } catch (error) {
      console.error('Failed to save board:', error);
      throw error;
    }
  }

  async addCard(card: Card): Promise<{ cards: Card[]; groups: Group[] }> {
    try {
      const { cards, groups } = await this.getBoard();
      const updatedCards = [...cards, card];
      await this.saveBoard({ cards: updatedCards, groups });
      return { cards: updatedCards, groups };
    } catch (error) {
      console.error('Failed to add card:', error);
      throw error;
    }
  }

  async addGroup(group: Group): Promise<{ cards: Card[]; groups: Group[] }> {
    try {
      const { cards, groups } = await this.getBoard();
      const updatedGroups = [...groups, group];
      await this.saveBoard({ cards, groups: updatedGroups });
      return { cards, groups: updatedGroups };
    } catch (error) {
      console.error('Failed to add group:', error);
      throw error;
    }
  }

  async updateCard(cardId: string, updates: Partial<Card>): Promise<{ cards: Card[]; groups: Group[] }> {
    try {
      const { cards, groups } = await this.getBoard();
      const updatedCards = cards.map(card => 
        card.id === cardId ? { ...card, ...updates } : card
      );
      await this.saveBoard({ cards: updatedCards, groups });
      return { cards: updatedCards, groups };
    } catch (error) {
      console.error('Failed to update card:', error);
      throw error;
    }
  }

  async updateGroup(groupId: string, updates: Partial<Group>): Promise<{ cards: Card[]; groups: Group[] }> {
    try {
      const { cards, groups } = await this.getBoard();
      const updatedGroups = groups.map(group => 
        group.id === groupId ? { ...group, ...updates } : group
      );
      await this.saveBoard({ cards, groups: updatedGroups });
      return { cards, groups: updatedGroups };
    } catch (error) {
      console.error('Failed to update group:', error);
      throw error;
    }
  }
}

export default BoardService;