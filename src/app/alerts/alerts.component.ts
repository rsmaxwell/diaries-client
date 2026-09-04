import { Component, Input, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';

import { Alert, AlertType, alertTypeLabel } from './alert.model';
import { AlertService } from './alert.service';


@Component({
  selector: 'app-alerts',
  standalone: true,
  imports: [],
  templateUrl: './alerts.component.html',
  styleUrl: './alerts.component.scss'
})
export class AlertsComponent implements OnInit, OnDestroy {

  @Input() fade = true;

  alert: Alert | null = null;
  alertSubscription!: Subscription;
  routeSubscription!: Subscription;

  constructor(
    private router: Router, 
    private alertService: AlertService
) { }

  ngOnInit() {
    this.getAlerts();
  }

  getAlerts(): void {
    this.alertService.getAlerts().subscribe({
      next: value => {
        if (value && value.length > 0) {
          this.alert = value[value.length - 1]; // show only the most recent
        } else {
          this.alert = null;
        }
      },
      error: err => console.error('AlertsComponent.getAlerts: error: ' + err),
      complete: () => console.log('AlertsComponent.getAlerts: complete')
    });
  }

  ngOnDestroy() {
    console.log('AlertsComponent.ngOnDestroy')
  }

  removeAlert() {
    console.log(`AlertComponent.removeAlert`);
    this.alert = null;
  }
  
  cssClass(alert: Alert) {
      if (!alert) return;

      const classes = [];
              
      const alertTypeClass = {
          [AlertType.Success]: 'alert-success',
          [AlertType.Error]: 'alert-danger',
          [AlertType.Info]: 'alert-info',
          [AlertType.Warning]: 'alert-warning'
      }

      if (alert.type !== undefined) {
          classes.push(alertTypeClass[alert.type]);
      }

      return classes.join(' ');
  }

  typeLabel(alert: Alert): string {
    return alertTypeLabel(alert.type);
  }

  getRecord(alert: Alert) {
    console.log(`AlertComponent.getRecord: diary: ${alert.id}`)
    this.router.navigate([`/alert/${alert.id}`]);
  }
}
