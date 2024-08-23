import { Injectable } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { filter } from 'rxjs/operators';
import { Alert, AlertType } from './alert.model';
import { AlertBuilder } from './alert.builder';

@Injectable({ providedIn: 'root' })
export class AlertService {
    private subject = new Subject<Alert>();

    publish(alert: Alert) {
        console.log(`AlertService.publish: ${alert.message}`)
        this.subject.next(alert);
    }

    onAlert(id = Alert.defaultId): Observable<Alert> {
        console.log(`AlertService.onAlert: ${id}`)
        return this.subject.asObservable().pipe(filter(x => x && x.id === id));
    }

    clear(id = Alert.defaultId) {
        this.subject.next(new AlertBuilder().id(id).build());
    }

    info(message: string) {
        console.log(`AlertService.info: ${message}`)
        this.publish(new AlertBuilder()
            .type(AlertType.Info)
            .keepAfterRouteChange(true)
            .message(message)
            .build());
    }

    infoDump(message: string, data: string) {
        console.log(`AlertService.info: ${message}`)
        this.publish(new AlertBuilder()
            .type(AlertType.Info)
            .keepAfterRouteChange(true)
            .message(message)
            .dump(data)
            .build());
    }

    error(message: string) {
        this.publish(new AlertBuilder()
            .type(AlertType.Error)
            .message(message)
            .build());
    }

    warning(message: string) {
        this.publish(new AlertBuilder()
            .type(AlertType.Warning)
            .message(message)
            .build());
    }

    success(message: string) {
        this.publish(new AlertBuilder()
            .type(AlertType.Success)
            .message(message)
            .build());
    }
}

