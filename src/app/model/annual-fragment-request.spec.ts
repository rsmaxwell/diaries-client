import { AddAnnualFragmentRequest, NormaliseAnnualFragmentsRequest } from './annual-fragment-request';

describe('Annual Fragment RPC requests', () => {
  it('sends explicit year ownership without Page, Marquee or date fields', () => {
    const request = new AddAnnualFragmentRequest({
      diaryId: 4, year: 1832, placement: 'PREAMBLE', type: 'TEXT',
      sequence: 1, text: '<p>Introduction</p>'
    });
    const json = JSON.stringify(request);
    expect(json).toContain('"diaryId":4');
    expect(json).toContain('"placement":"PREAMBLE"');
    expect(json).not.toContain('pageId');
    expect(json).not.toContain('marqueeId');
    expect(json).not.toContain('month');
    expect(json).not.toContain('day');
    expect(json).not.toContain('imageId');
  });

  it('requires catalogue Image ID for an annual IMAGE', () => {
    expect(() => new AddAnnualFragmentRequest({
      diaryId: 1, year: 1828, placement: 'POSTAMBLE', type: 'IMAGE', sequence: 2, text: ''
    })).toThrow();
  });

  it('rejects a linked TEXT fragment and unsafe IMAGE links', () => {
    expect(() => new AddAnnualFragmentRequest({
      diaryId: 1, year: 1828, placement: 'PREAMBLE', type: 'TEXT',
      sequence: 1, text: 'Hello', imageLinkUrl: 'https://example.com'
    })).toThrow();
    expect(() => new AddAnnualFragmentRequest({
      diaryId: 1, year: 1828, placement: 'POSTAMBLE', type: 'IMAGE',
      sequence: 1, text: '', imageId: 12, imageLinkUrl: 'javascript:alert(1)'
    })).toThrow();
  });


  it('rejects unsupported annual placement and type at runtime', () => {
    expect(() => new AddAnnualFragmentRequest({
      diaryId: 1, year: 1828, placement: 'DATED' as any,
      type: 'TEXT', sequence: 1, text: 'Invalid placement'
    })).toThrow();
    expect(() => new AddAnnualFragmentRequest({
      diaryId: 1, year: 1828, placement: 'PREAMBLE',
      type: 'MARQUEE' as any, sequence: 1, text: 'Invalid type'
    })).toThrow();
    expect(() => new NormaliseAnnualFragmentsRequest(1, 1828, 'DATED' as any)).toThrow();
  });
  it('sends annual normalisation without a calendar date', () => {
    expect(JSON.stringify(new NormaliseAnnualFragmentsRequest(1, 1828, 'POSTAMBLE')))
      .toBe('{"diaryId":1,"year":1828,"placement":"POSTAMBLE"}');
  });
});
