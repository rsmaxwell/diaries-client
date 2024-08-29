import { Component, Input } from '@angular/core';
import { FullheaderComponent } from "../fullheader/fullheader.component";
import { FullfooterComponent } from "../fullfooter/fullfooter.component";
import { AlertsComponent } from "../alerts/alerts.component";
import { AlertbuttonsComponent } from "../alertbuttons/alertbuttons.component";
import { MatSlideToggleModule } from '@angular/material/slide-toggle';

@Component({
  selector: 'app-pages',
  standalone: true,
  imports: [
    FullheaderComponent,
    FullfooterComponent,
    AlertsComponent,
    AlertbuttonsComponent,
    MatSlideToggleModule,
  ],
  templateUrl: './thing.component.html',
  styleUrl: './thing.component.scss'
})
export class ThingComponent {

  @Input() title?: string;
}
