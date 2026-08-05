import { api } from './api';

const BASE = '/reports';

export interface ReportCardSubjectScore {
  subject_name: string;
  coefficient: number;
  score: number | null;
  max_score: number;
  grade: string;
  grade_label: string;
  remarks: string;
}

export interface ReportCardPreviewData {
  student: {
    id: string;
    full_name: string;
    admission_number: string;
    class_name: string;
    date_of_birth: string | null;
    gender: string;
  };
  term_name: string;
  academic_year_name: string;
  education_type: string;
  subject_scores: ReportCardSubjectScore[];
  total_coefficient: number;
  average: number;
  max_scale: number;
  class_average: number | null;
  best_average: number | null;
  rank: number | null;
  class_size: number;
  decision: string;
  absences: number;
  discipline_count: number;
}

export const reportsApi = {
  fetchReportCardPreview: async (data: {
    student_id: string;
    term_id: string;
    academic_year_id: string;
  }): Promise<ReportCardPreviewData> => {
    const response = await api.post(`${BASE}/report-cards/preview/`, data);
    return response.data;
  },

  generateSingle: async (data: {
    student_id: string;
    term_id: string;
    academic_year_id: string;
    template_id?: string;
    style_overrides?: Record<string, any>;
  }) => {
    const response = await api.post(`${BASE}/report-cards/generate/`, data, {
      responseType: 'blob',
    });
    return response;
  },

  batchGenerate: async (data: {
    class_id: string;
    term_id: string;
    academic_year_id: string;
    template_id?: string;
    style_overrides?: Record<string, any>;
  }) => {
    const response = await api.post(`${BASE}/report-cards/batch-generate/`, data, {
      responseType: 'blob',
    });
    return response;
  },

  listReportCards: async (params?: {
    student_id?: string;
    class_id?: string;
    term_id?: string;
  }) => {
    const response = await api.get(`${BASE}/report-cards/list/`, { params });
    return response.data;
  },

  downloadReportCard: async (id: string) => {
    const response = await api.get(`${BASE}/report-cards/download/`, {
      params: { id },
      responseType: 'blob',
    });
    return response;
  },

  // ── Report Card Templates ──
  listTemplates: async () => {
    const response = await api.get(`${BASE}/report-card-templates/`);
    return response.data.results || response.data;
  },

  createTemplate: async (data: {
    name: string;
    primary_color: string;
    secondary_color: string;
    accent_color: string;
    style_config: Record<string, any>;
  }) => {
    const response = await api.post(`${BASE}/report-card-templates/`, data);
    return response.data;
  },

  deleteTemplate: async (id: string) => {
    await api.delete(`${BASE}/report-card-templates/${id}/`);
  },

  // ── Performance Reports ──
  listPerformanceReports: async () => {
    const response = await api.get(`${BASE}/performance/`);
    return response.data;
  },

  generatePerformanceReport: async (data: {
    report_type: string;
    term_id?: string;
    academic_year_id: string;
  }) => {
    const response = await api.post(`${BASE}/performance/generate/`, data);
    return response.data;
  },

  // ── Year in Review ──
  getYearReview: async (academicYearId?: string) => {
    const params: any = {};
    if (academicYearId) params.academic_year_id = academicYearId;
    const response = await api.get(`${BASE}/year-review/`, { params });
    return response.data;
  },

  // ── School Comparison ──
  getComparison: async (academicYearId?: string) => {
    const params: any = {};
    if (academicYearId) params.academic_year_id = academicYearId;
    const response = await api.get(`${BASE}/comparison/`, { params });
    return response.data;
  },
};
