import type { OwnedCard, SetPointsBalance } from './api';

interface RecycleResult {
  set_slug: string;
  points: number;
  earned: number;
}

interface RecycleAllResult {
  set_slug: string;
  points: number;
  earned: number;
  recycled: number;
}

interface CollectionApi {
  listAllMyCards: (setSlug?: string) => Promise<OwnedCard[]>;
  listMyPoints: () => Promise<SetPointsBalance[]>;
  recycleCard: (id: string) => Promise<RecycleResult>;
  recycleDuplicates: (slug: string) => Promise<RecycleAllResult>;
}

type OnError = (error: unknown) => void;
type OnBusy = (busy: boolean) => void;

export function createCollectionRequests(api: CollectionApi) {
  let context = 0;
  let latestLoad = 0;
  let pendingRecycle: Promise<void> | null = null;

  async function load<T>(read: () => Promise<T>, apply: (result: T) => void, onError: OnError) {
    const currentContext = context;
    const request = ++latestLoad;
    const current = () => context === currentContext && latestLoad === request;
    // A refocus must read after an in-flight recycle, not halfway through it.
    await pendingRecycle;
    if (!current()) return;
    try {
      const result = await read();
      if (current()) apply(result);
    } catch (error) {
      if (current()) onError(error);
    }
  }

  async function recycle<T>(
    write: () => Promise<T>,
    apply: (result: T) => void,
    onError: OnError,
    onBusy: OnBusy,
  ) {
    if (pendingRecycle) return;
    const currentContext = context;
    let release!: () => void;
    pendingRecycle = new Promise<void>((resolve) => {
      release = resolve;
    });
    latestLoad += 1;
    onBusy(true);
    try {
      const result = await write();
      if (context === currentContext) apply(result);
    } catch (error) {
      if (context === currentContext) onError(error);
    } finally {
      pendingRecycle = null;
      release();
      onBusy(false);
    }
  }

  return {
    invalidate() {
      context += 1;
      latestLoad += 1;
    },
    load(
      setSlug: string | undefined,
      apply: (result: { cards: OwnedCard[]; points: SetPointsBalance[] }) => void,
      onError: OnError,
    ) {
      return load(
        async () => {
          const [cards, points] = await Promise.all([
            api.listAllMyCards(setSlug),
            api.listMyPoints(),
          ]);
          return { cards, points };
        },
        apply,
        onError,
      );
    },
    loadCards(setSlug: string, apply: (cards: OwnedCard[]) => void, onError: OnError) {
      return load(() => api.listAllMyCards(setSlug), apply, onError);
    },
    recycle(id: string, apply: (result: RecycleResult) => void, onError: OnError, onBusy: OnBusy) {
      return recycle(() => api.recycleCard(id), apply, onError, onBusy);
    },
    recycleAll(
      slug: string,
      setSlug: string | undefined,
      apply: (result: RecycleAllResult & { cards: OwnedCard[] }) => void,
      onError: OnError,
      onBusy: OnBusy,
    ) {
      return recycle(
        async () => {
          const result = await api.recycleDuplicates(slug);
          const cards = await api.listAllMyCards(setSlug);
          return { ...result, cards };
        },
        apply,
        onError,
        onBusy,
      );
    },
  };
}
