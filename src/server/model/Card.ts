import { Card } from '../../types/Card.js';

const CARD_MIN_HEIGHT = 60;
const LINE_HEIGHT = 20;

export class CardModel {
  static createDefault(_x: number, _y: number, createdBy?: string, createdColor?: string): Card {
    return {
      id: `card-${Date.now()}`,
      elementType: 'card',
      text: '',
      createdBy,
      createdColor,
    };
  }

  static createFromData(data: Partial<Card>): Card {
    return {
      id: data.id || `card-${Date.now()}`,
      elementType: 'card',
      text: data.text || '',
      createdBy: data.createdBy,
      createdColor: data.createdColor,
    };
  }

  static calculateHeight(text: string): number {
    if (!text) return CARD_MIN_HEIGHT;
    const lines = text.split('\n').length;
    return Math.max(CARD_MIN_HEIGHT, lines * LINE_HEIGHT + 40);
  }
}
