import { createClient, User } from '@supabase/supabase-js';
import { UserProfile } from '../types';

const supabaseUrl = 'https://nubiecwypgfekhvaffxm.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im51YmllY3d5cGdmZWtodmFmZnhtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0MDgxMjQsImV4cCI6MjA4OTk4NDEyNH0.Yxh0tCPZm9pyysQxsdDaWRJbf54FnNKhrqQo9ZsI4yw';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
});

export const authService = {
  // Registro de usuario
  signUp: async (email: string, password: string, name: string): Promise<{ user: User | null; message: string }> => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name: name,
          role: 'USER'
        }
      }
    });

    if (error) {
      throw new Error(error.message);
    }

    return { 
      user: data.user, 
      message: 'Te hemos enviado un email de confirmación. Por favor revisa tu bandeja de entrada.' 
    };
  },

  // Login
  signIn: async (email: string, password: string): Promise<UserProfile> => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      throw new Error(error.message);
    }

    if (!data.user) {
      throw new Error('No se pudo iniciar sesión');
    }

    // Verificar si el email está confirmado
    if (!data.user.email_confirmed_at) {
      throw new Error('Por favor confirma tu email antes de iniciar sesión. Revisa tu bandeja de entrada.');
    }

    const profile: UserProfile = {
      id: data.user.id,
      email: data.user.email || '',
      name: data.user.user_metadata?.name || data.user.email?.split('@')[0] || 'Usuario',
      role: data.user.user_metadata?.role || 'USER',
      avatarUrl: data.user.user_metadata?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(data.user.user_metadata?.name || 'Usuario')}&background=4f46e5&color=fff`,
      intermediaryName: data.user.user_metadata?.intermediary_name || ''
    };

    // Guardar en localStorage para compatibilidad
    localStorage.setItem('seguro_app_user', JSON.stringify(profile));

    return profile;
  },

  // Cerrar sesión
  signOut: async (): Promise<void> => {
    await supabase.auth.signOut();
    localStorage.removeItem('seguro_app_user');
  },

  // Obtener usuario actual
  getCurrentUser: async (): Promise<UserProfile | null> => {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      // Intentar recuperar de localStorage
      const stored = localStorage.getItem('seguro_app_user');
      if (stored) {
        return JSON.parse(stored);
      }
      return null;
    }

    const profile: UserProfile = {
      id: user.id,
      email: user.email || '',
      name: user.user_metadata?.name || user.email?.split('@')[0] || 'Usuario',
      role: user.user_metadata?.role || 'USER',
      avatarUrl: user.user_metadata?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.user_metadata?.name || 'Usuario')}&background=4f46e5&color=fff`,
      intermediaryName: user.user_metadata?.intermediary_name || ''
    };

    return profile;
  },

  // Enviar email de recuperación de contraseña
  resetPassword: async (email: string): Promise<void> => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: 'https://compapyme.baconhacks.com/reset-password'
    });

    if (error) {
      throw new Error(error.message);
    }
  },

  // Escuchar cambios de autenticación
  onAuthStateChange: (callback: (user: UserProfile | null) => void) => {
    return supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        const profile: UserProfile = {
          id: session.user.id,
          email: session.user.email || '',
          name: session.user.user_metadata?.name || session.user.email?.split('@')[0] || 'Usuario',
          role: session.user.user_metadata?.role || 'USER',
          avatarUrl: session.user.user_metadata?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(session.user.user_metadata?.name || 'Usuario')}&background=4f46e5&color=fff`,
          intermediaryName: session.user.user_metadata?.intermediary_name || ''
        };
        localStorage.setItem('seguro_app_user', JSON.stringify(profile));
        callback(profile);
      } else if (event === 'SIGNED_OUT') {
        localStorage.removeItem('seguro_app_user');
        callback(null);
      }
    });
  }
};