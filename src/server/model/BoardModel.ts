import type { Card } from '../../types/Card.js';
import type { Group } from '../../types/Group.js';
import type { View } from '../../types/View.js';
import type { Reference } from '../../types/Reference.js';
import { quantizeScalar, quantizeGeometry } from '../../shared/geometry.js';

export interface BoardModel {
  cards: Card[];
  groups: Group[];
  views: View[];
  references: Reference[];
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
    cards: [],
    groups: [],
    views: [defaultView, functionalView],
    references: [],
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
    this.board.cards.push(card);
    this.board.lastUpdated = new Date().toISOString();
  }

  addGroup(group: Group): void {
    this.board.groups.push(group);
    this.board.lastUpdated = new Date().toISOString();
  }

  addView(view: View): void {
    this.board.views.push(view);
    this.board.lastUpdated = new Date().toISOString();
  }

  addReference(reference: Reference): void {
    this.board.references.push(quantizeGeometry(reference));
    this.board.lastUpdated = new Date().toISOString();
  }

  updateReference(
    referenceId: string,
    updates: Partial<Pick<Reference, 'x' | 'y' | 'width' | 'height' | 'groupId' | 'viewId'>>,
  ): void {
    const idx = this.board.references.findIndex((r) => r.id === referenceId);
    if (idx === -1) return;
    const next = { ...this.board.references[idx], ...quantizeGeometry(updates as Reference) };
    this.board.references[idx] = next;
    this.board.lastUpdated = new Date().toISOString();
  }

  removeReference(referenceId: string): void {
    this.board.references = this.board.references.filter((r) => r.id !== referenceId);
    this.board.lastUpdated = new Date().toISOString();
  }

  removeReferencesForElement(elementId: string, elementType: 'card' | 'group'): void {
    this.board.references = this.board.references.filter(
      (r) => !(r.elementId === elementId && r.elementType === elementType),
    );
    this.board.lastUpdated = new Date().toISOString();
  }

  clearGroupIdOnReferences(groupId: string): void {
    this.board.references = this.board.references.map((r) =>
      r.groupId === groupId ? { ...r, groupId: undefined } : r,
    );
    this.board.lastUpdated = new Date().toISOString();
  }

  updateCard(cardId: string, updates: Partial<Card>): void {
    const cardIndex = this.board.cards.findIndex((c) => c.id === cardId);
    if (cardIndex >= 0) {
      const next: Card = { ...this.board.cards[cardIndex] };
      if (updates.text !== undefined) next.text = updates.text;
      if (updates.createdBy !== undefined) next.createdBy = updates.createdBy;
      if (updates.createdColor !== undefined) next.createdColor = updates.createdColor;
      this.board.cards[cardIndex] = next;
      this.board.lastUpdated = new Date().toISOString();
    }
  }

  updateGroup(groupId: string, updates: Partial<Group>): void {
    const groupIndex = this.board.groups.findIndex((g) => g.id === groupId);
    if (groupIndex >= 0) {
      this.board.groups[groupIndex] = { ...this.board.groups[groupIndex], ...updates };
      this.board.lastUpdated = new Date().toISOString();
    }
  }

  deleteCard(cardId: string): void {
    this.board.cards = this.board.cards.filter((c) => c.id !== cardId);
    this.removeReferencesForElement(cardId, 'card');
    this.board.lastUpdated = new Date().toISOString();
  }

  deleteGroup(groupId: string): void {
    this.board.groups = this.board.groups.filter((g) => g.id !== groupId);
    this.removeReferencesForElement(groupId, 'group');
    this.clearGroupIdOnReferences(groupId);
    this.board.lastUpdated = new Date().toISOString();
  }

  getActiveViewId(): string | undefined {
    const d = this.board.views.find((v) => v.isDefault);
    return d?.id;
  }
}
