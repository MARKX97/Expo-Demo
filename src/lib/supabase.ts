import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, processLock, type SupabaseClient } from '@supabase/supabase-js';
import { AppState } from 'react-native';

import { AppError } from '@/lib/app-error';
import type { Database } from '@/types/database.generated';

let client: SupabaseClient<Database> | null = null;
let appStateSubscription: { remove(): void } | null = null;

export function getSupabase(): SupabaseClient<Database> {
  if (client) return client;

  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !publishableKey) {
    throw new AppError(
      'SERVER_ERROR',
      '缺少 EXPO_PUBLIC_SUPABASE_URL 或 EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY。',
    );
  }

  client = createClient<Database>(url, publishableKey, {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
      flowType: 'pkce',
      lock: processLock,
    },
  });

  if (!appStateSubscription) {
    if (AppState.currentState === 'active') client.auth.startAutoRefresh();
    appStateSubscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') client?.auth.startAutoRefresh();
      else client?.auth.stopAutoRefresh();
    });
  }

  return client;
}
