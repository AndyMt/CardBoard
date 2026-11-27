import { Element } from './Element.js';

export interface Group extends Element {
  elementType: 'group';
  label: string;
  createdBy?: string;
  createdColor?: string;
}
