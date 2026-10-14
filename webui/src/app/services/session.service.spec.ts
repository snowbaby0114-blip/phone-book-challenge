import { TestBed } from '@angular/core/testing';
import { IS_BROWSER } from '../config/tokens';
import { User } from '../models/user.model';
import { SessionService } from './session.service';

const ada: User = { name: 'Ada', surname: 'Lovelace', email: 'ada@example.com' };
const grace: User = { name: 'Grace', surname: 'Hopper', email: 'grace@example.com' };

describe('SessionService', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  const create = (isBrowser = true): SessionService => {
    TestBed.configureTestingModule({ providers: [{ provide: IS_BROWSER, useValue: isBrowser }] });
    return TestBed.inject(SessionService);
  };

  it('starts signed out when nothing is stored', () => {
    const session = create();
    expect(session.user()).toBeNull();
    expect(session.isAuthenticated()).toBeFalse();
  });

  it('restores a stored user', () => {
    localStorage.setItem('user', JSON.stringify(ada));
    const session = create();
    expect(session.user()).toEqual(ada);
    expect(session.isAuthenticated()).toBeTrue();
  });

  it('ignores corrupt stored data', () => {
    localStorage.setItem('user', '{not json');
    const session = create();
    expect(session.user()).toBeNull();
    expect(session.isAuthenticated()).toBeFalse();
  });

  for (const [description, stored] of [
    ['a JSON null', 'null'],
    ['a JSON array', '[]'],
    ['a bare string', '"ada"'],
    ['an empty object', '{}'],
    ['an object with a non-string field', JSON.stringify({ ...ada, email: 42 })],
    ['an object missing a field', JSON.stringify({ name: 'Ada', surname: 'Lovelace' })]
  ] as const) {
    it(`ignores ${description} in storage`, () => {
      localStorage.setItem('user', stored);
      const session = create();
      expect(session.user()).toBeNull();
      expect(session.isAuthenticated()).toBeFalse();
    });
  }

  it('start exposes and persists the user', () => {
    const session = create();
    session.start(ada);
    expect(session.user()).toEqual(ada);
    expect(session.isAuthenticated()).toBeTrue();
    expect(JSON.parse(localStorage.getItem('user') as string)).toEqual(ada);
  });

  it('update replaces the user', () => {
    const session = create();
    session.start(ada);
    session.update(grace);
    expect(session.user()).toEqual(grace);
    expect(JSON.parse(localStorage.getItem('user') as string)).toEqual(grace);
  });

  it('end clears memory and storage', () => {
    const session = create();
    session.start(ada);
    session.end();
    expect(session.user()).toBeNull();
    expect(session.isAuthenticated()).toBeFalse();
    expect(localStorage.getItem('user')).toBeNull();
  });

  it('keeps working when storage throws', () => {
    const session = create();
    spyOn(Storage.prototype, 'setItem').and.throwError('quota exceeded');
    spyOn(Storage.prototype, 'removeItem').and.throwError('blocked');
    expect(() => session.start(ada)).not.toThrow();
    expect(session.user()).toEqual(ada);
    expect(() => session.end()).not.toThrow();
    expect(session.user()).toBeNull();
  });

  it('never reads or writes storage on the server', () => {
    localStorage.setItem('user', JSON.stringify(ada));
    const session = create(false);
    expect(session.user()).toBeNull();
    session.start(grace);
    session.end();
    expect(JSON.parse(localStorage.getItem('user') as string)).toEqual(ada);
  });
});
