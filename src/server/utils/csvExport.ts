import type { Card } from '../../types/Card.js';
import type { Group } from '../../types/Group.js';

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

export function buildMappingCsv(cards: Card[], groups: Group[]): string {
  const groupById = new Map(groups.map((g) => [g.id, g]));
  const dataRows: string[][] = [];
  for (const group of groups) {
    for (const card of cards) {
      if (card.groupId !== group.id) continue;
      const resolved = groupById.get(card.groupId);
      if (!resolved) continue;
      dataRows.push([resolved.label ?? '', card.text ?? '']);
    }
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
  board: { cards: Card[]; groups: Group[] }
): string {
  switch (type) {
    case 'cards':
      return buildCardsCsv(board.cards ?? []);
    case 'groups':
      return buildGroupsCsv(board.groups ?? []);
    case 'mapping':
      return buildMappingCsv(board.cards ?? [], board.groups ?? []);
  }
}
