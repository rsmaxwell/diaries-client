import { Component } from '@angular/core';
import { FullheaderComponent } from "../fullheader/fullheader.component";
import { FullfooterComponent } from "../fullfooter/fullfooter.component";
import { AlertpanelComponent } from "../alertpanel/alertpanel.component";
import { AlertbuttonsComponent } from "../alertbuttons/alertbuttons.component";

@Component({
  selector: 'app-pages',
  standalone: true,
  imports: [
    FullheaderComponent,
    FullfooterComponent,
    AlertpanelComponent,
    AlertbuttonsComponent
  ],
  templateUrl: './pages.component.html',
  styleUrl: './pages.component.scss'
})
export class PagesComponent {

  pagename = 'Signin';
}
