import { AppError } from '@/lib/app-error';
import { mapSupabaseError } from '@/lib/map-supabase-error';
import { getSupabase } from '@/lib/supabase';
import type { EngineerOption, Profile, UserRole } from '@/types';

type ProfileRow = {
  id: string;
  display_name: string;
  role: UserRole;
  is_active: boolean;
};

function mapProfile(row: ProfileRow): Profile {
  return {
    id: row.id,
    displayName: row.display_name,
    role: row.role,
    isActive: row.is_active,
  };
}

async function getCurrent(): Promise<Profile> {
  try {
    const { data: userResult, error: userError } = await getSupabase().auth.getUser();
    if (userError) throw userError;
    if (!userResult.user) throw new AppError('AUTH_REQUIRED', 'No authenticated user');

    const { data, error } = await getSupabase()
      .from('profiles')
      .select('id, display_name, role, is_active')
      .eq('id', userResult.user.id)
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new AppError('PROFILE_MISSING', 'Profile is missing');

    const profile = mapProfile(data as ProfileRow);
    if (!profile.isActive) throw new AppError('ACCOUNT_DISABLED', 'Profile is disabled');
    return profile;
  } catch (error) {
    throw mapSupabaseError(error);
  }
}

async function listActiveEngineers(): Promise<EngineerOption[]> {
  try {
    const { data, error } = await getSupabase().rpc('list_active_engineers');
    if (error) throw error;
    if (!Array.isArray(data)) throw new AppError('SERVER_ERROR', 'Invalid engineer response');
    return data.map((row) => {
      const value = row as { id: string; display_name: string };
      return { id: value.id, displayName: value.display_name };
    });
  } catch (error) {
    throw mapSupabaseError(error);
  }
}

export const profileService = { getCurrent, listActiveEngineers };
