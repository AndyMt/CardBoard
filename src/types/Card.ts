import { Element } from './Element.js';

export interface Connection {
  targetCardId: string;
  name?: string;
}

export interface Card extends Element {
  text: string;
  groupId?: string;
  createdBy?: string;
  createdColor?: string;
  connections?: Connection[];
}
