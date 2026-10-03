import type { PackEntry } from '@miscellary/shared';
import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';

const REMINDER_ID = 'pack-ready';
const ASKED_KEY = 'pack-reminder-asked';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

// One reminder at a time, for the next followed set whose free pack comes back; packs that
// reset together share it.
export async function syncPackReminder(entries: PackEntry[]) {
  try {
    const { granted } = await Notifications.getPermissionsAsync();
    await Notifications.cancelScheduledNotificationAsync(REMINDER_ID);
    if (!granted) return;
    const waiting = entries
      .filter((entry) => !entry.free_available)
      .map((entry) => ({ title: entry.card_set.title, at: Date.parse(entry.resets_at) }))
      .filter((entry) => entry.at > Date.now());
    if (!waiting.length) return;
    const next = Math.min(...waiting.map((entry) => entry.at));
    const ready = waiting.filter((entry) => entry.at - next < 60_000);
    await Notifications.scheduleNotificationAsync({
      identifier: REMINDER_ID,
      content: {
        title: ready.length === 1 ? 'Free pack ready' : `${ready.length} free packs ready`,
        body:
          ready.length === 1
            ? `Your ${ready[0]!.title} pack is ready to open.`
            : 'Your free packs are ready to open.',
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(next) },
    });
  } catch {
    return;
  }
}

// Asked once, after the first pack is opened, when a reminder makes sense to the collector.
export async function askForPackReminder() {
  try {
    if (await SecureStore.getItemAsync(ASKED_KEY)) return;
    await SecureStore.setItemAsync(ASKED_KEY, '1');
    // Android reports "denied" before it has ever asked, so canAskAgain decides.
    const { granted, canAskAgain } = await Notifications.getPermissionsAsync();
    if (!granted && canAskAgain) await Notifications.requestPermissionsAsync();
  } catch {
    return;
  }
}
