import type { PropsWithChildren, ReactNode } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export const colors = {
  background: '#F8FAFC',
  surface: '#FFFFFF',
  surfaceSubtle: '#F1F5F9',
  primary: '#1E293B',
  secondary: '#475569',
  accent: '#047857',
  accentSoft: '#ECFDF5',
  border: '#D7DEE7',
  danger: '#B91C1C',
  dangerSoft: '#FEF2F2',
  warning: '#9A3412',
  warningSoft: '#FFF7ED',
  info: '#1D4ED8',
  infoSoft: '#EFF6FF',
  text: '#0F172A',
  white: '#FFFFFF',
} as const;

export function Screen({
  children,
  scroll = true,
  title,
  description,
  action,
}: PropsWithChildren<{
  scroll?: boolean;
  title?: string;
  description?: string;
  action?: ReactNode;
}>) {
  const content = (
    <View style={styles.content}>
      {(title || action) && (
        <View style={styles.headingRow}>
          <View style={styles.headingCopy}>
            {title && <Text style={styles.title}>{title}</Text>}
            {description && <Text style={styles.description}>{description}</Text>}
          </View>
          {action}
        </View>
      )}
      {children}
    </View>
  );

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        {scroll ? (
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardDismissMode="on-drag"
            keyboardShouldPersistTaps="handled"
          >
            {content}
          </ScrollView>
        ) : content}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export function Brand() {
  return (
    <View style={styles.brand}>
      <View accessibilityElementsHidden style={styles.brandMark}>
        <Text style={styles.brandMarkText}>T</Text>
      </View>
      <View>
        <Text style={styles.brandName}>梯维派工</Text>
        <Text style={styles.brandCaption}>电梯故障处理工作台</Text>
      </View>
    </View>
  );
}

export function Button({
  label,
  onPress,
  disabled,
  loading,
  variant = 'primary',
  testID,
}: {
  label: string;
  onPress(): void;
  disabled?: boolean;
  loading?: boolean;
  variant?: 'primary' | 'secondary' | 'danger' | 'quiet';
  testID?: string;
}) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(disabled || loading), busy: Boolean(loading) }}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        styles[`button_${variant}`],
        (disabled || loading) && styles.disabled,
        pressed && styles.pressed,
      ]}
      testID={testID}
    >
      {loading && <ActivityIndicator color={variant === 'secondary' || variant === 'quiet' ? colors.primary : colors.white} />}
      <Text style={[styles.buttonLabel, styles[`buttonLabel_${variant}`]]}>
        {loading ? '处理中…' : label}
      </Text>
    </Pressable>
  );
}

export function Field({
  label,
  error,
  hint,
  multiline,
  ...props
}: TextInputProps & { label: string; error?: string | null; hint?: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        accessibilityHint={error ?? hint}
        accessibilityLabel={label}
        multiline={multiline}
        placeholderTextColor="#64748B"
        style={[styles.input, multiline && styles.textarea, error && styles.inputError]}
        {...props}
      />
      {hint && !error && <Text style={styles.hint}>{hint}</Text>}
      {error && (
        <Text accessibilityLiveRegion="polite" style={styles.fieldError}>
          {error}
        </Text>
      )}
    </View>
  );
}

export function Panel({ children }: PropsWithChildren) {
  return <View style={styles.panel}>{children}</View>;
}

export function Notice({
  children,
  tone = 'info',
}: PropsWithChildren<{ tone?: 'info' | 'error' | 'warning' | 'success' }>) {
  return (
    <View accessibilityRole={tone === 'error' ? 'alert' : 'text'} style={[styles.notice, styles[`notice_${tone}`]]}>
      <Text style={[styles.noticeText, styles[`noticeText_${tone}`]]}>{children}</Text>
    </View>
  );
}

export function LoadingState({ label = '正在加载…' }: { label?: string }) {
  return (
    <View accessibilityLabel={label} accessibilityRole="progressbar" style={styles.loading}>
      <ActivityIndicator color={colors.accent} size="large" />
      <Text style={styles.description}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { backgroundColor: colors.background, flex: 1 },
  flex: { flex: 1 },
  scrollContent: { flexGrow: 1 },
  content: { flex: 1, gap: 16, padding: 20, width: '100%' },
  headingRow: { alignItems: 'flex-start', flexDirection: 'row', gap: 12, justifyContent: 'space-between' },
  headingCopy: { flex: 1 },
  title: { color: colors.text, fontSize: 26, fontWeight: '700', lineHeight: 34 },
  description: { color: colors.secondary, fontSize: 15, lineHeight: 22, marginTop: 4 },
  brand: { alignItems: 'center', flexDirection: 'row', gap: 12, marginBottom: 12 },
  brandMark: { alignItems: 'center', backgroundColor: colors.primary, borderRadius: 8, height: 44, justifyContent: 'center', width: 44 },
  brandMarkText: { color: colors.white, fontSize: 22, fontWeight: '800' },
  brandName: { color: colors.text, fontSize: 20, fontWeight: '700' },
  brandCaption: { color: colors.secondary, fontSize: 13, marginTop: 1 },
  button: { alignItems: 'center', borderRadius: 8, borderWidth: 1, flexDirection: 'row', gap: 8, justifyContent: 'center', minHeight: 48, paddingHorizontal: 16, paddingVertical: 11 },
  button_primary: { backgroundColor: colors.accent, borderColor: colors.accent },
  button_secondary: { backgroundColor: colors.surface, borderColor: '#94A3B8' },
  button_danger: { backgroundColor: colors.danger, borderColor: colors.danger },
  button_quiet: { backgroundColor: 'transparent', borderColor: 'transparent' },
  buttonLabel: { fontSize: 16, fontWeight: '600' },
  buttonLabel_primary: { color: colors.white },
  buttonLabel_secondary: { color: colors.primary },
  buttonLabel_danger: { color: colors.white },
  buttonLabel_quiet: { color: colors.info },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.76 },
  field: { gap: 7 },
  label: { color: colors.primary, fontSize: 14, fontWeight: '600' },
  input: { backgroundColor: colors.surface, borderColor: '#94A3B8', borderRadius: 8, borderWidth: 1, color: colors.text, fontSize: 16, minHeight: 48, paddingHorizontal: 12, paddingVertical: 11 },
  textarea: { minHeight: 104, textAlignVertical: 'top' },
  inputError: { borderColor: colors.danger },
  hint: { color: colors.secondary, fontSize: 13, lineHeight: 19 },
  fieldError: { color: colors.danger, fontSize: 14, lineHeight: 20 },
  panel: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 8, borderWidth: 1, gap: 14, padding: 16 },
  notice: { borderLeftWidth: 3, borderRadius: 4, paddingHorizontal: 12, paddingVertical: 10 },
  notice_info: { backgroundColor: colors.infoSoft, borderLeftColor: colors.info },
  notice_error: { backgroundColor: colors.dangerSoft, borderLeftColor: colors.danger },
  notice_warning: { backgroundColor: colors.warningSoft, borderLeftColor: colors.warning },
  notice_success: { backgroundColor: colors.accentSoft, borderLeftColor: colors.accent },
  noticeText: { fontSize: 14, lineHeight: 21 },
  noticeText_info: { color: '#1E3A8A' },
  noticeText_error: { color: '#991B1B' },
  noticeText_warning: { color: '#7C2D12' },
  noticeText_success: { color: '#065F46' },
  loading: { alignItems: 'center', flex: 1, gap: 12, justifyContent: 'center', minHeight: 240 },
});

export const commonStyles = styles;
