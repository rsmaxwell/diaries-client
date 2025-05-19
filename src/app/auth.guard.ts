import { Injectable } from '@angular/core';
import { Router, CanActivate, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { AccessTokenService } from './user/token/AccessTokenService';

@Injectable({ providedIn: 'root' })
export class AuthGuard implements CanActivate {
  constructor(
    private router: Router,
    private accessTokenService: AccessTokenService
  ) {
    console.log(`AuthGuard: constructor()`);
  }

  async canActivate(route: ActivatedRouteSnapshot, state: RouterStateSnapshot): Promise<boolean> {

    console.log(`AuthGuard: canActivate() called`);

    const token = await this.accessTokenService.getToken();

    if (token) {
      return true;
    }

    console.log(`AuthGuard: accessToken NOT found`);

    this.router.navigate(['/signin'], { queryParams: { returnUrl: state.url } });
    return false;
  }
}
