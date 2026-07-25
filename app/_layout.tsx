import * as Linking from 'expo-linking';
import { router, Stack } from 'expo-router';
import { useEffect } from 'react';

import { AuthProvider, useAuth } from '@/lib/auth-context';

export default function RootLayout() {
  return (
    <AuthProvider>
      <DeepLinkHandler />
      <Stack screenOptions={{ headerShown: false }} />
    </AuthProvider>
  );
}

function DeepLinkHandler() {
  const { consumeRecoveryUrl } = useAuth();

  useEffect(() => {
    const handle = async (url: string | null) => {
      if (url && await consumeRecoveryUrl(url)) router.replace('/(auth)/reset-password');
    };
    void Linking.getInitialURL().then(handle);
    const subscription = Linking.addEventListener('url', ({ url }) => void handle(url));
    return () => subscription.remove();
  }, [consumeRecoveryUrl]);

  return null;
}
