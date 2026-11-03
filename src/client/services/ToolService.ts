import { ToolController, ToolType } from '../../server/controller/ToolController';

class ToolService {
  private static instance: ToolService;
  private toolController: ToolController;

  private constructor() {
    this.toolController = new ToolController();
  }

  public static getInstance(): ToolService {
    if (!ToolService.instance) {
      ToolService.instance = new ToolService();
    }
    return ToolService.instance;
  }

  getSelectedTool(): ToolType {
    return this.toolController.getSelectedTool();
  }

  setSelectedTool(tool: ToolType): void {
    this.toolController.setSelectedTool(tool);
  }
}

export default ToolService;
export type { ToolType };