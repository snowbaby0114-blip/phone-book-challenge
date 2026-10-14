import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { Observable, Subject, of, throwError } from 'rxjs';
import { IS_BROWSER } from '../../config/tokens';
import { Contact } from '../../models/contact.model';
import { Message, MessageQuery, Page } from '../../models/message.model';
import { ApiService } from '../../services/api.service';
import { HistoryPageComponent } from './history-page.component';

@Component({ standalone: true, template: '' })
class BlankComponent {}

const contact = (id: number, name: string, surname: string): Contact => ({
  id,
  name,
  surname,
  phoneNumber: `+1555000000${id}`,
  email: `${name.toLowerCase()}@example.com`,
  createdAt: '2025-01-01T00:00:00Z',
  updatedAt: '2025-01-01T00:00:00Z'
});

const message = (id: number, overrides: Partial<Message> = {}): Message => ({
  id,
  type: 'SMS',
  status: 'Queued',
  body: `Body ${id}`,
  date: '2026-03-04T10:30:00Z',
  contactId: 1,
  contactName: 'Ada Lovelace',
  contactPhoneNumber: '+15550000001',
  contactEmail: 'ada@example.com',
  ...overrides
});

const pageOf = (items: Message[], total = items.length): Page<Message> => ({ items, total, page: 1, pageSize: 10 });

const defaultQuery: Required<MessageQuery> = {
  page: 1,
  pageSize: 10,
  sortBy: 'date',
  sortDirection: 'desc',
  search: '',
  contactId: null,
  type: null,
  status: null
};

const sleep = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

describe('HistoryPageComponent', () => {
  let harness: RouterTestingHarness;
  let page: HistoryPageComponent;
  let getMessages: jasmine.Spy;
  let getContacts: jasmine.Spy;

  interface Options {
    url?: string;
    responses?: Observable<Page<Message>>[];
    contacts?: Observable<Contact[]>;
    isBrowser?: boolean;
  }

  const configure = async ({ url = '/history', responses, contacts, isBrowser = true }: Options = {}): Promise<void> => {
    getMessages = jasmine.createSpy('getMessages');
    if (responses) {
      getMessages.and.returnValues(...responses);
    } else {
      getMessages.and.callFake(() => of(pageOf([message(1), message(2, { type: 'Email', status: 'Read', contactId: 2, contactName: 'Grace Hopper' })], 35)));
    }
    getContacts = jasmine.createSpy('getContacts').and.returnValue(contacts ?? of([contact(2, 'Grace', 'Hopper'), contact(1, 'Ada', 'Lovelace')]));
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'history', component: HistoryPageComponent },
          { path: 'contacts', component: BlankComponent }
        ]),
        provideNoopAnimations(),
        { provide: IS_BROWSER, useValue: isBrowser },
        { provide: ApiService, useValue: { getMessages, getContacts } }
      ]
    });
    harness = await RouterTestingHarness.create();
    page = await harness.navigateByUrl(url, HistoryPageComponent);
    await settle();
  };

  const settle = async (): Promise<void> => {
    harness.detectChanges();
    await harness.fixture.whenStable();
    harness.detectChanges();
  };

  const root = (): HTMLElement => harness.fixture.nativeElement as HTMLElement;
  const text = (element: Element | null): string => (element?.textContent ?? '').replace(/\s+/g, ' ').trim();
  const rows = (): HTMLElement[] => Array.from(root().querySelectorAll<HTMLElement>('tr.mat-mdc-row'));
  const header = (label: string): HTMLElement =>
    Array.from(root().querySelectorAll<HTMLElement>('th.mat-mdc-header-cell')).find(cell => text(cell).startsWith(label)) as HTMLElement;
  const rangeLabel = (): string => text(root().querySelector('.mat-mdc-paginator-range-label'));
  const query = (): Required<MessageQuery> => getMessages.calls.mostRecent().args[0];
  const filters = () => page['filters'];

  const click = async (element: HTMLElement): Promise<void> => {
    element.click();
    await settle();
  };

  const change = async (apply: () => void, wait = 10): Promise<void> => {
    apply();
    await sleep(wait);
    await settle();
  };

  describe('first load', () => {
    beforeEach(() => configure());

    it('asks for the newest messages first, unfiltered', () => {
      expect(getMessages).toHaveBeenCalledTimes(1);
      expect(query()).toEqual(defaultQuery);
    });

    it('titles the page', () => {
      expect(text(root().querySelector('h1'))).toBe('History');
    });

    it('offers filters in a labelled search region', () => {
      const region = root().querySelector('[role="search"]') as HTMLElement;
      expect(region.getAttribute('aria-label')).toBe('Filter messages');
      expect(Array.from(region.querySelectorAll('mat-label')).map(label => text(label))).toEqual(['Search messages', 'Contact', 'Type', 'Status']);
    });

    it('does not offer to clear filters when none are active', () => {
      expect(Array.from(root().querySelectorAll('button')).some(button => text(button) === 'Clear filters')).toBeFalse();
    });
  });

  describe('rendering messages', () => {
    beforeEach(() => configure());

    it('shows date, contact, type, body and status for each message', () => {
      const expectedDate = new DatePipe('en-US').transform('2026-03-04T10:30:00Z', 'MMM d, y, h:mm a') as string;
      const first = rows()[0];
      expect(text(first.querySelector('.message-date'))).toBe(expectedDate);
      expect(text(first.querySelector('.contact span'))).toBe('Ada Lovelace');
      expect(text(first.querySelector('.contact__detail'))).toBe('+15550000001');
      expect(text(first.querySelector('.chip:not([class*="chip--"])'))).toBe('sms SMS');
      expect(text(first.querySelector('.message-body'))).toBe('Body 1');
      expect(first.querySelector('.message-body')?.getAttribute('title')).toBe('Body 1');
      expect(text(first.querySelector('.chip--queued'))).toBe('Queued');
    });

    it('shows the email address for email messages and styles each status', () => {
      const second = rows()[1];
      expect(text(second.querySelector('.contact span'))).toBe('Grace Hopper');
      expect(text(second.querySelector('.contact__detail'))).toBe('ada@example.com');
      expect(text(second.querySelector('.chip:not([class*="chip--"])'))).toBe('email Email');
      expect(text(second.querySelector('.chip--read'))).toBe('Read');
    });

    it('reports the total from the server', () => {
      expect(rangeLabel()).toBe('1 – 10 of 35');
    });

    it('lists the contacts alphabetically for the filter', () => {
      expect(page['contactOptions']().map(option => option.label)).toEqual(['Ada Lovelace', 'Grace Hopper']);
    });
  });

  describe('loading', () => {
    it('shows a loading state with the filters in place', async () => {
      await configure({ responses: [new Subject<Page<Message>>()] });
      expect(text(root().querySelector('output'))).toBe('Loading…');
      expect(root().querySelector('[role="search"]')).not.toBeNull();
      expect(root().querySelector('.empty')).toBeNull();
    });

    it('keeps the previous rows visible while the next page loads', async () => {
      const next = new Subject<Page<Message>>();
      await configure({ responses: [of(pageOf([message(1), message(2)], 35)), next] });
      await click(root().querySelector('.mat-mdc-paginator-navigation-next') as HTMLElement);
      expect(rows()).toHaveSize(2);
      expect(root().querySelector('mat-progress-bar')).not.toBeNull();
      next.next(pageOf([message(3)], 35));
      await settle();
      expect(rows()).toHaveSize(1);
      expect(root().querySelector('mat-progress-bar')).toBeNull();
    });

    it('does not fetch on the server', async () => {
      await configure({ isBrowser: false });
      expect(getMessages).not.toHaveBeenCalled();
      expect(getContacts).not.toHaveBeenCalled();
      expect(text(root().querySelector('h1'))).toBe('History');
    });
  });

  describe('paging', () => {
    beforeEach(() => configure());

    it('requests the next page and keeps the other settings', async () => {
      await click(root().querySelector('.mat-mdc-paginator-navigation-next') as HTMLElement);
      expect(getMessages).toHaveBeenCalledTimes(2);
      expect(query()).toEqual({ ...defaultQuery, page: 2 });
      expect(rangeLabel()).toBe('11 – 20 of 35');
    });

    it('goes back to the first page when the page size changes', async () => {
      await click(root().querySelector('.mat-mdc-paginator-navigation-next') as HTMLElement);
      page['onPageChange']({ pageIndex: 1, pageSize: 25, length: 35, previousPageIndex: 1 });
      await settle();
      expect(query()).toEqual({ ...defaultQuery, page: 1, pageSize: 25 });
    });
  });

  describe('sorting', () => {
    beforeEach(() => configure());

    it('sorts by a column ascending, then descending', async () => {
      await click(header('Status'));
      expect(query()).toEqual({ ...defaultQuery, sortBy: 'status', sortDirection: 'asc' });
      expect(header('Status').getAttribute('aria-sort')).toBe('ascending');
      await click(header('Status'));
      expect(query()).toEqual({ ...defaultQuery, sortBy: 'status', sortDirection: 'desc' });
      expect(header('Status').getAttribute('aria-sort')).toBe('descending');
    });

    it('reverses the default date order when the date header is clicked', async () => {
      expect(header('Date').getAttribute('aria-sort')).toBe('descending');
      await click(header('Date'));
      expect(query()).toEqual({ ...defaultQuery, sortBy: 'date', sortDirection: 'asc' });
    });

    it('supports every sortable column', async () => {
      for (const [label, field] of [['Contact', 'contact'], ['Type', 'type'], ['Status', 'status'], ['Date', 'date']]) {
        await click(header(label));
        expect(query().sortBy).toBe(field as 'contact');
      }
    });

    it('returns to the first page when the order changes', async () => {
      await click(root().querySelector('.mat-mdc-paginator-navigation-next') as HTMLElement);
      await click(header('Contact'));
      expect(query().page).toBe(1);
    });

    it('ignores sort fields it does not know', async () => {
      const calls = getMessages.calls.count();
      page['onSortChange']({ active: 'body', direction: 'asc' });
      await settle();
      expect(getMessages).toHaveBeenCalledTimes(calls);
    });

    it('falls back to ascending when the direction is cleared', async () => {
      page['onSortChange']({ active: 'type', direction: '' });
      await settle();
      expect(query()).toEqual({ ...defaultQuery, sortBy: 'type', sortDirection: 'asc' });
    });

    it('does not sort by the message text', async () => {
      const calls = getMessages.calls.count();
      await click(header('Message'));
      expect(getMessages).toHaveBeenCalledTimes(calls);
    });
  });

  describe('filtering', () => {
    beforeEach(() => configure());

    it('filters by type', async () => {
      await change(() => filters().controls.type.setValue('SMS'));
      expect(getMessages).toHaveBeenCalledTimes(2);
      expect(query()).toEqual({ ...defaultQuery, type: 'SMS' });
      expect(root().querySelector('.filters__clear')).not.toBeNull();
    });

    it('filters by status', async () => {
      await change(() => filters().controls.status.setValue('Failed'));
      expect(query()).toEqual({ ...defaultQuery, status: 'Failed' });
    });

    it('filters by contact', async () => {
      await change(() => filters().controls.contactId.setValue(2));
      expect(query()).toEqual({ ...defaultQuery, contactId: 2 });
    });

    it('combines filters made together into a single request', async () => {
      await change(() => {
        filters().controls.type.setValue('Email');
        filters().controls.status.setValue('Read');
        filters().controls.contactId.setValue(2);
      });
      expect(getMessages).toHaveBeenCalledTimes(2);
      expect(query()).toEqual({ ...defaultQuery, type: 'Email', status: 'Read', contactId: 2 });
    });

    it('waits for the user to stop typing before searching', async () => {
      await change(() => filters().controls.search.setValue('a'), 0);
      await sleep(100);
      filters().controls.search.setValue('am');
      await sleep(100);
      filters().controls.search.setValue('ama');
      await sleep(150);
      expect(getMessages).toHaveBeenCalledTimes(1);
      await sleep(250);
      await settle();
      expect(getMessages).toHaveBeenCalledTimes(2);
      expect(query()).toEqual({ ...defaultQuery, search: 'ama' });
    });

    it('trims the search and ignores blank input', async () => {
      await change(() => filters().controls.search.setValue('   '), 400);
      expect(getMessages).toHaveBeenCalledTimes(1);
      await change(() => filters().controls.search.setValue('  eye exam  '), 400);
      expect(query().search).toBe('eye exam');
    });

    it('clears the search from the field button', async () => {
      await change(() => filters().controls.search.setValue('exam'), 400);
      await click(root().querySelector('button[aria-label="Clear search"]') as HTMLElement);
      await sleep(10);
      await settle();
      expect(query().search).toBe('');
      expect(root().querySelector('button[aria-label="Clear search"]')).toBeNull();
    });

    it('returns to the first page whenever a filter changes', async () => {
      await click(root().querySelector('.mat-mdc-paginator-navigation-next') as HTMLElement);
      expect(query().page).toBe(2);
      await change(() => filters().controls.status.setValue('Sent'));
      expect(query().page).toBe(1);
    });

    it('clears every filter at once', async () => {
      await change(() => {
        filters().controls.type.setValue('SMS');
        filters().controls.status.setValue('Sent');
        filters().controls.contactId.setValue(1);
      });
      const calls = getMessages.calls.count();
      const clear = Array.from(root().querySelectorAll('button')).find(button => text(button) === 'Clear filters') as HTMLElement;
      await click(clear);
      await sleep(10);
      await settle();
      expect(getMessages).toHaveBeenCalledTimes(calls + 1);
      expect(query()).toEqual(defaultQuery);
      expect(filters().getRawValue()).toEqual({ search: '', contactId: '', type: '', status: '' });
    });

    it('does not repeat a request when the filters have not really changed', async () => {
      await change(() => filters().controls.type.setValue('SMS'));
      const calls = getMessages.calls.count();
      await change(() => filters().controls.type.setValue('SMS'));
      expect(getMessages).toHaveBeenCalledTimes(calls);
    });
  });

  describe('responses arriving out of order', () => {
    it('ignores an older response that arrives after a newer one', async () => {
      const older = new Subject<Page<Message>>();
      const newer = new Subject<Page<Message>>();
      await configure({ responses: [older, newer] });

      await change(() => filters().controls.type.setValue('SMS'));
      newer.next(pageOf([message(2, { body: 'Newer result' })]));
      older.next(pageOf([message(1, { body: 'Stale result' })]));
      await settle();

      expect(rows().map(row => text(row.querySelector('.message-body')))).toEqual(['Newer result']);
    });
  });

  describe('failing to load', () => {
    it('shows a friendly message and recovers on retry', async () => {
      await configure({
        responses: [throwError(() => new HttpErrorResponse({ status: 500, error: { title: 'Internal Server Error' } })), of(pageOf([message(1)]))]
      });
      expect(text(root().querySelector('[role="alert"]'))).toContain('Something went wrong. Please try again.');
      expect(rows()).toHaveSize(0);

      await click(Array.from(root().querySelectorAll('button')).find(button => text(button) === 'Try again') as HTMLElement);
      expect(root().querySelector('[role="alert"]')).toBeNull();
      expect(rows()).toHaveSize(1);
    });

    it('explains a network failure', async () => {
      await configure({ responses: [throwError(() => new HttpErrorResponse({ status: 0, error: new ProgressEvent('error') }))] });
      expect(text(root().querySelector('[role="alert"]'))).toContain('Unable to reach the server');
    });

    it('still works when the contact list cannot be loaded', async () => {
      await configure({ contacts: throwError(() => new HttpErrorResponse({ status: 500 })) });
      expect(page['contactOptions']()).toEqual([]);
      expect(rows()).toHaveSize(2);
    });
  });

  describe('empty history', () => {
    it('invites the user to send a first message', async () => {
      await configure({ responses: [of(pageOf([], 0))] });
      expect(text(root().querySelector('.empty h2'))).toBe('No messages yet');
      expect(root().querySelector('.empty a')?.getAttribute('href')).toBe('/contacts');
      expect(root().querySelector('app-data-grid')).toBeNull();
      expect(root().querySelector('[role="search"]')).toBeNull();
    });

    it('keeps the filters and a helpful message when a filter matches nothing', async () => {
      await configure({ url: '/history?contactId=2', responses: [of(pageOf([], 0))] });
      expect(root().querySelector('.empty')).toBeNull();
      expect(root().querySelector('[role="search"]')).not.toBeNull();
      expect(text(root().querySelector('output'))).toContain('No messages match your filters.');
    });
  });

  describe('contact in the address', () => {
    it('preselects the contact from the address', async () => {
      await configure({ url: '/history?contactId=2' });
      expect(query()).toEqual({ ...defaultQuery, contactId: 2 });
      expect(filters().controls.contactId.value).toBe(2);
      expect(root().querySelector('.filters__clear')).not.toBeNull();
    });

    for (const invalid of ['abc', '0', '-3', '2.5', '99999999999', '']) {
      it(`ignores the invalid contact "${invalid}"`, async () => {
        await configure({ url: `/history?contactId=${invalid}` });
        expect(query().contactId).toBeNull();
        expect(filters().controls.contactId.value).toBe('');
      });
    }

    it('follows the address when it changes while the page is open', async () => {
      await configure();
      await harness.navigateByUrl('/history?contactId=2');
      await sleep(10);
      await settle();
      expect(query().contactId).toBe(2);
      expect(filters().controls.contactId.value).toBe(2);

      await harness.navigateByUrl('/history?contactId=1');
      await sleep(10);
      await settle();
      expect(query().contactId).toBe(1);
    });

    it('drops the contact filter when the address loses it', async () => {
      await configure({ url: '/history?contactId=2' });
      await change(() => filters().controls.contactId.setValue(1));
      await harness.navigateByUrl('/history');
      await sleep(10);
      await settle();
      expect(filters().controls.contactId.value).toBe('');
      expect(query().contactId).toBeNull();
    });
  });
});
