import { Card } from './Card.js';
import { Group } from './Group.js';
import { Board } from '../../types/Board.js';

export class BoardModel implements Board {
  cards: Card[];
  groups: Group[];
  groupCards: Array<{ groupId: string; cardId: string }>;

  constructor() {
    this.cards = [];
    this.groups = [];
    this.groupCards = [];
  }

  addCard(cardData: Partial<Card>): void {
    const card = new Card(cardData);
    this.cards.push(card);
  }

  addGroup(groupData: Partial<Group>): void {
    const group = new Group(groupData);
    this.groups.push(group);
  }

  moveCard(cardId: string, x: number, y: number): void {
    const card = this.cards.find(c => c.id === cardId);
    if (card) {
      card.x = x;
      card.y = y;
    }
  }

  moveGroup(groupId: string, x: number, y: number): void {
    const group = this.groups.find(g => g.id === groupId);
    if (group) {
      group.x = x;
      group.y = y;
    }
  }
}