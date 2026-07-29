import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const publicApi = axios.create({
  baseURL: `${BASE_URL}/pub/v1`,
  headers: { 'Content-Type': 'application/json' },
});

export interface PublicSchool {
  school_name: string;
  slug: string;
  region: string;
  division: string;
  education_type: string;
  education_type_display: string;
  school_type: string;
  motto: string;
  logo_url: string;
  student_count: number | null;
  class_count: number | null;
}

export interface PublicFeeStructure {
  category_name: string;
  class_name: string | null;
  amount: number;
}

export interface PublicClass {
  name: string;
  level_order: number;
}

export interface PublicSchoolProfile {
  school_name: string;
  slug: string;
  region: string;
  division: string;
  country: string;
  education_type: string;
  education_type_display: string;
  school_type: string;
  school_type_display: string;
  session_type: string;
  address: string;
  motto: string;
  logo_url: string;
  classes: PublicClass[];
  fee_structures: PublicFeeStructure[];
  active_academic_year: { name: string } | null;
  student_count: number | null;
  teacher_count: number | null;
}

export interface RegionCount {
  name: string;
  count: number;
}

export const fetchSchools = (params?: {
  q?: string;
  region?: string;
  education_type?: string;
  school_type?: string;
}): Promise<PublicSchool[]> => {
  const query: Record<string, string> = {};
  if (params?.q) query.q = params.q;
  if (params?.region) query.region = params.region;
  if (params?.education_type) query.education_type = params.education_type;
  if (params?.school_type) query.school_type = params.school_type;
  return publicApi.get('/schools/', { params: query }).then((r) => r.data.data);
};

export const fetchSchoolProfile = (slug: string): Promise<PublicSchoolProfile> => {
  return publicApi.get(`/schools/${slug}/`).then((r) => r.data.data);
};

export const fetchRegions = (): Promise<RegionCount[]> => {
  return publicApi.get('/regions/').then((r) => r.data.data);
};

export const submitEnrollmentInquiry = (data: {
  school_id: string;
  child_first_name: string;
  child_last_name: string;
  date_of_birth?: string;
  gender?: string;
  grade?: string;
  parent_name: string;
  relationship?: string;
  parent_phone: string;
  email?: string;
  notes?: string;
}): Promise<{ message: string }> => {
  return publicApi.post('/enrollment/', data).then((r) => r.data.data);
};
