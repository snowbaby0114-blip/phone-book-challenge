import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ContentChild,
  EventEmitter,
  Input,
  Output,
  TemplateRef,
  ViewChild,
  signal
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginator, MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatSort, MatSortModule, Sort, SortDirection } from '@angular/material/sort';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { GridCellContext, GridColumn } from '../../models/grid-column.model';
import { TableAction } from '../../models/table-action.model';

const ACTIONS_COLUMN = 'actions';

@Component({
  selector: 'app-data-grid',
  standalone: true,
  imports: [
    NgTemplateOutlet,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatPaginatorModule,
    MatProgressBarModule,
    MatSelectModule,
    MatSortModule,
    MatTableModule
  ],
  templateUrl: './data-grid.component.html',
  styleUrl: './data-grid.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DataGridComponent<T = unknown> {
  protected readonly dataSource = new MatTableDataSource<T>([]);
  protected readonly filter = signal('');
  protected readonly activeSort = signal<Sort>({ active: '', direction: '' });
  protected displayedColumns: string[] = [];
  protected sortableColumns: GridColumn<T>[] = [];

  private columnList: GridColumn<T>[] = [];
  private actionList: TableAction<T>[] = [];
  private matSort?: MatSort;

  @Input() loading = false;
  @Input() error: string | null = null;
  @Input() emptyMessage = 'No data to display.';
  @Input() label = '';
  @Input() searchable = false;
  @Input() searchLabel = 'Search';
  @Input() pageSize = 10;
  @Input() pageSizeOptions: number[] = [10, 25, 50];
  @Input() serverSide = false;
  @Input() total = 0;
  @Input() pageIndex = 0;

  @Input() set sortActive(active: string) {
    this.activeSort.update(sort => ({ ...sort, active }));
  }

  @Input() set sortDirection(direction: SortDirection) {
    this.activeSort.update(sort => ({ ...sort, direction }));
  }

  @Input() set columns(columns: GridColumn<T>[]) {
    this.columnList = columns ?? [];
    this.sortableColumns = this.columnList.filter(column => column.sortable);
    this.refreshDisplayedColumns();
  }

  @Input() set actions(actions: TableAction<T>[]) {
    this.actionList = actions ?? [];
    this.refreshDisplayedColumns();
  }

  @Input() set data(rows: T[] | null) {
    this.dataSource.data = rows ?? [];
  }

  @Output() readonly pageChange = new EventEmitter<PageEvent>();
  @Output() readonly sortChange = new EventEmitter<Sort>();
  @Output() readonly retry = new EventEmitter<void>();

  @ContentChild('cell', { read: TemplateRef }) protected cellTemplate?: TemplateRef<GridCellContext<T>>;

  @ViewChild(MatPaginator) protected set paginatorRef(paginator: MatPaginator | undefined) {
    if (!this.serverSide) {
      this.dataSource.paginator = paginator ?? null;
    }
  }

  @ViewChild(MatSort) protected set sortRef(sort: MatSort | undefined) {
    this.matSort = sort;
    if (!this.serverSide) {
      this.dataSource.sort = sort ?? null;
    }
  }

  constructor() {
    this.dataSource.sortingDataAccessor = (row, key) => {
      const value = this.cellValue(row, this.columnList.find(column => column.key === key));
      return typeof value === 'string' ? value.toLowerCase() : value ?? '';
    };
    this.dataSource.filterPredicate = (row, term) =>
      this.columnList.some(column => String(this.cellValue(row, column) ?? '').toLowerCase().includes(term));
  }

  protected get columnDefs(): GridColumn<T>[] {
    return this.columnList;
  }

  protected get actionDefs(): TableAction<T>[] {
    return this.actionList;
  }

  protected get hasRows(): boolean {
    return this.serverSide ? this.dataSource.data.length > 0 : this.dataSource.filteredData.length > 0;
  }

  protected cellValue(row: T, column?: GridColumn<T>): string | number | null | undefined {
    if (!column) {
      return undefined;
    }
    return column.value ? column.value(row) : (row as Record<string, string | number | null | undefined>)[column.key];
  }

  protected trackRow = (_index: number, row: T): unknown => (row as { id?: unknown }).id ?? row;

  protected applyFilter(term: string): void {
    this.filter.set(term);
    this.dataSource.filter = term.trim().toLowerCase();
    this.dataSource.paginator?.firstPage();
  }

  protected onSort(sort: Sort): void {
    this.activeSort.set(sort);
    this.sortChange.emit(sort);
  }

  protected sortBy(key: string): void {
    this.matSort?.sort({ id: key, start: 'asc', disableClear: true });
  }

  protected toggleSortDirection(): void {
    const { active } = this.activeSort();
    if (active) {
      this.matSort?.sort({ id: active, start: 'asc', disableClear: true });
    }
  }

  private refreshDisplayedColumns(): void {
    this.displayedColumns = [
      ...this.columnList.map(column => column.key),
      ...(this.actionList.length ? [ACTIONS_COLUMN] : [])
    ];
  }
}
