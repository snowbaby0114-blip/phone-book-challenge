import { Component, NgZone } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { Router, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { ApiService } from '../../services/api.service';
import { SessionService } from '../../services/session.service';
import { MainnavComponent } from './mainnav.component';

@Component({ standalone: true, template: '' })
class BlankComponent {}

const user = { name: 'Ada', surname: 'Lovelace', email: 'ada@example.com' };

describe('MainnavComponent', () => {
  let fixture: ComponentFixture<MainnavComponent>;
  let session: SessionService;
  let router: Router;
  let logout: jasmine.Spy;

  const root = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const text = (element: Element): string => (element.textContent ?? '').replace(/\s+/g, ' ').trim();
  const inlineLinks = (): string[] => Array.from(root().querySelectorAll('.mainnav__links a')).map(text);
  const menuItems = (): HTMLElement[] => Array.from(document.querySelectorAll<HTMLElement>('.mat-mdc-menu-panel [mat-menu-item]'));
  const menuLabels = (): string[] => menuItems().map(item => text(item.querySelector('.mat-mdc-menu-item-text') as Element));
  const openMenu = async (): Promise<void> => {
    (root().querySelector('.mainnav__menu-button') as HTMLElement).click();
    fixture.detectChanges();
    await fixture.whenStable();
  };

  beforeEach(() => {
    localStorage.clear();
    logout = jasmine.createSpy('logout').and.callFake(() => {
      session.end();
      return of(undefined);
    });
    TestBed.configureTestingModule({
      imports: [MainnavComponent],
      providers: [
        provideRouter([
          { path: 'history', component: BlankComponent },
          { path: 'login', component: BlankComponent }
        ]),
        provideNoopAnimations(),
        { provide: ApiService, useValue: { logout } }
      ]
    });
    session = TestBed.inject(SessionService);
    router = TestBed.inject(Router);
  });

  afterEach(() => localStorage.clear());

  const create = (signedIn: boolean): void => {
    if (signedIn) {
      session.start(user);
    }
    fixture = TestBed.createComponent(MainnavComponent);
    fixture.detectChanges();
  };

  it('is a labelled navigation landmark with a brand link', () => {
    create(false);
    expect(root().querySelector('nav')?.getAttribute('aria-label')).toBe('Main');
    const brand = root().querySelector('.mainnav__brand') as HTMLAnchorElement;
    expect(text(brand)).toContain('Phone Book');
    expect(brand.getAttribute('href')).toBe('/contacts');
  });

  describe('as a guest', () => {
    beforeEach(() => create(false));

    it('offers sign in and registration only', () => {
      expect(inlineLinks()).toEqual(['Sign in', 'Create account']);
      const hrefs = Array.from(root().querySelectorAll('.mainnav__links a')).map(link => link.getAttribute('href'));
      expect(hrefs).toEqual(['/login', '/register']);
    });

    it('has no first name to show', () => {
      expect((fixture.componentInstance as unknown as { firstName(): string }).firstName()).toBe('');
    });

    it('shows neither the user nor sign out', () => {
      expect(root().querySelector('.mainnav__user')).toBeNull();
      expect(Array.from(root().querySelectorAll('button')).some(button => text(button) === 'Sign out')).toBeFalse();
    });

    it('lists the same destinations in the mobile menu', async () => {
      await openMenu();
      expect(menuLabels()).toEqual(['Sign in', 'Create account']);
    });
  });

  describe('when signed in', () => {
    beforeEach(() => create(true));

    it('offers the member pages in order', () => {
      expect(inlineLinks()).toEqual(['Contacts', 'History', 'Profile']);
      const hrefs = Array.from(root().querySelectorAll('.mainnav__links a')).map(link => link.getAttribute('href'));
      expect(hrefs).toEqual(['/contacts', '/history', '/profile']);
    });

    it('shows who is signed in', () => {
      expect(text(root().querySelector('.mainnav__user') as Element)).toContain('Signed in as');
      expect(text(root().querySelector('.mainnav__user-name') as Element)).toBe('Ada');
    });

    it('follows changes to the session', () => {
      session.update({ ...user, name: 'Grace' });
      fixture.detectChanges();
      expect(text(root().querySelector('.mainnav__user-name') as Element)).toBe('Grace');
      session.end();
      fixture.detectChanges();
      expect(inlineLinks()).toEqual(['Sign in', 'Create account']);
    });

    it('marks the current page', async () => {
      await TestBed.inject(NgZone).run(() => router.navigateByUrl('/history'));
      fixture.detectChanges();
      const active = Array.from(root().querySelectorAll('.mainnav__links a')).filter(link => link.classList.contains('mainnav__link--active'));
      expect(active.map(text)).toEqual(['History']);
      expect(active[0].getAttribute('aria-current')).toBe('page');
    });

    it('signs out and returns to the login page', async () => {
      const navigate = spyOn(router, 'navigate').and.resolveTo(true);
      const signOut = Array.from(root().querySelectorAll('.mainnav__links button')).find(button => text(button) === 'Sign out') as HTMLElement;
      signOut.click();
      expect(logout).toHaveBeenCalledTimes(1);
      expect(navigate).toHaveBeenCalledOnceWith(['/login']);
    });

    it('lists the same destinations and sign out in the mobile menu', async () => {
      await openMenu();
      expect(menuLabels()).toEqual(['Contacts', 'History', 'Profile', 'Sign out']);
    });

    it('signs out from the mobile menu', async () => {
      const navigate = spyOn(router, 'navigate').and.resolveTo(true);
      await openMenu();
      menuItems().find(item => text(item).includes('Sign out'))?.click();
      expect(logout).toHaveBeenCalledTimes(1);
      expect(navigate).toHaveBeenCalledOnceWith(['/login']);
    });
  });

  it('gives the menu button an accessible name', () => {
    create(false);
    expect(root().querySelector('.mainnav__menu-button')?.getAttribute('aria-label')).toBe('Open menu');
  });
});
