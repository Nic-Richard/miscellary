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

const BINDER_RATIO = 1028 / 625;
const TURN_MS = 430;
const PAGE_OUTER = 0.054;
const PAGE_INNER = 0.04;
const PAGE_WIDTH = 1 - PAGE_OUTER - PAGE_INNER;
const SWIPE_ACTIVATION = 4;
const SWIPE_COMMIT_DISTANCE = 0.1;
const SWIPE_COMMIT_VELOCITY = 0.25;

interface Turn {
  from: number;
  to: number;
  direction: -1 | 1;
  crossing: boolean;
}

export default function NativePortraitBinderPager({
  cards,
  page,
  pages,
  mark,
  marks,
  colour,
  onPageChange,
  onInspect,
  onPickEmpty,
  onRemove,
}: {
  cards: Array<Card | null | undefined>;
  page: number;
  pages: number;
  mark?: string;
  marks?: Array<string | undefined>;
  colour?: string;
  onPageChange: (page: number) => void;
  onInspect: (id: string, index: number) => void;
  onPickEmpty?: (index: number) => void;
  onRemove?: (index: number) => void;
}) {
  const progress = useRef(new Animated.Value(0)).current;
  const progressValue = useRef(0);
  const widthRef = useRef(0);
  const pageRef = useRef(page);
  const pagesRef = useRef(pages);
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
    const next = Math.max(0, Math.min(pagesRef.current - 1, target));
    const from = pageRef.current;
    if (next === from) return null;
    const nextTurn: Turn = {
      from,
      to: next,
      direction: next > from ? 1 : -1,
      crossing: Math.floor(from / 2) !== Math.floor(next / 2),
    };
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
        if (!active) active = begin(pageRef.current + direction);
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

  const height = width / (BINDER_RATIO / 2);
  const leafLeft = width * ((turn?.from ?? shownPage) % 2 === 0 ? PAGE_OUTER : PAGE_INNER);
  const leafWidth = width * PAGE_WIDTH;
  const withinStart = turn ? -(turn.from % 2) * width : 0;
  const withinEnd = turn ? -(turn.to % 2) * width : 0;
  const withinTranslate = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [withinStart, withinEnd],
  });
  const leafRotation = progress.interpolate({
    inputRange: [0, 1],
    outputRange: turn?.direction === -1 ? ['0deg', '92deg'] : ['0deg', '-92deg'],
  });
  const leafSweep = progress.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange:
      turn?.direction === -1 ? [0, width * 0.12, width * 0.2] : [0, -width * 0.12, -width * 0.2],
  });
  const shade = progress.interpolate({
    inputRange: [0, 0.48, 1],
    outputRange: [0, 0.58, 0.08],
  });

  return (
    <View
      {...panResponder.panHandlers}
      onLayout={(event) => {
        const nextWidth = event.nativeEvent.layout.width;
        widthRef.current = nextWidth;
        setWidth(nextWidth);
      }}
      style={{ width: '100%', aspectRatio: BINDER_RATIO / 2, overflow: 'hidden' }}
    >
      {width > 0 ? (
        <>
          <NativeBinder
            cards={cards}
            page={shownPage}
            half
            mark={mark}
            marks={marks}
            colour={colour}
            viewportWidth={width}
            onInspect={onInspect}
            onPickEmpty={onPickEmpty}
            onRemove={onRemove}
          />
          {turn ? (
            turn.crossing ? (
              <>
                <View
                  pointerEvents="none"
                  renderToHardwareTextureAndroid
                  style={[StyleSheet.absoluteFill, styles.target]}
                >
                  <NativeBinder
                    cards={cards}
                    page={turn.to}
                    half
                    mark={mark}
                    marks={marks}
                    colour={colour}
                    viewportWidth={width}
                    onInspect={onInspect}
                    onPickEmpty={onPickEmpty}
                    onRemove={onRemove}
                  />
                </View>
                <Animated.View
                  pointerEvents="none"
                  collapsable={false}
                  renderToHardwareTextureAndroid
                  style={[
                    styles.leaf,
                    {
                      left: leafLeft,
                      width: leafWidth,
                      height,
                      transformOrigin: turn.direction === 1 ? 'left center' : 'right center',
                      transform: [
                        { perspective: 1600 },
                        { translateX: leafSweep },
                        { rotateY: leafRotation },
                      ],
                    },
                  ]}
                >
                  <Animated.View style={[styles.face, { left: -leafLeft, width, height }]}>
                    <NativeBinder
                      cards={cards}
                      page={turn.from}
                      half
                      mark={mark}
                      marks={marks}
                      colour={colour}
                      viewportWidth={width}
                      onInspect={onInspect}
                      onPickEmpty={onPickEmpty}
                      onRemove={onRemove}
                    />
                    <Animated.View style={[StyleSheet.absoluteFill, { opacity: shade }]}>
                      <LinearGradient
                        colors={
                          turn.direction === 1
                            ? ['rgba(35, 23, 8, 0.04)', 'rgba(35, 23, 8, 0.58)']
                            : ['rgba(35, 23, 8, 0.58)', 'rgba(35, 23, 8, 0.04)']
                        }
                        style={StyleSheet.absoluteFill}
                        start={{ x: 0, y: 0.5 }}
                        end={{ x: 1, y: 0.5 }}
                      />
                    </Animated.View>
                  </Animated.View>
                </Animated.View>
              </>
            ) : (
              <Animated.View
                pointerEvents="none"
                renderToHardwareTextureAndroid
                style={[
                  styles.within,
                  {
                    width: width * 2,
                    height,
                    transform: [{ translateX: withinTranslate }],
                  },
                ]}
              >
                <NativeBinder
                  cards={cards}
                  page={turn.from}
                  half={false}
                  mark={mark}
                  marks={marks}
                  colour={colour}
                  viewportWidth={width * 2}
                  onInspect={onInspect}
                  onPickEmpty={onPickEmpty}
                  onRemove={onRemove}
                />
              </Animated.View>
            )
          ) : null}
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  leaf: {
    position: 'absolute',
    top: 0,
    left: 0,
    zIndex: 3,
  },
  target: {
    zIndex: 1,
  },
  within: {
    position: 'absolute',
    top: 0,
    left: 0,
    zIndex: 1,
  },
  face: {
    position: 'absolute',
    top: 0,
    backfaceVisibility: 'hidden',
    overflow: 'hidden',
  },
});
