import type { BoardScalar } from '../shared/geometry.js';

export interface Element {
  id: string;
  x: BoardScalar;
  y: BoardScalar;
  width?: BoardScalar;
  height?: BoardScalar;
}
