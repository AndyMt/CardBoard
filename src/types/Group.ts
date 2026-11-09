import { Element } from './Element.js';

export interface Group extends Element {
  label: string;
  createdBy?: string;
  createdColor?: string;
}
