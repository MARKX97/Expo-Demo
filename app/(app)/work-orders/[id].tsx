import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Image, Pressable, StyleSheet, View } from 'react-native';

import { Button, Field, LoadingState, Notice, Panel, Screen, Text, colors } from '@/components/ui';
import { errorMessage } from '@/lib/app-error';
import { useAuth } from '@/lib/auth-context';
import { availableWorkOrderActions } from '@/lib/work-order-actions';
import { validateResolution } from '@/lib/validation';
import { profileService } from '@/services/profile.service';
import { workOrderService } from '@/services/work-order.service';
import type { EngineerOption, WorkOrderDetail, WorkOrderStatus } from '@/types';

const statusLabel: Record<WorkOrderStatus, string> = {
  assigned: '待处理',
  in_progress: '处理中',
  closed: '已关闭',
};

export default function WorkOrderDetailScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const { context } = useAuth();
  const [detail, setDetail] = useState<WorkOrderDetail | null>(null);
  const [engineers, setEngineers] = useState<EngineerOption[]>([]);
  const [selectedEngineer, setSelectedEngineer] = useState('');
  const [resolution, setResolution] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const role = context?.profile.role ?? 'elevator_engineer';

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const loaded = await workOrderService.getById(params.id);
      setDetail(loaded);
      setSelectedEngineer(loaded.assigneeId);
      if (role === 'elevator_supervisor' && loaded.status === 'assigned') {
        setEngineers(await profileService.listActiveEngineers());
      }
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setLoading(false);
    }
  }, [params.id, role]);

  useFocusEffect(useCallback(() => {
    void load();
  }, [load]));

  const runAction = async (action: 'reassign' | 'start' | 'close') => {
    if (!detail) return;
    if (action === 'close') {
      const validation = validateResolution(resolution);
      if (validation) return setError(validation);
    }
    setBusy(true);
    setError(null);
    try {
      if (action === 'reassign') {
        await workOrderService.reassign({
          id: detail.id,
          assigneeId: selectedEngineer,
          expectedVersion: detail.version,
        });
      } else if (action === 'start') {
        await workOrderService.start({ id: detail.id, expectedVersion: detail.version });
      } else {
        await workOrderService.close({
          id: detail.id,
          resolution,
          expectedVersion: detail.version,
        });
      }
      await load();
    } catch (caught) {
      await load();
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  };

  if (loading && !detail) return <Screen><LoadingState label="正在加载工单…" /></Screen>;

  return (
    <Screen title={detail?.elevatorCode ?? '工单详情'} description={detail?.elevatorArea}>
      <Button label="返回工单" onPress={() => router.back()} variant="quiet" />
      {error && (
        <View style={styles.error}>
          <Notice tone="error">{error}</Notice>
          <Button label="重新加载" onPress={() => void load()} variant="secondary" />
        </View>
      )}
      {detail && (
        <>
          <View style={styles.badges}>
            {detail.priority === 'urgent' && <Text style={styles.urgent}>紧急</Text>}
            <Text style={styles.status} testID="work-order-status">{statusLabel[detail.status]}</Text>
          </View>
          <Panel>
            <Text style={styles.sectionTitle}>工单信息</Text>
            <Info label="故障描述" value={detail.description} />
            <Info label="接手工程师" value={detail.assignee.displayName} />
            <Info label="创建人" value={detail.createdBy.displayName} />
            <Info label="创建时间" value={new Date(detail.createdAt).toLocaleString('zh-CN')} />
            {detail.resolution && <Info label="处理结果" value={detail.resolution} />}
          </Panel>
          <Panel>
            <Text style={styles.sectionTitle}>现场照片</Text>
            <View style={styles.photoGrid}>
              {detail.attachments.map((attachment, index) => attachment.signedUrl ? (
                <Image
                  accessibilityLabel={`现场照片 ${index + 1}`}
                  key={attachment.id}
                  source={{ uri: attachment.signedUrl }}
                  style={styles.photo}
                />
              ) : (
                <View key={attachment.id} style={styles.photoFallback}>
                  <Text style={styles.help}>照片加载失败</Text>
                  <Button label={`重新加载照片 ${index + 1}`} onPress={() => void load()} variant="quiet" />
                </View>
              ))}
            </View>
          </Panel>
          <Actions
            busy={busy}
            detail={detail}
            engineers={engineers}
            onAction={runAction}
            resolution={resolution}
            role={role}
            selectedEngineer={selectedEngineer}
            setResolution={setResolution}
            setSelectedEngineer={setSelectedEngineer}
          />
          {detail.status === 'closed' && <Notice>此工单已关闭，当前为只读状态。</Notice>}
        </>
      )}
    </Screen>
  );
}

function Actions({
  role,
  detail,
  engineers,
  selectedEngineer,
  setSelectedEngineer,
  resolution,
  setResolution,
  busy,
  onAction,
}: {
  role: 'elevator_supervisor' | 'elevator_engineer';
  detail: WorkOrderDetail;
  engineers: EngineerOption[];
  selectedEngineer: string;
  setSelectedEngineer(value: string): void;
  resolution: string;
  setResolution(value: string): void;
  busy: boolean;
  onAction(action: 'reassign' | 'start' | 'close'): Promise<void>;
}) {
  const actions = availableWorkOrderActions(role, detail.status);
  if (!actions.length) return null;
  if (actions.includes('reassign')) {
    return (
      <Panel>
        <Text style={styles.sectionTitle}>改派工程师</Text>
        {engineers.map((engineer) => (
          <Pressable
            accessibilityLabel={`改派给 ${engineer.displayName}`}
            accessibilityRole="radio"
            accessibilityState={{ checked: selectedEngineer === engineer.id }}
            key={engineer.id}
            onAccessibilityTap={() => setSelectedEngineer(engineer.id)}
            onPress={() => setSelectedEngineer(engineer.id)}
            style={[styles.option, selectedEngineer === engineer.id && styles.optionSelected]}
            testID={`engineer-option-${engineer.displayName}`}
          >
            <Text style={styles.optionText}>{engineer.displayName}</Text>
            <Text style={styles.help}>{selectedEngineer === engineer.id ? '已选择' : '点击选择'}</Text>
          </Pressable>
        ))}
        <Button
          disabled={selectedEngineer === detail.assigneeId}
          label="确认改派"
          loading={busy}
          onPress={() => void onAction('reassign')}
          testID="reassign-work-order"
        />
      </Panel>
    );
  }
  if (actions.includes('start')) {
    return <Button label="开始处理" loading={busy} onPress={() => void onAction('start')} testID="start-work-order" />;
  }
  return (
    <Panel>
      <Text style={styles.sectionTitle}>处理结果</Text>
      <Field label="处理结果" multiline onChangeText={setResolution} testID="work-order-resolution" value={resolution} />
      <Button
        label="完成并关闭"
        loading={busy}
        onPress={() => {
          if (validateResolution(resolution)) return void onAction('close');
          Alert.alert('确认关闭工单？', '关闭后工单将只读，无法撤销。', [
            { text: '取消', style: 'cancel' },
            { text: '确认关闭', style: 'destructive', onPress: () => void onAction('close') },
          ]);
        }}
        testID="close-work-order"
      />
    </Panel>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.info}>
      <Text style={styles.help}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  error: { gap: 8 },
  badges: { flexDirection: 'row', gap: 8 },
  urgent: { backgroundColor: colors.warningSoft, borderRadius: 4, color: colors.warning, fontWeight: '700', overflow: 'hidden', paddingHorizontal: 10, paddingVertical: 6 },
  status: { backgroundColor: colors.surfaceSubtle, borderRadius: 4, color: colors.primary, fontWeight: '700', overflow: 'hidden', paddingHorizontal: 10, paddingVertical: 6 },
  sectionTitle: { color: colors.text, fontSize: 18, fontWeight: '700' },
  info: { borderBottomColor: colors.border, borderBottomWidth: 1, gap: 3, paddingBottom: 10 },
  infoValue: { color: colors.text, fontSize: 16, lineHeight: 23 },
  help: { color: colors.secondary, fontSize: 13, lineHeight: 20 },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  photo: { aspectRatio: 1, backgroundColor: colors.surfaceSubtle, borderRadius: 8, width: '48%' },
  photoFallback: { alignItems: 'center', aspectRatio: 1, backgroundColor: colors.surfaceSubtle, borderRadius: 8, justifyContent: 'center', padding: 8, width: '48%' },
  option: { alignItems: 'center', borderColor: colors.border, borderRadius: 8, borderWidth: 1, flexDirection: 'row', justifyContent: 'space-between', minHeight: 48, paddingHorizontal: 12 },
  optionSelected: { backgroundColor: colors.accentSoft, borderColor: colors.accent },
  optionText: { color: colors.text, fontSize: 16, fontWeight: '600' },
});
