
import { Fragment } from "../../model/fragment/fragment";
import { Point } from "../../utilities/point";
import { PageComponent } from "../page.component";




// interface for handler
export abstract class PageModeHandler {

    constructor(
        protected pageComponent: PageComponent
    ) {}

    abstract onClick(event: MouseEvent): void;
    abstract onMouseMove(event: MouseEvent): void;
    abstract onMouseUp(event: MouseEvent): void;
    abstract onMouseDown(event: MouseEvent): void;
    abstract onWheel(event: WheelEvent): void;
    abstract onKeyDown(event: KeyboardEvent): void;
    abstract onSelectFragment(fragment: Fragment): void;

    getMousePosition(event: MouseEvent): Point | null {
        const svg = this.pageComponent.svg as SVGSVGElement; 
        const pt = svg.createSVGPoint();
        pt.x = event.clientX;
        pt.y = event.clientY;

        // Transform to SVG user coordinates
        const transformedPoint = pt.matrixTransform(svg.getScreenCTM()?.inverse());
        return new Point(transformedPoint.x, transformedPoint.y);
    }
}


