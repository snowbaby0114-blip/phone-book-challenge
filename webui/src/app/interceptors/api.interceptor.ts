import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { API_URL } from '../config/tokens';
import { SessionService } from '../services/session.service';

export const apiInterceptor: HttpInterceptorFn = (request, next) => {
  if (!request.url.startsWith(inject(API_URL))) {
    return next(request);
  }

  const session = inject(SessionService);
  const router = inject(Router);

  return next(request.clone({ withCredentials: true })).pipe(
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse && error.status === 401 && session.isAuthenticated()) {
        session.end();
        void router.navigate(['/login'], { queryParams: { returnUrl: router.url } });
      }
      return throwError(() => error);
    })
  );
};
