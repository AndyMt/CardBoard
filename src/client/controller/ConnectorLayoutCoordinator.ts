import type { Card } from '../../types/Card.js';
import type { Group } from '../../types/Group.js';
import type { Connection } from '../../types/Connection.js';
import {
  compressPoints,
  findOrthogonalPath,
  orthogonalCandidates,
  pathLength,
  rectInflated,
  segmentIntersectsRect,
  segmentRect,
  type Point,
  type Rect,
} from '../../shared/geometry.js';

export interface ConnectorRoute {
  points: Point[];
}

export interface ConnectorLabelAnchor {
  x: number;
  y: number;
  vertical: boolean;
}

export interface ConnectorLayout {
  routes: Map<string, ConnectorRoute>;
  labels: Map<string, ConnectorLabelAnchor>;
}

export interface ConnectorLayoutOptions {
  obstacleMargin?: number;
  laneGap?: number;
  fanSpacing?: number;
  labelOffset?: number;
  tipInset?: number;
  bendPenalty?: number;
  crossPenalty?: number;
  labelCharWidth?: number;
  labelHeight?: number;
}

type Side = 'left' | 'right' | 'top' | 'bottom';

const DEFAULT_CARD_WIDTH = 200;
const DEFAULT_CARD_HEIGHT = 60;

function cardRect(card: Card): Rect {
  return {
    x: card.x || 0,
    y: card.y || 0,
    width: card.width || DEFAULT_CARD_WIDTH,
    height: card.height || DEFAULT_CARD_HEIGHT,
  };
}

function centerOf(r: Rect): Point {
  return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(Math.max(v, lo), hi);
}

function opposite(side: Side): Side {
  switch (side) {
    case 'left': return 'right';
    case 'right': return 'left';
    case 'top': return 'bottom';
    case 'bottom': return 'top';
  }
}

function portOnSide(r: Rect, side: Side, offset: number, inset: number): Point {
  const midX = r.x + r.width / 2;
  const midY = r.y + r.height / 2;
  switch (side) {
    case 'right':
      return { x: r.x + r.width - inset, y: clamp(midY + offset, r.y + inset, r.y + r.height - inset) };
    case 'left':
      return { x: r.x + inset, y: clamp(midY + offset, r.y + inset, r.y + r.height - inset) };
    case 'top':
      return { x: clamp(midX + offset, r.x + inset, r.x + r.width - inset), y: r.y + inset };
    case 'bottom':
      return { x: clamp(midX + offset, r.x + inset, r.x + r.width - inset), y: r.y + r.height - inset };
  }
}

function rectsOverlap(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

interface RoutedEntry {
  connId: string;
  name: string;
  labelSegment: { a: Point; b: Point };
}

// Pure, stateless coordinator: computes orthogonal routes for all connections
// (routing around cards, avoiding already-routed connectors) plus de-overlapped
// label anchors. Never mutates the Card/Group/Connection models.
export class ConnectorLayoutCoordinator {
  computeLayout(cards: Card[], groups: Group[], options?: ConnectorLayoutOptions): ConnectorLayout {
    void groups; // groups are crossable, deliberately not obstacles
    const obstacleMargin = options?.obstacleMargin ?? 8;
    const laneGap = options?.laneGap ?? 4;
    const fanSpacing = options?.fanSpacing ?? 15;
    const labelOffset = options?.labelOffset ?? 4;
    const tipInset = options?.tipInset ?? 0;
    const bendPenalty = options?.bendPenalty ?? 20;
    const crossPenalty = options?.crossPenalty ?? 10;
    const labelCharWidth = options?.labelCharWidth ?? 6;
    const labelHeight = options?.labelHeight ?? 15;

    const rects = new Map<string, Rect>();
    for (const c of cards) rects.set(c.id, cardRect(c));
    const cardById = new Map(cards.map((c) => [c.id, c]));

    const entries: { conn: Connection; source: Card; target: Card; index: number; total: number }[] = [];
    for (const source of cards) {
      const conns = source.connections || [];
      const countByTarget = new Map<string, number>();
      for (const conn of conns) {
        if (!cardById.has(conn.targetCardId)) continue;
        countByTarget.set(conn.targetCardId, (countByTarget.get(conn.targetCardId) || 0) + 1);
      }
      const seen = new Map<string, number>();
      for (const conn of conns) {
        const target = cardById.get(conn.targetCardId);
        if (!target) continue;
        const total = countByTarget.get(conn.targetCardId) || 1;
        const index = seen.get(conn.targetCardId) || 0;
        seen.set(conn.targetCardId, index + 1);
        entries.push({ conn, source, target, index, total });
      }
    }
    entries.sort((a, b) => (a.conn.id < b.conn.id ? -1 : a.conn.id > b.conn.id ? 1 : 0));

    const occupied: Rect[] = [];
    const routes = new Map<string, ConnectorRoute>();
    const routed: RoutedEntry[] = [];

    for (const entry of entries) {
      const srcRect = rects.get(entry.source.id)!;
      const tgtRect = rects.get(entry.target.id)!;
      // Other cards are inflated obstacles; the endpoint cards themselves are
      // plain obstacles so routes never cross them, while ports on their border
      // (inset 0) stay reachable because only rect interiors block.
      const obstacles: Rect[] = [];
      for (const [id, r] of rects) {
        if (id === entry.source.id || id === entry.target.id) obstacles.push(r);
        else obstacles.push(rectInflated(r, obstacleMargin));
      }
      const fanOffset = (entry.index - (entry.total - 1) / 2) * fanSpacing;
      const route = this.routeBetween(srcRect, tgtRect, fanOffset, tipInset, obstacles, occupied, bendPenalty, crossPenalty);
      routes.set(entry.conn.id, route);
      for (let i = 1; i < route.points.length; i++) {
        occupied.push(rectInflated(segmentRect(route.points[i - 1], route.points[i]), laneGap));
      }
      let labelSegment = { a: route.points[0], b: route.points[route.points.length - 1] };
      let bestLen = -1;
      for (let i = 1; i < route.points.length; i++) {
        const len = Math.abs(route.points[i].x - route.points[i - 1].x) + Math.abs(route.points[i].y - route.points[i - 1].y);
        if (len > bestLen) {
          bestLen = len;
          labelSegment = { a: route.points[i - 1], b: route.points[i] };
        }
      }
      routed.push({ connId: entry.conn.id, name: entry.conn.name || '', labelSegment });
    }

    const labels = this.resolveLabels(routed, labelOffset, labelCharWidth, labelHeight);
    return { routes, labels };
  }

  computePreviewRoute(cards: Card[], sourceId: string, pointer: Point, tipInset = 0): ConnectorRoute | null {
    const source = cards.find((c) => c.id === sourceId);
    if (!source) return null;
    const srcRect = cardRect(source);
    const c1 = centerOf(srcRect);
    const dx = pointer.x - c1.x;
    const dy = pointer.y - c1.y;
    const horiz = Math.abs(dx) >= Math.abs(dy);
    const side: Side = horiz ? (dx >= 0 ? 'right' : 'left') : (dy >= 0 ? 'bottom' : 'top');
    const srcPort = portOnSide(srcRect, side, 0, tipInset);
    return { points: compressPoints(orthogonalCandidates(srcPort, pointer)[0]) };
  }

  private routeBetween(
    srcRect: Rect,
    tgtRect: Rect,
    fanOffset: number,
    tipInset: number,
    obstacles: Rect[],
    occupied: Rect[],
    bendPenalty: number,
    crossPenalty: number,
  ): ConnectorRoute {
    const c1 = centerOf(srcRect);
    const c2 = centerOf(tgtRect);
    const dx = c2.x - c1.x;
    const dy = c2.y - c1.y;
    const horiz = Math.abs(dx) >= Math.abs(dy);
    const srcMain: Side = horiz ? (dx >= 0 ? 'right' : 'left') : (dy >= 0 ? 'bottom' : 'top');
    const tgtMain: Side = opposite(srcMain);
    const srcAlt: Side = horiz ? (dy >= 0 ? 'bottom' : 'top') : (dx >= 0 ? 'right' : 'left');
    const tgtAlt: Side = opposite(srcAlt);
    const pairs: { src: Side; tgt: Side }[] = [
      { src: srcMain, tgt: tgtMain },
      { src: srcAlt, tgt: tgtMain },
      { src: srcMain, tgt: tgtAlt },
      { src: srcAlt, tgt: tgtAlt },
    ];

    let best: ConnectorRoute | null = null;
    let bestCost = Infinity;
    for (const pair of pairs) {
      const srcPort = portOnSide(srcRect, pair.src, fanOffset, tipInset);
      const tgtPort = portOnSide(tgtRect, pair.tgt, fanOffset, 0);
      for (const cand of orthogonalCandidates(srcPort, tgtPort)) {
        let blocked = false;
        let crossings = 0;
        for (let i = 1; i < cand.length && !blocked; i++) {
          const a = cand[i - 1];
          const b = cand[i];
          for (const o of obstacles) {
            if (segmentIntersectsRect(a, b, o)) {
              blocked = true;
              break;
            }
          }
          if (!blocked) {
            for (const o of occupied) {
              if (segmentIntersectsRect(a, b, o)) crossings++;
            }
          }
        }
        if (blocked) continue;
        const len = pathLength(cand);
        const cost = len + bendPenalty * (cand.length - 2) + crossings * crossPenalty * len;
        if (cost < bestCost) {
          bestCost = cost;
          best = { points: cand };
        }
      }
    }
    if (best) return best;

    // Fallback: A* on the visibility grid, trying each side pair in order.
    let fallback: ConnectorRoute | null = null;
    for (const pair of pairs) {
      const srcPort = portOnSide(srcRect, pair.src, fanOffset, tipInset);
      const tgtPort = portOnSide(tgtRect, pair.tgt, fanOffset, 0);
      const path = findOrthogonalPath(srcPort, tgtPort, { obstacles, occupied, bendPenalty, crossPenalty });
      if (path) return { points: path };
      if (!fallback) fallback = { points: compressPoints(orthogonalCandidates(srcPort, tgtPort)[0]) };
    }
    return fallback ?? { points: [{ x: 0, y: 0 }, { x: 0, y: 0 }] };
  }

  private resolveLabels(
    routed: RoutedEntry[],
    labelOffset: number,
    charWidth: number,
    height: number,
  ): Map<string, ConnectorLabelAnchor> {
    const labels = new Map<string, ConnectorLabelAnchor>();
    const placed: Rect[] = [];
    for (const entry of routed) {
      const { a, b } = entry.labelSegment;
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const vertical = Math.abs(b.x - a.x) < 0.5;
      const text = entry.name || '?';
      const w = Math.max(14, text.length * charWidth + 8);
      let cur: ConnectorLabelAnchor = vertical
        ? { x: mid.x + labelOffset, y: mid.y, vertical }
        : { x: mid.x, y: mid.y + labelOffset, vertical };
      const boxOf = (p: ConnectorLabelAnchor): Rect =>
        vertical
          ? { x: p.x, y: p.y - height / 2, width: w, height }
          : { x: p.x - w / 2, y: p.y, width: w, height };
      for (let iter = 0; iter < 32; iter++) {
        const box = boxOf(cur);
        const hit = placed.find((pl) => rectsOverlap(box, pl));
        if (!hit) break;
        if (iter === 16) {
          // flip to the opposite side of the line
          if (vertical) cur = { ...cur, x: mid.x - labelOffset - w };
          else cur = { ...cur, y: mid.y - labelOffset - height };
          continue;
        }
        const cx = box.x + box.width / 2;
        const cy = box.y + box.height / 2;
        const hx = hit.x + hit.width / 2;
        const hy = hit.y + hit.height / 2;
        if (vertical) cur = { ...cur, y: cur.y + (cy >= hy ? 8 : -8) };
        else cur = { ...cur, x: cur.x + (cx >= hx ? 8 : -8) };
      }
      placed.push(boxOf(cur));
      labels.set(entry.connId, cur);
    }
    return labels;
  }
}

export default ConnectorLayoutCoordinator;
