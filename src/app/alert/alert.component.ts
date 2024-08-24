import { Component, Input } from '@angular/core';
import { MatTableModule } from '@angular/material/table';
import { ScrollingModule } from '@angular/cdk/scrolling';
import { FullheaderComponent } from "../fullheader/fullheader.component";
import { FullfooterComponent } from "../fullfooter/fullfooter.component";
import { MatCardModule } from '@angular/material/card';
import { MatListModule } from '@angular/material/list';
import { CommonModule } from '@angular/common';



@Component({
  selector: 'app-dump',
  standalone: true,
  imports: [
    MatTableModule,
    ScrollingModule,
    FullheaderComponent,
    FullfooterComponent,
    MatCardModule,
    MatListModule,
    CommonModule
  ],
  templateUrl: './alert.component.html',
  styleUrl: './alert.component.scss'
})
export class AlertComponent {

  // @Input() items: string[] = [];
  @Input() title?: string;

  pagename = "dump";

  items: string[] = [
    'Item 1',
    'Item 2',
    'Item 3',
    'Item 4',
    'Item 5',
    'Item 6',
    'Item 7',
    'Item 8',
    'Item 9',
    'Item 10',
    'Item 11',
    'Item 12'
  ];

}
