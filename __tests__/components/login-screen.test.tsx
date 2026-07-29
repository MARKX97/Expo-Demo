import { describe, expect, it, jest } from '@jest/globals';
import { render } from '@testing-library/react-native';

import LoginScreen from '../../app/(auth)/login';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn() },
}));

jest.mock('@/lib/auth-context', () => ({
  useAuth: () => ({ signIn: jest.fn() }),
}));

describe('LoginScreen', () => {
  it('renders the real login form', async () => {
    const view = await render(<LoginScreen />);
    expect(view.getByText('梯维派工')).toBeTruthy();
    expect(view.getByText('梯维派工').props.maxFontSizeMultiplier).toBe(1.4);
    expect(view.getByLabelText('工作邮箱').props.maxFontSizeMultiplier).toBe(1.4);
    expect(view.getByLabelText('密码')).toBeTruthy();
    expect(view.getByTestId('login-submit')).toBeTruthy();
  });
});
