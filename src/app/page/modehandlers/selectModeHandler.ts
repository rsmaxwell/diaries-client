
import { Marquee } from "../../model/marquee";
import { PageModeHandler } from "./pageModeHandler";

const margin = 30;

export class SelectModeHandler extends PageModeHandler {

    isDraggingLeft = false;
    isDraggingRight = false;
    isDraggingTop = false;
    isDraggingBottom = false;
    isDraggingAll = false;
    lastMouseX = 0;
    lastMouseY = 0;
    pendingCancel = false;

    onMouseDown(event: MouseEvent) {
        console.log(`SelectModeHandler: onMouseDown`);

        const point = this.getMousePosition(event)
        if (!point) return;

        this.lastMouseX = point.x;
        this.lastMouseY = point.y;

        this.calculateCursorStyle(event);

        if (!this.pageComponent.selectedMarqueeId) return
        const m = this.pageComponent.marquees.find(m => m.id === this.pageComponent.selectedMarqueeId);
        if (m == undefined) return;

        const bodyHorizontal = (m.rectangle.x < this.lastMouseX + margin) && (this.lastMouseX < m.rectangle.x + m.rectangle.width + margin);
        const bodyVertical = (m.rectangle.y < this.lastMouseY + margin) && (this.lastMouseY < m.rectangle.y + m.rectangle.height + margin);

        this.pendingCancel = true;
        if (!bodyHorizontal) return;
        if (!bodyVertical) return;
        this.pendingCancel = false;

        const left = Math.abs(m.rectangle.x - this.lastMouseX) < margin;
        const top = Math.abs(m.rectangle.y - this.lastMouseY) < margin;
        const right = Math.abs(m.rectangle.x + m.rectangle.width - this.lastMouseX) < margin;
        const bottom = Math.abs(m.rectangle.y + m.rectangle.height - this.lastMouseY) < margin;

        this.isDraggingLeft = left && bodyHorizontal;
        this.isDraggingTop = top && bodyVertical;
        this.isDraggingRight = right && bodyHorizontal;
        this.isDraggingBottom = bottom && bodyVertical;

        if (!(this.isDraggingLeft || this.isDraggingTop || this.isDraggingRight || this.isDraggingBottom)) {
            this.isDraggingAll = true
        }
        console.log(`SelectModeHandler: onMouseDown: dragging: ${this.isDraggingLeft},  ${this.isDraggingTop},  ${this.isDraggingRight},  ${this.isDraggingBottom},  ${this.isDraggingAll}`);
    }
    onSelectMarquee(marquee: Marquee): void {
        console.log(`SelectModeHandler.onSelectMarquee: marquee: ${JSON.stringify(marquee)}`);
        this.isDraggingLeft = false;
        this.isDraggingRight = false;
        this.isDraggingTop = false;
        this.isDraggingBottom = false;
        this.isDraggingAll = false
        this.pageComponent.setSelection(marquee);
    }
    onMouseUp(event: MouseEvent) {
        console.log(`SelectModeHandler.onMouseUp`);

        if (this.isDraggingLeft || this.isDraggingTop || this.isDraggingRight || this.isDraggingBottom || this.isDraggingAll) {
            console.log(`SelectModeHandler.onMouseUp: is Dragging: true`);
            const m = this.pageComponent.marquees.find(m => m.id === this.pageComponent.selectedMarqueeId);
            if (m) {
                console.log(`SelectModeHandler.onMouseUp: marquee: ${JSON.stringify(m)}`);
                this.pageComponent.updateMarquee(m);
            }
        }
        else {
            console.log(`SelectModeHandler.onMouseUp: is Dragging: false`);
        }

        this.isDraggingLeft = false;
        this.isDraggingRight = false;
        this.isDraggingTop = false;
        this.isDraggingBottom = false;
        this.isDraggingAll = false

        if (this.pendingCancel) {
            this.pendingCancel = false;
            this.pageComponent.cancelSelection();
        }
        console.log(`SelectModeHandler: onMouseUp: dragging: ${this.isDraggingLeft},  ${this.isDraggingTop},  ${this.isDraggingRight},  ${this.isDraggingBottom},  ${this.isDraggingAll}`);
    }
    onKeyDown(event: KeyboardEvent): void {
        if (event.key === 'Escape') {
            this.pageComponent.cancelSelection();
        }
        else if (event.key === 'Delete') {
            this.pageComponent.deleteSelection();
        }
    }
    onMouseMove(event: MouseEvent) {
        this.calculateCursorStyle(event);
        this.dragSelectedMarquee(event);
    }
    onRightClick(event: MouseEvent): void {
        event.preventDefault(); // Prevent browser context menu
        console.log(`SelectModeHandler.onRightClick`);
    }

    calculateCursorStyle(event: MouseEvent) {
        let cursor = 'default';

        if (this.pageComponent.selectedMarqueeId != null) {
            const m = this.pageComponent.marquees.find(m => m.id === this.pageComponent.selectedMarqueeId);
            if (m == undefined) return;

            let point = this.getMousePosition(event);
            if (point != null) {

                const bodyHorizontal = (m.rectangle.x < point.x + margin) && (point.x < m.rectangle.x + m.rectangle.width + margin);
                const bodyVertical = (m.rectangle.y < point.y + margin) && (point.y < m.rectangle.y + m.rectangle.height + margin);

                if (bodyHorizontal && bodyVertical) {

                    const left = Math.abs(m.rectangle.x - point.x) < margin;
                    const top = Math.abs(m.rectangle.y - point.y) < margin;
                    const right = Math.abs(m.rectangle.x + m.rectangle.width - point.x) < margin;
                    const bottom = Math.abs(m.rectangle.y + m.rectangle.height - point.y) < margin;


                    if ((left && top) || (right && bottom)) {
                        cursor = 'corner-1-resize';
                    } else if ((left && bottom) || (right && top)) {
                        cursor = 'corner-2-resize';
                    } else if (left || right) {
                        cursor = 'horizontal-resize';
                    } else if (top || bottom) {
                        cursor = 'vertical-resize';
                    } else {
                        cursor = 'move';
                    }
                }
            }
        }

        this.pageComponent.cursorStyle = cursor;
    }

    dragSelectedMarquee(event: MouseEvent) {
        if (!this.pageComponent.selectedMarqueeId) return;
        if (!(this.isDraggingLeft || this.isDraggingRight || this.isDraggingTop || this.isDraggingBottom || this.isDraggingAll)) return;

        let newMouse = this.getMousePosition(event);
        if (!newMouse) return;

        const dx = newMouse.x - this.lastMouseX;
        const dy = newMouse.y - this.lastMouseY;

        const m = this.pageComponent.marquees.find(m => m.id === this.pageComponent.selectedMarqueeId);
        if (m == undefined) return;

        if (this.isDraggingLeft) {
            m.rectangle.x += dx;
            m.rectangle.width -= dx;
        }
        if (this.isDraggingRight) {
            m.rectangle.width += dx;
        }
        if (this.isDraggingTop) {
            m.rectangle.y += dy;
            m.rectangle.height -= dy;
        }
        if (this.isDraggingBottom) {
            m.rectangle.height += dy;
        }
        if (this.isDraggingAll) {
            m.rectangle.x += dx;
            m.rectangle.y += dy;
        }

        // Flipping logic to handle negative width
        if (m.rectangle.width < 0) {
            // If we were dragging the left, now we should drag the right
            if (this.isDraggingLeft) {
                this.isDraggingLeft = false;
                this.isDraggingRight = true;
            } else if (this.isDraggingRight) {
                this.isDraggingRight = false;
                this.isDraggingLeft = true;
            }

            m.rectangle.x += m.rectangle.width;
            m.rectangle.width = Math.abs(m.rectangle.width);
            this.lastMouseX = newMouse.x;
            return;
        }

        // Flipping logic to handle negative height
        if (m.rectangle.height < 0) {

            // If we were dragging the top, now we should drag the bottom
            if (this.isDraggingTop) {
                this.isDraggingTop = false;
                this.isDraggingBottom = true;
            } else if (this.isDraggingBottom) {
                this.isDraggingBottom = false;
                this.isDraggingTop = true;
            }

            m.rectangle.y += m.rectangle.height;
            m.rectangle.height = Math.abs(m.rectangle.height);
            this.lastMouseY = newMouse.y;
            return;
        }

        // After applying, **update last mouse**
        this.lastMouseX = newMouse.x;
        this.lastMouseY = newMouse.y;
    }

    onClick(event: MouseEvent) { }
    onWheel(event: WheelEvent) { }
}
