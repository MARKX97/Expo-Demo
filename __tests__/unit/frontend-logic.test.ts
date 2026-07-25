import { describe, expect, it } from '@jest/globals';

import {
  validateEmail,
  validatePassword,
  validateResolution,
  validateWorkOrder,
  sameDraftPhotos,
} from '@/lib/validation';
import { mapSupabaseError } from '@/lib/map-supabase-error';
import { availableWorkOrderActions } from '@/lib/work-order-actions';

describe('frontend validation', () => {
  it('validates login and password reset fields', () => {
    expect(validateEmail('bad')).toBeTruthy();
    expect(validateEmail('engineer@example.com')).toBeNull();
    expect(validatePassword('1234567')).toBeTruthy();
    expect(validatePassword('12345678')).toBeNull();
  });

  it('requires every work order field and 1–3 photos', () => {
    const values = {
      elevatorArea: 'A 区',
      elevatorCode: 'L-01',
      description: '门机异响',
      priority: 'normal' as const,
      assigneeId: 'engineer-id',
      photos: [{ uri: 'file://photo.jpg', mimeType: 'image/jpeg' as const, sizeBytes: 10 }],
    };
    expect(validateWorkOrder(values)).toBeNull();
    expect(validateWorkOrder({ ...values, elevatorArea: ' ' })).toBe('请填写电梯区域。');
    expect(validateWorkOrder({ ...values, photos: [] })).toBe('请选择 1–3 张现场照片。');
    expect(validateWorkOrder({ ...values, photos: [...values.photos, ...values.photos, ...values.photos, ...values.photos] }))
      .toBe('请选择 1–3 张现场照片。');
  });

  it('requires a bounded close resolution', () => {
    expect(validateResolution('  ')).toBe('请填写处理结果。');
    expect(validateResolution('已更换门机皮带')).toBeNull();
    expect(validateResolution('a'.repeat(2001))).toBe('处理结果不能超过 2000 字。');
  });

  it('rejects changed photos when retrying the same draft', () => {
    expect(sameDraftPhotos(['first'], ['first'])).toBe(true);
    expect(sameDraftPhotos(['first'], ['first', 'second'])).toBe(false);
    expect(sameDraftPhotos(['first'], ['second'])).toBe(false);
  });
});

describe('role actions', () => {
  it('only exposes actions permitted by role and status', () => {
    expect(availableWorkOrderActions('elevator_supervisor', 'assigned')).toEqual(['reassign']);
    expect(availableWorkOrderActions('elevator_supervisor', 'in_progress')).toEqual([]);
    expect(availableWorkOrderActions('elevator_engineer', 'assigned')).toEqual(['start']);
    expect(availableWorkOrderActions('elevator_engineer', 'in_progress')).toEqual(['close']);
    expect(availableWorkOrderActions('elevator_engineer', 'closed')).toEqual([]);
  });
});

describe('Supabase error mapping', () => {
  it('keeps stable business codes and recognizes expired sessions', () => {
    expect(mapSupabaseError({ message: 'VERSION_CONFLICT' }).code).toBe('VERSION_CONFLICT');
    expect(mapSupabaseError({ message: 'JWT expired', status: 401 }).code).toBe('AUTH_REQUIRED');
  });
});
