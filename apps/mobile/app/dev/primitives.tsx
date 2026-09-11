import { Modal, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Defs, RadialGradient, Rect, Stop, Mask } from 'react-native-svg';
import { useCallback, useEffect, useState } from 'react';
import { CARD_FIXTURES, cardCode, RECYCLE_VALUE } from '@miscellary/shared';
import type { Card, CardSetDetail, PackOpening } from '@miscellary/shared';
import CardInspector from '@/components/CardInspector';
import CardPreview from '@/components/CardPreview';
import PackPreview from '@/components/PackPreview';
import PackReveal from '@/components/PackReveal';
import { Button, ErrorText, Loading, Muted } from '@/components/ui';
import { getMySet, getPublicSet, listMySets, listPublicSets } from '@/lib/endpoints';
import { colors, fonts } from '@/lib/theme';

function RealCards() {
  const [cards, setCards] = useState<{ card: Card; mark?: string }[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const found: { card: Card; mark?: string }[] = [];
      try {
        const mine = await listMySets();
        const details = await Promise.all(mine.slice(0, 4).map((set) => getMySet(set.id)));
        for (const detail of details)
          for (const card of detail.cards) found.push({ card, mark: detail.mark });
      } catch {
        // Signed out or no sets of your own; fall back to a published set.
      }
      if (!found.length) {
        const page = await listPublicSets('new', null);
        const first = page.results[0];
        if (first) {
          const detail = await getPublicSet(first.slug);
          for (const card of detail.cards) found.push({ card, mark: detail.mark });
        }
      }
      setCards(found.filter((entry) => entry.card.image?.url).slice(0, 8));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not load cards.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <>
      <Text style={styles.title}>Real cards</Text>
      <Text style={styles.note}>
        Live cards with their uploaded photos. Add or edit a card in Studio, then reload to check it
        renders after saving and reopening.
      </Text>
      <Button title="Reload" kind="secondary" onPress={() => void load()} />
      {loading ? <Loading /> : null}
      {error ? <ErrorText>{error}</ErrorText> : null}
      {!loading && !error && !cards.length ? <Muted>No cards with photos yet.</Muted> : null}
      {cards.map(({ card, mark }) => (
        <View key={card.id} style={{ gap: 6 }}>
          <Text style={styles.label}>
            {card.title} · {card.template_key} · {card.rarity}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
            {[100, 150].map((w) => (
              <CardPreview
                key={w}
                width={w}
                title={card.title}
                rarity={card.rarity}
                description={card.description}
                printedText={card.printed_text}
                imageUrl={card.image.url}
                templateKey={card.template_key}
                templateConfig={card.template_config}
                code={cardCode(card.printed_set_code, card.position, card.set_total)}
                mark={mark}
                render={card.render}
              />
            ))}
          </View>
          <CardPreview
            width={300}
            title={card.title}
            rarity={card.rarity}
            description={card.description}
            printedText={card.printed_text}
            imageUrl={card.image.url}
            templateKey={card.template_key}
            templateConfig={card.template_config}
            code={cardCode(card.printed_set_code, card.position, card.set_total)}
            mark={mark}
            render={card.render}
          />
        </View>
      ))}
    </>
  );
}

function InspectorGallery() {
  const [open, setOpen] = useState(false);
  const fixture = CARD_FIXTURES.find((entry) => entry.rarity === 'legendary') ?? CARD_FIXTURES[0]!;
  const card: Card = {
    id: 'inspector-fixture',
    title: 'After the Signal',
    rarity: fixture.rarity,
    description: 'A final transmission caught between stations.\nGold ink, midnight stock.',
    printed_text: 'Gold ink, midnight stock.',
    image: {
      id: 'inspector-image',
      kind: 'card',
      url: '',
      width: 1200,
      height: 1600,
      ready: true,
    },
    template_key: fixture.templateKey,
    template_version: 1,
    template_config: fixture.config,
    position: 6,
    printed_set_code: 'SIG-01',
    set_total: 24,
    like_count: 0,
  };

  return (
    <>
      <Text style={styles.title}>Card inspector</Text>
      <Text style={styles.note}>
        Check touch rotation, card-back rendering, controls, and responsive fitting in the shared
        inspector.
      </Text>
      <Button title="Open inspector" kind="secondary" onPress={() => setOpen(true)} />
      <Modal
        visible={open}
        statusBarTranslucent
        navigationBarTranslucent
        supportedOrientations={['portrait', 'landscape']}
        onRequestClose={() => setOpen(false)}
      >
        {open ? (
          <CardInspector
            card={card}
            setTitle="Night Signals"
            setSlug="night-signals"
            mark="moon"
            packColour="indigo"
            onClose={() => setOpen(false)}
          />
        ) : null}
      </Modal>
    </>
  );
}

function PackGallery() {
  const [set, setSet] = useState<CardSetDetail | null>(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    void listPublicSets('new', null)
      .then((page) => {
        const first = page.results[0];
        if (first) return getPublicSet(first.slug);
        return null;
      })
      .then(setSet)
      .catch((reason) =>
        setError(reason instanceof Error ? reason.message : 'Could not load pack.'),
      );
  }, []);

  const opening: PackOpening | null = set?.cards.length
    ? {
        id: 'pack-fixture',
        kind: 'free',
        card_set: set,
        cards: set.cards.slice(0, Math.min(set.pack_size, 10)).map((card, index) => ({
          id: `pack-pull-${index}`,
          card,
          set_slug: set.slug,
          set_title: set.title,
          set_mark: set.mark,
          set_pack_colour: set.pack_colour,
          copies: index % 4 === 0 ? 2 : 1,
          held: false,
          acquired_at: new Date().toISOString(),
        })),
        opened_at: new Date().toISOString(),
        status: {
          free_available: false,
          points: 0,
          pack_cost: 50,
          pack_size: set.pack_size,
          recycle_values: RECYCLE_VALUE,
          resets_at: new Date(Date.now() + 86_400_000).toISOString(),
        },
      }
    : null;

  return (
    <>
      <Text style={styles.title}>Pack surfaces</Text>
      <Text style={styles.note}>
        Check the saved pack front and the shared opening flow against current set data.
      </Text>
      {error ? <ErrorText>{error}</ErrorText> : null}
      {!set && !error ? <Loading /> : null}
      {set ? <PackPreview set={set} width={140} /> : null}
      {opening ? <Button title="Open pack" kind="secondary" onPress={() => setOpen(true)} /> : null}
      {open && opening ? <PackReveal opening={opening} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function Probe({
  label,
  expect,
  clip = true,
  children,
}: {
  label: string;
  expect: string;
  clip?: boolean;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.probe}>
      <View style={[styles.swatch, !clip && styles.unclipped]}>{children}</View>
      <View style={styles.copy}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.expect}>{expect}</Text>
      </View>
    </View>
  );
}

function Blend({
  mode,
  back = '#00ff00',
  over = '#ff0000',
}: {
  mode: 'multiply' | 'screen' | 'overlay' | 'soft-light';
  back?: string;
  over?: string;
}) {
  return (
    <View style={[styles.fill, { isolation: 'isolate', backgroundColor: back }]}>
      <View style={[styles.fill, { backgroundColor: over, mixBlendMode: mode }]} />
    </View>
  );
}

export default function PrimitivesScreen() {
  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={styles.page}>
      <Stack.Screen options={{ title: 'Rendering checks' }} />
      <RealCards />
      <InspectorGallery />
      <PackGallery />

      <Text style={styles.title}>Renderer primitives</Text>
      <Text style={styles.note}>
        {Platform.OS} {String(Platform.Version)} · new architecture required for blend, filter and
        box shadow
      </Text>

      <Probe label="mixBlendMode multiply" expect="Solid black (red x green)">
        <Blend mode="multiply" />
      </Probe>
      <Probe label="mixBlendMode screen" expect="Solid yellow (red + green)">
        <Blend mode="screen" />
      </Probe>
      <Probe
        label="mixBlendMode overlay"
        expect="Light amber, near #ffd478. Solid white means no blend"
      >
        <Blend mode="overlay" back="#c66a3c" over="#ffffff" />
      </Probe>
      <Probe
        label="mixBlendMode soft-light"
        expect="Lightened terracotta, near #e1a47c. Subtler than overlay; white means no blend"
      >
        <Blend mode="soft-light" back="#c66a3c" over="#ffffff" />
      </Probe>

      <Probe label="boxShadow inset" expect="Cream square with a dark inner rim on all sides">
        <View
          style={[
            styles.fill,
            {
              backgroundColor: '#f4ecda',
              boxShadow: [
                {
                  offsetX: 0,
                  offsetY: 0,
                  blurRadius: 10,
                  spreadDistance: 2,
                  color: '#281808',
                  inset: true,
                },
              ],
            },
          ]}
        />
      </Probe>
      <Probe
        label="boxShadow outset"
        expect="Small cream square with a dark shadow below and right of it"
        clip={false}
      >
        <View
          style={{
            width: 44,
            height: 44,
            margin: 14,
            backgroundColor: '#f4ecda',
            boxShadow: [{ offsetX: 4, offsetY: 6, blurRadius: 8, color: 'rgba(0,0,0,0.65)' }],
          }}
        />
      </Probe>

      <Probe label="filter grayscale(1)" expect="Fully grey, no colour left">
        <View style={[styles.fill, { backgroundColor: '#c66a3c', filter: [{ grayscale: 1 }] }]} />
      </Probe>
      <Probe label="filter sepia + saturate" expect="Warmer, more saturated orange">
        <View
          style={[
            styles.fill,
            { backgroundColor: '#c66a3c', filter: [{ sepia: 0.6 }, { saturate: 1.4 }] },
          ]}
        />
      </Probe>
      <Probe label="filter brightness(1.4)" expect="Noticeably lighter orange">
        <View
          style={[styles.fill, { backgroundColor: '#c66a3c', filter: [{ brightness: 1.4 }] }]}
        />
      </Probe>

      <Probe label="experimental_backgroundImage" expect="Diagonal gold to purple gradient">
        <View
          style={[
            styles.fill,
            {
              experimental_backgroundImage: [
                {
                  type: 'linearGradient',
                  direction: '135deg',
                  colorStops: [{ color: '#b8903a' }, { color: '#7b5fa3' }],
                },
              ],
            },
          ]}
        />
      </Probe>
      <Probe label="expo-linear-gradient" expect="Same diagonal gold to purple gradient">
        <LinearGradient
          colors={['#b8903a', '#7b5fa3']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.fill}
        />
      </Probe>

      <Probe label="SVG radial gradient" expect="Pale centre fading to dark at the edges">
        <Svg width="100%" height="100%">
          <Defs>
            <RadialGradient id="r" cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor="#f7ecc2" />
              <Stop offset="1" stopColor="#3b2438" />
            </RadialGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#r)" />
        </Svg>
      </Probe>
      <Probe label="SVG mask" expect="Teal circle only; corners are empty">
        <Svg width="100%" height="100%">
          <Defs>
            <Mask id="m">
              <Circle cx="50%" cy="50%" r="42%" fill="#fff" />
            </Mask>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill="#17434a" mask="url(#m)" />
        </Svg>
      </Probe>

      <Probe label="Blend over SVG" expect="Black circle, proving blend crosses SVG and View">
        <View style={[styles.fill, { isolation: 'isolate', backgroundColor: '#00ff00' }]}>
          <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
            <Circle cx="50%" cy="50%" r="42%" fill="#ff0000" />
          </Svg>
          <View
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor: '#00ff00', mixBlendMode: 'multiply' },
            ]}
          />
        </View>
      </Probe>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: 16, gap: 12, paddingBottom: 48 },
  title: { fontFamily: fonts.display, fontSize: 28, color: colors.text },
  note: { fontFamily: fonts.body, fontSize: 13, color: colors.muted, marginBottom: 4 },
  probe: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  swatch: {
    width: 72,
    height: 72,
    borderRadius: 4,
    overflow: 'hidden',
    backgroundColor: colors.sur2,
  },
  unclipped: { overflow: 'visible' },
  copy: { flex: 1 },
  fill: { width: '100%', height: '100%' },
  label: { fontFamily: fonts.medium, fontSize: 15, color: colors.text },
  expect: { fontFamily: fonts.body, fontSize: 13, color: colors.muted },
});
