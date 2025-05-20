import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Marquee } from '../model/marquee';
import { LiveObjectService } from '../mqtt/live.object.service';
import { FullheaderComponent } from '../headers/fullheader/fullheader.component';
import { FullfooterComponent } from '../headers/fullfooter/fullfooter.component';
import { Page } from '../model/page';
import { ConfigService } from '../config/config.service';
import { forkJoin, from, take } from 'rxjs';

@Component({
  selector: 'app-fragment',
  standalone: true,
  imports: [
    CommonModule,
    CommonModule,
    FullheaderComponent,
    FullfooterComponent,
  ],
  templateUrl: './fragment.component.html',
  styleUrl: './fragment.component.scss'
})
export class FragmentComponent implements OnInit {

  title = 'Fragment';

  fragment!: { marquee: Marquee, text: string };
  viewBoxString = '0 0 1000 1000';

  constructor(
    private route: ActivatedRoute,
    private liveObjectService: LiveObjectService,
    private configService: ConfigService
  ) { }

  ngOnInit() {
    const diaryId = Number(this.route.snapshot.paramMap.get('diaryId'));
    const pageId = Number(this.route.snapshot.paramMap.get('pageId'));
    const fragmentId = Number(this.route.snapshot.paramMap.get('fragmentId'));

    forkJoin({
      config: from(this.configService.getConfig()),
      page: this.liveObjectService.getPageById$(diaryId, pageId).pipe(take(1)),
      marquee: this.liveObjectService.getMarqueeById$(diaryId, pageId, fragmentId).pipe(take(1))
    }).subscribe({
      next: ({ config, page, marquee }) => {
        console.log(`FragmentComponent.ngOnInit: next`);
        this.fragment = {
          marquee,
          text: `marquee\n${JSON.stringify(marquee, null, 2)}\n\npage\n${JSON.stringify(page, null, 2)}\n\nconfig\n${JSON.stringify(config, null, 2)}`
        };

        const r = marquee.rectangle;
        this.viewBoxString = `${r.x - 50} ${r.y - 50} ${r.width + 100} ${r.height + 100}`;
      },
      error: (err) => {
        console.log(`FragmentComponent.ngOnInit: error: ${err}`);
      },
      complete: () => {
        console.log(`FragmentComponent.ngOnInit: complete`);
      }
    });
  }
}
