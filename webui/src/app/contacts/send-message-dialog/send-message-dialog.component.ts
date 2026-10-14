import { TextFieldModule } from '@angular/cdk/text-field';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  ElementRef,
  computed,
  inject,
  signal,
  viewChild
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Contact } from '../../models/contact.model';
import { MESSAGE_BODY_MAX_LENGTH, MESSAGE_TYPES, Message, MessageType } from '../../models/message.model';
import { ApiService } from '../../services/api.service';
import { describeError } from '../../utils/http-error';

export interface SendMessageDialogData {
  contact: Contact;
}

const TYPE_ICONS: Record<MessageType, string> = {
  SMS: 'sms',
  Email: 'email'
};

@Component({
  selector: 'app-send-message-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    TextFieldModule,
    MatButtonModule,
    MatButtonToggleModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule
  ],
  templateUrl: './send-message-dialog.component.html',
  styleUrl: './send-message-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SendMessageDialogComponent {
  private readonly api = inject(ApiService);
  private readonly dialogRef = inject<MatDialogRef<SendMessageDialogComponent, Message>>(MatDialogRef);
  private readonly destroyRef = inject(DestroyRef);
  private readonly changeDetector = inject(ChangeDetectorRef);
  private readonly formBuilder = inject(FormBuilder);
  private readonly messageField = viewChild.required<ElementRef<HTMLTextAreaElement>>('messageField');

  protected readonly contact = inject<SendMessageDialogData>(MAT_DIALOG_DATA).contact;
  protected readonly messageTypes = MESSAGE_TYPES;
  protected readonly typeIcons = TYPE_ICONS;
  protected readonly maxLength = MESSAGE_BODY_MAX_LENGTH;
  protected readonly sending = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly form = this.formBuilder.nonNullable.group({
    type: this.formBuilder.nonNullable.control<MessageType>('SMS'),
    body: ['', [Validators.required, Validators.pattern(/\S/)]]
  });

  private readonly selectedType = toSignal(this.form.controls.type.valueChanges, {
    initialValue: this.form.controls.type.value
  });
  private readonly typedBody = toSignal(this.form.controls.body.valueChanges, {
    initialValue: this.form.controls.body.value
  });

  protected readonly destination = computed(() =>
    this.selectedType() === 'SMS' ? this.contact.phoneNumber : this.contact.email
  );
  protected readonly bodyLength = computed(() => this.typedBody().length);

  protected send(): void {
    if (this.sending()) {
      return;
    }

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.messageField().nativeElement.focus();
      return;
    }

    const { type, body } = this.form.getRawValue();
    this.sending.set(true);
    this.error.set(null);
    this.dialogRef.disableClose = true;
    this.form.disable();

    this.api
      .createMessage({ contactId: this.contact.id, type, body: body.trim() })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: message => this.dialogRef.close(message),
        error: (error: unknown) => {
          this.error.set(describeError(error, 'The message could not be sent. Please try again.'));
          this.sending.set(false);
          this.dialogRef.disableClose = false;
          this.form.enable();
          this.focusEnabledMessageField();
        }
      });
  }

  protected sendFromKeyboard(event: Event): void {
    event.preventDefault();
    this.send();
  }

  private focusEnabledMessageField(): void {
    this.changeDetector.detectChanges();
    const field = this.messageField().nativeElement;
    field.blur();
    field.focus();
  }
}
