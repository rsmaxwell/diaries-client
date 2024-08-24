import { Component } from '@angular/core';
import { AlertService } from '../alert.service';
import { FormsModule } from '@angular/forms';
import { AlertType } from '../alert.model';
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
    autoClose: true
  };

  constructor(public alertService: AlertService
  ) { }

  success() {
    this.alertService.publish(new AlertBuilder()
      .type(AlertType.Success)
      .message('Success!!')
      .autoClose(this.options.autoClose)
      .dump(`
        one
        two
        three
        four
        five
        six`)
      .build());
  }

  error() {
    this.alertService.publish(new AlertBuilder()
      .type(AlertType.Error)
      .message('Error....')
      .autoClose(this.options.autoClose)
      .build());
  }

  info() {
    this.alertService.publish(new AlertBuilder()
      .type(AlertType.Info)
      .message('Some info....')
      .autoClose(this.options.autoClose)
      .build());
  }

  warning() {
    this.alertService.publish(new AlertBuilder()
      .type(AlertType.Warning)
      .message('Warning: ...')
      .autoClose(this.options.autoClose)
      .build());
  }

  clear() {
    this.alertService.clear();
  }

}
