
import { ElementRef, ViewChild } from "@angular/core";
import { Marquee } from "../../model/marquee";
import { Rectangle } from "../../utilities/rectangle";
import { PageModeHandler } from "./pageModeHandler";

export class ViewModeHandler extends PageModeHandler {

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
        
        const viewBox = this.pageComponent.viewBox;
        const rect = this.pageComponent.svgRef.nativeElement.getBoundingClientRect();
        const scaleX = viewBox.width / rect.width;
        const scaleY = viewBox.height / rect.height;
        
        // Update viewBox position based on mouse movement
        viewBox.x -= dx * scaleX;
        viewBox.y -= dy * scaleY;
        
        // Save current mouse position for next move
        this.lastMouseX = event.clientX;
        this.lastMouseY = event.clientY;
    }

    onMouseUp(event: MouseEvent) {
        this.isDragging = false;
    }

    onWheel(event: WheelEvent) {
        event.preventDefault();
        const scaleFactor = (event.deltaY < 0) ? 0.9 : 1.1;
        const viewBox = this.pageComponent.viewBox;

        // Center point to zoom on
        const rect = this.pageComponent.svgRef.nativeElement.getBoundingClientRect();
        const svgX = (event.clientX - rect.left) * (viewBox.width / rect.width) + viewBox.x;
        const svgY = (event.clientY - rect.top) * (viewBox.height / rect.height) + viewBox.y;

        // Zoom logic
        viewBox.x = svgX - (svgX - viewBox.x) * scaleFactor;
        viewBox.y = svgY - (svgY - viewBox.y) * scaleFactor;
        viewBox.width *= scaleFactor;
        viewBox.height *= scaleFactor;
    }

    onClick(event: MouseEvent) { }
    onKeyDown(event: KeyboardEvent): void { }
    onSelectMarquee(marquee: Marquee): void { }
    onRightClick(event: MouseEvent): void { }
}
