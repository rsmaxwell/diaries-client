import { Injectable } from '@angular/core';
import { Router, CanActivate, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { AccessTokenService } from './user/token/AccessTokenService';



@Injectable({ providedIn: 'root' })
export class AuthGuard implements CanActivate {
    constructor(
        private router: Router,
        private accessTokenService: AccessTokenService
    ) { }

    canActivate(route: ActivatedRouteSnapshot, state: RouterStateSnapshot) {

        const token = this.accessTokenService.getCurrentToken();
        if (token) {
            return true;
        }
        else {
            console.log(`AuthGuard.canActivate(): missing 'accessToken'`)
        }

        console.log(`AuthGuard.canActivate(): accessToken NOT found`)

        // not logged in so redirect to login page with the return url
        this.router.navigate(['/signin'], { queryParams: { returnUrl: state.url } });
        return false;
    }
}