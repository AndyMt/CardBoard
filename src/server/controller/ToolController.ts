export type ToolType = 'select' | 'card' | 'group';

export class ToolController {
  private selectedTool: ToolType = 'select';

  getSelectedTool(): ToolType {
    return this.selectedTool;
  }

  setSelectedTool(tool: ToolType): void {
    this.selectedTool = tool;
  }
}