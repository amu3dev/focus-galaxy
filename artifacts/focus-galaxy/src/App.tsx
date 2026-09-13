import { useEffect, useMemo, useRef, useState, memo, type CSSProperties, type FormEvent } from 'react';
import { Plus, RotateCcw, X, Target, Activity, Orbit, Trash2, ListChecks, Volume2, VolumeX, CheckCircle2, ChevronDown, ChevronUp, SunMedium } from 'lucide-react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { Route, Switch, Router as WouterRouter } from 'wouter';
import { motion, AnimatePresence, useMotionValue, useSpring, useTransform, animate } from 'framer-motion';

type Priority = {
  id: string;
  name: string;
  importance: number;
  urgency: number;
  energy: number;
  hue: string;
};

type MetricKey = 'importance' | 'urgency' | 'energy';

const STORAGE_KEY = 'focus-galaxy-priorities-v2';
const queryClient = new QueryClient();

const seedPriorities: Priority[] = [
  { id: 'job-search', name: 'Job Search', importance: 8, urgency: 9, energy: 7, hue: '#f04e76' },
  { id: 'learning', name: 'Learning', importance: 6, urgency: 4, energy: 7, hue: '#9b5be4' },
  { id: 'consulting', name: 'Consulting', importance: 7, urgency: 7, energy: 6, hue: '#3aa2f7' },
  { id: 'signalboard', name: 'SignalBoard', importance: 9, urgency: 5, energy: 8, hue: '#f1883b' },
  { id: 'family', name: 'Family', importance: 10, urgency: 6, energy: 4, hue: '#466bf0' },
  { id: 'health', name: 'Health', importance: 8, urgency: 8, energy: 5, hue: '#85d852' },
];

const orbitAngles = [-88, -31, 30, 93, 151, 215, 270];

function getFocusScore(priority: Pick<Priority, MetricKey>) {
  return Math.round((priority.importance * 0.45 + priority.urgency * 0.4 + priority.energy * 0.15) * 10);
}

function getSubLabel(name: string) {
  const map: Record<string, string> = {
    'Health': 'BALANCE',
    'SignalBoard': 'BUILD',
    'Job Search': 'FOCUS',
    'Learning': 'GROW',
    'Consulting': 'LEVERAGE',
    'Family': 'TOGETHER'
  };
  return map[name] || 'ORBITING';
}

function readPriorities(): Priority[] {
  if (typeof window === 'undefined') return seedPriorities;
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (!saved) return seedPriorities;
    const parsed = JSON.parse(saved) as Priority[];
    return Array.isArray(parsed) ? parsed : seedPriorities;
  } catch {
    return seedPriorities;
  }
}

function useParallax() {
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches) return;
    const { left, top, width, height } = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - left) / width - 0.5;
    const y = (e.clientY - top) / height - 0.5;
    mouseX.set(x);
    mouseY.set(y);
  };

  const handleMouseLeave = () => {
    mouseX.set(0);
    mouseY.set(0);
  };

  return { mouseX, mouseY, handleMouseMove, handleMouseLeave };
}

function AppLogo() {
  return (
    <a className="inline-flex items-center gap-3 text-white no-underline hover:scale-[1.02] transition-transform pointer-events-auto" href="/" data-testid="link-home">
      <div className="w-8 h-8 rounded-full border-[1.5px] border-primary flex items-center justify-center relative shadow-[0_0_20px_rgba(155,91,228,0.6)]">
         <div className="w-4 h-1 border border-primary/80 rounded-full -rotate-45" />
         <div className="w-1.5 h-1.5 bg-white rounded-full absolute" />
      </div>
      <span className="font-sans font-bold text-[16px] tracking-widest uppercase">Focus Galaxy</span>
    </a>
  );
}

function FocusAudio() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [style, setStyle] = useState<'classical' | 'baroque' | 'nocturne'>('classical');
  const audioRef = useRef<{
    context: AudioContext;
    timer: number;
  } | null>(null);

  const stopAudio = () => {
    const audio = audioRef.current;
    if (!audio) return;
    window.clearInterval(audio.timer);
    void audio.context.close();
    audioRef.current = null;
    setIsPlaying(false);
  };

  const startAudio = () => {
    const AudioContextClass = window.AudioContext;
    const context = new AudioContextClass();
    const master = context.createGain();
    const filter = context.createBiquadFilter();
    master.gain.value = 0.11;
    filter.type = 'lowpass';
    filter.frequency.value = 1800;
    filter.Q.value = 0.7;
    master.connect(filter);
    filter.connect(context.destination);

    const arrangements = {
      classical: {
        tempo: 620,
        phrases: [
          [261.63, 329.63, 392, 523.25, 392, 329.63, 293.66, 349.23],
          [220, 261.63, 329.63, 440, 329.63, 261.63, 246.94, 329.63],
          [196, 246.94, 293.66, 392, 293.66, 246.94, 220, 293.66],
          [174.61, 220, 261.63, 349.23, 261.63, 220, 196, 246.94],
        ],
        bass: [130.81, 110, 98, 87.31],
      },
      baroque: {
        tempo: 430,
        phrases: [
          [261.63, 392, 329.63, 523.25, 392, 659.25, 523.25, 392],
          [293.66, 440, 349.23, 587.33, 440, 698.46, 587.33, 440],
          [246.94, 369.99, 293.66, 493.88, 369.99, 587.33, 493.88, 369.99],
          [261.63, 392, 329.63, 523.25, 659.25, 523.25, 392, 329.63],
        ],
        bass: [130.81, 146.83, 123.47, 130.81],
      },
      nocturne: {
        tempo: 820,
        phrases: [
          [220, 261.63, 329.63, 440, 392, 329.63, 261.63, 246.94],
          [196, 246.94, 293.66, 392, 349.23, 293.66, 246.94, 220],
          [174.61, 220, 261.63, 349.23, 329.63, 261.63, 220, 196],
          [164.81, 220, 261.63, 329.63, 293.66, 261.63, 220, 196],
        ],
        bass: [110, 98, 87.31, 82.41],
      },
    } as const;
    const arrangement = arrangements[style];
    const phrases = arrangement.phrases;
    const bassNotes = arrangement.bass;

    const playNote = (frequency: number, duration: number, volume: number) => {
      const now = context.currentTime;
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = 'triangle';
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(volume, now + 0.025);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
      oscillator.connect(gain);
      gain.connect(master);
      oscillator.start(now);
      oscillator.stop(now + duration + 0.05);
    };

    let phraseIndex = 0;
    let noteIndex = 0;
    playNote(phrases[0][0], 1.2, 0.24);
    playNote(bassNotes[0], 2.4, 0.12);
    const timer = window.setInterval(() => {
      noteIndex += 1;
      if (noteIndex >= phrases[phraseIndex].length) {
        noteIndex = 0;
        phraseIndex = (phraseIndex + 1) % phrases.length;
      }
      playNote(phrases[phraseIndex][noteIndex], 1.35, 0.22);
      if (noteIndex === 0 || noteIndex === 4) {
        playNote(bassNotes[phraseIndex], 2.6, 0.1);
      }
    }, arrangement.tempo);

    audioRef.current = { context, timer };
    setIsPlaying(true);
  };

  useEffect(() => () => {
    const audio = audioRef.current;
    if (audio) {
      window.clearInterval(audio.timer);
      void audio.context.close();
    }
  }, []);

  return (
    <div className="flex items-center rounded-full border border-white/10 bg-white/5 backdrop-blur-md overflow-hidden">
      <button
        type="button"
        onClick={isPlaying ? stopAudio : startAudio}
        className="flex items-center gap-2 px-3 py-2 text-white/70 hover:bg-white/10 hover:text-white transition-all text-xs font-semibold"
        aria-label={isPlaying ? 'Pause classical focus music' : 'Play classical focus music'}
        title={isPlaying ? 'Pause classical focus music' : 'Play classical focus music'}
      >
        {isPlaying ? <Volume2 size={15} /> : <VolumeX size={15} />}
      </button>
      <select
        value={style}
        aria-label="Choose focus music"
        onChange={(event) => {
          if (isPlaying) stopAudio();
          setStyle(event.target.value as 'classical' | 'baroque' | 'nocturne');
        }}
        className="hidden sm:block max-w-[126px] border-0 border-l border-white/10 bg-transparent py-2 pl-2 pr-7 text-[11px] font-semibold text-white/75 outline-none cursor-pointer"
      >
        <option value="classical" className="bg-[#100d18]">Classical Flow</option>
        <option value="baroque" className="bg-[#100d18]">Baroque Focus</option>
        <option value="nocturne" className="bg-[#100d18]">Quiet Nocturne</option>
      </select>
    </div>
  );
}

function RangeControl({
  label,
  value,
  color,
  onChange,
}: {
  label: string;
  value: number;
  color: string;
  onChange: (value: number) => void;
}) {
  return (
    <div className="group">
      <div className="flex justify-between text-[11px] mb-2">
        <span className="text-white/60 group-hover:text-white/80 transition-colors uppercase tracking-widest font-semibold">{label}</span>
        <span className="font-sans font-bold text-white text-[13px]">{value}</span>
      </div>
      <div className="relative h-7 w-full flex items-center">
        <div className="range-track absolute left-0 right-0 h-[6px] rounded-full">
          <motion.div
             className="absolute left-0 h-full rounded-full"
             style={{ backgroundColor: color, boxShadow: `0 0 10px ${color}` }}
             animate={{ width: `${(value/10)*100}%` }}
             transition={{ type: 'spring', damping: 20, stiffness: 200 }}
          />
        </div>
        <input 
          type="range" min="1" max="10" step="1" value={value} 
          aria-label={label}
          onChange={(e) => onChange(Number(e.target.value))}
          className="metric-range absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
        />
        <motion.div 
          className="absolute top-1/2 w-4 h-4 rounded-full bg-white shadow-[0_0_10px_var(--c)] pointer-events-none -translate-y-1/2"
          style={{ '--c': color } as any}
          animate={{ left: `calc(${(value/10)*100}% - 8px)` }}
          transition={{ type: 'spring', damping: 20, stiffness: 200 }}
        />
      </div>
    </div>
  );
}

function FocusSignalPanel({
  topPriorities,
  onSelect,
  onRename,
  color,
}: {
  topPriorities: Priority[];
  onSelect: (id: string) => void;
  onRename: (id: string, name: string) => void;
  color: string;
}) {
  return (
    <div 
      className="panel-card flex flex-col h-full z-20 pointer-events-auto"
      style={{
        '--panel-glow': `${color}30`,
        '--panel-glow-inset': `${color}10`,
        borderColor: `${color}40`,
      } as any}
    >
      <div className="flex items-center gap-2 mb-3">
        <Target className="text-white" size={18} />
        <h3 className="font-sans font-bold text-[16px] text-white tracking-wide">Focus Signal</h3>
      </div>
      <p className="text-[13px] text-white/60 mb-6 leading-relaxed">
        Your attention is strongly pulled toward action and immediate delivery. Consider focusing on the highest urgency items.
      </p>
      
      <div className="flex flex-col gap-4 mt-auto">
         {topPriorities.map((p, i) => (
           <div key={p.id} className="flex items-center gap-3 group w-full">
            <span className="text-white/40 text-[11px] font-display w-3 text-left font-bold">{i + 1}</span>
            <div className="w-3 h-3 rounded-full shadow-[0_0_8px_var(--c)]" style={{ '--c': p.hue, backgroundColor: p.hue } as any} />
             <input
               key={p.name}
               defaultValue={p.name}
               aria-label={`Rename ${p.name}`}
               maxLength={40}
               onFocus={() => onSelect(p.id)}
               onBlur={(event) => {
                 const nextName = event.currentTarget.value.trim();
                 if (nextName) onRename(p.id, nextName);
                 else event.currentTarget.value = p.name;
               }}
               onKeyDown={(event) => {
                 if (event.key === 'Enter') event.currentTarget.blur();
               }}
               className="min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-1 py-1 -ml-1 text-[13px] font-semibold text-white/80 outline-none transition-colors hover:border-white/10 hover:text-white focus:border-white/20 focus:bg-white/5 focus:text-white"
             />
            <div className="w-16 lg:w-20 h-[6px] bg-white/10 rounded-full overflow-hidden flex-shrink-0">
               <div className="h-full rounded-full" style={{ width: `${getFocusScore(p)}%`, backgroundColor: p.hue, boxShadow: `0 0 10px ${p.hue}` }} />
            </div>
            <span className="text-[13px] font-sans font-bold w-6 text-right text-white">{getFocusScore(p)}</span>
           </div>
        ))}
      </div>
    </div>
  );
}

function ManageTasksDialog({
  priorities,
  onClose,
  onSelect,
  onRename,
}: {
  priorities: Priority[];
  onClose: () => void;
  onSelect: (id: string) => void;
  onRename: (id: string, name: string) => void;
}) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <motion.div
      className="fixed inset-0 z-50 grid place-items-center p-4 bg-background/60 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <motion.div
        className="add-dialog w-full max-w-md"
        role="dialog"
        aria-modal="true"
        aria-labelledby="manage-tasks-title"
        initial={{ scale: 0.96, y: 12, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        exit={{ scale: 0.96, y: 8, opacity: 0 }}
      >
        <div className="flex items-start justify-between gap-4 mb-5">
          <div>
            <h2 id="manage-tasks-title" className="font-display text-xl font-bold text-white tracking-wide">Manage priorities</h2>
            <p className="text-white/60 text-xs mt-1.5 font-medium">Rename any pre-listed or added planet.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close dialog" className="w-8 h-8 rounded-full bg-white/5 border border-white/10 text-white/60 flex items-center justify-center hover:text-white hover:bg-white/10 transition-colors">
            <X size={16} />
          </button>
        </div>
        <div className="flex flex-col gap-2 max-h-[55vh] overflow-y-auto pr-1">
          {priorities.map((priority) => (
            <div key={priority.id} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-2.5">
              <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: priority.hue, boxShadow: `0 0 9px ${priority.hue}` }} />
              <input
                key={priority.name}
                defaultValue={priority.name}
                maxLength={40}
                aria-label={`Rename ${priority.name}`}
                onBlur={(event) => {
                  const nextName = event.currentTarget.value.trim();
                  if (nextName) onRename(priority.id, nextName);
                  else event.currentTarget.value = priority.name;
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') event.currentTarget.blur();
                }}
                className="min-w-0 flex-1 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm font-semibold text-white outline-none focus:border-primary/60 transition-colors"
              />
              <button
                type="button"
                onClick={() => {
                  onSelect(priority.id);
                  onClose();
                }}
                className="px-3 py-2 rounded-lg border border-white/10 text-[11px] font-bold text-white/60 hover:bg-white/10 hover:text-white transition-colors"
              >
                Tune
              </button>
            </div>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
}

function InsightPanel({ insight, priority }: { insight: string, priority?: Priority }) {
  const color = priority?.hue || '#9b5be4';
  
  return (
    <div 
      className="panel-card flex flex-col items-center justify-center text-center relative overflow-hidden min-h-[240px] z-20 pointer-events-auto"
      style={{
        '--panel-glow': `${color}30`,
        '--panel-glow-inset': `${color}10`,
        borderColor: `${color}40`,
      } as any}
    >
      {priority && (
         <div className="absolute inset-0 opacity-20 pointer-events-none transition-colors duration-700" style={{ background: `radial-gradient(circle at 50% -20%, ${priority.hue}, transparent 70%)` }} />
      )}
      
      <div className="w-12 h-12 rounded-full border border-white/20 bg-white/5 flex items-center justify-center mb-4 z-10 transition-colors duration-500" style={{ boxShadow: priority ? `0 0 25px ${priority.hue}60` : 'none' }}>
        <Activity size={20} className={priority ? "text-white" : "text-white/60"} style={{ color: priority?.hue }} />
      </div>
      
      <h3 className="font-sans font-bold text-[16px] mb-2 text-white z-10 tracking-wide">
        {priority ? "You're pulled toward action." : "Field is open."}
      </h3>
      
      <p className="text-[13px] text-white/60 leading-relaxed max-w-[280px] z-10 font-medium">
        {insight}
      </p>
      
    </div>
  );
}

function SelectedPanel({
  priority,
  onUpdate,
  onRename,
  onComplete,
  onClose,
  onRemove,
}: {
  priority?: Priority;
  onUpdate: (metric: MetricKey, val: number) => void;
  onRename: (name: string) => void;
  onComplete: () => void;
  onClose: () => void;
  onRemove: () => void;
}) {
  const [name, setName] = useState(priority?.name ?? '');

  useEffect(() => {
    setName(priority?.name ?? '');
  }, [priority?.id, priority?.name]);

  if (!priority) return (
     <div className="panel-card flex flex-col justify-center items-center text-center z-20 pointer-events-auto min-h-[240px] opacity-0 pointer-events-none w-0 h-0 p-0 m-0">
     </div>
  );
  
  const saveName = () => {
    const nextName = name.trim();
    if (!nextName) {
      setName(priority.name);
      return;
    }
    onRename(nextName);
  };

  return (
    <form
      className="selected-panel-card panel-card flex flex-col relative overflow-hidden h-full z-20 pointer-events-auto"
      onSubmit={(event) => {
        event.preventDefault();
        saveName();
      }}
      style={{
        '--panel-glow': `${priority.hue}40`,
        '--panel-glow-inset': `${priority.hue}15`,
        borderColor: `${priority.hue}50`,
      } as any}
    >
      <div className="flex justify-between items-start mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full shadow-[0_0_20px_var(--c)] relative" style={{ '--c': priority.hue, background: `radial-gradient(circle at 35% 35%, #fff 0%, ${priority.hue} 50%, #000 90%)` } as any}>
            <div className="absolute inset-0 rounded-full shadow-[inset_0_0_10px_rgba(255,255,255,0.5)] pointer-events-none"></div>
          </div>
          <div className="flex flex-col justify-center">
             <label htmlFor="selected-priority-name" className="sr-only">Planet name</label>
             <input
               id="selected-priority-name"
               value={name}
               onChange={(event) => setName(event.target.value)}
               onBlur={saveName}
               maxLength={40}
               className="w-full min-w-0 max-w-[180px] rounded-md border border-transparent bg-transparent px-1 py-1 -ml-1 font-sans font-bold text-[17px] leading-none text-white tracking-wide outline-none transition-colors hover:border-white/10 hover:bg-white/5 focus:border-white/20 focus:bg-white/10"
             />
            <span className="text-[10px] uppercase tracking-widest font-display font-bold mt-1 px-1" style={{ color: priority.hue }}>
               {getFocusScore(priority) > 75 ? 'HIGH FOCUS' : 'IN ORBIT'}
            </span>
          </div>
        </div>
        <button type="button" onClick={onClose} className="text-white/40 hover:text-white transition-colors p-1" aria-label="Close panel">
           <X size={18} />
        </button>
      </div>
      
      <div className="flex flex-col gap-5 mt-4">
         <RangeControl label="Importance" value={priority.importance} color={priority.hue} onChange={(v) => onUpdate('importance', v)} />
         <RangeControl label="Urgency" value={priority.urgency} color={priority.hue} onChange={(v) => onUpdate('urgency', v)} />
         <RangeControl label="Energy / Effort" value={priority.energy} color={priority.hue} onChange={(v) => onUpdate('energy', v)} />
      </div>
      
      <div className="flex items-center gap-3 mt-5">
        <button type="button" onClick={() => { if(window.confirm('Remove this priority?')) onRemove() }} aria-label="Delete priority" className="w-10 h-10 rounded-xl border border-white/10 bg-white/5 text-white/40 flex items-center justify-center hover:bg-red-500/20 hover:text-red-400 hover:border-red-500/30 transition-colors">
          <Trash2 size={16} />
        </button>
         <button type="submit" className="flex-1 h-10 rounded-xl border border-white/10 bg-white/5 text-[13px] font-bold text-white hover:bg-white/10 transition-colors">
          Save Name
        </button>
        <button
          type="button"
          onClick={onComplete}
          aria-label="Complete task"
          title="Complete task"
          className="complete-task-corner flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-emerald-400/40 bg-emerald-400/12 text-emerald-300 transition-colors hover:border-emerald-300/80 hover:bg-emerald-400/25 hover:text-emerald-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/70"
        >
          <CheckCircle2 size={17} />
        </button>
      </div>
   </form>
  );
}

function AddPriorityDialog({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (name: string) => void;
}) {
  const [name, setName] = useState('');

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (trimmed) onCreate(trimmed);
  };

  return (
    <motion.div
      className="fixed inset-0 z-50 grid place-items-center p-4 bg-background/60 backdrop-blur-sm"
      role="presentation"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <motion.form 
        className="add-dialog" 
        onSubmit={submit} 
        role="dialog" 
        aria-modal="true"
        aria-labelledby="add-priority-title"
        initial={{ scale: 0.95, y: 15, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        exit={{ scale: 0.95, y: 10, opacity: 0 }}
        transition={{ type: "spring", damping: 25, stiffness: 350 }}
      >
        <div className="flex justify-between gap-5 mb-6">
          <div>
            <h2 id="add-priority-title" className="font-display text-xl font-bold m-0 text-white tracking-wide">New body</h2>
            <p className="text-white/60 text-xs mt-1.5 font-medium">Give the next thing a place in your sky.</p>
          </div>
          <motion.button 
            type="button" 
            aria-label="Close dialog"
            className="w-8 h-8 rounded-full bg-white/5 border border-white/10 text-white/60 flex items-center justify-center hover:text-white hover:bg-white/10 transition-colors self-start" 
            onClick={onClose} 
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
          >
            <X size={16} />
          </motion.button>
        </div>
        <label className="block text-white/60 text-[11px] uppercase tracking-widest font-bold">
          Priority name
          <input
            className="name-input"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g. Write the proposal"
            autoFocus
            maxLength={42}
          />
        </label>
        <div className="flex justify-end gap-3 mt-8">
          <motion.button 
            type="button" 
            className="px-5 py-2.5 rounded-full border border-white/10 text-white/60 text-xs font-bold hover:bg-white/10 hover:text-white transition-colors" 
            onClick={onClose} 
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            Cancel
          </motion.button>
          <motion.button 
            type="submit" 
            className="px-5 py-2.5 rounded-full bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 transition-colors flex items-center gap-2" 
            disabled={!name.trim()} 
            whileHover={name.trim() ? { scale: 1.05 } : {}}
            whileTap={name.trim() ? { scale: 0.95 } : {}}
          >
            <Plus size={14} strokeWidth={3} /> Place in galaxy
          </motion.button>
        </div>
      </motion.form>
    </motion.div>
  );
}

const Particles = memo(function Particles() {
  const particles = useMemo(() => Array.from({ length: 150 }).map((_, i) => ({
    id: i,
    size: Math.random() * 2.5 + 0.5,
    left: `${Math.random() * 100}%`,
    top: `${Math.random() * 100}%`,
    dur: Math.random() * 6 + 4,
    delay: Math.random() * -10,
    opacity: Math.random() * 0.7 + 0.2,
    color: Math.random() > 0.8 ? (Math.random() > 0.5 ? '#ffccff' : '#ccddff') : '#ffffff'
  })), []);

  return (
    <div className="cosmos-particles absolute inset-0 pointer-events-none overflow-hidden z-0">
      {particles.map((p) => (
        <div
          key={p.id}
          className="particle"
          style={{
            width: p.size,
            height: p.size,
            left: p.left,
            top: p.top,
            backgroundColor: p.color,
            boxShadow: `0 0 ${p.size * 2}px ${p.color}`,
            '--twinkle-dur': `${p.dur}s`,
            animationDelay: `${p.delay}s`,
            '--max-opacity': p.opacity,
          } as CSSProperties}
        />
      ))}
    </div>
  );
});

function OrbitRings({ priorities }: { priorities: Priority[] }) {
  return (
    <>
      {priorities.map(p => (
        <OrbitRing key={`ring-${p.id}`} priority={p} />
      ))}
    </>
  );
}

function OrbitRing({ priority }: { priority: Priority }) {
  const urgencySpring = useSpring(priority.urgency, { stiffness: 50, damping: 15 });
  const sizeX = useTransform(() => `${(24 + (10 - urgencySpring.get()) * 2.8) * 2}%`);
  const sizeY = useTransform(() => `${(24 + (10 - urgencySpring.get()) * 2.8) * 2 * 0.82}%`);
  
  return (
    <motion.div
      className="orbit-track absolute left-1/2 top-1/2 rounded-full pointer-events-none"
      style={{
        x: '-50%',
        y: '-50%',
        width: sizeX,
        height: sizeY,
        rotateX: 64,
        rotateZ: -8,
        transformStyle: 'preserve-3d',
        border: `1px solid ${priority.hue}30`,
        boxShadow: `0 0 16px ${priority.hue}12`,
        zIndex: 0
      }}
    />
  );
}

function SelectedOrbitRing({ priority }: { priority: Priority }) {
  const urgencySpring = useSpring(priority.urgency, { stiffness: 50, damping: 15 });
  
  useEffect(() => {
    urgencySpring.set(priority.urgency);
  }, [priority.urgency, urgencySpring]);
  
  const size = useTransform(() => `${(24 + (10 - urgencySpring.get()) * 2.8) * 2}%`);
  const sizeSquished = useTransform(() => `${(24 + (10 - urgencySpring.get()) * 2.8) * 2 * 0.82}%`);
  
  return (
    <motion.div
      className="orbit-track orbit-track-selected absolute left-1/2 top-1/2 rounded-full pointer-events-none z-0"
      style={{
        x: '-50%',
        y: '-50%',
        width: size,
        height: sizeSquished,
        rotateX: 64,
        rotateZ: -8,
        transformStyle: 'preserve-3d',
        border: '1.5px solid var(--borderColor)',
        boxShadow: '0 0 20px var(--borderColor) inset, 0 0 20px var(--borderColor)',
        opacity: 0.6,
        '--borderColor': priority.hue,
      } as any}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 0.6, scale: 1 }}
      exit={{ opacity: 0, scale: 1.05 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
    />
  );
}

function OrbComponent({ 
  priority, 
  index, 
  selectedId, 
  onSelect,
  isCompleting,
  prefersReducedMotion 
}: { 
  priority: Priority; 
  index: number; 
  selectedId: string | null; 
  onSelect: (id: string) => void;
  isCompleting: boolean;
  prefersReducedMotion: boolean;
}) {
  const isSelected = selectedId === priority.id;
  const isUnrelated = selectedId !== null && !isSelected;
  const score = getFocusScore(priority);
  
  const drift = useMotionValue(0);
  
  useEffect(() => {
    if (prefersReducedMotion) return;
    const controls = animate(drift, Math.PI * 2, {
      duration: 180 + index * 30,
      repeat: Infinity,
      ease: "linear"
    });
    return controls.stop;
  }, [prefersReducedMotion, index, drift]);
  
  const baseAngle = (orbitAngles[index % orbitAngles.length] * Math.PI) / 180;
  
  const urgencySpring = useSpring(priority.urgency, { stiffness: 50, damping: 15 });
  const importanceSpring = useSpring(priority.importance, { stiffness: 50, damping: 15 });
  
  useEffect(() => {
    urgencySpring.set(priority.urgency);
    importanceSpring.set(priority.importance);
  }, [priority.urgency, priority.importance, urgencySpring, importanceSpring]);
  
  const x = useTransform(() => {
    const d = drift.get();
    const u = urgencySpring.get();
    const angle = baseAngle + d;
    const radius = 24 + (10 - u) * 2.8;
    return `${50 + Math.cos(angle) * radius}%`;
  });
  
  const y = useTransform(() => {
    const d = drift.get();
    const u = urgencySpring.get();
    const angle = baseAngle + d;
    const radius = 24 + (10 - u) * 2.8;
    return `${50 + Math.sin(angle) * radius * 0.82}%`;
  });

  const depth = useTransform(() => Math.sin(baseAngle + drift.get()) * 70);
  
  const size = useTransform(() => 35 + importanceSpring.get() * 6);
  
  return (
    <motion.div
      className="orb-hit-container"
      style={{ left: x, top: y, position: 'absolute', x: '-50%', y: '-50%', z: depth, transformStyle: 'preserve-3d', zIndex: isSelected ? 10 : isUnrelated ? 1 : 2 }}
      initial={{ scale: 0, opacity: 0 }}
      animate={{ 
        scale: isCompleting ? [1, 1.35, 0.15] : 1,
        opacity: isUnrelated ? 0.72 : 1,
        filter: isCompleting
          ? ['brightness(1)', 'brightness(3) drop-shadow(0 0 28px white)', 'brightness(5) blur(2px)']
          : isUnrelated ? 'brightness(0.82) grayscale(10%)' : 'brightness(1) grayscale(0%)',
      }}
      transition={isCompleting ? { duration: 0.6, times: [0, 0.4, 1] } : { type: 'spring', damping: 25, stiffness: 200 }}
    >
      <motion.button
        type="button"
        className={`orb-wrapper orb-depth pointer-events-auto ${isSelected ? 'selected' : ''}`}
        aria-label={`Select ${priority.name}`}
        onClick={() => onSelect(priority.id)}
        whileHover={!isCompleting ? { scale: 1.05 } : {}}
        whileTap={!isCompleting ? { scale: 0.98 } : {}}
      >
        <div className="relative">
          <div className="absolute -top-3 -right-3 px-2 py-0.5 rounded-full text-[10px] font-bold font-display z-20 text-white" style={{
            backgroundColor: 'rgba(0,0,0,0.6)',
            border: `1px solid ${priority.hue}60`,
            boxShadow: `0 0 10px ${priority.hue}40`,
          }}>
            {score}
          </div>
          
          <motion.div
            className="orb-planet"
            style={{
              width: size,
              height: size,
              '--orb-color': priority.hue,
            } as any}
          />
        </div>
        <div className="orb-label mt-2">
          <span className="orb-name block text-[13px] font-sans font-bold text-white tracking-wide">{priority.name}</span>
          <span className="orb-sub block text-[9px] font-display font-bold tracking-widest mt-0.5" style={{ color: `${priority.hue}` }}>
            {getSubLabel(priority.name)}
          </span>
        </div>
      </motion.button>
    </motion.div>
  );
}

function CosmosBrightnessControl({
  value,
  onChange,
}: {
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="cosmos-brightness-control" title="Adjust Cosmos brightness">
      <SunMedium size={15} aria-hidden="true" />
      <label htmlFor="cosmos-brightness" className="sr-only">Cosmos brightness</label>
      <input
        id="cosmos-brightness"
        type="range"
        min="45"
        max="130"
        step="1"
        value={value}
        aria-label="Cosmos brightness"
        onChange={(event) => onChange(Number(event.target.value))}
        className="cosmos-brightness-range"
      />
      <output htmlFor="cosmos-brightness" className="cosmos-brightness-value">{value}%</output>
    </div>
  );
}

function FocusGalaxyContainer() {
  const [priorities, setPriorities] = useState<Priority[]>(readPriorities);
  const [selectedId, setSelectedId] = useState<string | null>(() => readPriorities()[0]?.id ?? null);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isManageOpen, setIsManageOpen] = useState(false);
  const [panelsOpen, setPanelsOpen] = useState(true);
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [cosmosBrightness, setCosmosBrightness] = useState(100);
  
  const prefersReducedMotion = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(priorities));
  }, [priorities]);
  
  useEffect(() => {
    if (selectedId && !priorities.some(p => p.id === selectedId)) {
      setSelectedId(null);
    }
  }, [priorities, selectedId]);

  const addPriority = (name: string) => {
    const hues = ['#f04e76', '#9b5be4', '#3aa2f7', '#f1883b', '#466bf0', '#85d852', '#f0c04e', '#4ef0c0'];
    const newP: Priority = {
      id: crypto.randomUUID(),
      name,
      importance: 5,
      urgency: 5,
      energy: 5,
      hue: hues[priorities.length % hues.length],
    };
    setPriorities(prev => [...prev, newP]);
    setIsAddOpen(false);
    setSelectedId(newP.id);
  };

  const updatePriority = (id: string, metric: MetricKey, val: number) => {
    setPriorities(prev => prev.map(p => p.id === id ? { ...p, [metric]: val } : p));
  };
  
  const renamePriority = (id: string, name: string) => {
    setPriorities(prev => prev.map(p => p.id === id ? { ...p, name } : p));
  };

  const removePriority = (id: string) => {
    setPriorities(prev => prev.filter(p => p.id !== id));
    if (selectedId === id) setSelectedId(null);
  };

  const selectPriority = (id: string) => {
    setSelectedId(id);
    setPanelsOpen(true);
  };

  const completePriority = (id: string) => {
    setCompletingId(id);
    setTimeout(() => {
      removePriority(id);
      setCompletingId(null);
    }, 600);
  };

  const resetPriorities = () => {
    if (window.confirm('Restore initial demo priorities?')) {
      setPriorities(seedPriorities);
      setSelectedId(null);
    }
  };

  const topPriorities = [...priorities].sort((a, b) => getFocusScore(b) - getFocusScore(a)).slice(0, 3);
  const selectedPriority = priorities.find(p => p.id === selectedId);
  
  const insight = useMemo(() => {
    if (!selectedPriority) {
      if (priorities.length === 0) return "Space is empty. Add a priority to begin.";
      if (topPriorities.length > 0 && getFocusScore(topPriorities[0]) > 80) {
        return `${topPriorities[0].name} demands attention. Consider giving it one clear next move.`;
      }
      return "Forces are balanced. Take a moment to reflect before choosing a path.";
    }
    const score = getFocusScore(selectedPriority);
    if (score > 85) return `${selectedPriority.name} is pulling closest to now. Give it one clear next move before the rest of the sky gets louder.`;
    if (selectedPriority.importance > 8 && selectedPriority.urgency < 5) return `Important but not urgent. Protect time for ${selectedPriority.name} before it becomes an emergency.`;
    if (selectedPriority.energy > 8) return `High effort required. Break ${selectedPriority.name} into smaller pieces to reduce friction.`;
    return `${selectedPriority.name} is steadily in orbit. Tune its metrics if the situation shifts.`;
  }, [selectedPriority, topPriorities, priorities.length]);

  const { mouseX, mouseY, handleMouseMove, handleMouseLeave } = useParallax();
  const panX = useTransform(mouseX, [-0.5, 0.5], [12, -12]);
  const panY = useTransform(mouseY, [-0.5, 0.5], [12, -12]);
  const tiltX = useTransform(mouseY, [-0.5, 0.5], prefersReducedMotion ? [0, 0] : [2.5, -2.5]);
  const tiltY = useTransform(mouseX, [-0.5, 0.5], prefersReducedMotion ? [0, 0] : [-2.5, 2.5]);
  const brightnessRatio = cosmosBrightness / 100;
  const cosmosVisualStyle = {
    '--cosmos-bg-opacity': String(Math.min(1, 0.55 + brightnessRatio * 0.45)),
    '--cosmos-star-opacity': String(Math.min(1, 0.45 + brightnessRatio * 0.55)),
    '--cosmos-scene-opacity': String(Math.min(1, 0.5 + brightnessRatio * 0.5)),
    '--cosmos-dim-opacity': String(Math.max(0, (100 - cosmosBrightness) / 100 * 0.55)),
    '--cosmos-lift-opacity': String(Math.max(0, (cosmosBrightness - 100) / 30 * 0.32)),
  } as CSSProperties;

  return (
    <div 
      className="focus-galaxy-app relative w-full h-[100dvh] overflow-hidden bg-background select-none"
      style={cosmosVisualStyle}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <div className="bg-stars" />
      <Particles />
      
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute top-1/4 left-8 md:left-12 max-w-[150px] opacity-70 hidden sm:block">
           <p className="text-[12px] leading-relaxed text-white/80 font-display">"A calmer mind<br/>creates a brighter<br/>future."</p>
           <div className="w-6 h-[1px] bg-white/30 mt-3" />
        </div>
        
        <div className="absolute top-1/4 right-8 md:right-12 text-right max-w-[150px] opacity-70 hidden sm:block">
           <p className="text-[12px] leading-relaxed text-white/80 font-display">Different priorities<br/>Same universe<br/>Your focus.</p>
           <div className="w-6 h-[1px] bg-white/30 mt-3 ml-auto" />
        </div>
        
        <div className="absolute bottom-12 left-8 md:left-12 flex flex-col gap-2 opacity-60 hidden sm:flex">
           <Target size={16} className="text-white/50" />
           <p className="text-[10px] text-white/60 font-display font-medium">Balance today<br/>A brighter tomorrow.</p>
        </div>
        
        <div className="absolute bottom-12 right-8 md:right-12 flex flex-col gap-2 items-end text-right opacity-60 hidden sm:flex">
           <Orbit size={16} className="text-white/50" />
           <p className="text-[10px] text-white/60 font-display font-medium">"Focus is freedom."</p>
        </div>
      </div>

      <header className="fixed top-0 left-0 right-0 p-6 flex flex-col md:flex-row items-center justify-between z-30 pointer-events-none">
        <div className="flex flex-col items-start gap-1 pointer-events-auto">
          <AppLogo />
          <span className="text-[11px] text-white/60 font-medium ml-1">Turn your priorities into clarity.</span>
        </div>
        
        <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-4 mt-4 md:mt-0 pointer-events-auto">
          <div className="hidden md:flex items-center rounded-full bg-white/5 border border-white/10 p-1 backdrop-blur-md">
            <button className="px-5 py-1.5 rounded-full bg-primary/20 text-white text-[11px] font-bold shadow-[0_0_10px_rgba(155,91,228,0.3)]">Today</button>
            <button className="px-4 py-1.5 rounded-full text-white/50 hover:text-white transition-colors text-[11px] font-bold">This Week</button>
            <button className="px-4 py-1.5 rounded-full text-white/50 hover:text-white transition-colors text-[11px] font-bold">This Month</button>
          </div>
          
          <button onClick={() => setIsAddOpen(true)} aria-label="Add priority" className="flex items-center gap-2 px-5 py-2 rounded-full border border-primary/50 bg-primary/20 hover:bg-primary/30 text-white text-xs font-bold transition-colors shadow-[0_0_15px_rgba(155,91,228,0.3)]">
            <Plus size={14} strokeWidth={3} /> Add Priority
          </button>

          <FocusAudio />

          <CosmosBrightnessControl value={cosmosBrightness} onChange={setCosmosBrightness} />

          <button onClick={() => setIsManageOpen(true)} aria-label="Manage priorities" className="hidden lg:flex items-center gap-2 px-4 py-2 rounded-full border border-white/10 bg-white/5 hover:bg-white/10 text-white/70 hover:text-white text-xs font-bold transition-colors">
            <ListChecks size={15} /> Manage
          </button>
          
          <button onClick={resetPriorities} className="w-10 h-10 rounded-full border border-white/10 bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/70 hover:text-white transition-colors shadow-[0_4px_10px_rgba(0,0,0,0.5)]" aria-label="Reset priorities">
            <RotateCcw size={15} />
          </button>
        </div>
      </header>
      
      <motion.div 
        className="galaxy-viewport absolute inset-0 z-10 pointer-events-none"
        style={{ x: panX, y: panY, rotateX: tiltX, rotateY: tiltY, transformPerspective: 1400, transformStyle: 'preserve-3d' }}
      >
        <div className="galaxy-layer absolute inset-0 transform-gpu origin-center pointer-events-none">
          
          <OrbitRings priorities={priorities} />

          {selectedPriority && (
             <AnimatePresence>
                <SelectedOrbitRing key="selected-ring" priority={selectedPriority} />
             </AnimatePresence>
          )}

          <motion.div
            className="absolute left-1/2 top-[44%] -translate-x-1/2 -translate-y-1/2 w-[132px] h-[132px] md:w-[150px] md:h-[150px] z-10"
          >
            <div className="core-body" />
            <div className="core-text">
              <span className="core-title">YOU / NOW</span>
              <span className="core-subtitle">Center of Gravity</span>
            </div>
          </motion.div>

          <AnimatePresence>
            {priorities.map((p, i) => (
              <OrbComponent 
                key={p.id} 
                priority={p} 
                index={i} 
                selectedId={selectedId} 
                onSelect={selectPriority}
                isCompleting={p.id === completingId}
                prefersReducedMotion={prefersReducedMotion}
              />
            ))}
          </AnimatePresence>
          
        </div>
      </motion.div>

      <div className="cosmos-dim-layer absolute inset-0 z-[15] pointer-events-none" aria-hidden="true" />
      <div className="cosmos-lift-layer absolute inset-0 z-[15] pointer-events-none" aria-hidden="true" />
      
      <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-background via-background/80 to-transparent pointer-events-none z-10" />

      <motion.div
        className="insight-dock absolute bottom-28 left-6 right-6 flex flex-col xl:flex-row items-end xl:items-end justify-center gap-8 z-20 pointer-events-none"
        animate={{ y: panelsOpen ? 0 : 250 }}
        transition={{ type: 'spring', stiffness: 180, damping: 24 }}
      >
        <button
          type="button"
          onClick={() => setPanelsOpen((open) => !open)}
          className="hidden xl:flex absolute left-1/2 -top-10 -translate-x-1/2 z-30 h-8 items-center gap-2 rounded-full border border-white/15 bg-[#110d19]/90 px-4 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/65 backdrop-blur-xl hover:border-primary/40 hover:text-white pointer-events-auto"
          aria-expanded={panelsOpen}
        >
          {panelsOpen ? <ChevronDown size={13} /> : <ChevronUp size={13} />}
          {panelsOpen ? 'Focus on galaxy' : 'Show insights'}
        </button>
        
        <div className="panel-slot panel-slot-signal w-full xl:w-[min(30vw,400px)] shrink-0 transform-gpu transition-all duration-500 hidden md:block">
           <FocusSignalPanel 
             topPriorities={topPriorities} 
              onSelect={selectPriority}
             onRename={renamePriority}
             color={topPriorities[0]?.hue || '#9b5be4'}
           />
        </div>
        
        <div className="panel-slot panel-slot-insight w-full xl:w-[min(30vw,400px)] shrink-0 transform-gpu transition-all duration-500 hidden md:block">
           <InsightPanel 
             insight={insight} 
             priority={selectedPriority || topPriorities[0]} 
           />
        </div>
        
        {selectedId && (
          <div className="panel-slot panel-slot-selected w-full xl:w-[min(30vw,400px)] shrink-0 transform-gpu transition-all duration-500">
             <SelectedPanel 
               priority={selectedPriority}
               onUpdate={(metric, val) => updatePriority(selectedId, metric, val)}
               onRename={(name) => renamePriority(selectedId, name)}
               onComplete={() => completePriority(selectedId)}
               onClose={() => setSelectedId(null)}
               onRemove={() => removePriority(selectedId)}
             />
          </div>
        )}
      </motion.div>

      <AnimatePresence>
        {isAddOpen && (
          <AddPriorityDialog 
            onClose={() => setIsAddOpen(false)} 
            onCreate={addPriority} 
          />
        )}
        {isManageOpen && (
          <ManageTasksDialog
            priorities={priorities}
            onClose={() => setIsManageOpen(false)}
            onSelect={selectPriority}
            onRename={renamePriority}
          />
        )}
      </AnimatePresence>

      <button
        onClick={() => setIsManageOpen(true)}
        className="fixed bottom-6 right-6 z-30 flex md:hidden items-center justify-center w-12 h-12 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-white shadow-lg pointer-events-auto"
        aria-label="Manage priorities"
      >
        <ListChecks size={20} />
      </button>

      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-30 pointer-events-auto hidden md:flex items-center gap-2 opacity-50 hover:opacity-100 transition-opacity bg-black/40 px-4 py-1.5 rounded-full border border-white/10 backdrop-blur-md">
        <div className="w-4 h-6 border-[1.5px] border-white/60 rounded-full flex justify-center pt-1">
           <motion.div 
             animate={{ y: [0, 4, 0] }} 
             transition={{ repeat: Infinity, duration: 1.5 }}
             className="w-1 h-1.5 bg-white/60 rounded-full" 
           />
        </div>
        <span className="text-[10px] text-white/80 font-medium tracking-wide">Hover over cards and planets to explore</span>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Switch>
          <Route path="/" component={FocusGalaxyContainer} />
          <Route component={NotFound} />
        </Switch>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}