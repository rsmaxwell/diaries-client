import { Component } from '@angular/core';
import { AlertService } from '../alert.service';
import { FormsModule } from '@angular/forms';

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
  
}
