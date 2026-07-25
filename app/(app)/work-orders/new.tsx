import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { Redirect, router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { Button, Field, Notice, Panel, Screen, colors } from '@/components/ui';
import { errorMessage } from '@/lib/app-error';
import { useAuth } from '@/lib/auth-context';
import { createUuid } from '@/lib/uuid';
import { validateWorkOrder } from '@/lib/validation';
import { profileService } from '@/services/profile.service';
import { workOrderService } from '@/services/work-order.service';
import type { EngineerOption, LocalPhoto, WorkOrderPriority } from '@/types';

const MAX_EDGE = 2048;

export default function NewWorkOrderScreen() {
  const { context } = useAuth();
  const [draftId] = useState(createUuid);
  const [elevatorArea, setElevatorArea] = useState('');
  const [elevatorCode, setElevatorCode] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<WorkOrderPriority>('normal');
  const [assigneeId, setAssigneeId] = useState('');
  const [photos, setPhotos] = useState<LocalPhoto[]>([]);
  const [engineers, setEngineers] = useState<EngineerOption[]>([]);
  const [engineerError, setEngineerError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingEngineers, setLoadingEngineers] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const loadEngineers = useCallback(() => {
    setLoadingEngineers(true);
    setEngineerError(null);
    profileService.listActiveEngineers()
      .then(setEngineers)
      .catch((caught) => setEngineerError(errorMessage(caught)))
      .finally(() => setLoadingEngineers(false));
  }, []);

  useEffect(() => {
    const timer = setTimeout(loadEngineers, 0);
    return () => clearTimeout(timer);
  }, [loadEngineers]);

  if (context?.profile.role !== 'elevator_supervisor') return <Redirect href="/(app)" />;

  const choosePhotos = async () => {
    setError(null);
    const result = await ImagePicker.launchImageLibraryAsync({
      allowsMultipleSelection: true,
      mediaTypes: ['images'],
      quality: 1,
      selectionLimit: 3 - photos.length,
    });
    if (result.canceled) return;

    try {
      const normalized = await Promise.all(result.assets.map(async (asset) => {
        const largest = Math.max(asset.width, asset.height);
        const resize = largest > MAX_EDGE
          ? asset.width >= asset.height
            ? { width: MAX_EDGE }
            : { height: MAX_EDGE }
          : null;
        const image = await manipulateAsync(
          asset.uri,
          resize ? [{ resize }] : [],
          { compress: 0.82, format: SaveFormat.JPEG },
        );
        const response = await fetch(image.uri);
        const sizeBytes = (await response.blob()).size;
        return { uri: image.uri, mimeType: 'image/jpeg' as const, sizeBytes };
      }));
      setPhotos((current) => [...current, ...normalized].slice(0, 3));
    } catch {
      setError('照片处理失败，请重新选择。');
    }
  };

  const submit = async () => {
    const validation = validateWorkOrder({
      elevatorArea,
      elevatorCode,
      description,
      priority,
      assigneeId,
      photos,
    });
    if (validation) return setError(validation);

    setSubmitting(true);
    setError(null);
    try {
      const created = await workOrderService.create({
        id: draftId,
        elevatorArea,
        elevatorCode,
        description,
        priority,
        assigneeId,
        photos,
      });
      router.replace({ pathname: '/(app)/work-orders/[id]', params: { id: created.id } });
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen title="新建工单" description="现场信息与照片全部上传成功后才会创建工单。">
      <Button label="返回工单" onPress={() => router.back()} variant="quiet" />
      {error && <Notice tone="error">{error}</Notice>}
      <Panel>
        <Text style={styles.sectionTitle}>故障信息</Text>
        <Field label="电梯区域" onChangeText={setElevatorArea} value={elevatorArea} />
        <Field label="梯号或设备编号" onChangeText={setElevatorCode} value={elevatorCode} />
        <Field label="故障描述" multiline onChangeText={setDescription} value={description} />
        <Text style={styles.label}>优先级</Text>
        <View style={styles.segment}>
          {(['normal', 'urgent'] as const).map((value) => (
            <Pressable
              accessibilityLabel={value === 'normal' ? '优先级一般' : '优先级紧急'}
              accessibilityRole="radio"
              accessibilityState={{ checked: priority === value }}
              key={value}
              onPress={() => setPriority(value)}
              style={[styles.segmentItem, priority === value && styles.segmentActive]}
            >
              <Text style={[styles.segmentText, priority === value && styles.segmentTextActive]}>
                {value === 'normal' ? '一般' : '紧急'}
              </Text>
            </Pressable>
          ))}
        </View>
      </Panel>
      <Panel>
        <Text style={styles.sectionTitle}>接手工程师</Text>
        {loadingEngineers ? (
          <Text style={styles.help}>正在加载工程师…</Text>
        ) : engineerError ? (
          <>
            <Notice tone="error">{engineerError}</Notice>
            <Button label="重新加载工程师" onPress={loadEngineers} variant="secondary" />
          </>
        ) : engineers.length ? engineers.map((engineer) => (
          <Pressable
            accessibilityLabel={`选择工程师 ${engineer.displayName}`}
            accessibilityRole="radio"
            accessibilityState={{ checked: assigneeId === engineer.id }}
            key={engineer.id}
            onPress={() => setAssigneeId(engineer.id)}
            style={[styles.option, assigneeId === engineer.id && styles.optionSelected]}
          >
            <Text style={styles.optionText}>{engineer.displayName}</Text>
            <Text style={styles.help}>{assigneeId === engineer.id ? '已选择' : '点击选择'}</Text>
          </Pressable>
        )) : (
          <Notice tone="error">没有可用工程师，请联系管理员启用账号。</Notice>
        )}
      </Panel>
      <Panel>
        <Text style={styles.sectionTitle}>现场照片（1–3 张）</Text>
        <View style={styles.photoGrid}>
          {photos.map((photo, index) => (
            <View key={photo.uri} style={styles.photoItem}>
              <Image accessibilityLabel={`现场照片 ${index + 1}`} source={{ uri: photo.uri }} style={styles.photo} />
              <Button
                label={`移除照片 ${index + 1}`}
                onPress={() => setPhotos((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                variant="quiet"
              />
            </View>
          ))}
        </View>
        <Button
          disabled={photos.length >= 3 || submitting}
          label={photos.length ? '继续选择照片' : '选择现场照片'}
          onPress={() => void choosePhotos()}
          variant="secondary"
        />
        <Text style={styles.help}>照片会转换为最长边 2048px、质量 0.82 的 JPEG。</Text>
      </Panel>
      <Button
        disabled={loadingEngineers}
        label="创建并派工"
        loading={submitting}
        onPress={() => void submit()}
        testID="create-work-order-submit"
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  sectionTitle: { color: colors.text, fontSize: 18, fontWeight: '700' },
  label: { color: colors.primary, fontSize: 14, fontWeight: '600' },
  segment: { flexDirection: 'row', gap: 8 },
  segmentItem: { alignItems: 'center', borderColor: '#94A3B8', borderRadius: 8, borderWidth: 1, flex: 1, justifyContent: 'center', minHeight: 48 },
  segmentActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  segmentText: { color: colors.primary, fontSize: 15, fontWeight: '600' },
  segmentTextActive: { color: colors.white },
  option: { alignItems: 'center', borderColor: colors.border, borderRadius: 8, borderWidth: 1, flexDirection: 'row', justifyContent: 'space-between', minHeight: 48, paddingHorizontal: 12, paddingVertical: 8 },
  optionSelected: { backgroundColor: colors.accentSoft, borderColor: colors.accent },
  optionText: { color: colors.text, fontSize: 16, fontWeight: '600' },
  help: { color: colors.secondary, fontSize: 13, lineHeight: 20 },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  photoItem: { borderColor: colors.border, borderRadius: 8, borderWidth: 1, overflow: 'hidden', width: '48%' },
  photo: { aspectRatio: 1, backgroundColor: colors.surfaceSubtle, width: '100%' },
});
