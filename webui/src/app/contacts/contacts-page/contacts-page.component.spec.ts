import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { Router, provideRouter } from '@angular/router';
import { Observable, Subject, of, throwError } from 'rxjs';
import { IS_BROWSER } from '../../config/tokens';
import { Contact } from '../../models/contact.model';
import { Message } from '../../models/message.model';
import { ApiService } from '../../services/api.service';
import { SendMessageDialogComponent } from '../send-message-dialog/send-message-dialog.component';
import { ContactsPageComponent } from './contacts-page.component';

const contact = (id: number, name: string, surname: string): Contact => ({
  id,
  name,
  surname,
  phoneNumber: `+1555000000${id}`,
  email: `${name.toLowerCase()}@example.com`,
  createdAt: '2025-01-01T00:00:00Z',
  updatedAt: '2025-01-01T00:00:00Z'
});

const ada = contact(1, 'Ada', 'Lovelace');
const grace = contact(2, 'Grace', 'Hopper');
const alan = contact(3, 'Alan', 'Turing');

const queued: Message = {
  id: 31,
  type: 'SMS',
  status: 'Queued',
  body: 'Hi',
  date: '2026-01-01T09:00:00Z',
  contactId: 2,
  contactName: 'Grace Hopper',
  contactPhoneNumber: ada.phoneNumber,
  contactEmail: ada.email
};

describe('ContactsPageComponent', () => {
  let fixture: ComponentFixture<ContactsPageComponent>;
  let getContacts: jasmine.Spy;
  let dialogOpen: jasmine.Spy;
  let snackOpen: jasmine.Spy;
  let navigate: jasmine.Spy;
  let snackAction: Subject<void>;

  const configure = (response: Observable<Contact[]> = of([grace, ada, alan]), isBrowser = true, closed: Observable<Message | undefined> = of(undefined)): void => {
    getContacts = jasmine.createSpy('getContacts').and.returnValue(response);
    dialogOpen = jasmine.createSpy('open').and.returnValue({ afterClosed: () => closed });
    snackAction = new Subject<void>();
    snackOpen = jasmine.createSpy('open').and.returnValue({ onAction: () => snackAction });
    TestBed.configureTestingModule({
      imports: [ContactsPageComponent],
      providers: [
        provideRouter([]),
        provideNoopAnimations(),
        { provide: IS_BROWSER, useValue: isBrowser },
        { provide: ApiService, useValue: { getContacts } },
        { provide: MatDialog, useValue: { open: dialogOpen } },
        { provide: MatSnackBar, useValue: { open: snackOpen } }
      ]
    });
    navigate = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    fixture = TestBed.createComponent(ContactsPageComponent);
    fixture.detectChanges();
  };

  const settle = async (): Promise<void> => {
    await fixture.whenStable();
    fixture.detectChanges();
    await fixture.whenStable();
  };

  const root = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const text = (element: Element | null): string => (element?.textContent ?? '').replace(/\s+/g, ' ').trim();
  const subtitle = (): string => text(root().querySelector('.page-subtitle'));
  const rows = (): string[] => Array.from(root().querySelectorAll('tr.mat-mdc-row')).map(row => text(row.querySelector('td')));
  const rowButton = (rowIndex: number, label: string): HTMLButtonElement =>
    Array.from(root().querySelectorAll('tr.mat-mdc-row')[rowIndex].querySelectorAll<HTMLButtonElement>('button')).find(button =>
      text(button).includes(label)
    ) as HTMLButtonElement;

  it('titles the page and loads the contacts once', async () => {
    configure();
    await settle();
    expect(text(root().querySelector('h1'))).toBe('Contacts');
    expect(getContacts).toHaveBeenCalledTimes(1);
  });

  describe('loading', () => {
    it('shows a loading state and a generic subtitle until the contacts arrive', async () => {
      const pending = new Subject<Contact[]>();
      configure(pending);
      expect(subtitle()).toBe('People in your phone book');
      expect(text(root().querySelector('output'))).toBe('Loading…');

      pending.next([grace, ada, alan]);
      await settle();
      expect(subtitle()).toBe('3 contacts');
      expect(rows()).toHaveSize(3);
    });

    it('lists the contacts by name with phone and email', async () => {
      configure();
      await settle();
      expect(rows()).toEqual(['Ada Lovelace', 'Alan Turing', 'Grace Hopper']);
      const first = Array.from(root().querySelectorAll('tr.mat-mdc-row:first-child td')).map(cell => text(cell));
      expect(first.slice(0, 3)).toEqual(['Ada Lovelace', 'ada@example.com', '+15550000001']);
    });

    it('uses the singular for one contact', async () => {
      configure(of([ada]));
      await settle();
      expect(subtitle()).toBe('1 contact');
    });

    it('invites the user when there are no contacts', async () => {
      configure(of([]));
      await settle();
      expect(subtitle()).toBe('0 contacts');
      expect(text(root().querySelector('output'))).toContain('You have no contacts yet.');
    });

    it('does not fetch on the server', async () => {
      configure(of([ada]), false);
      await settle();
      expect(getContacts).not.toHaveBeenCalled();
      expect(text(root().querySelector('output'))).toBe('Loading…');
    });
  });

  describe('searching', () => {
    it('filters by any visible column', async () => {
      configure();
      await settle();
      const search = root().querySelector('input[type="search"]') as HTMLInputElement;
      search.value = 'hopper';
      search.dispatchEvent(new Event('input'));
      await settle();
      expect(rows()).toEqual(['Grace Hopper']);
      search.value = '0003';
      search.dispatchEvent(new Event('input'));
      await settle();
      expect(rows()).toEqual(['Alan Turing']);
    });
  });

  describe('when loading fails', () => {
    it('shows a friendly error, not the server details', async () => {
      configure(throwError(() => new HttpErrorResponse({ status: 500, error: { title: 'Internal Server Error' } })));
      await settle();
      expect(text(root().querySelector('[role="alert"]'))).toContain('We could not load your contacts. Please try again.');
      expect(subtitle()).toBe('People in your phone book');
    });

    it('retries and recovers', async () => {
      configure();
      getContacts.and.returnValues(
        throwError(() => new HttpErrorResponse({ status: 0, error: new ProgressEvent('error') })),
        of([ada])
      );
      fixture.destroy();
      fixture = TestBed.createComponent(ContactsPageComponent);
      fixture.detectChanges();
      await settle();
      expect(text(root().querySelector('[role="alert"]'))).toContain('Unable to reach the server');

      (Array.from(root().querySelectorAll('button')).find(button => text(button) === 'Try again') as HTMLButtonElement).click();
      await settle();
      expect(root().querySelector('[role="alert"]')).toBeNull();
      expect(rows()).toEqual(['Ada Lovelace']);
      expect(subtitle()).toBe('1 contact');
    });
  });

  describe('messaging a contact', () => {
    it('opens the dialog for that contact', async () => {
      configure();
      await settle();
      rowButton(1, 'Message').click();

      expect(dialogOpen).toHaveBeenCalledTimes(1);
      const [component, config] = dialogOpen.calls.mostRecent().args;
      expect(component).toBe(SendMessageDialogComponent);
      expect(config.data).toEqual({ contact: alan });
      expect(config.width).toBe('480px');
      expect(config.maxWidth).toBe('95vw');
      expect(config.restoreFocus).toBeTrue();
    });

    it('confirms with a snackbar that offers the history', async () => {
      configure(of([grace, ada, alan]), true, of(queued));
      await settle();
      rowButton(2, 'Message').click();

      expect(snackOpen).toHaveBeenCalledOnceWith('Message to Grace queued.', 'View history', { duration: 6000 });
      expect(navigate).not.toHaveBeenCalled();
      snackAction.next();
      expect(navigate).toHaveBeenCalledOnceWith(['/history']);
    });

    it('stays quiet when the dialog is dismissed', async () => {
      configure(of([ada]), true, of(undefined));
      await settle();
      rowButton(0, 'Message').click();
      expect(snackOpen).not.toHaveBeenCalled();
    });
  });

  it('opens the history filtered to a contact', async () => {
    configure();
    await settle();
    rowButton(0, 'History').click();
    expect(navigate).toHaveBeenCalledOnceWith(['/history'], { queryParams: { contactId: ada.id } });
  });
});
