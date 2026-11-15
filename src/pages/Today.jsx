import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { IconChevronRight, IconConfetti, IconX } from '@tabler/icons-react';
import { useAppData, useNow } from '../hooks/useAppData.jsx';
import { usePulse } from '../hooks/useGroup.js';
import CravingFlow from '../components/CravingFlow.jsx';
import { publishActivity } from '../lib/db.js';
import { habitIcon, buzz } from '../lib/ui.js';
import { money, num } from '../lib/format.js';
import { computeHabitStats, DAY, HOUR, MINUTE } from '../../shared/index.js';

const STORE = 'declic.habit';
const store = {
  get: (k) => {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set: (k, v) => {
    try {
      localStorage.setItem(k, v);
    } catch {
      /* indisponible */
    }
  },
};

function Ring({ progress, warn, children }) {
  const r = 104;
  const c = 2 * Math.PI * r;
  return (
    <div className="ring">
      <svg viewBox="0 0 240 240" aria-hidden>
        <circle cx="120" cy="120" r={r} className="ring-track" />
        <circle
          cx="120"
          cy="120"
          r={r}
          className={`ring-fill ${warn ? 'warn' : ''}`}
          strokeDasharray={c}
          strokeDashoffset={c * (1 - Math.min(1, Math.max(0.02, progress)))}
        />
      </svg>
      <div className="ring-center">{children}</div>
    </div>
  );
}

export default function Today() {
  const { user, profile, userDoc, habits, logs } = useAppData();
  const now = useNow(20_000);
  const pulse = usePulse();
  const [selected, setSelected] = useState(() => store.get(STORE));
  const [flow, setFlow] = useState(null);
  const [celebrate, setCelebrate] = useState(null);
  const [tip, setTip] = useState(() => store.get('declic.tip') !== 'vu');
  const habit = habits.find((h) => h.id === selected) ?? habits[0];
  const stats = useMemo(() => computeHabitStats(habit, logs, now), [habit, logs, now]);
  const quit = habit.mode === 'quit';
  const Icon = habitIcon(habit.templateId);

  // Célébration d'un cap fraîchement atteint (une seule fois, partagée au groupe si autorisé).
  const last = [...stats.milestones].reverse().find((m) => m.achieved);
  useEffect(() => {
    if (!quit || !last) return;
    const key = `declic.ms.${habit.id}`;
    const mark = `${stats.streakStart}:${last.minutes}`;
    if (store.get(key) === mark) return;
    store.set(key, mark);
    const achievedAt = stats.streakStart + last.minutes * MINUTE;
    if (now - achievedAt > DAY) return; // ancien cap : pas de fête rétroactive
    setCelebrate(last);
    buzz([40, 60, 40, 60, 120]);
    if (userDoc?.shareActivity !== false) publishActivity(user.uid, profile, { kind: 'milestone', habit, text: last.title }).catch(() => {});
  }, [quit, last?.minutes, stats.streakStart]); // eslint-disable-line react-hooks/exhaustive-deps

  const days = Math.floor(stats.streakMs / DAY);
  const hours = Math.floor((stats.streakMs % DAY) / HOUR);
  const mins = Math.floor((stats.streakMs % HOUR) / MINUTE);
  const target = habit.targetPerDay || 0;

  function nextHabit() {
    const i = habits.findIndex((h) => h.id === habit.id);
    const n = habits[(i + 1) % habits.length];
    setSelected(n.id);
    store.set(STORE, n.id);
  }

  return (
    <div className="today">
      <header className="today-head">
        <button className="habit-pill" onClick={habits.length > 1 ? nextHabit : undefined} aria-label="Changer d’habitude">
          <Icon size={18} aria-hidden /> {habit.label}
          {habits.length > 1 && <span className="muted">· {habits.length}</span>}
        </button>
        <Link to="/groupe" className="pulse-link">
          <span className="live-dot" aria-hidden /> {pulse} envie{pulse > 1 ? 's' : ''} battue{pulse > 1 ? 's' : ''} par le groupe
          <IconChevronRight size={16} aria-hidden />
        </Link>
      </header>

      <section className="hero-zone">
        <p className="kicker">{quit ? `Sans ${habit.label.toLowerCase()} depuis` : 'Aujourd’hui'}</p>
        {quit ? (
          <Ring progress={stats.milestoneProgress}>
            {days > 0 ? (
              <>
                <span className="ring-num">{days}</span>
                <span className="ring-unit">
                  jour{days > 1 ? 's' : ''} · {hours} h
                </span>
              </>
            ) : (
              <>
                <span className="ring-num">{hours}</span>
                <span className="ring-unit">h {mins} min</span>
              </>
            )}
          </Ring>
        ) : (
          <Ring progress={target ? stats.todayUsed / target : 1} warn={stats.todayUsed > target}>
            <span className="ring-num">{num(stats.todayUsed, 1)}</span>
            <span className="ring-unit">
              sur {num(target, 1)} {habit.unitPlural}
            </span>
          </Ring>
        )}
        <p className="next-cap">
          {quit
            ? stats.nextMilestone
              ? `Prochain cap : ${stats.nextMilestone.title}`
              : 'Tous les caps sont atteints'
            : `${stats.daysOnTarget} jour${stats.daysOnTarget > 1 ? 's' : ''} d’affilée dans ton objectif`}
        </p>
      </section>

      <section className="duo">
        {habit.costPerUnit > 0 && (
          <div>
            <span className="duo-num">{money(stats.moneySaved, habit.currency)}</span>
            <span className="duo-label">gardés</span>
          </div>
        )}
        <div>
          <span className="duo-num">{num(stats.avoided)}</span>
          <span className="duo-label">{habit.unitPlural} en moins</span>
        </div>
        <div>
          <span className="duo-num">{stats.resisted}</span>
          <span className="duo-label">victoire{stats.resisted > 1 ? 's' : ''}</span>
        </div>
      </section>

      {tip && stats.cravingsTotal < 3 && (
        <aside className="tip-card">
          <p>
            <strong>Le réflexe Déclic :</strong> dès que l’envie arrive, appuie sur le bouton. On respire 90 secondes ensemble, et le groupe peut t’envoyer de
            la force.
          </p>
          <button
            className="icon-btn"
            aria-label="Masquer l’astuce"
            onClick={() => {
              setTip(false);
              store.set('declic.tip', 'vu');
            }}
          >
            <IconX size={18} />
          </button>
        </aside>
      )}

      <section className="cta-zone">
        <button className="btn primary xl" onClick={() => setFlow('craving')}>
          J’ai une envie
        </button>
        <button className="link" onClick={() => setFlow('slip')}>
          {quit ? 'J’ai craqué' : 'J’ai consommé'}
        </button>
      </section>

      {flow && <CravingFlow habit={habit} stats={stats} mode={flow} onClose={() => setFlow(null)} />}

      {celebrate && (
        <div className="flow" role="dialog" aria-modal="true" aria-label="Cap atteint">
          <div className="flow-body center-col">
            <div className="badge-win pop">
              <IconConfetti size={56} stroke={2} aria-hidden />
            </div>
            <h1 className="win-title">{celebrate.title} !</h1>
            <p className="win-sub">Nouveau cap atteint</p>
            <p className="muted win-detail">{celebrate.text}</p>
            <div className="flow-actions">
              <button className="btn primary xl" onClick={() => setCelebrate(null)}>
                Continuer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
