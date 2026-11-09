import { Group } from '../../types/Group';
import { ElementModel } from './ElementModel.js';
import { quantizeScalar } from '../../shared/geometry.js';

const DEFAULT_WIDTH = 440;
const DEFAULT_HEIGHT = 300;
const MIN_WIDTH = 220;
const MIN_HEIGHT = 220;

export class GroupModel extends ElementModel {
  static createDefault(x: number, y: number, createdBy?: string, createdColor?: string): Group {
    const base = super.createBase(x - DEFAULT_WIDTH / 2, y - 30, DEFAULT_WIDTH, DEFAULT_HEIGHT);
    return {
      id: `group-${Date.now()}`,
      label: '',
      createdBy,
      createdColor,
      ...base,
    };
  }

  static createFromData(data: Partial<Group>): Group {
    const base = super.createBase(
      quantizeScalar(data.x ?? 0),
      quantizeScalar(data.y ?? 0),
      quantizeScalar(data.width ?? DEFAULT_WIDTH),
      quantizeScalar(data.height ?? DEFAULT_HEIGHT)
    );
    return {
      id: data.id || `group-${Date.now()}`,
      label: data.label || '',
      createdBy: data.createdBy,
      createdColor: data.createdColor,
      ...base,
    };
  }

  static getMinSize(): { width: number; height: number } {
    return { width: MIN_WIDTH, height: MIN_HEIGHT };
  }
}
