import { Card } from '../../types/Card';
import { ElementModel } from './ElementModel';

const CARD_WIDTH = 200;
const CARD_MIN_HEIGHT = 60;
const LINE_HEIGHT = 20;

export class CardModel extends ElementModel {
  static createDefault(x: number, y: number): Card {
    const base = super.createBase(x - CARD_WIDTH / 2, y - 30, CARD_WIDTH, CARD_MIN_HEIGHT);
    return {
      id: `card-${Date.now()}`,
      text: '',
      ...base,
    };
  }

  static createFromData(data: Partial<Card>): Card {
    const base = super.createBase(data.x || 0, data.y || 0, data.width || CARD_WIDTH, data.height || CARD_MIN_HEIGHT);
    return {
      id: data.id || `card-${Date.now()}`,
      text: data.text || '',
      ...base,
    };
  }

  static calculateHeight(text: string): number {
    if (!text) return CARD_MIN_HEIGHT;
    const lines = text.split('\n').length;
    return Math.max(CARD_MIN_HEIGHT, lines * LINE_HEIGHT + 40);
  }
}