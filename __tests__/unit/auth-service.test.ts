import { describe, expect, it, jest } from '@jest/globals';

import { getSupabase } from '@/lib/supabase';
import { authService } from '@/services/auth.service';

jest.mock('@/lib/supabase', () => ({ getSupabase: jest.fn() }));

const mockedGetSupabase = jest.mocked(getSupabase);

describe('AuthService password recovery', () => {
  it('requests, consumes and completes the native PKCE recovery flow', async () => {
    const auth = {
      resetPasswordForEmail: jest.fn<(...args: unknown[]) => Promise<unknown>>()
        .mockResolvedValue({ error: null }),
      exchangeCodeForSession: jest.fn<(...args: unknown[]) => Promise<unknown>>()
        .mockResolvedValue({ error: null }),
      updateUser: jest.fn<(...args: unknown[]) => Promise<unknown>>()
        .mockResolvedValue({ error: null }),
      signOut: jest.fn<(...args: unknown[]) => Promise<unknown>>()
        .mockResolvedValue({ error: null }),
    };
    mockedGetSupabase.mockReturnValue({ auth } as never);

    await authService.requestPasswordReset(' engineer@example.test ');
    await authService.consumePasswordRecoveryUrl(
      'elevatorhandoff://reset-password?code=recovery-code',
    );
    await authService.completePasswordReset('new-password');

    expect(auth.resetPasswordForEmail).toHaveBeenCalledWith('engineer@example.test', {
      redirectTo: 'elevatorhandoff://reset-password',
    });
    expect(auth.exchangeCodeForSession).toHaveBeenCalledWith('recovery-code');
    expect(auth.updateUser).toHaveBeenCalledWith({ password: 'new-password' });
    expect(auth.signOut).toHaveBeenCalledWith({ scope: 'local' });
  });
});
