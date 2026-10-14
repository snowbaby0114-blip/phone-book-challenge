import { HttpClient, HttpErrorResponse, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { API_URL } from '../config/tokens';
import { SessionService } from '../services/session.service';
import { apiInterceptor } from './api.interceptor';

const user = { name: 'Ada', surname: 'Lovelace', email: 'ada@example.com' };

describe('apiInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;
  let session: SessionService;
  let navigate: jasmine.Spy;
  let apiUrl: string;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(withInterceptors([apiInterceptor])), provideHttpClientTesting()]
    });
    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
    session = TestBed.inject(SessionService);
    apiUrl = TestBed.inject(API_URL);
    navigate = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  it('sends credentials with API requests', () => {
    http.get(`${apiUrl}/contacts`).subscribe();
    const request = httpMock.expectOne(`${apiUrl}/contacts`);
    expect(request.request.withCredentials).toBeTrue();
    request.flush([]);
  });

  it('leaves other origins untouched', () => {
    http.get('https://example.org/data').subscribe();
    const request = httpMock.expectOne('https://example.org/data');
    expect(request.request.withCredentials).toBeFalse();
    request.flush({});
  });

  it('does not intercept errors from other origins', () => {
    session.start(user);
    http.get('https://example.org/data').subscribe({ error: () => undefined });
    httpMock.expectOne('https://example.org/data').flush({}, { status: 401, statusText: 'Unauthorized' });
    expect(session.isAuthenticated()).toBeTrue();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('ends the session and returns to login when an authenticated call gets 401', () => {
    session.start(user);
    let received: unknown;
    http.get(`${apiUrl}/contacts`).subscribe({ error: error => (received = error) });
    httpMock.expectOne(`${apiUrl}/contacts`).flush({}, { status: 401, statusText: 'Unauthorized' });

    expect(session.isAuthenticated()).toBeFalse();
    expect(localStorage.getItem('user')).toBeNull();
    expect(navigate).toHaveBeenCalledOnceWith(['/login'], { queryParams: { returnUrl: '/' } });
    expect((received as HttpErrorResponse).status).toBe(401);
  });

  it('does not redirect when a guest gets 401, such as a wrong password', () => {
    let received: unknown;
    http.post(`${apiUrl}/auth/login`, {}).subscribe({ error: error => (received = error) });
    httpMock.expectOne(`${apiUrl}/auth/login`).flush({ detail: 'Invalid email or password' }, { status: 401, statusText: 'Unauthorized' });

    expect(navigate).not.toHaveBeenCalled();
    expect((received as HttpErrorResponse).status).toBe(401);
  });

  it('keeps the session for other failures', () => {
    session.start(user);
    for (const status of [400, 403, 404, 409, 500]) {
      http.get(`${apiUrl}/x/${status}`).subscribe({ error: () => undefined });
      httpMock.expectOne(`${apiUrl}/x/${status}`).flush({}, { status, statusText: 'Failure' });
    }
    expect(session.isAuthenticated()).toBeTrue();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('passes successful responses through', () => {
    let body: unknown;
    http.get(`${apiUrl}/contacts`).subscribe(value => (body = value));
    httpMock.expectOne(`${apiUrl}/contacts`).flush([{ id: 1 }]);
    expect(body).toEqual([{ id: 1 }]);
  });
});
