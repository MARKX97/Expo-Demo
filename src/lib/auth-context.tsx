import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';

import { AppError } from '@/lib/app-error';
import { authService } from '@/services/auth.service';
import type { AuthContext, SignInInput } from '@/types';

type AuthState = {
  context: AuthContext | null;
  loading: boolean;
  recoveryReady: boolean;
  recoveryError: Error | null;
  signIn(input: SignInInput): Promise<void>;
  requestPasswordReset(email: string): Promise<void>;
  consumeRecoveryUrl(url: string): Promise<boolean>;
  completePasswordReset(password: string): Promise<void>;
  signOut(): Promise<void>;
  retryRestore(): Promise<void>;
};

const AuthStateContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [context, setContext] = useState<AuthContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [recoveryReady, setRecoveryReady] = useState(false);
  const [recoveryError, setRecoveryError] = useState<Error | null>(null);
  const recoveryConsumed = useRef(false);

  const retryRestore = useCallback(async () => {
    setLoading(true);
    try {
      setContext(await authService.restoreSession());
    } catch {
      setContext(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const restoreTimer = setTimeout(() => void retryRestore(), 0);
    const unsubscribe = authService.subscribe((event) => {
      if (event === 'SIGNED_OUT') setContext(null);
    });
    return () => {
      clearTimeout(restoreTimer);
      unsubscribe();
    };
  }, [retryRestore]);

  const signIn = useCallback(async (input: SignInInput) => {
    setContext(await authService.signIn(input));
  }, []);

  const requestPasswordReset = useCallback(async (email: string) => {
    recoveryConsumed.current = false;
    setRecoveryError(null);
    setRecoveryReady(false);
    await authService.requestPasswordReset(email);
  }, []);

  const consumeRecoveryUrl = useCallback(async (url: string) => {
    if (!url.startsWith('elevatorhandoff://reset-password') || recoveryConsumed.current) {
      return false;
    }
    recoveryConsumed.current = true;
    setRecoveryError(null);
    try {
      await authService.consumePasswordRecoveryUrl(url);
      setRecoveryReady(true);
    } catch (error) {
      setRecoveryError(error instanceof Error ? error : new AppError('SERVER_ERROR', 'Unknown error'));
    }
    return true;
  }, []);

  const completePasswordReset = useCallback(async (password: string) => {
    await authService.completePasswordReset(password);
    setRecoveryReady(false);
    setContext(null);
  }, []);

  const signOut = useCallback(async () => {
    setContext(null);
    try {
      await authService.signOut();
    } catch {
      // Local application state must be cleared even if the SDK reports an error.
    }
  }, []);

  return (
    <AuthStateContext.Provider
      value={{
        context,
        loading,
        recoveryReady,
        recoveryError,
        signIn,
        requestPasswordReset,
        consumeRecoveryUrl,
        completePasswordReset,
        signOut,
        retryRestore,
      }}
    >
      {children}
    </AuthStateContext.Provider>
  );
}

export function useAuth(): AuthState {
  const state = useContext(AuthStateContext);
  if (!state) throw new Error('useAuth must be used inside AuthProvider');
  return state;
}
