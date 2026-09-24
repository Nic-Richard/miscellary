import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { resendVerificationEmail } from '@/lib/endpoints';
import { colors, fonts } from '@/lib/theme';

export function useEmailVerified() {
  return Boolean(useAuth().user?.email_verified);
}

export default function VerifyEmailNotice({ children }: { children: string }) {
  const { user } = useAuth();
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle');

  if (!user || user.email_verified) return null;

  async function resend() {
    setState('sending');
    try {
      await resendVerificationEmail();
      setState('sent');
    } catch {
      setState('failed');
    }
  }

  return (
    <View style={styles.notice} accessibilityRole="summary">
      <Text style={styles.text}>
        {children}{' '}
        {state === 'sent'
          ? `A fresh link is on its way to ${user.email}.`
          : `Check ${user.email} for the link.`}
      </Text>
      {state === 'sent' ? null : (
        <Button
          title={state === 'failed' ? 'Try sending again' : 'Send the link again'}
          kind="secondary"
          disabled={state === 'sending'}
          onPress={() => void resend()}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  notice: {
    gap: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.gold,
    borderRadius: 6,
    backgroundColor: 'rgba(184, 144, 58, 0.08)',
  },
  text: { color: colors.text, fontFamily: fonts.body, fontSize: 14, lineHeight: 20 },
});
