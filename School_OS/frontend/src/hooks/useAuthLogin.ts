import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { useTenantStore } from '../stores/tenantStore';
import { api } from '../services/api';

export interface ActiveSession {
    id: string;
    device_name: string;
    device_type: string;
    browser: string;
    os: string;
    ip_address: string;
    last_active: string;
    login_at: string;
}

interface UseAuthLoginProps {
    allowedRole?: string;
    allowedRoles?: string[];
    targetPath?: string;
}

export const useAuthLogin = ({ allowedRole, allowedRoles, targetPath }: UseAuthLoginProps = {}) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [activeSessions, setActiveSessions] = useState<ActiveSession[] | null>(null);
    const [loginToken, setLoginToken] = useState<string | null>(null);
    
    const navigate = useNavigate();
    const setAuth = useAuthStore((state) => state.setAuth);

    const completeLogin = (data: any) => {
        const { access, refresh, user, tenants, roles, session_id, device } = data;
        const refreshToken = refresh || null;

        const rolesList = roles.map((r: any) => r.role);
        const hasAllowedRole = (allowedRole && allowedRole !== 'any' && rolesList.includes(allowedRole)) ||
                               (allowedRoles && allowedRoles.some(r => rolesList.includes(r)));
        if ((allowedRole || allowedRoles) && !hasAllowedRole && !user.is_platform_admin) {
            const roleNames = allowedRoles ? allowedRoles.join(' or ') : allowedRole;
            setError(`Unauthorized. This portal is restricted to ${roleNames} accounts.`);
            setIsLoading(false);
            return false;
        }

        setAuth(access, refreshToken, user, tenants, roles, session_id, device);
        if (tenants.length > 0) {
            useTenantStore.getState().setActiveTenantId(tenants[0].id);
        }
        return true;
    };

    const navigateForUser = (user: any, roles: any[]) => {
        if (user?.must_change_password) {
            navigate('/force-password-change');
            return;
        }
        if (targetPath) navigate(targetPath);
        else if (user?.is_platform_admin) navigate('/admin/system');
        else if (roles.length > 0) {
            if (roles.includes('government')) navigate('/gov');
            else if (roles.includes('teacher')) navigate('/teacher');
            else if (roles.includes('admin') || roles.includes('super_admin')) navigate('/admin');
            else if (roles.includes('parent')) navigate('/parent');
            else navigate('/dashboard');
        }
    };

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');
        setActiveSessions(null);
        setLoginToken(null);

        try {
            const response = await api.post('/auth/login/', { email, password });

            if (response.status === 200) {
                if (completeLogin(response.data)) {
                    const { user, roles } = response.data;
                    const rolesList = roles.map((r: any) => r.role);
                    navigateForUser(user, rolesList);
                }
            }
        } catch (err: any) {
            if (err.response?.status === 409 && err.response?.data?.requires_device_kill) {
                setActiveSessions(err.response.data.active_sessions);
                setLoginToken(err.response.data.login_token);
                setError(err.response.data.message || 'Maximum active devices reached.');
                return;
            }
            setError(err.response?.data?.detail || 'Invalid credentials or server unreachable.');
        } finally {
            setIsLoading(false);
        }
    };

    const confirmKillSessions = async () => {
        if (!loginToken) return;
        setIsLoading(true);
        setError('');

        try {
            const response = await api.post('/auth/login/confirm-kill/', { login_token: loginToken });
            if (completeLogin(response.data)) {
                const { user, roles } = response.data;
                const rolesList = roles.map((r: any) => r.role);
                navigateForUser(user, rolesList);
            }
        } catch (err: any) {
            setError(err.response?.data?.detail || 'Session confirmation failed. Please log in again.');
            setActiveSessions(null);
            setLoginToken(null);
        } finally {
            setIsLoading(false);
        }
    };

    const cancelLogin = () => {
        setActiveSessions(null);
        setLoginToken(null);
        setError('');
    };

    return {
        email, setEmail, password, setPassword,
        error, isLoading, activeSessions, loginToken,
        handleLogin, confirmKillSessions, cancelLogin,
    };
};
