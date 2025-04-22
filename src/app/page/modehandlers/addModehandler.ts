import { PageModeHandler } from './pageModeHandler';


export class AddModeHandler extends PageModeHandler {

    onClick(event: MouseEvent) {
        console.log('Adding');
    }
    onMouseMove(event: MouseEvent) {
        // Handle add mode mouse move
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
