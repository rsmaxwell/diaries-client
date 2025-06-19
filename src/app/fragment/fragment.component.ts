// fragment.component.ts
import { Component, OnInit, ViewChild, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PageheaderComponent } from '../headers/pageheader/pageheader.component';
import { PagefooterComponent } from '../headers/pagefooter/pagefooter.component';
import { Fragment } from '../model/fragment';
import { GoldenLayout } from 'golden-layout';
import { ImageViewerComponent } from './image-viewer/image-viewer.component';
import { TextPanelComponent } from './text-panel/text-panel.component';
import { FragmentContextService } from './fragment-context.service';
import { Subject } from 'rxjs';



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
    private contextService: FragmentContextService
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

    const viewer = this.contextService.getImageViewerComponent();
    if (viewer) {
      viewer.onAddButtonClick();
    } else {
      console.warn('ImageViewerComponent not yet registered in context');
    }
  }

  onTitleChanged(title: string) {
    this.title = title;
  }

  onFragmentChanged(fragment: Fragment) {
    this.fragment = fragment;
  }
}
