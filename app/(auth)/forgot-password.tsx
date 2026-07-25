import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';

import { Button, Field, Notice, Panel, Screen, colors } from '@/components/ui';
import { errorMessage } from '@/lib/app-error';
import { useAuth } from '@/lib/auth-context';
import { validateEmail } from '@/lib/validation';

export default function ForgotPasswordScreen() {
  const { requestPasswordReset } = useAuth();
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    const validation = validateEmail(email);
    if (validation) return setError(validation);
    setSubmitting(true);
    setError(null);
    setMessage(null);
    try {
      await requestPasswordReset(email);
      setMessage('如果邮箱已存在，重置邮件将会发送。请在当前设备打开邮件链接。');
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen title="重置密码" description="邮件链接需要在发起重置的当前设备打开。">
      <Panel>
        <Field
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          label="工作邮箱"
          onChangeText={setEmail}
          value={email}
        />
        {error && <Notice tone="error">{error}</Notice>}
        {message && <Notice tone="success">{message}</Notice>}
        <Button label="发送重置邮件" loading={submitting} onPress={() => void submit()} />
        <Button label="返回登录" onPress={() => router.back()} variant="quiet" />
      </Panel>
      <Text style={styles.help}>为保护账号安全，页面不会说明该邮箱是否已注册。</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  help: { color: colors.secondary, fontSize: 13, lineHeight: 20 },
});
