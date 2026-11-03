import { Card } from '../../types/Card';

const CARD_WIDTH = 200; // Default card width
const CARD_MIN_HEIGHT = 60; // Minimum card height
const LINE_HEIGHT = 20; // px

export class CardModel {
  static createDefault(x: number, y: number): Card {
    return {
      id: `card-${Date.now()}`,
      text: '',
      x: x - CARD_WIDTH / 2, // Center the card on the click position
      y: y - 30, // Account for card header height
      width: CARD_WIDTH,
      height: CARD_MIN_HEIGHT
    };
  }
  
  static createFromData(data: Partial<Card>): Card {
    return {
      id: data.id || `card-${Date.now()}`,
      text: data.text || '',
      x: data.x || 0,
      y: data.y || 0,
      width: data.width || CARD_WIDTH,
      height: data.height || CARD_MIN_HEIGHT
    };
  }
  
  static calculateHeight(text: string): number {
    if (!text) return CARD_MIN_HEIGHT;
    const lines = text.split('\n').length;
    return Math.max(CARD_MIN_HEIGHT, lines * LINE_HEIGHT + 40); // Add padding
  }
}