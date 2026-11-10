import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { ArrowRight, RotateCcw, X } from 'lucide-react';
import { galaxyTemplates, templateCounts, type GalaxyTemplate } from '@/lib/galaxy-templates';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

function UniversePreview({ template, miniature = false }: { template: GalaxyTemplate; miniature?: boolean }) {
  const gradientId = useId().replaceAll(':', '');
  const planets = template.priorities;
  return (
    <svg className={miniature ? 'genesis-miniature' : 'genesis-universe'} viewBox="0 0 480 280" aria-hidden="true">
      <defs>
        <radialGradient id={`${gradientId}-sun`} cx="35%" cy="30%"><stop stopColor="#fff7df" /><stop offset=".45" stopColor="#ffcc76" /><stop offset="1" stopColor="#c96b28" /></radialGradient>
        {planets.map((p, i) => <radialGradient key={i} id={`${gradientId}-${i}`} cx="30%" cy="25%"><stop stopColor="#fff" /><stop offset=".3" stopColor={p.hue} /><stop offset="1" stopColor="#141020" /></radialGradient>)}
      </defs>
      <g fill="currentColor" opacity=".3">{[[30,50],[440,40],[76,225],[404,238],[180,26],[335,252],[392,92],[120,80]].map(([cx,cy],i)=><circle key={i} cx={cx} cy={cy} r={i%3===0?1.5:1} />)}</g>
      {planets.length === 0 && <ellipse cx="240" cy="140" rx="140" ry="65" fill="none" stroke="currentColor" strokeDasharray="2 9" opacity=".15" />}
      {planets.map((p, i) => {
        const radius = 65 + (10 - p.urgency) * 14;
        const angle = -Math.PI / 3 + i * Math.PI * 2 / planets.length;
        const x = 240 + Math.cos(angle) * radius;
        const y = 140 + Math.sin(angle) * radius * .52;
        const size = 8 + p.importance * 1.5;
        const labelY = y + (Math.sin(angle) < 0 ? -size-20 : size+18);
        const tasks = (p.entries ?? []).filter(e=>e.type==='task');
        const completed = tasks.filter(e=>e.completed).length;
        return <g key={i}>
          <ellipse cx="240" cy="140" rx={radius} ry={radius*.52} fill="none" stroke={p.hue} strokeOpacity=".25" />
          <circle cx={x} cy={y} r={size+5} fill={p.hue} opacity=".08" />
          {p.energy>=7 && <ellipse cx={x} cy={y} rx={size*1.6} ry={size*.4} fill="none" stroke={p.hue} strokeOpacity=".65" transform={`rotate(-25 ${x} ${y})`} />}
          <circle cx={x} cy={y} r={size} fill={`url(#${gradientId}-${i})`} />
          {!miniature && <>
            {(p.entries ?? []).map((entry,j)=><circle key={j} cx={x+Math.cos(j*2.2)*(size+10)} cy={y+Math.sin(j*2.2)*(size+10)} r={entry.type==='task'?2.5:1.6} fill={entry.type==='task'&&entry.completed?'#9cddbc':p.hue} />)}
            <text className="genesis-planet-label" x={x} y={labelY} textAnchor="middle" fill="#f6efff" fontSize="10" fontWeight="600">{p.name}</text>
            {tasks.length>0 && <text className="genesis-planet-label" x={x} y={labelY+12} textAnchor="middle" fill="#c0b6d0" fontSize="8">{completed}/{tasks.length} tasks complete</text>}
          </>}
        </g>;
      })}
      <circle cx="240" cy="140" r="36" fill="#ffc279" opacity=".05" />
      <circle cx="240" cy="140" r="27" fill="#ffc279" opacity=".08" />
      <circle cx="240" cy="140" r="20" fill={`url(#${gradientId}-sun)`} />
      {!miniature && <text x="240" y="143" textAnchor="middle" fill="#48240b" fontSize="7" fontWeight="800">YOU / NOW</text>}
    </svg>
  );
}

export function GalaxyGenesis({ onClose, onApply, onRestore, hasContent, backupAvailable, canApply, storageWarning }: {
  onClose: () => void;
  onApply: (template: GalaxyTemplate, signal: AbortSignal) => Promise<boolean>;
  onRestore: (signal: AbortSignal) => Promise<boolean>;
  hasContent: boolean;
  backupAvailable: boolean;
  canApply: boolean;
  storageWarning: ReactNode;
}) {
  const [selected, setSelected] = useState(galaxyTemplates[0]);
  const [confirmation, setConfirmation] = useState<'apply' | 'restore' | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const operation = useRef<AbortController | null>(null);
  const opener = useRef(document.activeElement instanceof HTMLElement ? document.activeElement : null);
  useEffect(() => () => operation.current?.abort(), []);
  const counts = templateCounts(selected);

  const apply = async (restore = false) => {
    if (operation.current || !canApply) return;
    const controller = new AbortController();
    operation.current = controller;
    setBusy(true);
    setFailed(false);
    const success = await (restore ? onRestore(controller.signal) : onApply(selected, controller.signal));
    if (!controller.signal.aborted && !success) { setFailed(true); setBusy(false); operation.current = null; }
  };

  return <Dialog.Root open onOpenChange={open=>{if(!open)onClose();}}>
    <Dialog.Portal>
      <Dialog.Overlay className="genesis-overlay" />
      <Dialog.Content className="genesis-portal" data-testid="galaxy-genesis" aria-describedby="genesis-description"
        onCloseAutoFocus={event=>{
          event.preventDefault();
          requestAnimationFrame(()=>{
            if (document.querySelector('[role="dialog"]')) return;
            const targets = [
              opener.current,
              opener.current?.closest('.header-utilities') ? document.getElementById('mobile-galaxy-controls-trigger') : null,
              document.querySelector<HTMLElement>('.core-container'),
            ];
            targets.find(target=>target?.isConnected && target.getClientRects().length > 0 && getComputedStyle(target).visibility === 'visible')?.focus({preventScroll:true});
          });
        }}>
        <header className="genesis-heading">
          <div><Dialog.Title>Galaxy Genesis</Dialog.Title><Dialog.Description id="genesis-description">A quiet beginning. A universe of possibilities.</Dialog.Description></div>
          <Dialog.Close className="genesis-close" aria-label="Close Galaxy Genesis"><X size={20} /></Dialog.Close>
        </header>
        <div className="genesis-body">
          <div className="genesis-choices" role="group" aria-label="Choose a galaxy to preview">
            {galaxyTemplates.map(template=>{
              const count=templateCounts(template);
              return <button key={template.id} type="button" className="genesis-choice" data-template={template.id} aria-pressed={selected.id===template.id}
                disabled={busy} style={{'--template-accent':template.accent} as CSSProperties} onClick={()=>{setSelected(template);setFailed(false);}}>
                <UniversePreview template={template} miniature />
                <span className="genesis-choice-copy"><strong>{template.name}</strong><span>{template.purpose}</span><small>{count.priorities} priorities · {count.tasks} tasks · {count.notes} notes</small></span>
                {template.id==='blank' && <span className="genesis-default">Default</span>}
              </button>;
            })}
          </div>
          <section className="genesis-stage" style={{'--template-accent':selected.accent} as CSSProperties} aria-label="Template preview">
            <div className="genesis-stage-title"><h3>{selected.name}</h3><p>{selected.description}</p></div>
            <div className="genesis-preview" key={selected.id}><UniversePreview template={selected} /></div>
            {selected.priorities.length>0 && <ul className="genesis-priority-names">{selected.priorities.map(p=><li key={p.name}>{p.name}</li>)}</ul>}
            <div className="genesis-counts" aria-live="polite">
              <span><strong>{counts.priorities}</strong> priorities</span><span><strong>{counts.tasks}</strong> tasks</span><span><strong>{counts.notes}</strong> notes</span>
            </div>
            <p className="genesis-hint">{counts.priorities ? 'Open a planet to discover its tasks and notes. Everything is yours to change.' : 'Just you, here and now. Add your first priority whenever you’re ready.'}</p>
          </section>
        </div>
        <footer className="genesis-footer">
          <div className="genesis-footer-copy">
            <p>{hasContent ? 'Preview freely. Your galaxy stays untouched until you confirm.' : 'Choose a starting point. Make it your own.'}</p>
            {backupAvailable && <button type="button" className="genesis-restore" disabled={busy||!canApply} onClick={()=>setConfirmation('restore')}><RotateCcw size={13} /> Restore previous galaxy</button>}
          </div>
          <button type="button" className="genesis-apply" disabled={busy||!canApply} onClick={()=>hasContent?setConfirmation('apply'):void apply()}>
            {busy?'Creating your universe…':selected.id==='blank'?'Begin with Blank Universe':`Create ${selected.name}`}<ArrowRight size={16} />
          </button>
          {failed && <p className="genesis-error" role="alert">Your galaxy was not changed. Saving or the recovery backup failed, or another tab has newer work. Check saving details before trying again.</p>}
          {!canApply && !busy && <p className="genesis-saving" role="status">Preview is available. Creation needs a safely saved galaxy; resolve any saving warning first.</p>}
          {storageWarning}
        </footer>
        <AlertDialog open={confirmation!==null} onOpenChange={open=>{if(!open)setConfirmation(null);}}>
          <AlertDialogContent className="focus-confirm-content">
            <AlertDialogHeader>
              <AlertDialogTitle>{confirmation==='restore'?'Restore your previous galaxy?':`Replace your galaxy with ${selected.name}?`}</AlertDialogTitle>
              <AlertDialogDescription>{hasContent ? 'This replaces all current priorities, tasks, and notes. A local recovery copy of this galaxy must be saved before replacement. You can restore it here, even after refreshing. Only the most recent replaced galaxy is kept.' : 'This brings back the most recently replaced galaxy, including its tasks and notes.'}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="genesis-confirm-cancel focus-confirm-cancel">Cancel</AlertDialogCancel>
              <AlertDialogAction className="genesis-confirm-apply focus-confirm-destructive" disabled={!canApply||busy} onClick={()=>void apply(confirmation==='restore')}>
                {confirmation==='restore'?'Restore galaxy':'Back up & replace'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}
