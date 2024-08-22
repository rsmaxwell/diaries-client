
  import { Component } from '@angular/core';
  import { MatIconModule } from '@angular/material/icon';
  import { MatButtonModule } from '@angular/material/button';
  import { MatToolbarModule } from '@angular/material/toolbar';
  
  @Component({
    selector: 'app-fullheader',
    standalone: true,
    imports: [MatToolbarModule, MatButtonModule, MatIconModule],
    templateUrl: './fullheader.component.html',
    styleUrl: './fullheader.component.scss'
  })
  export class FullheaderComponent {
  
  }
  
