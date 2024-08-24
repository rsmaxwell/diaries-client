import { Component, Input, OnDestroy, OnInit } from '@angular/core';
import { NavigationStart, Router } from '@angular/router';
import { Subscription } from 'rxjs';

import { Alert, AlertType } from '../alert.model';
import { AlertService } from '../alert.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-alertpanel',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './alertpanel.component.html',
  styleUrl: './alertpanel.component.scss'
})
export class AlertpanelComponent implements OnInit, OnDestroy {

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
        console.log(`AlertsComponent.getAlerts: value: ${JSON.stringify(value)}`)
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
    console.log(`AlertpanelComponent.removeAlert: ${alert.id}`)
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

      if (alert.fade) {
          classes.push('fade');
      }

      return classes.join(' ');
  }

  showDump(alert: Alert) {
    console.log(`AlertpanelComponent.showDump: ${alert.dump}`)
    this.router.navigate(['/dump']);
  }
}
