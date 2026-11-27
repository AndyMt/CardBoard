import type { Element } from './Element.js';
import type { View } from './View.js';
import type { Reference } from './Reference.js';

export interface Board {
  elements: Element[];
  views: View[];
  references: Reference[];
  version?: string;
}
