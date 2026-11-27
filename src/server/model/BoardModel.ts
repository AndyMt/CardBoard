import type { Card } from '../../types/Card.js';
import type { Group } from '../../types/Group.js';
import type { View } from '../../types/View.js';
import type { Reference } from '../../types/Reference.js';
import type { Element } from '../../types/Element.js';

export interface BoardModel {
  elements: Element[];
  views: View[];
  references: Reference[];
  version?: string;
  lastUpdated: string;
}

export const createDefaultBoard = (): BoardModel => {
  const defaultView: View = {
    id: `view-${Date.now()}`,
    name: 'Usecase',
    type: 'Usecase',
    isDefault: true,
  };
  const functionalView: View = {
    id: `view-${Date.now() + 1}`,
    name: 'Functional',
    type: 'Functional',
  };
  return {
    elements: [],
    views: [defaultView, functionalView],
    references: [],
    version: undefined,
    lastUpdated: new Date().toISOString(),
  };
};

export class BoardModelManager {
  private board: BoardModel;

  constructor(initialBoard?: BoardModel) {
    this.board = initialBoard || createDefaultBoard();
  }

  getBoard(): BoardModel {
    return this.board;
  }

  setBoard(board: BoardModel): void {
    this.board = { ...board, lastUpdated: new Date().toISOString() };
  }

  addCard(card: Card): void {
    this.board.elements.push(card);
    this.board.lastUpdated = new Date().toISOString();
  }

  addGroup(group: Group): void {
    this.board.elements.push(group);
    this.board.lastUpdated = new Date().toISOString();
  }

  addView(view: View): void {
    this.board.views.push(view);
    this.board.lastUpdated = new Date().toISOString();
  }

  addReference(reference: Reference): void {
    this.board.references.push(reference);
    this.board.lastUpdated = new Date().toISOString();
  }

  updateReference(
    referenceId: string,
    updates: Partial<Pick<Reference, 'x' | 'y' | 'width' | 'height' | 'groupId' | 'viewId'>>,
  ): void {
    const idx = this.board.references.findIndex((r) => r.id === referenceId);
    if (idx === -1) return;
    const next = { ...this.board.references[idx], ...updates };
    this.board.references[idx] = next;
    this.board.lastUpdated = new Date().toISOString();
  }

  removeReference(referenceId: string): void {
    this.board.references = this.board.references.filter((r) => r.id !== referenceId);
    this.board.lastUpdated = new Date().toISOString();
  }

  removeReferencesForElement(elementId: string): void {
    this.board.references = this.board.references.filter((r) => r.elementId === elementId);
    this.board.lastUpdated = new Date().toISOString();
  }

  clearGroupIdOnReferences(groupId: string): void {
    this.board.references = this.board.references.map((r) =>
      r.groupId === groupId ? { ...r, groupId: undefined } : r,
    );
    this.board.lastUpdated = new Date().toISOString();
  }

  updateCard(cardId: string, updates: Partial<Card>): void {
    const cardIndex = this.board.elements.findIndex((c) => c.id === cardId && c.elementType === 'card');
    if (cardIndex >= 0) {
      const next: Card = { ...this.board.elements[cardIndex] } as Card;
      if (updates.text !== undefined) next.text = updates.text;
      if (updates.createdBy !== undefined) next.createdBy = updates.createdBy;
      if (updates.createdColor !== undefined) next.createdColor = updates.createdColor;
      this.board.elements[cardIndex] = next;
      this.board.lastUpdated = new Date().toISOString();
    }
  }

  updateGroup(groupId: string, updates: Partial<Group>): void {
    const groupIndex = this.board.elements.findIndex((g) => g.id === groupId && g.elementType === 'group');
    if (groupIndex >= 0) {
      this.board.elements[groupIndex] = { ...this.board.elements[groupIndex], ...updates };
      this.board.lastUpdated = new Date().toISOString();
    }
  }

  deleteCard(cardId: string): void {
    this.board.elements = this.board.elements.filter((c) => c.id !== cardId);
    this.removeReferencesForElement(cardId);
    this.board.lastUpdated = new Date().toISOString();
  }

  deleteGroup(groupId: string): void {
    this.board.elements = this.board.elements.filter((g) => g.id !== groupId);
    this.removeReferencesForElement(groupId);
    this.clearGroupIdOnReferences(groupId);
    this.board.lastUpdated = new Date().toISOString();
  }

  getActiveViewId(): string | undefined {
    const d = this.board.views.find((v) => v.isDefault);
    return d?.id;
  }
}

function idExists(board: BoardModel, id: string): boolean {
  if (board.elements.some((e) => e.id === id)) return true;
  if (board.views.some((v) => v.id === id)) return true;
  if (board.references.some((r) => r.id === id)) return true;
  for (const element of board.elements) {
    if ('elementType' in element && element.elementType === 'card') {
      const card = element as Card;
      if (card.connections && card.connections.some((conn) => conn.id === id)) return true;
    }
  }
  return false;
}

export function getNewId(board: BoardModel, prefix: string): string {
  let ms = Date.now();
  let id: string;
  do {
    id = `${prefix}-${ms}`;
    ms += 1;
  } while (idExists(board, id));
  return id;
}

export function getElementById(board: BoardModel, id: string): Element | undefined {
  return board.elements.find((e) => e.id === id);
}
