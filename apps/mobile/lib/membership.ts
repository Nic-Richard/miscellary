import { useEffect, useState } from 'react';
import type { Membership } from '@miscellary/shared';
import { apiFetch } from './api';
import { useAuth } from './auth';

export interface MembershipState {
  /** Memberships can be bought or used at all. */
  enabled: boolean;
  supporter: boolean;
  /** Whole tickets held; can be negative after a refund. */
  tickets: number;
}

const OFF: MembershipState = { enabled: false, supporter: false, tickets: 0 };
let cached: { userId: string; request: Promise<MembershipState> } | null = null;
const listeners = new Set<() => void>();
const statusListeners = new Set<() => void>();

/** Runs whenever tickets, packs or anything else in the status bar may have changed. */
export function onStatusChange(listener: () => void) {
  statusListeners.add(listener);
  return () => {
    statusListeners.delete(listener);
  };
}

export function statusChanged() {
  statusListeners.forEach((listener) => listener());
}

/** Fetch the membership again, for example after tickets are spent or bought. */
export function refreshMembership() {
  cached = null;
  listeners.forEach((listener) => listener());
  statusChanged();
}

// Shared by the nav, prompts and locked features, so the membership is fetched once per user.
export function useMembership(): MembershipState {
  const { user } = useAuth();
  const [state, setState] = useState<MembershipState>(OFF);
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const listener = () => setVersion((value) => value + 1);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);
  useEffect(() => {
    if (!user) {
      setState(OFF);
      return;
    }
    if (!cached || cached.userId !== user.id) {
      cached = {
        userId: user.id,
        request: apiFetch<Membership>('/api/v1/me/membership/')
          .then((data) => ({
            enabled: data.enabled,
            supporter: data.subscription.active,
            tickets: Math.floor(data.star_units / data.units_per_star),
          }))
          .catch(() => OFF),
      };
    }
    let live = true;
    void cached.request.then((value) => {
      if (live) setState(value);
    });
    return () => {
      live = false;
    };
  }, [user, version]);
  return state;
}
