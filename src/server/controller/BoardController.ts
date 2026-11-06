import { JSONPersistence } from '../persistence/JSONPersistence';
import { BoardModelManager, BoardModel, createDefaultBoard } from '../model/BoardModel';
import type { Card } from '../../types/Card.js';
import type { Group } from '../../types/Group.js';

export class BoardController {
  private persistence: JSONPersistence;
  private boardManager: BoardModelManager;

  constructor() {
    this.persistence = new JSONPersistence();
    // Initialize with default board (will be loaded in initializeBoard)
    this.boardManager = new BoardModelManager();
    this.initializeBoard();
  }

  private async initializeBoard(): Promise<void> {
    try {
      const boardData = await this.persistence.loadBoard();
      this.boardManager = new BoardModelManager(boardData);
    } catch (error) {
      console.error('Failed to load board:', error);
      // Keep using the default board if loading fails
    }
  }

  async getBoard(): Promise<BoardModel> {
    return this.boardManager.getBoard();
  }

  async addCard(card: Card): Promise<BoardModel> {
    this.boardManager.addCard(card);
    await this.saveBoard();
    return this.boardManager.getBoard();
  }

  async addGroup(group: Group): Promise<BoardModel> {
    this.boardManager.addGroup(group);
    await this.saveBoard();
    return this.boardManager.getBoard();
  }

  async updateCard(cardId: string, updates: Partial<Card>): Promise<BoardModel> {
    this.boardManager.updateCard(cardId, updates);
    await this.saveBoard();
    return this.boardManager.getBoard();
  }

  async updateGroup(groupId: string, updates: Partial<Group>): Promise<BoardModel> {
    this.boardManager.updateGroup(groupId, updates);
    await this.saveBoard();
    return this.boardManager.getBoard();
  }

  async moveCard(cardId: string, x: number, y: number): Promise<BoardModel> {
    this.boardManager.moveCard(cardId, x, y);
    await this.saveBoard();
    return this.boardManager.getBoard();
  }

  async moveGroup(groupId: string, x: number, y: number): Promise<BoardModel> {
    this.boardManager.moveGroup(groupId, x, y);
    await this.saveBoard();
    return this.boardManager.getBoard();
  }

  private async saveBoard(): Promise<void> {
    try {
      await this.persistence.saveBoard(this.boardManager.getBoard());
      await this.persistence.createBackup();
    } catch (error) {
      console.error('Failed to save board:', error);
    }
  }
}