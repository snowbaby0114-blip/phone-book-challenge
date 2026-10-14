export interface GridColumn<T = unknown> {
  key: string;
  label: string;
  sortable?: boolean;
  value?: (row: T) => string | number | null | undefined;
}

export interface GridCellContext<T = unknown> {
  $implicit: T;
  column: GridColumn<T>;
}
