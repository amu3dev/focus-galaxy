import { useEffect, useMemo, useRef, useState, memo, type CSSProperties, type FormEvent, type MouseEvent as ReactMouseEvent } from 'react';
import { createPortal } from 'react-dom';
import { Plus, RotateCcw, X, Target, Activity, Orbit, Trash2, ListChecks, Volume2, VolumeX, Music2, CheckCircle2, ChevronDown, ChevronUp, SunMedium, MoreHorizontal } from 'lucide-react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import NotFound from '@/pages/not-found';
import { Route, Switch } from 'wouter';
import { MotionConfig, motion, AnimatePresence, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { PlanetFocusMode, type PlanetFocusOrigin } from '@/components/planet-focus-mode';

type Priority = {
  id: string;
  name: string;
  importance: number;
  urgency: number;
  energy: number;
  hue: string;
  notes?: string;
};

type MetricKey = 'importance' | 'urgency' | 'energy';

type Confirmation = {
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => void;
};

const STORAGE_KEY = 'focus-galaxy-priorities-v2';
const SPOTIFY_SESSION_KEY = 'focus-galaxy-spotify-session';
const SPOTIFY_VERIFIER_KEY = 'focus-galaxy-spotify-verifier';
const SPOTIFY_STATE_KEY = 'focus-galaxy-spotify-state';
const SPOTIFY_SCOPE = 'streaming user-read-playback-state user-modify-playback-state';
const spotifyClientId = import.meta.env.VITE_SPOTIFY_CLIENT_ID?.trim() ?? '';
const queryClient = new QueryClient();

type SpotifySession = {
  accessToken: string;
  expiresAt: number;
  refreshToken?: string;
};

type SpotifyTrack = {
  name?: string;
  type?: string;
  artists?: Array<{ name?: string }>;
  show?: { name?: string };
};

type SpotifyTrackSummary = {
  name: string;
  byline: string;
};

type SpotifyPlayerState = {
  paused: boolean;
  track_window?: {
    current_track?: SpotifyTrack | null;
  };
};

type SpotifyPlaybackSnapshot = {
  item?: SpotifyTrack | null;
};

type SpotifyPlayer = {
  addListener: (event: string, callback: (data?: any) => void) => boolean;
  connect: () => Promise<boolean>;
  disconnect: () => void;
  getCurrentState: () => Promise<SpotifyPlayerState | null>;
  pause: () => Promise<void>;
  togglePlay: () => Promise<void>;
};

type SpotifySdk = {
  Player: new (options: {
    name: string;
    getOAuthToken: (callback: (token: string) => void) => void;
    volume: number;
  }) => SpotifyPlayer;
};

type SpotifyWindow = Window & {
  Spotify?: SpotifySdk;
  onSpotifyWebPlaybackSDKReady?: () => void;
};

let spotifySdkPromise: Promise<SpotifySdk> | null = null;

function getSpotifyTrackSummary(track?: SpotifyTrack | null): SpotifyTrackSummary | null {
  if (!track) return null;
  const name = track.name?.trim();
  if (!name) return null;

  const artists = track.artists
    ?.map((artist) => artist.name?.trim())
    .filter((artist): artist is string => Boolean(artist));

  return {
    name,
    byline: artists?.join(', ') || track.show?.name?.trim() || '',
  };
}

function getSpotifyRedirectUri() {
  return `${window.location.origin}${window.location.pathname}`;
}

function encodeBase64Url(bytes: Uint8Array) {
  let binary = '';
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

function createCodeVerifier() {
  const bytes = new Uint8Array(64);
  crypto.getRandomValues(bytes);
  return encodeBase64Url(bytes);
}

async function createCodeChallenge(verifier: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return encodeBase64Url(new Uint8Array(digest));
}

function readSpotifySession(): SpotifySession | null {
  if (typeof window === 'undefined') return null;
  try {
    const session = JSON.parse(window.sessionStorage.getItem(SPOTIFY_SESSION_KEY) || 'null') as SpotifySession | null;
    return session?.accessToken && session.expiresAt ? session : null;
  } catch {
    return null;
  }
}

function saveSpotifySession(session: SpotifySession | null) {
  if (typeof window === 'undefined') return;
  if (session) window.sessionStorage.setItem(SPOTIFY_SESSION_KEY, JSON.stringify(session));
  else window.sessionStorage.removeItem(SPOTIFY_SESSION_KEY);
}

async function spotifyRequest(path: string, token: string, init?: RequestInit) {
  const response = await fetch(`https://api.spotify.com/v1${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, ...init?.headers },
  });
  if (!response.ok) throw new Error(`Spotify request failed: ${response.status}`);
  return response.status === 204 ? null : response.json();
}

async function loadSpotifySdk() {
  const spotifyWindow = window as SpotifyWindow;
  if (spotifyWindow.Spotify?.Player) return spotifyWindow.Spotify;
  if (spotifySdkPromise) return spotifySdkPromise;

  spotifySdkPromise = new Promise<SpotifySdk>((resolve, reject) => {
    const timeout = window.setTimeout(() => reject(new Error('Spotify SDK timed out')), 10000);
    const finish = (error?: Error) => {
      window.clearTimeout(timeout);
      if (error) reject(error);
      else if (spotifyWindow.Spotify?.Player) resolve(spotifyWindow.Spotify);
      else reject(new Error('Spotify SDK unavailable'));
    };
    spotifyWindow.onSpotifyWebPlaybackSDKReady = () => finish();
    const script = document.querySelector<HTMLScriptElement>('script[data-focus-galaxy-spotify-sdk]') || document.createElement('script');
    if (!script.src) {
      script.dataset.focusGalaxySpotifySdk = 'true';
      script.src = 'https://sdk.scdn.co/spotify-player.js';
      script.async = true;
      script.addEventListener('error', () => finish(new Error('Spotify SDK failed to load')), { once: true });
      document.head.appendChild(script);
    }
    if ((spotifyWindow.Spotify?.Player)) finish();
  });
  return spotifySdkPromise;
}

async function exchangeSpotifyCode(code: string, verifier: string) {
  const body = new URLSearchParams({
    client_id: spotifyClientId,
    grant_type: 'authorization_code',
    code,
    redirect_uri: getSpotifyRedirectUri(),
    code_verifier: verifier,
  });
  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!response.ok) throw new Error('Spotify authorization failed');
  const token = await response.json() as { access_token: string; expires_in: number; refresh_token?: string };
  return {
    accessToken: token.access_token,
    expiresAt: Date.now() + token.expires_in * 1000,
    refreshToken: token.refresh_token,
  } satisfies SpotifySession;
}

async function refreshSpotifySession(session: SpotifySession) {
  if (!session.refreshToken) throw new Error('Spotify session expired');
  const body = new URLSearchParams({
    client_id: spotifyClientId,
    grant_type: 'refresh_token',
    refresh_token: session.refreshToken,
  });
  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!response.ok) throw new Error('Spotify session refresh failed');
  const token = await response.json() as { access_token: string; expires_in: number; refresh_token?: string };
  return {
    accessToken: token.access_token,
    expiresAt: Date.now() + token.expires_in * 1000,
    refreshToken: token.refresh_token || session.refreshToken,
  } satisfies SpotifySession;
}

async function startSpotifyAuthorization() {
  const verifier = createCodeVerifier();
  const state = createCodeVerifier();
  const challenge = await createCodeChallenge(verifier);
  window.sessionStorage.setItem(SPOTIFY_VERIFIER_KEY, verifier);
  window.sessionStorage.setItem(SPOTIFY_STATE_KEY, state);
  const authorizeUrl = new URL('https://accounts.spotify.com/authorize');
  authorizeUrl.search = new URLSearchParams({
    client_id: spotifyClientId,
    response_type: 'code',
    redirect_uri: getSpotifyRedirectUri(),
    code_challenge_method: 'S256',
    code_challenge: challenge,
    state,
    scope: SPOTIFY_SCOPE,
  }).toString();
  window.location.assign(authorizeUrl.toString());
}

const seedPriorities: Priority[] = [
  { id: 'job-search', name: 'Job Search', importance: 8, urgency: 9, energy: 7, hue: '#f04e76' },
  { id: 'learning', name: 'Learning', importance: 6, urgency: 4, energy: 7, hue: '#9b5be4' },
  { id: 'consulting', name: 'Consulting', importance: 7, urgency: 7, energy: 6, hue: '#3aa2f7' },
  { id: 'signalboard', name: 'SignalBoard', importance: 9, urgency: 5, energy: 8, hue: '#f1883b' },
  { id: 'family', name: 'Family', importance: 10, urgency: 6, energy: 4, hue: '#466bf0' },
  { id: 'health', name: 'Health', importance: 8, urgency: 8, energy: 5, hue: '#85d852' },
];

function getPlanetBaseAngle(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = ((hash << 5) - hash) + id.charCodeAt(i);
    hash |= 0;
  }
  const degrees = Math.abs(hash) % 360;
  return (degrees * Math.PI) / 180;
}

function playCosmicChime(freq = 523.25) {
  try {
    const AudioContextClass = window.AudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    gain.gain.setValueAtTime(0.001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.08, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.5);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.55);
    setTimeout(() => { void ctx.close(); }, 700);
  } catch {}
}

function playSupernovaChime() {
  try {
    const AudioContextClass = window.AudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const chord = [523.25, 659.25, 783.99, 1046.5];
    chord.forEach((note, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      const startT = ctx.currentTime + i * 0.07;
      osc.frequency.setValueAtTime(note, startT);
      gain.gain.setValueAtTime(0.001, startT);
      gain.gain.exponentialRampToValueAtTime(0.09, startT + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, startT + 0.85);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(startT);
      osc.stop(startT + 0.9);
    });
    setTimeout(() => { void ctx.close(); }, 1400);
  } catch {}
}

function getFocusScore(priority: Pick<Priority, MetricKey>) {
  return Math.round((priority.importance * 0.45 + priority.urgency * 0.4 + priority.energy * 0.15) * 10);
}

function getSignalSummary(topPriorities: Priority[]) {
  const lead = topPriorities[0];
  if (!lead) return 'No signal yet. Place a priority in orbit to begin.';
  const score = getFocusScore(lead);
  if (score >= 80) return `${lead.name} has the strongest pull right now. Give it one clear next move.`;
  if (score <= 60) return 'The field is balanced. Choose one priority to give a little more gravity.';
  return `The field is forming around ${lead.name}. Adjust its metrics as your day changes.`;
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
    // Portal targets follow the tilted scene; do not move them mid-click.
    if (e.target instanceof Element && e.target.closest('#orb-hit-layer')) return;
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
  const [audioSource, setAudioSource] = useState<'local' | 'spotify'>('local');
  const [spotifyStatus, setSpotifyStatus] = useState<'unavailable' | 'idle' | 'connecting' | 'ready' | 'playing' | 'error'>(() => spotifyClientId ? 'idle' : 'unavailable');
  const [spotifyIsPlaying, setSpotifyIsPlaying] = useState(false);
  const [spotifyTrack, setSpotifyTrack] = useState<SpotifyTrackSummary | null>(null);
  const [spotifyMessage, setSpotifyMessage] = useState('');
  const audioRef = useRef<{
    context: AudioContext;
    timer: number;
  } | null>(null);
  const spotifySessionRef = useRef<SpotifySession | null>(readSpotifySession());
  const spotifyPlayerRef = useRef<SpotifyPlayer | null>(null);
  const spotifyDeviceIdRef = useRef<string | null>(null);
  const disposedRef = useRef(false);

  const stopAudio = () => {
    const audio = audioRef.current;
    if (!audio) return;
    window.clearInterval(audio.timer);
    void audio.context.close();
    audioRef.current = null;
    setIsPlaying(false);
  };

  const startAudio = () => {
    if (audioRef.current) return;
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

  const getSpotifyAccessToken = async () => {
    const session = spotifySessionRef.current;
    if (!session) throw new Error('Spotify is not connected');
    if (session.expiresAt > Date.now() + 60000) return session.accessToken;
    try {
      const refreshed = await refreshSpotifySession(session);
      spotifySessionRef.current = refreshed;
      saveSpotifySession(refreshed);
      return refreshed.accessToken;
    } catch (error) {
      spotifySessionRef.current = null;
      saveSpotifySession(null);
      throw error;
    }
  };

  const pauseSpotify = async () => {
    const player = spotifyPlayerRef.current;
    if (!player) return;
    try {
      await player.pause();
      setSpotifyIsPlaying(false);
      setSpotifyStatus('ready');
    } catch {
      setSpotifyMessage('Spotify could not pause; local focus music remains available.');
    }
  };

  const activateSpotify = async () => {
    const player = spotifyPlayerRef.current;
    const deviceId = spotifyDeviceIdRef.current;
    if (!player || !deviceId) {
      setSpotifyMessage('Spotify is still connecting.');
      return;
    }
    const wasLocalPlaying = Boolean(audioRef.current);
    try {
      const token = await getSpotifyAccessToken();
      const playerState = await player.getCurrentState();
      if (playerState) {
        setSpotifyTrack(getSpotifyTrackSummary(playerState.track_window?.current_track));
        if (playerState.paused) await player.togglePlay();
      } else {
        const current = await spotifyRequest('/me/player', token) as SpotifyPlaybackSnapshot | null;
        setSpotifyTrack(getSpotifyTrackSummary(current?.item));
        if (!current?.item) {
          setSpotifyStatus('ready');
          setSpotifyMessage('Start a track in Spotify, then choose Spotify here.');
          return;
        }
        await spotifyRequest('/me/player', token, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ device_ids: [deviceId], play: true }),
        });
      }
      if (wasLocalPlaying) stopAudio();
      setAudioSource('spotify');
      setSpotifyIsPlaying(true);
      setSpotifyStatus('playing');
      setSpotifyMessage('');
    } catch {
      setSpotifyStatus('error');
      setSpotifyMessage('Spotify playback is unavailable; local focus music remains available.');
      setAudioSource('local');
    }
  };

  const connectSpotifyPlayer = async () => {
    if (!spotifyClientId || disposedRef.current || spotifyPlayerRef.current) return;
    setSpotifyStatus('connecting');
    setSpotifyMessage('');
    try {
      const sdk = await loadSpotifySdk();
      if (disposedRef.current) return;
      const player = new sdk.Player({
        name: 'Focus Galaxy',
        getOAuthToken: (callback) => {
          void getSpotifyAccessToken().then(callback).catch(() => callback(''));
        },
        volume: 0.5,
      });
      player.addListener('ready', (data) => {
        const deviceId = data?.device_id as string | undefined;
        if (!deviceId) return;
        spotifyDeviceIdRef.current = deviceId;
        setSpotifyStatus('ready');
        void activateSpotify();
      });
      player.addListener('not_ready', () => {
        setSpotifyStatus('ready');
        setSpotifyMessage('Spotify browser playback went offline.');
      });
      player.addListener('player_state_changed', (data) => {
        if (typeof data?.paused !== 'boolean') return;
        setSpotifyTrack(getSpotifyTrackSummary(data.track_window?.current_track));
        setSpotifyIsPlaying(!data.paused);
        setSpotifyStatus(data.paused ? 'ready' : 'playing');
      });
      player.addListener('initialization_error', () => {
        setSpotifyStatus('error');
        setSpotifyMessage('Spotify playback is not supported in this browser.');
      });
      player.addListener('authentication_error', () => {
        setSpotifyStatus('error');
        setSpotifyMessage('Spotify connection expired. Connect again to continue.');
      });
      player.addListener('account_error', () => {
        setSpotifyStatus('error');
        setSpotifyMessage('Spotify browser playback requires a Premium account.');
        setAudioSource('local');
      });
      spotifyPlayerRef.current = player;
      if (!await player.connect()) throw new Error('Spotify player failed to connect');
    } catch {
      spotifyPlayerRef.current?.disconnect();
      spotifyPlayerRef.current = null;
      setSpotifyStatus('error');
      setSpotifyMessage('Spotify is unavailable; local focus music remains available.');
    }
  };

  const handleSpotifyClick = () => {
    if (!spotifyClientId || spotifyStatus === 'connecting') return;
    if (spotifyPlayerRef.current) {
      if (audioSource === 'spotify') {
        setAudioSource('local');
        void pauseSpotify();
      } else {
        void activateSpotify();
      }
      return;
    }
    spotifySessionRef.current = null;
    saveSpotifySession(null);
    void startSpotifyAuthorization().catch(() => {
      setSpotifyStatus('error');
      setSpotifyMessage('Spotify authorization could not start.');
    });
  };

  useEffect(() => {
    if (!spotifyClientId) return;
    const params = new URLSearchParams(window.location.search);
    const cleanupCallbackUrl = () => window.history.replaceState({}, document.title, `${window.location.pathname}${window.location.hash}`);
    const callbackError = params.get('error');
    if (callbackError) {
      cleanupCallbackUrl();
      setSpotifyStatus('error');
      setSpotifyMessage('Spotify authorization was cancelled.');
      return;
    }
    const code = params.get('code');
    if (code) {
      const verifier = window.sessionStorage.getItem(SPOTIFY_VERIFIER_KEY);
      const expectedState = window.sessionStorage.getItem(SPOTIFY_STATE_KEY);
      const returnedState = params.get('state');
      window.sessionStorage.removeItem(SPOTIFY_VERIFIER_KEY);
      window.sessionStorage.removeItem(SPOTIFY_STATE_KEY);
      cleanupCallbackUrl();
      if (!verifier || !expectedState || returnedState !== expectedState) {
        setSpotifyStatus('error');
        setSpotifyMessage('Spotify authorization could not be verified.');
        return;
      }
      setSpotifyStatus('connecting');
      void exchangeSpotifyCode(code, verifier).then((session) => {
        spotifySessionRef.current = session;
        saveSpotifySession(session);
        return connectSpotifyPlayer();
      }).catch(() => {
        setSpotifyStatus('error');
        setSpotifyMessage('Spotify authorization failed; local focus music remains available.');
      });
      return;
    }
    if (spotifySessionRef.current) void connectSpotifyPlayer();
  }, []);

  useEffect(() => () => {
    disposedRef.current = true;
    const audio = audioRef.current;
    if (audio) {
      window.clearInterval(audio.timer);
      void audio.context.close();
    }
    spotifyPlayerRef.current?.disconnect();
  }, []);

  const spotifyConnected = spotifyStatus === 'ready' || spotifyStatus === 'playing';
  const isSourcePlaying = audioSource === 'spotify' ? spotifyIsPlaying : isPlaying;
  const spotifyLabel = !spotifyClientId
    ? 'Spotify unavailable'
    : spotifyStatus === 'connecting'
      ? 'Connecting…'
    : spotifyConnected
      ? audioSource === 'spotify' ? 'Use local' : 'Use Spotify'
      : spotifyStatus === 'error' ? 'Retry Spotify' : 'Connect Spotify';
  const spotifyTrackDescription = spotifyTrack
    ? `${spotifyTrack.name}${spotifyTrack.byline ? ` — ${spotifyTrack.byline}` : ''}`
    : '';
  const spotifyTrackStatus = spotifyIsPlaying ? 'Now playing' : 'Last Spotify track';
  const spotifyDetail = spotifyTrack?.name || (spotifyConnected ? 'No active track' : '');
  const spotifyButtonDescription = spotifyTrack
    ? `${spotifyLabel}. ${spotifyTrackStatus}: ${spotifyTrackDescription}`
    : [spotifyLabel, spotifyConnected ? 'No active track' : ''].filter(Boolean).join('. ');

  return (
    <div className="focus-audio flex items-center rounded-full border border-white/10 bg-white/5 backdrop-blur-md overflow-hidden">
      <button
        type="button"
        onClick={() => {
          if (audioSource === 'spotify') {
            if (spotifyIsPlaying) void pauseSpotify();
            else void activateSpotify();
          } else if (isPlaying) stopAudio();
          else startAudio();
        }}
        className="flex items-center gap-2 px-3 py-2 text-white/70 hover:bg-white/10 hover:text-white transition-all text-xs font-semibold"
        aria-label={isSourcePlaying ? 'Pause focus music' : 'Play focus music'}
        title={isSourcePlaying ? 'Pause focus music' : 'Play focus music'}
      >
        {isSourcePlaying ? (
          <>
            <Volume2 size={15} />
            <span className="audio-equalizer" aria-hidden="true">
              <span className="eq-bar" />
              <span className="eq-bar" />
              <span className="eq-bar" />
              <span className="eq-bar" />
            </span>
          </>
        ) : <VolumeX size={15} />}
      </button>
      <select
        value={style}
        aria-label="Choose focus music"
        onChange={(event) => {
          if (audioSource === 'local' && isPlaying) stopAudio();
          setStyle(event.target.value as 'classical' | 'baroque' | 'nocturne');
        }}
        className="audio-style-select hidden sm:block max-w-[126px] border-0 border-l border-white/10 bg-transparent py-2 pl-2 pr-7 text-[11px] font-semibold text-white/75 outline-none cursor-pointer"
      >
        <option value="classical" className="bg-[#100d18]">Classical Flow</option>
        <option value="baroque" className="bg-[#100d18]">Baroque Focus</option>
        <option value="nocturne" className="bg-[#100d18]">Quiet Nocturne</option>
      </select>
      <button
        type="button"
        data-testid="spotify-connect"
        onClick={handleSpotifyClick}
        disabled={!spotifyClientId || spotifyStatus === 'connecting'}
        aria-label={spotifyButtonDescription}
        title={[spotifyMessage, spotifyButtonDescription].filter(Boolean).join(' ')}
        className={`flex min-w-0 items-center gap-1.5 border-l border-white/10 px-3 py-2 text-[11px] font-semibold transition-colors ${spotifyConnected && audioSource === 'spotify' ? 'text-[#1ed760]' : 'text-white/60 hover:bg-white/10 hover:text-white'} disabled:cursor-not-allowed disabled:opacity-45`}
      >
        <Music2 size={14} />
        <span className="flex min-w-0 max-w-[96px] flex-col text-left leading-tight">
          <span className="whitespace-nowrap">{spotifyLabel}</span>
          {spotifyDetail && <span className="max-w-full truncate text-[9px] font-medium text-white/55">{spotifyDetail}</span>}
        </span>
      </button>
      <span className="sr-only" role="status" aria-live="polite">{spotifyMessage}</span>
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
  rankedPriorities,
  onSelect,
  onRename,
  color,
  summary,
}: {
  rankedPriorities: Priority[];
  onSelect: (id: string) => void;
  onRename: (id: string, name: string) => void;
  color: string;
  summary: string;
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
        {summary}
      </p>
      
      <div data-testid="focus-signal-list" className="focus-signal-list flex flex-col gap-1 mt-auto">
         {rankedPriorities.map((p, i) => (
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

function useDialogFocus<T extends HTMLElement>(onClose: () => void) {
  const dialogRef = useRef<T>(null);
  const openerRef = useRef<HTMLElement | null>(
    typeof document !== 'undefined' && document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null
  );
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const dialog = dialogRef.current;
    const opener = openerRef.current;
    if (!dialog) return;

    const getFocusable = () => Array.from(dialog.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"]):not([disabled])'
    ));

    if (!dialog.contains(document.activeElement)) {
      (getFocusable()[0] || dialog).focus();
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      const activeDialog = document.activeElement instanceof HTMLElement
        ? document.activeElement.closest('[role="dialog"]')
        : null;
      if (activeDialog && activeDialog !== dialog) return;
      if (!dialog.contains(document.activeElement)) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab') return;

      const focusable = getFocusable();
      if (focusable.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }

      const current = document.activeElement;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!dialog.contains(current)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && current === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && current === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      requestAnimationFrame(() => {
        if (document.querySelector('[role="dialog"]')) return;
        if (opener?.isConnected && opener.getClientRects().length > 0) {
          opener.focus({ preventScroll: true });
          return;
        }
        if (opener?.closest('.header-utilities')) {
          document.getElementById('mobile-galaxy-controls-trigger')?.focus({ preventScroll: true });
        }
      });
    };
  }, []);

  return dialogRef;
}

function ManageTasksDialog({
  priorities,
  onClose,
  onSelect,
  onRename,
  onRequestRemove,
}: {
  priorities: Priority[];
  onClose: () => void;
  onSelect: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onRequestRemove: (id: string) => void;
}) {
  const dialogRef = useDialogFocus<HTMLDivElement>(onClose);

  return (
    <motion.div
      className="manage-dialog-overlay fixed inset-0 z-50 grid place-items-center p-4 bg-background/60 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <motion.div
        className="add-dialog manage-dialog w-full max-w-md"
        ref={dialogRef}
        role="dialog"
        tabIndex={-1}
        aria-modal="true"
        aria-labelledby="manage-tasks-title"
        initial={{ scale: 0.96, y: 12, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        exit={{ scale: 0.96, y: 8, opacity: 0 }}
      >
        <div className="flex items-start justify-between gap-4 mb-5">
          <div>
            <h2 id="manage-tasks-title" className="font-display text-xl font-bold text-white tracking-wide">Manage priorities</h2>
            <p className="text-white/60 text-xs mt-1.5 font-medium">Rename, select, or remove priorities here. Adjust metrics from Planet Detail.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close dialog" className="w-8 h-8 rounded-full bg-white/5 border border-white/10 text-white/60 flex items-center justify-center hover:text-white hover:bg-white/10 transition-colors">
            <X size={16} />
          </button>
        </div>
        <div className="manage-priority-list flex flex-col gap-2 max-h-[55vh] overflow-y-auto pr-1">
          {priorities.map((priority) => (
            <div key={priority.id} className="manage-priority-card flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-2.5">
              <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: priority.hue, boxShadow: `0 0 9px ${priority.hue}` }} />
              <div className="manage-priority-copy min-w-0 flex-1">
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
                  className="manage-priority-name min-w-0 w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm font-semibold text-white outline-none focus:border-primary/60 transition-colors"
                />
                <div className="manage-priority-meta" aria-label={`Score ${getFocusScore(priority)}, ${getFocusScore(priority) > 75 ? 'high focus' : 'in orbit'}`}>
                  <span>{getFocusScore(priority) > 75 ? 'High focus' : 'In orbit'}</span>
                  <span aria-hidden="true">·</span>
                  <span>Score {getFocusScore(priority)}</span>
                </div>
              </div>
              <div className="manage-priority-score" aria-label={`Focus score ${getFocusScore(priority)}`}>
                <div className="h-[6px] bg-white/10 rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${getFocusScore(priority)}%`, backgroundColor: priority.hue, boxShadow: `0 0 10px ${priority.hue}` }} />
                </div>
                <span>{getFocusScore(priority)}</span>
              </div>
              <div className="manage-priority-actions">
                <button
                  type="button"
                  onClick={() => {
                    onSelect(priority.id);
                    onClose();
                  }}
                  aria-label={`Select ${priority.name}`}
                  className="manage-priority-select"
                >
                  Select
                </button>
                <button
                  type="button"
                  onClick={() => onRequestRemove(priority.id)}
                  aria-label={`Remove ${priority.name}`}
                  title="Remove priority"
                  className="manage-priority-remove"
                >
                  <Trash2 size={17} aria-hidden="true" />
                </button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      aria-label={`More actions for ${priority.name}`}
                      className="manage-priority-more"
                    >
                      <MoreHorizontal size={20} aria-hidden="true" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="focus-context-menu">
                    <DropdownMenuItem
                      className="focus-context-danger"
                      onSelect={() => onRequestRemove(priority.id)}
                    >
                      <Trash2 size={16} aria-hidden="true" />
                      Remove priority
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
}

function ConfirmActionDialog({
  confirmation,
  openerRef,
  onClose,
}: {
  confirmation: Confirmation | null;
  openerRef: { current: HTMLElement | null };
  onClose: () => void;
}) {
  return (
    <AlertDialog open={Boolean(confirmation)} onOpenChange={(open) => { if (!open) onClose(); }}>
      <AlertDialogContent
        className="focus-confirm-content"
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          requestAnimationFrame(() => {
            const opener = openerRef.current;
            if (opener?.isConnected && opener.getClientRects().length > 0) {
              opener.focus({ preventScroll: true });
              return;
            }
            const manageDialog = document.querySelector<HTMLElement>('[role="dialog"][aria-labelledby="manage-tasks-title"]');
            const fallback = manageDialog?.querySelector<HTMLElement>('button:not([disabled]), input:not([disabled])')
              ?? document.querySelector<HTMLElement>('#mobile-galaxy-controls-trigger')
              ?? document.querySelector<HTMLElement>('.orb-screen-hit');
            fallback?.focus({ preventScroll: true });
          });
        }}
      >
        <AlertDialogHeader className="focus-confirm-header">
          <span className="focus-confirm-kicker">Focus Galaxy</span>
          <AlertDialogTitle className="focus-confirm-title">{confirmation?.title}</AlertDialogTitle>
          <AlertDialogDescription className="focus-confirm-description">
            {confirmation?.description}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="focus-confirm-actions">
          <AlertDialogCancel className="focus-confirm-cancel">Cancel</AlertDialogCancel>
          <AlertDialogAction
            className="focus-confirm-destructive"
            onClick={() => confirmation?.onConfirm()}
          >
            {confirmation?.confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function InsightPanel({ insight, title, priority }: { insight: string, title: string, priority?: Priority }) {
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
        {title}
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
  onEnterFocus,
  onRequestRemove,
  isMobile,
  isExpanded,
  onToggleExpanded,
  prefersReducedMotion,
}: {
  priority?: Priority;
  onUpdate: (metric: MetricKey, val: number) => void;
  onRename: (name: string) => void;
  onComplete: () => void;
  onClose: () => void;
  onEnterFocus: (opener: HTMLButtonElement) => void;
  onRequestRemove: () => void;
  isMobile: boolean;
  isExpanded: boolean;
  onToggleExpanded: (expanded: boolean) => void;
  prefersReducedMotion: boolean;
}) {
  const [name, setName] = useState(priority?.name ?? '');
  const swipeStartY = useRef<number | null>(null);
  const suppressHandleClick = useRef(false);

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
      className={`selected-panel-card panel-card flex flex-col relative overflow-hidden h-full z-20 pointer-events-auto${isMobile ? ' mobile-priority-sheet' : ''}`}
      data-expanded={isExpanded}
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
      {isMobile && (
        <button
          type="button"
          className="mobile-sheet-handle"
          aria-label={isExpanded ? 'Collapse priority details' : 'Expand priority details'}
          aria-expanded={isExpanded}
          onTouchStart={(event) => {
            swipeStartY.current = event.touches[0]?.clientY ?? null;
          }}
          onTouchEnd={(event) => {
            const startY = swipeStartY.current;
            swipeStartY.current = null;
            if (startY === null) return;
            const delta = event.changedTouches[0]?.clientY - startY;
            if (Math.abs(delta) < 28) return;
            suppressHandleClick.current = true;
            onToggleExpanded(delta < 0);
          }}
          onClick={() => {
            if (suppressHandleClick.current) {
              suppressHandleClick.current = false;
              return;
            }
            onToggleExpanded(!isExpanded);
          }}
        >
          <span className="mobile-sheet-grabber" aria-hidden="true" />
        </button>
      )}

      <div className="selected-panel-header flex justify-between items-start mb-3">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full shadow-[0_0_20px_var(--c)] relative shrink-0" style={{ '--c': priority.hue, background: `radial-gradient(circle at 35% 35%, #fff 0%, ${priority.hue} 50%, #000 90%)` } as any}>
            <div className="absolute inset-0 rounded-full shadow-[inset_0_0_10px_rgba(255,255,255,0.5)] pointer-events-none"></div>
          </div>
          <div className="flex flex-col justify-center min-w-0">
            {isMobile && !isExpanded ? (
              <button
                type="button"
                className="mobile-sheet-summary"
                onClick={() => onToggleExpanded(true)}
                aria-expanded={false}
                aria-label={`Expand ${priority.name}, score ${getFocusScore(priority)}`}
              >
                <span className="mobile-sheet-name">{priority.name}</span>
                <span className="mobile-sheet-score">Score <strong>{getFocusScore(priority)}</strong></span>
              </button>
            ) : (
              <>
                <label htmlFor="selected-priority-name" className="sr-only">Planet name</label>
                <input
                  id="selected-priority-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  onBlur={saveName}
                  maxLength={40}
                  className="w-full min-w-0 max-w-[180px] rounded-md border border-transparent bg-transparent px-1 py-1 -ml-1 font-sans font-bold text-[17px] leading-none text-white tracking-wide outline-none transition-colors hover:border-white/10 hover:bg-white/5 focus:border-white/20 focus:bg-white/10"
                />
                <span className="selected-panel-score text-[10px] uppercase tracking-widest font-display font-bold mt-1 px-1" style={{ color: priority.hue }}>
                  {getFocusScore(priority) > 75 ? 'HIGH FOCUS' : 'IN ORBIT'} • SCORE {getFocusScore(priority)}
                </span>
              </>
            )}
          </div>
        </div>
        <div className="selected-panel-header-actions">
          <button
            type="button"
            onClick={(event) => onEnterFocus(event.currentTarget)}
            className="selected-panel-focus"
            aria-label={`Enter Focus Mode for ${priority.name}`}
            title={`Enter Focus Mode for ${priority.name}`}
          >
            <Orbit size={16} aria-hidden="true" />
            <span>Enter Focus</span>
          </button>
          <button type="button" onClick={onClose} className="selected-panel-close text-white/40 hover:text-white transition-colors p-1" aria-label="Close panel">
             <X size={18} />
          </button>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {(!isMobile || isExpanded) && (
          <motion.div
            key="priority-details"
            className="selected-panel-details"
            initial={prefersReducedMotion ? false : { opacity: 0, height: 0, y: -8 }}
            animate={{ opacity: 1, height: 'auto', y: 0 }}
            exit={prefersReducedMotion ? undefined : { opacity: 0, height: 0, y: -8 }}
            transition={prefersReducedMotion ? { duration: 0 } : { type: 'spring', stiffness: 260, damping: 28 }}
          >
      {/* Quick Presets */}
      <div className="selected-panel-presets flex items-center gap-1.5 mb-3 flex-wrap">
        <span className="text-[9px] uppercase tracking-widest text-white/40 font-bold mr-0.5">Presets:</span>
        <button
          type="button"
          onClick={() => { onUpdate('importance', 9); onUpdate('urgency', 9); onUpdate('energy', 7); }}
          className="px-2 py-0.5 rounded-md bg-white/5 hover:bg-white/15 border border-white/10 text-[10px] font-bold text-red-300 transition-colors"
          title="Importance 9, Urgency 9, Effort 7"
        >
          ⚡ Fire
        </button>
        <button
          type="button"
          onClick={() => { onUpdate('importance', 9); onUpdate('urgency', 4); onUpdate('energy', 8); }}
          className="px-2 py-0.5 rounded-md bg-white/5 hover:bg-white/15 border border-white/10 text-[10px] font-bold text-purple-300 transition-colors"
          title="Importance 9, Urgency 4, Effort 8"
        >
          🌱 Deep
        </button>
        <button
          type="button"
          onClick={() => { onUpdate('importance', 6); onUpdate('urgency', 8); onUpdate('energy', 3); }}
          className="px-2 py-0.5 rounded-md bg-white/5 hover:bg-white/15 border border-white/10 text-[10px] font-bold text-emerald-300 transition-colors"
          title="Importance 6, Urgency 8, Effort 3"
        >
          🎯 Win
        </button>
        <button
          type="button"
          onClick={() => { onUpdate('importance', 7); onUpdate('urgency', 5); onUpdate('energy', 4); }}
          className="px-2 py-0.5 rounded-md bg-white/5 hover:bg-white/15 border border-white/10 text-[10px] font-bold text-blue-300 transition-colors"
          title="Importance 7, Urgency 5, Effort 4"
        >
          🛡️ Habit
        </button>
      </div>
      
      <div className="selected-panel-metrics flex flex-col gap-4">
         <RangeControl label="Importance" value={priority.importance} color={priority.hue} onChange={(v) => onUpdate('importance', v)} />
         <RangeControl label="Urgency" value={priority.urgency} color={priority.hue} onChange={(v) => onUpdate('urgency', v)} />
         <RangeControl label="Energy / Effort" value={priority.energy} color={priority.hue} onChange={(v) => onUpdate('energy', v)} />
      </div>
      
      <div className="selected-panel-actions flex items-center gap-3 mt-4">
        <button type="button" onClick={onRequestRemove} aria-label="Delete priority" className="selected-panel-delete w-10 h-10 rounded-xl border border-white/10 bg-white/5 text-white/40 flex items-center justify-center hover:bg-red-500/20 hover:text-red-400 hover:border-red-500/30 transition-colors">
          <Trash2 size={16} />
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" aria-label={`More actions for ${priority.name}`} className="selected-panel-more">
              <MoreHorizontal size={20} aria-hidden="true" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="focus-context-menu">
            <DropdownMenuItem className="focus-context-danger" onSelect={onRequestRemove}>
              <Trash2 size={16} aria-hidden="true" />
              Remove priority
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <button type="submit" className="flex-1 h-10 rounded-xl border border-white/10 bg-white/5 text-[13px] font-bold text-white hover:bg-white/10 transition-colors">
          Save Name
        </button>
        <button
          type="button"
          onClick={onComplete}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ' || event.key === 'Space' || event.key === 'Spacebar') {
              event.preventDefault();
              onComplete();
            }
          }}
          aria-label="Complete task"
          title="Complete task"
          className="complete-task-corner flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl border border-emerald-400/40 bg-emerald-400/15 px-3 text-[13px] font-bold text-emerald-300 transition-all hover:scale-[1.01] hover:border-emerald-300/80 hover:bg-emerald-400/30 hover:text-emerald-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/70"
        >
          <CheckCircle2 size={17} aria-hidden="true" />
          <span>Complete Task</span>
        </button>
      </div>
          </motion.div>
        )}
      </AnimatePresence>
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
  const dialogRef = useDialogFocus<HTMLFormElement>(onClose);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (trimmed) onCreate(trimmed);
  };

  return (
    <motion.div
      className="add-dialog-overlay fixed inset-0 z-50 grid place-items-center p-4 bg-background/60 backdrop-blur-sm"
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
        ref={dialogRef}
        role="dialog" 
        tabIndex={-1}
        aria-modal="true"
        aria-labelledby="add-priority-title"
        initial={{ scale: 0.95, y: 15, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        exit={{ scale: 0.95, y: 10, opacity: 0 }}
        transition={{ type: "spring", damping: 25, stiffness: 350 }}
      >
        <div className="flex justify-between gap-5 mb-6">
          <div>
            <h2 id="add-priority-title" className="font-display text-xl font-bold m-0 text-white tracking-wide">New celestial body</h2>
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
            placeholder="e.g. Launch product beta"
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

  useEffect(() => {
    urgencySpring.set(priority.urgency);
  }, [priority.urgency, urgencySpring]);

  const size = useTransform(() => `${(18 + (10 - urgencySpring.get()) * 2.9) * 2}%`);
  
  return (
    <motion.div
      className="orbit-track absolute left-1/2 top-1/2 pointer-events-none"
      style={{
        x: '-50%',
        y: '-50%',
        width: size,
        height: size,
        borderRadius: '50%',
        border: `1.5px solid ${priority.hue}28`,
        boxShadow: `0 0 14px ${priority.hue}12`,
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
  
  const size = useTransform(() => `${(18 + (10 - urgencySpring.get()) * 2.9) * 2}%`);
  
  return (
    <motion.div
      className="orbit-track orbit-track-selected absolute left-1/2 top-1/2 pointer-events-none z-0"
      style={{
        x: '-50%',
        y: '-50%',
        width: size,
        height: size,
        borderRadius: '50%',
        border: '2px solid var(--borderColor)',
        boxShadow: '0 0 25px var(--borderColor) inset, 0 0 25px var(--borderColor)',
        '--borderColor': priority.hue,
      } as any}
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 0.9, scale: 1 }}
      exit={{ opacity: 0, scale: 1.04 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
    />
  );
}

function OrbComponent({ 
  priority, 
  index, 
  selectedId,
  onSelect,
  isCompleting,
  isFocusModeOpen,
  prefersReducedMotion 
}: { 
  priority: Priority; 
  index: number; 
  selectedId: string | null;
  onSelect: (id: string) => void;
  isCompleting: boolean;
  isFocusModeOpen: boolean;
  prefersReducedMotion: boolean;
}) {
  const isSelected = selectedId === priority.id;
  const isUnrelated = selectedId !== null && !isSelected;
  const score = getFocusScore(priority);
  const [isHovered, setIsHovered] = useState(false);
  const [hitLayer, setHitLayer] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setHitLayer(document.getElementById('orb-hit-layer'));
  }, []);
  
  const baseAngle = useMemo(() => getPlanetBaseAngle(priority.id), [priority.id]);
  const drift = useMotionValue(0);
  const planetRef = useRef<HTMLDivElement>(null);
  const hitX = useMotionValue(0);
  const hitY = useMotionValue(0);
  
  const urgencySpring = useSpring(priority.urgency, { stiffness: 50, damping: 15 });
  const importanceSpring = useSpring(priority.importance, { stiffness: 50, damping: 15 });
  
  useEffect(() => {
    urgencySpring.set(priority.urgency);
    importanceSpring.set(priority.importance);
  }, [priority.urgency, priority.importance, urgencySpring, importanceSpring]);

  // Continuous physics loop: accumulated delta time guarantees zero snapping or resets
  useEffect(() => {
    if (prefersReducedMotion || isFocusModeOpen) return;
    let lastTime = performance.now();
    let animId: number;
    const tick = (now: number) => {
      const dt = (now - lastTime) / 1000;
      lastTime = now;
      // Gentle slowdown on hover or selection for effortless clicking and reading
      const speedMult = isHovered ? 0.15 : isSelected ? 0.35 : 1.0;
      // Keplerian orbit: inner orbits rotate faster (48s to 120s)
      const period = 48 + (10 - urgencySpring.get()) * 8;
      const angularSpeed = (2 * Math.PI) / period;
      drift.set(drift.get() + angularSpeed * dt * speedMult);
      animId = requestAnimationFrame(tick);
    };
    animId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animId);
  }, [prefersReducedMotion, isFocusModeOpen, isHovered, isSelected, urgencySpring, drift]);

  useEffect(() => {
    let frame = 0;
    const syncHitArea = () => {
      const rect = planetRef.current?.getBoundingClientRect();
      if (rect) {
        hitX.set(rect.left + rect.width / 2);
        hitY.set(rect.top + rect.height / 2);
      }
      frame = requestAnimationFrame(syncHitArea);
    };
    frame = requestAnimationFrame(syncHitArea);
    return () => cancelAnimationFrame(frame);
  }, [hitX, hitY]);

  // True 3D coordinate inside the tilted orbital plane:
  // Since the plane itself is tilted (rotateX 56deg, rotateZ -10deg),
  // placing bodies at (cos θ * R, sin θ * R) guarantees they ride EXACTLY on the ring!
  const x = useTransform(() => {
    const angle = baseAngle + drift.get();
    const radius = 18 + (10 - urgencySpring.get()) * 2.9;
    return `${50 + Math.cos(angle) * radius}%`;
  });
  
  const y = useTransform(() => {
    const angle = baseAngle + drift.get();
    const radius = 18 + (10 - urgencySpring.get()) * 2.9;
    return `${50 + Math.sin(angle) * radius}%`;
  });

  // Continuous depth keeps overlapping planets ordered by their orbital phase.
  const depthZIndex = useTransform(() => {
    if (isSelected) return 35;
    const sinVal = Math.sin(baseAngle + drift.get());
    return Math.round(10 + sinVal * 9);
  });

  const depthScale = useTransform(() => {
    const sinVal = Math.sin(baseAngle + drift.get());
    return 0.90 + sinVal * 0.14; // subtle scale modulation with depth
  });

  const depthFilter = useTransform(() => {
    if (isCompleting) return 'none';
    const sinVal = Math.sin(baseAngle + drift.get());
    const brightness = (0.90 + sinVal * 0.14).toFixed(2);
    if (isUnrelated) return `brightness(${Number(brightness) * 0.78}) grayscale(15%)`;
    return `brightness(${brightness})`;
  });
  
  const size = useTransform(() => 36 + importanceSpring.get() * 5.5);

  // Gas giant planetary ring for high-energy or specific flagship priorities
  const hasPlanetaryRing = priority.energy >= 7 || priority.id === 'signalboard' || priority.id === 'job-search';

  const handleScreenClick = (event: ReactMouseEvent<HTMLButtonElement>) => {
    if (event.detail > 0) {
      let nearest: HTMLButtonElement | null = null;
      let nearestDistance = Infinity;
      for (const button of document.querySelectorAll<HTMLButtonElement>('.orb-screen-hit')) {
        const rect = button.getBoundingClientRect();
        const distance = Math.hypot(
          event.clientX - (rect.left + rect.width / 2),
          event.clientY - (rect.top + rect.height / 2),
        );
        if (distance < nearestDistance) {
          nearest = button;
          nearestDistance = distance;
        }
      }
      if (nearest && nearest !== event.currentTarget) {
        event.preventDefault();
        event.stopPropagation();
        nearest.focus({ preventScroll: true });
        nearest.dispatchEvent(new window.MouseEvent('click', {
          bubbles: true,
          cancelable: true,
          clientX: event.clientX,
          clientY: event.clientY,
          detail: event.detail,
          view: window,
        }));
        return;
      }
    }
    onSelect(priority.id);
  };

  return (
    <motion.div
      className="orb-hit-container"
      style={{
        left: x,
        top: y,
        position: 'absolute',
        x: '-50%',
        y: '-50%',
        transformStyle: 'preserve-3d',
        zIndex: depthZIndex,
        scale: depthScale,
        filter: depthFilter,
      }}
      initial={{ scale: 0, opacity: 0 }}
      animate={{ 
        opacity: isUnrelated ? 0.72 : 1,
      }}
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
    >
      {/* Supernova Completion Burst */}
      {isCompleting && (
        <>
          <div className="supernova-burst" style={{ '--burst-color': priority.hue } as any} />
          <div className="supernova-shockwave" style={{ '--burst-color': priority.hue } as any} />
        </>
      )}

      <div className="orb-billboard" aria-hidden="true">
        <motion.div
          ref={planetRef}
          className="orb-anchor"
          style={{ width: size, height: size }}
        />
      </div>
      {hitLayer && createPortal(
        <motion.div
          className="orb-screen-visual"
          data-priority-id={priority.id}
          data-selected={isSelected ? 'true' : 'false'}
          aria-hidden="true"
          style={{
            left: hitX,
            top: hitY,
            width: size,
            height: size,
            x: '-50%',
            y: '-50%',
            zIndex: depthZIndex,
            scale: depthScale,
            filter: depthFilter,
          }}
          animate={{ opacity: isUnrelated ? 0.72 : 1 }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        >
          <motion.div
            className={`orb-wrapper ${isSelected ? 'selected' : ''}`}
            style={{ '--orb-color': priority.hue } as CSSProperties}
            animate={{ scale: isHovered && !isCompleting ? 1.08 : 1 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
          >
            <div className="relative">
              <div className="orb-score-badge absolute -top-3 -right-3 px-2 py-0.5 rounded-full text-[10px] font-bold font-display z-20 text-white backdrop-blur-md" style={{
                backgroundColor: 'rgba(0,0,0,0.65)',
                border: `1px solid ${priority.hue}70`,
                boxShadow: `0 0 10px ${priority.hue}40`,
              }}>
                {score}
              </div>

              {hasPlanetaryRing && <div className="orb-planet-ring" />}

              <motion.div
                className="orb-planet"
                style={{
                  width: size,
                  height: size,
                } as any}
              />
            </div>
            <div className="orb-label mt-2 pointer-events-none">
              <span className="orb-name block text-[13px] font-sans font-bold text-white tracking-wide">{priority.name}</span>
              <span className="orb-sub block text-[9px] font-display font-bold tracking-widest mt-0.5" style={{ color: `${priority.hue}` }}>
                {getSubLabel(priority.name)}
              </span>
            </div>
          </motion.div>
        </motion.div>,
        hitLayer,
      )}
      {hitLayer && createPortal(
        <motion.button
          type="button"
          className="orb-screen-hit"
          aria-label={`Select ${priority.name}`}
          aria-pressed={isSelected}
          data-testid={`orb-${priority.id}`}
          style={{ left: hitX, top: hitY, zIndex: depthZIndex }}
          onClick={handleScreenClick}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              onSelect(priority.id);
            }
          }}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          onFocus={() => setIsHovered(true)}
          onBlur={() => setIsHovered(false)}
        />,
        hitLayer,
      )}
    </motion.div>
  );
}

function LivingCore({
  topPriorities,
  totalPriorities,
  onSelectTop,
}: {
  topPriorities: Priority[];
  totalPriorities: number;
  onSelectTop: () => void;
}) {
  const [isHovered, setIsHovered] = useState(false);
  const lead = topPriorities[0];
  const equilibrium = useMemo(() => {
    if (totalPriorities === 0) return 100;
    const avgScore = topPriorities.reduce((sum, p) => sum + getFocusScore(p), 0) / topPriorities.length;
    return Math.max(10, Math.min(100, Math.round(100 - Math.abs(avgScore - 70))));
  }, [topPriorities, totalPriorities]);

  return (
    <motion.div
      className="core-container w-[132px] h-[132px] md:w-[150px] md:h-[150px] z-10"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={onSelectTop}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.96 }}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelectTop();
        }
      }}
      aria-label="Center of Gravity: YOU / NOW. Click to focus highest priority."
      title="YOU / NOW • Center of Gravity (Click to select highest focus)"
    >
      <div className="core-corona" />
      <div className="core-grav-wave" />
      <div className="core-grav-wave" />
      <div className="core-body" />
      <div className="core-text">
        <span className="core-title">YOU / NOW</span>
        <span className="core-subtitle">Center of Gravity</span>
      </div>
      <AnimatePresence>
        {isHovered && (
          <motion.div
            className="core-status-badge flex items-center gap-1.5"
            initial={{ opacity: 0, y: 4, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.95 }}
            transition={{ duration: 0.2 }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            <span>Equilibrium {equilibrium}%</span>
            <span className="text-white/40">•</span>
            <span>{totalPriorities} {totalPriorities === 1 ? 'Body' : 'Bodies'}</span>
            {lead && (
              <>
                <span className="text-white/40">•</span>
                <span className="text-amber-300 font-bold">Top: {lead.name}</span>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
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
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [isMobileViewport, setIsMobileViewport] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches,
  );
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSelectedPanelExpanded, setIsSelectedPanelExpanded] = useState(false);
  const [focusSession, setFocusSession] = useState<{
    priorityId: string;
    origin: PlanetFocusOrigin | null;
    opener: HTMLElement | null;
  } | null>(null);
  const [panelsOpen, setPanelsOpen] = useState(true);
  const [isZenMode, setIsZenMode] = useState(false);
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [cosmosBrightness, setCosmosBrightness] = useState(100);
  const mobileMenuRef = useRef<HTMLDivElement>(null);
  const galaxyAppRef = useRef<HTMLDivElement>(null);
  const mobileMenuTriggerRef = useRef<HTMLButtonElement>(null);
  const confirmationOpenerRef = useRef<HTMLElement | null>(null);
  const { toast } = useToast();
  
  const prefersReducedMotion = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isPlanetFocusOpen = focusSession !== null;

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 767px)');
    const updateViewport = () => setIsMobileViewport(mediaQuery.matches);
    mediaQuery.addEventListener('change', updateViewport);
    updateViewport();
    return () => mediaQuery.removeEventListener('change', updateViewport);
  }, []);

  useEffect(() => {
    if (!isMobileMenuOpen || !isMobileViewport) return;
    const menu = mobileMenuRef.current;
    const focusFrame = requestAnimationFrame(() => {
      menu?.querySelector<HTMLElement>('button:not([disabled]), input:not([disabled]), select:not([disabled])')?.focus({ preventScroll: true });
    });
    const closeOnOutsidePointer = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Node && (menu?.contains(target) || mobileMenuTriggerRef.current?.contains(target))) return;
      setIsMobileMenuOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      setIsMobileMenuOpen(false);
      mobileMenuTriggerRef.current?.focus({ preventScroll: true });
    };
    window.addEventListener('pointerdown', closeOnOutsidePointer);
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      cancelAnimationFrame(focusFrame);
      window.removeEventListener('pointerdown', closeOnOutsidePointer);
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [isMobileMenuOpen, isMobileViewport]);

  useEffect(() => {
    if (!isMobileViewport) setIsMobileMenuOpen(false);
  }, [isMobileViewport]);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(priorities));
  }, [priorities]);

  useEffect(() => {
    const galaxy = galaxyAppRef.current;
    if (!galaxy) return;
    if (isPlanetFocusOpen) galaxy.setAttribute('inert', '');
    else galaxy.removeAttribute('inert');
  }, [isPlanetFocusOpen]);
  
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
    playCosmicChime(587.33);
    toast({
      title: "✦ New Orbit Established",
      description: `"${name}" placed in your sky.`,
    });
  };

  const updatePriority = (id: string, metric: MetricKey, val: number) => {
    setPriorities(prev => prev.map(p => p.id === id ? { ...p, [metric]: val } : p));
  };

  const updatePriorityNotes = (id: string, notes: string) => {
    setPriorities(prev => prev.map(p => p.id === id ? { ...p, notes } : p));
  };
  
  const renamePriority = (id: string, name: string) => {
    setPriorities(prev => prev.map(p => p.id === id ? { ...p, name } : p));
  };

  const removePriority = (id: string) => {
    setPriorities(prev => prev.filter(p => p.id !== id));
    if (selectedId === id) setSelectedId(null);
  };

  const openConfirmation = (nextConfirmation: Confirmation) => {
    confirmationOpenerRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    setConfirmation(nextConfirmation);
  };

  const requestRemovePriority = (id: string) => {
    const priority = priorities.find((item) => item.id === id);
    if (!priority) return;
    openConfirmation({
      title: `Remove ${priority.name}?`,
      description: 'This priority will leave your galaxy. You can add it again at any time.',
      confirmLabel: 'Remove Priority',
      onConfirm: () => removePriority(id),
    });
  };

  const selectPriority = (id: string) => {
    setSelectedId(id);
    setIsSelectedPanelExpanded(false);
    setPanelsOpen(true);
    const p = priorities.find(x => x.id === id);
    if (p) playCosmicChime(440 + p.urgency * 35);
  };

  const enterPlanetFocus = (id: string, opener: HTMLElement) => {
    const visual = Array.from(document.querySelectorAll<HTMLElement>('.orb-screen-visual[data-priority-id]'))
      .find((element) => element.dataset.priorityId === id);
    const rect = visual?.getBoundingClientRect();
    const origin = rect && rect.width > 0 && rect.height > 0
      ? { left: rect.left, top: rect.top, width: rect.width, height: rect.height }
      : null;
    setFocusSession({ priorityId: id, origin, opener });
  };

  const completePriority = (id: string) => {
    const p = priorities.find(x => x.id === id);
    if (!p) return;
    setCompletingId(id);
    playSupernovaChime();
    toast({
      title: "✦ Orbit Completed",
      description: `"${p.name}" has been harmonized into your galaxy.`,
    });
    setTimeout(() => {
      removePriority(id);
      setCompletingId(null);
    }, 650);
  };

  const requestResetPriorities = () => {
    openConfirmation({
      title: 'Reset your galaxy?',
      description: 'Restore the original priorities and remove your changes.',
      confirmLabel: 'Reset Galaxy',
      onConfirm: () => {
        setPriorities(seedPriorities);
        setSelectedId(null);
        setIsSelectedPanelExpanded(false);
        setIsMobileMenuOpen(false);
        toast({
          title: "Galaxy Reset",
          description: "Initial solar priorities restored.",
        });
      },
    });
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target instanceof HTMLElement ? e.target : null;
      if (isAddOpen || isManageOpen || confirmation || isMobileMenuOpen || isPlanetFocusOpen) return;
      if (target?.closest('[role="tablist"], [role="dialog"], [role="alertdialog"]')) return;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target?.tagName ?? '')) return;
      if (e.key === 'Escape') {
        setSelectedId(null);
        setIsZenMode(false);
      } else if (e.key === ']' || e.key === 'ArrowRight') {
        e.preventDefault();
        if (priorities.length === 0) return;
        const idx = priorities.findIndex(p => p.id === selectedId);
        const next = priorities[(idx + 1) % priorities.length];
        selectPriority(next.id);
      } else if (e.key === '[' || e.key === 'ArrowLeft') {
        e.preventDefault();
        if (priorities.length === 0) return;
        const idx = priorities.findIndex(p => p.id === selectedId);
        const prev = priorities[(idx - 1 + priorities.length) % priorities.length];
        selectPriority(prev.id);
      } else if (e.key.toLowerCase() === 'f') {
        e.preventDefault();
        setPanelsOpen(prev => !prev);
      } else if (e.key.toLowerCase() === 'z') {
        e.preventDefault();
        setIsZenMode(prev => !prev);
      } else if (e.key.toLowerCase() === 'a') {
        e.preventDefault();
        setIsAddOpen(true);
      } else if (e.key.toLowerCase() === 'm') {
        e.preventDefault();
        setIsManageOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [priorities, selectedId, isAddOpen, isManageOpen, confirmation, isMobileMenuOpen, isPlanetFocusOpen]);

  const rankedPriorities = useMemo(
    () => [...priorities].sort((a, b) => getFocusScore(b) - getFocusScore(a)),
    [priorities],
  );
  const topPriorities = rankedPriorities.slice(0, 3);
  const selectedPriority = priorities.find(p => p.id === selectedId);
  const focusPriority = focusSession ? priorities.find((p) => p.id === focusSession.priorityId) : undefined;
  
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
    return `${selectedPriority.name} is steadily in orbit. Adjust its metrics if the situation shifts.`;
  }, [selectedPriority, topPriorities, priorities.length]);

  const insightTitle = useMemo(() => {
    if (!priorities.length) return "Field is open.";
    if (!selectedPriority) {
      return topPriorities[0] && getFocusScore(topPriorities[0]) > 80
        ? "Attention is concentrating."
        : "Field is balanced.";
    }
    return "You're pulled toward action.";
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
      ref={galaxyAppRef}
      className={`focus-galaxy-app relative w-full h-[100dvh] overflow-hidden bg-background select-none ${isZenMode ? 'zen-mode' : ''}${isMobileViewport && isSelectedPanelExpanded ? ' mobile-detail-expanded' : ''}`}
      style={cosmosVisualStyle}
      aria-hidden={isPlanetFocusOpen}
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

      <header className="app-header fixed top-0 left-0 right-0 z-30 pointer-events-none">
        <div className="header-inner flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="header-brand flex flex-col items-start gap-1 pointer-events-auto">
            <AppLogo />
            <span className="text-[11px] text-white/60 font-medium ml-1">Turn your priorities into clarity.</span>
          </div>
          
          <div className="header-actions flex flex-col md:flex-row items-center gap-3 pointer-events-auto">
            <button onClick={() => setIsAddOpen(true)} aria-label="Add priority" className="header-add flex items-center gap-2 px-5 py-2 rounded-full border border-primary/50 bg-primary/20 hover:bg-primary/30 text-white text-xs font-bold transition-colors shadow-[0_0_15px_rgba(155,91,228,0.3)]">
              <Plus size={14} strokeWidth={3} /> <span className="header-add-label">Add Priority</span>
            </button>

            <div
              id="mobile-galaxy-controls"
              ref={mobileMenuRef}
              className={`header-utilities flex items-center gap-2${isMobileMenuOpen ? ' is-open' : ''}`}
              role="group"
              aria-label="Galaxy controls"
            >
              <div className="mobile-control-section">
                <span className="mobile-control-heading">Sound & atmosphere</span>
                <FocusAudio />
                <CosmosBrightnessControl value={cosmosBrightness} onChange={setCosmosBrightness} />
              </div>

              <div className="mobile-control-actions">
                <button onClick={() => { setIsMobileMenuOpen(false); setIsManageOpen(true); }} aria-label="Manage priorities" className="header-manage flex items-center gap-2 px-4 py-2 rounded-full border border-white/10 bg-white/5 hover:bg-white/10 text-white/70 hover:text-white text-xs font-bold transition-colors">
                  <ListChecks size={16} />
                  <span className="header-manage-label">Manage</span>
                  <span className="mobile-control-label">Manage priorities</span>
                </button>

                <button onClick={() => { setIsMobileMenuOpen(false); requestResetPriorities(); }} className="header-reset w-10 h-10 rounded-full border border-white/10 bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/70 hover:text-white transition-colors shadow-[0_4px_10px_rgba(0,0,0,0.5)]" aria-label="Reset priorities">
                  <RotateCcw size={16} />
                  <span className="mobile-control-label">Reset galaxy</span>
                </button>
              </div>
            </div>

            <button
              ref={mobileMenuTriggerRef}
              type="button"
              id="mobile-galaxy-controls-trigger"
              className="mobile-overflow-button"
              aria-label={isMobileMenuOpen ? 'Close galaxy controls' : 'Open galaxy controls'}
              aria-controls="mobile-galaxy-controls"
              aria-expanded={isMobileMenuOpen}
              onClick={() => setIsMobileMenuOpen((open) => !open)}
            >
              <MoreHorizontal size={21} aria-hidden="true" />
            </button>
          </div>
        </div>
      </header>

      <div id="orb-hit-layer" className="orb-hit-layer absolute inset-0 pointer-events-none" />

      <motion.div
        className="galaxy-viewport absolute inset-0 z-10 pointer-events-none"
        style={{ x: panX, y: panY, rotateX: tiltX, rotateY: tiltY, transformPerspective: 1400, transformStyle: 'preserve-3d' }}
      >
        <div className="galaxy-layer absolute inset-0 transform-gpu origin-center pointer-events-none">
          
          {/* Tilted 3D Orbital Plane */}
          <div className="orbital-plane">
            <OrbitRings priorities={priorities} />

            {selectedPriority && (
               <AnimatePresence>
                  <SelectedOrbitRing key={`selected-ring-${selectedPriority.id}`} priority={selectedPriority} />
               </AnimatePresence>
            )}

            <AnimatePresence>
              {priorities.map((p, i) => (
                <OrbComponent
                  key={p.id}
                  priority={p}
                  index={i}
                  selectedId={selectedId}
                  onSelect={selectPriority}
                  isCompleting={p.id === completingId}
                  isFocusModeOpen={isPlanetFocusOpen}
                  prefersReducedMotion={prefersReducedMotion}
                />
              ))}
            </AnimatePresence>
          </div>

          {/* Living Center of Gravity (YOU / NOW) */}
          <LivingCore
            topPriorities={topPriorities}
            totalPriorities={priorities.length}
            onSelectTop={() => {
              if (topPriorities[0]) selectPriority(topPriorities[0].id);
            }}
          />
          
        </div>
      </motion.div>

      <div className="cosmos-dim-layer absolute inset-0 z-[15] pointer-events-none" aria-hidden="true" />
      <div className="cosmos-lift-layer absolute inset-0 z-[15] pointer-events-none" aria-hidden="true" />
      
      <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-background via-background/80 to-transparent pointer-events-none z-10" />

      <motion.div
        className="insight-dock absolute bottom-28 left-6 right-6 flex flex-col xl:flex-row items-end xl:items-end justify-center gap-8 z-20 pointer-events-none"
        animate={{ y: (panelsOpen && !isZenMode) ? 0 : 320 }}
        transition={prefersReducedMotion ? { duration: 0 } : { type: 'spring', stiffness: 180, damping: 24 }}
      >
        <button
          type="button"
          onClick={() => setPanelsOpen((open) => !open)}
          className="hidden xl:flex absolute right-0 -top-10 z-30 h-8 items-center gap-2 rounded-full border border-white/15 bg-[#110d19]/90 px-4 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/65 backdrop-blur-xl hover:border-primary/40 hover:text-white pointer-events-auto"
          aria-expanded={panelsOpen}
        >
          {panelsOpen ? <ChevronDown size={13} /> : <ChevronUp size={13} />}
          {panelsOpen ? 'Focus on galaxy (F)' : 'Show insights (F)'}
        </button>
        
        <div className="panel-slot panel-slot-signal w-full xl:w-[min(30vw,400px)] shrink-0 transform-gpu transition-all duration-500 hidden md:block">
           <FocusSignalPanel 
             rankedPriorities={rankedPriorities}
             onSelect={selectPriority}
             onRename={renamePriority}
             color={topPriorities[0]?.hue || '#9b5be4'}
             summary={getSignalSummary(topPriorities)}
           />
        </div>
        
        <div className="panel-slot panel-slot-insight w-full xl:w-[min(30vw,400px)] shrink-0 transform-gpu transition-all duration-500 hidden md:block">
           <InsightPanel 
             insight={insight} 
             title={insightTitle}
             priority={selectedPriority || topPriorities[0]} 
           />
        </div>
        
        <AnimatePresence initial={false} mode="popLayout">
          {selectedPriority && (
            <div key={selectedPriority.id} className="panel-slot panel-slot-selected w-full xl:w-[min(30vw,400px)] shrink-0 transform-gpu transition-all duration-500">
              <motion.div
                className="h-full"
                initial={prefersReducedMotion ? false : { opacity: 0, y: 18, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={prefersReducedMotion ? undefined : { opacity: 0, y: 18, scale: 0.98 }}
                transition={prefersReducedMotion ? { duration: 0 } : { type: 'spring', stiffness: 220, damping: 24 }}
              >
                <SelectedPanel
                  priority={selectedPriority}
                  onUpdate={(metric, val) => updatePriority(selectedPriority.id, metric, val)}
                  onRename={(name) => renamePriority(selectedPriority.id, name)}
                  onEnterFocus={(opener) => enterPlanetFocus(selectedPriority.id, opener)}
                  onComplete={() => completePriority(selectedPriority.id)}
                  onClose={() => setSelectedId(null)}
                  onRequestRemove={() => requestRemovePriority(selectedPriority.id)}
                  isMobile={isMobileViewport}
                  isExpanded={isSelectedPanelExpanded}
                  onToggleExpanded={(expanded) => setIsSelectedPanelExpanded(expanded)}
                  prefersReducedMotion={prefersReducedMotion}
                />
              </motion.div>
            </div>
          )}
        </AnimatePresence>
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
            onSelect={(id) => {
              selectPriority(id);
              setIsMobileMenuOpen(false);
            }}
            onRename={renamePriority}
            onRequestRemove={requestRemovePriority}
          />
        )}
        <ConfirmActionDialog
          confirmation={confirmation}
          openerRef={confirmationOpenerRef}
          onClose={() => setConfirmation(null)}
        />
      </AnimatePresence>

      {focusPriority && focusSession && createPortal(
        <PlanetFocusMode
          priority={focusPriority}
          score={getFocusScore(focusPriority)}
          origin={focusSession.origin}
          prefersReducedMotion={prefersReducedMotion}
          onUpdateNotes={(notes) => updatePriorityNotes(focusPriority.id, notes)}
          onClose={() => {
            const opener = focusSession.opener;
            galaxyAppRef.current?.removeAttribute('inert');
            setFocusSession(null);
            requestAnimationFrame(() => {
              if (opener?.isConnected) opener.focus({ preventScroll: true });
            });
          }}
        />,
        document.body,
      )}

      {/* Keyboard Shortcuts and Galaxy Explore Pill */}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-30 pointer-events-auto hidden md:flex items-center gap-3 opacity-60 hover:opacity-100 transition-opacity bg-black/50 px-4 py-1.5 rounded-full border border-white/10 backdrop-blur-md text-[11px] text-white/70">
        <span className="font-semibold text-white/90">Shortcuts:</span>
        <span><kbd className="px-1.5 py-0.5 rounded bg-white/10 border border-white/15 text-[10px] text-white">[</kbd> / <kbd className="px-1.5 py-0.5 rounded bg-white/10 border border-white/15 text-[10px] text-white">]</kbd> Cycle</span>
        <span className="text-white/20">•</span>
        <span><kbd className="px-1.5 py-0.5 rounded bg-white/10 border border-white/15 text-[10px] text-white">F</kbd> Dock</span>
        <span className="text-white/20">•</span>
        <span><kbd className="px-1.5 py-0.5 rounded bg-white/10 border border-white/15 text-[10px] text-white">Esc</kbd> Deselect</span>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <MotionConfig reducedMotion="user">
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Switch>
            <Route path="/" component={FocusGalaxyContainer} />
            <Route component={NotFound} />
          </Switch>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </MotionConfig>
  );
}
