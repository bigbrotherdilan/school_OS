import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import BulkCsvUpload from '../../../components/admin/BulkCsvUpload';

export default function BulkImportTeachers() {
  const navigate = useNavigate();

  return (
    <div className="p-4 lg:p-12 max-w-[1200px] mx-auto bg-surface min-h-screen">
      <button
        onClick={() => navigate('/admin/operations')}
        className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-on-surface-variant hover:text-primary transition-colors mb-8"
      >
        <ArrowLeft className="w-4 h-4" /> Administration
      </button>

      <section className="mb-12">
        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-primary/60 block mb-3">Staff Records</span>
        <h1 className="text-4xl font-black tracking-tight text-on-surface">Bulk Import Teachers</h1>
        <p className="text-on-surface-variant mt-2 text-lg max-w-2xl leading-relaxed">
          Upload a CSV file to onboard multiple teachers at once. Each teacher gets a system account, login credentials, and a teacher role.
        </p>
      </section>

      <div className="bg-surface-container-lowest p-10 rounded-3xl border border-outline-variant/10 shadow-sm">
        <BulkCsvUpload
          title="Teachers"
          description="Bulk teacher onboarding"
          requiredColumns={[
            { key: 'first_name', label: 'First Name', required: true, example: 'Dr. Marie' },
            { key: 'last_name', label: 'Last Name', required: true, example: 'Curie' },
            { key: 'email', label: 'Email', required: true, example: 'marie.curie@school.edu' },
          ]}
          optionalColumns={[
            { key: 'employee_id', label: 'Staff ID', required: false, example: 'TCH-001' },
            { key: 'qualification', label: 'Qualification', required: false, example: 'PhD Physics' },
            { key: 'department', label: 'Department', required: false, example: 'Science' },
            { key: 'default_language', label: 'Language (en/fr)', required: false, example: 'en' },
          ]}
          uploadEndpoint="/staff/teachers/bulk-import/"
          onComplete={() => {}}
        />
      </div>
    </div>
  );
}
