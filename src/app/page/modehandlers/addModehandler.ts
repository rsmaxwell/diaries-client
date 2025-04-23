import { Point } from '../../utilities/point';
import { Rectangle } from '../../utilities/rectangle';
import { PageModeHandler } from './pageModeHandler';


export class AddModeHandler extends PageModeHandler {

    private start: Point | null = null;
    private rectangle: Rectangle = new Rectangle(0, 0, 0, 0);
    private inProgress: boolean = false;

    onClick(event: MouseEvent) {
        console.log('Adding');
    }
    onMouseMove(event: MouseEvent) {
        if (this.start != null) {
            let point = this.getMousePosition(event);
            if (point != null) {
                console.log('finish: ', point.x, point.y);
                let finish = point;

                const x = Math.min(this.start.x, finish.x);
                const y = Math.min(this.start.y, finish.y);
                const width = Math.abs(finish.x - this.start.x);
                const height = Math.abs(finish.y - this.start.y);
                this.rectangle = new Rectangle(x, y, width, height);
            }
        }
    }
    onMouseDown(event: MouseEvent) {
        let point = this.getMousePosition(event);
        if (point != null) {
            console.log('start:  ', point.x, point.y);
            this.start = point;
            this.inProgress = true;
        }
    }
    onMouseUp(event: MouseEvent) {
        if (this.start != null) {
            let point = this.getMousePosition(event);
            if (point != null) {
                console.log('finish: ', point.x, point.y);
                let finish = point;

                const x = Math.min(this.start.x, finish.x);
                const y = Math.min(this.start.y, finish.y);
                const width = Math.abs(finish.x - this.start.x);
                const height = Math.abs(finish.y - this.start.y);
                this.rectangle = new Rectangle(x, y, width, height);
                this.start = null;
                this.inProgress = false;
            }
        }
    }
    onWheel(event: WheelEvent) {
        // Handle view mode mouse move
    }

    getMousePosition(event: MouseEvent): Point | null {

        const svg = event.target instanceof SVGElement
            ? event.target.ownerSVGElement
            : (event.target as Element).closest('svg');

        if (!svg) return null;

        const pt = svg.createSVGPoint();
        pt.x = event.clientX;
        pt.y = event.clientY;

        // Transform to SVG user coordinates
        const transformedPoint = pt.matrixTransform(svg.getScreenCTM()?.inverse());
        return new Point(transformedPoint.x, transformedPoint.y);
    }

    override hasRectangleInProgress(): boolean { 
        if (this.inProgress) {
            return true;
        } else {
            return false;
        }
    }

    override hasRectangleComplete(): boolean { 
        return true;
    }

    override getRectangle(): Rectangle {
        return this.rectangle;
    }
}
