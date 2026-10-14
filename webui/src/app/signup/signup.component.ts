import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  FormBuilder,
  FormGroupDirective,
  NgForm,
  ReactiveFormsModule,
  ValidatorFn,
  Validators
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { ErrorStateMatcher } from '@angular/material/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router, RouterLink } from '@angular/router';
import { ApiService } from '../services/api.service';
import { describeError } from '../utils/http-error';

const MIN_PASSWORD_LENGTH = 6;
const SUCCESS_MESSAGE = 'Account created. You can sign in now.';
const SUCCESS_DURATION_MS = 5000;

const passwordsMatch: ValidatorFn = group =>
  group.get('password')?.value === group.get('confirmPassword')?.value ? null : { passwordMismatch: true };

class ConfirmPasswordErrorStateMatcher implements ErrorStateMatcher {
  isErrorState(control: AbstractControl | null, form: FormGroupDirective | NgForm | null): boolean {
    if (!control) {
      return false;
    }
    const hasError = control.invalid || !!control.parent?.hasError('passwordMismatch');
    return hasError && (control.touched || !!form?.submitted);
  }
}

@Component({
  selector: 'app-signup',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule
  ],
  templateUrl: './signup.component.html',
  styleUrl: './signup.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SignupComponent {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly minPasswordLength = MIN_PASSWORD_LENGTH;
  protected readonly confirmPasswordMatcher = new ConfirmPasswordErrorStateMatcher();
  protected readonly form = inject(FormBuilder).nonNullable.group(
    {
      name: ['', Validators.required],
      surname: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(MIN_PASSWORD_LENGTH)]],
      confirmPassword: ['', Validators.required]
    },
    { validators: passwordsMatch }
  );
  protected readonly submitting = signal(false);
  protected readonly passwordVisible = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  constructor() {
    this.form.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => this.errorMessage.set(null));
  }

  protected togglePasswordVisibility(): void {
    this.passwordVisible.update(visible => !visible);
  }

  protected submit(): void {
    if (this.submitting()) {
      return;
    }

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const { name, surname, email, password } = this.form.getRawValue();
    this.errorMessage.set(null);
    this.setSubmitting(true);

    this.api
      .signup({ name: name.trim(), surname: surname.trim(), email, password })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.snackBar.open(SUCCESS_MESSAGE, undefined, { duration: SUCCESS_DURATION_MS });
          void this.router.navigate(['/login']);
        },
        error: (error: unknown) => {
          this.errorMessage.set(describeError(error));
          this.setSubmitting(false);
        }
      });
  }

  private setSubmitting(submitting: boolean): void {
    this.submitting.set(submitting);
    if (submitting) {
      this.form.disable({ emitEvent: false });
    } else {
      this.form.enable({ emitEvent: false });
    }
  }
}
