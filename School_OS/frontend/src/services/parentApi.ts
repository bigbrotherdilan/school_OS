import { api } from './api';
import type { ParentDashboardData, ChildComparison } from '../stores/parentStore';

export interface ChildSummary {
    student: {
        id: string;
        first_name: string;
        last_name: string;
        grade: string;
        campus: string;
        photo_url: string;
        admission_number: string;
    };
    attendance: {
        percentage: number | null;
        present_days: number;
        total_days: number;
    };
    terms: {
        term_name: string;
        term_order: number;
        term_id: string;
        sequences: {
            sequence_name: string;
            sequence_order: number;
            sequence_id: string;
            is_locked: boolean;
            is_shared: boolean;
            subjects: {
                name: string;
                score: number;
                out_of: number;
                coefficient: number;
            }[];
        }[];
    }[];
}

export interface AnalyticsResult {
    id: string;
    subject_name: string;
    score: string;
    exam_name: string;
    term_name: string;
    term_order: number;
    sequence_name: string;
    sequence_order: number;
    score_out_of: number;
    coefficient: number;
    weighted_score: number;
}

export const parentApi = {
    getDashboard: async (): Promise<ParentDashboardData> => {
        const response = await api.get('/students/parent-dashboard/');
        return response.data;
    },

    getFees: async () => {
        const response = await api.get('/students/parent-fees/');
        return response.data;
    },

    getTransactions: async () => {
        const response = await api.get('/students/parent-fees/');
        return response.data;
    },

    getAnalytics: async (studentId: string): Promise<{ results: AnalyticsResult[]; grading_config?: { scale_max: number; grade_a: number; grade_b: number; grade_c: number } }> => {
        const response = await api.get(`/students/parent-analytics/?student=${studentId}`);
        return response.data;
    },

    getChildSummary: async (studentId: string): Promise<ChildSummary> => {
        const response = await api.get(`/students/parent-child-summary/${studentId}/`);
        return response.data;
    },

    getComparison: async (): Promise<{ children: ChildComparison[] }> => {
        const response = await api.get('/students/parent-comparison/');
        return response.data;
    },

    getAttendance: async (studentId: string) => {
        const response = await api.get(`/attendance/records/?student=${studentId}`);
        return response.data.results || response.data;
    },

    updateProfile: async (data: { first_name?: string; last_name?: string; phone?: string; default_language?: string; email_alerts?: boolean; sms_alerts?: boolean }) => {
        const response = await api.patch('/auth/me/', data);
        return response.data;
    },

    initiatePayment: async (paymentData: {
        invoice_id: string;
        amount: number;
        payment_method: string;
        phone_number: string;
    }): Promise<{ reference_number: string; status: string }> => {
        const response = await api.post('/students/parent-payment/', paymentData);
        return response.data;
    },
};
