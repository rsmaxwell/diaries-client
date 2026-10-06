import { BehaviorSubject, Observable, ReplaySubject } from 'rxjs';
import { Fragment } from './fragment';
import { CatalogueImage } from './image';
import { Marquee } from './marquee';
import { ModelContext, matchingMarqueeForFragment } from './model-context';

describe('ModelContext fragment marquee relationship', () => {
  const fragment = (overrides: Partial<Fragment> = {}): Fragment => ({
    id: 10,
    pageId: 20,
    type: 'MARQUEE',
    marqueeId: 30,
    year: 1830,
    month: 1,
    day: 1,
    sequence: 1,
    version: 0,
    text: 'text',
    ...overrides
  });

  const marquee = (overrides: Partial<Marquee> = {}): Marquee => ({
    id: 30,
    version: 0,
    fragmentId: 10,
    pageId: 20,
    rectangle: { x: 1, y: 2, width: 3, height: 4 },
    ...overrides
  } as Marquee);

  it('matches by fragment and authoritative page ownership', () => {
    expect(matchingMarqueeForFragment(fragment(), [marquee()])?.id).toBe(30);
    expect(matchingMarqueeForFragment(fragment(), [marquee({ pageId: 21 })])).toBeNull();
    expect(matchingMarqueeForFragment(fragment(), [marquee({ fragmentId: 11 })])).toBeNull();
  });

  it('rejects explicit images and unresolved pages', () => {
    expect(matchingMarqueeForFragment(fragment({ type: 'IMAGE' }), [marquee()])).toBeNull();
    expect(matchingMarqueeForFragment(fragment({ pageId: null }), [marquee()])).toBeNull();
  });

  it('does not use the compatibility marqueeId as relationship authority', () => {
    expect(matchingMarqueeForFragment(fragment({ marqueeId: null }), [marquee()])?.id).toBe(30);
    expect(matchingMarqueeForFragment(fragment({ marqueeId: 31 }), [marquee()])?.id).toBe(30);
  });

  it('remains unresolved until an independently arriving valid marquee is present', () => {
    const wrongPage = marquee({ id: 31, pageId: 21 });

    expect(matchingMarqueeForFragment(fragment(), [])).toBeNull();
    expect(matchingMarqueeForFragment(fragment(), [wrongPage])).toBeNull();
    expect(matchingMarqueeForFragment(fragment(), [wrongPage, marquee()])?.id).toBe(30);
  });
});


class FakeLiveObjectListService {
  private readonly subjects = new Map<string, BehaviorSubject<unknown[]>>();

  subscribeToTopicTree$<T>(_client: unknown, topicFilters: string[]): Observable<T[]> {
    return this.subjectFor(topicFilters).asObservable() as Observable<T[]>;
  }

  unsubscribeTopicTree(_topicFilters: string[]): void {
    // Deliberately leave the test subject reusable. The lifecycle assertion is
    // about ModelContext keeping its relationship synchronizer alive after
    // transport cleanup.
  }

  emit<T>(topicFilters: string[], values: T[]): void {
    this.subjectFor(topicFilters).next(values);
  }

  private subjectFor(topicFilters: string[]): BehaviorSubject<unknown[]> {
    const key = topicFilters.join('|');
    let subject = this.subjects.get(key);
    if (!subject) {
      subject = new BehaviorSubject<unknown[]>([]);
      this.subjects.set(key, subject);
    }
    return subject;
  }
}

describe('ModelContext Fragment-to-Marquee synchronization lifecycle', () => {
  const marquee: Marquee = {
    id: 30,
    version: 0,
    fragmentId: 10,
    pageId: 20,
    rectangle: { x: 1, y: 2, width: 3, height: 4 }
  } as Marquee;

  const marqueeFragment: Fragment = {
    id: 10,
    pageId: 20,
    type: 'MARQUEE',
    marqueeId: 30,
    year: 1830,
    month: 1,
    day: 1,
    sequence: 1,
    version: 0,
    text: 'marquee fragment'
  };

  const imageFragment: Fragment = {
    ...marqueeFragment,
    id: 11,
    type: 'IMAGE',
    imageId: 101,
    marqueeId: null,
    text: 'image fragment'
  };

  function createContext() {
    const liveObjectService = new FakeLiveObjectService();
    const liveObjectListService = new FakeLiveObjectListService();
    const mqtt = { getConnection: () => Promise.resolve({}) };
    const context = new ModelContext(
      mqtt as any,
      liveObjectListService as any,
      liveObjectService as any
    );
    return { context, liveObjectService, liveObjectListService };
  }

  async function settleSubscriptions(): Promise<void> {
    await Promise.resolve();
    await Promise.resolve();
  }

  it('still derives a MARQUEE selection after cleanupTopicTree()', async () => {
    const { context, liveObjectService, liveObjectListService } = createContext();
    const selectedMarqueeIds: Array<number | null> = [];
    const subscription = context.marqueeId$.subscribe(id => selectedMarqueeIds.push(id));

    context.cleanupTopicTree();
    context.setDiaryId(1);
    context.setPageId(20);
    context.setFragmentId(10);
    await settleSubscriptions();

    liveObjectListService.emit(['diaries/diaries/1/20/+'], [marquee]);
    liveObjectService.emit('diaries/fragments/10', marqueeFragment);

    expect(selectedMarqueeIds.at(-1)).toBe(30);
    subscription.unsubscribe();
  });

  it('still clears Marquee selection for an IMAGE Fragment after cleanupTopicTree()', async () => {
    const { context, liveObjectService, liveObjectListService } = createContext();
    let selectedMarqueeId: number | null = null;
    const subscription = context.marqueeId$.subscribe(id => selectedMarqueeId = id);

    context.setMarqueeId(30);
    context.cleanupTopicTree();
    context.setDiaryId(1);
    context.setPageId(20);
    context.setFragmentId(11);
    await settleSubscriptions();

    liveObjectListService.emit(['diaries/diaries/1/20/+'], [marquee]);
    liveObjectService.emit('diaries/fragments/11', imageFragment);

    expect(selectedMarqueeId).toBeNull();
    subscription.unsubscribe();
  });
});


class FakeLiveObjectService {
  readonly requestedTopics: string[] = [];
  private readonly subjects = new Map<string, ReplaySubject<unknown | null>>();

  getObjectById$<T>(topic: string, _deserialize: (buf: any) => T): Observable<T | null> {
    this.requestedTopics.push(topic);
    return this.subjectFor(topic).asObservable() as Observable<T | null>;
  }

  unsubscribeTopic(_topic: string): void {
    // ModelContext does not explicitly release Fragment/Image topics here.
  }

  emit<T>(topic: string, value: T | null): void {
    this.subjectFor(topic).next(value);
  }

  private subjectFor(topic: string): ReplaySubject<unknown | null> {
    let subject = this.subjects.get(topic);
    if (!subject) {
      subject = new ReplaySubject<unknown | null>(1);
      this.subjects.set(topic, subject);
    }
    return subject;
  }
}

describe('ModelContext retained Image relationship', () => {
  const image: CatalogueImage = {
    id: 101,
    version: 3,
    relativePath: 'diary-1830/images/image.png',
    mimeType: 'image/png',
    originalFilename: 'image.png',
    width: 1200,
    height: 800,
    checksum: 'a'.repeat(64),
    caption: 'Caption',
    altText: 'Alternative text'
  };

  const imageFragment = (overrides: Partial<Fragment> = {}): Fragment => ({
    id: 10,
    pageId: 20,
    type: 'IMAGE',
    imageId: 101,
    marqueeId: null,
    year: 1830,
    month: 1,
    day: 1,
    sequence: 1,
    version: 0,
    text: 'text',
    ...overrides
  });

  function createContext() {
    const liveObjectService = new FakeLiveObjectService();
    const mqtt = {
      getConnection: () => Promise.reject(new Error('Unexpected MQTT list subscription'))
    };
    const liveObjectListService = {
      subscribeToTopicTree$: () => { throw new Error('Unexpected topic-tree subscription'); },
      unsubscribeTopicTree: () => undefined
    };

    const context = new ModelContext(
      mqtt as any,
      liveObjectListService as any,
      liveObjectService as any
    );

    return { context, liveObjectService };
  }

  it('reactively resolves a selected IMAGE Fragment through diaries/images/<id>', () => {
    const { context, liveObjectService } = createContext();
    const values: Array<CatalogueImage | null> = [];
    const subscription = context.selectedImage$.subscribe(value => values.push(value));

    context.setFragmentId(10);
    liveObjectService.emit('diaries/fragments/10', imageFragment());
    liveObjectService.emit('diaries/images/101', image);

    expect(liveObjectService.requestedTopics).toContain('diaries/images/101');
    expect(values.at(-1)).toEqual(image);

    subscription.unsubscribe();
  });

  it('replays retained Image metadata that is already present when the Fragment reference arrives', () => {
    const { context, liveObjectService } = createContext();
    const values: Array<CatalogueImage | null> = [];
    const subscription = context.selectedImage$.subscribe(value => values.push(value));

    liveObjectService.emit('diaries/images/101', image);
    context.setFragmentId(10);
    liveObjectService.emit('diaries/fragments/10', imageFragment());

    expect(values.at(-1)).toEqual(image);

    subscription.unsubscribe();
  });

  it('propagates retained Image metadata updates for the selected imageId', () => {
    const { context, liveObjectService } = createContext();
    const values: Array<CatalogueImage | null> = [];
    const subscription = context.selectedImage$.subscribe(value => values.push(value));

    context.setFragmentId(10);
    liveObjectService.emit('diaries/fragments/10', imageFragment());
    liveObjectService.emit('diaries/images/101', image);

    const updated = { ...image, version: 4, caption: 'Updated caption' };
    liveObjectService.emit('diaries/images/101', updated);

    expect(values.at(-1)).toEqual(updated);

    subscription.unsubscribe();
  });

  it('emits null for MARQUEE and unattached IMAGE Fragments', () => {
    const { context, liveObjectService } = createContext();
    const values: Array<CatalogueImage | null> = [];
    const subscription = context.selectedImage$.subscribe(value => values.push(value));

    context.setFragmentId(10);
    liveObjectService.emit('diaries/fragments/10', imageFragment({ type: 'MARQUEE', imageId: 101 }));
    expect(values.at(-1)).toBeNull();

    liveObjectService.emit('diaries/fragments/10', imageFragment({ imageId: null }));
    expect(values.at(-1)).toBeNull();

    subscription.unsubscribe();
  });

  it('turns a retained Image tombstone into null instead of leaving stale metadata', () => {
    const { context, liveObjectService } = createContext();
    const values: Array<CatalogueImage | null> = [];
    const subscription = context.selectedImage$.subscribe(value => values.push(value));

    context.setFragmentId(10);
    liveObjectService.emit('diaries/fragments/10', imageFragment());
    liveObjectService.emit('diaries/images/101', image);
    expect(values.at(-1)).toEqual(image);

    liveObjectService.emit('diaries/images/101', null);
    expect(values.at(-1)).toBeNull();

    subscription.unsubscribe();
  });

  it('switches retained Image subscriptions when the selected Fragment imageId changes', () => {
    const { context, liveObjectService } = createContext();
    const secondImage: CatalogueImage = {
      ...image,
      id: 102,
      relativePath: 'diary-1830/images/second.png',
      originalFilename: 'second.png'
    };
    const values: Array<CatalogueImage | null> = [];
    const subscription = context.selectedImage$.subscribe(value => values.push(value));

    context.setFragmentId(10);
    liveObjectService.emit('diaries/fragments/10', imageFragment());
    liveObjectService.emit('diaries/images/101', image);
    expect(values.at(-1)?.id).toBe(101);

    liveObjectService.emit('diaries/fragments/10', imageFragment({ imageId: 102, version: 1 }));
    expect(values.at(-1)).toBeNull();

    liveObjectService.emit('diaries/images/102', secondImage);
    expect(values.at(-1)?.id).toBe(102);

    subscription.unsubscribe();
  });
});
