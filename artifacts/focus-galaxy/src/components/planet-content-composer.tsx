import { useEffect, useLayoutEffect, useRef, useState, type FormEvent } from 'react';
import { Check, ChevronDown, Circle, FileText, ListTodo, Pencil, Save, Trash2, X } from 'lucide-react';

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

type PlanetContentView = 'all' | 'notes' | 'tasks';

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

const COMPLETED_COLLAPSE_THRESHOLD = 3;

function formatEntryTimestamp(timestamp: number, now = Date.now()) {
  const date = new Date(timestamp);
  if (!Number.isFinite(date.getTime())) return '';

  const elapsed = now - timestamp;
  if (elapsed >= 0 && elapsed < 60_000) return 'Just now';
  if (elapsed >= 0 && elapsed < 60 * 60_000) return `${Math.max(1, Math.floor(elapsed / 60_000))} min ago`;

  const time = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(date);
  const today = new Date(now);
  const dayNumber = (value: Date) => Date.UTC(value.getFullYear(), value.getMonth(), value.getDate());
  const daysAgo = Math.round((dayNumber(today) - dayNumber(date)) / 86_400_000);
  if (daysAgo === 0) return `Today, ${time}`;
  if (daysAgo === 1) return `Yesterday, ${time}`;

  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    ...(date.getFullYear() !== today.getFullYear() ? { year: 'numeric' as const } : {}),
  }).format(date);
}

function getEntryTimestamp(entry: PlanetEntry) {
  if (entry.type === 'note' && entry.updatedAt > entry.createdAt) {
    return { timestamp: entry.updatedAt, label: `Edited ${formatEntryTimestamp(entry.updatedAt)}` };
  }

  return { timestamp: entry.createdAt, label: `Added ${formatEntryTimestamp(entry.createdAt)}` };
}

function mostRecentlyUpdated(a: PlanetEntry, b: PlanetEntry) {
  return b.updatedAt - a.updatedAt || b.createdAt - a.createdAt || a.id.localeCompare(b.id);
}

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
  const [contentView, setContentView] = useState<PlanetContentView>('all');
  const [completedOverride, setCompletedOverride] = useState<boolean | null>(null);
  const [noteDraft, setNoteDraft] = useState('');
  const [taskDraft, setTaskDraft] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState('');
  const [savedMessage, setSavedMessage] = useState('');
  const taskInputRef = useRef<HTMLInputElement>(null);
  const editInputRef = useRef<HTMLTextAreaElement | HTMLInputElement>(null);
  const taskToggleRefs = useRef(new Map<string, HTMLButtonElement>());
  const entryActionRefs = useRef(new Map<string, HTMLButtonElement>());
  const viewButtonRefs = useRef(new Map<PlanetContentView, HTMLButtonElement>());
  const completedToggleRef = useRef<HTMLButtonElement>(null);
  const pendingTaskFocus = useRef<string | null>(null);
  const pendingDeleteFocus = useRef<{ entryId: string | null } | null>(null);

  const editingEntry = editingId ? entries.find((entry) => entry.id === editingId) : undefined;
  const editChanged = Boolean(editingEntry && editDraft !== editingEntry.text);
  const hasDraft = noteDraft.length > 0 || taskDraft.length > 0 || editChanged;
  const notes = entries.filter((entry): entry is PlanetNoteEntry => entry.type === 'note');
  const tasks = entries.filter((entry): entry is PlanetTaskEntry => entry.type === 'task');
  const noteCount = notes.length;
  const taskCount = tasks.length;
  const filteredEntries = (contentView === 'all'
    ? entries
    : entries.filter((entry) => entry.type === (contentView === 'notes' ? 'note' : 'task')))
    .slice()
    .sort(mostRecentlyUpdated);
  const activeTasks = contentView === 'tasks'
    ? filteredEntries.filter((entry): entry is PlanetTaskEntry => entry.type === 'task' && !entry.completed)
    : [];
  const completedTasks = contentView === 'tasks'
    ? filteredEntries.filter((entry): entry is PlanetTaskEntry => entry.type === 'task' && entry.completed)
    : [];
  const completedExpanded = completedOverride ?? completedTasks.length <= COMPLETED_COLLAPSE_THRESHOLD;

  useEffect(() => {
    onDraftStateChange(hasDraft);
  }, [hasDraft, onDraftStateChange]);

  useEffect(() => {
    if (editingId) editInputRef.current?.focus({ preventScroll: true });
  }, [editingId]);

  useLayoutEffect(() => {
    const entryId = pendingTaskFocus.current;
    if (entryId) {
      const target = taskToggleRefs.current.get(entryId) ?? completedToggleRef.current;
      target?.focus({ preventScroll: true });
      pendingTaskFocus.current = null;
    }

    const deleteFocus = pendingDeleteFocus.current;
    if (deleteFocus) {
      const target = deleteFocus.entryId
        ? entryActionRefs.current.get(deleteFocus.entryId)
        : viewButtonRefs.current.get(contentView);
      target?.focus({ preventScroll: true });
      pendingDeleteFocus.current = null;
    }
  }, [entries, contentView]);

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

  const toggleTask = (entry: PlanetTaskEntry) => {
    pendingTaskFocus.current = entry.id;
    if (
      contentView === 'tasks'
      && !entry.completed
      && completedOverride === null
      && completedTasks.length + 1 > COMPLETED_COLLAPSE_THRESHOLD
    ) {
      setCompletedOverride(false);
    }
    onToggleTask(entry.id);
  };

  const deleteEntry = (entry: PlanetEntry, message: string) => {
    const viewEntries = contentView === 'tasks' ? [...activeTasks, ...completedTasks] : filteredEntries;
    const index = viewEntries.findIndex((visibleEntry) => visibleEntry.id === entry.id);
    const nextEntry = viewEntries[index + 1] ?? viewEntries[index - 1];
    pendingDeleteFocus.current = { entryId: nextEntry?.id ?? null };
    onDeleteEntry(entry.id);
    setSavedMessage(message);
  };

  const renderEntry = (entry: PlanetEntry) => {
    const temporal = getEntryTimestamp(entry);
    return (
      <li
        className={`planet-content-item planet-content-item-${entry.type} ${entry.type === 'task' && entry.completed ? 'is-completed' : ''}`}
        key={entry.id}
      >
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
                <button type="button" className="planet-content-icon-button" aria-label="Delete note" onClick={() => { cancelEdit(); deleteEntry(entry, 'Note deleted.'); }}>
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
                  <button
                    ref={(button) => {
                      if (button) entryActionRefs.current.set(entry.id, button);
                      else entryActionRefs.current.delete(entry.id);
                    }}
                    type="button"
                    className="planet-content-icon-button"
                    aria-label="Edit note"
                    onClick={() => startEditing(entry)}
                  >
                    <Pencil size={14} aria-hidden="true" />
                  </button>
                  <button type="button" className="planet-content-icon-button" aria-label="Delete note" onClick={() => deleteEntry(entry, 'Note deleted.')}>
                    <Trash2 size={14} aria-hidden="true" />
                  </button>
                </div>
              </div>
              <p className="planet-content-note-text">{entry.text}</p>
              <time className="planet-content-time" dateTime={new Date(temporal.timestamp).toISOString()}>{temporal.label}</time>
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
              ref={(button) => {
                if (button) taskToggleRefs.current.set(entry.id, button);
                else taskToggleRefs.current.delete(entry.id);
              }}
              type="button"
              className="planet-content-task-toggle"
              aria-label={`${entry.completed ? 'Reopen' : 'Complete'} task: ${entry.text}`}
              aria-pressed={entry.completed}
              onClick={() => toggleTask(entry)}
            >
              {entry.completed ? <Check size={15} aria-hidden="true" /> : <Circle size={18} aria-hidden="true" />}
            </button>
            <div className="planet-content-task-copy">
              <span className="planet-content-kind">TASK</span>
              <p>{entry.text}</p>
              {entry.completed && <span className="planet-content-task-status">Completed</span>}
              <time className="planet-content-time" dateTime={new Date(temporal.timestamp).toISOString()}>{temporal.label}</time>
            </div>
            <div className="planet-content-item-actions">
              <button
                ref={(button) => {
                  if (button) entryActionRefs.current.set(entry.id, button);
                  else entryActionRefs.current.delete(entry.id);
                }}
                type="button"
                className="planet-content-icon-button"
                aria-label="Edit task"
                onClick={() => startEditing(entry)}
              >
                <Pencil size={14} aria-hidden="true" />
              </button>
              <button type="button" className="planet-content-icon-button" aria-label="Delete task" onClick={() => deleteEntry(entry, 'Task deleted.')}>
                <Trash2 size={14} aria-hidden="true" />
              </button>
            </div>
          </>
        )}
      </li>
    );
  };

  const renderEntryList = (items: PlanetEntry[], label: string, className: string) => (
    <ul className={`planet-content-list ${className}`} aria-label={label}>
      {items.map(renderEntry)}
    </ul>
  );

  return (
    <section className="planet-content-composer" aria-labelledby="planet-content-title" data-planet-composer>
      <div className="planet-content-heading">
        <div className="planet-content-heading-copy">
          <h2 id="planet-content-title">Inside this planet</h2>
        </div>
        <div className="planet-content-create">
          <div className="planet-content-switch" role="group" aria-label="Create planet content">
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
      </div>

      <div className="planet-content-view-row">
        <div className="planet-content-filter" role="group" aria-label="View planet content">
          {(['all', 'notes', 'tasks'] as const).map((view) => {
            const label = view === 'all' ? 'All' : view === 'notes' ? 'Notes' : 'Tasks';
            const count = view === 'all' ? entries.length : view === 'notes' ? noteCount : taskCount;
            const countNoun = view === 'all'
              ? count === 1 ? 'item' : 'items'
              : view === 'notes'
                ? count === 1 ? 'note' : 'notes'
                : count === 1 ? 'task' : 'tasks';
            return (
              <button
                ref={(button) => {
                  if (button) viewButtonRefs.current.set(view, button);
                  else viewButtonRefs.current.delete(view);
                }}
                type="button"
                className={contentView === view ? 'is-active' : ''}
                aria-pressed={contentView === view}
                aria-label={`${label}, ${count} ${countNoun}`}
                onClick={() => { setContentView(view); clearFeedback(); }}
                key={view}
              >
                <span>{label}</span>
                <span className="planet-content-filter-count" aria-hidden="true">{count}</span>
              </button>
            );
          })}
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

      {contentView === 'tasks' ? (
        tasks.length ? (
          <div className="planet-content-task-groups">
            {activeTasks.length > 0 && (
              <section className="planet-content-task-group" aria-label="Active tasks">
                <h3 className="planet-content-list-heading">Active ({activeTasks.length})</h3>
                {renderEntryList(activeTasks, `Active tasks for ${planetName}`, 'planet-content-list-tasks')}
              </section>
            )}
            {completedTasks.length > 0 && (
              <section className="planet-content-task-group" aria-label="Completed tasks">
                <button
                  ref={completedToggleRef}
                  type="button"
                  className="planet-content-completed-toggle"
                  aria-expanded={completedExpanded}
                  aria-controls={`completed-planet-tasks-${planetId}`}
                  onClick={() => setCompletedOverride(!completedExpanded)}
                >
                  <span>Completed ({completedTasks.length})</span>
                  <ChevronDown size={15} aria-hidden="true" />
                </button>
                <div id={`completed-planet-tasks-${planetId}`} hidden={!completedExpanded}>
                  {completedExpanded && renderEntryList(completedTasks, `Completed tasks for ${planetName}`, 'planet-content-list-tasks')}
                </div>
              </section>
            )}
          </div>
        ) : (
          <p className="planet-content-empty">No tasks in this planet yet.</p>
        )
      ) : filteredEntries.length ? (
        renderEntryList(
          filteredEntries,
          contentView === 'notes' ? `Notes for ${planetName}` : `All content for ${planetName}`,
          contentView === 'notes' ? 'planet-content-list-notes' : 'planet-content-list-all',
        )
      ) : (
        <p className="planet-content-empty">
          {contentView === 'notes'
            ? 'No notes in this planet yet.'
            : entries.length === 0
              ? 'This planet is quiet so far. Add a note or one clear next move.'
              : 'No tasks in this planet yet.'}
        </p>
      )}
    </section>
  );
}
