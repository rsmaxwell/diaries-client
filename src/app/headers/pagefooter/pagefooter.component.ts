import { Component, EventEmitter, Output } from '@angular/core';
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

  @Output() back = new EventEmitter<void>();
  @Output() up = new EventEmitter<void>();
  @Output() forward = new EventEmitter<void>();

  constructor(
    private router: Router,
  ) {}

  home() {
    this.router.navigate(['/']);
  }

  diaries() {
    this.router.navigate(['/diaries']);
  }

  pages() {
    this.router.navigate(['/thing']);
  }

  onBackClick() {
    this.back.emit();
  }

  onUpClick() {
    this.up.emit();
  }

  onForwardClick() {
    this.forward.emit();
  }
}
