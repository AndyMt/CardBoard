import { Group } from '../../types/Group';

const DEFAULT_WIDTH = 440; // 2x2 cards + padding
const DEFAULT_HEIGHT = 440;
const MIN_WIDTH = 220; // 1x1 card + padding
const MIN_HEIGHT = 220;

export class GroupModel {
  static createDefault(x: number, y: number): Group {
    return {
      id: `group-${Date.now()}`,
      label: '',
      x: x - DEFAULT_WIDTH / 2, // Center the group on the click position
      y: y - 30, // Account for group header height
      width: DEFAULT_WIDTH,
      height: DEFAULT_HEIGHT
    };
  }
  
  static createFromData(data: Partial<Group>): Group {
    return {
      id: data.id || `group-${Date.now()}`,
      label: data.label || '',
      x: data.x || 0,
      y: data.y || 0,
      width: data.width || DEFAULT_WIDTH,
      height: data.height || DEFAULT_HEIGHT
    };
  }
  
  static getMinSize(): { width: number, height: number } {
    return {
      width: MIN_WIDTH,
      height: MIN_HEIGHT
    };
  }
}