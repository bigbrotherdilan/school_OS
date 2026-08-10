import { useEffect } from 'react';
import { useTenantStore } from '../stores/tenantStore';
import { useAuthStore } from '../stores/authStore';
import { applyThemeVars, DEFAULT_THEME } from '../utils/theme';

export function useTenantTheme() {
  const token = useAuthStore(s => s.token);
  const { activeTenantId, themeConfig, themeTenantId, fetchThemeConfig } = useTenantStore();

  useEffect(() => {
    if (!token || !activeTenantId) return;
    fetchThemeConfig(activeTenantId);
  }, [token, activeTenantId, fetchThemeConfig]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible' && token && activeTenantId) {
        fetchThemeConfig(activeTenantId);
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, [token, activeTenantId, fetchThemeConfig]);

  useEffect(() => {
    if (themeConfig && themeTenantId === activeTenantId) {
      applyThemeVars(themeConfig);
    } else {
      applyThemeVars(DEFAULT_THEME);
    }
  }, [themeConfig, themeTenantId, activeTenantId]);

  useEffect(() => {
    if (!token) {
      applyThemeVars(DEFAULT_THEME);
    }
  }, [token]);
}
