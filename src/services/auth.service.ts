import { AppError } from '@/lib/app-error';
import { mapSupabaseError } from '@/lib/map-supabase-error';
import { getSupabase } from '@/lib/supabase';
import { profileService } from '@/services/profile.service';
import type { AuthContext, AuthEvent, AuthStateListener, SignInInput } from '@/types';

const authEvents = new Set<AuthEvent>([
  'INITIAL_SESSION',
  'SIGNED_IN',
  'SIGNED_OUT',
  'PASSWORD_RECOVERY',
  'TOKEN_REFRESHED',
  'USER_UPDATED',
]);

function withRecoveryTimeout<T>(operation: PromiseLike<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new AppError('AUTH_RECOVERY_EXPIRED', 'Recovery exchange timed out')),
      10_000,
    );
    Promise.resolve(operation).then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

async function contextFor(userId: string, email: string | undefined): Promise<AuthContext> {
  const profile = await profileService.getCurrent();
  return { userId, email: email ?? '', profile };
}

async function restoreSession(): Promise<AuthContext | null> {
  try {
    const { data, error } = await getSupabase().auth.getSession();
    if (error) throw error;
    if (!data.session) return null;
    try {
      return await contextFor(data.session.user.id, data.session.user.email);
    } catch (error) {
      await getSupabase().auth.signOut({ scope: 'local' });
      throw error;
    }
  } catch (error) {
    throw mapSupabaseError(error);
  }
}

function subscribe(listener: AuthStateListener): () => void {
  const { data } = getSupabase().auth.onAuthStateChange((event, session) => {
    if (authEvents.has(event as AuthEvent)) listener(event as AuthEvent, Boolean(session));
  });
  return () => data.subscription.unsubscribe();
}

async function signIn(input: SignInInput): Promise<AuthContext> {
  try {
    const { data, error } = await getSupabase().auth.signInWithPassword({
      email: input.email.trim(),
      password: input.password,
    });
    if (error) throw error;
    if (!data.user) throw new AppError('AUTH_INVALID_CREDENTIALS', 'Missing signed-in user');
    try {
      return await contextFor(data.user.id, data.user.email);
    } catch (error) {
      await getSupabase().auth.signOut({ scope: 'local' });
      throw error;
    }
  } catch (error) {
    throw mapSupabaseError(error);
  }
}

async function requestPasswordReset(email: string): Promise<void> {
  try {
    const { error } = await getSupabase().auth.resetPasswordForEmail(email.trim(), {
      redirectTo: 'elevatorhandoff://reset-password',
    });
    if (error) throw error;
  } catch (error) {
    throw mapSupabaseError(error);
  }
}

async function consumePasswordRecoveryUrl(url: string): Promise<void> {
  try {
    const parsed = new URL(url);
    if (
      parsed.protocol !== 'elevatorhandoff:' ||
      `${parsed.hostname}${parsed.pathname}`.replace(/\/$/, '') !== 'reset-password'
    ) {
      throw new AppError('AUTH_RECOVERY_EXPIRED', 'Unexpected recovery URL');
    }
    const code = parsed.searchParams.get('code');
    if (!code) throw new AppError('AUTH_RECOVERY_EXPIRED', 'Missing recovery code');
    const { error } = await withRecoveryTimeout(getSupabase().auth.exchangeCodeForSession(code));
    if (error) throw error;
  } catch (error) {
    const mapped = mapSupabaseError(error);
    if (mapped.code === 'SERVER_ERROR') {
      throw new AppError('AUTH_RECOVERY_EXPIRED', mapped.message);
    }
    throw mapped;
  }
}

async function completePasswordReset(password: string): Promise<void> {
  try {
    const { error } = await getSupabase().auth.updateUser({ password });
    if (error) throw error;
    await getSupabase().auth.signOut({ scope: 'local' });
  } catch (error) {
    throw mapSupabaseError(error);
  }
}

async function signOut(): Promise<void> {
  try {
    const { error } = await getSupabase().auth.signOut({ scope: 'local' });
    if (error) throw error;
  } catch (error) {
    throw mapSupabaseError(error);
  }
}

export const authService = {
  restoreSession,
  subscribe,
  signIn,
  requestPasswordReset,
  consumePasswordRecoveryUrl,
  completePasswordReset,
  signOut,
};
