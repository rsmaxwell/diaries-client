import { Rectangle } from '../utilities/rectangle';
import { AddMarqueeRequest, DeleteMarqueeRequest } from './marquee';

describe('0051 IMAGE Marquee versioned RPC arguments', () => {
  it('includes a post-lock Fragment version on IMAGE attach', () => {
    const request = new AddMarqueeRequest(22, 10, new Rectangle(1, 2, 50, 60), 7);
    expect(JSON.parse(JSON.stringify(request)).fragmentVersion).toBe(7);
  });
  it('keeps old MARQUEE request shapes compatible', () => {
    const add = new AddMarqueeRequest(22, 10, new Rectangle(1, 2, 50, 60));
    const del = new DeleteMarqueeRequest(44);
    expect(JSON.stringify(add)).not.toContain('fragmentVersion');
    expect(JSON.stringify(del)).not.toContain('version');
  });
  it('includes the Marquee version on IMAGE removal', () => {
    expect(JSON.parse(JSON.stringify(new DeleteMarqueeRequest(44, 5)))).toEqual({ id: 44, version: 5 });
  });
});
