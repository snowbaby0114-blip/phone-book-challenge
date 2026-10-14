import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { IS_BROWSER } from '../config/tokens';
import { SessionService } from './session.service';

export const authGuard: CanActivateFn = (_route, state) => {
  if (!inject(IS_BROWSER)) {
    return true;
  }
  if (inject(SessionService).isAuthenticated()) {
    return true;
  }
  return inject(Router).createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
};

export const guestGuard: CanActivateFn = () => {
  if (!inject(IS_BROWSER)) {
    return true;
  }
  if (inject(SessionService).isAuthenticated()) {
    return inject(Router).createUrlTree(['/contacts']);
  }
  return true;
};
