import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { IconChevronRight, IconConfetti, IconX, IconClockHour4, IconPigMoney, IconHeartHandshake, IconCalendarStats } from '@tabler/icons-react';
import { useAppData, useNow } from '../hooks/useAppData.jsx';
import { usePulse } from '../hooks/useGroup.js';
import { useSocial } from '../hooks/useSocial.jsx';
import CravingFlow from '../components/CravingFlow.jsx';
import Sheet from '../components/Sheet.jsx';
import { Celebration, TreeCard } from '../components/Rewards.jsx';
import { goalReached, publishActivity, setHabitGoal } from '../lib/db.js';
import { habitIcon, buzz } from '../lib/ui.js';
import { money, num } from '../lib/format.js';
import {
  buildRiskProfile, computeHabitStats, dayKey, DAY, goalProgress, HOUR, localParts, MINUTE, riskAt, tipsOf, usedLabel, weekKey, weeklyRecap,
} from '../../shared/index.js';

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
        <circle cx="120" cy="120" r={r} className={`ring-fill ${warn ? 'warn' : ''}`} strokeDasharray={c} strokeDashoffset={c * (1 - Math.min(1, Math.max(0.02, progress)))} />
      </svg>
      <div className="ring-center">{children}</div>
    </div>
  );
}

/** Argent gardé qui défile en direct (centimes à la seconde). */
function LiveMoney({ base, baseAt, perMs, currency }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const v = base + Math.max(0, now - baseAt) * perMs;
  // Assez de décimales pour voir le compteur bouger chaque seconde (les dernières en plus petit).
  const extra = perMs > 0 ? Math.min(3, Math.max(0, Math.ceil(-Math.log10(perMs * 1000)) - 2)) : 0;
  const main = money(Math.floor(v * 100) / 100, currency, 2);
  if (!extra) return <>{main}</>;
  const tail = String(Math.floor(v * 10 ** (2 + extra)) % 10 ** extra).padStart(extra, '0');
  const i = main.search(/\s?[^\d\s.,]+$/); // position du symbole monétaire
  return (
    <>
      {i > 0 ? main.slice(0, i) : main}
      <small className="money-tail">{tail}</small>
      {i > 0 ? main.slice(i) : ''}
    </>
  );
}

export default function Today() {
  const { user, profile, userDoc, habits, logs } = useAppData();
  const social = useSocial();
  const now = useNow(20_000);
  const pulse = usePulse();
  const [selected, setSelected] = useState(() => store.get('declic.habit'));
  const [flow, setFlow] = useState(null);
  const [celebrate, setCelebrate] = useState(null);
  const [goalSheet, setGoalSheet] = useState(false);
  const [tip, setTip] = useState(() => store.get('declic.tip') !== 'vu');
  const [riskSeen, setRiskSeen] = useState(() => store.get('declic.risk'));
  const [weekSeen, setWeekSeen] = useState(() => store.get('declic.week'));
  const habit = habits.find((h) => h.id === selected) ?? habits[0];
  const stats = useMemo(() => computeHabitStats(habit, logs, now), [habit, logs, now]);
  const quit = habit.mode === 'quit';
  const Icon = habitIcon(habit.templateId);
  const perMs = ((habit.baselinePerDay ?? 0) * (habit.costPerUnit ?? 0)) / DAY;

  // Bilan du jour
  const today = useMemo(() => {
    const k = dayKey(now);
    const mine = logs.filter((l) => l.habitId === habit.id && dayKey(l.at) === k);
    return {
      won: mine.filter((l) => l.type === 'craving' && l.resisted).length,
      lost: mine.filter((l) => l.type === 'craving' && l.resisted === false).length,
      used: mine.filter((l) => l.type === 'use').reduce((a, l) => a + (l.quantity || 1), 0),
    };
  }, [logs, habit.id, now]);

  // Rappel dans l'app avant un moment à risque (fonctionne avec la formule gratuite)
  const risk = useMemo(() => {
    const cravings = logs.filter((l) => l.habitId === habit.id && l.type === 'craving');
    const prof = buildRiskProfile(cravings, now);
    if (prof.samples < 5) return null;
    const tz = userDoc?.tz || 'Europe/Paris';
    const p = localParts(now, tz);
    const nextH = localParts(now + HOUR, tz);
    const cur = riskAt(prof.scores, p.dow, p.hour);
    const nxt = riskAt(prof.scores, nextH.dow, nextH.hour);
    if (Math.max(cur, nxt) < 0.7) return null;
    const hour = cur >= nxt ? p.hour : nextH.hour;
    const tips = tipsOf(habit);
    return { hour, key: `${p.dayKey}-${hour}`, tip: tips[hour % tips.length] };
  }, [logs, habit, now, userDoc?.tz]);

  // Bilan de la semaine (une fois par semaine, dès qu'il y a au moins 6 jours de recul)
  const wk = weekKey(now);
  const recap = useMemo(() => (weekSeen !== wk && now - habit.startedAt > 6 * DAY ? weeklyRecap(habit, logs, now) : null), [weekSeen, wk, habit, logs, now]);

  // Tirelire
  const goal = goalProgress(stats.moneySaved, habit.goal);
  useEffect(() => {
    if (!goal?.reached) return;
    const k = `declic.goal.${habit.id}.${habit.goal.createdAt}`;
    if (store.get(k)) return;
    store.set(k, '1');
    buzz([40, 60, 40, 60, 120]);
    setCelebrate({ kind: 'goal', title: 'Objectif atteint !', sub: habit.goal.label, text: `${money(habit.goal.amount, habit.currency)} gardés rien que pour ça. Tu l’as gagné : offre-le-toi.` });
  }, [goal?.reached]); // eslint-disable-line react-hooks/exhaustive-deps

  // Célébration d'un cap fraîchement atteint
  const last = [...stats.milestones].reverse().find((m) => m.achieved);
  useEffect(() => {
    if (!quit || !last) return;
    const key = `declic.ms.${habit.id}`;
    const mark = `${stats.streakStart}:${last.minutes}`;
    if (store.get(key) === mark) return;
    store.set(key, mark);
    const achievedAt = stats.streakStart + last.minutes * MINUTE;
    if (now - achievedAt > DAY) return; // ancien cap : pas de fête rétroactive
    setCelebrate({ kind: 'milestone', title: `${last.title} !`, sub: 'Nouveau cap atteint', text: last.text });
    buzz([40, 60, 40, 60, 120]);
    if (userDoc?.shareActivity !== false) publishActivity(user.uid, profile, { kind: 'milestone', habit, text: last.title }).catch(() => {});
  }, [quit, last?.minutes, stats.streakStart]); // eslint-disable-line react-hooks/exhaustive-deps

  const days = Math.floor(stats.streakMs / DAY);
  const hours = Math.floor((stats.streakMs % DAY) / HOUR);
  const mins = Math.floor((stats.streakMs % HOUR) / MINUTE);
  const target = habit.targetPerDay || 0;
  const left = Math.max(0, target - stats.todayUsed);

  function nextHabit() {
    const i = habits.findIndex((h) => h.id === habit.id);
    const n = habits[(i + 1) % habits.length];
    setSelected(n.id);
    store.set('declic.habit', n.id);
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

      {recap && (
        <aside className="week-card">
          <div className="row between">
            <span className="kicker">
              <IconCalendarStats size={14} aria-hidden /> Ta semaine
            </span>
            <button
              className="icon-btn"
              aria-label="Fermer le bilan"
              onClick={() => {
                store.set('declic.week', wk);
                setWeekSeen(wk);
              }}
            >
              <IconX size={18} />
            </button>
          </div>
          <div className="week-grid">
            {habit.costPerUnit > 0 && (
              <div>
                <strong>{money(recap.cur.money, habit.currency)}</strong>
                <span>gardés</span>
              </div>
            )}
            <div>
              <strong>{recap.cur.won}</strong>
              <span>envies battues{recap.prev.won ? ` (${recap.cur.won - recap.prev.won >= 0 ? '+' : ''}${recap.cur.won - recap.prev.won})` : ''}</span>
            </div>
            <div>
              <strong>{num(recap.cur.used, 1)}</strong>
              <span>{usedLabel(habit, recap.cur.used)}</span>
            </div>
          </div>
          {recap.bestDay && <p className="small">Ton meilleur jour : {recap.bestDay.day}, avec {recap.bestDay.won} envie{recap.bestDay.won > 1 ? 's' : ''} battue{recap.bestDay.won > 1 ? 's' : ''}.</p>}
        </aside>
      )}

      {risk && riskSeen !== risk.key && (
        <aside className="risk-card">
          <IconClockHour4 size={20} aria-hidden />
          <p className="grow small">
            <strong>Moment délicat vers {risk.hour} h.</strong> {risk.tip}
          </p>
          <button
            className="icon-btn"
            aria-label="Masquer"
            onClick={() => {
              store.set('declic.risk', risk.key);
              setRiskSeen(risk.key);
            }}
          >
            <IconX size={18} />
          </button>
        </aside>
      )}

      <section className="hero-zone">
        <p className="kicker">{quit ? `Sans ${habit.label.toLowerCase()} depuis` : 'Aujourd’hui, il te reste'}</p>
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
          // Mode réduction : l'anneau montre ce qu'il reste, il se vide quand on consomme.
          <Ring progress={target ? left / target : 0} warn={stats.todayUsed > target}>
            <span className="ring-num">{num(left, 1)}</span>
            <span className="ring-unit">
              {left > 1 ? habit.unitPlural : habit.unit} sur {num(target, 1)}
            </span>
          </Ring>
        )}
        <p className="next-cap">
          {quit
            ? stats.nextMilestone
              ? `Prochain cap : ${stats.nextMilestone.title}`
              : 'Tous les caps sont atteints'
            : stats.todayUsed > target
              ? `Objectif dépassé de ${num(stats.todayUsed - target, 1)} aujourd’hui. Demain est une autre page.`
              : `${stats.daysOnTarget} jour${stats.daysOnTarget > 1 ? 's' : ''} d’affilée dans ton objectif`}
        </p>
      </section>

      <Link to="/historique" className="bilan" aria-label="Voir l’historique détaillé">
        <div className="bilan-row">
          <span className="bilan-title">Aujourd’hui</span>
          <span>
            <b className="good">{today.won}</b> envie{today.won > 1 ? 's' : ''} battue{today.won > 1 ? 's' : ''}
          </span>
          <span>
            <b className={today.used ? 'bad' : ''}>{num(today.used, 1)}</b> {usedLabel(habit, today.used)}
          </span>
        </div>
        <div className="bilan-row">
          <span className="bilan-title">Depuis le début</span>
          <span>
            <b className="good">{num(stats.avoided)}</b> {stats.avoided > 1 ? habit.unitPlural : habit.unit} en moins
          </span>
          <span>
            <b className={stats.consumed ? 'bad' : ''}>{num(stats.consumed, 1)}</b> {usedLabel(habit, stats.consumed)}
          </span>
        </div>
        {habit.costPerUnit > 0 && (
          <div className="bilan-money">
            <span className="bilan-title">Argent gardé</span>
            <b className="money-live">
              <LiveMoney base={stats.moneySaved} baseAt={now} perMs={perMs} currency={habit.currency} />
            </b>
            <IconChevronRight size={18} aria-hidden className="muted" />
          </div>
        )}
      </Link>

      <section className="cta-zone">
        <button className="btn primary xl" onClick={() => setFlow('craving')}>
          J’ai une envie
        </button>
        <button className="link" onClick={() => setFlow('slip')}>
          {quit ? 'J’ai craqué' : 'J’ai consommé'}
        </button>
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

      <div className="rewards">
        {habit.costPerUnit > 0 &&
          (goal ? (
            <section className="piggy">
              <div className="row between">
                <span className="kicker">
                  <IconPigMoney size={14} aria-hidden /> Ta tirelire
                </span>
                <button className="link small" onClick={() => setGoalSheet(true)}>
                  Modifier
                </button>
              </div>
              <strong className="piggy-label">{habit.goal.label}</strong>
              <div className="progress" role="progressbar" aria-valuenow={Math.round(goal.pct * 100)} aria-valuemin={0} aria-valuemax={100}>
                <span style={{ width: `${goal.pct * 100}%` }} />
              </div>
              <span className="muted small">
                {money(goal.saved, habit.currency)} sur {money(habit.goal.amount, habit.currency)}
                {goal.reached ? ' · objectif atteint !' : ` · encore ${money(goal.remaining, habit.currency)}`}
              </span>
              {goal.reached && (
                <button className="btn primary" onClick={() => goalReached(user.uid, habit.id)}>
                  Je me l’offre !
                </button>
              )}
            </section>
          ) : (
            <button className="piggy empty" onClick={() => setGoalSheet(true)}>
              <IconPigMoney size={22} aria-hidden />
              <span className="grow">
                <strong>Remplis ta tirelire</strong>
                <span className="muted small block">Choisis ce que tu vas t’offrir avec l’argent gardé.</span>
              </span>
              <IconChevronRight size={18} aria-hidden />
            </button>
          ))}

        <TreeCard victories={stats.resisted} />

        {social.cheersWeek > 0 && (
          <Link to="/groupe" className="cheers-card">
            <IconHeartHandshake size={20} aria-hidden />
            <span className="grow">
              <strong>{social.cheersWeek}</strong> bravo{social.cheersWeek > 1 ? 's' : ''} reçu{social.cheersWeek > 1 ? 's' : ''} du groupe cette semaine
            </span>
            <IconChevronRight size={18} aria-hidden />
          </Link>
        )}
      </div>

      {flow && <CravingFlow habit={habit} stats={stats} mode={flow} onClose={() => setFlow(null)} />}
      {celebrate && <Celebration icon={<IconConfetti size={56} stroke={2} aria-hidden />} title={celebrate.title} sub={celebrate.sub} text={celebrate.text} onClose={() => setCelebrate(null)} />}
      {goalSheet && <GoalSheet habit={habit} moneySaved={stats.moneySaved} uid={user.uid} onClose={() => setGoalSheet(false)} />}
    </div>
  );
}

const GOAL_IDEAS = [
  ['Un bon restaurant', 80],
  ['Une nouvelle paire de baskets', 120],
  ['Un week-end', 300],
  ['Un concert', 70],
];

function GoalSheet({ habit, moneySaved, uid, onClose }) {
  const [label, setLabel] = useState(habit.goal?.label ?? '');
  const [amount, setAmount] = useState(habit.goal?.amount ?? 100);
  const perDay = (habit.baselinePerDay ?? 0) * (habit.costPerUnit ?? 0);
  const daysNeeded = perDay > 0 ? Math.ceil(amount / perDay) : null;
  async function save(e) {
    e.preventDefault();
    // L'objectif se remplit à partir de maintenant (sauf si on modifie un objectif existant).
    const base = habit.goal ? habit.goal.base : moneySaved;
    setHabitGoal(uid, habit.id, { label: label.trim().slice(0, 60), amount: Number(amount), base, createdAt: habit.goal?.createdAt ?? Date.now() }).catch(() => {});
    onClose();
  }
  return (
    <Sheet title="Ta tirelire" onClose={onClose}>
      <form className="stack" onSubmit={save}>
        <p className="muted small">L’argent que tu ne dépenses plus remplit ta tirelire en direct. Quand elle est pleine, tu te fais plaisir.</p>
        <div className="chips">
          {GOAL_IDEAS.map(([l, a]) => (
            <button
              type="button"
              key={l}
              className={`chip ${label === l ? 'on' : ''}`}
              onClick={() => {
                setLabel(l);
                setAmount(a);
              }}
            >
              {l}
            </button>
          ))}
        </div>
        <label>
          Ce que je vais m’offrir
          <input required maxLength={60} value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Un week-end à Rome" />
        </label>
        <label>
          Montant (€)
          <input type="number" min="1" step="1" required value={amount} onChange={(e) => setAmount(e.target.value)} />
        </label>
        {daysNeeded && <p className="small">Au rythme actuel, c’est environ {daysNeeded} jour{daysNeeded > 1 ? 's' : ''} sans {habit.label.toLowerCase()}.</p>}
        <div className="row">
          <button className="btn primary grow">Enregistrer</button>
          {habit.goal && (
            <button
              type="button"
              className="btn ghost"
              onClick={() => {
                setHabitGoal(uid, habit.id, null).catch(() => {});
                onClose();
              }}
            >
              Retirer
            </button>
          )}
        </div>
      </form>
    </Sheet>
  );
}
