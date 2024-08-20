import { Injectable } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { filter } from 'rxjs/operators';
import { Alert } from './alert.model';
import { AlertBuilder } from './alert.builder';

@Injectable({ providedIn: 'root' })
export class AlertService {
    private subject = new Subject<Alert>();

    private publish(alert: Alert) {
        this.subject.next(alert);
    }

    success(autoclose: boolean, message: string) {
        console.log("AlertService.success")
        this.publish(new AlertBuilder().autoClose(autoclose).message(message).success().build()) 
    }

    error(autoclose: boolean, message: string) {
        console.log("AlertService.error")
        this.publish(new AlertBuilder().autoClose(autoclose).message(message).error().build()) 
    }

    info(autoclose: boolean, message: string) {
        console.log("AlertService.info")
        this.publish(new AlertBuilder().autoClose(autoclose).message(message).info().build()) 
    }

    warning(autoclose: boolean, message: string) {
        console.log("AlertService.warning")
        this.publish(new AlertBuilder().autoClose(autoclose).message(message).warning().build()) 
    }

    errorDump(message: string, data: any) {
        this.publish(new AlertBuilder().message(message).error().dump(data).build())
    }

    onAlert(id = Alert.defaultId): Observable<Alert> {
        console.log("AlertService.onAlert")
        return this.subject.asObservable().pipe(filter(x => x && x.id === id));
    }

    clear(id = Alert.defaultId) {
        console.log("AlertService.clear")
        this.subject.next(new AlertBuilder().id(id).build());
    }
}

