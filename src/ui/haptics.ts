import * as Haptics from 'expo-haptics';

function ignoreFailure(result: Promise<void>): void {
  result.catch(() => undefined);
}

export function selectionHaptic(): void {
  ignoreFailure(Haptics.selectionAsync());
}

export function lightHaptic(): void {
  ignoreFailure(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
}

export function successHaptic(): void {
  ignoreFailure(Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
}
