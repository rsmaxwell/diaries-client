
import { Subject } from 'rxjs';
import { Reply } from './reply';
import { Buffer } from 'buffer';

export class ReplyHandler  {

  static handle(payload: Buffer, subject: Subject<any>): void {

    let result = ReplyHandler.parsePayload(payload)
    if (result == null) {
      subject.error(`Unexpected reply`);
      return 
    } 

    let reply = (result as Reply)
    console.log(`ReplyHandler.handle: result: ${JSON.stringify(reply)}`);

    if (ReplyHandler.isGoodReply(reply)) {
      subject.next(reply.result);
    } else { 
      subject.error(ReplyHandler.getMessage(reply));
    }
  }


static parsePayload(payload: Buffer): Reply | null {

      // Step 1: Ensure the payload is a Buffer
      if (!Buffer.isBuffer(payload)) {
        let message = 'ReplyHandler.handle: Payload is not a Buffer.'
        console.error(message)
        return null;
      }
  
      let jsonString: string;
      try {
        // Step 2: Convert Buffer to String
        jsonString = payload.toString();
      } catch (error) {
        let message = 'ReplyHandler.handle: Error converting payload to string: ${error}'
        console.error(message)
        return null;
      }
  
      let parsedPayload: unknown;
      try {
        // Step 3: Parse JSON
        parsedPayload = JSON.parse(jsonString);
      } catch (error) {
        let message = 'ReplyHandler.handle: Error parsing JSON: ${error}'
        console.error(message)
        return null;
      }

      // Step 4: Validate the parsed object
      if (!ReplyHandler.isValidReply(parsedPayload)) {
        return null
      }
      
      return  parsedPayload as Reply
  }

  static isValidReply(payload: any): boolean {
    console.log(`ReplyHandler.isValidReply: message: ${payload}`);
    console.log(`ReplyHandler.isValidReply: JSON message: ${JSON.stringify(payload)}`);

    if (!(typeof payload === 'object')) {
      console.log(`ReplyHandler.isValidReply: payload is an unextected type: ${typeof payload}`);
      return false
    }

    if (payload.hasOwnProperty('code')) {
      let code = payload['code'];
      if (typeof code !== "number") {
        console.log(`ReplyHandler.isValidReply: Unexpected typeof code: ${typeof code}`);
        return false
      }
    }
    else {
      console.log(`ReplyHandler.isValidReply: Missing 'code'`);
      return false
    }

    if (!payload.hasOwnProperty('result')) {
      console.log(`ReplyHandler.isValidReply: Missing 'result'`);
      return false      
    }

    return true
  }

  static isGoodReply(reply: Reply): boolean {
    return (reply.code == 200) 
  }

  static getMessage(reply: Reply): string {
    console.log(`ReplyHandler.getMessage: JSON message: ${JSON.stringify(reply)}`);

    if (reply.hasOwnProperty('message')) {
      return `Unexpected code: ${reply.code}, message: ${reply.message}`
    }

    return `Unexpected code: ${reply.code}`
  }  
}
