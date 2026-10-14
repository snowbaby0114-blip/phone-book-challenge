import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, CanActivateFn, Router, RouterStateSnapshot, UrlTree, provideRouter } from '@angular/router';
import { IS_BROWSER } from '../config/tokens';
import { authGuard, guestGuard } from './auth-guard.service';
import { SessionService } from './session.service';

const user = { name: 'Ada', surname: 'Lovelace', email: 'ada@example.com' };

describe('route guards', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  const configure = (isBrowser = true): void => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: IS_BROWSER, useValue: isBrowser }]
    });
  };

  const run = (guard: CanActivateFn, url = '/history') =>
    TestBed.runInInjectionContext(() => guard({} as ActivatedRouteSnapshot, { url } as RouterStateSnapshot));

  const serialize = (result: unknown): string => TestBed.inject(Router).serializeUrl(result as UrlTree);

  describe('authGuard', () => {
    it('sends guests to login and remembers where they were going', () => {
      configure();
      expect(serialize(run(authGuard, '/history?contactId=2'))).toBe('/login?returnUrl=%2Fhistory%3FcontactId%3D2');
    });

    it('lets signed-in users through', () => {
      configure();
      TestBed.inject(SessionService).start(user);
      expect(run(authGuard)).toBeTrue();
    });

    it('lets the server render the protected shell', () => {
      configure(false);
      expect(run(authGuard)).toBeTrue();
    });
  });

  describe('guestGuard', () => {
    it('lets guests see public pages', () => {
      configure();
      expect(run(guestGuard, '/login')).toBeTrue();
    });

    it('moves signed-in users to contacts', () => {
      configure();
      TestBed.inject(SessionService).start(user);
      expect(serialize(run(guestGuard, '/login'))).toBe('/contacts');
    });

    it('lets the server render public pages', () => {
      configure(false);
      expect(run(guestGuard, '/login')).toBeTrue();
    });
  });
});
