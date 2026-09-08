import { useEffect, useMemo, useRef, useState } from 'react';
import type { Card } from '@miscellary/shared';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Image,
  PanResponder,
  StyleSheet,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import NativeBinder from './NativeBinder';
import NativePortraitBinderPager from './NativePortraitBinderPager';

const BINDER_RATIO = 1028 / 625;
const TURN_MS = 600;
const PAGE_OUTER = 0.027;
const PAGE_INNER = 0.52;
const PAGE_WIDTH = 1 - PAGE_INNER - PAGE_OUTER;
const SWIPE_ACTIVATION = 4;
const SWIPE_COMMIT_DISTANCE = 0.1;
const SWIPE_COMMIT_VELOCITY = 0.25;

interface Turn {
  from: number;
  to: number;
  direction: -1 | 1;
}

interface NativeBinderPagerProps {
  cards: Array<Card | null | undefined>;
  page: number;
  pages: number;
  half: boolean;
  mark?: string;
  marks?: Array<string | undefined>;
  colour?: string;
  onPageChange: (page: number) => void;
  onInspect: (id: string, index: number) => void;
  onPickEmpty?: (index: number) => void;
  onRemove?: (index: number) => void;
}

interface BinderViewProps {
  cards: Array<Card | null | undefined>;
  page: number;
  half: boolean;
  mark?: string;
  marks?: Array<string | undefined>;
  colour?: string;
  viewportWidth?: number;
  onInspect: (id: string, index: number) => void;
  onPickEmpty?: (index: number) => void;
  onRemove?: (index: number) => void;
}

function BinderView(props: BinderViewProps) {
  return <NativeBinder {...props} />;
}

function BinderPage({
  side,
  width,
  ...props
}: Omit<BinderViewProps, 'half'> & { side: 'left' | 'right'; width: number }) {
  const offset = width * (side === 'right' ? PAGE_INNER : PAGE_OUTER);
  return (
    <View style={{ width: width * PAGE_WIDTH, height: width / BINDER_RATIO, overflow: 'hidden' }}>
      <View style={{ width, transform: [{ translateX: -offset }] }}>
        <BinderView {...props} half={false} />
      </View>
    </View>
  );
}

function LandscapeBinderPager({
  cards,
  page,
  pages,
  half,
  mark,
  marks,
  colour,
  onPageChange,
  onInspect,
  onPickEmpty,
  onRemove,
}: NativeBinderPagerProps) {
  const progress = useRef(new Animated.Value(0)).current;
  const progressValue = useRef(0);
  const widthRef = useRef(0);
  const pageRef = useRef(page);
  const pagesRef = useRef(pages);
  const stepRef = useRef(half ? 1 : 2);
  const reduceMotionRef = useRef(false);
  const onPageChangeRef = useRef(onPageChange);
  const animationRef = useRef<Animated.CompositeAnimation | null>(null);
  const cleanupFrameRef = useRef<number | null>(null);
  const turnRef = useRef<Turn | null>(null);
  const [width, setWidth] = useState(0);
  const [shownPage, setShownPage] = useState(page);
  const [turn, setTurn] = useState<Turn | null>(null);

  pageRef.current = shownPage;
  pagesRef.current = pages;
  stepRef.current = half ? 1 : 2;
  onPageChangeRef.current = onPageChange;

  useEffect(() => {
    const listener = progress.addListener(({ value }) => {
      progressValue.current = value;
    });
    return () => progress.removeListener(listener);
  }, [progress]);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => {
        reduceMotionRef.current = value;
      })
      .catch(() => undefined);
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', (value) => {
      reduceMotionRef.current = value;
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    const urls = new Set(cards.flatMap((card) => (card?.image.url ? [card.image.url] : [])));
    for (const url of urls) void Image.prefetch(url).catch(() => undefined);
  }, [cards]);

  function begin(target: number) {
    const maximum = Math.max(0, pagesRef.current - stepRef.current);
    const next = Math.max(0, Math.min(maximum, target));
    const from = pageRef.current;
    if (next === from) return null;
    const nextTurn: Turn = { from, to: next, direction: next > from ? 1 : -1 };
    animationRef.current?.stop();
    if (cleanupFrameRef.current !== null) cancelAnimationFrame(cleanupFrameRef.current);
    progress.setValue(0);
    turnRef.current = nextTurn;
    setTurn(nextTurn);
    return nextTurn;
  }

  function settle(commit: boolean, notify: boolean) {
    const active = turnRef.current;
    if (!active) return;
    const destination = commit ? 1 : 0;
    animationRef.current?.stop();
    animationRef.current = Animated.timing(progress, {
      toValue: destination,
      duration: reduceMotionRef.current
        ? 0
        : Math.max(120, TURN_MS * Math.abs(destination - progressValue.current)),
      easing: Easing.bezier(0.32, 0, 0.18, 1),
      useNativeDriver: true,
    });
    animationRef.current.start(({ finished }) => {
      if (!finished) return;
      if (commit) {
        pageRef.current = active.to;
        setShownPage(active.to);
        if (notify) onPageChangeRef.current(active.to);
        cleanupFrameRef.current = requestAnimationFrame(() => {
          cleanupFrameRef.current = requestAnimationFrame(() => {
            if (turnRef.current !== active) return;
            turnRef.current = null;
            setTurn(null);
            cleanupFrameRef.current = null;
          });
        });
        return;
      }
      turnRef.current = null;
      setTurn(null);
    });
  }

  useEffect(() => {
    if (page === pageRef.current || turnRef.current?.to === page) return;
    const active = begin(page);
    if (!active) return;
    requestAnimationFrame(() => settle(true, false));
  }, [page]);

  useEffect(
    () => () => {
      animationRef.current?.stop();
      if (cleanupFrameRef.current !== null) cancelAnimationFrame(cleanupFrameRef.current);
    },
    [],
  );

  const panResponder = useMemo(() => {
    const wantsHorizontalGesture = (_: unknown, gesture: { dx: number; dy: number }) =>
      Math.abs(gesture.dx) > SWIPE_ACTIVATION && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 0.9;
    return PanResponder.create({
      onMoveShouldSetPanResponder: wantsHorizontalGesture,
      onMoveShouldSetPanResponderCapture: wantsHorizontalGesture,
      onPanResponderMove: (_, gesture) => {
        const direction: -1 | 1 = gesture.dx < 0 ? 1 : -1;
        let active = turnRef.current;
        if (!active) {
          active = begin(pageRef.current + direction * stepRef.current);
        }
        if (active?.direction !== direction) return;
        progress.setValue(Math.min(1, Math.abs(gesture.dx) / Math.max(1, widthRef.current * 0.72)));
      },
      onPanResponderRelease: (_, gesture) => {
        if (!turnRef.current) return;
        const commit =
          Math.abs(gesture.dx) > widthRef.current * SWIPE_COMMIT_DISTANCE ||
          Math.abs(gesture.vx) > SWIPE_COMMIT_VELOCITY;
        settle(commit, commit);
      },
      onPanResponderTerminationRequest: () => false,
      onPanResponderTerminate: () => settle(false, false),
    });
  }, []);

  const frontRotation = progress.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: turn?.direction === -1 ? ['0deg', '90deg', '90deg'] : ['0deg', '-90deg', '-90deg'],
  });
  const backRotation = progress.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: turn?.direction === -1 ? ['-90deg', '-90deg', '0deg'] : ['90deg', '90deg', '0deg'],
  });
  const fold = progress.interpolate({
    inputRange: [0, 0.48, 1],
    outputRange: [0, 0.52, 0.08],
  });
  const frontOpacity = progress.interpolate({
    inputRange: [0, 0.499, 0.5, 1],
    outputRange: [1, 1, 0, 0],
  });
  const backOpacity = progress.interpolate({
    inputRange: [0, 0.499, 0.5, 1],
    outputRange: [0, 0, 1, 1],
  });
  const height = width / (half ? BINDER_RATIO / 2 : BINDER_RATIO);
  const leafWidth = half ? width : width * PAGE_WIDTH;
  const currentProps = {
    cards,
    page: turn?.from ?? shownPage,
    mark,
    marks,
    colour,
    viewportWidth: width,
    onInspect,
    onPickEmpty,
    onRemove,
  };
  const targetProps = {
    cards,
    page: turn?.to ?? shownPage,
    mark,
    marks,
    colour,
    viewportWidth: width,
    onInspect,
    onPickEmpty,
    onRemove,
  };

  return (
    <View
      {...panResponder.panHandlers}
      onLayout={(event) => {
        const nextWidth = event.nativeEvent.layout.width;
        widthRef.current = nextWidth;
        setWidth(nextWidth);
      }}
      style={{ width: '100%', aspectRatio: half ? BINDER_RATIO / 2 : BINDER_RATIO }}
    >
      {width > 0 ? (
        <>
          <BinderView
            cards={cards}
            page={shownPage}
            half={half}
            mark={mark}
            marks={marks}
            colour={colour}
            viewportWidth={width}
            onInspect={onInspect}
            onPickEmpty={onPickEmpty}
            onRemove={onRemove}
          />
          {turn ? (
            <>
              {!half ? (
                <View
                  pointerEvents="none"
                  renderToHardwareTextureAndroid
                  style={[
                    styles.half,
                    {
                      left: width * (turn.direction === 1 ? PAGE_INNER : PAGE_OUTER),
                      width: width * PAGE_WIDTH,
                      height,
                      zIndex: 1,
                    },
                  ]}
                >
                  <BinderPage
                    {...targetProps}
                    side={turn.direction === 1 ? 'right' : 'left'}
                    width={width}
                  />
                </View>
              ) : null}

              <Animated.View
                pointerEvents="none"
                collapsable={false}
                renderToHardwareTextureAndroid
                style={[
                  styles.face,
                  {
                    left: !half && turn.direction === 1 ? width * PAGE_INNER : width * PAGE_OUTER,
                    width: leafWidth,
                    height,
                    zIndex: 2,
                    opacity: frontOpacity,
                    transformOrigin: turn.direction === 1 ? 'left center' : 'right center',
                    transform: [{ perspective: 1800 }, { rotateY: frontRotation }],
                  },
                ]}
              >
                {half ? (
                  <BinderView {...currentProps} half />
                ) : (
                  <BinderPage
                    {...currentProps}
                    side={turn.direction === 1 ? 'right' : 'left'}
                    width={width}
                  />
                )}
                <Animated.View style={[StyleSheet.absoluteFill, { opacity: fold }]}>
                  <LinearGradient
                    colors={
                      turn.direction === 1
                        ? ['rgba(35, 23, 8, 0.05)', 'rgba(35, 23, 8, 0.55)']
                        : ['rgba(35, 23, 8, 0.55)', 'rgba(35, 23, 8, 0.05)']
                    }
                    style={StyleSheet.absoluteFill}
                    start={{ x: 0, y: 0.5 }}
                    end={{ x: 1, y: 0.5 }}
                  />
                </Animated.View>
              </Animated.View>

              <Animated.View
                pointerEvents="none"
                collapsable={false}
                renderToHardwareTextureAndroid
                style={[
                  styles.face,
                  {
                    left: !half && turn.direction === -1 ? width * PAGE_INNER : width * PAGE_OUTER,
                    width: leafWidth,
                    height,
                    zIndex: 2,
                    opacity: backOpacity,
                    transformOrigin: turn.direction === 1 ? 'right center' : 'left center',
                    transform: [{ perspective: 1800 }, { rotateY: backRotation }],
                  },
                ]}
              >
                {half ? (
                  <BinderView {...targetProps} half />
                ) : (
                  <BinderPage
                    {...targetProps}
                    side={turn.direction === 1 ? 'left' : 'right'}
                    width={width}
                  />
                )}
              </Animated.View>
            </>
          ) : null}
        </>
      ) : null}
    </View>
  );
}

export default function NativeBinderPager(props: NativeBinderPagerProps) {
  return props.half ? (
    <NativePortraitBinderPager {...props} />
  ) : (
    <LandscapeBinderPager {...props} />
  );
}

const styles = StyleSheet.create({
  half: {
    position: 'absolute',
    top: 0,
    overflow: 'hidden',
  },
  face: {
    position: 'absolute',
    top: 0,
    backfaceVisibility: 'hidden',
    overflow: 'hidden',
  },
});
