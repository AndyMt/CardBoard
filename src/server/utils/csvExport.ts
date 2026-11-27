import type { Card } from '../../types/Card.js';
import type { Group } from '../../types/Group.js';
import type { Element } from '../../types/Element.js';
import type { Reference } from '../../types/Reference.js';

export type BoardExportType = 'cards' | 'groups' | 'mapping';

const BOM = '\uFEFF';

function escapeCsvField(value: string, delimiter: ',' | '\t'): string {
  const s = value ?? '';
  const needsQuotes =
    s.includes('"') || s.includes('\n') || s.includes('\r') || s.includes(delimiter);
  if (!needsQuotes) return s;
  return `"${s.replace(/"/g, '""')}"`;
}

function row(fields: string[], delimiter: ',' | '\t'): string {
  return fields.map((f) => escapeCsvField(f, delimiter)).join(delimiter);
}

function toCsv(headers: string[], dataRows: string[][], delimiter: ',' | '\t'): string {
  const lines = [row(headers, delimiter), ...dataRows.map((r) => row(r, delimiter))];
  return BOM + lines.join('\n') + '\n';
}

export function buildCardsCsv(cards: Card[]): string {
  const dataRows = cards.map((card) => [card.text ?? '']);
  return toCsv(['card'], dataRows, ',');
}

export function buildGroupsCsv(groups: Group[]): string {
  const dataRows = groups.map((group) => [group.label ?? '']);
  return toCsv(['group'], dataRows, ',');
}

export function buildMappingCsv(elements: Element[], references: Reference[]): string {
  const cards = elements.filter((e) => e.elementType === 'card') as Card[];
  const groups = elements.filter((e) => e.elementType === 'group') as Group[];
  const cardById = new Map(cards.map((c) => [c.id, c]));
  const groupById = new Map(groups.map((g) => [g.id, g]));
  const dataRows: string[][] = [];
  const seen = new Set<string>();
  for (const ref of references) {
    if (!ref.groupId) continue;
    const key = `${ref.groupId}|${ref.elementId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const group = groupById.get(ref.groupId);
    const card = cardById.get(ref.elementId);
    if (!group || !card) continue;
    dataRows.push([group.label ?? '', card.text ?? '']);
  }
  return toCsv(['group', 'card'], dataRows, '\t');
}

export function getExportFilename(type: BoardExportType): string {
  switch (type) {
    case 'cards':
      return 'board-cards.csv';
    case 'groups':
      return 'board-groups.csv';
    case 'mapping':
      return 'board-mapping.csv';
  }
}

export function buildBoardExportCsv(
  type: BoardExportType,
  board: { elements: Element[]; references?: Reference[] }
): string {
  const cards = board.elements.filter((e) => e.elementType === 'card') as Card[];
  const groups = board.elements.filter((e) => e.elementType === 'group') as Group[];
  switch (type) {
    case 'cards':
      return buildCardsCsv(cards ?? []);
    case 'groups':
      return buildGroupsCsv(groups ?? []);
    case 'mapping':
      return buildMappingCsv(board.elements, board.references ?? []);
  }
}
