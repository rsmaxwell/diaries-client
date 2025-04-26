import { Fragment } from "../../model/fragment/fragment";
import { Point } from "../../utilities/point";
import { Rectangle } from "../../utilities/rectangle";
import { PageComponent } from "../page.component";
import { PageModeHandler } from "./pageModeHandler";

export class ViewModeHandler extends PageModeHandler {

    private viewBox = new Rectangle(0, 0, 0, 0);
    private lastMouseX = 0;
    private lastMouseY = 0;
    private isDragging = false;

    onMouseDown(event: MouseEvent) {
        this.isDragging = true;
        this.lastMouseX = event.clientX;
        this.lastMouseY = event.clientY;
    }

    onMouseMove(event: MouseEvent) {
        if (!this.isDragging) return;

        const dx = event.clientX - this.lastMouseX;
        const dy = event.clientY - this.lastMouseY;
        
        const rect = this.pageComponent.svg.getBoundingClientRect();
        const scaleX = this.viewBox.width / rect.width;
        const scaleY = this.viewBox.height / rect.height;
        
        // Update viewBox position based on mouse movement
        this.viewBox.x -= dx * scaleX;
        this.viewBox.y -= dy * scaleY;
        
        // Save current mouse position for next move
        this.lastMouseX = event.clientX;
        this.lastMouseY = event.clientY;
        
        // Now update the PageComponent's viewBox so Angular refreshes
        this.pageComponent.updateViewBox(this.viewBox);
    }

    onMouseUp(event: MouseEvent) {
        this.isDragging = false;
    }

    onWheel(event: WheelEvent) {
        console.log(`ViewModeHandler.onWheel: viewBox: ${this.pageComponent.viewBox.toString()}`);
        event.preventDefault();

        if (!this.pageComponent.svg || !this.viewBox) {
            console.warn('SVG element or viewBox is not initialized');
            return;
        }

        if (this.viewBox.width === 0 || this.viewBox.height === 0) {
            console.warn('ViewBox dimensions are zero. Skipping zoom.');
            return;
        }

        const scaleFactor = (event.deltaY < 0) ? 0.9 : 1.1;

        // Center point to zoom on
        const rect = this.pageComponent.svg.getBoundingClientRect();
        const svgX = (event.clientX - rect.left) * (this.viewBox.width / rect.width) + this.viewBox.x;
        const svgY = (event.clientY - rect.top) * (this.viewBox.height / rect.height) + this.viewBox.y;

        // Zoom logic
        this.viewBox.x = svgX - (svgX - this.viewBox.x) * scaleFactor;
        this.viewBox.y = svgY - (svgY - this.viewBox.y) * scaleFactor;
        this.viewBox.width *= scaleFactor;
        this.viewBox.height *= scaleFactor;

        console.log('Updated viewBox after zoom:', this.viewBox);

        // Update the PageComponent after zoom
        this.pageComponent.updateViewBox(this.viewBox);
    }

    onClick(event: MouseEvent) { }
    onKeyDown(event: KeyboardEvent): void { }
    onSelectFragment(fragment: Fragment): void { }

    
    setViewBox(viewBox: Rectangle) {
        this.viewBox = viewBox;
      }
}
