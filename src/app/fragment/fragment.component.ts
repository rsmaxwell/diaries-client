import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Marquee } from '../model/marquee';
import { LiveObjectService } from '../mqtt/live.object.service';
import { FullheaderComponent } from '../headers/fullheader/fullheader.component';
import { FullfooterComponent } from '../headers/fullfooter/fullfooter.component';
import { Page } from '../model/page';
import { Config, ConfigService } from '../config/config.service';
import { combineLatest, filter, forkJoin, from, Observable, take, tap } from 'rxjs';
import { Diary } from '../model/diary';
import { Fragment } from '../model/fragment';
import { Rectangle } from '../utilities/rectangle';

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

  fragment!: Fragment;
  viewBoxString = '0 0 0 0';
  imageUrl: string = "";
  x = 0;
  y = 0;
  width = 0;
  height = 0;

  config$: Observable<Config> | null = null;
  diary$: Observable<Diary> | null = null;
  page$: Observable<Page> | null = null;
  marquee$: Observable<Marquee> | null = null;

  constructor(
    private route: ActivatedRoute,
    private liveObjectService: LiveObjectService,
    private configService: ConfigService
  ) { }

  ngOnInit() {
    const diaryId = Number(this.route.snapshot.paramMap.get('diaryId'));
    const pageId = Number(this.route.snapshot.paramMap.get('pageId'));
    const fragmentId = Number(this.route.snapshot.paramMap.get('fragmentId'));

    combineLatest([

      this.config$ = from(this.configService.getConfig()),
      this.diary$ = this.liveObjectService.getDiaryById$(diaryId),
      this.page$ = this.liveObjectService.getPageById$(diaryId, pageId),
      this.marquee$ = this.liveObjectService.getMarqueeById$(diaryId, pageId, fragmentId)

    ]).subscribe(([config, diary, page, marquee]) => {

        this.fragment = {
          id: 1,
          year: 2024,
          month: 5,
          day: 20,
          sequence: 100,
          marquee: marquee,
          text: 'This is a fragment of text.\nIt can span multiple lines.'
        };

        this.fragment.text = `marquee\n${JSON.stringify(marquee, null, 2)}\n\npage\n${JSON.stringify(page, null, 2)}\n\nconfig\n${JSON.stringify(config, null, 2)}`

        const r = new Rectangle(0, 0, page.width, page.height);
        this.viewBoxString = `${r.x - 50} ${r.y - 50} ${r.width + 100} ${r.height + 100}`;
        this.imageUrl = `${config.fileServerUrl}/${diary.name}/${page.name}${page.extension}`
        this.width = page.width;
        this.height = page.height;
      });
    }

    onWheel(event: WheelEvent) {}
    onMouseMove(event: MouseEvent) {}
    onMouseDown(event: MouseEvent) {}
    onMouseUp(event: MouseEvent) {}
    onRightClick(e: MouseEvent) {}
  }
