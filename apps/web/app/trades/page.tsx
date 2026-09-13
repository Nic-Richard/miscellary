'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import type { Creator, OwnedCard, TradeOffer } from '@miscellary/shared';
import OfferCard from '@/components/OfferCard';
import OfferInspector from '@/components/OfferInspector';
import Sheet, { Empty } from '@/components/Sheet';
import SwapArrow from '@/components/SwapArrow';
import { Segmented } from '@/components/controls';
import { useAuth } from '@/lib/auth';
import { useRequireAccount } from '@/lib/requireAccount';
import { loginHref } from '@/lib/returnTo';
import { actOnOffer, listOffers } from '@/lib/trades';
import { OwnedCardInspector } from '@/components/CardInspector';
import ui from '@/components/ui.module.css';
import wide from '@/components/pageWide.module.css';
import styles from './page.module.css';

type Box = 'inbox' | 'outbox' | 'history';

function DealMat({ box }: { box: Box }) {
  return (
    <div className={styles.mat}>
      <div className={styles.matSide}>
        <span className={styles.matLabel}>You give</span>
        <span className={styles.matSlots} aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <span key={i} />
          ))}
        </span>
      </div>
      <span className={styles.matArrow} aria-hidden="true">
        <SwapArrow />
      </span>
      <div className={styles.matSide}>
        <span className={styles.matLabel}>They give</span>
        <span className={styles.matSlots} aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <span key={i} />
          ))}
        </span>
      </div>
      <p className={styles.matNote}>
        {box === 'inbox'
          ? 'Nothing on the table. When another collector offers you a trade, it lands here.'
          : box === 'outbox'
            ? 'You have not put anything on the table yet. Find a collector and pick from their cards.'
            : 'Nothing settled yet. Accepted, rejected and cancelled offers are kept here.'}
      </p>
    </div>
  );
}

export default function TradesPage() {
  const { user, loading } = useAuth();
  useRequireAccount();
  const pathname = usePathname();
  const router = useRouter();
  const [box, setBox] = useState<Box>('inbox');
  const [offers, setOffers] = useState<TradeOffer[] | null>(null);
  const [settled, setSettled] = useState<TradeOffer[]>([]);
  const [partner, setPartner] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [inspect, setInspect] = useState<OwnedCard | null>(null);
  const [opened, setOpened] = useState<TradeOffer | null>(null);

  const reload = useCallback(async () => setOffers(await listOffers(box)), [box]);

  useEffect(() => {
    if (!user) return;
    reload().catch((e: Error) => setError(e.message));
  }, [user, reload]);

  useEffect(() => {
    if (!user) return;
    listOffers('history')
      .then(setSettled)
      .catch(() => setSettled([]));
  }, [user]);

  const partners = useMemo(() => {
    const me = user?.profile.username;
    const seen = new Map<string, Creator>();
    for (const offer of settled) {
      const other = offer.sender.username === me ? offer.recipient : offer.sender;
      if (other.username !== me) seen.set(other.username, other);
    }
    return [...seen.values()];
  }, [settled, user]);

  async function act(id: string, action: 'accept' | 'reject' | 'cancel') {
    setBusy(true);
    setError(null);
    try {
      await actOnOffer(id, action);
      setOpened(null);
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
              <Link className={ui.btnPrimary} href={loginHref(pathname)}>
                Log in
              </Link>
            }
          >
            Trading is between collectors, so you need an account to send or receive an offer.
          </Empty>
        </Sheet>
      </section>
    );

  return (
    <div className={wide.page}>
      <span className={wide.lamp} aria-hidden="true" />

      <div className={wide.header}>
        <p className={ui.eyebrow}>Trading</p>
        <h1 className={ui.title}>Trade offers</h1>
        <p className={ui.subtitle}>Offer, counter, accept</p>
      </div>
      {error ? <p className={ui.error}>{error}</p> : null}

      <div className={`${wide.layout} ${wide.layoutPair} ${styles.layout}`}>
        <main className={styles.column}>
          <Sheet
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
              <DealMat box={box} />
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
                    onOpen={setOpened}
                  />
                ))}
              </div>
            )}
          </Sheet>
        </main>

        <aside className={wide.rail}>
          <section className={`${ui.panel} ${wide.railPanel}`}>
            <h2 className={ui.panelTitle}>Start a trade</h2>
            <form className={styles.start} onSubmit={start}>
              <input
                className={ui.input}
                placeholder="@username"
                value={partner}
                onChange={(e) => setPartner(e.target.value)}
                aria-label="Collector to trade with"
                required
              />
              <button className={`${ui.btnPrimary} ${ui.btnSmall}`} type="submit">
                Browse their cards
              </button>
            </form>
            <p className={wide.railNote}>
              Pick from their cards and offer some of yours. Both sides can hold several cards.
            </p>
          </section>

          {partners.length ? (
            <section className={`${ui.panel} ${wide.railPanel}`}>
              <h2 className={ui.panelTitle}>Traded with</h2>
              <ul className={styles.partners}>
                {partners.slice(0, 8).map((person) => (
                  <li key={person.username}>
                    <Link
                      href={`/trades/new?with=${person.username}`}
                      title={`Trade with @${person.username}`}
                    >
                      <span className={styles.partnerMark}>
                        {(person.display_name || person.username)[0]?.toUpperCase()}
                      </span>
                      <span className={styles.partnerName}>
                        {person.display_name || person.username}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section className={`${ui.panel} ${wide.railPanel}`}>
            <h2 className={ui.panelTitle}>How a trade works</h2>
            <ol className={styles.steps}>
              <li>Pick cards from both collections and send the offer.</li>
              <li>They accept, reject, or counter with a different mix.</li>
              <li>Accepting swaps the cards at once. Held cards cannot be recycled.</li>
            </ol>
            <Link href="/collection" className={wide.railLink}>
              See your spare copies
            </Link>
          </section>
        </aside>
      </div>

      {opened ? (
        <OfferInspector
          offer={opened}
          me={user.profile.username}
          busy={busy}
          onAction={(a) => void act(opened.id, a)}
          onInspect={setInspect}
          onClose={() => setOpened(null)}
        />
      ) : null}

      {inspect ? <OwnedCardInspector owned={inspect} onClose={() => setInspect(null)} /> : null}
    </div>
  );
}
