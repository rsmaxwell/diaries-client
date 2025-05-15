
import { Subject } from 'rxjs';
import { ErrorReply, Reply } from './reply';
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

  static getErrorReply(object: object): { reply: Reply | null; reason: string } {

    // Step 4: Check the payload object is of type "Reply"
    if (!isReply(object)) {
      let reason = `payload does not match Reply interface`;
      console.error(`ReplyHandler.getReply: ${reason}`)
      return { reply: null, reason: reason };
    }

    // Now it's safely typed as Reply
    let reply: Reply = object;
    if (reply.code == 200) {
      return { reply: reply, reason: "" };
    }

    if (isErrorReply(reply)) {
      let errorReply = reply as ErrorReply;
      console.error(errorReply.message);
      return { reply: null, reason: errorReply.message };
    }

    let unexpectedReason = `Unexpected reply. code: ${reply.code}`;
    return { reply: null, reason: unexpectedReason };
  }
}

function isReply(obj: unknown): obj is Reply {
  return typeof obj === 'object' && obj !== null &&
    'code' in obj && typeof (obj as any).code === 'number';
}

function isErrorReply(obj: any): obj is ErrorReply {
  return obj !== null &&
    typeof obj === 'object' &&
    'message' in obj && typeof obj.accessToken === 'string'
}