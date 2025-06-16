// fragment.component.ts
import { ChangeDetectorRef, Component, HostListener, ElementRef, OnInit, ViewChild, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ConfigService } from '../config/config.service';
import { LiveObjectService } from '../mqtt/live.object.service';
import { Rectangle } from '../utilities/rectangle';
import { Marquee } from '../model/marquee';
import { CommonModule } from '@angular/common';
import { combineLatest, from, Subject, takeUntil } from 'rxjs';
import { Diary } from '../model/diary';
import { Page } from '../model/page';
import { Point } from '../utilities/point';
import { PageheaderComponent } from '../headers/pageheader/pageheader.component';
import { PagefooterComponent } from '../headers/pagefooter/pagefooter.component';
import { LiveObjectListService } from '../mqtt/live.object.list.service';
import { Fragment } from '../model/fragment';
import { RpcService } from '../mqtt/rpc.service';
import { AlertService } from '../alerts/alert.service';
import { GoldenLayout } from 'golden-layout';
import { ImageViewerComponent } from './image-viewer/image-viewer.component';
import { TextPanelComponent } from './text-panel/text-panel.component';



@Component({
  selector: 'app-fragment',
  standalone: true,
  imports: [
    CommonModule,
    PageheaderComponent,
    PagefooterComponent,
    ImageViewerComponent,
    TextPanelComponent
  ],
  templateUrl: './fragment.component.html',
  styleUrls: ['./fragment.component.scss']
})
export class FragmentComponent implements OnInit, OnDestroy {

  @ViewChild('svgContainerRef') svgContainerRef!: ElementRef<SVGSVGElement>;
  svgRef!: ElementRef<SVGSVGElement>;

  @ViewChild(ImageViewerComponent)
  imageViewerComponent!: ImageViewerComponent;

  title = 'Fragment';

  private destroy$ = new Subject<void>();

  windowWidth = window.innerWidth;
  windowHeight = window.innerHeight;


  fragment?: Fragment;
  imageUrl = '';
  width = 0;
  height = 0;



  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private rpcService: RpcService,
    private alertService: AlertService,
    private configService: ConfigService,
    private liveObjectService: LiveObjectService,
    private liveObjectListService: LiveObjectListService,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit(): void {
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onBackPressed() {
    console.log(`FragmentComponent.onBackPressed`);
  }

  onUpPressed() {
    console.log('FragmentComponent: Up pressed');
  }

  onForwardPressed() {
    console.log('FragmentComponent: Forward pressed');
  }

  onAddButtonClick() {
    console.log(`FragmentComponent.onAddButtonClick`);

    if (this.imageViewerComponent) {
      this.imageViewerComponent.onAddButtonClick();
    } else {
      console.warn('ImageViewerComponent not yet initialized');
    }
  }

  onTitleChanged(title: string) {
    this.title = title;
  }

  onFragmentChanged(fragment: Fragment) {
    this.fragment = fragment;
  }
}
