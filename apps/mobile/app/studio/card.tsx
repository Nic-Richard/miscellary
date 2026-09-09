import type { CardSetDetail, CardTemplate } from '@miscellary/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import SharedSurface from '@/components/SharedSurface';
import { ErrorText, Loading } from '@/components/ui';
import { getMySet, listTemplates } from '@/lib/endpoints';
import { colors } from '@/lib/theme';

export default function CardScreen() {
  const { setId, cardId } = useLocalSearchParams<{ setId: string; cardId?: string }>();
  const [set, setSet] = useState<CardSetDetail | null>(null);
  const [templates, setTemplates] = useState<CardTemplate[]>([]);
  const [error, setError] = useState('');
  useEffect(() => {
    let cancelled = false;
    void Promise.all([getMySet(setId), listTemplates()])
      .then(([value, list]) => {
        if (cancelled) return;
        if (value.status !== 'draft') {
          setError('Published cards cannot be edited.');
          return;
        }
        if (cardId && !value.cards.some((card) => card.id === cardId)) {
          setError('Card not found.');
          return;
        }
        setSet(value);
        setTemplates(list);
      })
      .catch((reason) => {
        if (!cancelled) setError(reason.message);
      });
    return () => {
      cancelled = true;
    };
  }, [setId, cardId]);
  if (error) return <ErrorText>{error}</ErrorText>;
  if (!set || !templates.length) return <Loading />;
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <SharedSurface
        mode="card-editor"
        data={{
          setId,
          mark: set.mark,
          templates,
          card: set.cards.find((card) => card.id === cardId) ?? null,
        }}
        onEvent={(type) => {
          if (type === 'saved' || type === 'close') router.back();
        }}
      />
    </View>
  );
}
