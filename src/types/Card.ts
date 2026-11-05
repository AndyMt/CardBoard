import { Element } from './Element.js';

export interface Card extends Element {
  text: string;
  isSelected: boolean;
  groupId?: string;
  createdBy?: string;
  createdColor?: string;
}
