import { Element } from './Element';

export interface Card extends Element {
  text: string;
  isSelected: boolean;
  groupId?: string;
}