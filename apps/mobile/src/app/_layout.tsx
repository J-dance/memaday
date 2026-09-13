import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import AppTabs from '@/components/app-tabs';
import { AuthGate } from '@/components/auth-gate';
import { GroupKeysSessionProvider } from '@/lib/group-keys-session';
import { IdentitySessionProvider } from '@/lib/identity-session';

SplashScreen.preventAutoHideAsync();

export default function TabLayout() {
  const colorScheme = useColorScheme();
  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AnimatedSplashOverlay />
      <IdentitySessionProvider>
        <GroupKeysSessionProvider>
          <AuthGate>
            <AppTabs />
          </AuthGate>
        </GroupKeysSessionProvider>
      </IdentitySessionProvider>
    </ThemeProvider>
  );
}
