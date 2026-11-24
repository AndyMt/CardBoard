export type BoardScalar = number;

export function quantizeScalar(value: number): BoardScalar {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value / 15) * 15;
}

export function quantizePrecise(value: number): BoardScalar {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 10) / 10;
}

export function quantizeNonNegative(value: number): BoardScalar {
  return Math.max(0, quantizeScalar(value));
}

export function quantizePreciseNonNegative(value: number): BoardScalar {
  return Math.max(0, quantizePrecise(value));
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

export function lineRectEntryPoint(
  sx: number,
  sy: number,
  tx: number,
  ty: number,
  rect: { x: number; y: number; width: number; height: number },
  inset = 0,
): { x: number; y: number } {
  const inner = {
    x: rect.x + inset,
    y: rect.y + inset,
    width: rect.width - inset * 2,
    height: rect.height - inset * 2,
  };
  const dx = tx - sx;
  const dy = ty - sy;
  let tEnter = 0;
  let tExit = 1;
  const boundaries: [number, number][] = [
    [-dx, sx - inner.x],
    [dx, inner.x + inner.width - sx],
    [-dy, sy - inner.y],
    [dy, inner.y + inner.height - sy],
  ];
  for (const [p, q] of boundaries) {
    if (p === 0) {
      if (q < 0) return { x: tx, y: ty };
      continue;
    }
    const r = q / p;
    if (p < 0) {
      tEnter = Math.max(tEnter, r);
    } else {
      tExit = Math.min(tExit, r);
    }
  }
  if (tEnter > tExit) return { x: tx, y: ty };
  const t = Math.min(Math.max(tEnter, 0), 1);
  return { x: sx + dx * t, y: sy + dy * t };
}

export interface Point {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function rectInflated(rect: Rect, margin: number): Rect {
  return {
    x: rect.x - margin,
    y: rect.y - margin,
    width: rect.width + margin * 2,
    height: rect.height + margin * 2,
  };
}

export function segmentRect(a: Point, b: Point): Rect {
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    width: Math.abs(b.x - a.x),
    height: Math.abs(b.y - a.y),
  };
}

// True when the segment passes through the OPEN interior of the rect.
// Merely touching the rect boundary does not count.
export function segmentIntersectsRect(a: Point, b: Point, rect: Rect): boolean {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  if (dx === 0 && dy === 0) {
    return a.x > rect.x && a.x < rect.x + rect.width && a.y > rect.y && a.y < rect.y + rect.height;
  }
  if (dy === 0) {
    if (!(a.y > rect.y && a.y < rect.y + rect.height)) return false;
    return Math.max(a.x, b.x) > rect.x && Math.min(a.x, b.x) < rect.x + rect.width;
  }
  if (dx === 0) {
    if (!(a.x > rect.x && a.x < rect.x + rect.width)) return false;
    return Math.max(a.y, b.y) > rect.y && Math.min(a.y, b.y) < rect.y + rect.height;
  }
  let tEnter = 0;
  let tExit = 1;
  const boundaries: [number, number][] = [
    [-dx, a.x - rect.x],
    [dx, rect.x + rect.width - a.x],
    [-dy, a.y - rect.y],
    [dy, rect.y + rect.height - a.y],
  ];
  for (const [p, q] of boundaries) {
    if (p === 0) {
      if (q < 0) return false;
      continue;
    }
    const r = q / p;
    if (p < 0) {
      tEnter = Math.max(tEnter, r);
    } else {
      tExit = Math.min(tExit, r);
    }
  }
  return tEnter < tExit && tExit > 0 && tEnter < 1;
}

// Orthogonal (90°) candidate paths between two points: straight (if aligned),
// the two L-shapes, and two Z-shapes through the mid lines.
export function orthogonalCandidates(p1: Point, p2: Point): Point[][] {
  if (p1.x === p2.x || p1.y === p2.y) {
    return [[p1, p2]];
  }
  const midX = (p1.x + p2.x) / 2;
  const midY = (p1.y + p2.y) / 2;
  return [
    [p1, { x: p2.x, y: p1.y }, p2],
    [p1, { x: p1.x, y: p2.y }, p2],
    [p1, { x: midX, y: p1.y }, { x: midX, y: p2.y }, p2],
    [p1, { x: p1.x, y: midY }, { x: p2.x, y: midY }, p2],
  ];
}

export function pathLength(points: Point[]): number {
  let len = 0;
  for (let i = 1; i < points.length; i++) {
    len += Math.abs(points[i].x - points[i - 1].x) + Math.abs(points[i].y - points[i - 1].y);
  }
  return len;
}

export function compressPoints(points: Point[]): Point[] {
  if (points.length <= 2) return points;
  const out: Point[] = [points[0]];
  for (let i = 1; i < points.length - 1; i++) {
    const prev = out[out.length - 1];
    const cur = points[i];
    const next = points[i + 1];
    const collinear = (prev.x === cur.x && cur.x === next.x) || (prev.y === cur.y && cur.y === next.y);
    if (!collinear) out.push(cur);
  }
  out.push(points[points.length - 1]);
  return out;
}

export interface OrthogonalPathOptions {
  obstacles: Rect[];
  occupied: Rect[];
  bendPenalty?: number;
  crossPenalty?: number;
}

// A* on the visibility grid (grid lines at start/goal and obstacle borders),
// restricted to horizontal/vertical edges. Edges may touch but not enter
// obstacle interiors; crossing an occupied rect costs crossPenalty * length
// per rect. Returns the compressed point list, or null when unroutable.
export function findOrthogonalPath(start: Point, goal: Point, options: OrthogonalPathOptions): Point[] | null {
  const { obstacles, occupied } = options;
  const bendPenalty = options.bendPenalty ?? 20;
  const crossPenalty = options.crossPenalty ?? 10;

  const xs = new Set<number>([start.x, goal.x]);
  const ys = new Set<number>([start.y, goal.y]);
  for (const o of obstacles) {
    xs.add(o.x);
    xs.add(o.x + o.width);
    ys.add(o.y);
    ys.add(o.y + o.height);
  }
  const xList = [...xs].sort((a, b) => a - b);
  const yList = [...ys].sort((a, b) => a - b);
  const nx = xList.length;
  const ny = yList.length;
  const xIndex = new Map(xList.map((v, i) => [v, i] as [number, number]));
  const yIndex = new Map(yList.map((v, i) => [v, i] as [number, number]));
  const sx = xIndex.get(start.x);
  const sy = yIndex.get(start.y);
  const gx = xIndex.get(goal.x);
  const gy = yIndex.get(goal.y);
  if (sx === undefined || sy === undefined || gx === undefined || gy === undefined) return null;

  // Blocked open intervals per grid row/column derived from obstacle interiors.
  const rowBlocked: [number, number][][] = yList.map((y) =>
    obstacles
      .filter((o) => y > o.y && y < o.y + o.height)
      .map((o) => [o.x, o.x + o.width] as [number, number])
      .sort((a, b) => a[0] - b[0])
  );
  const colBlocked: [number, number][][] = xList.map((x) =>
    obstacles
      .filter((o) => x > o.x && x < o.x + o.width)
      .map((o) => [o.y, o.y + o.height] as [number, number])
      .sort((a, b) => a[0] - b[0])
  );

  const edgeBlocked = (a: Point, b: Point): boolean => {
    if (a.y === b.y) {
      const yi = yIndex.get(a.y);
      if (yi === undefined) return true;
      const lo = Math.min(a.x, b.x);
      const hi = Math.max(a.x, b.x);
      return rowBlocked[yi].some(([l, h]) => hi > l && lo < h);
    }
    const xi = xIndex.get(a.x);
    if (xi === undefined) return true;
    const lo = Math.min(a.y, b.y);
    const hi = Math.max(a.y, b.y);
    return colBlocked[xi].some(([l, h]) => hi > l && lo < h);
  };
  const edgeCrossings = (a: Point, b: Point): number => {
    let count = 0;
    for (const o of occupied) {
      if (segmentIntersectsRect(a, b, o)) count++;
    }
    return count;
  };

  // A* over (node, incoming direction) states: dir 0 = horizontal, 1 = vertical, 2 = start.
  const nodeCount = nx * ny;
  const gScore = new Float64Array(nodeCount * 3).fill(Infinity);
  const fScore = new Float64Array(nodeCount * 3).fill(Infinity);
  const parent = new Int32Array(nodeCount * 3).fill(-1);
  const startNode = sy * nx + sx;
  const goalNode = gy * nx + gx;
  const startState = startNode * 3 + 2;
  gScore[startState] = 0;
  const h = (node: number): number => {
    const xi = node % nx;
    const yi = Math.floor(node / nx);
    return Math.abs(xList[xi] - xList[gx]) + Math.abs(yList[yi] - yList[gy]);
  };
  fScore[startState] = h(startNode);

  const heapS: number[] = [startState];
  const heapF: number[] = [fScore[startState]];
  const heapPush = (s: number, f: number) => {
    heapS.push(s);
    heapF.push(f);
    let i = heapS.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (heapF[p] <= heapF[i]) break;
      [heapS[p], heapS[i]] = [heapS[i], heapS[p]];
      [heapF[p], heapF[i]] = [heapF[i], heapF[p]];
      i = p;
    }
  };
  const heapPop = (): number => {
    const top = heapS[0];
    const lastS = heapS.pop()!;
    const lastF = heapF.pop()!;
    if (heapS.length > 0) {
      heapS[0] = lastS;
      heapF[0] = lastF;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < heapS.length && heapF[l] < heapF[m]) m = l;
        if (r < heapS.length && heapF[r] < heapF[m]) m = r;
        if (m === i) break;
        [heapS[m], heapS[i]] = [heapS[i], heapS[m]];
        [heapF[m], heapF[i]] = [heapF[i], heapF[m]];
        i = m;
      }
    }
    return top;
  };
  heapPush(startState, fScore[startState]);

  let goalState = -1;
  while (heapS.length > 0) {
    const s = heapPop();
    const node = Math.floor(s / 3);
    const dir = s % 3;
    if (gScore[s] + h(node) > fScore[s] + 1e-9) continue; // stale heap entry
    if (node === goalNode) {
      goalState = s;
      break;
    }
    const xi = node % nx;
    const yi = Math.floor(node / nx);
    const px = xList[xi];
    const py = yList[yi];
    for (let dir2 = 0; dir2 < 2; dir2++) {
      for (let t = 0; t < (dir2 === 0 ? nx : ny); t++) {
        if (dir2 === 0 && t === xi) continue;
        if (dir2 === 1 && t === yi) continue;
        const qx = dir2 === 0 ? xList[t] : px;
        const qy = dir2 === 0 ? py : yList[t];
        const a = { x: px, y: py };
        const b = { x: qx, y: qy };
        if (edgeBlocked(a, b)) continue;
        const len = Math.abs(qx - px) + Math.abs(qy - py);
        let cost = len + (dir !== 2 && dir !== dir2 ? bendPenalty : 0);
        const crossings = edgeCrossings(a, b);
        if (crossings > 0) cost += crossings * crossPenalty * len;
        const nn = dir2 === 0 ? yi * nx + t : t * nx + xi;
        const ns = nn * 3 + dir2;
        const g = gScore[s] + cost;
        if (g < gScore[ns] - 1e-9) {
          gScore[ns] = g;
          parent[ns] = s;
          fScore[ns] = g + h(nn);
          heapPush(ns, fScore[ns]);
        }
      }
    }
  }
  if (goalState === -1) {
    let best = Infinity;
    for (let d = 0; d < 3; d++) {
      const s = goalNode * 3 + d;
      if (gScore[s] < best) {
        best = gScore[s];
        goalState = s;
      }
    }
    if (goalState === -1 || best === Infinity) return null;
  }

  const points: Point[] = [];
  let s = goalState;
  while (s !== -1) {
    const node = Math.floor(s / 3);
    points.push({ x: xList[node % nx], y: yList[Math.floor(node / nx)] });
    s = parent[s];
  }
  points.reverse();
  return compressPoints(points);
}
