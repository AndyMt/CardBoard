import { Card } from './Card.js';
import { Group } from './Group.js';
import { View } from './View.js';
import { Reference } from './Reference.js';

export interface Board {
  cards: Card[];
  groups: Group[];
  views: View[];
  references: Reference[];
}
