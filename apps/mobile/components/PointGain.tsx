import { useEffect, useRef } from 'react';
import { Animated, StyleSheet } from 'react-native';
import { colors } from '@/lib/theme';

export default function PointGain({ amount }: { amount: number }) {
  const motion = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(motion, {
      toValue: 1,
      duration: 700,
      useNativeDriver: true,
    }).start();
  }, [motion]);

  return (
    <Animated.Text
      style={[
        styles.gain,
        {
          opacity: motion.interpolate({ inputRange: [0, 0.2, 0.78, 1], outputRange: [0, 1, 1, 0] }),
          transform: [
            { translateY: motion.interpolate({ inputRange: [0, 1], outputRange: [5, -9] }) },
          ],
        },
      ]}
    >
      +{amount}
    </Animated.Text>
  );
}

const styles = StyleSheet.create({
  gain: {
    marginLeft: 5,
    color: colors.accent,
    fontSize: 17,
    lineHeight: 20,
    fontWeight: '700',
  },
});
