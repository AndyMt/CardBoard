import { useRef } from 'react';

interface PendingSelection {
  id: string;
  ctrlKey: boolean;
}

export function useElementSelection(
  id: string,
  onElementClick: ((id: string, ctrlKey: boolean) => void) | undefined,
  borderThickness: number
) {
  const isDraggingRef = useRef(false);

  const handleMouseDown = (e: React.MouseEvent) => {
    console.log('[SELECTION] useElementSelection handleMouseDown', { id, ctrlKey: e.ctrlKey, clientX: e.clientX, clientY: e.clientY });
    isDraggingRef.current = false;

    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;
    const border = borderThickness;

    const isInDragHandle = clickY >= border && clickY < border + 14;

    const innerTop = border;
    const innerLeft = border;
    const innerRight = rect.width - border;
    const innerBottom = rect.height - border;
    const zone = 6;

    const inInner =
      clickX >= innerLeft &&
      clickX <= innerRight &&
      clickY >= innerTop &&
      clickY <= innerBottom;
    const isInSelectionZone =
      inInner &&
      (clickX < innerLeft + zone ||
        clickX > innerRight - zone ||
        clickY < innerTop + 14 + zone ||
        clickY > innerBottom - zone);

    if (isInDragHandle || isInSelectionZone) {
      e.stopPropagation();
      (e.currentTarget as any)._pendingSelection = {
        id,
        ctrlKey: e.ctrlKey,
      } satisfies PendingSelection;
      console.log('[SELECTION] useElementSelection pending selection set', { id, ctrlKey: e.ctrlKey, isInDragHandle, isInSelectionZone });
    } else {
      console.log('[SELECTION] useElementSelection click outside selection zone', { id, clickX, clickY, isInDragHandle, isInSelectionZone });
    }
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    const pending = (e.currentTarget as any)._pendingSelection as PendingSelection | undefined;
    console.log('[SELECTION] useElementSelection handleMouseUp', { id, isDragging: isDraggingRef.current, pending });
    if (pending && !isDraggingRef.current) {
      e.stopPropagation();
      e.preventDefault();
      console.log('[SELECTION] useElementSelection invoking onElementClick', { id: pending.id, ctrlKey: pending.ctrlKey });
      onElementClick?.(pending.id, pending.ctrlKey);
    }
    delete (e.currentTarget as any)._pendingSelection;
  };

  const handleMouseMove = () => {
    isDraggingRef.current = true;
    console.log('[SELECTION] useElementSelection handleMouseMove', { id, isDragging: true });
  };

  return { isDraggingRef, handleMouseDown, handleMouseUp, handleMouseMove };
}
