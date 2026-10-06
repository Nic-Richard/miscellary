import { expect, it, vi } from 'vitest';
import type { OwnedCard, SetPointsBalance } from './api';
import { createCollectionRequests } from './collectionRequests';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

function collectionApi() {
  const result = { set_slug: 'cameras', points: 10, earned: 10 };
  return {
    listAllMyCards: vi.fn(async (_setSlug?: string): Promise<OwnedCard[]> => []),
    listMyPoints: vi.fn(async (): Promise<SetPointsBalance[]> => []),
    recycleCard: vi.fn(async (_id: string) => result),
    recycleDuplicates: vi.fn(async (_slug: string) => ({ ...result, recycled: 1 })),
  };
}

it('keeps the active set filter when refreshing after bulk recycling', async () => {
  const api = collectionApi();
  const requests = createCollectionRequests(api);
  const apply = vi.fn();
  const error = vi.fn();
  await requests.recycleAll('cameras', 'cameras', apply, error, vi.fn());
  expect(api.recycleDuplicates).toHaveBeenCalledWith('cameras');
  expect(api.listAllMyCards).toHaveBeenCalledExactlyOnceWith('cameras');
  expect(apply).toHaveBeenCalledWith({
    set_slug: 'cameras',
    points: 10,
    earned: 10,
    recycled: 1,
    cards: [],
  });
  expect(error).not.toHaveBeenCalled();
});

it('ignores older replies and errors after a scope change or blur', async () => {
  const api = collectionApi();
  const requests = createCollectionRequests(api);
  const old = deferred<OwnedCard[]>();
  const oldApply = vi.fn();
  const error = vi.fn();
  api.listAllMyCards.mockImplementationOnce(() => old.promise);
  const oldLoad = requests.load('cameras', oldApply, error);
  await Promise.resolve();
  const newApply = vi.fn();
  await requests.load('birds', newApply, error);
  old.resolve([]);
  await oldLoad;
  expect(newApply).toHaveBeenCalledOnce();
  expect(oldApply).not.toHaveBeenCalled();

  const failed = deferred<OwnedCard[]>();
  api.listAllMyCards.mockImplementationOnce(() => failed.promise);
  const failedLoad = requests.load('birds', oldApply, error);
  await Promise.resolve();
  requests.invalidate();
  failed.reject(new Error('Late failure'));
  await failedLoad;
  expect(oldApply).not.toHaveBeenCalled();
  expect(error).not.toHaveBeenCalled();
});

it('serializes recycling, invalidates old loads and releases the lock after failure', async () => {
  const api = collectionApi();
  const requests = createCollectionRequests(api);
  const old = deferred<OwnedCard[]>();
  const write = deferred<{ set_slug: string; points: number; earned: number }>();
  api.listAllMyCards.mockImplementationOnce(() => old.promise);
  api.recycleCard.mockImplementationOnce(() => write.promise);
  const staleApply = vi.fn();
  const oldLoad = requests.load(undefined, staleApply, vi.fn());
  await Promise.resolve();
  const error = vi.fn();
  const busy = vi.fn();
  const recycling = requests.recycle('first', vi.fn(), error, busy);
  await requests.recycleAll('cameras', undefined, vi.fn(), error, busy);
  expect(api.recycleDuplicates).not.toHaveBeenCalled();

  const freshApply = vi.fn();
  const freshLoad = requests.load(undefined, freshApply, error);
  await Promise.resolve();
  expect(api.listAllMyCards).toHaveBeenCalledTimes(1);
  write.reject(new Error('Recycle failed'));
  await recycling;
  await freshLoad;
  old.resolve([]);
  await oldLoad;
  expect(staleApply).not.toHaveBeenCalled();
  expect(freshApply).toHaveBeenCalledOnce();
  expect(error).toHaveBeenCalledOnce();
  await requests.recycle('retry', vi.fn(), error, busy);
  expect(api.recycleCard).toHaveBeenCalledTimes(2);
  expect(busy.mock.calls).toEqual([[true], [false], [true], [false]]);
});
