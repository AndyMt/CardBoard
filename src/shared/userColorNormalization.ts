import type { Element } from '../types/Element.js';
import type { User } from '../types/User.js';

export const UNKNOWN_USER_COLOR = '#6b7280';

export interface BoardLike {
  elements: Element[];
  lastUpdated?: string;
}

export interface NormalizeBoardResult<T extends BoardLike> {
  board: T;
  changed: boolean;
}

function hasEffectiveColor(color: string | undefined): color is string {
  return typeof color === 'string' && color.trim().length > 0;
}

type HasCreatedColor = { createdBy?: string; createdColor?: string };

function normalizeCreatedBy(element: HasCreatedColor, usersByName: Map<string, User>): { createdBy?: string; createdColor?: string; changed: boolean } {
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

  const elements = board.elements.map((element) => {
    const next = normalizeCreatedBy(element as HasCreatedColor, usersByName);
    if (!next.changed) return element;
    changed = true;
    return { ...element, createdBy: next.createdBy, createdColor: next.createdColor };
  });

  if (!changed) {
    return { board, changed: false };
  }

  return { board: { ...board, elements }, changed: true };
}
