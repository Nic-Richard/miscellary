import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Defs, RadialGradient, Rect, Stop, Mask } from 'react-native-svg';
import { colors, fonts } from '@/lib/theme';

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
      <Stack.Screen options={{ title: 'Primitives' }} />
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
