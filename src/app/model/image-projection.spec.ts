import { Buffer } from 'buffer';
import { firstValueFrom, of } from 'rxjs';

import { CatalogueImage } from './image';
import { ModelContext } from './model-context';

describe('CatalogueImage retained projection compatibility', () => {
  it('deserializes the responder retained Image projection without renaming or dropping metadata', async () => {
    const retainedProjection = {
      id: 101,
      version: 7,
      relativePath: 'diary-1830/images/scan 1.jpg',
      mimeType: 'image/jpeg',
      originalFilename: 'scan 1.jpg',
      width: 2400,
      height: 3600,
      checksum: '0123456789abcdef',
      caption: 'Whitley Park map',
      altText: 'Hand-drawn map of Whitley Park'
    } satisfies CatalogueImage;

    let requestedTopic: string | undefined;
    const liveObjectService = {
      getObjectById$: <T>(topic: string, deserialize: (buf: Buffer) => T) => {
        requestedTopic = topic;
        return of(deserialize(Buffer.from(JSON.stringify(retainedProjection))));
      },
      unsubscribeTopic: () => undefined
    };

    const context = new ModelContext(
      { getConnection: () => Promise.reject(new Error('Unexpected MQTT list subscription')) } as any,
      {
        subscribeToTopicTree$: () => { throw new Error('Unexpected topic-tree subscription'); },
        unsubscribeTopicTree: () => undefined
      } as any,
      liveObjectService as any
    );

    const image = await firstValueFrom(context.getLiveImage$(101));

    expect(requestedTopic).toBe('diaries/images/101');
    expect(image).toEqual(retainedProjection);
    expect(Object.keys(image!)).toEqual([
      'id',
      'version',
      'relativePath',
      'mimeType',
      'originalFilename',
      'width',
      'height',
      'checksum',
      'caption',
      'altText'
    ]);
  });
});
