import { Group } from '../../types/Group';
import { ElementModel } from './ElementModel';

const DEFAULT_WIDTH = 440;
const DEFAULT_HEIGHT = 440;
const MIN_WIDTH = 220;
const MIN_HEIGHT = 220;

export class GroupModel extends ElementModel {
  static createDefault(x: number, y: number): Group {
    const base = super.createBase(x - DEFAULT_WIDTH / 2, y - 30, DEFAULT_WIDTH, DEFAULT_HEIGHT);
    return {
      id: `group-${Date.now()}`,
      label: '',
      ...base,
    };
  }

  static createFromData(data: Partial<Group>): Group {
    const base = super.createBase(data.x || 0, data.y || 0, data.width || DEFAULT_WIDTH, data.height || DEFAULT_HEIGHT);
    return {
      id: data.id || `group-${Date.now()}`,
      label: data.label || '',
      ...base,
    };
  }

  static getMinSize(): { width: number; height: number } {
    return { width: MIN_WIDTH, height: MIN_HEIGHT };
  }
}