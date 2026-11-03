import { Group as GroupInterface } from '@/types/Group';

export class Group implements GroupInterface {
  id: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;

  constructor({ id, label, x, y, width = 440, height = 440 }: Partial<GroupInterface>) {
    this.id = id || '';
    this.label = label || '';
    this.x = x || 0;
    this.y = y || 0;
    this.width = width;
    this.height = height;
  }
}