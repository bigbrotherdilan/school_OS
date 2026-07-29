import { api } from './api';

const BASE = '/reports/analytics';

export const analyticsApi = {
  getExamPerformance: async (params: { term_id: string; academic_year_id: string }) => {
    const res = await api.get(`${BASE}/exam-performance/`, { params });
    return res.data;
  },

  getSubjectPerformance: async (params: { subject_id: string; term_id: string; academic_year_id: string }) => {
    const res = await api.get(`${BASE}/subject-performance/`, { params });
    return res.data;
  },

  getClassPerformance: async (params: { class_id: string; term_id: string; academic_year_id: string }) => {
    const res = await api.get(`${BASE}/class-performance/`, { params });
    return res.data;
  },

  getTeacherSummary: async (params?: { term_id?: string }) => {
    const res = await api.get(`${BASE}/teacher-summary/`, { params });
    return res.data;
  },

  getMetadata: async () => {
    const res = await api.get(`${BASE}/metadata/`);
    return res.data;
  },
};
