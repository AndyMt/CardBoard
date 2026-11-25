import type { Card } from '../../types/Card.js';
import type { Group } from '../../types/Group.js';

export const SYSML_FILENAME = 'board.sysml';

interface ActionCard {
  card: Card;
  cardID: string;
  name: string;
}

interface Port {
  direction: 'in' | 'out';
  port: string;
  item: string;
}

const TRANSLITERATION: Record<string, string> = {
  ä: 'ae', ö: 'oe', ü: 'ue', Ä: 'Ae', Ö: 'Oe', Ü: 'Ue', ß: 'ss',
};

function transliterate(value: string): string {
  return value.replace(/[äöüÄÖÜß]/g, (ch) => TRANSLITERATION[ch] ?? ch);
}

function toIdentifier(raw: string, fallback: string): string {
  const cleaned = transliterate(raw).replace(/[^A-Za-z0-9_]/g, '_');
  const prefixed = /^[0-9]/.test(cleaned) ? `_${cleaned}` : cleaned;
  return prefixed || fallback;
}

function toActionName(raw: string): string {
  const words = transliterate(raw.trim()).split(/\s+/).filter(Boolean);
  if (words.length === 0) return 'unnamed';
  const first = words[0].charAt(0).toLowerCase() + words[0].slice(1);
  const rest = words.slice(1).map((w) => w.charAt(0).toUpperCase() + w.slice(1));
  return toIdentifier([first, ...rest].join(''), 'unnamed');
}

function toTypeName(raw: string): string {
  return toIdentifier(transliterate(raw.trim()), 'Item');
}

function uniqueName(base: string, used: Set<string>): string {
  let candidate = base;
  let n = 2;
  while (used.has(candidate)) {
    candidate = `${base}_${n}`;
    n += 1;
  }
  used.add(candidate);
  return candidate;
}

function compareCardIDs(a: string, b: string): number {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i += 1) {
    const diff = (pa[i] ?? -1) - (pb[i] ?? -1);
    if (diff !== 0) return diff;
  }
  return 0;
}

function parseActionCard(card: Card): ActionCard | null {
  const match = /^\s*=\s*([\d][\d.]*)\s*(.*)$/.exec(card.text ?? '');
  if (!match) return null;
  return { card, cardID: match[1], name: toActionName(match[2]) };
}

function connectionItemName(name: string): string {
  return toTypeName(name.replace(/^\s*%\d+\s*/, ''));
}

function lowerFirst(value: string): string {
  return value.charAt(0).toLowerCase() + value.slice(1);
}

export function buildSysML(board: { cards: Card[]; groups: Group[] }): string {
  const cards = board.cards ?? [];
  const groups = board.groups ?? [];

  const actions = cards
    .map(parseActionCard)
    .filter((a): a is ActionCard => a !== null)
    .sort((a, b) => compareCardIDs(a.cardID, b.cardID));
  const usedActionNames = new Set<string>();
  for (const action of actions) {
    action.name = uniqueName(action.name, usedActionNames);
  }
  const actionByCardId = new Map(actions.map((a) => [a.card.id, a]));

  const itemNames: string[] = [];
  const seenItems = new Set<string>();
  const ports = new Map<string, Port[]>();
  const seenPorts = new Map<string, Set<string>>();
  const flows: string[] = [];
  const seenFlows = new Set<string>();

  for (const action of actions) {
    for (const conn of action.card.connections ?? []) {
      if (!conn.name) continue;
      const target = actionByCardId.get(conn.targetCardId);
      if (!target) continue;
      const item = connectionItemName(conn.name);
      if (!seenItems.has(item)) {
        seenItems.add(item);
        itemNames.push(item);
      }
      const port = lowerFirst(item);
      const sourceKey = `${action.card.id}:out:${port}`;
      const targetKey = `${target.card.id}:in:${port}`;
      const sourceSeen = seenPorts.get(sourceKey) ?? new Set<string>();
      if (!sourceSeen.has(port)) {
        sourceSeen.add(port);
        seenPorts.set(sourceKey, sourceSeen);
        const list = ports.get(action.card.id) ?? [];
        list.push({ direction: 'out', port, item });
        ports.set(action.card.id, list);
      }
      const targetSeen = seenPorts.get(targetKey) ?? new Set<string>();
      if (!targetSeen.has(port)) {
        targetSeen.add(port);
        seenPorts.set(targetKey, targetSeen);
        const list = ports.get(target.card.id) ?? [];
        list.push({ direction: 'in', port, item });
        ports.set(target.card.id, list);
      }
      const flow = `flow of ${item} from ${action.name}.${port} to ${target.name}.${port};`;
      if (!seenFlows.has(flow)) {
        seenFlows.add(flow);
        flows.push(flow);
      }
    }
  }

  const groupPackages = groups
    .filter((g) => /^\s*>/.test(g.label ?? ''))
    .map((g) => ({ group: g, name: toTypeName((g.label ?? '').replace(/^\s*>\s*/, '')) }));
  const usedGroupNames = new Set<string>();
  for (const gp of groupPackages) {
    gp.name = uniqueName(gp.name, usedGroupNames);
  }
  groupPackages.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));

  const lines: string[] = [];
  lines.push('package FunctionalModel{');
  lines.push(' ');
  for (const item of itemNames) {
    lines.push(`   item def ${item};`);
  }
  lines.push(' ');
  lines.push('   package UseCaseActivities{');
  lines.push(' ');
  lines.push('      metadata def Card{');
  lines.push('         attribute cardID:ScalarValues::String;');
  lines.push('      }');
  lines.push('      action overallUseCase {');
  for (const action of actions) {
    lines.push(`         action ${action.name} {@Card{cardID = "${action.cardID}";}`);
    for (const p of ports.get(action.card.id) ?? []) {
      lines.push(`            ${p.direction} item ${p.port}:${p.item};`);
    }
    lines.push('         }');
  }
  for (const flow of flows) {
    lines.push(`         ${flow}`);
  }
  lines.push('      }');
  lines.push('   }');
  lines.push('   package FunctionalGroups{');
  for (const gp of groupPackages) {
    lines.push(`      package ${gp.name}{`);
    const members = actions
      .filter((a) => a.card.groupId === gp.group.id)
      .sort((a, b) => compareCardIDs(a.cardID, b.cardID));
    for (const member of members) {
      lines.push(`         public import UseCaseActivities::overallUseCase::${member.name};`);
    }
    lines.push('      }');
  }
  lines.push('   }');
  lines.push('}');
  return lines.join('\n') + '\n';
}

export async function downloadSysMLExport(): Promise<void> {
  const response = await fetch('/api/board');
  if (!response.ok) {
    throw new Error(`Failed to fetch board: ${response.statusText}`);
  }
  const board = await response.json();
  const sysml = buildSysML({ cards: board.cards ?? [], groups: board.groups ?? [] });
  const blob = new Blob([sysml], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = SYSML_FILENAME;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
