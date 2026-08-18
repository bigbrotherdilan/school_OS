import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';
const BASE_URL = import.meta.env.VITE_PUBLIC_API_URL || API_URL.replace(/\/api\/v1$/, '');

export const publicApi = axios.create({
  baseURL: `${BASE_URL}/pub/v1`,
  headers: { 'Content-Type': 'application/json' },
});

export interface PublicSchool {
  school_name: string;
  slug: string;
  region: string;
  division: string;
  address: string;
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
  cycle_name: string | null;
}

export interface PublicSchoolProfile {
  id: string;
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

export interface PublicTeacher {
  id: string;
  name: string;
  first_name: string;
  last_name: string;
  qualification: string;
  department: string;
  specializations: string[];
  subjects_taught: string[];
  languages_spoken: string[];
  availability: string;
  hourly_rate: string | null;
  average_rating: number;
  total_reviews: number;
  years_of_experience: number | null;
  certifications: string[];
  achievements: string[];
  teaching_philosophy: string;
  profile_photo: string;
  school: {
    id: string;
    name: string;
    slug: string;
    region: string;
    division: string;
    education_type: string;
  } | null;
}

export const fetchPublicTeachers = (params?: {
  q?: string;
  subject?: string;
  region?: string;
  availability?: string;
  min_rating?: string;
}): Promise<PublicTeacher[]> => {
  const query: Record<string, string> = {};
  if (params?.q) query.q = params.q;
  if (params?.subject) query.subject = params.subject;
  if (params?.region) query.region = params.region;
  if (params?.availability) query.availability = params.availability;
  if (params?.min_rating) query.min_rating = params.min_rating;
  return publicApi.get('/teachers/', { params: query }).then((r) => r.data.data);
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
  child_middle_name?: string;
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
