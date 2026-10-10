import { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import type { PackPayment, PaidPackQuote } from '@miscellary/shared';
import { packOdds, packPrice, starAmount } from '@miscellary/shared';
import { useAuth } from '@/lib/auth';
import { getPackStatus } from '@/lib/endpoints';
import { createThemedStyles, fonts } from '@/lib/theme';
import { Button, ErrorText, Muted } from './ui';

export default function ExtraPackAction({
  slug,
  busy,
  onOpen,
}: {
  slug: string;
  busy: boolean;
  onOpen: (payment: PackPayment) => Promise<boolean>;
}) {
  const styles = useStyles();
  const { user } = useAuth();
  const [quote, setQuote] = useState<PaidPackQuote | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [attempt, setAttempt] = useState<PackPayment | null>(null);
  const request = useRef<AbortController | null>(null);
  const sending = useRef(false);

  useEffect(() => {
    setQuote(null);
    setAttempt(null);
    setError(null);
    setLoading(false);
    return () => request.current?.abort();
  }, [slug, user?.id]);

  async function show() {
    if (busy || loading) return;
    const controller = new AbortController();
    request.current?.abort();
    request.current = controller;
    setLoading(true);
    setError(null);
    try {
      const status = await getPackStatus(slug, controller.signal);
      if (!controller.signal.aborted) {
        setQuote(status.paid_quote ?? null);
        if (!status.paid_quote) setError('Extra pack options are not available yet.');
      }
    } catch (err) {
      if (!controller.signal.aborted)
        setError(err instanceof Error ? err.message : 'Could not load pack options.');
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }

  async function confirm(payment: PackPayment) {
    if (busy || sending.current) return;
    sending.current = true;
    setAttempt(payment);
    try {
      if (await onOpen(payment)) {
        setQuote(null);
        setAttempt(null);
      }
    } finally {
      sending.current = false;
    }
  }

  return (
    <View style={styles.root}>
      {quote ? (
        <>
          <Text style={styles.title}>Extra pack · {packPrice(quote)}</Text>
          <Muted>
            You have {starAmount(quote.star_units, quote.units_per_star)} tickets. Set points are
            used first.
          </Muted>
          <Muted>
            Per-card odds: {packOdds(quote)}. Cards are drawn independently; duplicates are
            possible.
          </Muted>
          {attempt ? (
            <Button title="Retry opening" disabled={busy} onPress={() => void confirm(attempt)} />
          ) : (
            <>
              <Button
                title={`Spend ${packPrice(quote)}`}
                disabled={busy || quote.star_units < quote.stars_spent_units}
                onPress={() =>
                  void confirm({
                    payment: 'stars',
                    request_key: quote.request_key,
                    max_stars_units: quote.stars_spent_units,
                  })
                }
              />
              {quote.bonus_packs_remaining > 0 ? (
                <Button
                  title={`Use monthly pack (${quote.bonus_packs_remaining} left)`}
                  kind="secondary"
                  disabled={busy}
                  onPress={() => void confirm({ payment: 'bonus', request_key: quote.request_key })}
                />
              ) : null}
            </>
          )}
          <Button
            title="Cancel"
            kind="secondary"
            disabled={busy}
            onPress={() => {
              setQuote(null);
              setAttempt(null);
            }}
          />
        </>
      ) : (
        <Button
          title={loading ? 'Loading options…' : 'Extra pack options'}
          kind="secondary"
          disabled={busy || loading}
          onPress={() => void show()}
        />
      )}
      <ErrorText>{error}</ErrorText>
    </View>
  );
}

const useStyles = createThemedStyles((colors) => ({
  root: { gap: 10, alignSelf: 'stretch' },
  title: { color: colors.text, fontFamily: fonts.medium, fontSize: 16 },
}));
