import { useEffect, useState } from 'react';
import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { useColorScheme } from 'react-native';

import { Colors } from '@/constants/theme';
import { listGroups } from '@/lib/groups-client';

export default function AppTabs() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'unspecified' ? 'light' : scheme];

  // Same "fetch once on mount" cadence as the Today/Groups tabs — rotation
  // is at most hourly, so there's no need to poll while the app is open.
  const [unseenCount, setUnseenCount] = useState(0);
  useEffect(() => {
    listGroups()
      .then((groups) => setUnseenCount(groups.filter((g) => g.hasUnseenPhoto).length))
      .catch(() => {});
  }, []);

  return (
    <NativeTabs
      backgroundColor={colors.background}
      indicatorColor={colors.backgroundElement}
      labelStyle={{ selected: { color: colors.text } }}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Today</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          src={require('@/assets/images/tabIcons/home.png')}
          renderingMode="template"
        />
        <NativeTabs.Trigger.Badge hidden={unseenCount === 0}>
          {unseenCount > 0 ? String(unseenCount) : undefined}
        </NativeTabs.Trigger.Badge>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="explore">
        <NativeTabs.Trigger.Label>Groups</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          src={require('@/assets/images/tabIcons/explore.png')}
          renderingMode="template"
        />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
