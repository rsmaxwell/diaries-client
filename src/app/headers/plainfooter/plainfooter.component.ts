import { Component } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatToolbarModule } from '@angular/material/toolbar';
import { AlertsComponent } from "../../alerts/alerts.component";
import { VersionInfoComponent } from "../../build-info/version-info.component";

@Component({
  selector: 'app-plainfooter',
  standalone: true,
  imports: [MatToolbarModule, MatButtonModule, MatIconModule, AlertsComponent, VersionInfoComponent],
  templateUrl: './plainfooter.component.html',
  styleUrl: './plainfooter.component.scss'
})
export class PlainfooterComponent {

}
