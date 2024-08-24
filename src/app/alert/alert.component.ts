import { Component, Input, afterNextRender, inject, Injector, ViewChild } from '@angular/core';
import { MatTableModule } from '@angular/material/table';
import { ScrollingModule } from '@angular/cdk/scrolling';
import { FullheaderComponent } from "../fullheader/fullheader.component";
import { FullfooterComponent } from "../fullfooter/fullfooter.component";
import { MatCardModule } from '@angular/material/card';
import { MatListModule } from '@angular/material/list';
import { CommonModule } from '@angular/common';

import { CdkTextareaAutosize, TextFieldModule } from '@angular/cdk/text-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';

import { Alert, AlertType } from '../alert.model';
import { AlertService } from '../alert.service';
import { ActivatedRoute } from '@angular/router';
import { AlertsComponent } from '../alerts/alerts.component';
import { AlertBuilder } from '../alert.builder';

@Component({
  selector: 'app-dump',
  standalone: true,
  imports: [
    MatTableModule,
    ScrollingModule,
    FullheaderComponent,
    FullfooterComponent,
    MatCardModule,
    MatListModule,
    CommonModule,
    AlertsComponent,
    MatFormFieldModule,
    MatSelectModule,
    MatInputModule,
    TextFieldModule
  ],
  templateUrl: './alert.component.html',
  styleUrl: './alert.component.scss'
})
export class AlertComponent {

  @Input() title?: string;
  @Input() alert = new AlertBuilder().message("not found").build();

  constructor(
    private route: ActivatedRoute,
    private alertService: AlertService
  ) { }



  ngOnInit(): void {
    console.log('AlertComponent.ngOnInit')
    this.getAlert();
  }

  getAlert(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    console.log(`AlertComponent.getAlert: id: ${id}`)
    this.alertService.getAlert(id).subscribe({
      next: alert => {
        this.alert = alert
        console.log(`AlertComponent.getAlert - next: alert: ${JSON.stringify(alert)}`)
      },
      error(err) {
        console.log(`AlertComponent.getAlert - error: err: ${JSON.stringify(err)}`)
      },
      complete() {
        console.log(`AlertComponent.getAlert - complete`)
      }
    });
  }


  cssClass(alert: Alert) {
    if (!alert) return;

    const classes: string[] = [];

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


  getMessage() {
    if (this.alert) {
      return this.alert.message
    }
    return ""
  }

  getDump() {
    if (this.alert) {
      return this.alert.dump
    }
    return ""
  }
}
