import { Component, Input } from '@angular/core';
import { FullheaderComponent } from "../fullheader/fullheader.component";
import { FullfooterComponent } from "../fullfooter/fullfooter.component";
import { AlertsComponent } from "../alerts/alerts.component";
import { AlertbuttonsComponent } from "../alertbuttons/alertbuttons.component";

@Component({
  selector: 'app-pages',
  standalone: true,
  imports: [
    FullheaderComponent,
    FullfooterComponent,
    AlertsComponent,
    AlertbuttonsComponent
  ],
  templateUrl: './pages.component.html',
  styleUrl: './pages.component.scss'
})
export class PagesComponent {

  @Input() title?: string;
}
