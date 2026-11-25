export type ElementType = 'card' | 'group';

export interface Reference {
  id: string;
  elementId: string;
  elementType: ElementType;
  x: number;
  y: number;
  width: number;
  height: number;
  viewId: string;
  groupId?: string;
}
