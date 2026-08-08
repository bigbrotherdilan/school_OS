import { useAuthStore } from '../stores/authStore';
import { useTenantStore } from '../stores/tenantStore';

/**
 * Whether the current user may RECORD financial transactions
 * (payments, expenses, fee/invoice generation).
 *
 * - Platform admin: always yes.
 * - Bursar (current tenant): always yes.
 * - Admin (current tenant): only while the school's TenantConfig
 *   finance_recording is 'admin_and_bursar' (default).
 */
export const useCanRecordFinance = () => {
  const roles = useAuthStore(s => s.roles);
  const user = useAuthStore(s => s.user);
  const activeTenantId = useTenantStore(s => s.activeTenantId);
  const financeRecording = useTenantStore(s => s.schoolConfig.finance_recording);

  if (user?.is_platform_admin) return true;

  const tenantRoles = roles
    .filter(r => r.tenant_id === activeTenantId)
    .map(r => r.role);

  if (tenantRoles.includes('bursar')) return true;
  if (financeRecording === 'bursar_only') return false;
  return tenantRoles.includes('admin') || tenantRoles.includes('super_admin');
};
