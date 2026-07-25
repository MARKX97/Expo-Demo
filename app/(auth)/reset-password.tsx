import { router } from 'expo-router';
import { useState } from 'react';

import { Button, Field, LoadingState, Notice, Panel, Screen } from '@/components/ui';
import { errorMessage } from '@/lib/app-error';
import { useAuth } from '@/lib/auth-context';
import { validatePassword } from '@/lib/validation';

export default function ResetPasswordScreen() {
  const { recoveryReady, recoveryError, completePasswordReset } = useAuth();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!recoveryReady && !recoveryError) {
    return <Screen><LoadingState label="正在验证重置链接…" /></Screen>;
  }
  if (recoveryError) {
    return (
      <Screen title="链接无法使用">
        <Notice tone="error">{errorMessage(recoveryError)}</Notice>
        <Button label="重新发送重置邮件" onPress={() => router.replace('/(auth)/forgot-password')} />
      </Screen>
    );
  }

  const submit = async () => {
    const validation = validatePassword(password);
    if (validation || password !== confirmation) {
      setError(validation ?? '两次输入的密码不一致。');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await completePasswordReset(password);
      router.replace('/(auth)/login');
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen title="设置新密码" description="更新成功后，请使用新密码重新登录。">
      <Panel>
        <Field
          label="新密码"
          onChangeText={setPassword}
          secureTextEntry={!passwordVisible}
          value={password}
        />
        <Field
          label="确认新密码"
          onChangeText={setConfirmation}
          onSubmitEditing={() => void submit()}
          secureTextEntry={!passwordVisible}
          value={confirmation}
        />
        <Button
          label={passwordVisible ? '隐藏密码' : '显示密码'}
          onPress={() => setPasswordVisible((visible) => !visible)}
          variant="quiet"
        />
        {error && <Notice tone="error">{error}</Notice>}
        <Button label="保存新密码" loading={submitting} onPress={() => void submit()} />
      </Panel>
    </Screen>
  );
}
