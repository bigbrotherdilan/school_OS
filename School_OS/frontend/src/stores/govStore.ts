import { create } from 'zustand';

interface GovAlert {
    id: string;
    type: 'warning' | 'error' | 'info' | 'success';
    title: string;
    message: string;
    date: string;
}

interface RegionalDistribution {
    name: string;
    schools_count: number;
    students_count?: number;
}

export interface NationalDashboardData {
    overview: {
        total_schools: number;
        total_students: number;
        national_attendance_rate: number;
        program_coverage_percent: number;
        performance_average: number;
        max_scale: number;
        scope: string;
    };
    regional_distribution: RegionalDistribution[];
    alerts: GovAlert[];
}

export interface MonitoringData {
    logbook: { total_entries: number; recent_entries: number };
    attendance: { total_sessions_30d: number; sessions_with_records: number; submission_rate: number };
    curriculum: { coverage_percent: number };
}

interface GovState {
    dashboardData: NationalDashboardData | null;
    monitoringData: MonitoringData | null;
    isLoading: boolean;
    error: string | null;
    fetchDashboard: () => Promise<void>;
    fetchMonitoring: () => Promise<void>;
}

export const useGovStore = create<GovState>((set) => ({
    dashboardData: null,
    monitoringData: null,
    isLoading: false,
    error: null,
    fetchDashboard: async () => {
        set({ isLoading: true, error: null });
        try {
            const { api } = await import('../services/api');
            const response = await api.get('/gov/dashboard/');
            set({ dashboardData: response.data, isLoading: false });
        } catch (error: any) {
            set({ 
                error: error.response?.data?.detail || 'Failed to load national data', 
                isLoading: false 
            });
        }
    },
    fetchMonitoring: async () => {
        try {
            const { api } = await import('../services/api');
            const response = await api.get('/gov/monitoring/');
            set({ monitoringData: response.data });
        } catch (error: any) {
            console.error('Failed to load monitoring data', error);
        }
    },
}));
