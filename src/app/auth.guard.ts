import { Injectable } from '@angular/core';
import { Router, CanActivate, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { MqttService } from './mqtt.service';
import { MqttSigninService } from './user/mqtt.signin.service';



@Injectable({ providedIn: 'root' })
export class AuthGuard implements CanActivate {
    constructor(
        private router: Router,
        private mqttSigninService: MqttSigninService
    ) { }

    canActivate(route: ActivatedRouteSnapshot, state: RouterStateSnapshot) {

        if (this.mqttSigninService.authorisedConnection) {
            const token = this.mqttSigninService.authorisedConnection.accessToken;
            if (token) {
                // console.log(`AuthGuard.canActivate(): accessToken found`)
                return true;
            }
            else {
                console.log(`AuthGuard.canActivate(): missing 'accessToken'`)
            }
        }
        else {
            console.log(`AuthGuard.canActivate(): missing 'authorisedConnection'`)
        }


        console.log(`AuthGuard.canActivate(): accessToken NOT found`)

        // not logged in so redirect to login page with the return url
        this.router.navigate(['/signin'], { queryParams: { returnUrl: state.url } });
        return false;
    }
}