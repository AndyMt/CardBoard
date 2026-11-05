import { ElementSelectionController } from './ElementSelectionController.js';

interface SelectableCard {
  id: string;
  groupId?: string;
}

export class GroupSelectionController extends ElementSelectionController {
  constructor(private cards: SelectableCard[]) {
    super();
  }

  select(selected: string[], id: string, ctrlKey: boolean): string[] {
    const memberIds = this.cards
      .filter((card) => card.groupId === id)
      .map((card) => card.id);
    const ids = [id, ...memberIds];

    if (ctrlKey) {
      const allSelected = ids.every((itemId) => selected.includes(itemId));
      if (allSelected) {
        return selected.filter((itemId) => !ids.includes(itemId));
      }
      return [...selected, ...ids.filter((itemId) => !selected.includes(itemId))];
    }

    return ids;
  }
}
