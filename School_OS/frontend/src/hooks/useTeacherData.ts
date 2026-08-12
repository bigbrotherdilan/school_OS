import { useState, useCallback } from 'react';
import { api } from '../services/api';

interface Assignment {
  id: string;
  teacher: string;
  teacher_name: string;
  subject: string;
  subject_name: string;
  academic_class: string;
  class_name: string;
  series: string | null;
  series_code: string | null;
  academic_year: string;
  academic_year_name: string;
}

interface Sequence {
  id: number;
  name: string;
  order_number: number;
  term: number;
  term_name: string;
  academic_year_id: number;
}

interface Term {
  id: string;
  academic_year: string;
  name: string;
  order_number: number;
  start_date: string | null;
  end_date: string | null;
  sequences: Sequence[];
}

interface MarkWindowStatus {
  is_open: boolean;
  start_date: string | null;
  end_date: string | null;
  message: string;
}

export function useTeacherData() {
  const [loading, setLoading] = useState(false);

  const fetchMyAssignments = useCallback(async (): Promise<Assignment[]> => {
    setLoading(true);
    try {
      const response = await api.get('/staff/assignments/my_assignments/');
      return response.data.results || response.data;
    } catch (error) {
      console.error("Error fetching assignments:", error);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchStudents = useCallback(async (currentClassId?: string) => {
    setLoading(true);
    try {
      const url = currentClassId
        ? `/students/students/?current_class=${currentClassId}`
        : '/students/students/';
      const response = await api.get(url);
      return response.data.results || response.data;
    } catch (error) {
      console.error("Error fetching students:", error);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchTimetables = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get('/timetable/time-slots/');
      return response.data.results || response.data;
    } catch (error) {
      console.error("Error fetching timetables:", error);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const saveLessonPlan = useCallback(async (planData: any) => {
    setLoading(true);
    try {
      const response = await api.post('/logbook/schemes/', planData);
      return response.data;
    } catch (error) {
      console.error("Error saving lesson plan:", error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  const submitLogbookEntry = useCallback(async (entryData: any) => {
    setLoading(true);
    try {
      const response = await api.post('/logbook/entries/', entryData);
      return response.data;
    } catch (error) {
      console.error("Error submitting logbook entry:", error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchSchemes = useCallback(async (filters?: { subject?: string; class_obj?: string; term?: string; academic_year?: string; status?: string; week_number?: string | number }) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters?.subject) params.append('subject', filters.subject);
      if (filters?.class_obj) params.append('class_obj', filters.class_obj);
      if (filters?.term) params.append('term', filters.term);
      if (filters?.academic_year) params.append('academic_year', filters.academic_year);
      if (filters?.status) params.append('status', filters.status);
      if (filters?.week_number !== undefined) params.append('week_number', String(filters.week_number));
      const url = `/logbook/schemes/?${params.toString()}`;
      const response = await api.get(url);
      return response.data.results || response.data;
    } catch (error) {
      console.error("Error fetching schemes:", error);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const saveScheme = useCallback(async (data: any) => {
    setLoading(true);
    try {
      const response = await api.post('/logbook/schemes/', data);
      return response.data;
    } catch (error) {
      console.error("Error saving scheme:", error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  const updateScheme = useCallback(async (id: string, data: any) => {
    setLoading(true);
    try {
      const response = await api.patch(`/logbook/schemes/${id}/`, data);
      return response.data;
    } catch (error) {
      console.error("Error updating scheme:", error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  const deleteScheme = useCallback(async (id: string) => {
    setLoading(true);
    try {
      await api.delete(`/logbook/schemes/${id}/`);
    } catch (error) {
      console.error("Error deleting scheme:", error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  const markTaught = useCallback(async (id: string) => {
    try {
      const response = await api.post(`/logbook/schemes/${id}/mark_taught/`);
      return response.data;
    } catch (error) {
      console.error("Error marking scheme taught:", error);
      throw error;
    }
  }, []);

  const markPlanned = useCallback(async (id: string) => {
    try {
      const response = await api.post(`/logbook/schemes/${id}/mark_planned/`);
      return response.data;
    } catch (error) {
      console.error("Error marking scheme planned:", error);
      throw error;
    }
  }, []);

  const generateSchemes = useCallback(async (payload: any) => {
    setLoading(true);
    try {
      const response = await api.post('/logbook/schemes/generate/', payload);
      return response.data;
    } catch (error) {
      console.error("Error generating schemes:", error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  const importSchemes = useCallback(async (payload: any) => {
    setLoading(true);
    try {
      const response = await api.post('/logbook/schemes/import/', payload);
      return response.data;
    } catch (error) {
      console.error("Error importing schemes:", error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchCoverage = useCallback(async (filters?: { term?: string; academic_year?: string }) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters?.term) params.append('term', filters.term);
      if (filters?.academic_year) params.append('academic_year', filters.academic_year);
      const url = `/logbook/schemes/coverage/?${params.toString()}`;
      const response = await api.get(url);
      return response.data.results || response.data;
    } catch (error) {
      console.error("Error fetching coverage:", error);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchTerms = useCallback(async (): Promise<Term[]> => {
    setLoading(true);
    try {
      const response = await api.get('/academic/terms/');
      return response.data.results || response.data;
    } catch (error) {
      console.error("Error fetching terms:", error);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const checkMarkWindowStatus = useCallback(async (sequenceId: string | number): Promise<MarkWindowStatus> => {
    try {
      const response = await api.get(`/assessments/mark-windows/check-status/?sequence=${sequenceId}`);
      return response.data;
    } catch (error) {
      console.error("Error checking mark window:", error);
      return { is_open: false, start_date: null, end_date: null, message: 'Failed to check status.' };
    }
  }, []);

  const fetchExams = useCallback(async (sequenceId?: string | number) => {
    setLoading(true);
    try {
      const url = sequenceId
        ? `/assessments/exams/?sequence=${sequenceId}`
        : '/assessments/exams/';
      const response = await api.get(url);
      return response.data.results || response.data;
    } catch (error) {
      console.error("Error fetching exams:", error);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchExamResults = useCallback(async (filters?: { exam?: string; subject?: string; classId?: string; sequence?: string }) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters?.exam) params.append('exam', filters.exam);
      if (filters?.subject) params.append('subject', filters.subject);
      if (filters?.classId) params.append('class', filters.classId);
      if (filters?.sequence) params.append('sequence', filters.sequence);

      const url = `/assessments/results/?${params.toString()}`;
      const response = await api.get(url);
      return response.data.results || response.data;
    } catch (error) {
      console.error("Error fetching results:", error);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const patchExamResult = useCallback(async (resultId: string, score: number) => {
    try {
      const response = await api.patch(`/assessments/results/${resultId}/`, { score });
      return response.data;
    } catch (error) {
      console.error("Error updating exam result:", error);
      throw error;
    }
  }, []);

  const bulkUpdateMarks = useCallback(async (results: Array<{ exam?: string; student: string; subject: string; sequence?: string; score: number | null; comments?: string }>) => {
    try {
      const response = await api.post('/assessments/results/bulk-update/', { results });
      return response.data;
    } catch (error) {
      console.error("Error bulk updating marks:", error);
      throw error;
    }
  }, []);

  const createExam = useCallback(async (examData: { name: string; term: number | string; academic_year: number | string; weight?: number | string; exam_type?: string }) => {
    setLoading(true);
    try {
      const response = await api.post('/assessments/exams/', {
        ...examData,
        weight: examData.weight || 100,
        exam_type: examData.exam_type || 'termly',
        is_published: true,
      });
      return response.data;
    } catch (error) {
      console.error("Error creating exam:", error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  const ensureExamForTerm = useCallback(async (termId: number | string, academicYearId: number | string) => {
    setLoading(true);
    try {
      const response = await api.post('/assessments/exams/ensure-for-term/', {
        term_id: termId,
        academic_year_id: academicYearId,
      });
      return response.data;
    } catch (error) {
      console.error("Error ensuring exam for term:", error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    loading,
    fetchMyAssignments,
    fetchStudents,
    fetchTimetables,
    saveLessonPlan,
    submitLogbookEntry,
    fetchSchemes,
    saveScheme,
    updateScheme,
    deleteScheme,
    markTaught,
    markPlanned,
    generateSchemes,
    importSchemes,
    fetchCoverage,
    fetchTerms,
    checkMarkWindowStatus,
    fetchExams,
    fetchExamResults,
    patchExamResult,
    bulkUpdateMarks,
    createExam,
    ensureExamForTerm,
  };
}
