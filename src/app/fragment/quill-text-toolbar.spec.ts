import { TEXT_EDITOR_MODULES, blockInlineImageInsertion } from './quill-text-toolbar';

describe('0054 shared Quill toolbar', () => {
  it('offers the same default palette on both colour controls near the left', () => {
    const toolbar = TEXT_EDITOR_MODULES.toolbar;
    expect(toolbar[0]).toEqual(['bold', 'italic', 'underline']);
    expect(toolbar[1]).toEqual([{ color: [] }, { background: [] }]);
    expect(JSON.stringify(toolbar)).toContain('"font"');
    expect(JSON.stringify(toolbar)).toContain('"size"');
    expect(toolbar).toContain(['link']);
    expect(JSON.stringify(toolbar)).not.toContain('"image"');
  });

  it('blocks pasted image HTML but permits ordinary rich text and links', () => {
    const root = document.createElement('div');
    const stop = blockInlineImageInsertion(root);
    const paste = (html: string) => {
      const event = new Event('paste', { bubbles: true, cancelable: true }) as ClipboardEvent;
      Object.defineProperty(event, 'clipboardData', { value: {
        items: [], getData: (type: string) => type === 'text/html' ? html : ''
      } });
      root.dispatchEvent(event);
      return event.defaultPrevented;
    };
    expect(paste('<p>Hello <a href="https://example.org">link</a></p>')).toBeFalse();
    expect(paste('<p>caption</p><img src="data:image/png;base64,abc">')).toBeTrue();
    expect(paste('<img>')).toBeTrue();
    stop();
    expect(paste('<img src="https://example.org/p.png">')).toBeFalse();
  });

  it('blocks image file drops but permits ordinary text drops', () => {
    const root = document.createElement('div');
    const stop = blockInlineImageInsertion(root);
    const drop = (type: string) => {
      const event = new Event('drop', { bubbles: true, cancelable: true }) as DragEvent;
      Object.defineProperty(event, 'dataTransfer', { value: {
        files: [{ type }], getData: () => ''
      } });
      root.dispatchEvent(event);
      return event.defaultPrevented;
    };
    expect(drop('text/plain')).toBeFalse();
    expect(drop('image/png')).toBeTrue();
    stop();
  });
  it('removes newly pasted inline-image embeds without rewriting loaded legacy content', () => {
    const root = document.createElement('div');
    let change: ((delta: any, oldDelta: unknown, source: string) => void) | undefined;
    const deleted: number[] = [];
    const fakeQuill = {
      on: (_name: string, callback: any) => { change = callback; },
      off: () => { change = undefined; },
      deleteText: (index: number, length: number, source: string) => {
        expect(length).toBe(1);
        expect(source).toBe('api');
        deleted.push(index);
      }
    };
    const stop = blockInlineImageInsertion(root, fakeQuill as any);
    change!({ ops: [{ insert: { image: 'data:image/png;base64,aaa' } }] }, {}, 'api');
    expect(deleted).toEqual([]);
    change!({ ops: [{ retain: 3 }, { insert: { image: 'data:image/png;base64,aaa' } }] }, {}, 'user');
    expect(deleted).toEqual([3]);
    change!({ ops: [
      { retain: 2 }, { insert: { image: 'data:image/png;base64,aaa' } },
      { insert: 'caption' }, { insert: { image: 'data:image/png;base64,bbb' } }
    ] }, {}, 'user');
    expect(deleted.slice(1)).toEqual([10, 2]);
    stop();
    expect(change).toBeUndefined();
  });

  it('blocks pasted image files even when only clipboard files are populated', () => {
    const root = document.createElement('div');
    const stop = blockInlineImageInsertion(root);
    const event = new Event('paste', { bubbles: true, cancelable: true }) as ClipboardEvent;
    Object.defineProperty(event, 'clipboardData', { value: {
      items: [], files: [{ type: 'image/png' }], getData: () => ''
    } });
    root.dispatchEvent(event);
    expect(event.defaultPrevented).toBeTrue();
    stop();
  });

});
