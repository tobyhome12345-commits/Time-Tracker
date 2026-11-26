import type { Mood, Stage } from '../logic/progress';

interface Props {
  stage: Stage;
  mood: Mood;
  size?: number;
  animated?: boolean;
  /** Greyed-out silhouette for locked stages */
  locked?: boolean;
  /** Holiday look: sunglasses on any stage */
  holiday?: boolean;
  title?: string;
}

/* Pip the sprout: original flat-vector mascot. Body is tinted from the accent colour;
   leaves stay leafy green. ViewBox 200×220, head top at y≈78. */

const INK = '#1d2721';
const LEAF = '#3cbf6a';
const LEAF_DARK = '#25964f';
const VEIN = '#8ee3ad';
const BLUSH = '#ff8fa3';

function Leaf({ d, vein, droop = 0, side }: { d: string; vein: string; droop?: number; side: 'l' | 'r' }) {
  return (
    <g className={`pip-leaf pip-leaf-${side}`} style={droop ? { transform: `rotate(${side === 'l' ? -droop : droop}deg)` } : undefined}>
      <path d={d} fill={LEAF} />
      <path d={vein} stroke={VEIN} strokeWidth={2.5} strokeLinecap="round" fill="none" />
    </g>
  );
}

function Stem({ top }: { top: number }) {
  return <path d={`M100,82 Q97,${(82 + top) / 2} 100,${top}`} stroke={LEAF_DARK} strokeWidth={6} strokeLinecap="round" fill="none" />;
}

function Sprouts({ stage, droop }: { stage: Stage; droop: number }) {
  switch (stage) {
    case 'seed':
      return (
        <g className="pip-top">
          <Stem top={64} />
          <Leaf side="r" droop={droop} d="M100,66 C106,54 120,52 126,58 C120,68 108,70 100,66 Z" vein="M103,64 Q112,60 120,59" />
        </g>
      );
    case 'sprout':
      return (
        <g className="pip-top">
          <Stem top={54} />
          <Leaf side="l" droop={droop} d="M100,58 C90,40 68,38 58,46 C68,62 88,66 100,58 Z" vein="M96,56 Q80,50 66,47" />
          <Leaf side="r" droop={droop} d="M100,58 C110,38 134,36 144,44 C134,60 112,66 100,58 Z" vein="M104,56 Q120,48 136,45" />
        </g>
      );
    case 'sapling':
      return (
        <g className="pip-top">
          <Stem top={38} />
          <Leaf side="l" droop={droop} d="M99,70 C88,60 72,62 66,68 C74,78 90,78 99,70 Z" vein="M95,70 Q84,67 72,68" />
          <Leaf side="l" droop={droop} d="M100,44 C88,26 64,24 54,33 C64,49 86,53 100,44 Z" vein="M95,43 Q78,36 62,34" />
          <Leaf side="r" droop={droop} d="M100,44 C112,24 138,22 148,31 C138,47 114,53 100,44 Z" vein="M105,43 Q122,35 140,32" />
        </g>
      );
    case 'bud':
      return (
        <g className="pip-top">
          <Stem top={34} />
          <Leaf side="l" droop={droop} d="M99,60 C86,44 64,44 56,52 C66,66 86,68 99,60 Z" vein="M95,59 Q80,53 64,52" />
          <Leaf side="r" droop={droop} d="M101,60 C114,44 136,44 144,52 C134,66 114,68 101,60 Z" vein="M105,59 Q120,53 136,52" />
          <path d="M100,8 C112,18 114,30 108,38 L92,38 C86,30 88,18 100,8 Z" fill="#f472b6" />
          <path d="M100,12 C106,20 107,29 104,36" stroke="#f9a8d4" strokeWidth={2.5} strokeLinecap="round" fill="none" />
          <path d="M90,36 C94,44 106,44 110,36 L104,40 L100,35 L96,40 Z" fill={LEAF_DARK} />
        </g>
      );
    case 'bloom':
      return (
        <g className="pip-top">
          <Stem top={40} />
          <Leaf side="l" droop={droop} d="M99,62 C86,46 64,46 56,54 C66,68 86,70 99,62 Z" vein="M95,61 Q80,55 64,54" />
          <Leaf side="r" droop={droop} d="M101,62 C114,46 136,46 144,54 C134,68 114,70 101,62 Z" vein="M105,61 Q120,55 136,54" />
          <g className="pip-flower">
            {[0, 72, 144, 216, 288].map((a) => (
              <ellipse key={a} cx={100} cy={15} rx={9} ry={13} fill="#f9a8d4" transform={`rotate(${a} 100 28)`} />
            ))}
            <circle cx={100} cy={28} r={9} fill="#fbbf24" />
            <circle cx={97} cy={25} r={2.5} fill="#fde68a" />
          </g>
        </g>
      );
    case 'tree':
      return (
        <g className="pip-top">
          <path d="M94,84 L95,62 L105,62 L106,84 Z" fill="#a16207" />
          <g className="pip-canopy">
            <circle cx={66} cy={54} r={24} fill={LEAF_DARK} />
            <circle cx={134} cy={54} r={24} fill={LEAF_DARK} />
            <circle cx={100} cy={44} r={34} fill={LEAF} />
            <circle cx={76} cy={36} r={22} fill={LEAF} />
            <circle cx={124} cy={36} r={22} fill={LEAF} />
            <circle cx={100} cy={18} r={20} fill={LEAF} />
            <circle cx={88} cy={22} r={6} fill={VEIN} opacity={0.7} />
            <circle cx={70} cy={34} r={4.5} fill={VEIN} opacity={0.7} />
            <circle cx={130} cy={46} r={5} fill="#f9a8d4" />
            <circle cx={84} cy={56} r={4} fill="#fbbf24" />
            <circle cx={116} cy={24} r={4} fill="#fbbf24" />
          </g>
        </g>
      );
  }
}

/** Sunglasses. `perched` = pushed up on Pip's head (used when his eyes are closed or sad). */
function Shades({ perched = false }: { perched?: boolean }) {
  return (
    <g className="pip-shades" transform={perched ? 'translate(100 104) scale(0.86) translate(-100 -136)' : undefined}>
      <rect x={64} y={126} width={30} height={20} rx={8} fill={INK} />
      <rect x={106} y={126} width={30} height={20} rx={8} fill={INK} />
      <path d="M94,132 Q100,128 106,132" stroke={INK} strokeWidth={4} fill="none" />
      <path d="M70,131 L78,131" stroke="#fff" strokeWidth={3} strokeLinecap="round" opacity={0.7} />
      <path d="M112,131 L120,131" stroke="#fff" strokeWidth={3} strokeLinecap="round" opacity={0.7} />
    </g>
  );
}

function Eyes({ mood, shades }: { mood: Mood; shades: boolean }) {
  if (shades) return <Shades />;
  if (mood === 'sleepy' || mood === 'rest') {
    return (
      <g stroke={INK} strokeWidth={4} strokeLinecap="round" fill="none">
        <path d="M71,136 Q79,142 87,136" />
        <path d="M113,136 Q121,142 129,136" />
      </g>
    );
  }
  const ry = mood === 'droopy' ? 6.5 : 9;
  const cy = mood === 'droopy' ? 138 : 135;
  return (
    <g>
      <g className="pip-eyes">
        <ellipse cx={79} cy={cy} rx={7.5} ry={ry} fill={INK} />
        <ellipse cx={121} cy={cy} rx={7.5} ry={ry} fill={INK} />
        <circle cx={82} cy={cy - 3.5} r={2.8} fill="#fff" />
        <circle cx={124} cy={cy - 3.5} r={2.8} fill="#fff" />
      </g>
      {mood === 'droopy' && (
        <g stroke={INK} strokeWidth={3.5} strokeLinecap="round">
          <path d="M70,126 L86,121" />
          <path d="M114,121 L130,126" />
        </g>
      )}
      {mood === 'worried' && (
        <g>
          <g stroke={INK} strokeWidth={3.5} strokeLinecap="round">
            <path d="M70,125 L86,119" />
            <path d="M114,119 L130,125" />
          </g>
          <path d="M146,104 C152,114 154,120 149,124 C144,128 138,122 141,115 Z" fill="#7cc4fa" />
        </g>
      )}
      {mood === 'cheer' && (
        <g stroke={INK} strokeWidth={3.5} strokeLinecap="round" fill="none">
          <path d="M71,121 Q79,116 87,121" />
          <path d="M113,121 Q121,116 129,121" />
        </g>
      )}
    </g>
  );
}

function Mouth({ mood }: { mood: Mood }) {
  switch (mood) {
    case 'happy':
      return <path d="M89,151 Q100,162 111,151" stroke={INK} strokeWidth={4} strokeLinecap="round" fill="none" />;
    case 'cheer':
      return (
        <g>
          <path d="M86,149 Q100,170 114,149 Z" fill={INK} strokeLinejoin="round" />
          <ellipse cx={100} cy={160} rx={6} ry={3.5} fill="#ff7a93" />
        </g>
      );
    case 'worried':
      return <path d="M89,156 q5.5,-5 11,0 t11,0" stroke={INK} strokeWidth={4} strokeLinecap="round" fill="none" />;
    case 'rest':
    case 'sleepy':
      return <ellipse cx={100} cy={155} rx={4} ry={5} fill={INK} />;
    case 'droopy':
      return <path d="M90,159 Q100,149 110,159" stroke={INK} strokeWidth={4} strokeLinecap="round" fill="none" />;
  }
}

function Sparkle({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <path
      className="pip-sparkle"
      d="M0,-10 C1.5,-2.5 2.5,-1.5 10,0 C2.5,1.5 1.5,2.5 0,10 C-1.5,2.5 -2.5,1.5 -10,0 C-2.5,-1.5 -1.5,-2.5 0,-10 Z"
      fill="#fbbf24"
      transform={`translate(${x} ${y}) scale(${s})`}
    />
  );
}

export function Pip({ stage, mood, size = 160, animated = true, locked = false, title, holiday = false }: Props) {
  const droop = mood === 'droopy' ? 32 : 0;
  // Holidays (and the Mighty Tree) always wear sunnies: over the eyes when Pip is awake,
  // pushed up on his head when he's sleepy, resting or droopy so you can still see his face.
  const wearsShades = stage === 'tree' || holiday;
  const eyesClosedOrSad = mood === 'sleepy' || mood === 'rest' || mood === 'droopy';
  const shades = wearsShades && !eyesClosedOrSad;
  const perchedShades = wearsShades && eyesClosedOrSad;
  const armsUp = mood === 'cheer';
  return (
    <svg
      width={size}
      height={(size * 220) / 200}
      viewBox="0 0 200 220"
      className={`pip${animated ? ' pip-anim' : ''}${locked ? ' pip-locked' : ''} pip-mood-${mood}`}
      role="img"
      aria-label={title ?? `Pip the ${stage}, feeling ${mood}`}
    >
      <ellipse cx={100} cy={208} rx={52} ry={7} fill="var(--pip-shadow)" />
      {mood === 'droopy' && !locked && (
        <g className="pip-cloud">
          <path d="M140,26 a12,12 0 0 1 22,-6 a10,10 0 0 1 17,8 a8,8 0 0 1 -2,16 h-36 a9,9 0 0 1 -1,-18 Z" fill="#94a3b8" />
          <path d="M148,50 l-3,8 M160,50 l-3,8 M172,50 l-3,8" stroke="#60a5fa" strokeWidth={3} strokeLinecap="round" />
        </g>
      )}
      <g className="pip-body">
        <g className="pip-sway">
          <Sprouts stage={stage} droop={droop} />
        </g>
        {/* arms */}
        {armsUp ? (
          <>
            <ellipse cx={38} cy={118} rx={9} ry={16} fill="var(--pip-shade)" transform="rotate(-35 38 118)" />
            <ellipse cx={162} cy={118} rx={9} ry={16} fill="var(--pip-shade)" transform="rotate(35 162 118)" />
          </>
        ) : (
          <>
            <ellipse cx={42} cy={156} rx={9} ry={15} fill="var(--pip-shade)" transform={`rotate(${mood === 'droopy' ? 8 : 22} 42 156)`} />
            <ellipse cx={158} cy={156} rx={9} ry={15} fill="var(--pip-shade)" transform={`rotate(${mood === 'droopy' ? -8 : -22} 158 156)`} />
          </>
        )}
        {/* feet */}
        <ellipse cx={78} cy={198} rx={15} ry={8} fill="var(--pip-shade)" />
        <ellipse cx={122} cy={198} rx={15} ry={8} fill="var(--pip-shade)" />
        {/* body */}
        <path d="M100,78 C141,78 163,118 163,149 C163,180 135,200 100,200 C65,200 37,180 37,149 C37,118 59,78 100,78 Z" fill="var(--pip-body)" />
        <ellipse cx={100} cy={170} rx={40} ry={24} fill="#fff" opacity={0.28} />
        <ellipse cx={74} cy={104} rx={10} ry={6} fill="#fff" opacity={0.55} transform="rotate(-35 74 104)" />
        {!locked && (
          <>
            <ellipse cx={65} cy={153} rx={9.5} ry={6} fill={BLUSH} opacity={0.6} />
            <ellipse cx={135} cy={153} rx={9.5} ry={6} fill={BLUSH} opacity={0.6} />
            <Eyes mood={mood} shades={shades} />
            {perchedShades && <Shades perched />}
            <Mouth mood={mood} />
          </>
        )}
      </g>
      {mood === 'cheer' && !locked && (
        <g>
          <Sparkle x={30} y={80} />
          <Sparkle x={172} y={92} s={0.8} />
          <Sparkle x={22} y={178} s={0.6} />
          <Sparkle x={178} y={170} s={0.7} />
        </g>
      )}
      {(mood === 'sleepy' || mood === 'rest') && !locked && (
        <g className="pip-zzz" fill="var(--text-2)" fontWeight={900} fontFamily="var(--font)">
          <text x={150} y={100} fontSize={18}>
            z
          </text>
          <text x={164} y={82} fontSize={24}>
            Z
          </text>
        </g>
      )}
    </svg>
  );
}
