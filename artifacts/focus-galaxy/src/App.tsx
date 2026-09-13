import { useEffect, useMemo, useRef, useState, memo, type CSSProperties, type FormEvent } from 'react';
import { Plus, RotateCcw, X, Target, Orbit, Trash2, ListChecks, Volume2, VolumeX, Check, ChevronDown, ChevronUp } from 'lucide-react';
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
    <a className="inline-flex items-center gap-3 text-white no-underline hover:scale-[1.02] transition-transform" href="/" data-testid="link-home">
      <div className="w-8 h-8 rounded-full border border-primary flex items-center justify-center relative shadow-[0_0_15px_rgba(155,91,228,0.4)]">
         <div className="w-4 h-1 border border-primary/80 rounded-full -rotate-45" />
         <div className="w-1.5 h-1.5 bg-white rounded-full absolute" />
      </div>
      <span className="font-display font-semibold text-lg tracking-widest uppercase">Focus Galaxy</span>
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
        <span className="text-muted-foreground group-hover:text-white/80 transition-colors uppercase tracking-wider">{label}</span>
        <span className="font-display font-medium text-white">{value}</span>
      </div>
      <div className="relative h-[4px] bg-white/10 rounded-full w-full flex items-center">
        <motion.div 
           className="absolute left-0 h-full rounded-full" 
           style={{ backgroundColor: color }}
           animate={{ width: `${(value/10)*100}%` }}
           transition={{ type: 'spring', damping: 20, stiffness: 200 }}
        />
        <input 
          type="range" min="1" max="10" step="1" value={value} aria-label={label}
          onChange={(e) => onChange(Number(e.target.value))}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
        />
        <motion.div 
          className="absolute w-3 h-3 rounded-full bg-white shadow-[0_0_8px_var(--c)] pointer-events-none"
          style={{ '--c': color } as any}
          animate={{ left: `calc(${(value/10)*100}% - 6px)` }}
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
}: {
  topPriorities: Priority[];
  onSelect: (id: string) => void;
  onRename: (id: string, name: string) => void;
}) {
  return (
    <div className="panel-card flex flex-col h-full z-20 pointer-events-auto">
      <div className="flex items-center gap-2 mb-3">
        <Target className="text-white" size={16} />
        <h3 className="font-sans font-semibold text-[15px] text-white tracking-wide">Focus Signal</h3>
      </div>
      <p className="text-[13px] text-muted-foreground mb-6 leading-relaxed">
        Your attention is strongly pulled toward action and immediate delivery. Consider focusing on the highest urgency items.
      </p>
      
      <div className="flex flex-col gap-5 mt-auto">
         {topPriorities.map((p, i) => (
           <div key={p.id} className="flex items-center gap-3 group w-full">
            <span className="text-muted-foreground text-[11px] font-display w-3 text-left">{i + 1}</span>
            <div className="w-2.5 h-2.5 rounded-full shadow-[0_0_8px_var(--c)]" style={{ '--c': p.hue, backgroundColor: p.hue } as any} />
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
               className="min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-1 py-1 -ml-1 text-[13px] font-medium text-muted-foreground outline-none transition-colors hover:border-white/10 hover:text-white focus:border-primary/40 focus:bg-white/5 focus:text-white"
             />
            <div className="w-20 lg:w-24 h-1.5 bg-white/10 rounded-full overflow-hidden flex-shrink-0">
               <div className="h-full rounded-full" style={{ width: `${getFocusScore(p)}%`, backgroundColor: p.hue, boxShadow: `0 0 8px ${p.hue}` }} />
            </div>
            <span className="text-[13px] font-display font-bold w-6 text-right text-white">{getFocusScore(p)}</span>
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
            <h2 id="manage-tasks-title" className="font-display text-xl font-semibold text-white tracking-wide">Manage priorities</h2>
            <p className="text-muted-foreground text-xs mt-1.5">Rename any pre-listed or added planet.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close dialog" className="w-7 h-7 rounded-full bg-white/5 border border-white/10 text-muted-foreground flex items-center justify-center hover:text-white">
            <X size={14} />
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
                className="min-w-0 flex-1 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none focus:border-primary/60"
              />
              <button
                type="button"
                onClick={() => {
                  onSelect(priority.id);
                  onClose();
                }}
                className="px-3 py-2 rounded-lg border border-white/10 text-[11px] text-muted-foreground hover:bg-white/10 hover:text-white"
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
  return (
    <div className="panel-card flex flex-col items-center justify-center text-center relative overflow-hidden min-h-[240px] z-20 pointer-events-auto">
      {priority && (
         <div className="absolute inset-0 opacity-15 pointer-events-none transition-colors duration-700" style={{ background: `radial-gradient(circle at 50% 0%, ${priority.hue}, transparent 70%)` }} />
      )}
      
      <div className="w-12 h-12 rounded-full border border-white/10 bg-white/5 flex items-center justify-center mb-5 z-10 transition-colors duration-500" style={{ boxShadow: priority ? `0 0 20px ${priority.hue}40` : 'none' }}>
        <Orbit size={20} className={priority ? "text-white" : "text-muted-foreground"} style={{ color: priority?.hue }} />
      </div>
      
      <h3 className="font-sans font-semibold text-base mb-3 text-white z-10 tracking-wide">
        {priority ? "You're pulled toward action." : "Field is open."}
      </h3>
      
      <p className="text-[13px] text-muted-foreground leading-relaxed max-w-[260px] z-10">
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
  onRemove,
  onClose,
}: {
  priority?: Priority;
  onUpdate: (metric: MetricKey, val: number) => void;
  onRename: (name: string) => void;
  onComplete: () => void;
  onRemove: () => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(priority?.name ?? '');

  useEffect(() => {
    setName(priority?.name ?? '');
  }, [priority?.id, priority?.name]);

  if (!priority) return (
     <div className="panel-card flex flex-col justify-center items-center text-center z-20 pointer-events-auto min-h-[240px]">
       <p className="text-muted-foreground text-[13px]">Select a body to tune its orbit.</p>
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
      className="panel-card flex flex-col relative overflow-hidden h-full z-20 pointer-events-auto"
      onSubmit={(event) => {
        event.preventDefault();
        saveName();
      }}
    >
      <div className="flex justify-between items-start mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full shadow-[0_0_15px_var(--c)]" style={{ '--c': priority.hue, background: `radial-gradient(circle at 35% 35%, #fff 0%, ${priority.hue} 50%, #000 90%)` } as any} />
          <div>
             <label htmlFor="selected-priority-name" className="sr-only">Planet name</label>
             <input
               id="selected-priority-name"
               value={name}
               onChange={(event) => setName(event.target.value)}
               onBlur={saveName}
               maxLength={40}
               className="w-full min-w-0 max-w-[180px] rounded-md border border-transparent bg-transparent px-1 py-1 -ml-1 font-sans font-semibold text-[15px] leading-none text-white tracking-wide outline-none transition-colors hover:border-white/10 hover:bg-white/5 focus:border-primary/50 focus:bg-white/10"
             />
            <span className="text-[9px] text-primary uppercase tracking-widest font-display font-semibold">
               {getFocusScore(priority) > 75 ? 'High Focus' : 'In Orbit'}
            </span>
          </div>
        </div>
        <button type="button" onClick={onClose} className="text-muted-foreground hover:text-white transition-colors" aria-label="Close panel">
           <X size={16} />
        </button>
      </div>
      
      <div className="flex flex-col gap-5 mt-auto">
         <RangeControl label="Importance" value={priority.importance} color={priority.hue} onChange={(v) => onUpdate('importance', v)} />
         <RangeControl label="Urgency" value={priority.urgency} color={priority.hue} onChange={(v) => onUpdate('urgency', v)} />
         <RangeControl label="Energy / Effort" value={priority.energy} color={priority.hue} onChange={(v) => onUpdate('energy', v)} />
      </div>
      
      <div className="flex items-center gap-3 mt-6">
        <button type="button" onClick={() => { if(window.confirm('Remove this priority?')) onRemove() }} aria-label="Delete priority" className="w-10 h-10 rounded-xl border border-white/10 text-muted-foreground flex items-center justify-center hover:bg-red-500/20 hover:text-red-400 hover:border-red-500/30 transition-colors">
          <Trash2 size={16} />
        </button>
         <button type="submit" className="flex-1 h-10 rounded-xl border border-white/10 bg-white/5 text-[12px] font-medium text-white hover:bg-white/10 transition-colors">
          Save Changes
        </button>
      </div>
       <button
         type="button"
         onClick={onComplete}
         className="mt-3 h-10 w-full rounded-xl border border-emerald-400/30 bg-emerald-400/10 text-[12px] font-semibold text-emerald-200 hover:border-emerald-300/60 hover:bg-emerald-400/20 transition-colors flex items-center justify-center gap-2"
       >
         <Check size={15} /> Complete Task
       </button>
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
            <h2 id="add-priority-title" className="font-display text-xl font-semibold m-0 text-white tracking-wide">New body</h2>
            <p className="text-muted-foreground text-xs mt-1.5">Give the next thing a place in your sky.</p>
          </div>
          <motion.button 
            type="button" 
            aria-label="Close dialog"
            className="w-7 h-7 rounded-full bg-white/5 border border-white/10 text-muted-foreground flex items-center justify-center hover:text-white transition-colors self-start" 
            onClick={onClose} 
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
          >
            <X size={14} />
          </motion.button>
        </div>
        <label className="block text-white/80 text-[11px] uppercase tracking-wider font-semibold">
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
            className="px-5 py-2.5 rounded-full border border-white/10 text-muted-foreground text-xs font-medium hover:bg-white/5 transition-colors" 
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
  const particles = useMemo(() => Array.from({ length: 120 }).map((_, i) => ({
    id: i,
    size: Math.random() * 2 + 0.5,
    left: `${Math.random() * 100}%`,
    top: `${Math.random() * 100}%`,
    dur: Math.random() * 5 + 3,
    delay: Math.random() * -10,
    opacity: Math.random() * 0.6 + 0.1,
  })), []);

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {particles.map((p) => (
        <div
          key={p.id}
          className="particle"
          style={{
            width: p.size,
            height: p.size,
            left: p.left,
            top: p.top,
            '--twinkle-dur': `${p.dur}s`,
            animationDelay: `${p.delay}s`,
            '--max-opacity': p.opacity,
          } as CSSProperties}
        />
      ))}
    </div>
  );
});

function SelectedOrbitRing({ priority }: { priority: Priority }) {
  const urgencySpring = useSpring(priority.urgency, { stiffness: 50, damping: 15 });
  
  useEffect(() => {
    urgencySpring.set(priority.urgency);
  }, [priority.urgency, urgencySpring]);
  
  const size = useTransform(() => `${(24 + (10 - urgencySpring.get()) * 2.8) * 2}%`);
  const sizeSquished = useTransform(() => `${(24 + (10 - urgencySpring.get()) * 2.8) * 2 * 0.82}%`);
  
  return (
    <motion.div
      className="absolute left-1/2 top-1/2 rounded-full pointer-events-none z-0"
      style={{
        x: '-50%',
        y: '-50%',
        width: size,
        height: sizeSquished,
        border: '1.5px dashed var(--borderColor)',
        boxShadow: '0 0 25px var(--borderColor) inset, 0 0 25px var(--borderColor)',
        opacity: 0.4,
        '--borderColor': priority.hue,
      } as any}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 0.4, scale: 1 }}
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
  
  const size = useTransform(() => 35 + importanceSpring.get() * 6);
  
  return (
    <motion.div
      style={{ left: x, top: y, position: 'absolute', x: '-50%', y: '-50%', zIndex: isSelected ? 10 : isUnrelated ? 1 : 2 }}
      initial={{ scale: 0, opacity: 0 }}
      animate={{ 
        scale: isCompleting ? [1, 1.35, 0.15] : 1,
        opacity: isUnrelated ? 0.35 : 1,
        filter: isCompleting
          ? ['brightness(1)', 'brightness(3) drop-shadow(0 0 28px white)', 'brightness(5) blur(2px)']
          : isUnrelated ? 'blur(1px) saturate(0.6)' : 'blur(0px) saturate(1)'
      }}
      exit={{ scale: 0, opacity: 0, filter: 'brightness(4) blur(4px)' }}
      transition={isCompleting ? { duration: 0.85, times: [0, 0.45, 1], ease: 'easeInOut' } : { type: "spring", damping: 20, stiffness: 250 }}
    >
      <motion.div
        className={`orb-wrapper ${isSelected ? 'selected' : ''}`}
        onClick={(e) => { e.stopPropagation(); onSelect(priority.id); }}
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.95 }}
      >
        <div className="orb-badge">{score}</div>
        
        <motion.div
           className="orb-planet"
           style={{
             width: size,
             height: size,
             '--orb-color': priority.hue,
           } as any}
           animate={{ scale: [1, 1.02 + priority.energy * 0.01, 1] }}
           transition={{
              scale: {
                 duration: prefersReducedMotion ? 0 : 8.5 - priority.energy * 0.45,
                 repeat: Infinity,
                 ease: "easeInOut",
                 delay: index * -0.8
              }
           }}
        />
        
        <div className="orb-label">
          <div className="orb-name">{priority.name}</div>
          <div className="orb-sub">FOCUS</div>
        </div>
      </motion.div>
    </motion.div>
  );
}

function GalaxyStage({
  priorities,
  selectedId,
  completingId,
  onSelect,
  onAdd,
  urgencyTrigger,
  mouseX, mouseY,
  prefersReducedMotion
}: {
  priorities: Priority[];
  selectedId: string | null;
  completingId: string | null;
  onSelect: (id: string) => void;
  onAdd: () => void;
  urgencyTrigger: number;
  mouseX: any; mouseY: any;
  prefersReducedMotion: boolean;
}) {
  const springConfig = { damping: 40, stiffness: 80, mass: 1 };
  const orbitX = useSpring(useTransform(mouseX, [-0.5, 0.5], prefersReducedMotion ? [0, 0] : [-15, 15]), springConfig);
  const orbitY = useSpring(useTransform(mouseY, [-0.5, 0.5], prefersReducedMotion ? [0, 0] : [-15, 15]), springConfig);

  const selectedPriority = priorities.find(p => p.id === selectedId);

  return (
    <motion.div 
      className="orbit-stage w-full h-full absolute inset-0 pointer-events-none" 
    >
      <AnimatePresence mode="wait">
        {priorities.length === 0 ? (
          <motion.div 
            key="empty"
            className="absolute inset-0 flex flex-col items-center justify-center text-center z-10 pointer-events-auto"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.4 }}
          >
            <div className="w-32 h-32 border border-dashed border-white/20 rounded-full flex items-center justify-center mb-6 relative">
              <div className="absolute inset-0 rounded-full bg-primary/10 animate-[core-pulse_4s_ease-in-out_infinite]" />
              <div className="w-8 h-8 bg-primary/40 rounded-full shadow-[0_0_20px_var(--primary)]" />
            </div>
            <h2 className="font-display font-semibold text-2xl text-white mb-3">Your sky is open.</h2>
            <p className="text-muted-foreground text-sm max-w-sm leading-relaxed mb-8">
              Nothing is asking for attention yet. Place a priority here and let its orbit take shape.
            </p>
            <motion.button 
              type="button" 
              className="flex items-center gap-2 px-6 py-3 rounded-full bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-colors shadow-[0_4px_20px_rgba(155,91,228,0.4)]"
              onClick={onAdd} 
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <Plus size={16} strokeWidth={2.5} /> Add a priority
            </motion.button>
          </motion.div>
        ) : (
          <div key="galaxy" className="absolute top-[45%] left-1/2 w-[min(100vw,1200px)] h-[min(100vw,1200px)] pointer-events-none" style={{ transform: 'translate(-50%, -50%)' }}>
            <motion.div 
              className="w-full h-full pointer-events-auto relative" 
              onClick={() => onSelect('')} 
              style={{ x: orbitX, y: orbitY }}
            >
              {/* Background dashed rings to form the grid map */}
            {[25, 45, 65, 85].map(r => (
               <div 
                 key={r} 
                 className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-dashed border-white/[0.08] pointer-events-none" 
                 style={{ width: `${r * 2}%`, height: `${r * 2 * 0.7}%` }} 
               />
            ))}
            
            <AnimatePresence>
              {selectedPriority && <SelectedOrbitRing key={selectedPriority.id} priority={selectedPriority} />}
            </AnimatePresence>

            <motion.div 
              className="absolute left-1/2 top-1/2 flex flex-col items-center justify-center z-10 w-[100px] h-[100px] sm:w-[150px] sm:h-[150px]"
              style={{ x: '-50%', y: '-50%' }}
              aria-label="You and now" 
              onClick={(event) => event.stopPropagation()}
              whileHover={{ scale: 1.05 }}
            >
              <AnimatePresence>
                {urgencyTrigger > 0 && (
                  <motion.div
                    key={`pulse-${urgencyTrigger}`}
                    className="absolute inset-0 rounded-full border-2 border-primary z-0"
                    initial={{ scale: 1, opacity: 0.8 }}
                    animate={{ scale: 3.2, opacity: 0 }}
                    transition={{ duration: 1.8, ease: "easeOut" }}
                  />
                )}
              </AnimatePresence>
              <div className="core-glow" />
              <div className="core-body" />
              <div className="core-text">
                <span className="core-title">YOU / NOW</span>
                <span className="core-subtitle">Center of Gravity</span>
              </div>
            </motion.div>
            
            <AnimatePresence>
              {priorities.map((priority, index) => (
                <OrbComponent 
                  key={priority.id}
                  priority={priority}
                  index={index}
                  selectedId={selectedId}
                  isCompleting={completingId === priority.id}
                  onSelect={onSelect}
                  prefersReducedMotion={prefersReducedMotion}
                />
              ))}
            </AnimatePresence>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function Home() {
  const [priorities, setPriorities] = useState<Priority[]>(readPriorities);
  const [selectedId, setSelectedId] = useState<string | null>(() => readPriorities()[0]?.id ?? null);
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isManageOpen, setIsManageOpen] = useState(false);
  const [panelsOpen, setPanelsOpen] = useState(true);
  const [urgencyTrigger, setUrgencyTrigger] = useState(0);
  const [isFormed, setIsFormed] = useState(false);
  
  const { mouseX, mouseY, handleMouseMove, handleMouseLeave } = useParallax();
  const prefersReducedMotion = useMemo(() => 
    typeof window !== 'undefined' ? window.matchMedia('(prefers-reduced-motion: reduce)').matches : false
  , []);

  useEffect(() => {
    const timer = setTimeout(() => setIsFormed(true), 150);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(priorities));
  }, [priorities]);

  useEffect(() => {
    if (selectedId && !priorities.some((priority) => priority.id === selectedId)) setSelectedId(null);
  }, [priorities, selectedId]);

  const selectedPriority = priorities.find((priority) => priority.id === selectedId);
  const topPriorities = useMemo(
    () => [...priorities].sort((a, b) => getFocusScore(b) - getFocusScore(a)).slice(0, 3),
    [priorities],
  );
  
  const strongest = topPriorities[0];
  const insight = strongest
    ? strongest.urgency >= 8
      ? `${strongest.name} is pulling closest to now. Give it one clear next move before the rest of the sky gets louder.`
      : strongest.energy >= 8
        ? `${strongest.name} has high gravity and a high energy cost. Protect a generous, uninterrupted window for it.`
        : `Your clearest signal is ${strongest.name}. It has the strongest blend of importance and urgency in the field.`
    : 'A quiet field is still useful. Add one thing when you are ready to decide what deserves your attention.';

  const selectPriority = (id: string) => {
    setSelectedId(id);
    setPanelsOpen(true);
  };

  const updateSelected = (metric: MetricKey, value: number) => {
    if (!selectedId) return;
    setPriorities((current) => current.map((priority) => {
      if (priority.id === selectedId) {
        if (metric === 'urgency' && priority.urgency !== value) {
          setUrgencyTrigger(prev => prev + 1);
        }
        return { ...priority, [metric]: value };
      }
      return priority;
    }));
  };

  const renamePriority = (id: string, name: string) => {
    setPriorities((current) => current.map((priority) =>
      priority.id === id ? { ...priority, name } : priority
    ));
  };

  const renameSelected = (name: string) => {
    if (selectedId) renamePriority(selectedId, name);
  };

  const removeSelected = () => {
    if (!selectedPriority) return;
    setPriorities((current) => current.filter((priority) => priority.id !== selectedPriority.id));
    setSelectedId(null);
  };

  const completeSelected = () => {
    if (!selectedPriority || completingId) return;
    const completedId = selectedPriority.id;
    setCompletingId(completedId);
    window.setTimeout(() => {
      setPriorities((current) => current.filter((priority) => priority.id !== completedId));
      setSelectedId(null);
      setCompletingId(null);
    }, prefersReducedMotion ? 150 : 850);
  };

  const createPriority = (name: string) => {
    const colors = ['#f04e76', '#3aa2f7', '#f1883b', '#f4c33d', '#9b5be4', '#85d852'];
    const newPriority: Priority = {
      id: `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'priority'}-${Date.now()}`,
      name,
      importance: 5,
      urgency: 5,
      energy: 5,
      hue: colors[priorities.length % colors.length],
    };
    setPriorities((current) => [...current, newPriority]);
    setSelectedId(newPriority.id);
    setIsAddOpen(false);
  };

  const resetGalaxy = () => {
    if (window.confirm('Restore the original priorities?')) {
      setPriorities(seedPriorities);
      setSelectedId(seedPriorities[0].id);
    }
  };

  return (
    <main className="galaxy-app min-h-[100dvh] relative overflow-x-hidden overflow-y-auto lg:overflow-hidden" onMouseMove={handleMouseMove} onMouseLeave={handleMouseLeave}>
      <div className="bg-stars pointer-events-none" />
      <Particles />
      
      <motion.div 
        className="absolute inset-0 pointer-events-none"
        initial={{ opacity: 0, filter: 'blur(3px)' }}
        animate={{ 
          opacity: isFormed ? 1 : 0, 
          filter: isFormed ? 'blur(0px)' : 'blur(3px)' 
        }}
        transition={{ duration: 0.65, ease: "easeOut" }}
      >
        <div className="absolute inset-0 lg:fixed lg:inset-0 h-[65vh] lg:h-auto min-h-[480px]">
           <GalaxyStage 
             priorities={priorities} 
             selectedId={selectedId} 
              completingId={completingId}
              onSelect={selectPriority}
             onAdd={() => setIsAddOpen(true)}
             urgencyTrigger={urgencyTrigger}
             prefersReducedMotion={prefersReducedMotion}
             mouseX={mouseX}
             mouseY={mouseY}
           />
        </div>
      </motion.div>
      
      <header className="absolute top-0 left-0 right-0 p-6 lg:p-8 flex justify-between items-start z-30 pointer-events-none">
         <div className="flex flex-col gap-1 pointer-events-auto">
            <div className="flex items-center gap-2">
               <AppLogo />
            </div>
            <p className="text-[13px] text-muted-foreground mt-1.5 tracking-wide hidden sm:block ml-11">Turn your priorities into clarity.</p>
         </div>
         
         <div className="flex items-center gap-4 lg:gap-6 pointer-events-auto">
            <div className="hidden lg:flex gap-1 p-1 rounded-full bg-white/5 border border-white/10 backdrop-blur-md">
               <span className="px-4 py-1.5 rounded-full bg-white/10 text-[11px] uppercase tracking-wider font-semibold text-white cursor-default">Today</span>
               <span className="px-4 py-1.5 rounded-full text-[11px] uppercase tracking-wider font-semibold text-white/40 cursor-default hover:text-white/70 transition-colors">This Week</span>
               <span className="px-4 py-1.5 rounded-full text-[11px] uppercase tracking-wider font-semibold text-white/40 cursor-default hover:text-white/70 transition-colors">This Month</span>
            </div>
            
            <button onClick={() => setIsAddOpen(true)} aria-label="Add priority" className="flex items-center gap-2 px-4 py-2 rounded-full border border-primary/50 bg-primary/10 text-primary hover:bg-primary/20 hover:border-primary transition-all text-xs lg:text-sm font-semibold backdrop-blur-md shadow-[0_0_20px_rgba(155,91,228,0.15)]">
               <Plus size={16} strokeWidth={2.5} /> <span className="hidden sm:inline">Add Priority</span>
            </button>

             <FocusAudio />

             <button onClick={() => setIsManageOpen(true)} aria-label="Manage priorities" className="flex items-center gap-2 px-4 py-2 rounded-full border border-white/10 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white transition-all text-xs font-semibold backdrop-blur-md">
                <ListChecks size={16} /> <span className="hidden md:inline">Manage</span>
             </button>
            
            <button onClick={resetGalaxy} className="w-10 h-10 rounded-full border border-white/10 flex items-center justify-center hover:bg-white/10 text-white/70 hover:text-white transition-all backdrop-blur-md" aria-label="Reset galaxy">
               <RotateCcw size={15} />
            </button>
         </div>
      </header>
      
      {/* Floating text elements */}
      <div className="absolute top-[28%] left-10 text-muted-foreground/60 text-[13px] max-w-[180px] z-10 leading-relaxed tracking-wide hidden xl:block pointer-events-none">
         "A calmer mind<br/>creates a brighter<br/>future."
         <div className="w-6 h-[1px] bg-white/10 mt-5" />
      </div>
      
      <div className="absolute top-[30%] right-10 text-muted-foreground/60 text-[13px] max-w-[160px] z-10 leading-relaxed tracking-wide hidden xl:block text-right pointer-events-none">
         Different priorities<br/>Same universe<br/>Your focus.
         <div className="w-6 h-[1px] bg-white/10 mt-5 ml-auto" />
      </div>

      <div className="absolute bottom-28 left-10 text-muted-foreground/60 text-[12px] max-w-[160px] z-10 leading-relaxed tracking-wide hidden xl:block pointer-events-none">
         <div className="w-6 h-[1px] bg-white/10 mb-4" />
         Balance today<br/>A brighter tomorrow.
      </div>

      <div className="absolute bottom-28 right-10 text-muted-foreground/60 text-[12px] z-10 hidden xl:block pointer-events-none tracking-wide">
         "Focus is freedom."
         <div className="w-6 h-[1px] bg-white/10 mt-4 ml-auto" />
      </div>
      
      {/* Bottom panels wrapper */}
      <motion.div
        className="relative lg:absolute lg:-bottom-2 lg:left-8 lg:right-8 z-20 mt-[60vh] lg:mt-0 p-4 lg:p-0 pointer-events-none"
        animate={{ y: panelsOpen ? 0 : 245 }}
        transition={{ type: 'spring', stiffness: 180, damping: 24 }}
      >
        <button
          type="button"
          onClick={() => setPanelsOpen((open) => !open)}
          className="hidden lg:flex absolute left-1/2 -top-9 -translate-x-1/2 z-30 h-8 items-center gap-2 rounded-full border border-white/15 bg-[#110d19]/90 px-4 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/65 backdrop-blur-xl hover:border-primary/40 hover:text-white pointer-events-auto"
          aria-expanded={panelsOpen}
          aria-label={panelsOpen ? 'Lower insight cards' : 'Raise insight cards'}
        >
          {panelsOpen ? <ChevronDown size={13} /> : <ChevronUp size={13} />}
          {panelsOpen ? 'Focus on galaxy' : 'Show insights'}
        </button>
        <motion.div 
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 lg:gap-8 max-w-[1200px] mx-auto pointer-events-auto"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: isFormed ? (panelsOpen ? 1 : 0.35) : 0, y: isFormed ? 0 : 30 }}
          transition={{ duration: 1, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
        >
           {priorities.length > 0 && <FocusSignalPanel topPriorities={topPriorities} onSelect={selectPriority} onRename={renamePriority} />}
           {priorities.length > 0 && <InsightPanel insight={insight} priority={selectedPriority} />}
           {priorities.length > 0 && <SelectedPanel priority={selectedPriority} onUpdate={updateSelected} onRename={renameSelected} onComplete={completeSelected} onRemove={removeSelected} onClose={() => setSelectedId(null)} />}
        </motion.div>
      </motion.div>
      
      <AnimatePresence>
        {isAddOpen && <AddPriorityDialog onClose={() => setIsAddOpen(false)} onCreate={createPriority} />}
        {isManageOpen && (
          <ManageTasksDialog
            priorities={priorities}
            onClose={() => setIsManageOpen(false)}
            onSelect={selectPriority}
            onRename={renamePriority}
          />
        )}
      </AnimatePresence>
    </main>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter>
          <Switch>
            <Route path="/" component={Home} />
            <Route component={NotFound} />
          </Switch>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}