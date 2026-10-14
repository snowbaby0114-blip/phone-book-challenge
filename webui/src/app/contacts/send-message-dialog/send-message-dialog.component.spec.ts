import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { Observable, Subject, of, throwError } from 'rxjs';
import { Contact } from '../../models/contact.model';
import { Message } from '../../models/message.model';
import { ApiService } from '../../services/api.service';
import { SendMessageDialogComponent } from './send-message-dialog.component';

const contact: Contact = {
  id: 7,
  name: 'Ada',
  surname: 'Lovelace',
  phoneNumber: '+15550000007',
  email: 'ada@example.com',
  createdAt: '2025-01-01T00:00:00Z',
  updatedAt: '2025-01-01T00:00:00Z'
};

const created: Message = {
  id: 31,
  type: 'SMS',
  status: 'Queued',
  body: 'Hello',
  date: '2026-01-01T09:00:00Z',
  contactId: 7,
  contactName: 'Ada Lovelace',
  contactPhoneNumber: '+15550000007',
  contactEmail: 'ada@example.com'
};

describe('SendMessageDialogComponent', () => {
  let fixture: ComponentFixture<SendMessageDialogComponent>;
  let createMessage: jasmine.Spy;
  let dialogRef: { close: jasmine.Spy; disableClose: boolean };

  const configure = (response: Observable<Message> = of(created)): void => {
    createMessage = jasmine.createSpy('createMessage').and.returnValue(response);
    dialogRef = { close: jasmine.createSpy('close'), disableClose: false };
    TestBed.configureTestingModule({
      imports: [SendMessageDialogComponent],
      providers: [
        provideNoopAnimations(),
        { provide: ApiService, useValue: { createMessage } },
        { provide: MAT_DIALOG_DATA, useValue: { contact } },
        { provide: MatDialogRef, useValue: dialogRef }
      ]
    });
    fixture = TestBed.createComponent(SendMessageDialogComponent);
    fixture.detectChanges();
  };

  const root = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const text = (element: Element | null): string => (element?.textContent ?? '').replace(/\s+/g, ' ').trim();
  const textarea = (): HTMLTextAreaElement => root().querySelector('textarea') as HTMLTextAreaElement;
  const sendButton = (): HTMLButtonElement => root().querySelector('button[type="submit"]') as HTMLButtonElement;
  const cancelButton = (): HTMLButtonElement => root().querySelector('button[mat-dialog-close]') as HTMLButtonElement;
  const toggle = (label: string): HTMLButtonElement =>
    Array.from(root().querySelectorAll<HTMLElement>('mat-button-toggle'))
      .find(candidate => text(candidate).includes(label))
      ?.querySelector('button') as HTMLButtonElement;
  const destination = (): string => text(root().querySelector('.recipient strong'));
  const alertText = (): string => text(root().querySelector('[role="alert"] span'));

  const write = (body: string): void => {
    textarea().value = body;
    textarea().dispatchEvent(new Event('input'));
    fixture.detectChanges();
  };

  const send = (): void => {
    sendButton().click();
    fixture.detectChanges();
  };

  const press = (init: KeyboardEventInit): void => {
    textarea().dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true, ...init }));
    fixture.detectChanges();
  };

  describe('presentation', () => {
    beforeEach(() => configure());

    it('titles the dialog with the contact and defaults to SMS', () => {
      expect(text(root().querySelector('h2'))).toBe('Message Ada Lovelace');
      expect(toggle('SMS').getAttribute('aria-pressed')).toBe('true');
      expect(toggle('Email').getAttribute('aria-pressed')).toBe('false');
    });

    it('previews the destination for the chosen type', () => {
      expect(destination()).toBe('+15550000007');
      toggle('Email').click();
      fixture.detectChanges();
      expect(destination()).toBe('ada@example.com');
      toggle('SMS').click();
      fixture.detectChanges();
      expect(destination()).toBe('+15550000007');
    });

    it('limits the message to 1000 characters and counts them', () => {
      expect(textarea().getAttribute('maxlength')).toBe('1000');
      expect(text(root().querySelector('mat-hint'))).toBe('0 / 1000');
      write('Hello');
      expect(text(root().querySelector('mat-hint'))).toBe('5 / 1000');
    });
  });

  describe('validation', () => {
    beforeEach(() => configure());

    it('refuses an empty message', () => {
      send();
      expect(text(root().querySelector('mat-error'))).toBe('Enter a message to send.');
      expect(createMessage).not.toHaveBeenCalled();
      expect(dialogRef.close).not.toHaveBeenCalled();
    });

    it('refuses a whitespace-only message', () => {
      write('   \n  ');
      send();
      expect(text(root().querySelector('mat-error'))).toBe('Enter a message to send.');
      expect(createMessage).not.toHaveBeenCalled();
    });

    it('moves focus to the message when it is invalid', () => {
      send();
      expect(document.activeElement).toBe(textarea());
    });
  });

  describe('sending', () => {
    it('posts the trimmed SMS and closes with the created message', () => {
      configure();
      write('  Hello there  ');
      send();
      expect(createMessage).toHaveBeenCalledOnceWith({ contactId: 7, type: 'SMS', body: 'Hello there' });
      expect(dialogRef.close).toHaveBeenCalledOnceWith(created);
    });

    it('posts an email when that type is chosen', () => {
      configure();
      toggle('Email').click();
      write('Hello');
      send();
      expect(createMessage).toHaveBeenCalledOnceWith({ contactId: 7, type: 'Email', body: 'Hello' });
    });

    it('accepts a message of exactly 1000 characters', () => {
      configure();
      write('x'.repeat(1000));
      send();
      expect(createMessage).toHaveBeenCalledTimes(1);
    });

    it('locks the dialog while the request is in flight', () => {
      const pending = new Subject<Message>();
      configure(pending);
      write('Hello');
      send();

      expect(dialogRef.disableClose).toBeTrue();
      expect(textarea().disabled).toBeTrue();
      expect(sendButton().disabled).toBeTrue();
      expect(cancelButton().disabled).toBeTrue();
      expect(root().querySelector('mat-progress-spinner')).not.toBeNull();

      (fixture.componentInstance as unknown as { send(): void }).send();
      press({ ctrlKey: true });
      expect(createMessage).toHaveBeenCalledTimes(1);

      pending.next(created);
      pending.complete();
      expect(dialogRef.close).toHaveBeenCalledOnceWith(created);
    });
  });

  describe('failing to send', () => {
    const failWith = (error: HttpErrorResponse): void => {
      configure(throwError(() => error));
      write('Keep this text');
      send();
    };

    it('shows the server message for client errors', () => {
      failWith(new HttpErrorResponse({ status: 404, error: { title: 'Not Found', detail: 'Contact not found' } }));
      expect(alertText()).toBe('Contact not found');
    });

    it('shows a friendly message instead of server error details', () => {
      failWith(new HttpErrorResponse({ status: 500, error: { title: 'Internal Server Error', detail: 'NullReferenceException at ...' } }));
      expect(alertText()).toBe('The message could not be sent. Please try again.');
    });

    it('explains a network failure', () => {
      failWith(new HttpErrorResponse({ status: 0, error: new ProgressEvent('error') }));
      expect(alertText()).toContain('Unable to reach the server');
    });

    it('stays open, unlocked and keeps what the user typed', () => {
      failWith(new HttpErrorResponse({ status: 500 }));
      expect(dialogRef.close).not.toHaveBeenCalled();
      expect(dialogRef.disableClose).toBeFalse();
      expect(textarea().disabled).toBeFalse();
      expect(sendButton().disabled).toBeFalse();
      expect(cancelButton().disabled).toBeFalse();
      expect(textarea().value).toBe('Keep this text');
      expect(root().querySelector('mat-progress-spinner')).toBeNull();
    });

    it('can be retried successfully', () => {
      createMessage = jasmine.createSpy('createMessage').and.returnValues(
        throwError(() => new HttpErrorResponse({ status: 500 })),
        of(created)
      );
      dialogRef = { close: jasmine.createSpy('close'), disableClose: false };
      TestBed.configureTestingModule({
        imports: [SendMessageDialogComponent],
        providers: [
          provideNoopAnimations(),
          { provide: ApiService, useValue: { createMessage } },
          { provide: MAT_DIALOG_DATA, useValue: { contact } },
          { provide: MatDialogRef, useValue: dialogRef }
        ]
      });
      fixture = TestBed.createComponent(SendMessageDialogComponent);
      fixture.detectChanges();

      write('Hello');
      send();
      expect(dialogRef.close).not.toHaveBeenCalled();
      send();
      expect(createMessage).toHaveBeenCalledTimes(2);
      expect(dialogRef.close).toHaveBeenCalledOnceWith(created);
    });
  });

  describe('keyboard', () => {
    beforeEach(() => configure());

    it('sends with Ctrl+Enter', () => {
      write('Hello');
      press({ ctrlKey: true });
      expect(createMessage).toHaveBeenCalledTimes(1);
    });

    it('sends with Cmd+Enter', () => {
      write('Hello');
      press({ metaKey: true });
      expect(createMessage).toHaveBeenCalledTimes(1);
    });

    it('leaves a plain Enter for a new line', () => {
      write('Hello');
      press({});
      expect(createMessage).not.toHaveBeenCalled();
    });

    it('does not send an invalid message from the keyboard', () => {
      press({ ctrlKey: true });
      expect(createMessage).not.toHaveBeenCalled();
    });
  });

  it('cancels without sending anything', () => {
    configure();
    write('Hello');
    cancelButton().click();
    expect(dialogRef.close).toHaveBeenCalledTimes(1);
    expect(createMessage).not.toHaveBeenCalled();
  });
});
