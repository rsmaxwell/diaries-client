import { Component, Input } from '@angular/core';
import { FullHeaderComponent } from "../headers/fullheader/fullheader.component";
import { FullfooterComponent } from "../headers/fullfooter/fullfooter.component";
import { AlertsComponent } from "../alerts/alerts.component";
import { AlertbuttonsComponent } from "../alertbuttons/alertbuttons.component";
import { MatSlideToggleModule } from '@angular/material/slide-toggle';

@Component({
  selector: 'app-thing',
  standalone: true,
  imports: [
    FullHeaderComponent,
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
