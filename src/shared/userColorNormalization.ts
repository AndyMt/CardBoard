import type { Card } from '../types/Card.js';
import type { Group } from '../types/Group.js';
import type { User } from '../types/User.js';

export const UNKNOWN_USER_COLOR = '#6b7280';

export interface BoardLike {
  cards: Card[];
  groups: Group[];
  lastUpdated?: string;
}

export interface NormalizeBoardResult<T extends BoardLike> {
  board: T;
  changed: boolean;
}

function hasEffectiveColor(color: string | undefined): color is string {
  return typeof color === 'string' && color.trim().length > 0;
}

function normalizeCreatedBy(element: Pick<Card, 'createdBy' | 'createdColor'>, usersByName: Map<string, User>): { createdBy?: string; createdColor?: string; changed: boolean } {
  const createdBy = element.createdBy?.trim() || undefined;
  if (createdBy) {
    const user = usersByName.get(createdBy);
    if (user) {
      const nextColor = user.color || UNKNOWN_USER_COLOR;
      return {
        createdBy,
        createdColor: nextColor,
        changed: element.createdBy !== createdBy || element.createdColor !== nextColor,
      };
    }
    return {
      createdBy: undefined,
      createdColor: UNKNOWN_USER_COLOR,
      changed: element.createdBy !== undefined || element.createdColor !== UNKNOWN_USER_COLOR,
    };
  }

  if (hasEffectiveColor(element.createdColor)) {
    return {
      createdBy: undefined,
      createdColor: element.createdColor,
      changed: element.createdBy !== undefined,
    };
  }

  return {
    createdBy: undefined,
    createdColor: UNKNOWN_USER_COLOR,
    changed: element.createdBy !== undefined || element.createdColor !== UNKNOWN_USER_COLOR,
  };
}

export function normalizeBoardModel<T extends BoardLike>(board: T, users: User[]): NormalizeBoardResult<T> {
  const usersByName = new Map<string, User>();
  for (const user of users) {
    if (user?.name) {
      usersByName.set(user.name, user);
    }
  }

  let changed = false;

  const cards = board.cards.map((card) => {
    const next = normalizeCreatedBy(card, usersByName);
    if (!next.changed) return card;
    changed = true;
    return { ...card, createdBy: next.createdBy, createdColor: next.createdColor };
  });

  const groups = board.groups.map((group) => {
    const next = normalizeCreatedBy(group, usersByName);
    if (!next.changed) return group;
    changed = true;
    return { ...group, createdBy: next.createdBy, createdColor: next.createdColor };
  });

  if (!changed) {
    return { board, changed: false };
  }

  return { board: { ...board, cards, groups }, changed: true };
}

