import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button, Panel, Screen, colors } from '@/components/ui';
import { useAuth } from '@/lib/auth-context';

export default function ProfileScreen() {
  const { context, signOut } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const profile = context?.profile;

  const logout = async () => {
    setSubmitting(true);
    await signOut();
    router.replace('/(auth)/login');
  };

  return (
    <Screen title="个人中心" description="当前登录账号">
      <Button label="返回工单" onPress={() => router.back()} variant="quiet" />
      <Panel>
        <Row label="姓名" value={profile?.displayName ?? '—'} />
        <Row label="邮箱" value={context?.email ?? '—'} />
        <Row
          label="角色"
          value={profile?.role === 'elevator_supervisor' ? '电梯区域主管' : '电梯工程师'}
        />
      </Panel>
      <Button label="退出登录" loading={submitting} onPress={() => void logout()} testID="logout" variant="danger" />
    </Screen>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { borderBottomColor: colors.border, borderBottomWidth: 1, gap: 4, paddingBottom: 12 },
  label: { color: colors.secondary, fontSize: 13 },
  value: { color: colors.text, fontSize: 16, fontWeight: '600' },
});
