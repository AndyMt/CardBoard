import { quantizeScalar } from '../../shared/geometry.js';

export class ElementModel {
  static createBase(x: number, y: number, width: number, height: number) {
    return {
      x: quantizeScalar(x),
      y: quantizeScalar(y),
      width: quantizeScalar(width),
      height: quantizeScalar(height),
    };
  }
}
