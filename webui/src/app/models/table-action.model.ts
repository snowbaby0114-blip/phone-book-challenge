export interface TableAction<T = unknown> {
  label: string;
  icon: string;
  action: (row: T) => void;
}
