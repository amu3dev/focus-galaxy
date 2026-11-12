import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Check, ChevronLeft, ChevronRight, Gem, ListTodo, Pause, Play, X } from 'lucide-react';
import { motion, useMotionValue, useTransform, type MotionValue } from 'framer-motion';
import type { PlanetEntry } from './planet-content-composer';
import { CelestialObject } from './celestial-object';
import { CelestialAppearancePicker } from './cosmic-appearance-picker';
import type { CelestialAppearance } from '@/lib/cosmic-appearance';

const GROUP_SIZE = 6;

function OrbitalObject({ entry, index, count, phase, size, selected, onSelect, onHover, onFocusChange }: {
  entry: PlanetEntry; index: number; count: number; phase: MotionValue<number>; size: MotionValue<number>;
  selected: boolean; onSelect: () => void; onHover: (active: boolean) => void; onFocusChange: (active: boolean) => void;
}) {
  const position = useTransform(() => {
    const ring = index % 3;
    // ponytail: six phase-spaced targets share one clock; browse groups instead of packing dense orbits.
    const angle = phase.get() + index * Math.PI * 2 / count + 0.035 * Math.sin(phase.get() * 2 + index);
    const radius = Math.max(0, size.get() / 2 - 26) * (0.68 + ring * 0.16);
    const tilt = -0.16 + ring * 0.05;
    const x = Math.cos(angle) * radius, y = Math.sin(angle) * radius * 0.74;
    return { x: x * Math.cos(tilt) - y * Math.sin(tilt) - 22,
      y: x * Math.sin(tilt) + y * Math.cos(tilt) - 22, depth: 0.9 + Math.sin(angle) * 0.1 };
  });
  const x = useTransform(position, p => p.x);
  const y = useTransform(position, p => p.y);
  const scale = useTransform(position, p => p.depth);
  // Tiny attitude changes reuse the orbital clock, including all pause safeguards.
  const rotate = useTransform(phase, value =>
    entry.appearance === 'satellite' || entry.appearance === 'explorer-probe' || entry.appearance === 'ringed-moon'
      ? Math.sin(value * 2 + index) * 8 : 0);
  const completed = entry.type === 'task' && entry.completed;
  return (
    <motion.button type="button" className="planet-orbit-object" style={{ x, y }}
      data-entry-id={entry.id} data-kind={entry.type} data-completed={completed}
      aria-label={`${entry.type === 'note' ? 'Read note' : completed ? 'View completed task' : 'View task'}: ${entry.text}`}
      aria-pressed={selected} aria-controls={selected ? 'planet-orbit-preview' : undefined} onClick={onSelect}
      onPointerEnter={e => { if (e.pointerType === 'mouse') onHover(true); }}
      onPointerLeave={e => { if (e.pointerType === 'mouse') onHover(false); }}
      onFocus={() => onFocusChange(true)} onBlur={() => onFocusChange(false)}>
      <motion.span className="planet-orbit-body" style={{ scale, rotate }} aria-hidden="true">
        <CelestialObject type={entry.type} appearance={entry.appearance} />
        {completed && <Check className="planet-orbit-complete" size={14} strokeWidth={3} />}
      </motion.span>
      <span className="planet-orbit-label" aria-hidden="true">{entry.text}</span>
    </motion.button>
  );
}

export function PlanetOrbitalSystem({ entries, prefersReducedMotion, onToggleTask, onRevealEntry, onSaveAppearance, children }: {
  entries: PlanetEntry[]; prefersReducedMotion: boolean; onToggleTask: (id: string) => void;
  onRevealEntry: (id: string) => void; children: ReactNode;
  onSaveAppearance: (id: string, appearance: CelestialAppearance) => void;
}) {
  const stageRef = useRef<HTMLDivElement>(null);
  const phase = useMotionValue(0);
  const size = useMotionValue(0);
  const [page, setPage] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [manualPause, setManualPause] = useState(false);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);
  const [touching, setTouching] = useState(false);
  const [inView, setInView] = useState(true);
  const [documentVisible, setDocumentVisible] = useState(true);
  const pages = Math.max(1, Math.ceil(entries.length / GROUP_SIZE));
  const currentPage = Math.min(page, pages - 1);
  const visibleEntries = entries.slice(currentPage * GROUP_SIZE, (currentPage + 1) * GROUP_SIZE);
  const hovered = visibleEntries.some(entry => entry.id === hoveredId);
  const selected = entries.find(entry => entry.id === selectedId);
  const paused = prefersReducedMotion || manualPause || hovered || focused || touching || Boolean(selected) || !inView || !documentVisible;

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const resize = new ResizeObserver(() => size.set(stage.clientWidth));
    const visibility = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting));
    const releasePointer = () => setTouching(false);
    const syncVisibility = () => { setDocumentVisible(!document.hidden); releasePointer(); };
    size.set(stage.clientWidth);
    resize.observe(stage);
    visibility.observe(stage);
    syncVisibility();
    document.addEventListener('visibilitychange', syncVisibility);
    window.addEventListener('pointerup', releasePointer);
    window.addEventListener('pointercancel', releasePointer);
    window.addEventListener('blur', releasePointer);
    return () => {
      resize.disconnect(); visibility.disconnect(); document.removeEventListener('visibilitychange', syncVisibility);
      window.removeEventListener('pointerup', releasePointer); window.removeEventListener('pointercancel', releasePointer);
      window.removeEventListener('blur', releasePointer);
    };
  }, [size]);

  useEffect(() => {
    if (paused || !entries.length) return;
    let last = performance.now(), frame = 0;
    const tick = (now: number) => {
      phase.set(phase.get() + Math.min((now - last) / 1000, 0.064) * Math.PI * 2 / 64);
      last = now;
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [paused, entries.length, phase]);

  const changePage = (next: number) => {
    setPage(next);
    setSelectedId(null);
    setHoveredId(null);
    setFocused(false);
  };
  const closePreview = () => {
    setSelectedId(null);
    stageRef.current?.querySelector<HTMLButtonElement>('[aria-pressed="true"]')?.focus({ preventScroll: true });
  };

  return (
    <div className="planet-orbital-system" data-paused={paused}>
      <div className="planet-orbital-stage" ref={stageRef}
        onPointerDown={() => setTouching(true)} onPointerUp={() => setTouching(false)}
        onPointerCancel={() => setTouching(false)} onLostPointerCapture={() => setTouching(false)}>
        {[0, 1, 2].map(ring => <div key={ring} className="planet-orbit-path" aria-hidden="true"
          style={{ width: `calc((100% - 52px) * ${0.68 + ring * 0.16})`, rotate: `${(-0.16 + ring * 0.05) * 180 / Math.PI}deg` }} />)}
        {children}
        {visibleEntries.map((entry, index) => <OrbitalObject key={entry.id} entry={entry} index={index}
          count={visibleEntries.length} phase={phase} size={size} selected={selectedId === entry.id}
          onSelect={() => setSelectedId(entry.id)} onHover={active => setHoveredId(active ? entry.id : null)} onFocusChange={setFocused} />)}
      </div>
      <div className="planet-orbit-toolbar">
        <span className="planet-orbit-legend"><ListTodo size={13} aria-hidden="true" /> Tasks <Gem size={13} aria-hidden="true" /> Notes</span>
        {!prefersReducedMotion && <button type="button"
          aria-label={manualPause ? 'Resume orbital motion' : 'Pause orbital motion'} aria-pressed={manualPause}
          onClick={() => setManualPause(!manualPause)}>
          {manualPause ? <Play size={13} aria-hidden="true" /> : <Pause size={13} aria-hidden="true" />}
          {manualPause ? 'Resume' : 'Pause'}
        </button>}
        {prefersReducedMotion && <span>Motion reduced</span>}
      </div>
      {pages > 1 && <nav className="planet-orbit-pages" aria-label="Browse orbital objects">
        <button type="button" aria-label="Previous orbital objects" disabled={currentPage === 0} onClick={() => changePage(currentPage - 1)}><ChevronLeft size={16} aria-hidden="true" /></button>
        <span role="status">{currentPage * GROUP_SIZE + 1}–{Math.min((currentPage + 1) * GROUP_SIZE, entries.length)} of {entries.length}</span>
        <button type="button" aria-label="Next orbital objects" disabled={currentPage === pages - 1} onClick={() => changePage(currentPage + 1)}><ChevronRight size={16} aria-hidden="true" /></button>
      </nav>}
      {selected ? <section id="planet-orbit-preview" className="planet-orbit-preview" data-entry-id={selected.id} aria-label={`Selected ${selected.type}`}>
        <div className="planet-orbit-preview-heading">
          <span>{selected.type === 'note' ? 'Note' : selected.completed ? 'Completed task' : 'Task'} · orbit paused</span>
          <button type="button" aria-label="Close orbital preview" onClick={closePreview}><X size={16} aria-hidden="true" /></button>
        </div>
        <p tabIndex={0}>{selected.text}</p>
        <div className="planet-orbit-preview-actions">
          {selected.type === 'task' && <button type="button" className="planet-orbit-task-toggle" aria-pressed={selected.completed} onClick={() => onToggleTask(selected.id)}>
            <Check size={14} aria-hidden="true" />{selected.completed ? 'Reopen task' : 'Complete task'}
          </button>}
          <button type="button" className="planet-orbit-open-editor" onClick={() => onRevealEntry(selected.id)}>Open in content list</button>
          <CelestialAppearancePicker key={selected.id} type={selected.type} appearance={selected.appearance}
            onSave={appearance => onSaveAppearance(selected.id, appearance)} />
        </div>
      </section> : <p className="planet-orbit-hint">{entries.length ? 'Select an object to explore or customize. Motion pauses while you interact.' : 'Add a task or note below to establish its orbit.'}</p>}
    </div>
  );
}
