import { Fragment } from "../../model/fragment/fragment";
import { PageModeHandler } from "./pageModeHandler";

export class SelectModeHandler extends PageModeHandler {

    isCancelPending: boolean = false;


    onMouseDown(event: MouseEvent) {
        this.isCancelPending = true;
    }
    onSelectFragment(fragment: Fragment): void {
        this.isCancelPending = false;
        this.pageComponent.setSelection(fragment);
    }
    onMouseUp(event: MouseEvent) {
        if (this.isCancelPending) {
            this.isCancelPending = false;
            this.pageComponent.cancelSelection();
        }
    }
    onKeyDown(event: KeyboardEvent): void {
        if (event.key === 'Escape') {
            this.pageComponent.cancelSelection();
        }
    }

    onClick(event: MouseEvent) { }
    onMouseMove(event: MouseEvent) { }
    onWheel(event: WheelEvent) { }
}
