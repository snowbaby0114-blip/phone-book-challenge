import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { Observable, Subject, of, throwError } from 'rxjs';
import { User } from '../models/user.model';
import { ApiService } from '../services/api.service';
import { LoginComponent } from './login.component';

const user: User = { name: 'Ada', surname: 'Lovelace', email: 'ada@example.com' };

describe('LoginComponent', () => {
  let fixture: ComponentFixture<LoginComponent>;
  let login: jasmine.Spy;
  let navigateByUrl: jasmine.Spy;

  const configure = (params: Record<string, string> = {}, response: Observable<User> = of(user)): void => {
    login = jasmine.createSpy('login').and.returnValue(response);
    TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [
        provideRouter([]),
        provideNoopAnimations(),
        { provide: ApiService, useValue: { login } },
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap(params) } } }
      ]
    });
    navigateByUrl = spyOn(TestBed.inject(Router), 'navigateByUrl').and.resolveTo(true);
    fixture = TestBed.createComponent(LoginComponent);
    fixture.detectChanges();
  };

  const root = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const text = (element: Element | null): string => (element?.textContent ?? '').replace(/\s+/g, ' ').trim();
  const input = (name: string): HTMLInputElement => root().querySelector(`input[formcontrolname="${name}"]`) as HTMLInputElement;
  const submitButton = (): HTMLButtonElement => root().querySelector('button[type="submit"]') as HTMLButtonElement;
  const errors = (): string[] => Array.from(root().querySelectorAll('mat-error')).map(error => text(error));
  const alertText = (): string => text(root().querySelector('[role="alert"] span'));

  const fill = (email: string, password: string): void => {
    for (const [name, value] of [['email', email], ['password', password]]) {
      input(name).value = value;
      input(name).dispatchEvent(new Event('input'));
    }
    fixture.detectChanges();
  };

  const submit = (): void => {
    submitButton().click();
    fixture.detectChanges();
  };

  it('presents a titled sign-in form with a way to register', () => {
    configure();
    expect(text(root().querySelector('h1'))).toBe('Sign in');
    expect(text(root().querySelector('mat-label'))).toBe('Email');
    expect(input('email').getAttribute('autocomplete')).toBe('username');
    expect(input('password').getAttribute('autocomplete')).toBe('current-password');
    expect(input('password').type).toBe('password');
    expect(root().querySelector('.auth-card__footer a')?.getAttribute('href')).toBe('/register');
  });

  describe('validation', () => {
    beforeEach(() => configure());

    it('requires both fields and does not call the API', () => {
      submit();
      expect(errors()).toEqual(['Enter your email address.', 'Enter your password.']);
      expect(login).not.toHaveBeenCalled();
    });

    it('rejects a malformed email', () => {
      fill('not-an-email', 'secret1');
      submit();
      expect(errors()).toEqual(['Enter a valid email address.']);
      expect(login).not.toHaveBeenCalled();
    });
  });

  describe('signing in', () => {
    it('calls the API with the entered credentials and lands on contacts', () => {
      configure();
      fill('ada@example.com', 'secret1');
      submit();
      expect(login).toHaveBeenCalledOnceWith('ada@example.com', 'secret1');
      expect(navigateByUrl).toHaveBeenCalledOnceWith('/contacts');
    });

    it('returns to the page the user was heading for', () => {
      configure({ returnUrl: '/history?contactId=2' });
      fill('ada@example.com', 'secret1');
      submit();
      expect(navigateByUrl).toHaveBeenCalledOnceWith('/history?contactId=2');
    });

    for (const unsafe of ['//evil.example', 'https://evil.example/path', 'javascript:alert(1)', 'history', '/redirect?to=https://evil.example']) {
      it(`ignores the unsafe return address ${unsafe}`, () => {
        configure({ returnUrl: unsafe });
        fill('ada@example.com', 'secret1');
        submit();
        expect(navigateByUrl).toHaveBeenCalledOnceWith('/contacts');
      });
    }

    it('shows progress and blocks edits and resubmission while waiting', () => {
      const pending = new Subject<User>();
      configure({}, pending);
      fill('ada@example.com', 'secret1');
      submit();

      expect(submitButton().disabled).toBeTrue();
      expect(input('email').disabled).toBeTrue();
      expect(input('password').disabled).toBeTrue();
      expect(root().querySelector('mat-progress-spinner')).not.toBeNull();

      (fixture.componentInstance as unknown as { submit(): void }).submit();
      expect(login).toHaveBeenCalledTimes(1);

      pending.next(user);
      pending.complete();
      expect(navigateByUrl).toHaveBeenCalledOnceWith('/contacts');
    });
  });

  describe('failing to sign in', () => {
    beforeEach(() => {
      configure({}, throwError(() => new HttpErrorResponse({ status: 401, error: { title: 'Unauthorized', detail: 'Invalid email or password' } })));
      fill('ada@example.com', 'wrong-pass');
      submit();
    });

    it('shows the server message and stays put', () => {
      expect(alertText()).toBe('Invalid email or password');
      expect(navigateByUrl).not.toHaveBeenCalled();
    });

    it('lets the user try again with their input intact', () => {
      expect(submitButton().disabled).toBeFalse();
      expect(input('email').disabled).toBeFalse();
      expect(input('email').value).toBe('ada@example.com');
      expect(input('password').value).toBe('wrong-pass');
      expect(root().querySelector('mat-progress-spinner')).toBeNull();
    });

    it('clears the message as soon as the user edits', () => {
      fill('ada@example.com', 'wrong-pas');
      expect(root().querySelector('[role="alert"]')).toBeNull();
    });
  });

  it('reports an unreachable server', () => {
    configure({}, throwError(() => new HttpErrorResponse({ status: 0, error: new ProgressEvent('error') })));
    fill('ada@example.com', 'secret1');
    submit();
    expect(alertText()).toContain('Unable to reach the server');
  });

  it('toggles password visibility and announces the state', () => {
    configure();
    const toggle = root().querySelector('button[aria-label="Show password"]') as HTMLButtonElement;
    expect(toggle.getAttribute('aria-pressed')).toBe('false');
    toggle.click();
    fixture.detectChanges();
    expect(input('password').type).toBe('text');
    expect(toggle.getAttribute('aria-pressed')).toBe('true');
    toggle.click();
    fixture.detectChanges();
    expect(input('password').type).toBe('password');
    expect(toggle.getAttribute('aria-pressed')).toBe('false');
  });
});
