import { Element } from './Element';

export interface Group extends Element {
  label: string;
  isSelected: boolean;
}