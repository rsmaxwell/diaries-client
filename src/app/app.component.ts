import { Component, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AccessTokenService } from './user/token/AccessTokenService';
import { RefreshTokenService } from './user/token/RefreshTokenService';
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
    private refreshToken: RefreshTokenService,
    private tokenRequestor: TokenRequestor
  ) {}

  ngOnInit() {
    const token = this.accessToken.getCurrentToken();
    const refreshToken = this.refreshToken.getCurrentToken();
    if (token && refreshToken) {
      const defaultRefreshInterval = 10; // or derive this dynamically if needed
      console.log("AppComponent: starting TokenRequestor");
      this.tokenRequestor.start(defaultRefreshInterval);
    }
  }
}
