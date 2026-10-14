import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatSnackBar } from '@angular/material/snack-bar';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { Observable, Subject, of, throwError } from 'rxjs';
import { IS_BROWSER } from '../../config/tokens';
import { User } from '../../models/user.model';
import { ApiService } from '../../services/api.service';
import { ProfileManagementComponent } from './profile-management.component';

const ada: User = { name: 'Ada', surname: 'Lovelace', email: 'ada@example.com' };

describe('ProfileManagementComponent', () => {
  let fixture: ComponentFixture<ProfileManagementComponent>;
  let getProfile: jasmine.Spy;
  let updateProfile: jasmine.Spy;
  let updatePassword: jasmine.Spy;
  let snackOpen: jasmine.Spy;

  interface Options {
    profile?: Observable<User>;
    saved?: Observable<User>;
    passwordChanged?: Observable<void>;
    isBrowser?: boolean;
  }

  const configure = ({ profile = of(ada), saved, passwordChanged = of(undefined), isBrowser = true }: Options = {}): void => {
    getProfile = jasmine.createSpy('getProfile').and.returnValue(profile);
    updateProfile = jasmine.createSpy('updateProfile').and.callFake((request: User) => saved ?? of(request));
    updatePassword = jasmine.createSpy('updatePassword').and.returnValue(passwordChanged);
    snackOpen = jasmine.createSpy('open');
    TestBed.configureTestingModule({
      imports: [ProfileManagementComponent],
      providers: [
        provideNoopAnimations(),
        { provide: IS_BROWSER, useValue: isBrowser },
        { provide: ApiService, useValue: { getProfile, updateProfile, updatePassword } },
        { provide: MatSnackBar, useValue: { open: snackOpen } }
      ]
    });
    fixture = TestBed.createComponent(ProfileManagementComponent);
    fixture.detectChanges();
  };

  const root = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const text = (element: Element | null): string => (element?.textContent ?? '').replace(/\s+/g, ' ').trim();
  const control = (name: string): HTMLInputElement => root().querySelector(`input[formcontrolname="${name}"]`) as HTMLInputElement;
  const buttonLabelled = (label: string): HTMLButtonElement =>
    Array.from(root().querySelectorAll<HTMLButtonElement>('button[type="submit"], button')).find(button => text(button) === label) as HTMLButtonElement;
  const saveButton = (): HTMLButtonElement => buttonLabelled('Save changes');
  const passwordButton = (): HTMLButtonElement => buttonLabelled('Update password');
  const sections = (): HTMLElement[] => Array.from(root().querySelectorAll<HTMLElement>('section.card'));
  const errorsIn = (section: HTMLElement): string[] => Array.from(section.querySelectorAll('mat-error')).map(error => text(error));
  const alertIn = (section: HTMLElement): string => text(section.querySelector('[role="alert"] .alert__message'));

  const write = (name: string, value: string): void => {
    control(name).value = value;
    control(name).dispatchEvent(new Event('input'));
    control(name).dispatchEvent(new Event('blur'));
    fixture.detectChanges();
  };

  const submit = (button: HTMLButtonElement): void => {
    button.click();
    fixture.detectChanges();
  };

  describe('personal details', () => {
    it('prefills the form from the server', () => {
      configure();
      expect(getProfile).toHaveBeenCalledTimes(1);
      expect(control('name').value).toBe('Ada');
      expect(control('surname').value).toBe('Lovelace');
      expect(control('email').value).toBe('ada@example.com');
      expect(control('name').disabled).toBeFalse();
    });

    it('keeps the form unavailable while loading', () => {
      configure({ profile: new Subject<User>() });
      expect(root().querySelector('mat-progress-bar')).not.toBeNull();
      expect(root().querySelector('form.form-stack--loading')).not.toBeNull();
      expect(control('name').disabled).toBeTrue();
      expect(control('name').value).toBe('');
    });

    it('does not fetch on the server', () => {
      configure({ isBrowser: false });
      expect(getProfile).not.toHaveBeenCalled();
    });

    it('stacks the two forms in order', () => {
      configure();
      expect(sections().map(section => text(section.querySelector('h2')))).toEqual(['Personal details', 'Change password']);
    });

    it('offers retry when the profile cannot be loaded', () => {
      configure({ profile: throwError(() => new HttpErrorResponse({ status: 500, error: { title: 'Internal Server Error' } })) });
      expect(alertIn(sections()[0])).toBe('We could not load your profile.');
      expect(sections()[0].querySelector('form')).toBeNull();

      getProfile.and.returnValue(of(ada));
      buttonLabelled('Retry').click();
      fixture.detectChanges();
      expect(sections()[0].querySelector('[role="alert"]')).toBeNull();
      expect(control('email').value).toBe('ada@example.com');
    });

    it('explains an unreachable server', () => {
      configure({ profile: throwError(() => new HttpErrorResponse({ status: 0, error: new ProgressEvent('error') })) });
      expect(alertIn(sections()[0])).toContain('Unable to reach the server');
    });

    describe('editing', () => {
      beforeEach(() => configure());

      it('keeps save disabled until something changes', () => {
        expect(saveButton().disabled).toBeTrue();
        write('name', 'Augusta');
        expect(saveButton().disabled).toBeFalse();
        write('name', 'Ada');
        expect(saveButton().disabled).toBeFalse();
      });

      it('requires every field and keeps save disabled', () => {
        write('name', '');
        write('surname', '   ');
        write('email', '');
        expect(errorsIn(sections()[0])).toEqual(['Name is required.', 'Surname is required.', 'Email is required.']);
        expect(saveButton().disabled).toBeTrue();
      });

      it('rejects a malformed email', () => {
        write('email', 'nope');
        expect(errorsIn(sections()[0])).toEqual(['Enter a valid email address.']);
        expect(saveButton().disabled).toBeTrue();
      });

      it('saves trimmed details, confirms and becomes pristine with the server values', () => {
        updateProfile.and.returnValue(of({ name: 'Augusta', surname: 'King', email: 'augusta@example.com' }));
        write('name', '  Augusta ');
        write('surname', ' King ');
        write('email', ' augusta@example.com ');
        submit(saveButton());

        expect(updateProfile).toHaveBeenCalledOnceWith({ name: 'Augusta', surname: 'King', email: 'augusta@example.com' });
        expect(snackOpen).toHaveBeenCalledOnceWith('Profile updated.', 'Dismiss', { duration: 5000 });
        expect(control('name').value).toBe('Augusta');
        expect(control('email').value).toBe('augusta@example.com');
        expect(control('name').disabled).toBeFalse();
        expect(saveButton().disabled).toBeTrue();
        expect(errorsIn(sections()[0])).toEqual([]);
      });

      it('locks the form while saving and ignores a second submit', () => {
        const pending = new Subject<User>();
        updateProfile.and.returnValue(pending);
        write('name', 'Augusta');
        submit(saveButton());

        expect(control('name').disabled).toBeTrue();
        expect(saveButton().disabled).toBeTrue();
        expect(root().querySelector('mat-spinner')).not.toBeNull();
        root().querySelector('form')?.dispatchEvent(new Event('submit'));
        fixture.detectChanges();
        expect(updateProfile).toHaveBeenCalledTimes(1);

        pending.next({ ...ada, name: 'Augusta' });
        pending.complete();
        fixture.detectChanges();
        expect(control('name').disabled).toBeFalse();
      });

      it('shows a conflict inline and keeps what was typed', () => {
        updateProfile.and.returnValue(throwError(() => new HttpErrorResponse({ status: 409, error: { title: 'Conflict', detail: 'Email already in use' } })));
        write('email', 'taken@example.com');
        submit(saveButton());

        expect(alertIn(sections()[0])).toBe('Email already in use');
        expect(snackOpen).not.toHaveBeenCalled();
        expect(control('email').value).toBe('taken@example.com');
        expect(control('email').disabled).toBeFalse();
        expect(saveButton().disabled).toBeFalse();
      });

      it('shows a friendly message for server failures', () => {
        updateProfile.and.returnValue(throwError(() => new HttpErrorResponse({ status: 500, error: { title: 'Internal Server Error' } })));
        write('name', 'Augusta');
        submit(saveButton());
        expect(alertIn(sections()[0])).toBe('We could not save your changes. Please try again.');
      });

      it('clears an earlier error when saving again', () => {
        updateProfile.and.returnValues(
          throwError(() => new HttpErrorResponse({ status: 409, error: { detail: 'Email already in use' } })),
          of({ ...ada, name: 'Augusta' })
        );
        write('name', 'Augusta');
        submit(saveButton());
        expect(alertIn(sections()[0])).toBe('Email already in use');
        submit(saveButton());
        expect(sections()[0].querySelector('[role="alert"]')).toBeNull();
      });
    });
  });

  describe('password', () => {
    beforeEach(() => configure());

    const fillPasswords = (current: string, next: string, confirm: string): void => {
      write('currentPassword', current);
      write('newPassword', next);
      write('confirmNewPassword', confirm);
    };

    it('starts with the update disabled', () => {
      expect(passwordButton().disabled).toBeTrue();
      expect(text(sections()[1].querySelector('mat-hint'))).toBe('At least 6 characters.');
    });

    it('requires every field', () => {
      for (const name of ['currentPassword', 'newPassword', 'confirmNewPassword']) {
        write(name, '');
      }
      expect(errorsIn(sections()[1])).toEqual(['Current password is required.', 'New password is required.', 'Confirm your new password.']);
    });

    it('enforces the minimum length', () => {
      fillPasswords('old123', '12345', '12345');
      expect(errorsIn(sections()[1])).toEqual(['Use at least 6 characters.']);
      expect(passwordButton().disabled).toBeTrue();
    });

    it('flags a confirmation that does not match and revalidates when the new password changes', () => {
      fillPasswords('old123', 'new1234', 'new1235');
      expect(errorsIn(sections()[1])).toEqual(['Passwords do not match.']);
      expect(passwordButton().disabled).toBeTrue();

      write('newPassword', 'new1235');
      expect(errorsIn(sections()[1])).toEqual([]);
      expect(passwordButton().disabled).toBeFalse();
    });

    it('sends the three fields, confirms and clears the form without errors', () => {
      fillPasswords('old123', 'new1234', 'new1234');
      submit(passwordButton());

      expect(updatePassword).toHaveBeenCalledOnceWith({ currentPassword: 'old123', newPassword: 'new1234', confirmNewPassword: 'new1234' });
      expect(snackOpen).toHaveBeenCalledOnceWith('Password updated.', 'Dismiss', { duration: 5000 });
      expect(control('currentPassword').value).toBe('');
      expect(control('newPassword').value).toBe('');
      expect(control('confirmNewPassword').value).toBe('');
      expect(errorsIn(sections()[1])).toEqual([]);
      expect(passwordButton().disabled).toBeTrue();
    });

    it('locks the form while updating and ignores a second submit', () => {
      const pending = new Subject<void>();
      updatePassword.and.returnValue(pending);
      fillPasswords('old123', 'new1234', 'new1234');
      submit(passwordButton());

      expect(control('currentPassword').disabled).toBeTrue();
      expect(passwordButton().disabled).toBeTrue();
      expect(sections()[1].querySelector('mat-spinner')).not.toBeNull();
      sections()[1].querySelector('form')?.dispatchEvent(new Event('submit'));
      expect(updatePassword).toHaveBeenCalledTimes(1);

      pending.next();
      pending.complete();
      fixture.detectChanges();
      expect(control('currentPassword').disabled).toBeFalse();
    });

    it('explains a wrong current password and keeps the fields for another try', () => {
      updatePassword.and.returnValue(throwError(() => new HttpErrorResponse({ status: 400, error: { title: 'Bad Request', detail: 'Current password is incorrect' } })));
      fillPasswords('wrong1', 'new1234', 'new1234');
      submit(passwordButton());

      expect(alertIn(sections()[1])).toBe('Current password is incorrect');
      expect(snackOpen).not.toHaveBeenCalled();
      expect(control('currentPassword').value).toBe('wrong1');
      expect(control('currentPassword').disabled).toBeFalse();
      expect(passwordButton().disabled).toBeFalse();
    });

    it('shows a friendly message for server failures', () => {
      updatePassword.and.returnValue(throwError(() => new HttpErrorResponse({ status: 503 })));
      fillPasswords('old123', 'new1234', 'new1234');
      submit(passwordButton());
      expect(alertIn(sections()[1])).toBe('We could not update your password. Please try again.');
    });

    it('keeps errors from the two forms apart', () => {
      updatePassword.and.returnValue(throwError(() => new HttpErrorResponse({ status: 400, error: { detail: 'Current password is incorrect' } })));
      fillPasswords('wrong1', 'new1234', 'new1234');
      submit(passwordButton());
      expect(sections()[0].querySelector('[role="alert"]')).toBeNull();
    });

    for (const field of ['currentPassword', 'newPassword', 'confirmNewPassword']) {
      it(`toggles visibility of ${field} independently`, () => {
        const toggle = control(field).closest('mat-form-field')?.querySelector('button[aria-pressed]') as HTMLButtonElement;
        expect(control(field).type).toBe('password');
        toggle.click();
        fixture.detectChanges();
        expect(control(field).type).toBe('text');
        expect(toggle.getAttribute('aria-pressed')).toBe('true');
        for (const other of ['currentPassword', 'newPassword', 'confirmNewPassword'].filter(name => name !== field)) {
          expect(control(other).type).toBe('password');
        }
        toggle.click();
        fixture.detectChanges();
        expect(control(field).type).toBe('password');
      });
    }
  });
});
