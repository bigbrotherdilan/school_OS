import { useState, useRef, useCallback } from 'react';
import { Upload, FileSpreadsheet, CheckCircle, XCircle, AlertTriangle, X } from 'lucide-react';

interface ColumnDef {
  key: string;
  label: string;
  required: boolean;
  example: string;
}

interface BulkCsvUploadProps {
  title: string;
  description: string;
  requiredColumns: ColumnDef[];
  optionalColumns?: ColumnDef[];
  uploadEndpoint: string;
  onComplete: (result: { created: any[]; errors: any[]; message: string }) => void;
}

export default function BulkCsvUpload({
  title,
  requiredColumns,
  optionalColumns = [],
  uploadEndpoint,
  onComplete,
}: BulkCsvUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string[][]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isDryRun, setIsDryRun] = useState(false);
  const [result, setResult] = useState<{ created: any[]; errors: any[]; message: string; dry_run?: boolean } | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleFile = useCallback((f: File) => {
    if (!f.name.endsWith('.csv')) {
      alert('Please upload a CSV file.');
      return;
    }
    setFile(f);
    setResult(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const lines = text.split('\n').filter(l => l.trim()).slice(0, 6);
      const parsed = lines.map(l => {
        const cells: string[] = [];
        let current = '';
        let inQuotes = false;
        for (const char of l) {
          if (char === '"') { inQuotes = !inQuotes; continue; }
          if (char === ',' && !inQuotes) { cells.push(current.trim()); current = ''; continue; }
          current += char;
        }
        cells.push(current.trim());
        return cells;
      });
      setPreview(parsed);
    };
    reader.readAsText(f);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }, [handleFile]);

  const handleUpload = async (dryRun = false) => {
    if (!file) return;
    setIsUploading(true);
    setIsDryRun(dryRun);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const url = dryRun ? `${uploadEndpoint}?dry_run=true` : uploadEndpoint;
      const { api } = await import('../../services/api');
      const response = await api.post(url, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const data = response.data;
      const res = { created: data.created || [], errors: data.errors || [], message: data.message || '', dry_run: data.dry_run };
      setResult(res);
      if (!dryRun) onComplete(res);
    } catch (err: any) {
      const detail = err.response?.data?.detail || 'Upload failed. Please try again.';
      setResult({ created: [], errors: [{ row: 0, error: detail }], message: detail });
    } finally {
      setIsUploading(false);
    }
  };

  const reset = () => {
    setFile(null);
    setPreview([]);
    setResult(null);
  };

  const generateTemplate = () => {
    const headers = [...requiredColumns.map(c => c.key), ...optionalColumns.map(c => c.key)];
    const exampleRow = [...requiredColumns.map(c => c.example), ...optionalColumns.map(c => c.example)];
    const csv = [headers.join(','), exampleRow.join(',')].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title.toLowerCase().replace(/\s+/g, '_')}_template.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-8">
      {/* Template info */}
      <div className="bg-primary/5 border border-primary/10 rounded-2xl p-6 flex items-start gap-4">
        <FileSpreadsheet className="w-6 h-6 text-primary shrink-0 mt-1" />
        <div className="flex-1">
          <h4 className="text-sm font-bold text-on-surface mb-1">CSV Format Requirements</h4>
          <p className="text-xs text-on-surface-variant mb-3">Required columns: {requiredColumns.map(c => <code key={c.key} className="bg-surface-container-highest px-2 py-0.5 rounded mx-0.5 font-mono text-[10px]">{c.key}</code>)}</p>
          {optionalColumns.length > 0 && (
            <p className="text-xs text-on-surface-variant mb-3">Optional: {optionalColumns.map(c => <code key={c.key} className="bg-surface-container-highest px-2 py-0.5 rounded mx-0.5 font-mono text-[10px]">{c.key}</code>)}</p>
          )}
          <button onClick={generateTemplate} className="text-[10px] font-black uppercase tracking-widest text-primary hover:underline">
            Download Template CSV
          </button>
        </div>
      </div>

      {/* Upload area */}
      {!file && !result && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-3xl p-16 text-center cursor-pointer transition-all ${
            dragOver ? 'border-primary bg-primary/5 scale-[1.01]' : 'border-outline-variant/30 hover:border-primary/40 hover:bg-surface-container-low/50'
          }`}
        >
          <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
          <Upload className="w-12 h-12 mx-auto mb-4 text-on-surface-variant/30" />
          <p className="text-lg font-bold text-on-surface mb-2">Drop your CSV file here</p>
          <p className="text-sm text-on-surface-variant">or click to browse</p>
        </div>
      )}

      {/* Preview table */}
      {file && preview.length > 0 && !result && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FileSpreadsheet className="w-5 h-5 text-primary" />
              <span className="text-sm font-bold">{file.name}</span>
              <span className="text-xs text-on-surface-variant">({(file.size / 1024).toFixed(1)} KB)</span>
            </div>
            <button onClick={reset} className="p-2 hover:bg-surface-container-high rounded-xl transition-colors">
              <X className="w-4 h-4 text-on-surface-variant" />
            </button>
          </div>

          <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/10 shadow-sm overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-surface-container text-outline text-[10px] font-bold uppercase tracking-wider">
                  {preview[0]?.map((h, i) => (
                    <th key={i} className="p-4 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/10">
                {preview.slice(1).map((row, ri) => (
                  <tr key={ri} className="hover:bg-surface-container-low/50">
                    {row.map((cell, ci) => (
                      <td key={ci} className="p-4 whitespace-nowrap font-medium">{cell}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {preview.length >= 6 && (
              <div className="p-3 text-center text-[10px] text-on-surface-variant font-bold uppercase tracking-widest border-t border-outline-variant/10">
                Previewing first 5 rows...
              </div>
            )}
          </div>

          <div className="flex justify-end gap-4">
            <button onClick={reset} className="px-6 py-3 bg-surface-container-high text-on-surface rounded-xl font-black text-xs uppercase tracking-widest hover:bg-surface-container-highest transition-all">
              Choose Different File
            </button>
            <button onClick={() => handleUpload(true)} disabled={isUploading} className="flex items-center gap-2 px-6 py-3 bg-surface-container border border-outline-variant/20 text-on-surface rounded-xl font-black text-xs uppercase tracking-widest hover:bg-surface-container-high transition-all disabled:opacity-50">
              {isUploading && isDryRun ? (
                <span className="material-symbols-outlined animate-spin text-sm">sync</span>
              ) : (
                <AlertTriangle className="w-4 h-4" />
              )}
              {isUploading && isDryRun ? 'Checking...' : 'Preview'}
            </button>
            <button onClick={() => handleUpload(false)} disabled={isUploading} className="flex items-center gap-2 px-8 py-3 bg-primary text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-lg shadow-primary/20 hover:shadow-xl active:scale-95 transition-all disabled:opacity-50">
              {isUploading && !isDryRun ? (
                <span className="material-symbols-outlined animate-spin text-sm">sync</span>
              ) : (
                <Upload className="w-4 h-4" />
              )}
              {isUploading && !isDryRun ? 'Importing...' : `Import ${title}`}
            </button>
          </div>
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="space-y-6 animate-in fade-in duration-500">
          <div className={`p-6 rounded-2xl border ${result.errors.length === 0 ? 'bg-secondary/5 border-secondary/10' : 'bg-error/5 border-error/10'}`}>
            <div className="flex items-center gap-3 mb-2">
              {result.errors.length === 0 ? <CheckCircle className="w-6 h-6 text-secondary" /> : <AlertTriangle className="w-6 h-6 text-error" />}
              <h4 className="text-sm font-bold">{result.message}</h4>
            </div>
          </div>

          {result.created.length > 0 && (
            <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/10 shadow-sm overflow-hidden">
              <div className="p-4 bg-secondary/5 border-b border-outline-variant/10">
                <h5 className="text-xs font-black uppercase tracking-widest text-secondary flex items-center gap-2">
                  <CheckCircle className="w-3 h-3" /> {result.created.length} Created Successfully
                </h5>
              </div>
              <div className="max-h-64 overflow-y-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-surface-container text-outline text-[10px] font-bold uppercase tracking-wider">
                      <th className="p-4">Name</th>
                      <th className="p-4">ID</th>
                      <th className="p-4">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/10">
                    {result.created.map((item: any, i: number) => (
                      <tr key={i} className="hover:bg-surface-container-low/50">
                        <td className="p-4 font-bold">{item.name || item.admission_number}</td>
                        <td className="p-4 font-mono text-[10px]">{item.employee_id || item.admission_number}</td>
                        <td className="p-4 text-success text-[10px] font-bold">Credentials sent</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {result.errors.length > 0 && (
            <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/10 shadow-sm overflow-hidden">
              <div className="p-4 bg-error/5 border-b border-outline-variant/10">
                <h5 className="text-xs font-black uppercase tracking-widest text-error flex items-center gap-2">
                  <XCircle className="w-3 h-3" /> {result.errors.length} Errors
                </h5>
              </div>
              <div className="max-h-64 overflow-y-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-surface-container text-outline text-[10px] font-bold uppercase tracking-wider">
                      <th className="p-4">Row</th>
                      <th className="p-4">Email / Name</th>
                      <th className="p-4">Error</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/10">
                    {result.errors.map((err: any, i: number) => (
                      <tr key={i} className="hover:bg-error/5">
                        <td className="p-4 font-mono">{err.row || '—'}</td>
                        <td className="p-4 font-bold">{err.email || err.name || '—'}</td>
                        <td className="p-4 text-error">{err.error}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-4">
            {result.dry_run ? (
              <>
                <button onClick={reset} className="px-6 py-3 bg-surface-container-high text-on-surface rounded-xl font-black text-xs uppercase tracking-widest hover:bg-surface-container-highest transition-all">
                  Cancel
                </button>
                <button onClick={() => handleUpload(false)} disabled={isUploading} className="flex items-center gap-2 px-8 py-3 bg-primary text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-lg shadow-primary/20 hover:shadow-xl active:scale-95 transition-all disabled:opacity-50">
                  {isUploading ? (
                    <span className="material-symbols-outlined animate-spin text-sm">sync</span>
                  ) : (
                    <CheckCircle className="w-4 h-4" />
                  )}
                  {isUploading ? 'Importing...' : 'Confirm Import'}
                </button>
              </>
            ) : (
              <button onClick={reset} className="px-8 py-3 bg-primary text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-lg shadow-primary/20 hover:shadow-xl active:scale-95 transition-all">
                Import Another File
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
