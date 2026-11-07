export type BoardScalar = number;

export function quantizeScalar(value: number): BoardScalar {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value / 15) * 15;
  //return Math.round(value * 10) / 10;
}

export function quantizeNonNegative(value: number): BoardScalar {
  return Math.max(0, quantizeScalar(value));
}

export function quantizePoint<T extends { x: number; y: number }>(point: T): T {
  return { ...point, x: quantizeScalar(point.x), y: quantizeScalar(point.y) };
}

export function quantizeSize<T extends { width?: number; height?: number }>(size: T): T {
  const result = { ...size };
  if (typeof size.width === 'number') result.width = quantizeScalar(size.width);
  if (typeof size.height === 'number') result.height = quantizeScalar(size.height);
  return result;
}

export function quantizeGeometry<T extends { x: number; y: number; width?: number; height?: number }>(value: T): T {
  return quantizeSize(quantizePoint(value));
}

export function quantizeGeometryUpdates<T extends { x?: number; y?: number; width?: number; height?: number }>(value: T): T {
  const result = { ...value };
  if (typeof value.x === 'number') result.x = quantizeScalar(value.x);
  if (typeof value.y === 'number') result.y = quantizeScalar(value.y);
  if (typeof value.width === 'number') result.width = quantizeScalar(value.width);
  if (typeof value.height === 'number') result.height = quantizeScalar(value.height);
  return result;
}
