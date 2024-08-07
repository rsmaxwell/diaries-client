import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { PagesComponent } from './pages/pages.component';
import { DiariesComponent } from './diaries/diaries.component';
import { MessagesComponent } from "./messages/messages.component";

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    RouterOutlet, 
    DiariesComponent, 
    PagesComponent, 
    MessagesComponent, 
    RouterOutlet, 
    RouterLink, 
    RouterLinkActive],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  title = 'diaries';
}
