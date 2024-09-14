
  import { Component } from '@angular/core';
  import { MatIconModule } from '@angular/material/icon';
  import { MatButtonModule } from '@angular/material/button';
  import { MatToolbarModule } from '@angular/material/toolbar';
  
  @Component({
    selector: 'app-plainheader',
    standalone: true,
    imports: [MatToolbarModule, MatButtonModule, MatIconModule],
    templateUrl: './plainheader.component.html',
    styleUrl: './plainheader.component.scss'
  })
  export class PlainheaderComponent {
  
  }
  
