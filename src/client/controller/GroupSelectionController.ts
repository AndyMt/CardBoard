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

    if (ctrlKey) {
      // Ctrl+Click toggles only the group itself, matching card behavior.
      if (selected.includes(id)) {
        return selected.filter((itemId) => itemId !== id);
      }
      return [...selected, id];
    }

    return [id, ...memberIds];
  }
}
