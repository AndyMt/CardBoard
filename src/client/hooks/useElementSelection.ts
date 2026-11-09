export function useElementSelection(
  id: string,
  onElementClick: ((id: string, ctrlKey: boolean) => void) | undefined,
  borderThickness: number
) {
  const handleMouseDown = (e: React.MouseEvent) => {
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
      };
    }
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    const pending = (e.currentTarget as any)._pendingSelection;
    if (pending) {
      e.stopPropagation();
      e.preventDefault();
      onElementClick?.(pending.id, pending.ctrlKey);
    }
    delete (e.currentTarget as any)._pendingSelection;
  };

  return { handleMouseDown, handleMouseUp };
}
