import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import type * as ExpoIap from 'expo-iap';
import type { Purchase } from 'expo-iap';
import type { Membership } from '@miscellary/shared';
import { apiFetch } from './api';

type Sdk = typeof ExpoIap;
let loading: Promise<Sdk | null> | null = null;

// The billing module only exists in builds made after it was added, so older installs
// load without it and simply hide store purchases.
function loadSdk(): Promise<Sdk | null> {
  loading ??=
    Platform.OS === 'android' ? import('expo-iap').catch(() => null) : Promise.resolve(null);
  return loading;
}

export interface PlayStore {
  ready: boolean;
  regionBlocked: boolean;
  prices: Record<string, string>;
  busy: string | null;
  error: string | null;
  notice: string | null;
  buy: (product: string) => void;
  subscribe: () => void;
  manage: () => void;
}

export function usePlayStore(membership: Membership | null, onSettled: () => void): PlayStore {
  const play = membership?.play;
  const available = Boolean(play?.available && play.account_id);
  const subscriptionId = play?.subscription_id ?? '';
  const bundles = (membership?.bundles ?? []).map((bundle) => bundle.id).join(',');
  const [sdk, setSdk] = useState<Sdk | null>(null);
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [offer, setOffer] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [regionBlocked, setRegionBlocked] = useState(false);
  const blockedCountries = (membership?.blocked_countries ?? []).join(',');
  const settled = useRef(onSettled);
  settled.current = onSettled;

  const settle = useCallback(
    async (store: Sdk, purchase: Purchase) => {
      const product = purchase.productId === subscriptionId ? 'subscription' : purchase.productId;
      if (!purchase.purchaseToken) return;
      if (purchase.purchaseState === 'pending') {
        setNotice('Your payment is pending. It will be added once Google Play confirms it.');
        return;
      }
      try {
        const result = await apiFetch<{ status: string }>('/api/v1/me/billing/play/', {
          method: 'POST',
          body: { product, purchase_token: purchase.purchaseToken },
        });
        if (result.status === 'unavailable') {
          setNotice(
            'Buying tickets and memberships isn’t available in your country, so Google Play has refunded it.',
          );
          return;
        }
        if (result.status === 'pending') {
          setNotice('Your payment is pending. It will be added once Google Play confirms it.');
          return;
        }
        if (result.status === 'granted') {
          try {
            await store.finishTransaction({ purchase, isConsumable: product !== 'subscription' });
          } catch {
            // Already finished on an earlier launch; the server has acknowledged it either way.
          }
          setNotice(null);
          settled.current();
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Your purchase could not be added yet.');
      } finally {
        setBusy(null);
      }
    },
    [subscriptionId],
  );

  useEffect(() => {
    if (!available) return;
    let cancelled = false;
    const removers: (() => void)[] = [];
    void loadSdk().then(async (store) => {
      if (!store || cancelled) return;
      try {
        await store.initConnection();
        if (cancelled) return;
        const country = await store.getStorefront().catch(() => '');
        if (country && blockedCountries.split(',').includes(country.toUpperCase())) {
          setRegionBlocked(true);
          return;
        }
        removers.push(
          store.purchaseUpdatedListener((purchase) => void settle(store, purchase)).remove,
          store.purchaseErrorListener((err) => {
            setBusy(null);
            if (!store.isUserCancelledError(err)) setError(err.message);
          }).remove,
        );
        const [items, subs] = await Promise.all([
          bundles
            ? store.fetchProducts({ skus: bundles.split(','), type: 'in-app' })
            : Promise.resolve([]),
          store.fetchProducts({ skus: [subscriptionId], type: 'subs' }),
        ]);
        if (cancelled) return;
        const found: Record<string, string> = {};
        for (const item of [...(items ?? []), ...(subs ?? [])]) found[item.id] = item.displayPrice;
        const plan = (subs ?? [])
          .flatMap((item) => ('subscriptionOffers' in item ? (item.subscriptionOffers ?? []) : []))
          .find((entry) => entry.offerTokenAndroid);
        setPrices(found);
        setOffer(plan?.offerTokenAndroid ?? null);
        setSdk(store);
        // Purchases interrupted before the server confirmed them are picked up here.
        for (const purchase of await store.getAvailablePurchases()) {
          if (!cancelled) await settle(store, purchase);
        }
      } catch {
        // No Play Store on this device: purchases stay hidden.
      }
    });
    return () => {
      cancelled = true;
      removers.forEach((remove) => remove());
      void loadSdk().then((store) => store?.endConnection().catch(() => undefined));
    };
  }, [available, bundles, blockedCountries, subscriptionId, settle]);

  return {
    ready: Boolean(sdk),
    regionBlocked,
    prices,
    busy,
    error,
    notice,
    buy(product) {
      if (!sdk || busy || !play?.account_id) return;
      setBusy(product);
      setError(null);
      sdk
        .requestPurchase({
          request: { google: { skus: [product], obfuscatedAccountId: play.account_id } },
          type: 'in-app',
        })
        .catch((err: unknown) => {
          setBusy(null);
          setError(err instanceof Error ? err.message : 'Google Play could not start.');
        });
    },
    subscribe() {
      if (!sdk || busy || !offer || !play?.account_id) return;
      setBusy('subscription');
      setError(null);
      sdk
        .requestPurchase({
          request: {
            google: {
              skus: [subscriptionId],
              subscriptionOffers: [{ sku: subscriptionId, offerToken: offer }],
              obfuscatedAccountId: play.account_id,
            },
          },
          type: 'subs',
        })
        .catch((err: unknown) => {
          setBusy(null);
          setError(err instanceof Error ? err.message : 'Google Play could not start.');
        });
    },
    manage() {
      void sdk
        ?.deepLinkToSubscriptions({
          skuAndroid: subscriptionId,
          packageNameAndroid: 'com.miscellary.app',
        })
        .catch(() => setError('Google Play subscriptions could not open.'));
    },
  };
}
