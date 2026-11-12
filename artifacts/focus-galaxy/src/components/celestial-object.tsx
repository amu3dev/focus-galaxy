import { useId, type ReactNode } from 'react';
import { resolveAppearance, type CelestialAppearance } from '../lib/cosmic-appearance';

// Light, midtone and shadow are material colors, independent of the parent planet.
const materials: Record<CelestialAppearance, readonly [string, string, string]> = {
  'lunar-moon': ['#f0f3ff', '#93a3c2', '#18243c'],
  comet: ['#edffff', '#79dcdf', '#237691'],
  asteroid: ['#d1b394', '#867366', '#3c3340'],
  satellite: ['#fff1bb', '#d6aa50', '#614730'],
  rocket: ['#ffffff', '#becce0', '#425575'],
  meteor: ['#fff6b0', '#f9ac47', '#9c392c'],
  'mini-planet': ['#c3f3ef', '#4aabc3', '#1b3f70'],
  'star-core': ['#fffce1', '#ffd46c', '#e17c37'],
  'ringed-moon': ['#f2e8ff', '#b2a1d2', '#43395f'],
  'explorer-probe': ['#ffecaf', '#b6955c', '#4c4960'],
  'crystal-shard': ['#f2eaff', '#b899ed', '#52488d'],
  'energy-orb': ['#e2ffff', '#68d4ee', '#2862a1'],
  'stardust-cluster': ['#ffe9ee', '#e7a2ca', '#925587'],
  'ice-fragment': ['#f0ffff', '#a1d9e4', '#5386b8'],
  prism: ['#e2fcff', '#a1c6e5', '#65549b'],
  'ancient-relic': ['#f6df9f', '#be945b', '#655144'],
  'vortex-core': ['#e6d9ff', '#a58ae7', '#514084'],
  'nebula-pearl': ['#fff7ee', '#c6b8df', '#777ba9'],
  'solar-gem': ['#fff3c4', '#efb45e', '#a65c39'],
  'quantum-cube': ['#e2fff5', '#83d4c6', '#3b7d98'],
};

/** Static miniatures: the orbital system owns all motion and interaction. */
export function CelestialObject({ type, appearance, className }: {
  type: 'task' | 'note'; appearance?: unknown; className?: string;
}) {
  const resolved = resolveAppearance(type, appearance);
  const id = `celestial-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const [highlight, midtone, shadow] = materials[resolved];
  const body = `url(#${id}-body)`;
  const facet = `url(#${id}-facet)`;
  const metal = `url(#${id}-metal)`;
  let artwork: ReactNode;

  switch (resolved) {
    case 'lunar-moon':
      artwork = <>
        <circle cx="32" cy="32" r="24" fill={body} />
        <path d="M18 13C4 27 13 49 32 55A24 24 0 0 1 18 13Z" fill="#e8f0ff" opacity=".24" />
        <ellipse cx="24" cy="24" rx="6" ry="5" fill="#536782" opacity=".72" />
        <path d="M19 25C20 19 27 19 29 24" fill="none" stroke="#d7e3ef" strokeWidth="1.4" opacity=".7" />
        <ellipse cx="40" cy="38" rx="5" ry="4.5" fill="#33445e" opacity=".8" />
        <path d="M36 39C36 34 43 33 45 38" fill="none" stroke="#bbcce1" strokeWidth="1.2" opacity=".7" />
        <circle cx="22" cy="40" r="2.5" fill="#536782" opacity=".6" />
        <circle cx="39" cy="20" r="2" fill="#e3eafa" opacity=".55" />
      </>;
      break;
    case 'comet':
      artwork = <>
        <path d="M12 39C23 27 42 13 58 5C50 23 40 43 25 52Z" fill={facet} opacity=".6" />
        <path d="M17 39C31 24 44 19 52 12C44 29 35 43 23 48Z" fill={body} />
        <path d="M23 39L48 16M29 42L42 28" stroke="#e7ffff" strokeWidth="1.6" strokeLinecap="round" opacity=".75" />
        <path d="M8 45L12 36L22 33L30 40L28 50L19 56L10 52Z" fill={body} />
        <path d="M12 36L19 42L22 33M19 42L28 50L19 56Z" fill="#b8eff1" opacity=".6" />
        <path d="M12 46L18 49L23 44" fill="none" stroke="#3a9bb4" strokeWidth="2" />
      </>;
      break;
    case 'asteroid':
      artwork = <>
        <path d="M19 9L39 7L53 20L57 37L43 54L24 57L9 43L6 25Z" fill={body} />
        <path d="M19 9L22 27L6 25ZM22 27L39 7L53 20L38 31Z" fill="#ddc6a9" opacity=".32" />
        <path d="M38 31L57 37L43 54L24 57L30 41Z" fill="#352f3d" opacity=".38" />
        <path d="M15 39L25 35L30 41L43 44" fill="none" stroke="#d3a374" strokeWidth="1.5" />
        <ellipse cx="24" cy="23" rx="5" ry="4" transform="rotate(-25 24 23)" fill="#60524e" />
        <path d="M20 24Q23 18 28 21" fill="none" stroke="#e1c4a0" />
        <path d="M37 18L43 20L42 25L36 24Z" fill="#65554e" />
        <circle cx="16" cy="33" r="1.7" fill="#e2c2a0" />
      </>;
      break;
    case 'satellite':
      artwork = <g transform="rotate(-22 32 32)">
        <path d="M7 24H23V43H7ZM41 24H57V43H41Z" fill="#27487e" stroke="#93c8e6" strokeWidth="1.4" />
        <path d="M15 24V43M7 30H23M7 36H23M49 24V43M41 30H57M41 36H57" stroke="#7cadd4" strokeWidth=".9" />
        <path d="M22 31H42V35H22Z" fill={metal} />
        <path d="M25 22L37 22L40 28V43L28 46L24 40Z" fill={body} />
        <path d="M25 22L32 27L40 28L37 22ZM32 27V44L40 43V28Z" fill="#8d6b37" opacity=".6" />
        <path d="M29 17V23M34 10V18" stroke="#cfe4f1" strokeWidth="1.7" />
        <path d="M23 12Q31 27 42 13Z" fill={metal} />
        <path d="M25 12Q33 18 41 13" fill="none" stroke="#f2f8ff" strokeWidth="1.3" />
        <circle cx="31" cy="32" r="2.3" fill="#a6e8e9" />
      </g>;
      break;
    case 'rocket':
      artwork = <g transform="rotate(28 32 32)">
        <path d="M27 45Q23 55 32 61Q41 55 37 45Z" fill="#f3a255" />
        <path d="M29 46Q28 54 32 57Q36 53 35 46Z" fill="#fff0b8" />
        <path d="M23 32Q14 36 16 49L27 44M41 32Q50 36 48 49L37 44" fill="#d67d79" stroke="#f5b0a3" strokeWidth="1" />
        <path d="M32 5C21 15 21 26 24 44H40C43 26 43 15 32 5Z" fill={body} />
        <path d="M32 5C38 20 37 32 35 44H40C43 26 43 15 32 5Z" fill="#4b607f" opacity=".55" />
        <path d="M25 15Q32 2 39 15Q32 20 25 15Z" fill="#dd8b85" />
        <circle cx="32" cy="27" r="6" fill="#586d8b" stroke="#e8f3ff" strokeWidth="1.5" />
        <circle cx="31" cy="26" r="3.6" fill="#81c6dd" />
        <path d="M26 41H38L37 47H27Z" fill="#526079" />
      </g>;
      break;
    case 'meteor':
      artwork = <>
        <path d="M43 54C25 49 11 32 5 9L23 21L18 5L36 22L42 15Q60 29 58 43Z" fill={facet} />
        <path d="M38 45Q22 34 15 17L32 29L30 18Q46 28 49 39Z" fill="#fff2bd" />
        <path d="M28 38L33 29L46 27L57 37L54 50L44 58L31 52Z" fill="#654444" />
        <path d="M28 38L39 39L46 27L33 29ZM39 39L54 50L44 58L31 52Z" fill={body} />
        <path d="M35 32L39 39L34 46M39 39L47 36L53 41" fill="none" stroke="#ffcb76" strokeWidth="1.5" />
        <path d="M9 35L17 42M19 49L24 52" stroke="#f9ba66" strokeWidth="2" strokeLinecap="round" />
      </>;
      break;
    case 'mini-planet':
      artwork = <>
        <circle cx="32" cy="32" r="24" fill={body} />
        <path d="M15 16L24 11L32 14L30 21L23 24L21 32L15 30L10 23Z" fill="#a9d4ac" />
        <path d="M39 28L49 24L54 32L51 43L44 50L39 42L35 37Z" fill="#6baea1" />
        <path d="M12 34Q21 29 29 33M28 18Q38 14 47 20M21 45Q30 49 37 46" fill="none" stroke="#e2f4ee" strokeWidth="2.5" strokeLinecap="round" opacity=".72" />
        <path d="M38 9C55 25 51 47 32 56A24 24 0 0 0 38 9Z" fill="#142d59" opacity=".4" />
        <path d="M13 21Q18 12 28 10" fill="none" stroke="#e3ffff" strokeWidth="1.5" opacity=".6" />
      </>;
      break;
    case 'star-core':
      artwork = <>
        <path d="M32 3Q37 18 44 11Q43 23 58 22Q48 31 60 39Q44 38 47 53Q36 45 30 61Q27 46 15 53Q20 41 4 39Q16 31 6 22Q22 25 19 10Q27 20 32 3Z" fill={facet} />
        <path d="M32 12Q36 24 45 19Q41 29 52 33Q40 36 44 46Q33 41 29 53Q26 42 17 44Q22 34 12 29Q25 29 24 18Z" fill="#ffe4a0" />
        <circle cx="32" cy="32" r="14" fill={body} />
        <path d="M23 33Q22 23 32 22M36 41Q43 37 42 30" fill="none" stroke="#fffbee" strokeWidth="2" strokeLinecap="round" opacity=".8" />
        <path d="M26 38Q33 44 37 35Q38 30 33 29" fill="none" stroke="#e99844" strokeWidth="1.5" />
      </>;
      break;
    case 'ringed-moon':
      artwork = <g transform="rotate(-26 32 32)">
        <ellipse cx="32" cy="33" rx="29" ry="10" fill="none" stroke="#a59cc7" strokeWidth="5" />
        <circle cx="32" cy="30" r="19" fill={body} />
        <ellipse cx="26" cy="23" rx="4.5" ry="3.5" fill="#817595" opacity=".65" />
        <path d="M22 23Q25 18 30 22" fill="none" stroke="#ece3fa" />
        <circle cx="39" cy="34" r="3" fill="#6f658d" />
        <path d="M3 33C3 47 61 47 61 33" fill="none" stroke="#ddd3ed" strokeWidth="5" />
        <path d="M4 34C9 45 56 45 60 34" fill="none" stroke="#8c81b0" strokeWidth="1.2" />
      </g>;
      break;
    case 'explorer-probe':
      artwork = <>
        <path d="M30 30L48 49M26 33L15 52M34 26L54 16M43 43L55 54" stroke="#a8b7c9" strokeWidth="2" strokeLinecap="round" />
        <path d="M42 40L51 35L59 47L50 53Z" fill="#345575" stroke="#9bc6df" />
        <path d="M46 38L54 50M45 45L54 40" stroke="#8aaec6" strokeWidth="1" />
        <path d="M24 26L35 23L42 33L33 43L22 37Z" fill={body} />
        <path d="M24 26L31 34L22 37M31 34L42 33L33 43Z" fill="#6c5b46" opacity=".6" />
        <path d="M11 13Q9 36 33 29Z" fill={metal} stroke="#c7d9e6" />
        <path d="M11 13Q22 18 33 29Q20 24 11 13Z" fill="#758ba9" />
        <path d="M22 23L21 9" stroke="#e6ebef" strokeWidth="1.7" />
        <circle cx="21" cy="8" r="2" fill="#c9f5ef" />
        <path d="M12 53H19M52 14L56 18" stroke="#e9d59c" strokeWidth="2" strokeLinecap="round" />
      </>;
      break;
    case 'crystal-shard':
      artwork = <>
        <path d="M19 11H45L56 25L32 56L8 25Z" fill={body} stroke="#d8c5fa" strokeWidth="1.1" strokeLinejoin="round" />
        <path d="M19 11L24 25L8 25ZM45 11L40 25L56 25Z" fill="#dac6f3" />
        <path d="M19 11H45L40 25H24Z" fill="#f3e8ff" opacity=".7" />
        <path d="M24 25H40L32 56Z" fill={facet} />
        <path d="M8 25H24L32 56ZM40 25H56L32 56Z" fill="#514683" opacity=".5" />
        <path d="M19 11L24 25H40L45 11M8 25H56M24 25L32 56L40 25" fill="none" stroke="#eadbff" strokeWidth="1" strokeLinejoin="round" opacity=".8" />
      </>;
      break;
    case 'energy-orb':
      artwork = <>
        <path d="M23 7C2 15 2 47 23 56L26 49C10 40 12 23 26 15Z" fill={metal} />
        <path d="M41 8C61 18 61 47 40 56L37 48C53 41 53 24 38 16Z" fill="#7993ac" />
        <ellipse cx="32" cy="32" rx="22" ry="9" transform="rotate(-35 32 32)" fill="none" stroke="#8dbed2" strokeWidth="1.6" />
        <circle cx="32" cy="32" r="15" fill={body} />
        <path d="M24 36L29 26L34 34L40 27" fill="none" stroke="#edffff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M22 28Q24 20 32 20" fill="none" stroke="#efffff" strokeWidth="1.6" opacity=".8" />
        <circle cx="24" cy="11" r="3" fill="#c0eff5" />
        <circle cx="39" cy="52" r="3" fill="#c0eff5" />
      </>;
      break;
    case 'stardust-cluster':
      artwork = <>
        <path d="M13 41L31 17L49 34L35 53Z" fill="none" stroke="#d7a6bc" strokeWidth="1" strokeDasharray="2 4" />
        <path d="M27 10L37 16L39 33L31 43L23 30Z" fill={body} />
        <path d="M27 10L30 27L23 30M30 27L37 16L39 33L31 43Z" fill="#fff0f2" opacity=".48" />
        <path d="M9 31L19 27L24 40L18 49L8 42Z" fill={facet} />
        <path d="M9 31L15 38L18 49L8 42Z" fill="#f9d8e9" />
        <path d="M45 25L54 31L55 43L44 48L38 38Z" fill={body} />
        <path d="M45 25L46 37L55 43L54 31Z" fill="#f8d8e8" />
        <path d="M33 47L38 52L34 59L29 54Z" fill="#f4dba8" />
        <circle cx="13" cy="18" r="2.2" fill="#f7e3b5" />
        <path d="M48 10V18M44 14H52" stroke="#f2d3b4" strokeWidth="1.4" strokeLinecap="round" />
      </>;
      break;
    case 'ice-fragment':
      artwork = <>
        <path d="M26 5L36 18L48 13L46 30L55 38L40 42L31 59L22 44L10 40L18 28L15 15Z" fill={body} stroke="#c1ebf4" strokeWidth="1" strokeLinejoin="round" />
        <path d="M26 5L27 31L15 15ZM27 31L48 13L46 30L31 59Z" fill="#e1fbff" opacity=".55" />
        <path d="M27 31L40 42L55 38L46 30Z" fill="#5a8fb7" opacity=".65" />
        <path d="M18 28L27 31L22 44L31 59" fill="none" stroke="#f2ffff" strokeWidth="1.6" />
        <path d="M27 31L36 18M27 31L40 36L43 33M27 31L23 22" fill="none" stroke="#72b6cc" strokeWidth="1" />
        <path d="M25 10L24 19M13 38L20 35" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" />
      </>;
      break;
    case 'prism':
      artwork = <>
        <path d="M5 29H24" stroke="#f4f4e3" strokeWidth="2" />
        <path d="M38 29L60 20M39 32L60 31M40 35L60 42" stroke="#ebacb6" strokeWidth="2" opacity=".85" />
        <path d="M39 30L60 25" stroke="#f0d18a" strokeWidth="2" />
        <path d="M39 34L60 36" stroke="#a1dfd0" strokeWidth="2" />
        <path d="M29 8L49 46L16 54L12 46Z" fill={body} stroke="#d1e6f8" strokeWidth="1" strokeLinejoin="round" />
        <path d="M29 8L36 43L16 54L12 46Z" fill="#f0f8ff" opacity=".38" />
        <path d="M29 8L49 46L36 43Z" fill="#6679b3" opacity=".6" />
        <path d="M12 46L36 43L49 46L16 54Z" fill="#8177ab" />
        <path d="M29 8L36 43L12 46M36 43L16 54" fill="none" stroke="#effaff" strokeWidth="1.1" />
        <path d="M21 32L26 20L31 34Z" fill="#f7f9ff" opacity=".35" />
      </>;
      break;
    case 'ancient-relic':
      artwork = <g transform="rotate(12 32 32)">
        <path d="M16 8L43 6L53 18L51 49L39 58L12 52L10 21Z" fill={body} />
        <path d="M16 8L19 15L14 23L17 47L39 52L51 45L51 49L39 58L12 52L10 21Z" fill="#5e534b" opacity=".65" />
        <path d="M21 17L39 14L45 22L43 44L35 49L20 44L18 24Z" fill="#615c51" stroke="#e1bd79" strokeWidth="1.4" />
        <path d="M31 20L41 30L31 42L23 31Z" fill="#79b8b1" />
        <path d="M31 20V42L23 31Z" fill="#c1e0c8" />
        <path d="M28 28L34 27L35 33L29 35Z" fill="#426d70" />
        <path d="M22 10L29 10M44 18L47 22M22 49L28 51M15 28V35" stroke="#f1d497" strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="35" cy="11" r="1.3" fill="#fff0bc" />
      </g>;
      break;
    case 'vortex-core':
      artwork = <>
        <path d="M34 6C53 7 64 29 52 46C41 63 14 58 8 40C2 23 17 8 33 15C45 20 49 39 37 45C28 51 17 42 21 32C23 25 32 24 36 30C30 26 26 31 28 36C31 42 40 37 38 29C35 17 18 17 14 29C9 43 27 55 40 47C57 37 48 15 34 6Z" fill={body} />
        <path d="M34 6C53 7 64 29 52 46M14 29C9 43 27 55 40 47M21 32C23 25 32 24 36 30" fill="none" stroke="#e2d2ff" strokeWidth="1.7" strokeLinecap="round" />
        <path d="M46 15C58 32 48 50 33 50M16 20C26 13 40 21 41 32" fill="none" stroke="#695498" strokeWidth="2.3" strokeLinecap="round" />
        <circle cx="32" cy="33" r="4" fill="#242745" />
        <circle cx="31" cy="31" r="1.3" fill="#d4c9ff" />
      </>;
      break;
    case 'nebula-pearl':
      artwork = <>
        <path d="M46 12C62 29 57 49 38 56C21 62 6 49 8 33C16 45 29 44 35 36C43 27 38 17 46 12Z" fill={facet} />
        <path d="M11 38C18 53 39 54 50 39" fill="none" stroke="#e4c7d9" strokeWidth="2" />
        <path d="M17 44L17 48M25 47L27 53M35 46L39 51M43 41L48 44" stroke="#8e729c" strokeWidth="1.2" />
        <circle cx="30" cy="27" r="18" fill={body} />
        <path d="M17 28Q17 13 32 13" fill="none" stroke="#fff5ee" strokeWidth="2" strokeLinecap="round" opacity=".85" />
        <path d="M20 33Q29 40 40 31M25 21Q33 18 42 26" fill="none" stroke="#a7d4dc" strokeWidth="3" opacity=".4" />
        <path d="M20 29Q30 22 40 30" fill="none" stroke="#e9c3dc" strokeWidth="3" opacity=".55" />
        <ellipse cx="24" cy="20" rx="4" ry="2.5" transform="rotate(-30 24 20)" fill="#fff9ef" opacity=".7" />
      </>;
      break;
    case 'solar-gem':
      artwork = <>
        <path d="M32 3L36 14L46 8L45 20L58 20L51 31L60 39L47 42L48 55L36 50L30 61L25 49L12 54L14 42L3 36L13 29L7 18L21 19L22 7Z" fill={facet} />
        <path d="M25 14L40 16L49 30L43 46L27 51L15 40L14 25Z" fill="#72533e" />
        <path d="M27 17L39 19L46 31L40 43L28 47L18 38L17 27Z" fill={body} stroke="#ffe7a1" strokeWidth="1.1" />
        <path d="M27 17L30 30L17 27L18 38L28 47L30 30L40 43L46 31L39 19Z" fill="#fce0a2" opacity=".4" />
        <path d="M30 30L39 19M30 30L46 31M30 30L28 47" stroke="#9d653d" strokeWidth="1" opacity=".7" />
        <path d="M21 24L25 20M20 28L19 32" stroke="#fff4ce" strokeWidth="1.6" strokeLinecap="round" />
      </>;
      break;
    case 'quantum-cube':
      artwork = <>
        <path d="M32 5L56 18V45L32 59L8 45V18Z" fill={body} stroke="#b9eae4" strokeWidth="1.3" strokeLinejoin="round" />
        <path d="M32 5L56 18L32 32L8 18Z" fill="#c3f2df" opacity=".7" />
        <path d="M32 32L56 18V45L32 59Z" fill="#285b7b" opacity=".65" />
        <path d="M8 18L32 32L56 18M32 32V59" fill="none" stroke="#dcfff1" strokeWidth="1.3" />
        <path d="M32 18L45 25V40L32 47L19 40V25Z" fill="none" stroke="#b9f9ea" strokeWidth="1.4" strokeLinejoin="round" />
        <path d="M19 25L32 33L45 25M32 33V47" fill="none" stroke="#b9f9ea" strokeWidth="1.1" />
        <path d="M32 25L38 29V36L32 40L26 36V29Z" fill="#e2fff0" opacity=".72" />
        <path d="M12 22V39L17 42M36 9L48 16" fill="none" stroke="#f0fff7" strokeWidth="1.4" strokeLinecap="round" opacity=".65" />
      </>;
      break;
  }

  return <svg viewBox="0 0 64 64" width="100%" height="100%" aria-hidden="true" focusable="false"
    className={className ? `celestial-object ${className}` : 'celestial-object'} data-appearance={resolved}>
    <defs>
      <radialGradient id={`${id}-body`} cx="28%" cy="23%" r="80%">
        <stop stopColor={highlight} /><stop offset=".4" stopColor={midtone} /><stop offset="1" stopColor={shadow} />
      </radialGradient>
      <linearGradient id={`${id}-facet`} x1="0" y1="0" x2="1" y2="1">
        <stop stopColor={highlight} /><stop offset=".48" stopColor={midtone} /><stop offset="1" stopColor={shadow} />
      </linearGradient>
      <linearGradient id={`${id}-metal`} x1="0" y1="0" x2="1" y2="1">
        <stop stopColor="#f1f6ff" /><stop offset=".4" stopColor="#bacadd" /><stop offset="1" stopColor="#506781" />
      </linearGradient>
    </defs>
    {artwork}
  </svg>;
}
