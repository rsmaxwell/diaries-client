import { Component } from '@angular/core';
import { SigninDetailComponent } from "../signin.detail/signin.detail.component";
import { PlainfooterComponent } from "../plainfooter/plainfooter.component";
import { PlainheaderComponent } from "../plainheader/plainheader.component";
import { AlertpanelComponent } from "../alertpanel/alertpanel.component";
import { AlertbuttonsComponent } from "../alertbuttons/alertbuttons.component";

@Component({
  selector: 'app-signin.page',
  standalone: true,
  imports: [ 
    AlertpanelComponent, 
    AlertbuttonsComponent, 
    PlainfooterComponent, 
    PlainheaderComponent, 
    SigninDetailComponent,
    AlertpanelComponent,
    AlertbuttonsComponent
  ],
  templateUrl: './signin.page.component.html',
  styleUrl: './signin.page.component.scss'
})
export class SigninPageComponent {

  pagename = 'Signin';

}
