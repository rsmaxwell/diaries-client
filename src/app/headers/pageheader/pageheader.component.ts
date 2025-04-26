
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { MatIconModule, MatIconRegistry } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatToolbarModule } from '@angular/material/toolbar';
import { DomSanitizer } from '@angular/platform-browser';

@Component({
  selector: 'app-pageheader',
  standalone: true,
  imports: [
    MatToolbarModule,
    MatButtonModule,
    MatIconModule
  ],
  templateUrl: './pageheader.component.html',
  styleUrl: './pageheader.component.scss'
})
export class PageheaderComponent {


  @Input() title: string | null = '';
  @Output() add = new EventEmitter<void>();
  @Output() view = new EventEmitter<void>();
  @Output() select = new EventEmitter<void>();

  constructor(
    private iconRegistry: MatIconRegistry,
    private sanitizer: DomSanitizer
  ) {
    this.iconRegistry.addSvgIcon('hand-pointer', this.sanitizer.bypassSecurityTrustResourceUrl('assets/icons/hand-pointer.svg'));
    this.iconRegistry.addSvgIcon('select', this.sanitizer.bypassSecurityTrustResourceUrl('assets/icons/select.svg'));    
    this.iconRegistry.addSvgIcon('cross', this.sanitizer.bypassSecurityTrustResourceUrl('assets/icons/cross.svg')); 
  }

  onMenuClick() {
    console.log('Menu button clicked');
  }

  onViewClick() {
    console.log('View button clicked');
    this.view.emit();
  }

  onSelectClick() {
    console.log('Select button clicked');
    this.select.emit();
  }

  onAddClick() {
    console.log('Add button clicked');
    this.add.emit();
  }
}

