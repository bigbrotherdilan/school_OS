import { create } from 'zustand';

export interface WardSummary {
    id: string;
    first_name: string;
    last_name: string;
    grade: string;
    campus: string;
    photo_url: string;
    attendance_percentage: number | null;
    recent_grade: {
        subject: string;
        score_label: string;
    } | null;
}

export interface AlertSummary {
    id: string;
    type: 'financial' | 'event' | 'general';
    title: string;
    message: string;
    amount?: number;
    action_text: string;
    date: string;
    student_id?: string;
    student_first_name?: string;
    student_last_name?: string;
}

export interface ParentDashboardData {
    parent_name: string;
    total_enrollment: number;
    fiscal_status: string;
    wards: WardSummary[];
    alerts: AlertSummary[];
}

export interface ChildComparison {
    id: string;
    name: string;
    last_name: string;
    grade: string;
    campus: string;
    photo_url: string;
    attendance_pct: number | null;
    sequences_with_marks: number;
    sequences_total: number;
    subjects_with_scores: {
        name: string;
        latest_score: number;
        out_of: number;
    }[];
}

interface ParentState {
    dashboardData: ParentDashboardData | null;
    isLoading: boolean;
    error: string | null;
    selectedWardId: string | null;
    notificationCount: number;
    comparisonChildren: ChildComparison[];
    comparisonLoading: boolean;
    setDashboardData: (data: ParentDashboardData) => void;
    setLoading: (loading: boolean) => void;
    setError: (error: string | null) => void;
    setSelectedWardId: (id: string | null) => void;
    setNotificationCount: (count: number) => void;
    setComparisonChildren: (children: ChildComparison[]) => void;
    setComparisonLoading: (loading: boolean) => void;
}

export const useParentStore = create<ParentState>((set) => ({
    dashboardData: null,
    isLoading: false,
    error: null,
    selectedWardId: null,
    notificationCount: 0,
    comparisonChildren: [],
    comparisonLoading: false,
    setDashboardData: (data) => set({
        dashboardData: data,
        error: null,
        selectedWardId: data.wards.length > 0 ? data.wards[0].id : null,
    }),
    setLoading: (loading) => set({ isLoading: loading }),
    setError: (error) => set({ error }),
    setSelectedWardId: (id) => set({ selectedWardId: id }),
    setNotificationCount: (count) => set({ notificationCount: count }),
    setComparisonChildren: (children) => set({ comparisonChildren: children }),
    setComparisonLoading: (loading) => set({ comparisonLoading: loading }),
}));
