export class ElementSelectionController {
  select(selected: string[], id: string, ctrlKey: boolean): string[] {
    if (ctrlKey) {
      if (selected.includes(id)) {
        return selected.filter(item => item !== id);
      }
      return [...selected, id];
    }
    return [id];
  }
}
