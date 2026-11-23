import { Element } from './Element.js';
import { Connection } from './Connection.js';

export interface Card extends Element {
  text: string;
  groupId?: string;
  createdBy?: string;
  createdColor?: string;
  connections?: Connection[];
}
