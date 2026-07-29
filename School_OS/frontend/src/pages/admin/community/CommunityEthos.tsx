import { useState, useEffect } from 'react';
import { api } from '../../../services/api';

interface Announcement {
  id: number;
  title: string;
  body: string;
  created_at?: string;
  is_urgent?: boolean;
}

export default function CommunityEthos() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAnnouncements = async () => {
      try {
        const res = await api.get('/notifications/announcements/');
        setAnnouncements(res.data.results || res.data);
      } catch {
        setAnnouncements([]);
      } finally {
        setLoading(false);
      }
    };
    fetchAnnouncements();
  }, []);

  return (
    <div className="p-4 lg:p-12 space-y-24 max-w-[1400px] mx-auto bg-surface min-h-screen">
      {/* Header */}
      <section className="flex flex-col gap-6">
        <div>
          <span className="text-[0.65rem] font-bold uppercase tracking-[0.3em] text-primary/60 mb-3 block">Perspective & Culture</span>
          <h1 className="text-[3.5rem] font-black leading-tight tracking-[-0.04em] text-on-surface">Community Ethos</h1>
        </div>
        <p className="text-body-lg text-on-surface-variant max-w-xl leading-relaxed">
          Nurturing the institutional soul through radical engagement and the curation of core values. Monitor the pulse of student life across all bilingual sections.
        </p>
      </section>

      {/* Announcements */}
      {!loading && announcements.length > 0 && (
        <section className="bg-surface-container-low p-12 rounded-3xl relative overflow-hidden">
          <div className="absolute -right-20 -top-20 w-80 h-80 bg-primary/5 rounded-full blur-[100px]"></div>
          <div className="relative z-10 space-y-8">
            <div className="flex justify-between items-start">
              <h3 className="text-2xl font-bold tracking-[-0.02em] text-primary">Announcements</h3>
              <span className="material-symbols-outlined text-outline">campaign</span>
            </div>
            <div className="space-y-4">
              {announcements.map((ann) => (
                <div key={ann.id} className="p-6 bg-surface-container-lowest rounded-2xl shadow-sm border-l-4 border-primary transition-all hover:translate-x-2">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-black uppercase text-primary tracking-widest">{ann.title}</span>
                    {ann.created_at && (
                      <span className="text-[10px] font-bold text-outline">
                        {new Date(ann.created_at).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                  <p className="text-sm font-medium text-on-surface-variant leading-relaxed">{ann.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Footer */}
      <footer className="py-24 border-t border-outline-variant/10 text-center flex flex-col items-center gap-10">
        <div className="w-16 h-16 rounded-full bg-slate-900 flex items-center justify-center grayscale opacity-30 shadow-2xl shadow-slate-400/20">
          <span className="material-symbols-outlined text-white text-3xl">diversity_3</span>
        </div>
        <p className="text-body-lg italic font-serif text-on-surface-variant max-w-2xl leading-relaxed opacity-60">
          "Community is not merely a collection of individuals, but a curated resonance of purpose and institutional culture. We are the curators of our collective future."
        </p>
        <div className="flex flex-col items-center gap-2">
          <p className="text-[0.6rem] font-black uppercase tracking-[0.5em] text-primary/40">- Digital Curator Charter v1.0</p>
          <div className="flex gap-2 mt-6">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="w-1 h-1 rounded-full bg-primary/20"></div>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}
