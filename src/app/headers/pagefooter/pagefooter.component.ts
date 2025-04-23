import { Component } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatToolbarModule } from '@angular/material/toolbar';
import { Router } from '@angular/router';
import { AlertsComponent } from "../../alerts/alerts.component";

@Component({
  selector: 'app-pagefooter',
  standalone: true,
  imports: [
    MatToolbarModule, 
    MatButtonModule, 
    MatIconModule, 
    AlertsComponent
  ],
  templateUrl: './pagefooter.component.html',
  styleUrl: './pagefooter.component.scss'
})
export class PagefooterComponent {

  constructor(
    private router: Router,
  ) {}

  home() {
    console.log('Home');
    this.router.navigate(['/']);
  }

  diaries() {
    console.log('diaries');
    this.router.navigate(['/diaries']);
  }

  pages() {
    console.log('thing');
    this.router.navigate(['/thing']);
  }

  onBackClick() {
    console.log('Back button clicked');
  }

  onUpClick() {
    console.log('Up button clicked');
  }

  onForwardClick() {
    console.log('Forward button clicked');
  }
}
