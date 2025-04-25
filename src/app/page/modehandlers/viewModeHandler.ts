import { Fragment } from "../../model/fragment/fragment";
import { Point } from "../../utilities/point";
import { Rectangle } from "../../utilities/rectangle";
import { PageComponent } from "../page.component";
import { PageModeHandler } from "./pageModeHandler";

export class ViewModeHandler extends PageModeHandler {

    private viewBox;
    private start = new Point(0, 0);
    private isPanning = false;

    constructor(
        pageConponent: PageComponent,
        svg: SVGSVGElement
    ) {
        super(pageConponent, svg);

        this.viewBox = new Rectangle(0, 0, this.pageComponent.page.width, this.pageComponent.page.height);
        
        console.log(`ViewModeHandler.constructor: this.viewBox: ${this.viewBox}, this.viewBox.toString(): ${this.viewBox.toString()}`);
        this.pageComponent.setViewBox(this.viewBox.toString());
    }

    onMouseDown(event: MouseEvent) {
        this.isPanning = true;
        this.start = new Point(event.clientX, event.clientY);
    }

    onMouseMove(event: MouseEvent) {
        if (!this.isPanning) return;

        const dx = (event.clientX - this.start.x) * (this.viewBox.width / this.svg.clientWidth);
        const dy = (event.clientY - this.start.y) * (this.viewBox.height / this.svg.clientHeight);

        this.viewBox.x -= dx;
        this.viewBox.y -= dy;

        console.log("ViewModeHandler.onMouseMove");
        this.pageComponent.setViewBox(this.viewBox.toString());
        this.start = { x: event.clientX, y: event.clientY };
    }

    onMouseUp(event: MouseEvent) {
        this.isPanning = false;
    }

    onWheel(event: WheelEvent) {
        console.log("ViewModeHandler.onWheel");
        event.preventDefault();
        const zoomFactor = 1.1;
        const direction = event.deltaY < 0 ? 1 / zoomFactor : zoomFactor;

        const newW = this.viewBox.width * direction;
        const newH = this.viewBox.height * direction;
        const dx = (event.offsetX / this.svg.clientWidth) * (this.viewBox.width - newW);
        const dy = (event.offsetY / this.svg.clientHeight) * (this.viewBox.height - newH);

        this.viewBox = new Rectangle(this.viewBox.x + dx, this.viewBox.y + dy, newW, newH);
        console.log("ViewModeHandler.onWheel");
        this.pageComponent.setViewBox(this.viewBox.toString());
    }

    onClick(event: MouseEvent) { }
    onKeyDown(event: KeyboardEvent): void { }
    onSelectFragment(fragment: Fragment): void { }
}
