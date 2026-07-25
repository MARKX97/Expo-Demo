import { Redirect, Stack } from 'expo-router';

import { useAuth } from '@/lib/auth-context';

export default function AuthLayout() {
  const { context, recoveryReady } = useAuth();
  if (context && !recoveryReady) return <Redirect href="/(app)" />;
  return <Stack screenOptions={{ headerShown: false }} />;
}
