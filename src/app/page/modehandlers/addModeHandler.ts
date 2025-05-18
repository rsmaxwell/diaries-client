
import { Marquee } from '../../model/marquee';
import { Point } from '../../utilities/point';
import { Rectangle } from '../../utilities/rectangle';
import { PageModeHandler } from './pageModeHandler';


export class AddModeHandler extends PageModeHandler {

    private start: Point | null = null;


    onMouseDown(event: MouseEvent) {
        this.start = this.getMousePosition(event);
    }
    onMouseMove(event: MouseEvent) {
        if (this.start != null) {
            let finish = this.getMousePosition(event);
            if (finish != null) {

                const x = Math.min(this.start.x, finish.x);
                const y = Math.min(this.start.y, finish.y);
                const width = Math.abs(finish.x - this.start.x);
                const height = Math.abs(finish.y - this.start.y);

                this.pageComponent.updateCurrentMarquee(new Rectangle(x, y, width, height));
            }
        }
    }
    onMouseUp(event: MouseEvent) {
        if (this.start != null) {
            let finish = this.getMousePosition(event);
            if (finish != null) {

                const x = Math.min(this.start.x, finish.x);
                const y = Math.min(this.start.y, finish.y);
                const width = Math.abs(finish.x - this.start.x);
                const height = Math.abs(finish.y - this.start.y);

                this.pageComponent.addNewMarquee(new Rectangle(x, y, width, height), 1);
                this.start = null;
            }
        }
    }

    onClick(event: MouseEvent) { }
    onWheel(event: WheelEvent) { }
    onKeyDown(event: KeyboardEvent): void { }
    onSelectMarquee(marquee: Marquee): void { }
}
