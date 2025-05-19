import { CommonModule } from '@angular/common';
import { Component, Input, OnInit } from '@angular/core';
import { Marquee } from '../model/marquee';

@Component({
  selector: 'app-fragment',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './fragment.component.html',
  styleUrl: './fragment.component.scss'
})
export class FragmentComponent implements OnInit {

  @Input() fragment!: { marquee: Marquee, text: string };
  viewBoxString = '0 0 1000 1000'; // update based on page/marquee

  ngOnInit() {
    if (this.fragment) {
      const r = this.fragment.marquee.rectangle;
      this.viewBoxString = `${r.x - 50} ${r.y - 50} ${r.width + 100} ${r.height + 100}`;
    }
  }
}
