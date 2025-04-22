import { PageModeHandler } from "./pageModeHandler";

export class ViewModeHandler extends PageModeHandler {

    private viewBox = { x: 0, y: 0, w: 0, h: 0 };
    private isPanning = false;
    private start = { x: 0, y: 0 };

    constructor(
        svg: SVGSVGElement,
        private x: number,
        private y: number,
        private w: number,
        private h: number
    ) {
        super(svg);
        this.viewBox = { x: x, y: y, w: w, h: h };
    }

    onClick(event: MouseEvent) {
    }

    onMouseMove(event: MouseEvent) {
        if (!this.isPanning) return;

        const dx = (event.clientX - this.start.x) * (this.viewBox.w / this.svg.clientWidth);
        const dy = (event.clientY - this.start.y) * (this.viewBox.h / this.svg.clientHeight);

        this.viewBox.x -= dx;
        this.viewBox.y -= dy;

        // this.page.viewBox = `${this.viewBox.x} ${this.viewBox.y} ${this.viewBox.w} ${this.viewBox.h}`;
        this.start = { x: event.clientX, y: event.clientY };
    }

    onMouseUp(event: MouseEvent) {
        this.isPanning = false;
    }

    onMouseDown(event: MouseEvent) {
        this.isPanning = true;
        this.start = { x: event.clientX, y: event.clientY };
    }

    onWheel(event: WheelEvent) {
        event.preventDefault();
        const zoomFactor = 1.1;
        const direction = event.deltaY < 0 ? 1 / zoomFactor : zoomFactor;

        const newW = this.viewBox.w * direction;
        const newH = this.viewBox.h * direction;
        const dx = (event.offsetX / this.svg.clientWidth) * (this.viewBox.w - newW);
        const dy = (event.offsetY / this.svg.clientHeight) * (this.viewBox.h - newH);

        this.viewBox = {
            x: this.viewBox.x + dx,
            y: this.viewBox.y + dy,
            w: newW,
            h: newH
        };

        // this.page.viewBox = `${this.viewBox.x} ${this.viewBox.y} ${this.viewBox.w} ${this.viewBox.h}`;
    }

    override hasViewBox(): boolean { return true; }
    override getViewBox(): string {
        return `${this.viewBox.x} ${this.viewBox.y} ${this.viewBox.w} ${this.viewBox.h}`;
    }
}