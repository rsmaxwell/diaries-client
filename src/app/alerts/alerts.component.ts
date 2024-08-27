import { Component, Input, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';

import { Alert, AlertType } from '../alert.model';
import { AlertService } from '../alert.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-alerts',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './alerts.component.html',
  styleUrl: './alerts.component.scss'
})
export class AlertsComponent implements OnInit, OnDestroy {

  @Input() fade = true;

  alerts: Alert[] = [];
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
        console.log(`AlertsComponent.getAlerts: next: value: ${JSON.stringify(value)}`)
        this.alerts = value
      },
      error: err => console.error('AlertsComponent.getAlerts: error: ' + err),
      complete: () => console.log('AlertsComponent.getAlerts: complete')
    })
  }

  ngOnDestroy() {
    console.log('AlertsComponent.ngOnDestroy')
  }

  removeAlert(alert: Alert) {
    console.log(`AlertComponent.removeAlert: ${alert.id}`)
    this.alertService.removeAlert(alert)
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

  getRecord(alert: Alert) {
    console.log(`AlertComponent.getRecord: diary: ${alert.id}`)
    this.router.navigate([`/alert/${alert.id}`]);
  }
}
