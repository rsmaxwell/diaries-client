import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Fragment } from '../../model/fragment';

@Component({
  selector: 'app-text-panel',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './text-panel.component.html',
  styleUrls: ['./text-panel.component.scss']
})
export class TextPanelComponent {
  @Input() fragment?: Fragment;
}
