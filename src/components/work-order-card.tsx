import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '@/components/ui';
import type { WorkOrderListItem, WorkOrderStatus } from '@/types';

const statusLabel: Record<WorkOrderStatus, string> = {
  assigned: '待处理',
  in_progress: '处理中',
  closed: '已关闭',
};

export function WorkOrderCard({ item }: { item: WorkOrderListItem }) {
  return (
    <Pressable
      accessibilityLabel={`查看工单，${item.elevatorArea}，${item.elevatorCode}，${statusLabel[item.status]}`}
      accessibilityRole="button"
      onPress={() => router.push({ pathname: '/(app)/work-orders/[id]', params: { id: item.id } })}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      testID={`work-order-${item.id}`}
    >
      <View style={styles.top}>
        <Text style={styles.code}>{item.elevatorCode}</Text>
        <View style={styles.badges}>
          {item.priority === 'urgent' && (
            <Text accessibilityLabel="优先级：紧急" style={styles.urgent}>紧急</Text>
          )}
          <Text style={[styles.status, styles[`status_${item.status}`]]}>
            {statusLabel[item.status]}
          </Text>
        </View>
      </View>
      <Text style={styles.area}>{item.elevatorArea}</Text>
      <Text numberOfLines={2} style={styles.description}>{item.description}</Text>
      <View style={styles.meta}>
        <Text style={styles.metaText}>接手：{item.assignee.displayName}</Text>
        <Text style={styles.metaText}>{new Date(item.createdAt).toLocaleString('zh-CN')}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 8, borderWidth: 1, gap: 8, padding: 16 },
  pressed: { opacity: 0.74 },
  top: { alignItems: 'center', flexDirection: 'row', gap: 12, justifyContent: 'space-between' },
  code: { color: colors.text, flex: 1, fontFamily: 'monospace', fontSize: 18, fontWeight: '700' },
  badges: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  urgent: { backgroundColor: colors.warningSoft, borderRadius: 4, color: colors.warning, fontSize: 13, fontWeight: '700', overflow: 'hidden', paddingHorizontal: 8, paddingVertical: 4 },
  status: { borderRadius: 4, fontSize: 13, fontWeight: '700', overflow: 'hidden', paddingHorizontal: 8, paddingVertical: 4 },
  status_assigned: { backgroundColor: colors.infoSoft, color: colors.info },
  status_in_progress: { backgroundColor: colors.warningSoft, color: colors.warning },
  status_closed: { backgroundColor: colors.surfaceSubtle, color: colors.secondary },
  area: { color: colors.primary, fontSize: 15, fontWeight: '600' },
  description: { color: colors.secondary, fontSize: 14, lineHeight: 21 },
  meta: { borderTopColor: colors.border, borderTopWidth: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'space-between', paddingTop: 10 },
  metaText: { color: colors.secondary, fontSize: 12 },
});
