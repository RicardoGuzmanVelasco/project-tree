export interface Task {
  id: number;
  title: string;
  description?: string;
  completed: boolean;
  abandoned?: boolean;
  children: Task[];
}

export interface Plan {
  id: number;
  name: string;
  taskIds: number[];
  archived?: boolean;
}
