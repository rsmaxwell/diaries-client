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

        // console.log(`SelectModeHandler: onMouseDown: fragment.x: ${fragment.x}`);
        // console.log(`SelectModeHandler: onMouseDown: lastMouseX: ${this.lastMouseX}, margin: ${margin} --> ${this.lastMouseX + margin}`);
        // console.log(`SelectModeHandler: onMouseDown: lastMouseX: ${this.lastMouseX}`);
        // console.log(`SelectModeHandler: onMouseDown: fragment.x: ${fragment.x}, fragment.width: ${fragment.width}, margin: ${margin} --> ${this.lastMouseX + fragment.width + margin}`);
        // console.log(`SelectModeHandler: onMouseDown: bodyHorizontal: ${bodyHorizontal}`);

        if (!bodyHorizontal) return;
        // console.log(`SelectModeHandler: onMouseDown: bodyHorizontal`);
        if (!bodyVertical) return;
        // console.log(`SelectModeHandler: onMouseDown: bodyVertical`);

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
        // this.pageComponent.cancelSelection();
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
                    } else  {
                        cursor = 'move';
                    }
                }
            }
        }

        this.pageComponent.style = cursor;
    }

    dragSelectedFragment(event: MouseEvent) {
        // console.log(`SelectModeHandler: dragSelectedFragment`);
        if (!this.pageComponent.selectedFragment) return;
        // console.log(`SelectModeHandler: dragSelectedFragment: selectedfragment: ${JSON.stringify(this.pageComponent.selectedFragment)}`);
        if (!(this.isDraggingLeft || this.isDraggingRight || this.isDraggingTop || this.isDraggingBottom || this.isDraggingAll)) return;
        // console.log(`SelectModeHandler: dragSelectedFragment: isDragging`);

        let newMouse = this.getMousePosition(event);
        if (!newMouse) return;

        const dx = newMouse.x - this.lastMouseX;
        const dy = newMouse.y - this.lastMouseY;

        // console.log(`SelectModeHandler: dragSelectedFragment: before: selectedFragment: ${JSON.stringify(this.pageComponent.selectedFragment)}`);

        if (this.isDraggingLeft) {
            this.pageComponent.selectedFragment.x += dx;
            this.pageComponent.selectedFragment.width -= dx;
        }
        if (this.isDraggingTop) {
            this.pageComponent.selectedFragment.y += dy;
            this.pageComponent.selectedFragment.height -= dy;
        }
        if (this.isDraggingRight) {
            this.pageComponent.selectedFragment.width += dx;
        }
        if (this.isDraggingBottom) {
            this.pageComponent.selectedFragment.height += dy;
        }
        if (this.isDraggingAll) {
            this.pageComponent.selectedFragment.x += dx;
            this.pageComponent.selectedFragment.y += dy;
        }

        // console.log(`SelectModeHandler: dragSelectedFragment: after: selectedFragment: ${JSON.stringify(this.pageComponent.selectedFragment)}`);

        // After applying, **update last mouse**
        this.lastMouseX = newMouse.x;
        this.lastMouseY = newMouse.y;
    }

    onClick(event: MouseEvent) { }
    onWheel(event: WheelEvent) { }
}
