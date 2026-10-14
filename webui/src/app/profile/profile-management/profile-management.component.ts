import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormGroupDirective, NonNullableFormBuilder, ReactiveFormsModule, ValidatorFn, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { IS_BROWSER } from '../../config/tokens';
import { UpdatePasswordRequest } from '../../models/user.model';
import { ApiService } from '../../services/api.service';
import { describeError } from '../../utils/http-error';

const MIN_PASSWORD_LENGTH = 6;
const NOTIFICATION_DURATION_MS = 5000;
const NOT_BLANK = /\S/;

type PasswordField = keyof UpdatePasswordRequest;

const matchesNewPassword: ValidatorFn = control =>
  control.parent && control.value !== control.parent.get('newPassword')?.value ? { mismatch: true } : null;

@Component({
  selector: 'app-profile-management',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
    MatProgressSpinnerModule
  ],
  templateUrl: './profile-management.component.html',
  styleUrl: './profile-management.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProfileManagementComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly formBuilder = inject(NonNullableFormBuilder);
  private readonly isBrowser = inject(IS_BROWSER);
  private readonly snackBar = inject(MatSnackBar);

  protected readonly minPasswordLength = MIN_PASSWORD_LENGTH;

  protected readonly profileForm = this.formBuilder.group({
    name: ['', [Validators.required, Validators.pattern(NOT_BLANK)]],
    surname: ['', [Validators.required, Validators.pattern(NOT_BLANK)]],
    email: ['', [Validators.required, Validators.email]]
  });

  protected readonly passwordForm = this.formBuilder.group({
    currentPassword: ['', Validators.required],
    newPassword: ['', [Validators.required, Validators.minLength(MIN_PASSWORD_LENGTH)]],
    confirmNewPassword: ['', [Validators.required, matchesNewPassword]]
  });

  protected readonly profileLoading = signal(true);
  protected readonly profileLoadError = signal<string | null>(null);
  protected readonly profileSaving = signal(false);
  protected readonly profileSaveError = signal<string | null>(null);
  protected readonly passwordSaving = signal(false);
  protected readonly passwordSaveError = signal<string | null>(null);
  protected readonly revealed = signal<Record<PasswordField, boolean>>({
    currentPassword: false,
    newPassword: false,
    confirmNewPassword: false
  });

  constructor() {
    this.profileForm.disable();
    this.passwordForm.controls.newPassword.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.passwordForm.controls.confirmNewPassword.updateValueAndValidity());
  }

  ngOnInit(): void {
    if (this.isBrowser) {
      this.loadProfile();
    }
  }

  protected loadProfile(): void {
    this.profileLoadError.set(null);
    this.profileLoading.set(true);
    this.api
      .getProfile()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: user => {
          this.profileForm.enable();
          this.profileForm.reset(user);
          this.profileLoading.set(false);
        },
        error: (error: unknown) => {
          this.profileLoadError.set(describeError(error, 'We could not load your profile.'));
          this.profileLoading.set(false);
        }
      });
  }

  protected updateProfile(directive: FormGroupDirective): void {
    if (this.profileForm.invalid || this.profileSaving()) {
      return;
    }

    const { name, surname, email } = this.profileForm.getRawValue();
    this.profileSaveError.set(null);
    this.profileSaving.set(true);
    this.profileForm.disable();
    this.api
      .updateProfile({ name: name.trim(), surname: surname.trim(), email: email.trim() })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: user => {
          this.profileForm.enable();
          directive.resetForm(user);
          this.profileSaving.set(false);
          this.notify('Profile updated.');
        },
        error: (error: unknown) => {
          this.profileForm.enable();
          this.profileSaving.set(false);
          this.profileSaveError.set(describeError(error, 'We could not save your changes. Please try again.'));
        }
      });
  }

  protected updatePassword(directive: FormGroupDirective): void {
    if (this.passwordForm.invalid || this.passwordSaving()) {
      return;
    }

    const request = this.passwordForm.getRawValue();
    this.passwordSaveError.set(null);
    this.passwordSaving.set(true);
    this.passwordForm.disable();
    this.api
      .updatePassword(request)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.passwordForm.enable();
          directive.resetForm();
          this.passwordSaving.set(false);
          this.notify('Password updated.');
        },
        error: (error: unknown) => {
          this.passwordForm.enable();
          this.passwordSaving.set(false);
          this.passwordSaveError.set(describeError(error, 'We could not update your password. Please try again.'));
        }
      });
  }

  protected toggleReveal(field: PasswordField): void {
    this.revealed.update(state => ({ ...state, [field]: !state[field] }));
  }

  private notify(message: string): void {
    this.snackBar.open(message, 'Dismiss', { duration: NOTIFICATION_DURATION_MS });
  }
}
