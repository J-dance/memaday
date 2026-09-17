import { useEffect, useState } from 'react';
import {
  Tabs,
  TabList,
  TabTrigger,
  TabSlot,
  TabTriggerSlotProps,
  TabListProps,
} from 'expo-router/ui';
import { SymbolView } from 'expo-symbols';
import { Pressable, useColorScheme, View, StyleSheet } from 'react-native';

import { ExternalLink } from './external-link';
import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';
import { listGroups } from '@/lib/groups-client';

import { Colors, MaxContentWidth, Spacing } from '@/constants/theme';

export default function AppTabs() {
  // Same "fetch once on mount" cadence as the Today/Groups tabs — rotation
  // is at most hourly, so there's no need to poll while the app is open.
  const [unseenCount, setUnseenCount] = useState(0);
  useEffect(() => {
    listGroups()
      .then((groups) => setUnseenCount(groups.filter((g) => g.hasUnseenPhoto).length))
      .catch(() => {});
  }, []);

  return (
    <Tabs>
      <TabSlot style={{ height: '100%' }} />
      <TabList asChild>
        <CustomTabList>
          <TabTrigger name="home" href="/" asChild>
            <TabButton badgeCount={unseenCount}>Today</TabButton>
          </TabTrigger>
          <TabTrigger name="explore" href="/explore" asChild>
            <TabButton>Groups</TabButton>
          </TabTrigger>
        </CustomTabList>
      </TabList>
    </Tabs>
  );
}

export function TabButton({
  children,
  isFocused,
  badgeCount,
  ...props
}: TabTriggerSlotProps & { badgeCount?: number }) {
  return (
    <Pressable {...props} style={({ pressed }) => pressed && styles.pressed}>
      <ThemedView
        type={isFocused ? 'backgroundSelected' : 'backgroundElement'}
        style={[styles.tabButtonView, styles.tabButtonRow]}>
        <ThemedText type="small" themeColor={isFocused ? 'text' : 'textSecondary'}>
          {children}
        </ThemedText>
        {!!badgeCount && (
          <ThemedView style={styles.badge}>
            <ThemedText type="small" style={styles.badgeText}>
              {badgeCount}
            </ThemedText>
          </ThemedView>
        )}
      </ThemedView>
    </Pressable>
  );
}

export function CustomTabList(props: TabListProps) {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'unspecified' ? 'light' : scheme];

  return (
    <View {...props} style={styles.tabListContainer}>
      <ThemedView type="backgroundElement" style={styles.innerContainer}>
        <ThemedText type="smallBold" style={styles.brandText}>
          Expo Starter
        </ThemedText>

        {props.children}

        <ExternalLink href="https://docs.expo.dev" asChild>
          <Pressable style={styles.externalPressable}>
            <ThemedText type="link">Docs</ThemedText>
            <SymbolView
              tintColor={colors.text}
              name={{ ios: 'arrow.up.right.square', web: 'link' }}
              size={12}
            />
          </Pressable>
        </ExternalLink>
      </ThemedView>
    </View>
  );
}

const styles = StyleSheet.create({
  tabListContainer: {
    position: 'absolute',
    width: '100%',
    padding: Spacing.three,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
  },
  innerContainer: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.five,
    borderRadius: Spacing.five,
    flexDirection: 'row',
    alignItems: 'center',
    flexGrow: 1,
    gap: Spacing.two,
    maxWidth: MaxContentWidth,
  },
  brandText: {
    marginRight: 'auto',
  },
  pressed: {
    opacity: 0.7,
  },
  tabButtonView: {
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.three,
  },
  tabButtonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  badge: {
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 4,
    backgroundColor: '#3c87f7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 10,
    lineHeight: 12,
  },
  externalPressable: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.one,
    marginLeft: Spacing.three,
  },
});
