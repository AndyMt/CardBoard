export type ToolType = 'select' | 'card' | 'group' | 'connection';

export class ToolController {
  private selectedTool: ToolType = 'select';

  getSelectedTool(): ToolType {
    return this.selectedTool;
  }

  setSelectedTool(tool: ToolType): void {
    this.selectedTool = tool;
  }
}