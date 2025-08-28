import { Component, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AccessTokenService } from './user/token/accessTokenService';
import { RefreshTokenService } from './user/token/refreshTokenService';
import { TokenRequestor } from './user/tokenRequestor';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    RouterOutlet,
    RouterOutlet
],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent implements OnInit {
  constructor(
    private accessToken: AccessTokenService,
    private refreshToken: RefreshTokenService
  ) {}

  ngOnInit() {
    const token = this.accessToken.getCurrentToken();
    const refreshToken = this.refreshToken.getCurrentToken();
  }
}
