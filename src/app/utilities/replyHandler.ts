
import { Subject } from 'rxjs';
import { ErrorReply, Reply } from './reply';
import { Buffer } from 'buffer';
import { AlertType } from '../alerts/alert.model';
import { AlertBuilder } from '../alerts/alert.builder';
import { AlertService } from '../alerts/alert.service';

export class ReplyHandler {

  constructor(public alertService: AlertService
  ) { }

  static getBufferAsObject(buffer: Buffer): { object: any; reason: string } {

    // Step 1: Ensure the payload is a Buffer
    if (!Buffer.isBuffer(buffer)) {
      let reason = 'Payload is not a Buffer.'
      console.error(`ReplyHandler.getReply: ${reason}`)
      return {object: null, reason: reason};
    }

    let jsonString: string;
    try {
      // Step 2: Convert Buffer to String
      jsonString = buffer.toString();
    } catch (error) {
      let reason = 'Error converting payload to string: ${error}'
      console.error(`ReplyHandler.getReply: ${reason}`)
      return {object: null, reason: reason};
    }

    let object: unknown;
    try {
      // Step 3: Parse JSON
      object = JSON.parse(jsonString);
    } catch (error) {
      let reason = 'Error parsing JSON: ${error}'
      console.error(`ReplyHandler.getReply: ${reason}`)
      return {object: null, reason: reason};
    }

    return {object: object, reason: ""}
  }

  static getReply(buffer: Buffer): { reply: Reply | null; reason: string } {

    let { object: object, reason } =  ReplyHandler.getBufferAsObject(buffer) 
    if (object == null) {
      return {reply: null, reason: reason};
    }

    // Step 4: Check the payload object is of type "Reply"
    if (!isReply(object)) {
      let reason = `payload does not match Reply interface`;
      console.error(`ReplyHandler.getReply: ${reason}`)
      return {reply: null, reason: reason};
    }

    // Now it's safely typed as Reply
    let reply: Reply = object;
    if (reply.code == 200) {
      return {reply: reply, reason: ""};
    }

    if (isErrorReply(reply)) {
      let errorReply = reply as ErrorReply;
      console.error(errorReply.message);
      return {reply: null, reason: errorReply.message};
    }

    let unexpectedReason = `Unexpected reply. code: ${reply.code}`;
    return {reply: null, reason: unexpectedReason};
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