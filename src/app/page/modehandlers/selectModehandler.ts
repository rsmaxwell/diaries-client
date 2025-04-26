import { Fragment } from "../../model/fragment/fragment";
import { Point } from "../../utilities/point";
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

        if (!this.pageComponent.selectedFragment) return
        const fragment = this.pageComponent.selectedFragment;
        // console.log(`SelectModeHandler: onMouseDown: selectedfragment: ${JSON.stringify(this.pageComponent.selectedFragment)}`);

        const bodyHorizontal = (fragment.x < this.lastMouseX + margin) && (this.lastMouseX < fragment.x + fragment.width + margin);
        const bodyVertical = (fragment.y < this.lastMouseY + margin) && (this.lastMouseY < fragment.y + fragment.height + margin);

        this.pendingCancel = true;
        if (!bodyHorizontal) return;
        if (!bodyVertical) return;
        this.pendingCancel = false;

        const left = Math.abs(fragment.x - this.lastMouseX) < margin;
        const top = Math.abs(fragment.y - this.lastMouseY) < margin;
        const right = Math.abs(fragment.x + fragment.width - this.lastMouseX) < margin;
        const bottom = Math.abs(fragment.y + fragment.height - this.lastMouseY) < margin;

        this.isDraggingLeft = left && bodyHorizontal;
        this.isDraggingTop = top && bodyVertical;
        this.isDraggingRight = right && bodyHorizontal;
        this.isDraggingBottom = bottom && bodyVertical;

        if (!(this.isDraggingLeft || this.isDraggingTop || this.isDraggingRight || this.isDraggingBottom)) {
            this.isDraggingAll = true
        }

        // console.log(`SelectModeHandler: onMouseDown: isDragging: left:${this.isDraggingLeft}, right:${this.isDraggingRight}, top:${this.isDraggingTop}, bottom:${this.isDraggingBottom}, move:${this.isDraggingAll}`);
    }
    onSelectFragment(fragment: Fragment): void {
        this.isDraggingLeft = false;
        this.isDraggingRight = false;
        this.isDraggingTop = false;
        this.isDraggingBottom = false;
        this.isDraggingAll = false
        this.pageComponent.setSelection(fragment);
    }
    onMouseUp(event: MouseEvent) {
        this.isDraggingLeft = false;
        this.isDraggingRight = false;
        this.isDraggingTop = false;
        this.isDraggingBottom = false;
        this.isDraggingAll = false

        if (this.pendingCancel) {
            this.pendingCancel = false;
            this.pageComponent.cancelSelection();
    }
    }
    onKeyDown(event: KeyboardEvent): void {
        if (event.key === 'Escape') {
            this.pageComponent.cancelSelection();
        }
    }
    onMouseMove(event: MouseEvent) {
        this.calculateCursorStyle(event);
        this.dragSelectedFragment(event);
    }

    calculateCursorStyle(event: MouseEvent) {
        let cursor = 'default';

        if (this.pageComponent.selectedFragment != null) {
            const fragment = this.pageComponent.selectedFragment;

            let point = this.getMousePosition(event);
            if (point != null) {

                const bodyHorizontal = (fragment.x < point.x + margin) && (point.x < fragment.x + fragment.width + margin);
                const bodyVertical = (fragment.y < point.y + margin) && (point.y < fragment.y + fragment.height + margin);

                if (bodyHorizontal && bodyVertical) {

                    const left = Math.abs(fragment.x - point.x) < margin;
                    const top = Math.abs(fragment.y - point.y) < margin;
                    const right = Math.abs(fragment.x + fragment.width - point.x) < margin;
                    const bottom = Math.abs(fragment.y + fragment.height - point.y) < margin;


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

        this.pageComponent.style = cursor;
    }

    dragSelectedFragment(event: MouseEvent) {
        if (!this.pageComponent.selectedFragment) return;
        if (!(this.isDraggingLeft || this.isDraggingRight || this.isDraggingTop || this.isDraggingBottom || this.isDraggingAll)) return;

        let newMouse = this.getMousePosition(event);
        if (!newMouse) return;

        const dx = newMouse.x - this.lastMouseX;
        const dy = newMouse.y - this.lastMouseY;

        const fragment = this.pageComponent.selectedFragment;
        if (this.isDraggingLeft) {
            fragment.x += dx;
            fragment.width -= dx;
        }
        if (this.isDraggingRight) {
            fragment.width += dx;
        }
        if (this.isDraggingTop) {
            fragment.y += dy;
            fragment.height -= dy;
        }
        if (this.isDraggingBottom) {
            fragment.height += dy;
        }
        if (this.isDraggingAll) {
            fragment.x += dx;
            fragment.y += dy;
        }

        // Flipping logic to handle negative width
        if (this.pageComponent.selectedFragment.width < 0) {
            // If we were dragging the left, now we should drag the right
            if (this.isDraggingLeft) {
                this.isDraggingLeft = false;
                this.isDraggingRight = true;
            } else if (this.isDraggingRight) {
                this.isDraggingRight = false;
                this.isDraggingLeft = true;
            }

            fragment.x += fragment.width;
            fragment.width = Math.abs(fragment.width);
            this.lastMouseX = newMouse.x;
            return;
        }

        // Flipping logic to handle negative height
        if (this.pageComponent.selectedFragment.height < 0) {

            // If we were dragging the top, now we should drag the bottom
            if (this.isDraggingTop) {
                this.isDraggingTop = false;
                this.isDraggingBottom = true;
            } else if (this.isDraggingBottom) {
                this.isDraggingBottom = false;
                this.isDraggingTop = true;
            }

            fragment.y += fragment.height;
            fragment.height = Math.abs(fragment.height);
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
