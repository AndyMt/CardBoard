import { Element } from './Element.js';

export interface Group extends Element {
  label: string;
  isSelected: boolean;
  createdBy?: string;
  createdColor?: string;
}
