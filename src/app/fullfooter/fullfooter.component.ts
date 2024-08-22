import { Component } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatToolbarModule } from '@angular/material/toolbar';
import { Router } from '@angular/router';

@Component({
  selector: 'app-fullfooter',
  standalone: true,
  imports: [MatToolbarModule, MatButtonModule, MatIconModule],
  templateUrl: './fullfooter.component.html',
  styleUrl: './fullfooter.component.scss'
})
export class FullfooterComponent {

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
    console.log('pages');
    this.router.navigate(['/pages']);
  }

}
