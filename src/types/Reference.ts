export type ElementType = 'card' | 'group';

export interface Reference {
  id: string;
  elementId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  viewId: string;
  groupId?: string;
}
