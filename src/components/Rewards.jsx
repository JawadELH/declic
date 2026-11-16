// Éléments de récompense : confettis, arbre qui pousse, carte surprise.
import { useMemo, useState } from 'react';
import { IconSparkles } from '@tabler/icons-react';
import { drawCard, treeStage, TREE_STAGES } from '../../shared/index.js';

const CONFETTI_COLORS = ['var(--accent-ring)', 'var(--series-1)', 'var(--series-2)', '#eda100', '#e87ba4'];

/** Pluie de confettis (purement décorative). */
export function Confetti({ count = 28 }) {
  const bits = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        left: Math.random() * 100,
        delay: Math.random() * 0.35,
        dur: 1.2 + Math.random() * 0.9,
        rot: Math.random() * 360,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        w: 6 + Math.random() * 6,
      })),
    [count],
  );
  return (
    <div className="confetti" aria-hidden>
      {bits.map((b, i) => (
        <span
          key={i}
          style={{ left: `${b.left}%`, animationDelay: `${b.delay}s`, animationDuration: `${b.dur}s`, background: b.color, width: b.w, height: b.w * 0.45, transform: `rotate(${b.rot}deg)` }}
        />
      ))}
    </div>
  );
}

function Crown({ cx, cy, r, flowers }) {
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} className="leaf" />
      <circle cx={cx - r * 0.55} cy={cy + r * 0.25} r={r * 0.7} className="leaf dark" />
      <circle cx={cx + r * 0.55} cy={cy + r * 0.2} r={r * 0.72} className="leaf" />
      {flowers &&
        [
          [-0.4, -0.3],
          [0.35, -0.45],
          [0.1, 0.1],
          [-0.65, 0.35],
          [0.7, 0.3],
          [-0.1, -0.7],
        ].map(([dx, dy], i) => <circle key={i} cx={cx + dx * r} cy={cy + dy * r} r={r * 0.11} className="flower" />)}
    </g>
  );
}

/** Dessin de l'arbre selon le stade (0 à 8). */
export function TreeArt({ stage, size = 96 }) {
  const s = Math.max(0, Math.min(8, stage));
  return (
    <svg viewBox="0 0 120 120" width={size} height={size} className="tree" role="img" aria-label="Ton arbre">
      <ellipse cx="60" cy="108" rx="40" ry="7" className="ground" />
      {s === 0 && <ellipse cx="60" cy="103" rx="6" ry="4.5" className="seed" />}
      {s === 1 && (
        <g>
          <path d="M60 106 V92" className="stem" />
          <ellipse cx="54" cy="91" rx="6" ry="3" className="leaf" transform="rotate(-25 54 91)" />
          <ellipse cx="66" cy="89" rx="6" ry="3" className="leaf" transform="rotate(25 66 89)" />
        </g>
      )}
      {s === 2 && (
        <g>
          <path d="M60 106 V78" className="stem" />
          <ellipse cx="52" cy="92" rx="8" ry="3.5" className="leaf" transform="rotate(-25 52 92)" />
          <ellipse cx="68" cy="88" rx="8" ry="3.5" className="leaf" transform="rotate(25 68 88)" />
          <ellipse cx="53" cy="80" rx="7" ry="3" className="leaf dark" transform="rotate(-30 53 80)" />
          <ellipse cx="67" cy="77" rx="7" ry="3" className="leaf" transform="rotate(30 67 77)" />
        </g>
      )}
      {s === 3 && (
        <g>
          <path d="M60 106 V92" className="trunk thin" />
          <circle cx="60" cy="86" r="16" className="leaf" />
          <circle cx="48" cy="92" r="11" className="leaf dark" />
          <circle cx="72" cy="92" r="11" className="leaf" />
        </g>
      )}
      {s === 4 && (
        <g>
          <path d="M60 106 V72" className="trunk" />
          <Crown cx={60} cy={62} r={17} />
        </g>
      )}
      {s >= 5 && s <= 7 && (
        <g>
          <path d="M60 106 V66 M60 82 L50 72 M60 76 L70 66" className="trunk thick" />
          <Crown cx={60} cy={50} r={s === 5 ? 22 : 27} flowers={s === 7} />
        </g>
      )}
      {s === 8 && (
        <g>
          <path d="M34 106 V80" className="trunk" />
          <Crown cx={34} cy={70} r={15} />
          <path d="M86 106 V80" className="trunk" />
          <Crown cx={86} cy={72} r={14} flowers />
          <path d="M60 106 V66" className="trunk thick" />
          <Crown cx={60} cy={50} r={22} flowers />
        </g>
      )}
    </svg>
  );
}

/** Carte « Ton arbre » : stade + victoires avant le suivant. */
export function TreeCard({ victories }) {
  const st = treeStage(victories);
  const curMin = TREE_STAGES[st.index].min;
  const pct = st.next ? (victories - curMin) / (st.next.min - curMin) : 1;
  return (
    <div className="tree-card">
      <TreeArt stage={st.index} size={84} />
      <div>
        <span className="kicker">Ton arbre</span>
        <strong className="tree-name">{st.name}</strong>
        <span className="muted small">
          {st.next ? `Encore ${st.toNext} envie${st.toNext > 1 ? 's' : ''} battue${st.toNext > 1 ? 's' : ''} avant : ${st.next.name}` : 'Stade ultime atteint. Respect.'}
        </span>
        <span className="tree-bar" aria-hidden>
          <span style={{ width: `${pct * 100}%` }} />
        </span>
      </div>
    </div>
  );
}

/** Carte surprise à retourner après une victoire. */
export function SurpriseCard({ habit, pulse, onRare }) {
  const [card, setCard] = useState(null);
  function flip() {
    if (card) return;
    const c = drawCard(habit, { pulse });
    setCard(c);
    if (c.kind === 'rare') onRare?.(c.badgeId);
  }
  return (
    <button className={`surprise ${card ? `open ${card.kind}` : ''}`} onClick={flip} aria-live="polite">
      {card ? (
        <>
          <span className="surprise-kind">{card.kind === 'rare' ? 'Rare' : card.kind === 'sante' ? 'Santé' : card.kind === 'collectif' ? 'Groupe' : 'Mot du jour'}</span>
          <strong>{card.title}</strong>
          <span>{card.text}</span>
        </>
      ) : (
        <>
          <IconSparkles size={22} aria-hidden />
          <strong>Ta carte surprise</strong>
          <span className="muted small">Touche pour la retourner</span>
        </>
      )}
    </button>
  );
}

/** Écran plein de célébration (cap atteint, tirelire remplie…). */
export function Celebration({ icon, title, sub, text, onClose, children }) {
  return (
    <div className="flow" role="dialog" aria-modal="true" aria-label={title}>
      <div className="flow-body center-col">
        <Confetti count={36} />
        <div className="badge-win pop">{icon}</div>
        <h1 className="win-title">{title}</h1>
        {sub && <p className="win-sub">{sub}</p>}
        {text && <p className="muted win-detail">{text}</p>}
        {children}
        <div className="flow-actions">
          <button className="btn primary xl" onClick={onClose}>
            Continuer
          </button>
        </div>
      </div>
    </div>
  );
}
