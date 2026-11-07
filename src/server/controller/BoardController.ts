import { JSONPersistence } from '../persistence/JSONPersistence';
import { BoardModelManager, BoardModel, createDefaultBoard } from '../model/BoardModel';
import type { Card } from '../../types/Card.js';
import type { Group } from '../../types/Group.js';
import { quantizeScalar } from '../../shared/geometry.js';
import { UserPersistence } from '../persistence/UserPersistence';
import { normalizeBoardModel } from '../../shared/userColorNormalization.js';

export class BoardController {
  private persistence: JSONPersistence;
  private userPersistence: UserPersistence;
  private boardManager: BoardModelManager;

  constructor() {
    this.persistence = new JSONPersistence();
    this.userPersistence = new UserPersistence();
    // Initialize with default board (will be loaded in initializeBoard)
    this.boardManager = new BoardModelManager();
    this.initializeBoard();
  }

  private async initializeBoard(): Promise<void> {
    try {
      const boardData = await this.persistence.loadBoard();
      const users = await this.userPersistence.loadUsers();
      const normalized = normalizeBoardModel(boardData, users.users || []);
      this.boardManager = new BoardModelManager(normalized.board);
      if (normalized.changed) {
        await this.persistence.saveBoard(normalized.board);
      }
    } catch (error) {
      console.error('Failed to load board:', error);
      // Keep using the default board if loading fails
    }
  }

  async getBoard(): Promise<BoardModel> {
    const users = await this.userPersistence.loadUsers();
    const normalized = normalizeBoardModel(this.boardManager.getBoard(), users.users || []);
    if (normalized.changed) {
      this.boardManager = new BoardModelManager(normalized.board);
      await this.saveBoard();
    }
    return this.boardManager.getBoard();
  }

  async addCard(card: Card): Promise<BoardModel> {
    this.boardManager.addCard(card);
    await this.saveBoard();
    return this.getBoard();
  }

  async addGroup(group: Group): Promise<BoardModel> {
    this.boardManager.addGroup(group);
    await this.saveBoard();
    return this.getBoard();
  }

  async updateCard(cardId: string, updates: Partial<Card>): Promise<BoardModel> {
    this.boardManager.updateCard(cardId, updates);
    await this.saveBoard();
    return this.getBoard();
  }

  async updateGroup(groupId: string, updates: Partial<Group>): Promise<BoardModel> {
    this.boardManager.updateGroup(groupId, updates);
    await this.saveBoard();
    return this.getBoard();
  }

  async moveCard(cardId: string, x: number, y: number): Promise<BoardModel> {
    this.boardManager.moveCard(cardId, quantizeScalar(x), quantizeScalar(y));
    await this.saveBoard();
    return this.getBoard();
  }

  async moveGroup(groupId: string, x: number, y: number): Promise<BoardModel> {
    this.boardManager.moveGroup(groupId, quantizeScalar(x), quantizeScalar(y));
    await this.saveBoard();
    return this.getBoard();
  }

  private async saveBoard(): Promise<void> {
    try {
      const users = await this.userPersistence.loadUsers();
      const normalized = normalizeBoardModel(this.boardManager.getBoard(), users.users || []);
      if (normalized.changed) {
        this.boardManager = new BoardModelManager(normalized.board);
      }
      await this.persistence.saveBoard(this.boardManager.getBoard());
      await this.persistence.createBackup();
    } catch (error) {
      console.error('Failed to save board:', error);
    }
  }
}