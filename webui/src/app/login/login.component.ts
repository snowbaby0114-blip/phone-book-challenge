import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ApiService } from '../services/api.service';
import { describeError } from '../utils/http-error';

const DEFAULT_REDIRECT_URL = '/contacts';

function isSafeReturnUrl(url: string): boolean {
  return url.startsWith('/') && !url.startsWith('//') && !url.includes('://');
}

@Component({
  selector: 'app-login',
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
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LoginComponent {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly form = inject(FormBuilder).nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required]
  });
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

    const { email, password } = this.form.getRawValue();
    this.errorMessage.set(null);
    this.setSubmitting(true);

    this.api.login(email, password).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => void this.router.navigateByUrl(this.returnUrl()),
      error: (error: unknown) => {
        this.errorMessage.set(describeError(error));
        this.setSubmitting(false);
      }
    });
  }

  private returnUrl(): string {
    const url = this.route.snapshot.queryParamMap.get('returnUrl');
    return url && isSafeReturnUrl(url) ? url : DEFAULT_REDIRECT_URL;
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
