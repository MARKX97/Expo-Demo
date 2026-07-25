import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Brand, Button, Field, Notice, Panel, Screen } from '@/components/ui';
import { errorMessage } from '@/lib/app-error';
import { useAuth } from '@/lib/auth-context';
import { validateEmail } from '@/lib/validation';

export default function LoginScreen() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    const emailError = validateEmail(email);
    if (emailError || !password) {
      setError(emailError ?? '请输入密码。');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await signIn({ email, password });
      router.replace('/(app)');
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen>
      <View style={styles.center}>
        <Panel>
          <Brand />
          <Field
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            label="工作邮箱"
            onChangeText={setEmail}
            testID="login-email"
            value={email}
          />
          <Field
            autoCapitalize="none"
            autoComplete="current-password"
            label="密码"
            onChangeText={setPassword}
            onSubmitEditing={() => void submit()}
            secureTextEntry={!passwordVisible}
            testID="login-password"
            value={password}
          />
          <Button
            label={passwordVisible ? '隐藏密码' : '显示密码'}
            onPress={() => setPasswordVisible((visible) => !visible)}
            variant="quiet"
          />
          {error && <Notice tone="error">{error}</Notice>}
          <Button label="登录" loading={submitting} onPress={() => void submit()} testID="login-submit" />
          <Button label="忘记密码" onPress={() => router.push('/(auth)/forgot-password')} variant="quiet" />
        </Panel>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', marginHorizontal: 'auto', maxWidth: 440, width: '100%' },
});
