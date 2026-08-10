import { useEffect, useMemo } from 'react';
import { useTenantStore } from '../../stores/tenantStore';
import { buildThemeCss, googleFontUrl, DEFAULT_THEME } from '../../utils/theme';

export default function ThemeBridge() {
  const draftTheme = useTenantStore(state => state.draftTheme);
  const themeConfig = useTenantStore(state => state.themeConfig);

  const active = useMemo(
    () => draftTheme || themeConfig || DEFAULT_THEME,
    [draftTheme, themeConfig]
  );

  useEffect(() => {
    const styleId = 'sos-theme-bridge';
    let style = document.getElementById(styleId) as HTMLStyleElement | null;
    if (!style) {
      style = document.createElement('style');
      style.id = styleId;
      document.head.appendChild(style);
    }
    style.textContent = buildThemeCss(active);
  }, [active]);

  useEffect(() => {
    const linkId = 'sos-theme-font';
    const url = googleFontUrl(active.fontFamily);
    let link = document.getElementById(linkId) as HTMLLinkElement | null;
    if (link && link.href === url) return;
    if (!link) {
      link = document.createElement('link');
      link.id = linkId;
      link.rel = 'stylesheet';
      document.head.appendChild(link);
    }
    link.href = url;
  }, [active.fontFamily]);

  useEffect(() => {
    document.body.style.fontFamily = active.fontFamily;
  }, [active.fontFamily]);

  return null;
}
