import { Injectable } from '@angular/core';
import { Router, CanActivate, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { MqttService } from './mqtt.service';



@Injectable({ providedIn: 'root' })
export class AuthGuard implements CanActivate {
    constructor(
        private router: Router,
        private mqttService: MqttService
    ) {}

    canActivate(route: ActivatedRouteSnapshot, state: RouterStateSnapshot) {

        const token = this.mqttService.getAccessToken();
        if (token) {
            console.log("AuthGuard.canActivate(): accessToken found")
            return true;
        }

        console.log("AuthGuard.canActivate(): accessToken NOT found")

        // not logged in so redirect to login page with the return url
        this.router.navigate(['/signin'], { queryParams: { returnUrl: state.url }});
        return false;
    }
}