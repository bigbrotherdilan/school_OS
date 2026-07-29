export interface AcademicYear {
  id: string;
  tenant: string;
  name: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
  terms?: Term[];
}

export interface Term {
  id: string;
  academic_year: string;
  name: string;
  order_number: number;
  start_date: string | null;
  end_date: string | null;
}

export interface Cycle {
  id: string;
  tenant: string;
  name: string;
  order: number;
}

export interface Stream {
  id: string;
  tenant: string;
  name: string;
  language: string;
}

export interface Series {
  id: string;
  tenant: string;
  cycle: string;
  cycle_name: string;
  stream: string;
  code: string;
  name: string;
}

export interface AcademicClass {
  id: string;
  tenant: string;
  cycle: string | null;
  cycle_name: string | null;
  stream: string | null;
  stream_display: string | null;
  name: string;
  level_order: number;
}

export interface Subject {
  id: string;
  tenant: string;
  cycle: string | null;
  cycle_name: string | null;
  name: string;
  code: string;
  default_coefficient: number;
  is_compulsory: boolean;
}

export interface ClassSubject {
  id: string;
  academic_class: string;
  subject: string;
  subject_name: string;
  series: string | null;
  series_code: string | null;
  coefficient: number;
}

export interface Student {
  id: string;
  tenant: string;
  first_name: string;
  last_name: string;
  date_of_birth: string;
  gender: string;
  admission_number: string;
  current_class: AcademicClass | string | null;
  stream: string | null;
  series: string | null;
  series_code?: string;
  status: string;
}

export interface Exam {
  id: string;
  tenant: string;
  name: string;
  term: string;
  term_name?: string;
  exam_type?: string;
  weight: number;
  is_published: boolean;
}

export interface ExamResult {
  id: string;
  exam: string;
  student: string;
  subject: string;
  score: number | null;
  letter_grade?: string;
  points?: number;
  comments?: string;
}

export interface GradeScale {
  id: string;
  tenant: string;
  name: string;
  max_score: number;
}

export interface GradeBoundary {
  id: string;
  grade_scale: string;
  grade: string;
  min_score: number;
  max_score: number;
  points: number;
}
