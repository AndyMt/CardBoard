import type { Card } from '../../types/Card.js';
import type { Group } from '../../types/Group.js';

export interface BoardModel {
  cards: Card[];
  groups: Group[];
  lastUpdated: string;
}

export const createDefaultBoard = (): BoardModel => ({
  cards: [],
  groups: [],
  lastUpdated: new Date().toISOString()
});

export class BoardModelManager {
  private board: BoardModel;
  
  constructor(initialBoard?: BoardModel) {
    this.board = initialBoard || createDefaultBoard();
  }
  
  getBoard(): BoardModel {
    return this.board;
  }
  
  addCard(card: Card): void {
    this.board.cards.push(card);
    this.board.lastUpdated = new Date().toISOString();
  }
  
  addGroup(group: Group): void {
    this.board.groups.push(group);
    this.board.lastUpdated = new Date().toISOString();
  }
  
  updateCard(cardId: string, updates: Partial<Card>): void {
    const cardIndex = this.board.cards.findIndex(c => c.id === cardId);
    if (cardIndex >= 0) {
      this.board.cards[cardIndex] = { ...this.board.cards[cardIndex], ...updates };
      this.board.lastUpdated = new Date().toISOString();
    }
  }
  
  updateGroup(groupId: string, updates: Partial<Group>): void {
    const groupIndex = this.board.groups.findIndex(g => g.id === groupId);
    if (groupIndex >= 0) {
      this.board.groups[groupIndex] = { ...this.board.groups[groupIndex], ...updates };
      this.board.lastUpdated = new Date().toISOString();
    }
  }
  
  moveCard(cardId: string, x: number, y: number): void {
    const card = this.board.cards.find(c => c.id === cardId);
    if (card) {
      card.x = x;
      card.y = y;
      this.board.lastUpdated = new Date().toISOString();
    }
  }
  
  moveGroup(groupId: string, x: number, y: number): void {
    const group = this.board.groups.find(g => g.id === groupId);
    if (group) {
      group.x = x;
      group.y = y;
      this.board.lastUpdated = new Date().toISOString();
    }
  }
}