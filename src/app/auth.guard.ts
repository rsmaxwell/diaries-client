import { Injectable } from '@angular/core';
import { Router, CanActivate, ActivatedRouteSnapshot, RouterStateSnapshot, UrlTree } from '@angular/router';
import { AccessTokenService } from './user/token/accessTokenService';

@Injectable({ providedIn: 'root' })
export class AuthGuard implements CanActivate {
  constructor(
    private router: Router,
    private accessTokenService: AccessTokenService
  ) {
    console.log(`AuthGuard: constructor()`);
  }

  canActivate(route: ActivatedRouteSnapshot, state: RouterStateSnapshot): boolean | UrlTree {
    const token = this.accessTokenService.getCurrentToken();
  
    if (token) {
      return true;
    }
  
    console.log(`AuthGuard: No token, redirecting to signin`);
    return this.router.parseUrl(`/signin?returnUrl=${encodeURIComponent(state.url)}`);
  }
  
}
