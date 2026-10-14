import { DatePipe, LowerCasePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { PageEvent } from '@angular/material/paginator';
import { MatSelectModule } from '@angular/material/select';
import { Sort } from '@angular/material/sort';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Subject, catchError, debounce, distinctUntilChanged, filter, map, of, skip, switchMap, tap, timer } from 'rxjs';
import { IS_BROWSER } from '../../config/tokens';
import { Contact } from '../../models/contact.model';
import { GridColumn } from '../../models/grid-column.model';
import {
  MESSAGE_STATUSES,
  MESSAGE_TYPES,
  Message,
  MessageQuery,
  MessageSortField,
  MessageStatus,
  MessageType,
  Page
} from '../../models/message.model';
import { ApiService } from '../../services/api.service';
import { DataGridComponent } from '../../shared/data-grid/data-grid.component';
import { describeError } from '../../utils/http-error';

type HistoryQuery = Required<MessageQuery>;
type Filters = Pick<HistoryQuery, 'search' | 'contactId' | 'type' | 'status'>;

interface ContactOption {
  id: number;
  label: string;
}

interface Outcome {
  page: Page<Message> | null;
  error: string | null;
}

const SEARCH_DEBOUNCE_MS = 300;
const MAX_CONTACT_ID = 2 ** 31 - 1;
const SORT_FIELDS: readonly MessageSortField[] = ['date', 'contact', 'type', 'status'];

function parseContactId(value: string | null): number | null {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 && id <= MAX_CONTACT_ID ? id : null;
}

function toContactOption(contact: Contact): ContactOption {
  return { id: contact.id, label: `${contact.name} ${contact.surname}`.trim() };
}

function byLabel(a: ContactOption, b: ContactOption): number {
  return a.label.localeCompare(b.label, undefined, { sensitivity: 'base' });
}

@Component({
  selector: 'app-history-page',
  standalone: true,
  imports: [
    DatePipe,
    LowerCasePipe,
    ReactiveFormsModule,
    RouterLink,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    DataGridComponent
  ],
  templateUrl: './history-page.component.html',
  styleUrl: './history-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class HistoryPageComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly isBrowser = inject(IS_BROWSER);
  private readonly reload$ = new Subject<void>();

  protected readonly columns: GridColumn<Message>[] = [
    { key: 'date', label: 'Date', sortable: true },
    { key: 'contact', label: 'Contact', sortable: true },
    { key: 'type', label: 'Type', sortable: true },
    { key: 'body', label: 'Message' },
    { key: 'status', label: 'Status', sortable: true }
  ];
  protected readonly pageSizeOptions = [10, 25, 50];
  protected readonly types = MESSAGE_TYPES;
  protected readonly statuses = MESSAGE_STATUSES;

  protected readonly query = signal<HistoryQuery>({
    page: 1,
    pageSize: this.pageSizeOptions[0],
    sortBy: 'date',
    sortDirection: 'desc',
    search: '',
    contactId: parseContactId(this.route.snapshot.queryParamMap.get('contactId')),
    type: null,
    status: null
  });
  protected readonly messages = signal<Message[]>([]);
  protected readonly total = signal(0);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly contactOptions = signal<ContactOption[]>([]);

  protected readonly filters = this.fb.nonNullable.group({
    search: this.fb.nonNullable.control(''),
    contactId: this.fb.nonNullable.control<number | ''>(this.query().contactId ?? ''),
    type: this.fb.nonNullable.control<MessageType | ''>(''),
    status: this.fb.nonNullable.control<MessageStatus | ''>('')
  });
  protected readonly searchText = toSignal(this.filters.controls.search.valueChanges, { initialValue: '' });

  protected readonly hasActiveFilters = computed(() => {
    const { search, contactId, type, status } = this.query();
    return !!search || contactId !== null || type !== null || status !== null;
  });
  protected readonly isEmpty = computed(
    () => !this.loading() && this.error() === null && this.total() === 0 && !this.hasActiveFilters()
  );

  ngOnInit(): void {
    if (!this.isBrowser) {
      return;
    }
    this.watchRequests();
    this.watchFilters();
    this.watchContactParam();
    this.loadContacts();
    this.reload$.next();
  }

  protected reload(): void {
    this.reload$.next();
  }

  protected onSortChange(sort: Sort): void {
    const sortBy = SORT_FIELDS.find(field => field === sort.active);
    if (sortBy) {
      this.updateQuery({ sortBy, sortDirection: sort.direction || 'asc' });
    }
  }

  protected onPageChange(event: PageEvent): void {
    const pageSizeChanged = event.pageSize !== this.query().pageSize;
    this.updateQuery({ page: pageSizeChanged ? 1 : event.pageIndex + 1, pageSize: event.pageSize });
  }

  protected clearSearch(input: HTMLInputElement): void {
    this.filters.controls.search.setValue('');
    input.focus();
  }

  protected clearFilters(): void {
    this.filters.reset({ search: '', contactId: '', type: '', status: '' });
  }

  protected contactDetail(message: Message): string {
    return message.type === 'Email' ? message.contactEmail : message.contactPhoneNumber;
  }

  private watchRequests(): void {
    this.reload$
      .pipe(
        tap(() => {
          this.loading.set(true);
          this.error.set(null);
        }),
        switchMap(() =>
          this.api.getMessages(this.query()).pipe(
            map((page): Outcome => ({ page, error: null })),
            catchError((error: unknown) => of<Outcome>({ page: null, error: describeError(error) }))
          )
        ),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(({ page, error }) => {
        this.messages.set(page?.items ?? []);
        this.total.set(page?.total ?? 0);
        this.error.set(error);
        this.loading.set(false);
      });
  }

  private watchFilters(): void {
    this.filters.valueChanges
      .pipe(
        debounce(() => timer(this.hasPendingSearch() ? SEARCH_DEBOUNCE_MS : 0)),
        map(() => this.readFilters()),
        filter(filters => !this.isApplied(filters)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(filters => this.updateQuery(filters));
  }

  private watchContactParam(): void {
    this.route.queryParamMap
      .pipe(
        map(params => parseContactId(params.get('contactId'))),
        distinctUntilChanged(),
        skip(1),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(contactId => this.filters.controls.contactId.setValue(contactId ?? ''));
  }

  private loadContacts(): void {
    this.api
      .getContacts()
      .pipe(
        map(contacts => contacts.map(toContactOption).sort(byLabel)),
        catchError(() => of<ContactOption[]>([])),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(options => this.contactOptions.set(options));
  }

  private updateQuery(patch: Partial<HistoryQuery>): void {
    this.query.update(query => ({ ...query, page: 1, ...patch }));
    this.reload$.next();
  }

  private readFilters(): Filters {
    const { search, contactId, type, status } = this.filters.getRawValue();
    return { search: search.trim(), contactId: contactId || null, type: type || null, status: status || null };
  }

  private hasPendingSearch(): boolean {
    const search = this.filters.controls.search.value.trim();
    return search !== '' && search !== this.query().search;
  }

  private isApplied(filters: Filters): boolean {
    const query = this.query();
    return (
      filters.search === query.search &&
      filters.contactId === query.contactId &&
      filters.type === query.type &&
      filters.status === query.status
    );
  }
}
