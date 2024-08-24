import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { PagesComponent } from './pages/pages.component';
import { DiariesComponent } from './diaries/diaries.component';
import { AlertComponent } from './alert/alert.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    RouterOutlet,
    DiariesComponent,
    PagesComponent,
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    AlertComponent
],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {

  title = 'Diaries';
  
}
