import { html, nothing, render, type TemplateResult } from 'lit-html';
import { type PlayerProfile, type PlayerProfilesError } from '../../profiles/types';
import { MAX_PLAYER_PROFILES, operationProgressForProfile, PLAYER_NAME_MAX_LENGTH } from '../../profiles/rules';
import { MATH_FINAL_STEP } from '../../ecs/mathSteps';
import type { EquationOperation } from '../../ecs/types';
import { mathProgressCue } from '../modeSelectSetup';
import { operationLabels } from '../labels';
import type { ScreenSpec } from '../screenTypes';
import {
  BTN_CHROME,
  BTN_SIZE,
  OVERLAY_BASE,
  type ScreenSpecActions,
} from './shared';

const OPERATION_SYMBOLS: Record<EquationOperation, string> = {
  add: '+',
  subtract: '−',
  multiply: '×',
  divide: '÷',
};

const profileOrbLabel = (name: string): string => {
  const defaultName = /^Player(?: (\d+))?$/i.exec(name);
  if (defaultName) return `P${defaultName[1] ?? '1'}`;
  const [initial] = Array.from(name.trim());
  return initial?.toUpperCase() ?? 'P';
};

function profileProgress(profile: PlayerProfile): TemplateResult[] {
  return operationProgressForProfile(profile).map(({ operation, highestUnlockedStep }) => {
    const symbol = OPERATION_SYMBOLS[operation];
    const cue = mathProgressCue(profile.mathProgress[operation], MATH_FINAL_STEP);
    return html`
      <span class="player-progress-item" aria-label="${operationLabels[operation]}: ${cue.valueText}">
        <span class="player-progress-symbol" aria-hidden="true">${symbol}</span>
        <span class="player-progress-bar" role="progressbar"
          aria-label="${operationLabels[operation]} progress"
          aria-valuemin="1" aria-valuemax="${MATH_FINAL_STEP}"
              aria-valuenow="${highestUnlockedStep}" aria-valuetext="${cue.valueText}">
          <span class="player-progress-fill" style="width:${cue.percentage}%"></span>
        </span>
        <span class="player-progress-number">${highestUnlockedStep}</span>
      </span>
    `;
  });
}

export function playerBadgeTemplate(actions: ScreenSpecActions): TemplateResult {
  const state = actions.getPlayerProfiles();
  const profile = state.profiles.find(candidate => candidate.id === state.activeProfileId);
  const name = profile?.name ?? 'Player';
  return html`
    <button type="button" id="player-profile-badge" class="player-profile-badge"
      aria-label="Active player ${name}. Open player roster" @click=${actions.openPlayerRoster}>
      <span class="player-profile-orb" aria-hidden="true">${profileOrbLabel(name)}</span>
      <span class="player-profile-badge-copy"><strong>${name}</strong><span>Players</span></span>
      <svg class="player-profile-menu-icon" aria-hidden="true" viewBox="0 0 24 24" focusable="false">
        <path d="M4 6h16M4 12h16M4 18h16" />
      </svg>
    </button>
  `;
}

const profileDialogHeading = (title: string, copy: string, headingId?: string): TemplateResult => html`
  <header class="player-dialog-heading">
    <p class="player-dialog-kicker">MATH MARSH · PLAYERS</p>
    <h1 id=${headingId ?? nothing}>${title}</h1>
    <p>${copy}</p>
  </header>
`;

function profileNameForm(
  actions: ScreenSpecActions,
  options: Readonly<{
    title: string;
    copy: string;
    button: string;
    form: 'setup' | 'add' | 'rename';
    cancelFocusSelector?: () => string;
  }>,
): TemplateResult {
  const inputId = `player-${options.form}-name-input`;
  const errorId = `player-${options.form}-name-error`;
  const submitId = `player-${options.form}-name-submit`;
  const titleId = `player-${options.form}-name-title`;
  return html`
    <main class="player-name-card" role="dialog" aria-modal="true" aria-labelledby=${titleId}>
      ${profileDialogHeading(options.title, options.copy, titleId)}
      <div data-profile-name-form data-form-kind=${options.form}>
        <label for=${inputId}>Player name</label>
        <input id=${inputId} data-profile-name-input name="playerName" type="text" maxlength="${PLAYER_NAME_MAX_LENGTH}"
          autocomplete="off" autocapitalize="words" spellcheck="false" aria-describedby=${errorId}>
        <p id=${errorId} data-profile-name-error class="player-form-error" aria-live="assertive"></p>
        <div class="player-dialog-actions">
          <button type="button" data-profile-name-confirm id=${submitId} class="btn-success ${BTN_CHROME} ${BTN_SIZE.mdResponsive}">${options.button}</button>
          ${options.form === 'setup' ? nothing : html`
            <button type="button" class="btn-secondary ${BTN_CHROME} ${BTN_SIZE.mdResponsive}"
              @click=${(): void => actions.closePlayerScreen(options.cancelFocusSelector?.() ?? '#player-add-button')}>
              Cancel
            </button>
          `}
        </div>
      </div>
      <p class="player-local-note">Profiles stay on this device and are not password protected.</p>
      <div class="input-prompts-slot" data-input-prompts></div>
    </main>
  `;
}

function writeError(root: HTMLElement, error: PlayerProfilesError | undefined): void {
  const message = root.querySelector<HTMLElement>('[data-profile-name-error], #player-action-error');
  if (!message) return;
  const copy = {
    blank: 'Enter a player name.',
    duplicate: 'That name is already in use. Choose a different name.',
    tooLong: `Use ${PLAYER_NAME_MAX_LENGTH} characters or fewer.`,
    atCapacity: `This device already has ${MAX_PLAYER_PROFILES} players.`,
    notFound: 'That player could not be found. Return to the player list and try again.',
    onlyPlayer: 'Keep at least one player on this device.',
    activeProfileNotPersisted: 'The active player could not be saved. This profile was kept.',
    profilesNotPersisted: 'The change could not be saved, so the profile was kept.',
  } as const satisfies Record<PlayerProfilesError, string>;
  message.textContent = error ? copy[error] : '';
}

function wireProfileNameForm(
  root: HTMLElement,
  complete: (name: string) => PlayerProfilesError | undefined,
): void {
  const form = root.querySelector<HTMLElement>('[data-profile-name-form]');
  const input = root.querySelector<HTMLInputElement>('[data-profile-name-input]');
  const confirm = root.querySelector<HTMLButtonElement>('[data-profile-name-confirm]');
  if (!form || !input || !confirm) return;
  // Profile changes are local actions. Native submission is blocked in embeds
  // whose sandbox omits allow-forms, before a submit handler can run.
  const completeName = function(): void {
    writeError(root, complete(input.value));
  };
  confirm.addEventListener('click', completeName);
  form.addEventListener('keydown', (event): void => {
    if (event.target !== input || event.key !== 'Enter' || event.isComposing) return;
    event.preventDefault();
    event.stopPropagation();
    completeName();
  });
}

function playerRow(profile: PlayerProfile, active: boolean, index: number, actions: ScreenSpecActions): TemplateResult {
  const name = profile.name;
  return html`
    <li class="player-roster-item">
      <button type="button" class="player-roster-row" data-player-row data-player-index="${index}"
        ?data-active-player-row=${active} aria-current=${active ? 'true' : nothing}
        aria-label="${name}${active ? ', active player' : ''}. ${operationProgressForProfile(profile).map(({ operation }) => {
          const cue = mathProgressCue(profile.mathProgress[operation], MATH_FINAL_STEP);
          return `${operationLabels[operation]} ${cue.valueText}`;
        }).join('. ')}"
        @click=${(): void => actions.switchPlayer(profile.id)}>
        <span class="player-profile-orb" aria-hidden="true">${profileOrbLabel(name)}</span>
        <span class="player-roster-details">
          <span class="player-roster-name">${name}</span>
          ${active ? html`<span class="player-active-label">Active player · ✓</span>` : nothing}
          <span class="player-progress-grid">${profileProgress(profile)}</span>
        </span>
      </button>
    </li>
  `;
}

function playerRosterTemplate(actions: ScreenSpecActions): TemplateResult {
  const state = actions.getPlayerProfiles();
  const activeId = state.activeProfileId;
  const atCapacity = state.profiles.length >= MAX_PLAYER_PROFILES;
  return html`
    <div class="player-overlay-backdrop" role="presentation"></div>
    <section class="player-roster-drawer" role="dialog" aria-modal="true" aria-labelledby="player-roster-title">
      <header class="player-roster-heading">
        <div>
          <p class="player-dialog-kicker">MATH MARSH · LOCAL PLAYERS</p>
          <h1 id="player-roster-title">Player profiles</h1>
          <p>Unlocked math steps · out of ${MATH_FINAL_STEP}</p>
        </div>
      <button type="button" class="player-close-button" aria-label="Close player profiles"
        @click=${(): void => actions.closePlayerScreen('#player-profile-badge')}>×</button>
      </header>
      <ul class="player-roster-list" aria-label="Players">
        ${state.profiles.map((profile, index) => playerRow(profile, profile.id === activeId, index, actions))}
      </ul>
      <div class="player-roster-actions">
        <button type="button" id="player-add-button" class="btn-success ${BTN_CHROME} ${BTN_SIZE.mdResponsive}"
          ?disabled=${atCapacity} aria-describedby=${atCapacity ? 'player-limit-note' : nothing}
          @click=${actions.openPlayerAdd}>＋ Add player</button>
        <button type="button" id="player-manage-button" class="btn-secondary ${BTN_CHROME} ${BTN_SIZE.mdResponsive}"
          @click=${actions.openPlayerManagement}>Manage players</button>
        ${atCapacity ? html`<p id="player-limit-note" class="player-limit-note">This device has reached the ${MAX_PLAYER_PROFILES}-player limit.</p>` : nothing}
      </div>
      <div class="input-prompts-slot" data-input-prompts></div>
    </section>
  `;
}

function managementTemplate(actions: ScreenSpecActions): TemplateResult {
  const state = actions.getPlayerProfiles();
  return html`
    <main class="player-management-card" role="dialog" aria-modal="true" aria-labelledby="player-manage-title">
      <header class="player-roster-heading">
        <div>
          <p class="player-dialog-kicker">MATH MARSH · LOCAL PLAYERS</p>
          <h1 id="player-manage-title">Manage players</h1>
          <p>Rename a player or remove their learner progress.</p>
        </div>
      <button type="button" id="player-management-back" class="player-close-button" aria-label="Back to player profiles"
        @click=${(): void => actions.closePlayerScreen('#player-manage-button')}>×</button>
      </header>
      <ul class="player-management-list" aria-label="Manage player profiles">
        ${state.profiles.map((profile, index) => html`
          <li class="player-management-row" data-player-index="${index}">
            <span class="player-profile-orb" aria-hidden="true">${profileOrbLabel(profile.name)}</span>
            <strong>${profile.name}</strong>
            <button type="button" class="btn-secondary ${BTN_CHROME}" data-rename-profile="${profile.id}" data-rename-profile-focus
            @click=${(): void => actions.openPlayerRename(profile.id)}>Rename</button>
            <button type="button" class="btn-danger ${BTN_CHROME}" data-delete-profile="${profile.id}" data-delete-profile-focus
              ?disabled=${state.profiles.length <= 1}
              aria-describedby=${state.profiles.length <= 1 ? 'last-player-note' : nothing}
              @click=${(): void => actions.openPlayerDelete(profile.id)}>Delete</button>
          </li>
        `)}
      </ul>
      ${state.profiles.length <= 1 ? html`<p id="last-player-note" class="player-limit-note">Keep at least one player profile on this device.</p>` : nothing}
      <div class="input-prompts-slot" data-input-prompts></div>
    </main>
  `;
}

export function createPlayerSetupScreenSpec(actions: ScreenSpecActions): ScreenSpec {
  return {
    id: 'player-setup-screen',
    className: `${OVERLAY_BASE} app-background player-setup-screen`,
    html: profileNameForm(actions, {
      title: 'Who’s playing?',
      copy: 'Choose a name for this device.',
      button: 'Continue',
      form: 'setup',
    }),
    promptPlacement: 'panel',
    initialFocusSelector: '#player-setup-name-submit',
    onShow: (root): void => {
      const input = root.querySelector<HTMLInputElement>('[data-profile-name-input]');
      if (input) input.value = actions.getNextPlayerName();
    },
    wire: root => wireProfileNameForm(root, actions.createPlayer),
    prompts: [{ action: 'select', label: 'Continue' }],
  };
}

export function createPlayerRosterScreenSpec(actions: ScreenSpecActions): ScreenSpec {
  return {
    id: 'player-roster-screen',
    className: 'player-profile-overlay absolute inset-0 z-50 flex items-stretch justify-end',
    html: html``,
    promptPlacement: 'panel',
    initialFocusSelector: '[data-active-player-row]',
    onShow: root => render(playerRosterTemplate(actions), root),
    onCancel: () => actions.closePlayerScreen('#player-profile-badge'),
    prompts: [
      { action: 'select', label: 'Choose player' },
      { action: 'back', label: 'Close' },
    ],
  };
}

export function createPlayerAddScreenSpec(actions: ScreenSpecActions): ScreenSpec {
  return {
    id: 'player-add-screen',
    className: `${OVERLAY_BASE} player-profile-overlay player-profile-modal`,
    html: profileNameForm(actions, {
      title: 'Add a player',
      copy: 'Choose a name. This player will start with fresh learner progress.',
      button: 'Create player',
      form: 'add',
    }),
    promptPlacement: 'panel',
    initialFocusSelector: '#player-add-name-submit',
    onShow: (root): void => {
      const input = root.querySelector<HTMLInputElement>('[data-profile-name-input]');
      if (input) input.value = actions.getNextPlayerName();
      writeError(root, undefined);
    },
    wire: root => wireProfileNameForm(root, actions.createPlayer),
    onCancel: () => actions.closePlayerScreen('#player-add-button'),
    prompts: [
      { action: 'select', label: 'Create player' },
      { action: 'back', label: 'Cancel' },
    ],
  };
}

export function createPlayerManagementScreenSpec(actions: ScreenSpecActions): ScreenSpec {
  return {
    id: 'player-management-screen',
    className: `${OVERLAY_BASE} player-profile-overlay player-profile-modal`,
    html: html``,
    promptPlacement: 'panel',
    initialFocusSelector: '#player-management-back',
    onShow: root => render(managementTemplate(actions), root),
    onCancel: () => actions.closePlayerScreen('#player-manage-button'),
    prompts: [
      { action: 'select', label: 'Manage player' },
      { action: 'back', label: 'Roster' },
    ],
  };
}

export function createPlayerRenameScreenSpec(actions: ScreenSpecActions): ScreenSpec {
  return {
    id: 'player-rename-screen',
    className: `${OVERLAY_BASE} player-profile-overlay player-profile-modal`,
    html: profileNameForm(actions, {
      title: 'Rename player',
      copy: 'Their learner progress will stay with this profile.',
      button: 'Save name',
      form: 'rename',
      cancelFocusSelector: function(): string {
        const profile = actions.getPlayerActionProfile();
        return profile ? `[data-rename-profile="${CSS.escape(profile.id)}"]` : '[data-rename-profile-focus]';
      },
    }),
    promptPlacement: 'panel',
    initialFocusSelector: '#player-rename-name-submit',
    onShow: (root): void => {
      const profile = actions.getPlayerActionProfile();
      const input = root.querySelector<HTMLInputElement>('[data-profile-name-input]');
      if (input) input.value = profile?.name ?? '';
      writeError(root, undefined);
    },
    wire: root => wireProfileNameForm(root, name => {
      const profile = actions.getPlayerActionProfile();
      return profile ? actions.renamePlayer(profile.id, name) : 'notFound';
    }),
    onCancel: (): void => {
      const profile = actions.getPlayerActionProfile();
      if (!profile) return;
      actions.closePlayerScreen(`[data-rename-profile="${CSS.escape(profile.id)}"]`);
    },
    prompts: [
      { action: 'select', label: 'Save name' },
      { action: 'back', label: 'Cancel' },
    ],
  };
}

export function createPlayerDeleteScreenSpec(actions: ScreenSpecActions): ScreenSpec {
  const template = (root?: HTMLElement): TemplateResult => {
    const profile = actions.getPlayerActionProfile();
    if (!profile) {
      if (root) writeError(root, 'notFound');
      return html`<main class="player-name-card"><h1>Player not found</h1></main>`;
    }
    return html`
      <main class="player-name-card player-delete-card" role="dialog" aria-modal="true" aria-labelledby="player-delete-title">
        ${profileDialogHeading(`Delete ${profile.name}?`, 'Their profile and learner progress will be removed from this device.', 'player-delete-title')}
        <p class="player-delete-warning">This cannot be undone.</p>
        <p id="player-action-error" class="player-form-error" aria-live="assertive"></p>
        <div class="player-dialog-actions">
          <button type="button" id="keep-player-button" class="btn-secondary ${BTN_CHROME} ${BTN_SIZE.mdResponsive}"
            @click=${(): void => actions.closePlayerScreen(`[data-delete-profile="${CSS.escape(profile.id)}"]`)}>Keep player</button>
          <button type="button" class="btn-danger ${BTN_CHROME} ${BTN_SIZE.mdResponsive}"
            @click=${(): void => writeError(root ?? document.body, actions.deletePlayer(profile.id))}>Delete player</button>
        </div>
        <div class="input-prompts-slot" data-input-prompts></div>
      </main>
    `;
  };
  return {
    id: 'player-delete-screen',
    className: `${OVERLAY_BASE} player-profile-overlay player-profile-modal`,
    html: html``,
    promptPlacement: 'panel',
    initialFocusSelector: '#keep-player-button',
    onShow: (root): void => { render(template(root), root); },
    onCancel: (): void => {
      const profile = actions.getPlayerActionProfile();
      if (!profile) return;
      actions.closePlayerScreen(`[data-delete-profile="${CSS.escape(profile.id)}"]`);
    },
    prompts: [
      { action: 'select', label: 'Confirm' },
      { action: 'back', label: 'Keep player' },
    ],
  };
}
