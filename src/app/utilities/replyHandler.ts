
import { Subject } from 'rxjs';
import { ErrorReply, Reply } from '../model/reply';
import { Buffer } from 'buffer';
import { AlertType } from '../alerts/alert.model';
import { AlertBuilder } from '../alerts/alert.builder';
import { AlertService } from '../alerts/alert.service';

export class ReplyHandler {

  constructor(public alertService: AlertService
  ) { }

  static getBufferAsObject<T>(buffer: Buffer): T {
    return JSON.parse(buffer.toString()) as T;
  }

  static getBufferAsNumber(buffer: Buffer): number {
    const obj = ReplyHandler.getBufferAsObject(buffer)
    if (typeof obj !== 'number') throw new Error('Unexpected reply');
    return obj as number;
  }
}
