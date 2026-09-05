'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import type { OwnedCard, TradeOffer } from '@miscellary/shared';
import OfferCard from '@/components/OfferCard';
import Sheet, { Empty } from '@/components/Sheet';
import { Segmented } from '@/components/controls';
import { useAuth } from '@/lib/auth';
import { actOnOffer, listOffers } from '@/lib/trades';
import { OwnedCardInspector } from '@/components/CardInspector';
import ui from '@/components/ui.module.css';
import styles from './page.module.css';

type Box = 'inbox' | 'outbox' | 'history';

export default function TradesPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [box, setBox] = useState<Box>('inbox');
  const [offers, setOffers] = useState<TradeOffer[] | null>(null);
  const [partner, setPartner] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [inspect, setInspect] = useState<OwnedCard | null>(null);

  const reload = useCallback(async () => setOffers(await listOffers(box)), [box]);

  useEffect(() => {
    if (!user) return;
    reload().catch((e: Error) => setError(e.message));
  }, [user, reload]);

  async function act(id: string, action: 'accept' | 'reject' | 'cancel') {
    setBusy(true);
    setError(null);
    try {
      await actOnOffer(id, action);
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  }

  function start(e: FormEvent) {
    e.preventDefault();
    router.push(`/trades/new?with=${encodeURIComponent(partner.trim().replace(/^@/, ''))}`);
  }

  if (loading) return <p className={ui.muted}>Loading…</p>;
  if (!user)
    return (
      <section>
        <p className={ui.eyebrow}>Trading</p>
        <h1 className={ui.title}>Trade offers</h1>
        <Sheet className={styles.sheet}>
          <Empty
            icon="trade"
            action={
              <Link className={ui.btnPrimary} href="/login">
                Log in
              </Link>
            }
          >
            Trading is between collectors, so you need an account to send or receive an offer.
          </Empty>
        </Sheet>
      </section>
    );

  const EMPTY: Record<Box, string> = {
    inbox: 'No offers waiting on you. When another collector proposes a trade it lands here.',
    outbox: 'You have not offered anyone a trade yet. Find a collector and pick from their cards.',
    history: 'Nothing settled yet. Accepted, rejected and cancelled offers are kept here.',
  };

  return (
    <section>
      <p className={ui.eyebrow}>Trading</p>
      <h1 className={ui.title}>Trade offers</h1>
      <p className={ui.subtitle}>Offer, counter, accept</p>

      <form className={styles.start} onSubmit={start}>
        <input
          className={ui.input}
          placeholder="Start a trade with @username"
          value={partner}
          onChange={(e) => setPartner(e.target.value)}
          required
        />
        <button className={ui.btnPrimary} type="submit">
          Browse their cards
        </button>
      </form>

      {error ? <p className={ui.error}>{error}</p> : null}

      <Sheet
        className={styles.sheet}
        title={box}
        meta={
          offers === null
            ? 'Loading'
            : `${offers.length} ${offers.length === 1 ? 'offer' : 'offers'}`
        }
        actions={
          <Segmented
            value={box}
            values={['inbox', 'outbox', 'history']}
            onChange={(v) => setBox(v as Box)}
          />
        }
      >
        {offers === null ? (
          <Empty icon="trade">Loading…</Empty>
        ) : offers.length === 0 ? (
          <Empty icon="trade">{EMPTY[box]}</Empty>
        ) : (
          <div className={styles.list}>
            {offers.map((o) => (
              <OfferCard
                key={o.id}
                offer={o}
                me={user.profile.username}
                busy={busy}
                onAction={(a) => void act(o.id, a)}
                onInspect={setInspect}
              />
            ))}
          </div>
        )}
      </Sheet>

      {inspect ? <OwnedCardInspector owned={inspect} onClose={() => setInspect(null)} /> : null}
    </section>
  );
}
