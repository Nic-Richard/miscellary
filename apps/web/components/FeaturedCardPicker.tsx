'use client';

import { useEffect, useState } from 'react';
import type { LoungeCard, OwnedCard } from '@miscellary/shared';
import { cardCode } from '@miscellary/shared';
import CardPreview from '@/components/CardPreview';
import SupporterPrompt from '@/components/SupporterPrompt';
import CardPicker from '@/components/lounge/CardPicker';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { userSummary } from '@/lib/lounge';
import { useMembership } from '@/lib/membership';
import ui from './ui.module.css';
import styles from './FeaturedCardPicker.module.css';

export default function FeaturedCardPicker() {
  const { user } = useAuth();
  const { enabled, supporter } = useMembership();
  const [card, setCard] = useState<LoungeCard | null>(null);
  const [choosing, setChoosing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user || !supporter) return;
    void userSummary(user.profile.username, true)
      .then((summary) => setCard(summary.featured_card))
      .catch(() => undefined);
  }, [user, supporter]);

  if (!enabled) return null;

  async function save(owned: OwnedCard | null) {
    setError(null);
    try {
      const result = await apiFetch<{ featured_card: LoungeCard | null }>(
        '/api/v1/me/featured-card/',
        { method: 'PUT', body: { owned_card_id: owned?.id ?? null } },
      );
      setCard(result.featured_card);
      setChoosing(false);
      if (user) void userSummary(user.profile.username, true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not change your featured card.');
    }
  }

  return (
    <div className={styles.featured}>
      <span className={ui.label}>Featured card</span>
      {!supporter ? (
        <SupporterPrompt>
          Supporters can feature a card on their profile and in their Lounge preview.
        </SupporterPrompt>
      ) : (
        <>
          <div className={styles.current}>
            {card ? (
              <span className={styles.card}>
                <CardPreview
                  title={card.title}
                  rarity={card.rarity}
                  imageUrl={card.image?.url ?? null}
                  templateKey={card.template_key}
                  templateConfig={card.template_config}
                  code={cardCode(card.printed_set_code, card.position, card.set_total)}
                  printedText={card.printed_text}
                  render={card.render}
                  previewThumbnail
                  renderMode="flat"
                />
              </span>
            ) : (
              <span className={styles.empty} aria-hidden="true" />
            )}
            <span className={styles.text}>
              <b>{card ? card.title : 'No featured card'}</b>
              <small>{card ? card.set_title : 'Shown on your profile and in the Lounge.'}</small>
            </span>
            <span className={styles.buttons}>
              <button
                type="button"
                className={`${ui.btnOutline} ${ui.btnSmall}`}
                onClick={() => setChoosing((value) => !value)}
              >
                {card ? 'Change' : 'Choose a card'}
              </button>
              {card && (
                <button
                  type="button"
                  className={`${ui.btnQuiet} ${ui.btnSmall}`}
                  onClick={() => void save(null)}
                >
                  Remove
                </button>
              )}
            </span>
          </div>
          {choosing && (
            <CardPicker
              max={1}
              selected={[]}
              onChange={(cards) => {
                if (cards[0]) void save(cards[0]);
              }}
            />
          )}
        </>
      )}
      {error && (
        <p role="alert" className={ui.error}>
          {error}
        </p>
      )}
    </div>
  );
}
