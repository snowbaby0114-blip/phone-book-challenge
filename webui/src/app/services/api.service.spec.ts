import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { API_URL } from '../config/tokens';
import { Message, MessageQuery, Page } from '../models/message.model';
import { User } from '../models/user.model';
import { ApiService } from './api.service';
import { SessionService } from './session.service';

const ada: User = { name: 'Ada', surname: 'Lovelace', email: 'ada@example.com' };
const grace: User = { name: 'Grace', surname: 'Hopper', email: 'grace@example.com' };

const baseQuery: MessageQuery = { page: 1, pageSize: 10, sortBy: 'date', sortDirection: 'desc' };

describe('ApiService', () => {
  let api: ApiService;
  let httpMock: HttpTestingController;
  let session: SessionService;
  let url: string;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    api = TestBed.inject(ApiService);
    httpMock = TestBed.inject(HttpTestingController);
    session = TestBed.inject(SessionService);
    url = TestBed.inject(API_URL);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  it('signup posts the registration and completes without a value', () => {
    let result: unknown = 'unset';
    api.signup({ ...ada, password: 'secret1' }).subscribe(value => (result = value));
    const request = httpMock.expectOne(`${url}/auth/register`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ ...ada, password: 'secret1' });
    request.flush({ message: 'User successfully registered' });
    expect(result).toBeUndefined();
    expect(session.isAuthenticated()).toBeFalse();
  });

  it('login returns the user and starts the session', () => {
    let result: User | undefined;
    api.login('ada@example.com', 'secret1').subscribe(user => (result = user));
    const request = httpMock.expectOne(`${url}/auth/login`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ email: 'ada@example.com', password: 'secret1' });
    request.flush({ user: ada, message: 'Successfully logged in' });
    expect(result).toEqual(ada);
    expect(session.user()).toEqual(ada);
  });

  it('login leaves the session untouched on failure', () => {
    let failed = false;
    api.login('ada@example.com', 'wrong').subscribe({ error: () => (failed = true) });
    httpMock.expectOne(`${url}/auth/login`).flush({ detail: 'Invalid email or password' }, { status: 401, statusText: 'Unauthorized' });
    expect(failed).toBeTrue();
    expect(session.isAuthenticated()).toBeFalse();
  });

  it('logout ends the session after the server confirms', () => {
    session.start(ada);
    let completed = false;
    api.logout().subscribe({ complete: () => (completed = true) });
    const request = httpMock.expectOne(`${url}/auth/logout`);
    expect(request.request.method).toBe('POST');
    request.flush({ message: 'Successfully logged out' });
    expect(completed).toBeTrue();
    expect(session.isAuthenticated()).toBeFalse();
  });

  it('logout ends the session even when the server fails', () => {
    session.start(ada);
    let errored = false;
    api.logout().subscribe({ error: () => (errored = true) });
    httpMock.expectOne(`${url}/auth/logout`).flush({}, { status: 500, statusText: 'Server Error' });
    expect(errored).toBeFalse();
    expect(session.isAuthenticated()).toBeFalse();
  });

  it('getProfile loads the profile and refreshes the session', () => {
    session.start(ada);
    let result: User | undefined;
    api.getProfile().subscribe(user => (result = user));
    const request = httpMock.expectOne(`${url}/users/me`);
    expect(request.request.method).toBe('GET');
    request.flush(grace);
    expect(result).toEqual(grace);
    expect(session.user()).toEqual(grace);
  });

  it('updateProfile posts the new details and refreshes the session', () => {
    session.start(ada);
    let result: User | undefined;
    api.updateProfile(grace).subscribe(user => (result = user));
    const request = httpMock.expectOne(`${url}/users/me/profile`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual(grace);
    request.flush(grace);
    expect(result).toEqual(grace);
    expect(session.user()).toEqual(grace);
  });

  it('updateProfile keeps the old session when the update fails', () => {
    session.start(ada);
    api.updateProfile(grace).subscribe({ error: () => undefined });
    httpMock.expectOne(`${url}/users/me/profile`).flush({ detail: 'Email already in use' }, { status: 409, statusText: 'Conflict' });
    expect(session.user()).toEqual(ada);
  });

  it('updatePassword posts the three fields and completes without a value', () => {
    const body = { currentPassword: 'old123', newPassword: 'new123', confirmNewPassword: 'new123' };
    let result: unknown = 'unset';
    api.updatePassword(body).subscribe(value => (result = value));
    const request = httpMock.expectOne(`${url}/users/me/password`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual(body);
    request.flush(null, { status: 204, statusText: 'No Content' });
    expect(result).toBeUndefined();
  });

  it('getContacts loads the contacts', () => {
    let result: unknown;
    api.getContacts().subscribe(contacts => (result = contacts));
    const request = httpMock.expectOne(`${url}/contacts`);
    expect(request.request.method).toBe('GET');
    request.flush([{ id: 1 }]);
    expect(result).toEqual([{ id: 1 }]);
  });

  describe('getMessages', () => {
    const expectRequest = (query: MessageQuery) => {
      api.getMessages(query).subscribe();
      return httpMock.expectOne(request => request.url === `${url}/messages`);
    };

    it('sends only the paging and sorting parameters for a bare query', () => {
      const request = expectRequest(baseQuery);
      expect(request.request.method).toBe('GET');
      expect(request.request.params.keys().sort()).toEqual(['page', 'pageSize', 'sortBy', 'sortDirection']);
      expect(request.request.params.get('page')).toBe('1');
      expect(request.request.params.get('pageSize')).toBe('10');
      expect(request.request.params.get('sortBy')).toBe('date');
      expect(request.request.params.get('sortDirection')).toBe('desc');
      request.flush({ items: [], total: 0, page: 1, pageSize: 10 });
    });

    it('adds every filter that is set', () => {
      const request = expectRequest({
        ...baseQuery,
        page: 3,
        pageSize: 25,
        sortBy: 'contact',
        sortDirection: 'asc',
        type: 'Email',
        status: 'Read',
        contactId: 7,
        search: '  eye exam  '
      });
      const params = request.request.params;
      expect(params.get('page')).toBe('3');
      expect(params.get('pageSize')).toBe('25');
      expect(params.get('sortBy')).toBe('contact');
      expect(params.get('sortDirection')).toBe('asc');
      expect(params.get('type')).toBe('Email');
      expect(params.get('status')).toBe('Read');
      expect(params.get('contactId')).toBe('7');
      expect(params.get('search')).toBe('eye exam');
      request.flush({ items: [], total: 0, page: 3, pageSize: 25 });
    });

    it('omits empty and null filters', () => {
      const request = expectRequest({ ...baseQuery, type: null, status: null, contactId: null, search: '   ' });
      expect(request.request.params.keys().sort()).toEqual(['page', 'pageSize', 'sortBy', 'sortDirection']);
      request.flush({ items: [], total: 0, page: 1, pageSize: 10 });
    });

    it('returns the page from the server', () => {
      const message: Message = {
        id: 1,
        type: 'SMS',
        status: 'Queued',
        body: 'Hello',
        date: '2026-01-01T09:00:00Z',
        contactId: 2,
        contactName: 'Ada Lovelace',
        contactPhoneNumber: '+15550000001',
        contactEmail: 'ada@example.com'
      };
      const page: Page<Message> = { items: [message], total: 1, page: 1, pageSize: 10 };
      let result: Page<Message> | undefined;
      api.getMessages(baseQuery).subscribe(value => (result = value));
      httpMock.expectOne(request => request.url === `${url}/messages`).flush(page);
      expect(result).toEqual(page);
    });
  });

  it('createMessage posts the message and returns the created one', () => {
    const created = { id: 31, type: 'Email', status: 'Queued' };
    let result: unknown;
    api.createMessage({ contactId: 2, type: 'Email', body: 'Hello' }).subscribe(value => (result = value));
    const request = httpMock.expectOne(`${url}/messages`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ contactId: 2, type: 'Email', body: 'Hello' });
    request.flush(created, { status: 201, statusText: 'Created' });
    expect(result).toEqual(created);
  });
});
