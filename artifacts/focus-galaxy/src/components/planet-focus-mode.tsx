import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';
import { motion, useAnimationControls } from 'framer-motion';
import { PlanetContentComposer, type PlanetEntry, type PlanetEntryType } from '@/components/planet-content-composer';

export type PlanetFocusPriority = {
  id: string;
  name: string;
  importance: number;
  urgency: number;
  energy: number;
  hue: string;
  entries?: PlanetEntry[];
};

export type PlanetFocusOrigin = {
  left: number;
  top: number;
  width: number;
  height: number;
};

type Metric = {
  label: string;
  value: number;
};

type PlanetFocusModeProps = {
  priority: PlanetFocusPriority;
  score: number;
  origin: PlanetFocusOrigin | null;
  prefersReducedMotion: boolean;
  onCreateEntry: (type: PlanetEntryType, text: string) => void;
  onSaveEntry: (id: string, text: string) => void;
  onToggleTask: (id: string) => void;
  onDeleteEntry: (id: string) => void;
  onClose: () => void;
  storageWarning?: ReactNode;
};

const focusTransition = {
  duration: 0.72,
  ease: [0.22, 1, 0.36, 1] as [number, number, number, number],
};

export function PlanetFocusMode({
  priority,
  score,
  origin,
  prefersReducedMotion,
  onCreateEntry,
  onSaveEntry,
  onToggleTask,
  onDeleteEntry,
  onClose,
  storageWarning,
}: PlanetFocusModeProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const exitPromptRef = useRef<HTMLElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);
  const lastContentFocusRef = useRef<HTMLElement | null>(null);
  const returnFlight = useRef({ x: 0, y: 0, scale: 1 });
  const closing = useRef(false);
  const [hasUnsavedContent, setHasUnsavedContent] = useState(false);
  const [showExitPrompt, setShowExitPrompt] = useState(false);
  const hasUnsavedContentRef = useRef(false);
  const showExitPromptRef = useRef(false);
  hasUnsavedContentRef.current = hasUnsavedContent;
  showExitPromptRef.current = showExitPrompt;
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const sceneAnimation = useAnimationControls();
  const planetAnimation = useAnimationControls();

  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    const hero = heroRef.current;
    if (!dialog || !hero) return;

    const heroRect = hero.getBoundingClientRect();
    const sourceWidth = Math.max(origin?.width ?? heroRect.width, 1);
    const sourceHeight = Math.max(origin?.height ?? heroRect.height, 1);
    const startScale = origin
      ? Math.min(sourceWidth / heroRect.width, sourceHeight / heroRect.height)
      : 0.82;
    const startX = origin
      ? origin.left + sourceWidth / 2 - (heroRect.left + heroRect.width / 2)
      : 0;
    const startY = origin
      ? origin.top + sourceHeight / 2 - (heroRect.top + heroRect.height / 2)
      : 0;

    returnFlight.current = { x: startX, y: startY, scale: startScale };
    const firstFrame = prefersReducedMotion
      ? { x: 0, y: 0, scale: 1, opacity: 1 }
      : { x: startX, y: startY, scale: startScale, opacity: 0.96 };

    sceneAnimation.set({ opacity: 0 });
    planetAnimation.set(firstFrame);
    dialog.querySelector<HTMLElement>('button')?.focus({ preventScroll: true });

    void sceneAnimation.start({
      opacity: 1,
      transition: { duration: prefersReducedMotion ? 0.12 : 0.56, ease: 'easeOut' },
    });
    void planetAnimation.start({
      x: 0,
      y: 0,
      scale: 1,
      opacity: 1,
      transition: prefersReducedMotion ? { duration: 0.12 } : focusTransition,
    });
  }, [origin, prefersReducedMotion, planetAnimation, sceneAnimation]);

  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const getFocusable = () => Array.from(dialog.querySelectorAll<HTMLElement>(
      'button:not([disabled]), textarea:not([disabled]), input:not([disabled]), a[href], [tabindex]:not([tabindex="-1"]):not([disabled])',
    )).filter((element) => element.getClientRects().length > 0);

    const handleKeyDown = (event: KeyboardEvent) => {
      // A storage-conflict reload confirmation owns focus until it closes.
      if (document.querySelector('[role="alertdialog"]')) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        if (showExitPromptRef.current) setShowExitPrompt(false);
        else void requestClose();
        return;
      }
      if (event.key !== 'Tab') return;

      const focusable = getFocusable();
      if (!focusable.length) {
        event.preventDefault();
        dialog.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!dialog.contains(document.activeElement)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  useEffect(() => {
    if (!hasUnsavedContent) setShowExitPrompt(false);
  }, [hasUnsavedContent]);

  useLayoutEffect(() => {
    if (showExitPrompt) {
      exitPromptRef.current?.querySelector<HTMLElement>('button')?.focus({ preventScroll: true });
      return;
    }

    if (hasUnsavedContentRef.current) {
      const target = lastContentFocusRef.current;
      if (target?.isConnected) target.focus({ preventScroll: true });
    }
  }, [showExitPrompt]);

  const requestClose = async (discardUnsaved = false) => {
    if (closing.current) return;
    if (hasUnsavedContentRef.current && !discardUnsaved) {
      setShowExitPrompt(true);
      return;
    }
    closing.current = true;
    const returnToOrigin = origin && !prefersReducedMotion
      ? { ...returnFlight.current, opacity: 0.94 }
      : { x: 0, y: 0, scale: prefersReducedMotion ? 1 : 0.88, opacity: 0 };

    await Promise.all([
      sceneAnimation.start({ opacity: 0, transition: { duration: prefersReducedMotion ? 0.1 : 0.34, ease: 'easeIn' } }),
      planetAnimation.start({
        ...returnToOrigin,
        transition: prefersReducedMotion ? { duration: 0.1 } : { duration: 0.4, ease: [0.4, 0, 1, 1] },
      }),
    ]);
    closeRef.current();
  };

  const metrics: Metric[] = [
    { label: 'Importance', value: priority.importance },
    { label: 'Urgency', value: priority.urgency },
    { label: 'Energy / Effort', value: priority.energy },
  ];

  return (
    <motion.div
      ref={dialogRef}
      className="planet-focus-overlay"
      style={{ '--planet-focus-hue': priority.hue } as CSSProperties}
      animate={sceneAnimation}
      initial={{ opacity: 0 }}
      role="dialog"
      tabIndex={-1}
      aria-modal="true"
      aria-labelledby="planet-focus-title"
      aria-describedby="planet-focus-score"
      data-testid="planet-focus-mode"
      onFocusCapture={(event) => {
        const target = event.target;
        if (
          target instanceof HTMLElement
          && target.closest('[data-planet-composer]')
          && (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)
        ) {
          lastContentFocusRef.current = target;
        }
      }}
    >
      <div className="planet-focus-nebula" aria-hidden="true" />
      <div className="planet-focus-topbar">
        <button type="button" className="planet-focus-back" aria-label="Return to galaxy" onClick={() => void requestClose()}>
          <ArrowLeft size={17} aria-hidden="true" />
          <span>Back to galaxy</span>
        </button>
        <span className="planet-focus-location"><i aria-hidden="true" /> PLANET FOCUS</span>
      </div>

      {showExitPrompt && (
        <aside className="planet-focus-exit-prompt" ref={exitPromptRef} role="alert" aria-live="assertive">
          <p>You have unsaved content. Save it or discard it before returning to the galaxy.</p>
          <div>
            <button type="button" onClick={() => setShowExitPrompt(false)}>Keep editing</button>
            <button type="button" className="planet-focus-discard" onClick={() => void requestClose(true)}>Discard and leave</button>
          </div>
        </aside>
      )}

      <div className="planet-focus-layout">
        <section className="planet-focus-hero" aria-label={`${priority.name} planet`}>
          <div className="planet-focus-starfield" aria-hidden="true" />
          <div className="planet-focus-orbit-glow" aria-hidden="true" />
          <div className="planet-focus-orb-target" ref={heroRef}>
            <motion.div className="planet-focus-orb-flight" animate={planetAnimation}>
              <div className="planet-focus-orb-art selected" style={{ '--orb-color': priority.hue } as CSSProperties}>
                {(priority.energy >= 7 || priority.id === 'signalboard' || priority.id === 'job-search') && (
                  <div className="orb-planet-ring" aria-hidden="true" />
                )}
                <div className="orb-planet" />
              </div>
            </motion.div>
          </div>
          <span className="planet-focus-orbit-caption"><i aria-hidden="true" /> IN YOUR ORBIT</span>
        </section>

        <div className="planet-focus-content">
          <header className="planet-focus-heading">
            <p className="planet-focus-eyebrow">A PRIORITY IN FOCUS</p>
            <h1 id="planet-focus-title">{priority.name}</h1>
            <div className="planet-focus-score" id="planet-focus-score">
              <strong>{score}</strong>
              <span>FOCUS SCORE</span>
              <div role="img" aria-label={`Focus score ${score} out of 100`}>
                <i style={{ width: `${score}%` }} />
              </div>
            </div>
          </header>

          <section className="planet-focus-signals" aria-label="Priority signals">
            {metrics.map(({ label, value }) => (
              <div className="planet-focus-metric" key={label}>
                <div className="planet-focus-metric-line">
                  <span>{label}</span>
                  <strong>{value}<small> / 10</small></strong>
                </div>
                <div className="planet-focus-metric-track" role="img" aria-label={`${label}: ${value} out of 10`}>
                  <i style={{ width: `${value * 10}%` }} />
                </div>
              </div>
            ))}
          </section>

          <PlanetContentComposer
            planetId={priority.id}
            planetName={priority.name}
            entries={priority.entries ?? []}
            onCreateEntry={onCreateEntry}
            onSaveEntry={onSaveEntry}
            onToggleTask={onToggleTask}
            onDeleteEntry={onDeleteEntry}
            onDraftStateChange={setHasUnsavedContent}
          />
        </div>
      </div>
      {storageWarning}
    </motion.div>
  );
}
