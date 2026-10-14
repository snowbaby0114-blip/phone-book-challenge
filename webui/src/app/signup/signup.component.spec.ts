import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatSnackBar } from '@angular/material/snack-bar';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { Router, provideRouter } from '@angular/router';
import { Observable, Subject, of, throwError } from 'rxjs';
import { ApiService } from '../services/api.service';
import { SignupComponent } from './signup.component';

describe('SignupComponent', () => {
  let fixture: ComponentFixture<SignupComponent>;
  let signup: jasmine.Spy;
  let navigate: jasmine.Spy;
  let open: jasmine.Spy;

  const configure = (response: Observable<void> = of(undefined)): void => {
    signup = jasmine.createSpy('signup').and.returnValue(response);
    open = jasmine.createSpy('open');
    TestBed.configureTestingModule({
      imports: [SignupComponent],
      providers: [
        provideRouter([]),
        provideNoopAnimations(),
        { provide: ApiService, useValue: { signup } },
        { provide: MatSnackBar, useValue: { open } }
      ]
    });
    navigate = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    fixture = TestBed.createComponent(SignupComponent);
    fixture.detectChanges();
  };

  const root = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const text = (element: Element | null): string => (element?.textContent ?? '').replace(/\s+/g, ' ').trim();
  const input = (name: string): HTMLInputElement => root().querySelector(`input[formcontrolname="${name}"]`) as HTMLInputElement;
  const submitButton = (): HTMLButtonElement => root().querySelector('button[type="submit"]') as HTMLButtonElement;
  const errors = (): string[] => Array.from(root().querySelectorAll('mat-error')).map(error => text(error));

  const fill = (values: Partial<Record<'name' | 'surname' | 'email' | 'password' | 'confirmPassword', string>>): void => {
    for (const [name, value] of Object.entries(values)) {
      input(name).value = value;
      input(name).dispatchEvent(new Event('input'));
    }
    fixture.detectChanges();
  };

  const valid = { name: '  Ada ', surname: ' Lovelace  ', email: 'ada@example.com', password: 'secret1', confirmPassword: 'secret1' };

  const submit = (): void => {
    submitButton().click();
    fixture.detectChanges();
  };

  it('presents the registration form with the right input types', () => {
    configure();
    expect(text(root().querySelector('h1'))).toBe('Create account');
    expect(text(submitButton())).toBe('Create account');
    expect(input('name').type).toBe('text');
    expect(input('surname').type).toBe('text');
    expect(input('email').type).toBe('email');
    expect(input('password').type).toBe('password');
    expect(input('confirmPassword').type).toBe('password');
    expect(input('name').getAttribute('autocomplete')).toBe('given-name');
    expect(input('surname').getAttribute('autocomplete')).toBe('family-name');
    expect(input('password').getAttribute('autocomplete')).toBe('new-password');
    expect(root().querySelector('.auth-card__footer a')?.getAttribute('href')).toBe('/login');
    expect(text(root().querySelector('mat-hint'))).toBe('At least 6 characters');
  });

  describe('validation', () => {
    beforeEach(() => configure());

    it('requires every field and does not call the API', () => {
      submit();
      expect(errors()).toEqual([
        'Enter your name.',
        'Enter your surname.',
        'Enter your email address.',
        'Enter a password.',
        'Confirm your password.'
      ]);
      expect(signup).not.toHaveBeenCalled();
    });

    it('rejects a malformed email', () => {
      fill({ ...valid, email: 'nope' });
      submit();
      expect(errors()).toEqual(['Enter a valid email address.']);
    });

    it('enforces the minimum password length', () => {
      fill({ ...valid, password: '12345', confirmPassword: '12345' });
      submit();
      expect(errors()).toEqual(['Use at least 6 characters.']);
      expect(signup).not.toHaveBeenCalled();
    });

    it('flags a confirmation that does not match', () => {
      fill({ ...valid, confirmPassword: 'secret2' });
      submit();
      expect(errors()).toEqual(['Passwords do not match.']);
      expect(signup).not.toHaveBeenCalled();
    });

    it('accepts a matching confirmation', () => {
      fill({ ...valid, confirmPassword: 'secret2' });
      fill({ confirmPassword: 'secret1' });
      submit();
      expect(errors()).toEqual([]);
      expect(signup).toHaveBeenCalledTimes(1);
    });
  });

  describe('registering', () => {
    it('sends trimmed details without the confirmation, then confirms and moves to sign in', () => {
      configure();
      fill(valid);
      submit();

      expect(signup).toHaveBeenCalledOnceWith({ name: 'Ada', surname: 'Lovelace', email: 'ada@example.com', password: 'secret1' });
      expect(open).toHaveBeenCalledOnceWith('Account created. You can sign in now.', undefined, { duration: 5000 });
      expect(navigate).toHaveBeenCalledOnceWith(['/login']);
    });

    it('shows progress and blocks edits and resubmission while waiting', () => {
      const pending = new Subject<void>();
      configure(pending);
      fill(valid);
      submit();

      expect(submitButton().disabled).toBeTrue();
      expect(input('email').disabled).toBeTrue();
      expect(root().querySelector('mat-progress-spinner')).not.toBeNull();

      (fixture.componentInstance as unknown as { submit(): void }).submit();
      expect(signup).toHaveBeenCalledTimes(1);

      pending.next();
      pending.complete();
      expect(navigate).toHaveBeenCalledOnceWith(['/login']);
    });
  });

  describe('failing to register', () => {
    beforeEach(() => {
      configure(throwError(() => new HttpErrorResponse({ status: 409, error: { title: 'Conflict', detail: 'An account with this email already exists' } })));
      fill(valid);
      submit();
    });

    it('shows the server message and stays on the form', () => {
      expect(text(root().querySelector('[role="alert"] span'))).toBe('An account with this email already exists');
      expect(navigate).not.toHaveBeenCalled();
      expect(open).not.toHaveBeenCalled();
    });

    it('keeps the input and re-enables the form', () => {
      expect(submitButton().disabled).toBeFalse();
      expect(input('email').disabled).toBeFalse();
      expect(input('email').value).toBe('ada@example.com');
    });

    it('clears the message when the user edits', () => {
      fill({ email: 'ada2@example.com' });
      expect(root().querySelector('[role="alert"]')).toBeNull();
    });
  });

  it('toggles visibility of both password fields together', () => {
    configure();
    const toggle = root().querySelector('button[aria-pressed]') as HTMLButtonElement;
    toggle.click();
    fixture.detectChanges();
    expect(input('password').type).toBe('text');
    expect(input('confirmPassword').type).toBe('text');
    expect(toggle.getAttribute('aria-pressed')).toBe('true');
    toggle.click();
    fixture.detectChanges();
    expect(input('password').type).toBe('password');
    expect(input('confirmPassword').type).toBe('password');
  });
});
