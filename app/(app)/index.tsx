import { useFocusEffect, router } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';

import { WorkOrderCard } from '@/components/work-order-card';
import { Button, LoadingState, Notice, Screen, Text, colors } from '@/components/ui';
import { errorMessage } from '@/lib/app-error';
import { useAuth } from '@/lib/auth-context';
import { workOrderService } from '@/services/work-order.service';
import type { WorkOrderListItem } from '@/types';

export default function WorkOrderListScreen() {
  const { context } = useAuth();
  const [items, setItems] = useState<WorkOrderListItem[]>([]);
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isSupervisor = context?.profile.role === 'elevator_supervisor';

  const load = useCallback(async (
    nextPage = 0,
    mode: 'replace' | 'refresh' | 'append' = 'replace',
  ) => {
    if (mode === 'refresh') setRefreshing(true);
    else if (mode === 'append') setLoadingMore(true);
    else setLoading(true);
    setError(null);
    try {
      const result = await workOrderService.list({
        page: nextPage,
        statuses: isSupervisor ? undefined : ['assigned', 'in_progress'],
      });
      setItems((current) => {
        if (mode !== 'append') return result.items;
        const known = new Set(current.map((item) => item.id));
        return [...current, ...result.items.filter((item) => !known.has(item.id))];
      });
      setPage(result.page);
      setHasMore(result.hasMore);
      setFetchedAt(result.fetchedAt);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }, [isSupervisor]);

  useFocusEffect(useCallback(() => {
    void load(0);
  }, [load]));

  return (
    <Screen
      action={isSupervisor
        ? <Button label="新建" onPress={() => router.push('/(app)/work-orders/new')} testID="nav-new-work-order" />
        : undefined}
      description={isSupervisor ? '查看全项目工单并安排处理' : `${context?.profile.displayName} · 只显示指派给我的工单`}
      scroll={false}
      title={isSupervisor ? '工单总览' : '我的工单'}
    >
      <View style={styles.navigation}>
        <Button label="个人中心" onPress={() => router.push('/(app)/profile')} testID="nav-profile" variant="secondary" />
        {fetchedAt && (
          <Text style={styles.updated}>上次更新 {new Date(fetchedAt).toLocaleTimeString('zh-CN')}</Text>
        )}
      </View>
      <Notice tone="warning">困人、停梯等紧急事件须立即执行线下应急流程，本应用仅记录工单。</Notice>
      {error && (
        <View style={styles.errorRow}>
          <View style={styles.flex}><Notice tone="error">{error}</Notice></View>
          <Button label="重试" onPress={() => void load()} variant="secondary" />
        </View>
      )}
      {loading && !items.length ? (
        <LoadingState label="正在加载工单…" />
      ) : (
        <FlatList
          contentContainerStyle={[styles.list, !items.length && styles.emptyList]}
          data={items}
          keyExtractor={(item) => item.id}
          ListFooterComponent={loadingMore ? <Text style={styles.loadingMore}>正在加载更多…</Text> : null}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>当前没有工单</Text>
              <Text style={styles.updated}>{isSupervisor ? '可点击“新建”创建第一张工单。' : '新任务会在刷新后显示。'}</Text>
            </View>
          }
          onEndReached={() => {
            if (hasMore && !loading && !refreshing && !loadingMore) {
              void load(page + 1, 'append');
            }
          }}
          onEndReachedThreshold={0.4}
          refreshControl={<RefreshControl onRefresh={() => void load(0, 'refresh')} refreshing={refreshing} />}
          renderItem={({ item }) => <WorkOrderCard item={item} />}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  navigation: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between' },
  updated: { color: colors.secondary, fontSize: 13 },
  errorRow: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  flex: { flex: 1 },
  list: { gap: 12, paddingBottom: 24 },
  loadingMore: { color: colors.secondary, padding: 16, textAlign: 'center' },
  emptyList: { flexGrow: 1 },
  empty: { alignItems: 'center', flex: 1, gap: 8, justifyContent: 'center', minHeight: 220 },
  emptyTitle: { color: colors.text, fontSize: 18, fontWeight: '700' },
});
