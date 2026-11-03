import { Card } from './Card.js';
import { Group } from './Group.js';

export interface Board {
  cards: Card[];
  groups: Group[];
  groupCards: Array<{ groupId: string; cardId: string }>;
}