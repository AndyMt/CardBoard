import { useState, useEffect, useRef, useMemo } from 'react';
import Card from './Card.js';
import Group from './Group.js';
import { ConnectionRenderer } from './ConnectionRenderer.js';
import { Card as CardType } from '../../types/Card.js';
import { Group as GroupType } from '../../types/Group.js';
import { View as ViewType } from '../../types/View.js';
import { Reference as ReferenceType } from '../../types/Reference.js';
import type { Connection } from '../../types/Connection.js';
import { User } from '../../types/User.js';
import BoardService from '../services/BoardService.js';
import WebSocketService from '../services/WebSocketService.js';
import UserService from '../services/UserService.js';
import { ElementSelectionController } from '../controller/ElementSelectionController.js';
import { ConnectorLayoutCoordinator } from '../controller/ConnectorLayoutCoordinator.js';
import { CursorController } from '../controller/CursorController.js';
import type { CursorPosition } from '../../types/Cursor.js';
import { quantizeNonNegative, quantizePreciseNonNegative, quantizeScalar } from '../../shared/geometry.js';
import { normalizeBoardModel, UNKNOWN_USER_COLOR } from '../../shared/userColorNormalization.js';

interface BoardViewProps {
  selectedTool: 'select' | 'card' | 'group' | 'connection';
  onToolChange?: (tool: 'select' | 'card' | 'group' | 'connection') => void;
  currentUser?: User | null;
  views?: ViewType[];
  activeViewId?: string;
  onViewChange?: (viewId: string) => void;
  onPlace?: (elementId: string, elementType: 'card' | 'group', x: number, y: number) => void;
  onCardAdded?: (cards: CardType[]) => void;
  onGroupAdded?: (groups: GroupType[]) => void;
  onCardTextChanged?: (id: string, newText: string) => void;
  onGroupLabelChanged?: (id: string, newLabel: string) => void;
}

const createDefaultCardModel = (createdBy?: string, createdColor?: string, id?: string): CardType => ({
  id: id || `card-${Date.now()}`,
  text: '',
  createdBy,
  createdColor: createdColor || UNKNOWN_USER_COLOR,
  connections: [],
});

const createDefaultGroupModel = (createdBy?: string, createdColor?: string, id?: string): GroupType => ({
  id: id || `group-${Date.now()}`,
  label: '',
  createdBy,
  createdColor: createdColor || UNKNOWN_USER_COLOR,
});

const createDefaultReference = (
  elementId: string,
  elementType: 'card' | 'group',
  x: number,
  y: number,
  viewId: string,
  groupId?: string,
  id?: string,
): ReferenceType => ({
  id: id || `ref-${Date.now()}`,
  elementId,
  elementType,
  x: quantizeScalar(x),
  y: quantizeScalar(y),
  width: elementType === 'card' ? 200 : 440,
  height: elementType === 'card' ? 45 : 300,
  viewId,
  groupId,
});

export const BoardView: React.FC<BoardViewProps> = ({
  selectedTool,
  onToolChange,
  currentUser,
  views: viewsProp,
  activeViewId: activeViewIdProp,
  onViewChange,
  onPlace,
  onCardAdded,
  onGroupAdded,
  onCardTextChanged,
  onGroupLabelChanged,
}) => {
  const [cards, setCards] = useState<CardType[]>([]);
  const [groups, setGroups] = useState<GroupType[]>([]);
  const [references, setReferences] = useState<ReferenceType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedItems, setSelectedItems] = useState<string[]>([]); // reference ids
  const [selectedConnectorIds, setSelectedConnectorIds] = useState<string[]>([]);

  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState<{ scrollX: number; scrollY: number; clientX: number; clientY: number } | null>(null);
  const boardContainerRef = useRef<HTMLDivElement>(null);
  const cursorElements = new Map<string, HTMLDivElement>();
  const [connectionSourceId, setConnectionSourceId] = useState<string | null>(null);
  const [connectionPointer, setConnectionPointer] = useState<{ x: number; y: number } | null>(null);
  const [editingConnectorId, setEditingConnectorId] = useState<string | null>(null);
  const [connectorNameDraft, setConnectorNameDraft] = useState('');

  const lastBoardVersionRef = useRef<string | null>(null);
  const isLocallyDraggingRef = useRef(false);
  const editingCardIdsRef = useRef<Set<string>>(new Set());
  const editingGroupIdsRef = useRef<Set<string>>(new Set());
  const originalConnectorNameRef = useRef<Map<string, string>>(new Map());
  const cardsRef = useRef<CardType[]>([]);
  const groupsRef = useRef<GroupType[]>([]);
  const referencesRef = useRef<ReferenceType[]>([]);
  const selectedItemsRef = useRef<string[]>([]);
  const activeViewIdRef = useRef<string | undefined>(undefined);
  const dragRef = useRef<{
    id: string | null;
    type: 'card' | 'group' | null;
    startClient: { x: number; y: number };
    startPos: Map<string, { x: number; y: number }>;
    hasMoved: boolean;
    wasAlreadySelected: boolean;
  } | null>(null);
  let rafRef = useRef<number | null>(null);
  const [autoFocusId, setAutoFocusId] = useState<string | null>(null);

  useEffect(() => {
    cardsRef.current = cards;
  }, [cards]);
  useEffect(() => {
    groupsRef.current = groups;
  }, [groups]);
  useEffect(() => {
    referencesRef.current = references;
  }, [references]);
  useEffect(() => {
    selectedItemsRef.current = selectedItems;
  }, [selectedItems]);
  useEffect(() => {
    activeViewIdRef.current = activeViewIdProp;
  }, [activeViewIdProp]);

  useEffect(() => {
    setSelectedItems([]);
    setSelectedConnectorIds([]);
  }, [selectedTool, activeViewIdProp]);

  const getDirectoryUsers = async (): Promise<User[] | null> => {
    try {
      const users = await UserService.getInstance().getUsers();
      return Array.isArray(users) ? users : null;
    } catch {
      return null;
    }
  };

  const activeView = useMemo(() => {
    const viewsList = viewsProp ?? [];
    const fromProp = activeViewIdProp ? viewsList.find((v) => v.id === activeViewIdProp) : undefined;
    return fromProp || viewsList.find((v) => v.isDefault) || viewsList[0];
  }, [viewsProp, activeViewIdProp]);

  const cardRefs = useMemo(() => references.filter((r) => r.elementType === 'card' && r.viewId === (activeView?.id ?? '')), [references, activeView?.id]);
  const groupRefs = useMemo(() => references.filter((r) => r.elementType === 'group' && r.viewId === (activeView?.id ?? '')), [references, activeView?.id]);

  const refByElementId = useMemo(() => {
    const map = new Map<string, string>();
    for (const ref of references) {
      if (ref.viewId === (activeView?.id ?? '')) map.set(ref.elementId, ref.id);
    }
    return map;
  }, [references, activeView?.id]);

  const refById = useMemo(() => new Map(references.map((r) => [r.id, r])), [references]);

  const cardsInView = useMemo(() => {
    return cardRefs.map((ref) => {
      const card = cards.find((c) => c.id === ref.elementId);
      if (!card) return null;
      return { ...card, x: ref.x, y: ref.y, width: ref.width, height: ref.height };
    }).filter((c): c is NonNullable<typeof c> => c !== null);
  }, [cardRefs, cards]);

  const groupsInView = useMemo(() => {
    return groupRefs.map((ref) => {
      const group = groups.find((g) => g.id === ref.elementId);
      if (!group) return null;
      return { ...group, x: ref.x, y: ref.y, width: ref.width, height: ref.height };
    }).filter((g): g is NonNullable<typeof g> => g !== null);
  }, [groupRefs, groups]);

  const applyBoardState = (serverBoard: { cards?: CardType[]; groups?: GroupType[]; views?: ViewType[]; references?: ReferenceType[]; lastUpdated?: string }, users: User[] | null) => {
    const normalizedBoard = users ? normalizeBoardModel({
      cards: serverBoard.cards || [],
      groups: serverBoard.groups || [],
      lastUpdated: serverBoard.lastUpdated,
    }, users).board : { cards: serverBoard.cards || [], groups: serverBoard.groups || [], lastUpdated: serverBoard.lastUpdated };
    mergeBoard({
      cards: normalizedBoard.cards,
      groups: normalizedBoard.groups,
      views: serverBoard.views,
      references: serverBoard.references,
      lastUpdated: serverBoard.lastUpdated,
    });
  };

  const mergeBoard = (serverBoard: { cards?: CardType[]; groups?: GroupType[]; views?: ViewType[]; references?: ReferenceType[]; lastUpdated?: string }) => {
    const serverCards = serverBoard.cards || [];
    const serverGroups = serverBoard.groups || [];
    const serverViews = serverBoard.views;
    const serverReferences = serverBoard.references;
    setCards(prev => serverCards.map(card => {
      if (editingCardIdsRef.current.has(card.id)) {
        const local = prev.find(c => c.id === card.id);
        return local ? { ...card, text: local.text } : card;
      }
      return card;
    }));
    setGroups(prev => serverGroups.map(group => {
      if (editingGroupIdsRef.current.has(group.id)) {
        const local = prev.find(g => g.id === group.id);
        return local ? { ...group, label: local.label } : group;
      }
      return group;
    }));
    if (serverReferences) setReferences(serverReferences);
    if (serverBoard.lastUpdated) {
      lastBoardVersionRef.current = serverBoard.lastUpdated;
    }
  };

  useEffect(() => {
    const loadBoard = async () => {
      try {
        const boardService = BoardService.getInstance();
        const { cards, groups, views, references } = await boardService.getBoard();
        const users = await getDirectoryUsers();
        applyBoardState({ cards, groups, views, references }, users);
      } catch (err) {
        console.error('Failed to load board:', err);
        setError('Failed to load board data');
      } finally {
        setIsLoading(false);
      }
    };

    loadBoard();
  }, []);

  useEffect(() => {
    const handleKeyDown = async (e: globalThis.KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }
      if (e.key !== 'Delete' || (selectedItems.length === 0 && selectedConnectorIds.length === 0)) return;
      e.preventDefault();
      try {
        const boardService = BoardService.getInstance();
        const refs = referencesRef.current;
        for (const refId of selectedItems) {
          const ref = refs.find((r) => r.id === refId);
          if (!ref) continue;
          if (ref.elementType === 'card') {
            await boardService.deleteReference(ref.id);
          } else if (ref.elementType === 'group') {
            await boardService.deleteReference(ref.id);
          }
        }
        for (const connId of selectedConnectorIds) {
          const sourceCard = cardsRef.current.find(c => (c.connections || []).some((conn: { id: string }) => conn.id === connId));
          if (sourceCard) {
            const { cards: updatedCards } = await boardService.removeConnection(sourceCard.id, connId);
            setCards(updatedCards);
          }
        }
        setReferences(prev => prev.filter(ref => !selectedItems.includes(ref.id)));
        setSelectedItems([]);
        setSelectedConnectorIds([]);
      } catch (err) {
        console.error('Failed to delete selected items:', err);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedItems, selectedConnectorIds, cards, groups, references]);

  useEffect(() => {
    const ws = WebSocketService.getInstance();
    const unsubscribeBoard = ws.onBoardUpdate(async (payload) => {
      if (isLocallyDraggingRef.current) return;
      const serverBoard = payload.board;
      if (!serverBoard) return;
      const serverVersion = serverBoard.lastUpdated || '';
      if (serverVersion && serverVersion <= (lastBoardVersionRef.current || '')) return;
      const users = await getDirectoryUsers();
      applyBoardState(serverBoard, users);
    });

    const unsubscribeLive = ws.onLiveUpdate((payload) => {
      if (isLocallyDraggingRef.current) return;
      if (!payload) return;
      setReferences(prev => prev.map(c => {
        const live = (payload.cards as { id: string; x: number; y: number }[]).find((lc) => lc.id === c.id);
        if (live) return { ...c, x: live.x, y: live.y };
        return c;
      }));
      setReferences(prev => prev.map(g => {
        const live = (payload.groups as { id: string; x: number; y: number }[]).find((lg) => lg.id === g.id);
        if (live) return { ...g, x: live.x, y: live.y };
        return g;
      }));
    });

    const unsubscribeDirectory = UserService.getInstance().onUsersDirectoryUpdate((users) => {
      if (!Array.isArray(users)) return;
      applyBoardState({ cards: cardsRef.current, groups: groupsRef.current, views: viewsProp, references, lastUpdated: lastBoardVersionRef.current || undefined }, users);
    });

    return () => {
      unsubscribeBoard();
      unsubscribeLive();
      unsubscribeDirectory();
    };
  }, [viewsProp, references]);

  useEffect(() => {
    const handleMove = (e: globalThis.PointerEvent) => handleDragMove(e);
    const handleUp = (e: globalThis.PointerEvent) => handleDragEnd(e);
    const handleCancel = () => {
      const drag = dragRef.current;
      if (!drag) return;
      dragRef.current = null;
      isLocallyDraggingRef.current = false;
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    window.addEventListener('pointercancel', handleCancel);
    window.addEventListener('blur', handleCancel);
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
      window.removeEventListener('pointercancel', handleCancel);
      window.removeEventListener('blur', handleCancel);
    };
  }, []);

  useEffect(() => {
    const controller = CursorController.getInstance();
    controller.connect();
    controller.setLocalUserId(currentUser?.id ?? null);
    const unsubscribe = controller.onCursorChange((cursors) => {
      const container = boardContainerRef.current;
      if (!container) return;
      const incoming = new Set(cursors.map((c) => c.userId));
      for (const [userId, el] of cursorElements) {
        if (!incoming.has(userId)) {
          el.remove();
          cursorElements.delete(userId);
        }
      }
      for (const cursor of cursors) {
        let el = cursorElements.get(cursor.userId);
        if (!el) {
          el = document.createElement('div');
          el.style.position = 'absolute';
          el.style.borderRadius = '50%';
          el.style.pointerEvents = 'none';
          el.style.zIndex = '50';
          el.style.transition = 'transform 0.1s linear';
          el.style.willChange = 'transform';
          container.appendChild(el);
          cursorElements.set(cursor.userId, el);
        }
        el.style.transform = `translate3d(${cursor.x - 2}px, ${cursor.y - 2}px, 0)`;
        el.style.width = '4px';
        el.style.height = '4px';
        el.style.backgroundColor = cursor.color;
        el.style.boxShadow = `0 0 3px ${cursor.color}`;
      }
    });
    return () => {
      unsubscribe();
      for (const el of cursorElements.values()) el.remove();
      cursorElements.clear();
    };
  }, [currentUser?.id]);

  useEffect(() => {
    const handleChanged = async () => {
      const ws = WebSocketService.getInstance();
      if (ws.isRecentLocalMutation()) return;
      try {
        const boardService = BoardService.getInstance();
        const serverBoard = await boardService.getBoard();
        const users = await getDirectoryUsers();
        applyBoardState(serverBoard, users);
      } catch (err) {
        console.error('Failed to refresh board after remote change:', err);
      }
    };
    window.addEventListener('board:changed', handleChanged);
    return () => window.removeEventListener('board:changed', handleChanged);
  }, []);

  const insideGroupRef = (gx: number, gy: number, g: ReferenceType) => {
    const gw = g.width || 440;
    const gh = g.height || 300;
    return gx >= g.x && gx <= g.x + gw && gy >= g.y && gy <= g.y + gh;
  };

  const handleDragStart = (e: React.PointerEvent, referenceId: string, type: 'card' | 'group') => {
    if (selectedTool === 'connection') return;
    e.stopPropagation();
    const board = boardContainerRef.current;
    if (!board) return;
    const boardRect = board.getBoundingClientRect();
    const startClient = { x: e.clientX - boardRect.left + board.scrollLeft, y: e.clientY - boardRect.top + board.scrollTop };

    const refs = referencesRef.current;
    const ref = refs.find((r) => r.id === referenceId);
    if (!ref) return;

    const movingIds: string[] = [];
    if (selectedItems.includes(referenceId) && selectedItems.length > 1) {
      selectedItems.forEach(itemId => { if (!movingIds.includes(itemId)) movingIds.push(itemId); });
    } else {
      movingIds.push(referenceId);
    }
    const movingGroupRefs = movingIds.map(id => refs.find((r) => r.id === id)).filter((r): r is ReferenceType => r !== undefined && r.elementType === 'group');
    const movingGroupElementIds = new Set(movingGroupRefs.map((g) => g.elementId));
    refs.forEach((r) => {
      if (r.elementType === 'card' && r.groupId && movingGroupElementIds.has(r.groupId) && !movingIds.includes(r.id)) {
        movingIds.push(r.id);
      }
    });

    const startPos = new Map<string, { x: number; y: number }>();
    movingIds.forEach(itemId => {
      const r = refs.find((ref) => ref.id === itemId);
      if (r) startPos.set(itemId, { x: r.x, y: r.y });
    });

    const el = e.currentTarget as HTMLElement;
    dragRef.current = { id: referenceId, type, startClient, startPos, hasMoved: false, wasAlreadySelected: selectedItems.includes(referenceId) };
    isLocallyDraggingRef.current = true;
    const cardEl = el.closest('[data-card-id], [data-group-id]');
    if (cardEl) {
      (cardEl as any)._pendingSelection = { id: referenceId, ctrlKey: e.ctrlKey };
    }
    emitLivePreview();
  };

  const handleDragMove = (e: globalThis.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag) return;
    const { id, startClient, startPos } = drag;
    const board = boardContainerRef.current;
    if (!board) return;
    const boardRect = board.getBoundingClientRect();
    const clientX = e.clientX - boardRect.left + board.scrollLeft;
    const clientY = e.clientY - boardRect.top + board.scrollTop;
    const dx = clientX - startClient.x;
    const dy = clientY - startClient.y;

    if (!drag.hasMoved) {
      const dist = Math.hypot(dx, dy);
      if (dist > 1 && id !== null) {
        drag.hasMoved = true;
        const element = document.querySelector(`[data-card-id="${id}"], [data-group-id="${id}"]`);
        if (element) {
          delete (element as any)._pendingSelection;
        }
      }
    }

    const movingIds = Array.from(startPos.keys());
    setReferences(prev => prev.map(r => {
      if (!movingIds.includes(r.id)) return r;
      const pos = startPos.get(r.id)!;
      return { ...r, x: quantizePreciseNonNegative(pos.x + dx), y: quantizePreciseNonNegative(pos.y + dy) };
    }));

    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      emitLivePreview({ dx, dy });
    });
  };

  const emitLivePreview = (delta?: { dx: number; dy: number }) => {
    const ws = WebSocketService.getInstance();
    if (!ws.isConnected()) return;
    const drag = dragRef.current;
    if (!drag || !isLocallyDraggingRef.current) return;
    const { startPos } = drag;
    const dx = delta?.dx ?? 0;
    const dy = delta?.dy ?? 0;
    const movedCards: { id: string; x: number; y: number }[] = [];
    const movedGroups: { id: string; x: number; y: number }[] = [];
    startPos.forEach((pos, itemId) => {
      const ref = referencesRef.current.find((r) => r.id === itemId);
      if (ref) {
        if (ref.elementType === 'card') movedCards.push({ id: ref.id, x: quantizeNonNegative(pos.x + dx), y: quantizeNonNegative(pos.y + dy) });
        else if (ref.elementType === 'group') movedGroups.push({ id: ref.id, x: quantizeNonNegative(pos.x + dx), y: quantizeNonNegative(pos.y + dy) });
      }
    });
    if (movedCards.length > 0 || movedGroups.length > 0) {
      ws.emitLiveDrag({ cards: movedCards, groups: movedGroups });
    }
  };

  const handleDragEnd = async (e: globalThis.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag) return;
    if (!drag.hasMoved) {
      dragRef.current = null;
      isLocallyDraggingRef.current = false;
      return;
    }
    const { id, startPos } = drag;
    if (!id) return;
    const board = boardContainerRef.current;
    if (!board) return;
    const boardRect = board.getBoundingClientRect();
    const clientX = e.clientX - boardRect.left + board.scrollLeft;
    const clientY = e.clientY - boardRect.top + board.scrollTop;
    const dx = quantizeScalar(clientX - drag.startClient.x);
    const dy = quantizeScalar(clientY - drag.startClient.y);

    const boardService = BoardService.getInstance();
    const activeId = id;
    const activeType = drag.type;

    dragRef.current = null;
    isLocallyDraggingRef.current = false;

    const finishDrag = () => {
      const element = document.querySelector(`[data-card-id="${id}"], [data-group-id="${id}"]`);
      if (element) {
        delete (element as any)._pendingSelection;
      }
    };

    const refs = referencesRef.current;
    const movingIds = Array.from(startPos.keys());

    // Multi-selection or single: gather reference updates.
    const refUpdates: Array<{ id: string; x: number; y: number; groupId?: string }> = [];
    let nextReferences = refs;

    if (selectedItemsRef.current.includes(activeId) && selectedItemsRef.current.length > 1) {
      selectedItemsRef.current.forEach(itemId => {
        const ref = refs.find((r) => r.id === itemId);
        const pos = startPos.get(itemId);
        if (!ref || !pos) return;
        const newBoardX = quantizeNonNegative(pos.x + dx);
        const newBoardY = quantizeNonNegative(pos.y + dy);
        let newGroupId = ref.groupId;
        if (ref.elementType === 'card') {
          const targetGroup = refs.find((g) => g.elementType === 'group' && g.viewId === activeViewIdRef.current && insideGroupRef(newBoardX, newBoardY, g));
          newGroupId = targetGroup ? targetGroup.elementId : undefined;
        }
        refUpdates.push({ id: ref.id, x: newBoardX, y: newBoardY, groupId: newGroupId });
        nextReferences = nextReferences.map(r => (r.id === ref.id ? { ...r, x: newBoardX, y: newBoardY, groupId: newGroupId } : r));
      });
      // Cards contained inside any moved group travel with it.
      selectedItemsRef.current.forEach(itemId => {
        const ref = refs.find((r) => r.id === itemId);
        if (!ref || ref.elementType !== 'group') return;
        refs.forEach((cardRef) => {
          if (cardRef.elementType !== 'card') return;
          if (refUpdates.some((u) => u.id === cardRef.id)) return;
          if (cardRef.groupId !== ref.elementId) return;
          if (!insideGroupRef(cardRef.x, cardRef.y, ref)) return;
          const cpos = startPos.get(cardRef.id);
          if (!cpos) return;
          const updatedCard = { id: cardRef.id, x: quantizeNonNegative(cpos.x + dx), y: quantizeNonNegative(cpos.y + dy) };
          refUpdates.push({ id: cardRef.id, x: updatedCard.x, y: updatedCard.y });
          nextReferences = nextReferences.map(r => (r.id === cardRef.id ? { ...r, x: updatedCard.x, y: updatedCard.y } : r));
        });
      });
      setReferences(nextReferences);
      await boardService.batchUpdate({ references: refUpdates }).catch(err => console.error('Failed to batch update board positions:', err));
      setSelectedItems(selectedItemsRef.current);
      finishDrag();
      return;
    }

    if (activeType === 'card') {
      const ref = refs.find((r) => r.id === activeId);
      const pos = startPos.get(activeId);
      if (!ref || !pos) { finishDrag(); return; }
      const newBoardX = quantizeNonNegative(pos.x + dx);
      const newBoardY = quantizeNonNegative(pos.y + dy);
      const targetGroup = refs.find((g) => g.elementType === 'group' && g.viewId === activeViewIdRef.current && insideGroupRef(newBoardX, newBoardY, g));
      const newGroupId = targetGroup ? targetGroup.elementId : undefined;
      setReferences(prev => prev.map(r => (r.id === activeId ? { ...r, x: newBoardX, y: newBoardY, groupId: newGroupId } : r)));
      await boardService.updateReference(activeId, { x: newBoardX, y: newBoardY, groupId: newGroupId }).catch(err => console.error('Failed to update card position:', err));
    } else if (activeType === 'group') {
      const ref = refs.find((r) => r.id === activeId);
      const pos = startPos.get(activeId);
      if (!ref || !pos) { finishDrag(); return; }
      const gx = quantizeNonNegative(pos.x + dx);
      const gy = quantizeNonNegative(pos.y + dy);
      const movedRefs = refs.filter((r) => r.elementType === 'card' && r.groupId === ref.elementId && insideGroupRef(r.x, r.y, ref));
      const refUpdates: Array<{ id: string; x: number; y: number }> = [{ id: ref.id, x: gx, y: gy }];
      movedRefs.forEach((cardRef) => {
        const cpos = startPos.get(cardRef.id);
        refUpdates.push({ id: cardRef.id, x: quantizeNonNegative((cpos ? cpos.x : cardRef.x) + dx), y: quantizeNonNegative((cpos ? cpos.y : cardRef.y) + dy) });
      });
      setReferences(prev => prev.map(r => {
        if (r.id === ref.id) return { ...r, x: gx, y: gy };
        if (movedRefs.some((m) => m.id === r.elementId)) {
          const u = refUpdates.find((uu) => uu.id === r.id);
          return u ? { ...r, x: u.x, y: u.y } : r;
        }
        return r;
      }));
      await boardService.batchUpdate({ references: refUpdates.map((u) => ({ ...u })) }).catch(err => console.error('Failed to update group position:', err));
    }
    finishDrag();
  };

  const handleCardTextChange = (id: string, newText: string) => {
    setCards(prevCards => prevCards.map(card => {
      if (card.id === id) return { ...card, text: newText };
      return card;
    }));
  };

  const handleCardTextCommit = (id: string, newText: string) => {
    const boardService = BoardService.getInstance();
    boardService.updateCard(id, { text: newText }).catch(err => console.error('Failed to update card text:', err));
    onCardTextChanged?.(id, newText);
  };

  const handleCardHeightChange = (id: string, height: number) => {
    const refId = refByElementId.get(id);
    if (refId) {
      setReferences(prev => prev.map(ref => (ref.id === refId ? { ...ref, height } : ref)));
    }
  };

  const handleCardEditEnd = (id: string, height: number) => {
    const boardService = BoardService.getInstance();
    const refId = refByElementId.get(id);
    if (refId) {
      boardService.updateReference(refId, { height }).catch(err => console.error('Failed to update card height:', err));
    }
  };

  const handleCardEditingChange = (id: string, editing: boolean) => {
    if (editing) {
      editingCardIdsRef.current.add(id);
      if (autoFocusId === id) setAutoFocusId(null);
    } else {
      editingCardIdsRef.current.delete(id);
    }
  };

  const handleGroupLabelChange = (id: string, newLabel: string) => {
    setGroups(prevGroups => prevGroups.map(group => {
      if (group.id === id) return { ...group, label: newLabel };
      return group;
    }));
  };

  const handleGroupLabelCommit = (id: string, newLabel: string) => {
    const boardService = BoardService.getInstance();
    boardService.updateGroup(id, { label: newLabel }).catch(err => console.error('Failed to update group label:', err));
    onGroupLabelChanged?.(id, newLabel);
  };

  const handleGroupEditingChange = (id: string, editing: boolean) => {
    if (editing) {
      editingGroupIdsRef.current.add(id);
      if (autoFocusId === id) setAutoFocusId(null);
    } else {
      editingGroupIdsRef.current.delete(id);
    }
  };

  const handleSelect = (id: string, ctrlKey: boolean = false) => {
    setSelectedItems(prev => new ElementSelectionController().select(prev, id, ctrlKey));
  };

  const handleConnectorSelect = (id: string, ctrlKey: boolean = false) => {
    if (selectedTool !== 'select' && selectedTool !== 'connection') return;
    setSelectedItems([]);
    setSelectedConnectorIds(prev => new ElementSelectionController().select(prev, id, ctrlKey));
  };

  const handleConnectorNameStart = (id: string) => {
    if (selectedTool === 'connection') return;
    setEditingConnectorId(id);
    const card = cards.find(c => (c.connections || []).some((conn: { id: string }) => conn.id === id));
    const conn = card?.connections?.find((c: { id: string; name?: string }) => c.id === id);
    originalConnectorNameRef.current.set(id, conn?.name ?? '');
    setConnectorNameDraft(conn?.name ?? '');
  };

  const handleConnectorNameChange = (id: string, newName: string) => {
    setConnectorNameDraft(newName);
    setCards(prevCards => prevCards.map(card => {
      if (!card.connections) return card;
      return {
        ...card,
        connections: card.connections.map((conn: Connection) =>
          conn.id === id ? { ...conn, name: newName } : conn),
      };
    }));
  };

  const handleConnectorNameCommit = async (id: string, newName: string) => {
    try {
      const boardService = BoardService.getInstance();
      const card = cards.find(c => (c.connections || []).some((conn: { id: string }) => conn.id === id));
      if (card) {
        await boardService.updateConnectionName(card.id, id, newName);
      }
    } catch (err) {
      console.error('Failed to update connector name:', err);
    } finally {
      setEditingConnectorId(null);
      setConnectorNameDraft('');
      originalConnectorNameRef.current.delete(id);
    }
  };

  const handleConnectorNameCancel = (id: string) => {
    setEditingConnectorId(null);
    setConnectorNameDraft('');
    const original = originalConnectorNameRef.current.get(id);
    originalConnectorNameRef.current.delete(id);
    if (original !== undefined) {
      setCards(prevCards => prevCards.map(card => {
        if (!card.connections) return card;
        return {
          ...card,
          connections: card.connections.map((conn: Connection) =>
            conn.id === id ? { ...conn, name: original } : conn),
        };
      }));
    }
  };

  const handleCardClick = (referenceId: string, ctrlKey: boolean) => {
    if (selectedTool === 'card' || selectedTool === 'group') {
      onToolChange?.('select');
    }
    setSelectedConnectorIds([]);
    setSelectedItems((prev) => new ElementSelectionController().select(prev, referenceId, ctrlKey));
  };

  const handleGroupClick = (referenceId: string, ctrlKey: boolean) => {
    if (selectedTool === 'card' || selectedTool === 'group') {
      onToolChange?.('select');
    }
    setSelectedConnectorIds([]);
    setSelectedItems((prev) => new ElementSelectionController().select(prev, referenceId, ctrlKey));
  };

  const handleAddCardInGroup = async (_x: number, _y: number, _groupId: string) => {
    // Kept for API compatibility; cards are now placed via the model panel / board click.
  };

  const handleBoardFocus = () => {
    const boardElement = document.querySelector('.board-container');
    if (boardElement) {
      (boardElement as HTMLElement).focus();
    }
  };

  const handlePanStart = (e: React.MouseEvent<HTMLDivElement>) => {
    if (selectedTool !== 'select' || e.button !== 0 || isLocallyDraggingRef.current) return;
    if (e.target instanceof Element && e.target.closest('[data-drag-handle]')) return;
    setIsPanning(true);
    setPanStart({
      scrollX: e.currentTarget.scrollLeft,
      scrollY: e.currentTarget.scrollTop,
      clientX: e.clientX,
      clientY: e.clientY,
    });
  };

  const handlePanMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isPanning || !panStart) return;
    const { scrollX, scrollY, clientX, clientY } = panStart;
    const dx = clientX - e.clientX;
    const dy = clientY - e.clientY;
    e.currentTarget.scrollLeft = scrollX + dx;
    e.currentTarget.scrollTop = scrollY + dy;
  };

  const handlePanEnd = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isPanning) return;
    setIsPanning(false);
    setPanStart(null);
  };

  const emitCursorPosition = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!currentUser) return;
    const boardRect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - boardRect.left + e.currentTarget.scrollLeft;
    const y = e.clientY - boardRect.top + e.currentTarget.scrollTop;
    CursorController.getInstance().emitPosition(currentUser, x, y);
  };

  const getBoardCoords = (e: React.MouseEvent<HTMLDivElement>): { x: number; y: number } => {
    const boardRect = e.currentTarget.getBoundingClientRect();
    return {
      x: e.clientX - boardRect.left + e.currentTarget.scrollLeft,
      y: e.clientY - boardRect.top + e.currentTarget.scrollTop,
    };
  };

  const handleConnectionMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (selectedTool !== 'connection' || !connectionSourceId) return;
    setConnectionPointer(getBoardCoords(e));
  };

  const handleConnectionMouseUp = async (e: React.MouseEvent<HTMLDivElement>) => {
    if (selectedTool !== 'connection' || !connectionSourceId) return;
    e.preventDefault();
    e.stopPropagation();
    const el = document.elementFromPoint(e.clientX, e.clientY);
    const targetCardEl = el?.closest('[data-card-id]') as HTMLElement | null;
    const targetCardId = targetCardEl?.dataset.cardId ?? null;
    if (targetCardId && targetCardId !== connectionSourceId) {
      try {
        const boardService = BoardService.getInstance();
        const connectionId = await boardService.getNewId('conn');
        const { cards: updatedCards } = await boardService.addConnection(connectionSourceId, targetCardId, connectionId);
        setCards(updatedCards);
        if (connectionId) {
          setEditingConnectorId(connectionId);
          setConnectorNameDraft('');
          originalConnectorNameRef.current.set(connectionId, '');
        }
      } catch (err) {
        console.error('Failed to add connection:', err);
      }
    }
    setConnectionSourceId(null);
    setConnectionPointer(null);
  };

  const connectorLayout = useMemo(
    () => new ConnectorLayoutCoordinator().computeLayout(cardsInView, groupsInView),
    [cardsInView, groupsInView]
  );

  const previewRoute = useMemo(
    () => (connectionSourceId && connectionPointer
      ? new ConnectorLayoutCoordinator().computePreviewRoute(cardsInView, connectionSourceId, connectionPointer)
      : null),
    [cardsInView, connectionSourceId, connectionPointer]
  );

  const handleBoardDrop = (e: React.DragEvent) => {
    e.preventDefault();
    try {
      const data = e.dataTransfer.getData('application/cardboard-element');
      if (!data) return;
      const { elementId, elementType } = JSON.parse(data) as {
        elementId: string;
        elementType: 'card' | 'group';
      };
      const boardRect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - boardRect.left + e.currentTarget.scrollLeft;
      const y = e.clientY - boardRect.top + e.currentTarget.scrollTop;
      onPlace?.(elementId, elementType, x, y);
    } catch (err) {
      console.error('Failed to handle drop:', err);
    }
  };

  const handleBoardClick = async (e: React.MouseEvent<HTMLDivElement>) => {
    console.log('BoardView handleBoardClick', { selectedTool, x: e.clientX, y: e.clientY });
    setSelectedItems([]);
    if (selectedTool === 'select' || selectedTool === 'connection') {
      console.log('BoardView handleBoardClick early return, tool not card/group:', selectedTool);
      return;
    }
    const boardRect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - boardRect.left + e.currentTarget.scrollLeft;
    const y = e.clientY - boardRect.top + e.currentTarget.scrollTop;
    const viewId = activeView?.id;
    console.log('BoardView handleBoardClick coords', { x, y, viewId });
    if (!viewId) return;

    if (selectedTool === 'card') {
      console.log('BoardView handleBoardClick add card start');
      const boardService = BoardService.getInstance();
      try {
        const cardId = await boardService.getNewId('card');
        console.log('BoardView handleBoardClick new card id', cardId);
        const newCard = createDefaultCardModel(currentUser?.name, currentUser?.color, cardId);
        const { cards } = await boardService.addCard(newCard);
        console.log('BoardView handleBoardClick addCard result cards=', cards.length);
        setCards(cards);
        onCardAdded?.(cards);
        const refId = await boardService.getNewId('ref');
        console.log('BoardView handleBoardClick new ref id', refId);
        const ref = createDefaultReference(cardId, 'card', x, y, viewId, undefined, refId);
        const { references } = await boardService.addReference(ref);
        console.log('BoardView handleBoardClick addReference result refs=', references.length);
        setReferences(references);
        setAutoFocusId(cardId);
      } catch (err) {
        console.error('Failed to add card:', err);
      }
    } else if (selectedTool === 'group') {
      console.log('BoardView handleBoardClick add group start');
      const boardService = BoardService.getInstance();
      try {
        const groupId = await boardService.getNewId('group');
        console.log('BoardView handleBoardClick new group id', groupId);
        const newGroup = createDefaultGroupModel(currentUser?.name, currentUser?.color, groupId);
        const { groups } = await boardService.addGroup(newGroup);
        console.log('BoardView handleBoardClick addGroup result groups=', groups.length);
        setGroups(groups);
        onGroupAdded?.(groups);
        const refId = await boardService.getNewId('ref');
        console.log('BoardView handleBoardClick new ref id', refId);
        const ref = createDefaultReference(groupId, 'group', x, y, viewId, undefined, refId);
        const { references } = await boardService.addReference(ref);
        console.log('BoardView handleBoardClick addReference result refs=', references.length);
        setReferences(references);
        setAutoFocusId(groupId);
      } catch (err) {
        console.error('Failed to add group:', err);
      }
    }
  };

  if (isLoading) {
    return (
      <div className="relative w-full h-full bg-gray-100 overflow-auto flex items-center justify-center">
        <div>Loading board...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="relative w-full h-full bg-gray-100 overflow-auto flex items-center justify-center">
        <div className="text-red-500">{error}</div>
      </div>
    );
  }

  return (
    <div
      ref={boardContainerRef}
      className="relative w-full h-full bg-gray-100 overflow-auto board-container"
      onClick={(e) => {
        handleBoardClick(e);
        handleBoardFocus();
      }}
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleBoardDrop}
      onMouseDown={handlePanStart}
      onMouseMove={(e) => {
        handlePanMove(e);
        emitCursorPosition(e);
        handleConnectionMouseMove(e);
      }}
      onMouseLeave={handlePanEnd}
      onMouseUp={(e) => {
        handlePanEnd(e);
        handleConnectionMouseUp(e);
      }}
      style={{ cursor: isPanning ? 'grabbing' : 'default', userSelect: connectionSourceId ? 'none' : 'auto' }}
      tabIndex={0}
    >
      {cardsInView.map(card => {
        const ref = cardRefs.find((r) => r.elementId === card.id);
        const isCardSelected = ref ? selectedItems.includes(ref.id) : false;
        return (
          <Card
            key={card.id}
            id={card.id}
            text={card.text}
            x={ref?.x ?? 0}
            y={ref?.y ?? 0}
            width={ref?.width ?? 200}
            height={ref?.height ?? 45}
            isSelected={isCardSelected}
            tool={selectedTool}
            onCardClick={(_id, ctrlKey) => handleCardClick(ref?.id ?? card.id, ctrlKey)}
            onSelect={(_id, ctrlKey) => handleSelect(ref?.id ?? card.id, ctrlKey)}
            onDragStart={(e) => handleDragStart(e, ref?.id ?? card.id, 'card')}
            onCardMouseDown={(id) => {
              if (selectedTool === 'connection') {
                setConnectionSourceId(id);
                setConnectionPointer(null);
              }
            }}
            onTextChange={handleCardTextChange}
            onTextCommit={handleCardTextCommit}
            onEditingChange={handleCardEditingChange}
            onHeightChange={handleCardHeightChange}
            onEditEnd={handleCardEditEnd}
            createdBy={card.createdBy}
            createdColor={card.createdColor}
            autoFocus={autoFocusId === card.id}
          />
        );
      })}

      <ConnectionRenderer
        cards={cardsInView}
        routes={connectorLayout.routes}
        labels={connectorLayout.labels}
        previewRoute={previewRoute}
        selectedTool={selectedTool}
        selectedConnectorIds={selectedConnectorIds}
        onConnectorSelect={handleConnectorSelect}
        editingConnectorId={editingConnectorId}
        connectorNameDraft={connectorNameDraft}
        onConnectorNameStart={handleConnectorNameStart}
        onConnectorNameChange={handleConnectorNameChange}
        onConnectorNameCommit={handleConnectorNameCommit}
        onConnectorNameCancel={handleConnectorNameCancel}
      />

      {groupsInView.map(group => {
        const ref = groupRefs.find((r) => r.elementId === group.id);
        const isGroupSelected = ref ? selectedItems.includes(ref.id) : false;
        return (
          <Group
            key={group.id}
            id={group.id}
            label={group.label}
            x={ref?.x ?? 0}
            y={ref?.y ?? 0}
            width={ref?.width ?? 440}
            height={ref?.height ?? 300}
            isSelected={isGroupSelected}
            tool={selectedTool}
            onGroupClick={(_id, ctrlKey) => handleGroupClick(ref?.id ?? group.id, ctrlKey)}
            onSelect={(_id, ctrlKey) => handleSelect(ref?.id ?? group.id, ctrlKey)}
            onDragStart={(e) => handleDragStart(e, ref?.id ?? group.id, 'group')}
            onLabelChange={handleGroupLabelChange}
            onLabelCommit={handleGroupLabelCommit}
            onEditingChange={handleGroupEditingChange}
            createdBy={group.createdBy}
            createdColor={group.createdColor}
            autoFocus={autoFocusId === group.id}
          />
        );
      })}
    </div>
  );
};

export default BoardView;
