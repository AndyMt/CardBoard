import { Card as CardInterface } from '../../types/Card.js';

export class Card implements CardInterface {
  id: string;
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;

  constructor({ id, text, x, y, width = 200, height }: Partial<CardInterface> = {}) {
    this.id = id || '';
    this.text = text || '';
    this.x = x || 0;
    this.y = y || 0;
    this.width = width;
    this.height = height ?? this.calculateHeight(text || '');
  }

  private calculateHeight(text: string): number {
    const lines = Math.ceil(text.length / 30);
    return lines * 20; // 20px per line
  }
}