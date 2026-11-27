import { Group } from '../../types/Group.js';

const DEFAULT_WIDTH = 440;
const DEFAULT_HEIGHT = 300;
const MIN_WIDTH = 220;
const MIN_HEIGHT = 220;

export class GroupModel {
  static createDefault(_x: number, _y: number, createdBy?: string, createdColor?: string): Group {
    return {
      id: `group-${Date.now()}`,
      elementType: 'group',
      label: '',
      createdBy,
      createdColor,
    };
  }

  static createFromData(data: Partial<Group>): Group {
    return {
      id: data.id || `group-${Date.now()}`,
      elementType: 'group',
      label: data.label || '',
      createdBy: data.createdBy,
      createdColor: data.createdColor,
    };
  }

  static getMinSize(): { width: number; height: number } {
    return { width: MIN_WIDTH, height: MIN_HEIGHT };
  }
}
