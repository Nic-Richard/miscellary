import { useState } from 'react';
import Constants from 'expo-constants';
import { router, useLocalSearchParams } from 'expo-router';
import { Alert, Platform, ScrollView, View } from 'react-native';
import type { FeedbackKind } from '@miscellary/shared';
import { FEEDBACK_KINDS } from '@miscellary/shared';
import LoginGate from '@/components/LoginGate';
import { Button, Chip, ErrorText, Input, Muted, Panel, PanelTitle } from '@/components/ui';
import { sendFeedback } from '@/lib/endpoints';
import { createThemedStyles } from '@/lib/theme';

export default function FeedbackScreen() {
  const styles = useStyles();
  const { from } = useLocalSearchParams<{ from?: string }>();
  const [kind, setKind] = useState<FeedbackKind>('bug');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    setSending(true);
    setError(null);
    try {
      await sendFeedback({
        kind,
        message,
        page: from ?? '',
        client: `${Platform.OS} app ${Constants.expoConfig?.version ?? ''}`.trim(),
      });
      Alert.alert(
        'Feedback sent',
        "Thanks. Every message is read, and you'll get an email if there's a question.",
      );
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send your feedback.');
    } finally {
      setSending(false);
    }
  }

  return (
    <LoginGate>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Panel>
          <PanelTitle>What is it about?</PanelTitle>
          <View style={styles.kinds}>
            {FEEDBACK_KINDS.map((k) => (
              <Chip
                key={k.value}
                label={k.label}
                active={kind === k.value}
                onPress={() => setKind(k.value)}
              />
            ))}
          </View>
          <Muted style={styles.note}>
            {kind === 'bug' ? 'What happened, and what did you expect?' : 'Tell us more'}
          </Muted>
          <Input
            value={message}
            onChangeText={setMessage}
            multiline
            maxLength={2000}
            style={styles.message}
            textAlignVertical="top"
          />
          <ErrorText>{error}</ErrorText>
          <Button
            title={sending ? 'Sending…' : 'Send feedback'}
            disabled={message.trim().length < 10 || sending}
            onPress={() => void send()}
          />
        </Panel>
      </ScrollView>
    </LoginGate>
  );
}

const useStyles = createThemedStyles((colors) => ({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 14, paddingBottom: 40 },
  kinds: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  note: { fontSize: 14 },
  message: { minHeight: 140 },
}));
