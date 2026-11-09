import { Element } from './Element.js';

export interface Card extends Element {
  text: string;
  groupId?: string;
  createdBy?: string;
  createdColor?: string;
}
