import { Component } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatToolbarModule } from '@angular/material/toolbar';
import { Router } from '@angular/router';
import { AlertsComponent } from "../../alerts/alerts.component";

@Component({
  selector: 'app-fullfooter',
  standalone: true,
  imports: [MatToolbarModule, MatButtonModule, MatIconModule, AlertsComponent],
  templateUrl: './fullfooter.component.html',
  styleUrl: './fullfooter.component.scss'
})
export class FullfooterComponent {

  constructor(
    private router: Router,
  ) {}

  home() {
    console.log('FullfooterComponent.home');
    this.router.navigate(['/']);
  }

  diaries() {
    console.log('FullfooterComponent.diaries');
    this.router.navigate(['/diaries']);
  }

  pages() {
    console.log('FullfooterComponent.thing');
    this.router.navigate(['/thing']);
  }

}
