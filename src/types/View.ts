export type ViewType = 'Usecase' | 'Functional';

export interface View {
  id: string;
  name: string;
  type: ViewType;
  isDefault?: boolean;
}
