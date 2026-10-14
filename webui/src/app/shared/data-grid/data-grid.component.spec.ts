import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { GridColumn } from '../../models/grid-column.model';
import { TableAction } from '../../models/table-action.model';
import { DataGridComponent } from './data-grid.component';

interface Person {
  id: number;
  name: string;
  surname: string;
  city: string;
}

const people: Person[] = [
  { id: 1, name: 'Cara', surname: 'Zed', city: 'Oslo' },
  { id: 2, name: 'Abe', surname: 'Young', city: 'Rome' },
  { id: 3, name: 'Bea', surname: 'Xu', city: 'Lima' },
  { id: 4, name: 'Dan', surname: 'West', city: 'Kyiv' },
  { id: 5, name: 'Eve', surname: 'Vale', city: 'Pune' }
];

const columns: GridColumn<Person>[] = [
  { key: 'name', label: 'Name', sortable: true, value: person => `${person.name} ${person.surname}` },
  { key: 'city', label: 'City', sortable: true }
];

@Component({
  standalone: true,
  imports: [DataGridComponent],
  template: `
    <app-data-grid [columns]="columns" [data]="rows">
      <ng-template #cell let-row let-column="column"><b class="custom">{{ column.key }}={{ row.id }}</b></ng-template>
    </app-data-grid>
  `
})
class TemplateHostComponent {
  columns = columns;
  rows = people;
}

describe('DataGridComponent', () => {
  let fixture: ComponentFixture<DataGridComponent>;

  const render = async (inputs: Record<string, unknown> = {}): Promise<void> => {
    TestBed.configureTestingModule({ imports: [DataGridComponent], providers: [provideNoopAnimations()] });
    fixture = TestBed.createComponent(DataGridComponent);
    fixture.componentRef.setInput('columns', columns);
    fixture.componentRef.setInput('data', people);
    for (const [name, value] of Object.entries(inputs)) {
      fixture.componentRef.setInput(name, value);
    }
    fixture.detectChanges();
    await settle();
  };

  const settle = async (): Promise<void> => {
    await fixture.whenStable();
    fixture.detectChanges();
    await fixture.whenStable();
  };

  const root = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const text = (element: Element): string => (element.textContent ?? '').replace(/\s+/g, ' ').trim();
  const rows = (): string[] => Array.from(root().querySelectorAll('tr.mat-mdc-row')).map(text);
  const headers = (): HTMLElement[] => Array.from(root().querySelectorAll<HTMLElement>('th.mat-mdc-header-cell'));
  const header = (label: string): HTMLElement => headers().find(cell => text(cell).startsWith(label)) as HTMLElement;
  const button = (label: string): HTMLButtonElement =>
    Array.from(root().querySelectorAll<HTMLButtonElement>('button')).find(candidate => text(candidate).includes(label)) as HTMLButtonElement;
  const rangeLabel = (): string => text(root().querySelector('.mat-mdc-paginator-range-label') as Element);
  const click = async (element: HTMLElement): Promise<void> => {
    element.click();
    await settle();
  };
  const type = async (value: string): Promise<void> => {
    const input = root().querySelector('input[type="search"]') as HTMLInputElement;
    input.value = value;
    input.dispatchEvent(new Event('input'));
    await settle();
  };

  describe('rendering', () => {
    it('renders a header for every column', async () => {
      await render();
      expect(headers().map(text)).toEqual(['Name', 'City']);
    });

    it('renders one row per record using the value function or the key', async () => {
      await render();
      expect(rows()).toEqual(['Cara Zed Oslo', 'Abe Young Rome', 'Bea Xu Lima', 'Dan West Kyiv', 'Eve Vale Pune']);
    });

    it('labels every cell for the stacked mobile layout', async () => {
      await render();
      const cells = Array.from(root().querySelectorAll('tr.mat-mdc-row:first-child td'));
      expect(cells.map(cell => cell.getAttribute('data-label'))).toEqual(['Name', 'City']);
    });

    it('exposes the table label to assistive technology', async () => {
      await render({ label: 'People' });
      expect(root().querySelector('table')?.getAttribute('aria-label')).toBe('People');
    });

    it('treats missing columns and actions as empty', async () => {
      await render({ columns: null, actions: null });
      expect(headers()).toEqual([]);
      expect(root().querySelector('td.grid__actions')).toBeNull();
      expect(root().querySelector('.grid__sort')).toBeNull();
    });

    it('renders projected cell templates for every cell', async () => {
      const host = TestBed.configureTestingModule({ imports: [TemplateHostComponent], providers: [provideNoopAnimations()] }).createComponent(TemplateHostComponent);
      host.detectChanges();
      await host.whenStable();
      host.detectChanges();
      const custom = Array.from((host.nativeElement as HTMLElement).querySelectorAll('.custom')).map(text);
      expect(custom).toHaveSize(people.length * columns.length);
      expect(custom.slice(0, 2)).toEqual(['name=1', 'city=1']);
    });
  });

  describe('states', () => {
    it('shows a loading message instead of the table while loading without data', async () => {
      await render({ data: [], loading: true });
      expect(root().querySelector('table')).toBeNull();
      expect(text(root().querySelector('output') as Element)).toBe('Loading…');
      expect(root().querySelector('mat-progress-bar')).not.toBeNull();
    });

    it('keeps the rows and shows progress while reloading', async () => {
      await render({ loading: true });
      expect(rows()).toHaveSize(5);
      expect(root().querySelector('mat-progress-bar')).not.toBeNull();
    });

    it('does not show progress when idle', async () => {
      await render();
      expect(root().querySelector('mat-progress-bar')).toBeNull();
    });

    it('shows the default empty message', async () => {
      await render({ data: [] });
      expect(text(root().querySelector('output') as Element)).toContain('No data to display.');
      expect(root().querySelector('table')).toBeNull();
    });

    it('shows a custom empty message', async () => {
      await render({ data: [], emptyMessage: 'Nobody here.' });
      expect(text(root().querySelector('output') as Element)).toContain('Nobody here.');
    });

    it('treats null data as empty', async () => {
      await render({ data: null });
      expect(text(root().querySelector('output') as Element)).toContain('No data to display.');
    });

    it('shows the error, announces it and offers a retry', async () => {
      await render({ error: 'Could not load.' });
      const alert = root().querySelector('[role="alert"]') as HTMLElement;
      expect(text(alert)).toContain('Could not load.');
      const retries: number[] = [];
      fixture.componentInstance.retry.subscribe(() => retries.push(1));
      await click(button('Try again'));
      expect(retries).toHaveSize(1);
    });

    it('prefers the error over existing rows', async () => {
      await render({ error: 'Could not load.' });
      expect(root().querySelector('table')).toBeNull();
    });
  });

  describe('client-side search', () => {
    it('is hidden unless enabled', async () => {
      await render();
      expect(root().querySelector('input[type="search"]')).toBeNull();
    });

    it('filters on value-function and plain-key columns, ignoring case', async () => {
      await render({ searchable: true, searchLabel: 'Search people' });
      await type('XU');
      expect(rows()).toEqual(['Bea Xu Lima']);
      await type('kyiv');
      expect(rows()).toEqual(['Dan West Kyiv']);
    });

    it('shows a no-results message with a way back', async () => {
      await render({ searchable: true });
      await type('zzz');
      expect(rows()).toEqual([]);
      expect(text(root().querySelector('output') as Element)).toContain('No results match your search.');
      await click(button('Clear search'));
      expect(rows()).toHaveSize(5);
      expect((root().querySelector('input[type="search"]') as HTMLInputElement).value).toBe('');
    });

    it('clears from the field button', async () => {
      await render({ searchable: true });
      await type('oslo');
      expect(rows()).toHaveSize(1);
      await click(root().querySelector('button[aria-label="Clear search"]') as HTMLElement);
      expect(rows()).toHaveSize(5);
    });

    it('returns to the first page after filtering', async () => {
      await render({ searchable: true, pageSize: 2, pageSizeOptions: [2, 5] });
      await click(root().querySelector('.mat-mdc-paginator-navigation-next') as HTMLElement);
      expect(rangeLabel()).toBe('3 – 4 of 5');
      await type('e');
      expect(rangeLabel()).toMatch(/^1 – /);
    });
  });

  describe('client-side sorting', () => {
    it('sorts ascending then descending by the displayed value', async () => {
      await render();
      await click(header('Name'));
      expect(rows()[0]).toBe('Abe Young Rome');
      expect(rows()[4]).toBe('Eve Vale Pune');
      expect(header('Name').getAttribute('aria-sort')).toBe('ascending');
      await click(header('Name'));
      expect(rows()[0]).toBe('Eve Vale Pune');
      expect(header('Name').getAttribute('aria-sort')).toBe('descending');
    });

    it('never offers an unsorted third state', async () => {
      await render();
      await click(header('City'));
      await click(header('City'));
      await click(header('City'));
      expect(header('City').getAttribute('aria-sort')).toBe('ascending');
    });

    it('sorts by a plain key', async () => {
      await render();
      await click(header('City'));
      expect(rows().map(row => row.split(' ').pop())).toEqual(['Kyiv', 'Lima', 'Oslo', 'Pune', 'Rome']);
    });

    it('announces sort changes', async () => {
      await render();
      const changes: { active: string; direction: string }[] = [];
      fixture.componentInstance.sortChange.subscribe(change => changes.push(change));
      await click(header('City'));
      await click(header('City'));
      expect(changes).toEqual([
        { active: 'city', direction: 'asc' },
        { active: 'city', direction: 'desc' }
      ]);
    });

    it('starts from the requested sort', async () => {
      await render({ sortActive: 'name', sortDirection: 'desc' });
      expect(rows()[0]).toBe('Eve Vale Pune');
      expect(header('Name').getAttribute('aria-sort')).toBe('descending');
    });

    it('leaves columns that are not sortable alone', async () => {
      await render({ columns: [{ key: 'name', label: 'Name', sortable: false }, { key: 'city', label: 'City', sortable: true }] });
      const changes: unknown[] = [];
      fixture.componentInstance.sortChange.subscribe(change => changes.push(change));
      await click(header('Name'));
      expect(changes).toEqual([]);
    });

    it('offers a sort-by control for small screens that drives the same sort', async () => {
      await render();
      expect(root().querySelector('.grid__sort mat-select')).not.toBeNull();
      const instance = fixture.componentInstance as unknown as { sortBy(key: string): void; toggleSortDirection(): void };
      instance.sortBy('city');
      await settle();
      expect(rows().map(row => row.split(' ').pop())).toEqual(['Kyiv', 'Lima', 'Oslo', 'Pune', 'Rome']);
      instance.toggleSortDirection();
      await settle();
      expect(rows().map(row => row.split(' ').pop())).toEqual(['Rome', 'Pune', 'Oslo', 'Lima', 'Kyiv']);
    });

    it('sorts unknown keys as empty values instead of failing', async () => {
      await render();
      const { dataSource } = fixture.componentInstance as unknown as { dataSource: { sortingDataAccessor: (row: unknown, key: string) => unknown } };
      expect(dataSource.sortingDataAccessor(people[0], 'unknown')).toBe('');
      expect(dataSource.sortingDataAccessor(people[0], 'name')).toBe('cara zed');
    });

    it('has no sort-by control when nothing is sortable', async () => {
      await render({ columns: [{ key: 'name', label: 'Name' }] });
      expect(root().querySelector('.grid__sort')).toBeNull();
    });
  });

  describe('client-side pagination', () => {
    it('shows one page at a time', async () => {
      await render({ pageSize: 2, pageSizeOptions: [2, 5] });
      expect(rows()).toEqual(['Cara Zed Oslo', 'Abe Young Rome']);
      expect(rangeLabel()).toBe('1 – 2 of 5');
      await click(root().querySelector('.mat-mdc-paginator-navigation-next') as HTMLElement);
      expect(rows()).toEqual(['Bea Xu Lima', 'Dan West Kyiv']);
      expect(rangeLabel()).toBe('3 – 4 of 5');
      await click(root().querySelector('.mat-mdc-paginator-navigation-last') as HTMLElement);
      expect(rows()).toEqual(['Eve Vale Pune']);
    });

    it('shows everything when the page is large enough', async () => {
      await render({ pageSize: 10 });
      expect(rows()).toHaveSize(5);
      expect(rangeLabel()).toBe('1 – 5 of 5');
    });
  });

  describe('server-side mode', () => {
    const serverInputs = { serverSide: true, total: 42, pageSize: 5, pageIndex: 0, pageSizeOptions: [5, 10] };

    it('renders exactly the rows it is given and reports the server total', async () => {
      await render(serverInputs);
      expect(rows()).toHaveSize(5);
      expect(rangeLabel()).toBe('1 – 5 of 42');
    });

    it('does not sort locally', async () => {
      await render(serverInputs);
      await click(header('City'));
      expect(rows()[0]).toBe('Cara Zed Oslo');
    });

    it('leaves searching to the page instead of filtering one page locally', async () => {
      await render({ ...serverInputs, searchable: true });
      expect(root().querySelector('input[type="search"]')).toBeNull();
      expect(rows()).toHaveSize(5);
    });

    it('emits page changes instead of paging locally', async () => {
      await render(serverInputs);
      const pages: { pageIndex: number; pageSize: number }[] = [];
      fixture.componentInstance.pageChange.subscribe(event => pages.push({ pageIndex: event.pageIndex, pageSize: event.pageSize }));
      await click(root().querySelector('.mat-mdc-paginator-navigation-next') as HTMLElement);
      expect(pages).toEqual([{ pageIndex: 1, pageSize: 5 }]);
      expect(rows()).toHaveSize(5);
    });

    it('reflects the requested page index', async () => {
      await render({ ...serverInputs, pageIndex: 2 });
      expect(rangeLabel()).toBe('11 – 15 of 42');
    });

    it('emits sort changes and mirrors the requested sort', async () => {
      await render({ ...serverInputs, sortActive: 'name', sortDirection: 'desc' });
      expect(header('Name').getAttribute('aria-sort')).toBe('descending');
      const changes: { active: string; direction: string }[] = [];
      fixture.componentInstance.sortChange.subscribe(change => changes.push(change));
      await click(header('City'));
      expect(changes).toEqual([{ active: 'city', direction: 'asc' }]);
    });
  });

  describe('actions', () => {
    it('renders every action per row and passes the row to the handler', async () => {
      const message = jasmine.createSpy('message');
      const history = jasmine.createSpy('history');
      const actions: TableAction<Person>[] = [
        { label: 'Message', icon: 'chat', action: message },
        { label: 'History', icon: 'history', action: history }
      ];
      await render({ actions });

      const firstRow = root().querySelector('tr.mat-mdc-row') as HTMLElement;
      const buttons = Array.from(firstRow.querySelectorAll<HTMLButtonElement>('button'));
      expect(buttons.map(text)).toEqual(['chat Message', 'history History']);
      await click(buttons[0]);
      await click(buttons[1]);
      expect(message).toHaveBeenCalledOnceWith(people[0]);
      expect(history).toHaveBeenCalledOnceWith(people[0]);
    });

    it('adds no actions column without actions', async () => {
      await render();
      expect(root().querySelector('td.grid__actions')).toBeNull();
    });
  });
});
