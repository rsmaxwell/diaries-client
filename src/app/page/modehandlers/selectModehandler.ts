import { Fragment } from "../../model/fragment/fragment";
import { PageModeHandler } from "./pageModeHandler";

export class SelectModeHandler extends PageModeHandler {

    isDragging: boolean = false;


    onMouseDown(event: MouseEvent) {
        this.isDragging = true;
        this.calculateCursorStyle(event);
    }
    onSelectFragment(fragment: Fragment): void {
        this.isDragging = false;
        this.pageComponent.setSelection(fragment);
    }
    onMouseUp(event: MouseEvent) {
        if (this.isDragging) {
            this.isDragging = false;
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
    }

    calculateCursorStyle(event: MouseEvent) {
        let cursor = 'default';

        if (this.pageComponent.selectedFragment != null) {
            const fragment = this.pageComponent.selectedFragment;

            let point = this.getMousePosition(event);
            if (point != null) {

                const margin = 30;
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
                }
            }
        }

        this.pageComponent.style = cursor;
    }


    onClick(event: MouseEvent) { }
    onWheel(event: WheelEvent) { }
}
