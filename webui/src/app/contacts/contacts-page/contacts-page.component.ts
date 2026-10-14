import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router } from '@angular/router';
import { IS_BROWSER } from '../../config/tokens';
import { Contact } from '../../models/contact.model';
import { GridColumn } from '../../models/grid-column.model';
import { Message } from '../../models/message.model';
import { TableAction } from '../../models/table-action.model';
import { ApiService } from '../../services/api.service';
import { DataGridComponent } from '../../shared/data-grid/data-grid.component';
import { describeError } from '../../utils/http-error';
import { SendMessageDialogComponent, SendMessageDialogData } from '../send-message-dialog/send-message-dialog.component';

@Component({
  selector: 'app-contacts-page',
  standalone: true,
  templateUrl: './contacts-page.component.html',
  styleUrl: './contacts-page.component.scss',
  imports: [DataGridComponent],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ContactsPageComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly isBrowser = inject(IS_BROWSER);

  protected readonly contacts = signal<Contact[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);

  protected readonly subtitle = computed(() => {
    if (this.loading() || this.error()) {
      return 'People in your phone book';
    }
    const count = this.contacts().length;
    return `${count} ${count === 1 ? 'contact' : 'contacts'}`;
  });

  protected readonly columns: GridColumn<Contact>[] = [
    { key: 'name', label: 'Name', sortable: true, value: contact => `${contact.name} ${contact.surname}` },
    { key: 'email', label: 'Email', sortable: true },
    { key: 'phoneNumber', label: 'Phone', sortable: true }
  ];

  protected readonly actions: TableAction<Contact>[] = [
    { label: 'Message', icon: 'chat', action: contact => this.openMessageDialog(contact) },
    { label: 'History', icon: 'history', action: contact => this.openHistory(contact) }
  ];

  ngOnInit(): void {
    if (this.isBrowser) {
      this.loadContacts();
    }
  }

  protected loadContacts(): void {
    this.loading.set(true);
    this.error.set(null);

    this.api
      .getContacts()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: contacts => {
          this.contacts.set(contacts);
          this.loading.set(false);
        },
        error: (error: unknown) => {
          this.error.set(describeError(error, 'We could not load your contacts. Please try again.'));
          this.loading.set(false);
        }
      });
  }

  private openMessageDialog(contact: Contact): void {
    this.dialog
      .open<SendMessageDialogComponent, SendMessageDialogData, Message>(SendMessageDialogComponent, {
        width: '480px',
        maxWidth: '95vw',
        autoFocus: 'first-tabbable',
        restoreFocus: true,
        data: { contact }
      })
      .afterClosed()
      .subscribe(message => {
        if (message) {
          this.confirmQueued(contact);
        }
      });
  }

  private confirmQueued(contact: Contact): void {
    this.snackBar
      .open(`Message to ${contact.name} queued.`, 'View history', { duration: 6000 })
      .onAction()
      .subscribe(() => void this.router.navigate(['/history']));
  }

  private openHistory(contact: Contact): void {
    void this.router.navigate(['/history'], { queryParams: { contactId: contact.id } });
  }
}
