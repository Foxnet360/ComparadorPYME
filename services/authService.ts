import { createClient, User } from '@supabase/supabase-js';
import { UserProfile } from '../types';
import { organizationService } from './organizationService';
import { getEffectiveCommercialPolicies } from '../src/data/commercialPolicies';

// Supabase anon credentials are public by design (RLS enforces authorization,
// never the key). They come from the build/dev environment, not from this
// repo: .env.local for dev, Railway variables (via loadEnv in vite.config.ts
// and the Dockerfile ARGs) for production builds.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  // Fail-soft at module load: tests import this module without env vars, and
  // a hard throw would brick them. Auth calls fail loudly without real values.
  console.error(
    '[authService] Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY — ' +
      'define them in .env.local (dev) or in the build environment (Railway).'
  );
}

export const supabase = createClient(
  (supabaseUrl && supabaseUrl.trim()) || 'https://placeholder.supabase.co',
  (supabaseAnonKey && supabaseAnonKey.trim()) || 'placeholder-anon-key-not-a-secret',
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
    },
  }
);

/** ERR-4: build the app profile strictly from the Supabase session/user. No
 * auth data is persisted in localStorage/IndexedDB — the Supabase client
 * owns the session. */
function profileFromUser(user: User): UserProfile {
  const metadata = (user.user_metadata ?? {}) as Record<string, unknown>;
  const name = (metadata.name as string | undefined) || user.email?.split('@')[0] || 'Usuario';

  const role = (metadata.role ?? 'ally_technical') as UserProfile['role'];

  return {
    id: user.id,
    email: user.email || '',
    name,
    role,
    allyId:
      (metadata.org_id as string | undefined) ||
      (metadata.orgId as string | undefined) ||
      (metadata.ally_id as string | undefined) ||
      (metadata.allyId as string | undefined) ||
      (role === 'super_admin' ? 'csa-global' : 'ally-100'),
    allyName:
      (metadata.org_name as string | undefined) ||
      (metadata.orgName as string | undefined) ||
      (metadata.ally_name as string | undefined) ||
      (metadata.allyName as string | undefined) ||
      (metadata.intermediary_name as string | undefined) ||
      (role === 'super_admin' ? 'Plataforma Global CSA' : 'Correduría Andina de Seguros S.A.'),
    avatarUrl:
      (metadata.avatar_url as string | undefined) ||
      `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=4f46e5&color=fff`,
    intermediaryName: (metadata.intermediary_name as string | undefined) || '',
    registrationNumber: (metadata.registration_number as string | undefined) || '',
    address: (metadata.address as string | undefined) || '',
    city: (metadata.city as string | undefined) || '',
    logoUrl: (metadata.logo_url as string | undefined) || '',
    commercialPolicies:
      metadata.commercial_policies || metadata.commercialPolicies
        ? getEffectiveCommercialPolicies(
            (metadata.commercial_policies || metadata.commercialPolicies) as any
          )
        : undefined,
    agentDetails: {
      phone: (metadata.phone as string | undefined) || '',
      field: (metadata.field as string | undefined) || '',
      bio: metadata.bio as string | undefined,
    },
  };
}

export const authService = {
  // Registro de usuario (Administrador de Aliado / Intermediario por defecto)
  signUp: async (
    email: string,
    password: string,
    name: string,
    metadata?: {
      intermediaryName?: string;
      nit?: string;
      phone?: string;
      role?: 'super_admin' | 'ally_admin' | 'ally_technical';
      acceptedTerms?: boolean;
      acceptedDataPolicy?: boolean;
    }
  ): Promise<{ user: User | null; message: string }> => {
    const role = metadata?.role || 'ally_admin';
    const nowIso = new Date().toISOString();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name,
          role,
          intermediary_name: metadata?.intermediaryName || '',
          org_name: metadata?.intermediaryName || '',
          nit: metadata?.nit || '',
          phone: metadata?.phone || '',
          terms_accepted_at: metadata?.acceptedTerms ? nowIso : null,
          data_policy_accepted_at: metadata?.acceptedDataPolicy ? nowIso : null,
          consent_version: '2026.1',
        },
      },
    });

    if (error) {
      throw new Error(error.message);
    }

    if (metadata?.intermediaryName && data.user) {
      try {
        await organizationService.createOrganization({
          name: metadata.intermediaryName,
          nit: metadata.nit,
          phone: metadata.phone,
          contact_email: email,
        });
      } catch (err) {
        console.warn('Could not auto-create organization on signup, will sync on login', err);
      }
    }

    return {
      user: data.user,
      message:
        '¡Registro exitoso de Compañía Aliada! Ya puedes iniciar sesión con tu cuenta de Administrador.',
    };
  },

  // Login
  signIn: async (email: string, password: string): Promise<UserProfile> => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      throw new Error(error.message);
    }

    if (!data.user) {
      throw new Error('No se pudo iniciar sesión');
    }

    // ERR-4: nothing is written to localStorage — the Supabase client owns
    // the persisted session.
    return profileFromUser(data.user);
  },

  // Cerrar sesión
  signOut: async (): Promise<void> => {
    await supabase.auth.signOut();
  },

  // Obtener usuario actual
  getCurrentUser: async (): Promise<UserProfile | null> => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return null;
    }

    return profileFromUser(user);
  },

  // ERR-4: profile updates persist to the Supabase user metadata instead of
  // the removed localStorage/IndexedDB copies.
  updateProfile: async (profile: UserProfile): Promise<UserProfile> => {
    const { error } = await supabase.auth.updateUser({
      data: {
        name: profile.name,
        intermediary_name: profile.intermediaryName || '',
        registration_number: profile.registrationNumber || '',
        phone: profile.agentDetails?.phone || '',
        field: profile.agentDetails?.field || '',
        bio: profile.agentDetails?.bio || '',
        address: profile.address || profile.agentDetails?.address || '',
        city: profile.city || profile.agentDetails?.city || '',
        logo_url: profile.logoUrl || profile.agentDetails?.logoUrl || '',
        avatar_url: profile.avatarUrl || '',
        commercial_policies: profile.commercialPolicies || null,
      },
    });

    if (error) {
      throw new Error(error.message);
    }

    return profile;
  },

  // Enviar email de recuperación de contraseña
  resetPassword: async (email: string): Promise<void> => {
    const origin =
      typeof window !== 'undefined' && window.location?.origin
        ? window.location.origin
        : 'https://comparadorpyme-production.up.railway.app';

    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${origin}/#type=recovery`,
    });

    if (error) {
      throw new Error(error.message);
    }
  },

  // Actualizar contraseña del usuario activo (usado en flujo de recuperación)
  updatePassword: async (newPassword: string): Promise<void> => {
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (error) {
      throw new Error(error.message);
    }
  },

  // Escuchar cambios de autenticación
  onAuthStateChange: (callback: (user: UserProfile | null, event?: string) => void) => {
    return supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        callback(session?.user ? profileFromUser(session.user) : null, 'PASSWORD_RECOVERY');
      } else if (event === 'SIGNED_IN' && session?.user) {
        // ERR-4: no local persistence — the session lives in the client.
        callback(profileFromUser(session.user), 'SIGNED_IN');
      } else if (event === 'SIGNED_OUT') {
        callback(null, 'SIGNED_OUT');
      }
    });
  },
};
