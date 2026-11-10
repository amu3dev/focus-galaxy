import type { PlanetEntry } from '../components/planet-content-composer';
import { createId } from './utils.ts';

export type Priority = {
  id: string;
  name: string;
  importance: number;
  urgency: number;
  energy: number;
  hue: string;
  entries?: PlanetEntry[];
  completed?: boolean;
  // Read only for migration from the first Planet Focus Mode notes field.
  notes?: string;
};

type EntrySeed =
  | { readonly type: 'note'; readonly text: string }
  | { readonly type: 'task'; readonly text: string; readonly completed?: boolean };

type PrioritySeed = Readonly<Omit<Priority, 'id' | 'entries'>> & {
  readonly entries?: readonly EntrySeed[];
};

export type GalaxyTemplate = {
  readonly id: 'blank' | 'first-orbit' | 'full-galaxy' | 'project-launch' | 'balanced-week';
  readonly name: string;
  readonly purpose: string;
  readonly description: string;
  readonly accent: string;
  readonly priorities: readonly PrioritySeed[];
};

export const galaxyTemplates: readonly GalaxyTemplate[] = [
  {
    id: 'blank', name: 'Blank Universe', purpose: 'A clear sky',
    description: 'Start with an empty galaxy and add priorities at your own pace.',
    accent: '#9b5be4',
    priorities: [],
  },
  {
    id: 'first-orbit', name: 'First Orbit', purpose: 'Learn by Exploring',
    description: 'Explore a simple starting point for planning, learning, and organizing.',
    accent: '#3aa2f7',
    priorities: [
      {
        name: 'Plan My Week', importance: 8, urgency: 7, energy: 3, hue: '#3aa2f7',
        entries: [
          { type: 'task', text: 'Choose three outcomes for the week' },
          { type: 'task', text: 'Review upcoming commitments', completed: true },
          { type: 'note', text: 'Leave room for changes instead of filling every available hour.' },
        ],
      },
      {
        name: 'Learn Something New', importance: 6, urgency: 5, energy: 7, hue: '#9b5be4',
        entries: [
          { type: 'task', text: 'Try one short lesson on a topic of interest' },
          { type: 'note', text: 'A small practice session is enough to make a start.' },
        ],
      },
      {
        name: 'Organize My Space', importance: 5, urgency: 6, energy: 4, hue: '#85d852',
        entries: [{ type: 'task', text: 'Clear one surface and put away unused items' }],
      },
    ],
  },
  {
    id: 'full-galaxy', name: 'Full Galaxy', purpose: 'Explore Everything',
    description: 'Explore a populated galaxy with varied priorities, notes, and tasks in progress.',
    accent: '#f1883b',
    priorities: [
      {
        name: 'Weekly Planning', importance: 9, urgency: 8, energy: 3, hue: '#f04e76',
        entries: [
          { type: 'task', text: 'Identify the most important outcome for this week' },
          { type: 'task', text: 'Gather upcoming commitments', completed: true },
          { type: 'task', text: 'Reserve a focus session for the top outcome' },
          { type: 'note', text: 'Prioritize a few meaningful outcomes over a full schedule.' },
        ],
      },
      {
        name: 'Learning', importance: 7, urgency: 5, energy: 8, hue: '#9b5be4',
        entries: [
          { type: 'task', text: 'Practice one new concept' },
          { type: 'task', text: 'Choose a learning resource', completed: true },
          { type: 'note', text: 'Record questions that need a second look.' },
          { type: 'note', text: 'Connect each concept to a small practical example.' },
        ],
      },
      {
        name: 'Core Project', importance: 10, urgency: 7, energy: 9, hue: '#3aa2f7',
        entries: [
          { type: 'task', text: 'Break the next milestone into small steps' },
          { type: 'task', text: 'Define the intended outcome', completed: true },
          { type: 'task', text: 'Review the first usable result' },
        ],
      },
      {
        name: 'Creative Practice', importance: 6, urgency: 6, energy: 6, hue: '#f1883b',
        entries: [
          { type: 'task', text: 'Make a rough draft of one idea' },

          { type: 'note', text: 'Experiment first; refinement can follow a useful draft.' },
        ],
      },
      {
        name: 'Life Admin', importance: 5, urgency: 9, energy: 2, hue: '#466bf0',
        entries: [
          { type: 'task', text: 'Handle one pending administrative item' },

          { type: 'note', text: 'Group short administrative tasks into one focused session.' },
        ],
      },
      {
        name: 'Wellbeing', importance: 8, urgency: 5, energy: 4, hue: '#85d852',
        entries: [
          { type: 'task', text: 'Set aside time for a restorative break' },
          { type: 'task', text: 'Choose a manageable wellbeing activity', completed: true },
          { type: 'note', text: 'Choose a pace and activity that fit current capacity.' },
        ],
      },
    ],
  },
  {
    id: 'project-launch', name: 'Project Launch', purpose: 'Build Something',
    description: 'Organize a small project across discovery, preparation, execution, and launch.',
    accent: '#f04e76',
    priorities: [
      {
        name: 'Discovery & Planning', importance: 9, urgency: 8, energy: 6, hue: '#9b5be4',
        entries: [
          { type: 'task', text: 'Define the problem and success criteria' },
          { type: 'task', text: 'List assumptions and open questions', completed: true },
          { type: 'note', text: 'Validate the core need before expanding the scope.' },
        ],
      },
      {
        name: 'Design & Preparation', importance: 8, urgency: 6, energy: 7, hue: '#3aa2f7',
        entries: [
          { type: 'task', text: 'Sketch the simplest workable approach' },
          { type: 'task', text: 'Gather the required materials and resources' },
          { type: 'note', text: 'Make dependencies visible before starting execution.' },
        ],
      },
      {
        name: 'Build & Execution', importance: 10, urgency: 7, energy: 9, hue: '#f1883b',
        entries: [
          { type: 'task', text: 'Complete the first usable version' },
          { type: 'task', text: 'Review progress against the agreed scope' },
          { type: 'task', text: 'Resolve the highest-impact blocker' },
          { type: 'note', text: 'Finish one useful slice before adding more work.' },
        ],
      },
      {
        name: 'Testing & Launch', importance: 9, urgency: 5, energy: 5, hue: '#85d852',
        entries: [
          { type: 'task', text: 'Check the result against the success criteria' },
          { type: 'task', text: 'Prepare a release checklist and handoff notes' },
          { type: 'note', text: 'Reserve time to review feedback after launch.' },
        ],
      },
    ],
  },
  {
    id: 'balanced-week', name: 'Balanced Week', purpose: 'Bring Life Into Orbit',
    description: 'Balance work, learning, wellbeing, personal projects, and everyday administration.',
    accent: '#85d852',
    priorities: [
      {
        name: 'Work', importance: 9, urgency: 8, energy: 7, hue: '#3aa2f7',
        entries: [
          { type: 'task', text: 'Choose the most valuable work outcome' },
          { type: 'task', text: 'Review outstanding commitments', completed: true },
          { type: 'note', text: 'Protect time for focused work and leave space for interruptions.' },
        ],
      },
      {
        name: 'Learning', importance: 6, urgency: 5, energy: 6, hue: '#9b5be4',
        entries: [
          { type: 'task', text: 'Schedule a short practice session' },
          { type: 'task', text: 'Capture one useful takeaway' },
          { type: 'note', text: 'Build on a small, repeatable learning habit.' },
        ],
      },
      {
        name: 'Wellbeing', importance: 8, urgency: 5, energy: 3, hue: '#85d852',
        entries: [
          { type: 'task', text: 'Plan a restorative activity that fits the week' },
          { type: 'note', text: 'Rest belongs in the plan, not only in the time left over.' },
        ],
      },
      {
        name: 'Personal Projects', importance: 7, urgency: 6, energy: 8, hue: '#f1883b',
        entries: [
          { type: 'task', text: 'Choose one small project milestone' },
          { type: 'task', text: 'Set aside a focused session to move it forward' },
        ],
      },
      {
        name: 'Life Admin', importance: 5, urgency: 7, energy: 2, hue: '#466bf0',
        entries: [{ type: 'task', text: 'Clear one pending administrative task' }],
      },
    ],
  },
];

export function instantiateTemplate(template: GalaxyTemplate): Priority[] {
  const now = Date.now();
  return template.priorities.map(({ entries = [], ...priority }) => ({
    ...priority,
    id: createId(),
    entries: entries.map((entry): PlanetEntry => {
      const fields = { id: createId(), type: entry.type, text: entry.text, createdAt: now, updatedAt: now };
      return entry.type === 'task'
        ? { ...fields, type: 'task', completed: entry.completed ?? false }
        : { ...fields, type: 'note' };
    }),
  }));
}

export function templateCounts(template: GalaxyTemplate): { priorities: number; tasks: number; notes: number } {
  let tasks = 0;
  let notes = 0;
  for (const priority of template.priorities) {
    for (const entry of priority.entries ?? []) {
      if (entry.type === 'task') tasks += 1;
      else notes += 1;
    }
  }
  return { priorities: template.priorities.length, tasks, notes };
}
