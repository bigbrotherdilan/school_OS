import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface User {
  id: string;
  email: string;
  full_name: string;
  first_name: string;
  last_name: string;
  profile_photo?: string;
  default_language: string;
  email_alerts: boolean;
  sms_alerts: boolean;
  is_platform_admin: boolean;
}

export interface TenantInfo {
  id: string;
  school_name: string;
  education_type: string;
  logo_url: string;
}

export interface RoleInfo {
  tenant_id: string;
  role: string;
  role_display: string;
}

export interface DeviceInfo {
  device_name: string;
  device_type: string;
  browser: string;
  os: string;
}

interface AuthState {
  token: string | null;
  refreshToken: string | null;
  user: User | null;
  tenants: TenantInfo[];
  roles: RoleInfo[];
  sessionId: string | null;
  deviceInfo: DeviceInfo | null;
  
  // Actions
  setAuth: (token: string, refreshToken: string, user: User, tenants: TenantInfo[], roles: RoleInfo[], sessionId?: string, deviceInfo?: DeviceInfo) => void;
  setToken: (token: string) => void;
  logout: () => void;
  
  // Selectors/Computed
  isAuthenticated: () => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      refreshToken: null,
      user: null,
      tenants: [],
      roles: [],
      sessionId: null,
      deviceInfo: null,

      setAuth: (token, refreshToken, user, tenants, roles, sessionId, deviceInfo) =>
        set({ token, refreshToken, user, tenants, roles, sessionId, deviceInfo: deviceInfo || null }),

      setToken: (token) => set({ token }),

      logout: () =>
        set({ token: null, refreshToken: null, user: null, tenants: [], roles: [], sessionId: null, deviceInfo: null }),

      isAuthenticated: () => !!get().token,
    }),
    {
      name: 'sos-auth-storage',
      partialize: (state) => ({
        token: state.token,
        user: state.user,
        tenants: state.tenants,
        roles: state.roles,
        sessionId: state.sessionId,
      }),
    }
  )
);
