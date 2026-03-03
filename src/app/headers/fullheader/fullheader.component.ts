import { Component, Input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatToolbarModule } from '@angular/material/toolbar';
import { combineLatest, map, Observable } from 'rxjs';
import { AccessTokenService } from '../../user/token/accessTokenService';
import { AsyncPipe } from '@angular/common';

@Component({
  selector: 'app-fullheader',
  standalone: true,
  imports: [MatToolbarModule, MatButtonModule, MatIconModule, AsyncPipe],
  templateUrl: './fullheader.component.html',
  styleUrl: './fullheader.component.scss'
})
export class FullHeaderComponent {

  @Input() title?: string | null;

  constructor() { }
}