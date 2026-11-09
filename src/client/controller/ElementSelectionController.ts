export class ElementSelectionController {
  select(selected: string[], id: string, ctrlKey: boolean): string[] {
    if (ctrlKey) {
      if (selected.includes(id)) {
        return selected.filter((itemId) => itemId !== id);
      }
      return [...selected, id];
    }

    if (selected.length === 1 && selected[0] === id) {
      return [];
    }

    return [id];
  }
}
