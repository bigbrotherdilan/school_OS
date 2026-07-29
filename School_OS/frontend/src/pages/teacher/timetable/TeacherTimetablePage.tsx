import { useState, useEffect } from 'react';
import { useTeacherData } from '../../../hooks/useTeacherData';

interface Session {
  id: string;
  subject: string;
  className: string; // Changed from 'class' to 'className' to avoid reserved word issues
  room: string;
  type: 'lecture' | 'lab' | 'tutorial';
  isActive?: boolean;
}

interface TimeSlotRow {
  time: string;
  monday?: Session;
  tuesday?: Session;
  wednesday?: Session;
  thursday?: Session;
  friday?: Session;
}

interface BackendTimeSlot {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  subject_details?: { name: string };
  class_details?: { name: string };
  classroom?: string;
}

export default function TeacherTimetablePage() {
  const { fetchTimetables } = useTeacherData();
  const [schedule, setSchedule] = useState<TimeSlotRow[]>([]);
  const [currentWeek, setCurrentWeek] = useState(14);
  const [loading, setLoading] = useState(true);
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const today: string = dayNames[new Date().getDay()];

  useEffect(() => {
    const loadTimetable = async () => {
      setLoading(true);
      const data = await fetchTimetables();
      if (data && data.length > 0) {
        // Group raw backend TimeSlots into the row-based TimeSlotRow[] structure
        const rows: TimeSlotRow[] = [];
        // Map backend day integers to keys
        const dayMap: Record<number, keyof TimeSlotRow> = {
          1: 'monday', 2: 'tuesday', 3: 'wednesday', 4: 'thursday', 5: 'friday'
        };

        (data as BackendTimeSlot[]).forEach((slot) => {
          const timeRange = `${slot.start_time.substring(0, 5)} - ${slot.end_time.substring(0, 5)}`;
          let row = rows.find(r => r.time === timeRange);
          if (!row) {
            row = { time: timeRange };
            rows.push(row);
          }
          const dayKey = dayMap[slot.day_of_week];
          if (dayKey && dayKey !== 'time') {
            row[dayKey] = {
              id: slot.id,
              subject: slot.subject_details?.name || 'Unknown',
              className: slot.class_details?.name || 'N/A',
              room: slot.classroom || 'N/A',
              type: 'lecture', // Default for now
              isActive: false
            };
          }
        });
        
        if (rows.length > 0) {
          setSchedule(rows.sort((a, b) => a.time.localeCompare(b.time)));
        }
      }
      setLoading(false);
    };
    loadTimetable();
  }, [fetchTimetables]);

  return (
    <div className="space-y-6 sm:space-y-8 pb-12 animate-in fade-in duration-500">
      <section className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">My Timetable</h2>
          <p className="text-on-surface-variant text-sm mt-1">Week {currentWeek}</p>
        </div>
        
        <div className="flex items-center gap-2">
          <button onClick={() => setCurrentWeek(w => Math.max(1, w - 1))} className="p-2.5 bg-white rounded-full border border-slate-200 text-slate-500 hover:text-primary transition-colors hover:shadow-sm min-h-[44px] min-w-[44px] flex items-center justify-center">
            <span className="material-symbols-outlined text-xl">chevron_left</span>
          </button>
          <span className="text-sm font-bold text-slate-700 w-24 text-center">Week {currentWeek}</span>
          <button onClick={() => setCurrentWeek(w => w + 1)} className="p-2.5 bg-white rounded-full border border-slate-200 text-slate-500 hover:text-primary transition-colors hover:shadow-sm min-h-[44px] min-w-[44px] flex items-center justify-center">
            <span className="material-symbols-outlined text-xl">chevron_right</span>
          </button>
        </div>
      </section>

      {loading ? (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-12 text-center animate-pulse">
          <span className="material-symbols-outlined text-4xl text-slate-300 mb-3 block">schedule</span>
          <p className="text-slate-400 font-medium">Loading timetable...</p>
        </div>
      ) : schedule.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-12 text-center">
          <span className="material-symbols-outlined text-5xl text-slate-200 mb-3 block">calendar_today</span>
          <h3 className="text-lg font-bold text-slate-700 mb-2">No Timetable Yet</h3>
          <p className="text-sm text-slate-400 max-w-sm mx-auto">Your timetable hasn't been set up yet. Contact your school administrator to create your class schedule.</p>
        </div>
      ) : (
        <>
          {/* Desktop Grid */}
          <div className="hidden md:block bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="min-w-[800px] overflow-x-auto">
              <div className="grid grid-cols-6 border-b border-slate-100 bg-slate-50/50">
                <div className="p-4 text-xs font-bold uppercase tracking-wider text-slate-400 text-center">Time</div>
                {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].map((day) => (
                  <div key={day} className={`p-4 text-xs font-bold uppercase tracking-wider text-center border-l border-slate-100 ${day === today ? 'text-primary bg-primary/5' : 'text-slate-500'}`}>
                    {day}
                    {day === today && <span className="block w-1.5 h-1.5 bg-primary rounded-full mx-auto mt-1"></span>}
                  </div>
                ))}
              </div>

              <div className="divide-y divide-slate-100">
                {schedule.map((slot, idx) => (
                  <div key={idx} className="grid grid-cols-6 min-h-[120px]">
                    <div className="p-4 text-xs font-semibold text-slate-400 text-center flex items-center justify-center flex-col gap-1">
                      <span className="material-symbols-outlined text-slate-300 text-lg">schedule</span>
                      {slot.time}
                    </div>
                    
                    {slot.time.includes('Break') ? (
                      <div className="col-span-5 border-l border-slate-100 flex items-center justify-center bg-slate-50/50 text-slate-400 text-sm font-bold tracking-widest uppercase">
                        <span className="material-symbols-outlined mr-2">restaurant</span> Student Break
                      </div>
                    ) : (
                      <>
                        <TimeSlotCell session={slot.monday} isToday={'Monday' === today} />
                        <TimeSlotCell session={slot.tuesday} isToday={'Tuesday' === today} />
                        <TimeSlotCell session={slot.wednesday} isToday={'Wednesday' === today} />
                        <TimeSlotCell session={slot.thursday} isToday={'Thursday' === today} />
                        <TimeSlotCell session={slot.friday} isToday={'Friday' === today} />
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden space-y-4">
            {schedule.map((slot, idx) => (
              <div key={idx} className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                <div className="px-4 py-3 bg-slate-50/50 border-b border-slate-100 flex items-center gap-2">
                  <span className="material-symbols-outlined text-slate-400 text-lg">schedule</span>
                  <span className="text-sm font-bold text-slate-700">{slot.time}</span>
                </div>
                <div className="divide-y divide-slate-50">
                  {(['monday', 'tuesday', 'wednesday', 'thursday', 'friday'] as const).map((day) => {
                    const session = slot[day];
                    const dayLabel = day.charAt(0).toUpperCase() + day.slice(1);
                    const isTodayDay = dayLabel === today;
                    if (!session) return null;
                    return (
                      <div key={day} className={`px-4 py-3 flex items-center gap-3 ${isTodayDay ? 'bg-primary/5' : ''}`}>
                        <div className={`w-1 h-8 rounded-full ${isTodayDay ? 'bg-primary' : 'bg-slate-200'}`}></div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className={`text-[10px] font-bold uppercase tracking-wider ${isTodayDay ? 'text-primary' : 'text-slate-400'}`}>{dayLabel}</span>
                            {isTodayDay && <span className="px-1.5 py-0.5 bg-primary/10 text-primary text-[9px] font-bold rounded">TODAY</span>}
                          </div>
                          <p className="font-bold text-sm text-slate-800 mt-0.5">{session.subject}</p>
                          <p className="text-xs text-slate-500">{session.className} &bull; {session.room}</p>
                        </div>
                        <span className="material-symbols-outlined text-slate-300">chevron_right</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function TimeSlotCell({ session, isToday }: { session?: Session, isToday?: boolean }) {
  if (!session) {
    return <div className={`p-2 border-l border-slate-100 ${isToday ? 'bg-primary/5' : ''}`}></div>;
  }

  const { subject, className, room, type, isActive } = session;

  const typeConfig = {
    lecture: { icon: 'menu_book', color: 'border-blue-200 bg-blue-50 text-blue-800' },
    lab: { icon: 'biotech', color: 'border-purple-200 bg-purple-50 text-purple-800' },
    tutorial: { icon: 'group', color: 'border-emerald-200 bg-emerald-50 text-emerald-800' }
  } as const;

  const config = typeConfig[type];

  if (isActive) {
    return (
      <div className="p-2 border-l border-slate-100 bg-primary/5 relative">
        <div className="absolute top-0 left-0 w-full h-full border-2 border-primary rounded-xl animate-pulse opacity-50 z-0"></div>
        <div className="h-full bg-primary text-white rounded-xl p-3 flex flex-col justify-between shadow-lg shadow-primary/20 relative z-10 hover:-translate-y-1 transition-transform cursor-pointer group">
          <div className="flex justify-between items-start">
            <span className="text-[9px] font-black uppercase tracking-widest bg-white/20 px-2 py-0.5 rounded-full backdrop-blur-sm shadow-sm flex items-center gap-1">
               <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></span> LIVE
            </span>
            <span className="material-symbols-outlined text-sm opacity-70 group-hover:opacity-100">{config.icon}</span>
          </div>
          <div>
            <h4 className="font-bold text-sm leading-tight mb-1">{subject}</h4>
            <p className="text-xs font-semibold text-primary-fixed-dim">{className}</p>
          </div>
          <div className="flex items-center gap-1 text-[10px] text-white/80 mt-2">
            <span className="material-symbols-outlined text-[12px]">location_on</span> {room}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`p-2 border-l border-slate-100 ${isToday ? 'bg-primary/5' : ''}`}>
      <div className={`h-full rounded-xl border ${config.color} p-3 flex flex-col justify-between hover:shadow-md transition-shadow cursor-pointer group`}>
        <div className="flex justify-between items-start">
          <span className="text-[9px] font-bold uppercase tracking-widest opacity-70">{type}</span>
          <span className="material-symbols-outlined text-sm opacity-50 group-hover:opacity-100 transition-opacity">{config.icon}</span>
        </div>
        <div>
          <h4 className="font-bold text-sm leading-tight text-slate-900 mb-1">{subject}</h4>
          <p className="text-xs font-medium text-slate-600">{className}</p>
        </div>
        <div className="flex items-center gap-1 text-[10px] opacity-70 mt-2">
          <span className="material-symbols-outlined text-[12px]">location_on</span> {room}
        </div>
      </div>
    </div>
  );
}
