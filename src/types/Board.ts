import { Card } from './Card';
import { Group } from './Group';

export interface Board {
  cards: Card[];
  groups: Group[];
  groupCards: Array<{ groupId: string; cardId: string }>;
}