import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, finalize, map, of, tap } from 'rxjs';
import { API_URL } from '../config/tokens';
import { Contact } from '../models/contact.model';
import { Message, MessageQuery, NewMessage, Page } from '../models/message.model';
import { SignupRequest, UpdatePasswordRequest, UpdateProfileRequest, User } from '../models/user.model';
import { SessionService } from './session.service';

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = inject(API_URL);
  private readonly session = inject(SessionService);

  signup(request: SignupRequest): Observable<void> {
    return this.http.post(`${this.apiUrl}/auth/register`, request).pipe(map(() => undefined));
  }

  login(email: string, password: string): Observable<User> {
    return this.http.post<{ user: User }>(`${this.apiUrl}/auth/login`, { email, password }).pipe(
      map(response => response.user),
      tap(user => this.session.start(user))
    );
  }

  logout(): Observable<void> {
    return this.http.post(`${this.apiUrl}/auth/logout`, {}).pipe(
      map(() => undefined),
      catchError(() => of(undefined)),
      finalize(() => this.session.end())
    );
  }

  getProfile(): Observable<User> {
    return this.http.get<User>(`${this.apiUrl}/users/me`).pipe(
      tap(user => this.session.update(user))
    );
  }

  updateProfile(request: UpdateProfileRequest): Observable<User> {
    return this.http.post<User>(`${this.apiUrl}/users/me/profile`, request).pipe(
      tap(user => this.session.update(user))
    );
  }

  updatePassword(request: UpdatePasswordRequest): Observable<void> {
    return this.http.post(`${this.apiUrl}/users/me/password`, request).pipe(map(() => undefined));
  }

  getContacts(): Observable<Contact[]> {
    return this.http.get<Contact[]>(`${this.apiUrl}/contacts`);
  }

  getMessages(query: MessageQuery): Observable<Page<Message>> {
    let params = new HttpParams()
      .set('page', query.page)
      .set('pageSize', query.pageSize)
      .set('sortBy', query.sortBy)
      .set('sortDirection', query.sortDirection);

    if (query.type) {
      params = params.set('type', query.type);
    }
    if (query.status) {
      params = params.set('status', query.status);
    }
    if (query.contactId) {
      params = params.set('contactId', query.contactId);
    }
    if (query.search?.trim()) {
      params = params.set('search', query.search.trim());
    }

    return this.http.get<Page<Message>>(`${this.apiUrl}/messages`, { params });
  }

  createMessage(message: NewMessage): Observable<Message> {
    return this.http.post<Message>(`${this.apiUrl}/messages`, message);
  }
}
