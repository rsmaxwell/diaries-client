
import { Subject } from 'rxjs';
import { ErrorReply, Reply } from '../model/reply';
import { Buffer } from 'buffer';
import { AlertType } from '../alerts/alert.model';
import { AlertBuilder } from '../alerts/alert.builder';
import { AlertService } from '../alerts/alert.service';

export class ReplyHandler {

  constructor(public alertService: AlertService
  ) { }

  static getBufferAsObject(buffer: Buffer): object {
    if (!Buffer.isBuffer(buffer)) {
      throw new Error('Payload is not a Buffer.');
    }

    const jsonString = buffer.toString();
    return JSON.parse(jsonString);
  }

  static getBufferAsNumber(buffer: Buffer): number {
    const obj = ReplyHandler.getBufferAsObject(buffer)
    if (typeof obj !== 'number') throw new Error('Unexpected reply');
    return obj as number;
  }
}
