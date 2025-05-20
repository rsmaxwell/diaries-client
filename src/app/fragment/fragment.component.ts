import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Marquee } from '../model/marquee';
import { LiveObjectService } from '../mqtt/live.object.service';

@Component({
  selector: 'app-fragment',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './fragment.component.html',
  styleUrl: './fragment.component.scss'
})
export class FragmentComponent implements OnInit {
  fragment!: { marquee: Marquee, text: string };
  viewBoxString = '0 0 1000 1000';

  constructor(
    private route: ActivatedRoute,
    private liveObjectService: LiveObjectService
  ) {}

  ngOnInit() {
    const diaryId = Number(this.route.snapshot.paramMap.get('diaryId'));
    const pageId = Number(this.route.snapshot.paramMap.get('pageId'));
    const fragmentId = Number(this.route.snapshot.paramMap.get('fragmentId'));

    this.liveObjectService.getMarqueeById$(diaryId, pageId, fragmentId).subscribe(marquee => {
      this.fragment = {
        marquee,
        text: `Fragment content for marquee ${JSON.stringify(marquee)}` // Replace with actual content later
      };

      const r = marquee.rectangle;
      this.viewBoxString = `${r.x - 50} ${r.y - 50} ${r.width + 100} ${r.height + 100}`;
    });
  }


}
