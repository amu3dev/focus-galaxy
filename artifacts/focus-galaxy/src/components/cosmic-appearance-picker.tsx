import { useState, type CSSProperties, type ReactNode } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Check, Palette, Shapes, X } from 'lucide-react';
import { CelestialObject } from '@/components/celestial-object';
import {
  noteAppearances,
  planetColors,
  resolveAppearance,
  taskAppearances,
  type CelestialAppearance,
} from '@/lib/cosmic-appearance';
import './cosmic-appearance.css';

function CosmicDialog({ trigger, title, description, testId, saveLabel, onOpen, onSave, children }: {
  trigger: ReactNode;
  title: string;
  description: string;
  testId: string;
  saveLabel: string;
  onOpen: () => void;
  onSave: () => void;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog.Root open={open} onOpenChange={next => {
      if (next) onOpen();
      setOpen(next);
    }}>
      <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="cosmic-dialog-overlay" />
        <Dialog.Content className="cosmic-dialog" data-cosmic-dialog="" data-testid={testId}>
          <header className="cosmic-dialog-header">
            <div>
              <Dialog.Title className="cosmic-dialog-title">{title}</Dialog.Title>
              <Dialog.Description className="cosmic-dialog-description">{description}</Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button type="button" className="cosmic-dialog-close" aria-label={`Close ${title}`}>
                <X size={19} aria-hidden="true" />
              </button>
            </Dialog.Close>
          </header>
          <div className="cosmic-dialog-body">{children}</div>
          <footer className="cosmic-dialog-footer">
            <Dialog.Close asChild>
              <button type="button" className="cosmic-dialog-cancel">Cancel</button>
            </Dialog.Close>
            <button type="button" className="cosmic-dialog-save" onClick={() => {
              onSave();
              setOpen(false);
            }}>{saveLabel}</button>
          </footer>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function PlanetColorStudio({ hue, onSave, compact = false }: {
  hue: string;
  onSave: (hue: string) => void;
  compact?: boolean;
}) {
  const [draft, setDraft] = useState(hue);
  const selected = planetColors.find(color => color.hue.toLowerCase() === draft.toLowerCase());

  return (
    <CosmicDialog
      trigger={<button type="button"
        className={`cosmic-customize-trigger${compact ? ' cosmic-customize-trigger--compact' : ''}`}
        data-testid="planet-color-trigger" aria-label="Customize planet color" title="Customize planet color"
        style={compact ? { '--orb-color': hue } as CSSProperties : undefined}>
        {compact ? <>
          <span className="orb-planet" aria-hidden="true" />
          <Palette className="cosmic-trigger-badge" size={18} aria-hidden="true" />
        </> : <><Palette size={16} aria-hidden="true" />Customize planet color</>}
      </button>}
      title="Planet Color Studio"
      testId="planet-color-studio"
      description="Try a new color. Nothing changes until you choose Save color."
      saveLabel="Save color"
      onOpen={() => setDraft(hue)}
      onSave={() => onSave(draft)}
    >
      <div className="cosmic-draft-preview cosmic-color-preview">
        <div className="cosmic-planet-preview" style={{ '--orb-color': draft } as CSSProperties} aria-hidden="true">
          <div className="orb-planet" />
        </div>
        <div className="cosmic-draft-copy" role="status" aria-live="polite" aria-atomic="true">
          <span className="cosmic-draft-label">Draft preview</span>
          <strong>{selected?.name ?? 'Current color'}</strong>
        </div>
      </div>
      <fieldset className="cosmic-choices">
        <legend className="cosmic-choices-title">Choose a color</legend>
        <div className="cosmic-color-grid">
          {planetColors.map(color => (
            <button type="button" key={color.id} className="cosmic-color-choice" data-color={color.id}
              aria-label={color.name} title={color.name} aria-pressed={selected?.id === color.id}
              onClick={() => setDraft(color.hue)}>
              <span className="cosmic-color-swatch" style={{ backgroundColor: color.hue }} aria-hidden="true" />
              {selected?.id === color.id && <Check className="cosmic-choice-check" size={17} strokeWidth={3} aria-hidden="true" />}
            </button>
          ))}
        </div>
      </fieldset>
    </CosmicDialog>
  );
}

export function CelestialAppearancePicker({ type, appearance, onSave }: {
  type: 'task' | 'note';
  appearance?: unknown;
  onSave: (appearance: CelestialAppearance) => void;
}) {
  const [draft, setDraft] = useState(() => resolveAppearance(type, appearance));
  const designs = type === 'task' ? taskAppearances : noteAppearances;
  const selectedId = resolveAppearance(type, draft);
  const selected = designs.find(design => design.id === selectedId)!;

  return (
    <CosmicDialog
      trigger={<button type="button" className="cosmic-customize-trigger" data-testid="appearance-trigger"><Shapes size={16} aria-hidden="true" />Customize appearance</button>}
      title="Celestial Object Library"
      testId="celestial-library"
      description={`Choose a design for this ${type}. Nothing changes until you choose Save appearance.`}
      saveLabel="Save appearance"
      onOpen={() => setDraft(resolveAppearance(type, appearance))}
      onSave={() => onSave(selectedId)}
    >
      <div className="cosmic-draft-preview">
        <CelestialObject type={type} appearance={selectedId} className="cosmic-object-preview" />
        <div className="cosmic-draft-copy" role="status" aria-live="polite" aria-atomic="true">
          <span className="cosmic-draft-label">Draft preview</span>
          <strong>{selected.name}</strong>
          <p>{selected.description}</p>
        </div>
      </div>
      <fieldset className="cosmic-choices">
        <legend className="cosmic-choices-title">{type === 'task' ? 'Task designs' : 'Note designs'}</legend>
        <div className="cosmic-object-grid">
          {designs.map(design => (
            <button type="button" key={design.id} className="cosmic-object-choice" data-appearance-option={design.id}
              aria-pressed={selectedId === design.id} aria-description={design.description} title={design.description}
              onClick={() => setDraft(design.id)}>
              <CelestialObject type={type} appearance={design.id} className="cosmic-object-thumbnail" />
              <span>{design.name}</span>
              {selectedId === design.id && <Check className="cosmic-choice-check" size={17} strokeWidth={3} aria-hidden="true" />}
            </button>
          ))}
        </div>
      </fieldset>
    </CosmicDialog>
  );
}
