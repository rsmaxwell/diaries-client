import { Component } from '@angular/core';
import { SigninDetailComponent } from "../signin.detail/signin.detail.component";
import { PlainfooterComponent } from "../plainfooter/plainfooter.component";
import { PlainheaderComponent } from "../plainheader/plainheader.component";
import { AlertsComponent } from "../alerts/alerts.component";
import { AlertbuttonsComponent } from "../alertbuttons/alertbuttons.component";

@Component({
  selector: 'app-signin.page',
  standalone: true,
  imports: [  
    AlertbuttonsComponent, 
    PlainfooterComponent, 
    PlainheaderComponent, 
    SigninDetailComponent,
    AlertsComponent,
    AlertbuttonsComponent
  ],
  templateUrl: './signin.page.component.html',
  styleUrl: './signin.page.component.scss'
})
export class SigninPageComponent {

  pagename = 'Signin';

}
