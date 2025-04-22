import { PageModeHandler } from "./pageModeHandler";

export class SelectModeHandler extends PageModeHandler {

    onClick(event: MouseEvent) {
        console.log('Selecting');
    }
    onMouseMove(event: MouseEvent) {
        // Handle select mode mouse move
    }
    onMouseUp(event: MouseEvent) {

    }
    onMouseDown(event: MouseEvent) {
        // Handle view mode mouse move
    }
    onWheel(event: WheelEvent) {
        // Handle view mode mouse move
    }
}
