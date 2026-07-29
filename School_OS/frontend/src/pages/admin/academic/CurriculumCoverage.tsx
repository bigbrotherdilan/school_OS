import { useState, useEffect } from 'react';
import { api } from '../../../services/api';

export default function CurriculumCoverage() {
  const [schemes, setSchemes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSchemes = async () => {
      try {
        const res = await api.get('/logbook/schemes/');
        setSchemes(res.data.results || res.data);
      } catch (err) {
        console.error('Failed to fetch schemes', err);
      } finally {
        setLoading(false);
      }
    };
    fetchSchemes();
  }, []);

  const pct = (s: any) => s.progress || s.completion_percentage || 0;

  return (
    <div className="p-4 lg:p-12 space-y-8 animate-in fade-in duration-500 max-w-[1600px] mx-auto">
      <div className="flex justify-between items-end">
        <div>
          <span className="text-secondary font-bold tracking-widest text-xs uppercase mb-2 block">Instructional Delivery</span>
          <h2 className="text-4xl font-semibold tracking-tight text-on-surface">Scheme of Work</h2>
          <p className="text-on-surface-variant text-lg mt-2">Monitor scheme of work progression and validate teacher logbook entries.</p>
        </div>
        <div className="flex gap-4">
           <button className="bg-surface-container-high text-on-surface px-6 py-3 rounded-xl font-medium flex items-center gap-2 transition-all hover:bg-surface-container-highest active:scale-95">
            <span className="material-symbols-outlined text-lg">fact_check</span>
            Validate Logbooks
          </button>
          <button className="bg-primary text-white px-6 py-3 rounded-xl font-medium flex items-center gap-2 shadow-lg shadow-primary/20 hover:opacity-90 active:scale-95 transition-all">
            <span className="material-symbols-outlined text-lg">upload_file</span>
            Upload Scheme
          </button>
        </div>
      </div>

      <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/15 shadow-sm overflow-hidden flex flex-col">
          <div className="p-6 border-b border-outline-variant/15 flex justify-between items-center bg-surface-container-low/30">
            <h3 className="text-xl font-bold text-on-surface">Schemes of Work</h3>
            <div className="flex bg-surface-container-high rounded-lg p-1">
              <button className="px-4 py-1.5 text-sm font-bold bg-white text-primary rounded shadow-sm">Active</button>
              <button className="px-4 py-1.5 text-sm font-bold text-on-surface-variant hover:text-on-surface">Archived</button>
            </div>
          </div>

          {loading ? (
             <div className="flex-1 flex items-center justify-center p-12 text-on-surface-variant">
              <span className="material-symbols-outlined animate-spin text-3xl text-primary mr-3">sync</span>
              Loading schemes...
            </div>
          ) : schemes.length === 0 ? (
            <div className="flex-1 p-16 flex flex-col items-center justify-center text-center">
              <div className="w-16 h-16 bg-surface-container rounded-full flex items-center justify-center mb-4">
                <span className="material-symbols-outlined text-3xl text-outline">menu_book</span>
              </div>
              <h4 className="text-lg font-bold text-on-surface mb-2">No Schemes Uploaded</h4>
              <p className="text-sm text-on-surface-variant mb-6 max-w-sm">There are no academic schemes of work configured for the current term. Upload master documents to begin tracking.</p>
              <button className="text-primary font-semibold hover:underline border border-primary/20 px-6 py-2 rounded-lg">Browse Templates</button>
            </div>
          ) : (
            <div className="p-0">
               <table className="w-full text-left">
                  <thead>
                    <tr className="bg-surface-container text-outline text-[11px] font-bold uppercase tracking-wider">
                      <th className="p-4 pl-6">Subject / Class</th>
                      <th className="p-4">Week Span</th>
                      <th className="p-4">Progress</th>
                      <th className="p-4 text-right pr-6">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/10">
                    {schemes.map((s, i) => (
                      <tr key={i} className="hover:bg-surface-container-low/50 transition-colors">
                        <td className="p-4 pl-6">
                           <div className="font-semibold text-on-surface">{s.subject_name || 'Subject'}</div>
                           <div className="text-xs text-on-surface-variant">{s.class_name || 'Class'}</div>
                        </td>
                        <td className="p-4 text-sm text-on-surface-variant">Week {s.week_number}</td>
                        <td className="p-4">
                           <div className="flex items-center gap-3">
                             <div className="w-24 h-1.5 bg-surface-container-high rounded-full overflow-hidden">
                               <div className="h-full bg-primary rounded-full" style={{ width: pct(s) + '%' }}></div>
                             </div>
                             <span className="text-xs font-bold text-primary">{pct(s)}%</span>
                           </div>
                        </td>
                        <td className="p-4 pr-6 text-right">
                           <span className="text-[10px] font-bold text-secondary uppercase bg-secondary/10 px-2 py-1 rounded">On Track</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
               </table>
            </div>
          )}
        </div>
    </div>
  );
}
