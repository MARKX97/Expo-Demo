import { Redirect, Stack } from 'expo-router';

import { LoadingState, Screen } from '@/components/ui';
import { useAuth } from '@/lib/auth-context';

export default function AppLayout() {
  const { context, loading } = useAuth();
  if (loading) return <Screen><LoadingState /></Screen>;
  if (!context) return <Redirect href="/(auth)/login" />;
  return <Stack screenOptions={{ headerShown: false }} />;
}
