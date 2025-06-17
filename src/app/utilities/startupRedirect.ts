import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AccessTokenService } from '../user/token/accessTokenService';

@Component({
  selector: 'app-startup-redirect',
  standalone: true,
  template: '', // or show a spinner/loading message if you prefer
})
export class StartupRedirectComponent implements OnInit {
  constructor(
    private tokenService: AccessTokenService, 
    private router: Router
) {}

  ngOnInit() {
    const token = this.tokenService.getCurrentToken();
    if (token) {
      this.router.navigate(['/diaries']);
    } else {
      this.router.navigate(['/signin']);
    }
  }
}
