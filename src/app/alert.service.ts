import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { Alert, AlertType } from './alert.model';
import { AlertBuilder } from './alert.builder';

@Injectable({ providedIn: 'root' })
export class AlertService {

    private alerts: Alert[] = [];
    private alertsSubject = new BehaviorSubject<Alert[]>([]);
    private alertsObservable = this.alertsSubject.asObservable();

    success(message: string) {
        this.publish(new AlertBuilder()
            .type(AlertType.Success)
            .message(message)
            .build())
    }

    info(message: string) {
        this.publish(new AlertBuilder()
            .type(AlertType.Info)
            .message(message)
            .autoClose(true)
            .build())
    }

    infoDump(message: string, data: string) {
        this.publish(new AlertBuilder()
            .type(AlertType.Info)
            .message(message)
            .autoClose(true)
            .dump(data)
            .build());
    }

    error(message: string) {
        this.publish(new AlertBuilder()
            .type(AlertType.Error)
            .message(message)
            .autoClose(true)
            .build());
    }

    errorDump(message: string, dump: any) {
        this.publish(new AlertBuilder()
            .type(AlertType.Error)
            .message(message)
            .autoClose(true)
            .dump(dump)
            .build());
    }

    warning(message: string) {
        this.publish(new AlertBuilder()
            .type(AlertType.Warning)
            .message(message)
            .autoClose(true)
            .build());
    }

    clear() {
        console.log(`AlertService.clear`)
        this.alerts = []
        this.alertsSubject.next(this.alerts);
    }

    publish(alert: Alert) {
        console.log(`AlertService.publish`)
        this.alerts.push(alert);
        this.alertsSubject.next(this.alerts);

        if (alert.autoClose) {
            setTimeout(() => this.removeAlert(alert), 3000);
        }
    }

    getAlert(id: number): Observable<Alert> {
        console.log(`AlertService.getAlert: id=${id}`);
        console.log(`AlertService.getAlert: alerts: ${JSON.stringify(this.alerts)}`);
        const alert = this.alerts.find(h => h.id === id)!;
        return of(alert);
    }

    getAlerts(): Observable<Alert[]> {
        console.log(`AlertService.getAlerts`)
        return this.alertsObservable;
    }

    removeAlert(alert: Alert) {
        console.log(`AlertService.removeAlert: id: ${alert.id}`)

        let newArray: Alert[] = []
        this.alerts.forEach(
            a => {
                if (a.id != alert.id) {
                    newArray.push(a);
                }
            }
        )

        this.alerts = newArray
        this.alertsSubject.next(this.alerts);
    }
}

