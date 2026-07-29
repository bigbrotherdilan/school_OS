import { create } from 'zustand';

export interface TeachingAssignment {
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

interface TeacherState {
  assignments: TeachingAssignment[];
  activeAssignment: TeachingAssignment | null;
  loading: boolean;
  error: string | null;

  setAssignments: (assignments: TeachingAssignment[]) => void;
  setActiveAssignment: (assignment: TeachingAssignment | null) => void;
  setLoading: (loading: boolean) => void;
  fetchAssignments: () => Promise<void>;
}

export const useTeacherStore = create<TeacherState>((set, get) => ({
  assignments: [],
  activeAssignment: null,
  loading: false,
  error: null,

  setAssignments: (assignments) => set({ assignments }),
  setActiveAssignment: (assignment) => set({ activeAssignment: assignment }),
  setLoading: (loading) => set({ loading }),

  fetchAssignments: async () => {
    set({ loading: true, error: null });
    try {
        const { api } = await import('../services/api');
        const response = await api.get('/staff/assignments/my_assignments/');
        const assignments = response.data;
        const currentActive = get().activeAssignment;

        let newActive = currentActive;
        if (!currentActive && assignments.length > 0) {
            newActive = assignments[0];
        } else if (currentActive && !assignments.find((a: TeachingAssignment) => a.id === currentActive.id)) {
            newActive = assignments.length > 0 ? assignments[0] : null;
        }

        set({
            assignments,
            activeAssignment: newActive,
            loading: false
        });
    } catch (error: any) {
        set({
            error: error.response?.data?.detail || error.message || 'Failed to fetch assignments',
            loading: false
        });
    }
  }
}));
