export class ElementSelectionController {
  select(selected: string[], id: string, ctrlKey: boolean): string[] {
    console.log('[SELECTION] ElementSelectionController.select called', { selected, id, ctrlKey });
    if (ctrlKey) {
      if (selected.includes(id)) {
        const result = selected.filter((itemId) => itemId !== id);
        console.log('[SELECTION] ElementSelectionController.select ctrlKey toggle off', { id, prevSelection: selected, newSelection: result });
        return result;
      }
      const result = [...selected, id];
      console.log('[SELECTION] ElementSelectionController.select ctrlKey toggle on', { id, prevSelection: selected, newSelection: result });
      return result;
    }

    if (selected.length === 1 && selected[0] === id) {
      console.log('[SELECTION] ElementSelectionController.select deselect single', { id, prevSelection: selected, newSelection: [] });
      return [];
    }

    const result = [id];
    console.log('[SELECTION] ElementSelectionController.select select single', { id, prevSelection: selected, newSelection: result });
    return result;
  }
}
