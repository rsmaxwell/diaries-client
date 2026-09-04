import { Page } from '../../model/page';
import { Marquee } from '../../model/marquee';
import { Rectangle } from '../../utilities/rectangle';
import { ImageViewerComponent } from './image-viewer.component';

describe('ImageViewerComponent source heading', () => {
  function createComponent(): ImageViewerComponent {
    return new ImageViewerComponent(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any
    );
  }

  it('uses the selected page name without the file extension', () => {
    const component = createComponent();
    (component as any).page = new Page(3, 1, 'img2357', '.jpg', 1200, 1800, 1000, 1);

    expect(component.sourceName).toBe('img2357');
  });

  it('provides a useful fallback before the page is available', () => {
    expect(createComponent().sourceName).toBe('Source page');
  });

  it('zooms around the centre of the source page and can restore the page fit', () => {
    const component = createComponent();
    (component as any).page = new Page(3, 1, 'img2357', '.jpg', 1200, 1800, 1000, 1);

    component.zoomIn();
    expect(component.transformStyle).toBe('translate(-120, -180) scale(1.2)');

    component.fitPage();
    expect(component.transformStyle).toBe('translate(0, 0) scale(1)');
  });

  it('fits the selected marquee centrally with some surrounding context', () => {
    const component = createComponent();
    (component as any).page = new Page(3, 1, 'img2357', '.jpg', 1200, 1800, 1000, 1);
    component.marquee = new Marquee(7, 1, 11, 3, new Rectangle(100, 200, 400, 300));

    component.fitSelection();

    expect(component.transformStyle).toBe('translate(-210, -45) scale(2.7)');
  });

  it('toggles between focus and highlight marquee presentation', () => {
    const component = createComponent();

    expect(component.marqueeDisplayMode).toBe('focus');
    component.toggleMarqueeDisplayMode();
    expect(component.marqueeDisplayMode).toBe('highlight');
    component.toggleMarqueeDisplayMode();
    expect(component.marqueeDisplayMode).toBe('focus');
  });
});
