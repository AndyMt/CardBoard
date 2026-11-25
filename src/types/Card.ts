import { Element } from './Element.js';
import { Connection } from './Connection.js';

export interface Card extends Element {
  text: string;
  createdBy?: string;
  createdColor?: string;
  connections?: Connection[];
}
