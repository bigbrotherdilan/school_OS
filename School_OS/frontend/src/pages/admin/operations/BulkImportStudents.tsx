import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import BulkCsvUpload from '../../../components/admin/BulkCsvUpload';

export default function BulkImportStudents() {
  const navigate = useNavigate();

  return (
    <div className="p-4 lg:p-12 max-w-[1200px] mx-auto bg-surface min-h-screen">
      <button
        onClick={() => navigate('/admin/academic')}
        className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-on-surface-variant hover:text-primary transition-colors mb-8"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Registry
      </button>

      <section className="mb-12">
        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-primary/60 block mb-3">Academic Management</span>
        <h1 className="text-4xl font-black tracking-tight text-on-surface">Bulk Import Students</h1>
        <p className="text-on-surface-variant mt-2 text-lg max-w-2xl leading-relaxed">
          Upload a CSV file to register multiple students at once. Each row creates a student record with auto-generated admission numbers.
        </p>
      </section>

      <div className="bg-surface-container-lowest p-10 rounded-3xl border border-outline-variant/10 shadow-sm">
        <BulkCsvUpload
          title="Students"
          description="Bulk student registration"
          requiredColumns={[
            { key: 'first_name', label: 'First Name', required: true, example: 'Marc' },
            { key: 'middle_name', label: 'Middle Name', required: false, example: 'Antonius' },
            { key: 'last_name', label: 'Last Name', required: true, example: 'Aurelius' },
            { key: 'gender', label: 'Gender (M/F)', required: true, example: 'M' },
            { key: 'date_of_birth', label: 'Date of Birth (YYYY-MM-DD)', required: true, example: '2010-03-15' },
          ]}
          optionalColumns={[
            { key: 'current_class', label: 'Class Name', required: false, example: 'Form 1' },
            { key: 'blood_group', label: 'Blood Group', required: false, example: 'O+' },
            { key: 'emergency_contact', label: 'Emergency Contact', required: false, example: '+237600112233' },
          ]}
          uploadEndpoint="/students/students/bulk-import/"
          onComplete={() => {}}
        />
      </div>
    </div>
  );
}
