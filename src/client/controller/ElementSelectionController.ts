export class ElementSelectionController {
  select(selected: string[], id: string, ctrlKey: boolean): string[] {
    if (selected.includes(id)) {
      return selected;
    }
    return [...selected, id];
  }
}
