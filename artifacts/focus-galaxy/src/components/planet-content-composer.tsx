import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Check, Circle, FileText, ListTodo, Pencil, Save, Trash2, X } from 'lucide-react';

export type PlanetNoteEntry = {
  id: string;
  type: 'note';
  text: string;
  createdAt: number;
  updatedAt: number;
};

export type PlanetTaskEntry = {
  id: string;
  type: 'task';
  text: string;
  completed: boolean;
  createdAt: number;
  updatedAt: number;
};

export type PlanetEntry = PlanetNoteEntry | PlanetTaskEntry;
export type PlanetEntryType = PlanetEntry['type'];

type PlanetContentComposerProps = {
  planetId: string;
  planetName: string;
  entries: PlanetEntry[];
  onCreateEntry: (type: PlanetEntryType, text: string) => void;
  onSaveEntry: (id: string, text: string) => void;
  onToggleTask: (id: string) => void;
  onDeleteEntry: (id: string) => void;
  onDraftStateChange: (hasDraft: boolean) => void;
};

export function PlanetContentComposer({
  planetId,
  planetName,
  entries,
  onCreateEntry,
  onSaveEntry,
  onToggleTask,
  onDeleteEntry,
  onDraftStateChange,
}: PlanetContentComposerProps) {
  const [activeType, setActiveType] = useState<PlanetEntryType>('note');
  const [noteDraft, setNoteDraft] = useState('');
  const [taskDraft, setTaskDraft] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState('');
  const [savedMessage, setSavedMessage] = useState('');
  const taskInputRef = useRef<HTMLInputElement>(null);
  const editInputRef = useRef<HTMLTextAreaElement | HTMLInputElement>(null);

  const editingEntry = editingId ? entries.find((entry) => entry.id === editingId) : undefined;
  const editChanged = Boolean(editingEntry && editDraft !== editingEntry.text);
  const hasDraft = noteDraft.length > 0 || taskDraft.length > 0 || editChanged;

  useEffect(() => {
    onDraftStateChange(hasDraft);
  }, [hasDraft, onDraftStateChange]);

  useEffect(() => {
    if (editingId) editInputRef.current?.focus({ preventScroll: true });
  }, [editingId]);

  const clearFeedback = () => setSavedMessage('');

  const createNote = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const text = noteDraft.trim();
    if (!text) return;
    onCreateEntry('note', noteDraft);
    setNoteDraft('');
    setSavedMessage('Note saved to this planet.');
  };

  const createTask = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const text = taskDraft.trim();
    if (!text) return;
    onCreateEntry('task', text);
    setTaskDraft('');
    setSavedMessage('Task added.');
    requestAnimationFrame(() => taskInputRef.current?.focus({ preventScroll: true }));
  };

  const startEditing = (entry: PlanetEntry) => {
    setEditingId(entry.id);
    setEditDraft(entry.text);
    clearFeedback();
  };

  const saveEdit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const text = editDraft.trim();
    if (!editingId || !text) return;
    const changed = editChanged;
    const entryType = editingEntry?.type;
    if (changed) onSaveEntry(editingId, editDraft);
    setEditingId(null);
    setEditDraft('');
    setSavedMessage(changed ? (entryType === 'task' ? 'Task updated.' : 'Changes saved.') : 'No changes to save.');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditDraft('');
    clearFeedback();
  };

  const visibleEntries = entries
    .filter((entry) => entry.type === activeType)
    .slice()
    .sort((a, b) => b.createdAt - a.createdAt);

  return (
    <section className="planet-content-composer" aria-labelledby="planet-content-title" data-planet-composer>
      <div className="planet-content-heading">
        <div>
          <h2 id="planet-content-title">Inside this planet</h2>
          <p>Keep thoughts and next moves close to {planetName}.</p>
        </div>
        <div className="planet-content-switch" role="group" aria-label="Choose planet content type">
          <button
            type="button"
            className={activeType === 'note' ? 'is-active' : ''}
            aria-pressed={activeType === 'note'}
            onClick={() => { setActiveType('note'); clearFeedback(); }}
          >
            <FileText size={14} aria-hidden="true" />
            <span>Note</span>
          </button>
          <button
            type="button"
            className={activeType === 'task' ? 'is-active' : ''}
            aria-pressed={activeType === 'task'}
            onClick={() => { setActiveType('task'); clearFeedback(); }}
          >
            <ListTodo size={15} aria-hidden="true" />
            <span>Task</span>
          </button>
        </div>
      </div>

      {activeType === 'note' ? (
        <form className="planet-content-compose" onSubmit={createNote}>
          <label className="sr-only" htmlFor={`new-planet-note-${planetId}`}>New note for {planetName}</label>
          <textarea
            id={`new-planet-note-${planetId}`}
            aria-label={`New note for ${planetName}`}
            value={noteDraft}
            placeholder="A thought, a constraint, or something worth remembering…"
            onChange={(event) => { setNoteDraft(event.target.value); clearFeedback(); }}
            spellCheck
          />
          <div className="planet-content-compose-footer">
            <span>Notes stay with this planet</span>
            <button type="submit" className="planet-content-primary" disabled={!noteDraft.trim()}>
              <Save size={14} aria-hidden="true" />
              <span>Save Note</span>
            </button>
          </div>
        </form>
      ) : (
        <form className="planet-content-task-compose" onSubmit={createTask}>
          <label className="sr-only" htmlFor={`new-planet-task-${planetId}`}>New task for {planetName}</label>
          <input
            ref={taskInputRef}
            id={`new-planet-task-${planetId}`}
            aria-label={`New task for ${planetName}`}
            value={taskDraft}
            placeholder="One clear next move…"
            onChange={(event) => { setTaskDraft(event.target.value); clearFeedback(); }}
          />
          <button type="submit" className="planet-content-primary" disabled={!taskDraft.trim()}>
            <span>Add Task</span>
          </button>
        </form>
      )}

      <div className="planet-content-feedback" role="status" aria-live="polite" aria-atomic="true">
        {hasDraft && <span className="is-unsaved">Unsaved changes</span>}
        {savedMessage && <span>{savedMessage}</span>}
      </div>

      {visibleEntries.length ? (
        <ul className={`planet-content-list planet-content-list-${activeType === 'note' ? 'notes' : 'tasks'}`} aria-label={`${activeType === 'note' ? 'Notes' : 'Tasks'} for ${planetName}`}>
          {visibleEntries.map((entry) => (
            <li className={`planet-content-item ${entry.type === 'task' && entry.completed ? 'is-completed' : ''}`} key={entry.id}>
              {entry.type === 'note' ? (
                editingId === entry.id ? (
                  <form className="planet-content-edit" onSubmit={saveEdit}>
                    <label className="planet-content-kind" htmlFor={`edit-planet-note-${entry.id}`}>EDIT NOTE</label>
                    <textarea
                      ref={editInputRef as React.RefObject<HTMLTextAreaElement>}
                      id={`edit-planet-note-${entry.id}`}
                      aria-label="Edit note"
                      value={editDraft}
                      onChange={(event) => { setEditDraft(event.target.value); clearFeedback(); }}
                      spellCheck
                    />
                    <div className="planet-content-item-actions">
                      <button type="button" className="planet-content-icon-button" aria-label="Delete note" onClick={() => { onDeleteEntry(entry.id); cancelEdit(); setSavedMessage('Note deleted.'); }}>
                        <Trash2 size={15} aria-hidden="true" />
                      </button>
                      <button type="button" className="planet-content-icon-button" aria-label="Cancel note edit" onClick={cancelEdit}>
                        <X size={15} aria-hidden="true" />
                      </button>
                      <button type="submit" className="planet-content-primary" aria-label="Save note changes" disabled={!editDraft.trim() || !editChanged}>
                        <Save size={14} aria-hidden="true" />
                        <span>Save</span>
                      </button>
                    </div>
                  </form>
                ) : (
                  <>
                    <div className="planet-content-item-topline">
                      <span className="planet-content-kind">NOTE</span>
                      <div className="planet-content-item-actions">
                        <button type="button" className="planet-content-icon-button" aria-label="Edit note" onClick={() => startEditing(entry)}>
                          <Pencil size={14} aria-hidden="true" />
                        </button>
                        <button type="button" className="planet-content-icon-button" aria-label="Delete note" onClick={() => { onDeleteEntry(entry.id); setSavedMessage('Note deleted.'); }}>
                          <Trash2 size={14} aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                    <p className="planet-content-note-text">{entry.text}</p>
                  </>
                )
              ) : editingId === entry.id ? (
                <form className="planet-content-task-edit" onSubmit={saveEdit}>
                  <label className="sr-only" htmlFor={`edit-planet-task-${entry.id}`}>Edit task</label>
                  <input
                    ref={editInputRef as React.RefObject<HTMLInputElement>}
                    id={`edit-planet-task-${entry.id}`}
                    aria-label="Edit task"
                    value={editDraft}
                    onChange={(event) => { setEditDraft(event.target.value); clearFeedback(); }}
                  />
                  <button type="button" className="planet-content-icon-button" aria-label="Cancel task edit" onClick={cancelEdit}>
                    <X size={15} aria-hidden="true" />
                  </button>
                  <button type="submit" className="planet-content-primary" aria-label="Save task changes" disabled={!editDraft.trim() || !editChanged}>Save</button>
                </form>
              ) : (
                <>
                  <button
                    type="button"
                    className="planet-content-task-toggle"
                    aria-label={`${entry.completed ? 'Reopen' : 'Complete'} task: ${entry.text}`}
                    aria-pressed={entry.completed}
                    onClick={() => onToggleTask(entry.id)}
                  >
                    {entry.completed ? <Check size={15} aria-hidden="true" /> : <Circle size={18} aria-hidden="true" />}
                  </button>
                  <div className="planet-content-task-copy">
                    <span className="planet-content-kind">TASK</span>
                    <p>{entry.text}</p>
                    {entry.completed && <span className="planet-content-task-status">Completed</span>}
                  </div>
                  <div className="planet-content-item-actions">
                    <button type="button" className="planet-content-icon-button" aria-label="Edit task" onClick={() => startEditing(entry)}>
                      <Pencil size={14} aria-hidden="true" />
                    </button>
                    <button type="button" className="planet-content-icon-button" aria-label="Delete task" onClick={() => { onDeleteEntry(entry.id); setSavedMessage('Task deleted.'); }}>
                      <Trash2 size={14} aria-hidden="true" />
                    </button>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="planet-content-empty">
          {activeType === 'note' ? 'No notes here yet. Save a thought to keep it in orbit.' : 'No tasks here yet. Add one clear next move.'}
        </p>
      )}
    </section>
  );
}
