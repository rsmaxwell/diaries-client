import { Component } from '@angular/core';
import { AlertService } from '../alert.service';
import { FormsModule } from '@angular/forms';
import { Alert, AlertType } from '../alert.model';
import { AlertBuilder } from '../alert.builder';

@Component({
  selector: 'app-alertbuttons',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './alertbuttons.component.html',
  styleUrl: './alertbuttons.component.scss'
})
export class AlertbuttonsComponent {

  options = {
    autoClose: true,
    keepAfterRouteChange: false
  };

  constructor(public alertService: AlertService
  ) { }

  success() {
    this.alertService.publish(new AlertBuilder()
      .type(AlertType.Success)
      .autoClose(this.options.autoClose)
      .keepAfterRouteChange(this.options.keepAfterRouteChange)
      .message('Success!!')
      .build());
  }

  error() {
    this.alertService.publish(new AlertBuilder()
      .type(AlertType.Error)
      .autoClose(this.options.autoClose)
      .keepAfterRouteChange(this.options.keepAfterRouteChange)
      .message('Error....')
      .build());
  }

  info() {
    this.alertService.publish(new AlertBuilder()
      .type(AlertType.Info)
      .autoClose(this.options.autoClose)
      .keepAfterRouteChange(this.options.keepAfterRouteChange)
      .message('Some info....')
      .build());
  }

  warning() {
    this.alertService.publish(new AlertBuilder()
      .type(AlertType.Warning)
      .autoClose(this.options.autoClose)
      .keepAfterRouteChange(this.options.keepAfterRouteChange)
      .message('Warning: ...')
      .build());
  }

  clear() {
    this.alertService.publish(new AlertBuilder()
      .build());
  }

}
