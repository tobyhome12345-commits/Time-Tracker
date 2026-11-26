import { Capacitor, SystemBars, SystemBarsStyle } from '@capacitor/core';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';

export const isNative = Capacitor.isNativePlatform();

export function setSystemBars(dark: boolean) {
  if (!isNative) return;
  // "Dark" style = light icons for a dark background.
  void SystemBars.setStyle({ style: dark ? SystemBarsStyle.Dark : SystemBarsStyle.Light }).catch(() => {});
}

export function tap() {
  if (isNative) void Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
}

export function celebrate() {
  if (isNative) void Haptics.notification({ type: NotificationType.Success }).catch(() => {});
}
