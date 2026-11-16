import { useMemo, useState } from 'react';
import { IconCheck, IconLock, IconSparkles, IconTrendingDown, IconTrendingUp } from '@tabler/icons-react';
import { TreeCard } from '../components/Rewards.jsx';
import { useAppData, useNow } from '../hooks/useAppData.jsx';
import { CravingsChart, Heatmap, SavingsChart, TriggersChart } from '../components/Charts.jsx';
import { money, num, pct } from '../lib/format.js';
import { computeExtraStats, computeHabitStats, deriveInsights, formatDuration, RARE_BADGES, templateOf } from '../../shared/index.js';

export default function Progress() {
  const { habits, logs, userDoc } = useAppData();
  const now = useNow(60_000);
  const badges = userDoc?.badges ?? {};
  const owned = RARE_BADGES.filter((b) => badges[b.id]).length;
  const [id, setId] = useState(habits[0].id);
  const habit = habits.find((h) => h.id === id) ?? habits[0];
  const stats = useMemo(() => computeHabitStats(habit, logs, now), [habit, logs, now]);
  const insights = useMemo(() => deriveInsights(habit, logs, now), [habit, logs, now]);
  const extra = useMemo(() => computeExtraStats(habit, logs, now), [habit, logs, now]);
  const tpl = templateOf(habit);

  return (
    <div className="page">
      <h1>Progrès</h1>
      {habits.length > 1 && (
        <div className="chips">
          {habits.map((h) => (
            <button key={h.id} className={`chip ${h.id === habit.id ? 'on' : ''}`} onClick={() => setId(h.id)}>
              {h.label}
            </button>
          ))}
        </div>
      )}

      <div className="tiles">
        {habit.costPerUnit > 0 && <Tile label="Argent gardé" value={money(stats.moneySaved, habit.currency)} />}
        <Tile label={`${habit.unitPlural} en moins`} value={num(stats.avoided)} />
        <Tile label="Envies surmontées" value={pct(stats.resistRate)} sub={`${stats.resisted} sur ${stats.cravingsTotal}`} />
        <Tile label={habit.mode === 'quit' ? 'Record' : 'Depuis le début'} value={formatDuration(habit.mode === 'quit' ? stats.longestStreakMs : stats.elapsedMs).split(' ').slice(0, 2).join(' ')} />
      </div>

      <TreeCard victories={stats.resisted} />

      <section className="card">
        <h3>
          Collection rare <span className="muted small">· {owned}/{RARE_BADGES.length}</span>
        </h3>
        <p className="muted small">Après chaque envie battue, une carte surprise. Parfois, elle est rare.</p>
        <div className="badges">
          {RARE_BADGES.map((b) => (
            <div key={b.id} className={`badge ${badges[b.id] ? 'on' : ''}`} title={badges[b.id] ? b.text : 'À découvrir'}>
              <span className="badge-ico">{badges[b.id] ? <IconSparkles size={20} aria-hidden /> : <IconLock size={18} aria-hidden />}</span>
              <span className="badge-name">{badges[b.id] ? b.name : '???'}</span>
              {badges[b.id] > 1 && <span className="badge-count">×{badges[b.id]}</span>}
            </div>
          ))}
        </div>
      </section>

      <section className="card projection-card">
        <h3>À ce rythme</h3>
        <div className="proj-row">
          <div>
            <span className="muted small">Dans 1 mois</span>
            <strong>{habit.costPerUnit > 0 ? money(extra.projection.month.money, habit.currency) : `${num(extra.projection.month.units)} ${habit.unitPlural}`}</strong>
          </div>
          <div>
            <span className="muted small">Dans 1 an</span>
            <strong>{habit.costPerUnit > 0 ? money(extra.projection.year.money, habit.currency) : `${num(extra.projection.year.units)} ${habit.unitPlural}`}</strong>
          </div>
        </div>
        <p className="muted small">
          {habit.costPerUnit > 0 ? `gardés en plus, soit ${num(extra.projection.year.units)} ${habit.unitPlural} en moins par an.` : 'en moins, calculé sur tes 14 derniers jours.'}
        </p>
      </section>

      <section className="card">
        <h3>Cette semaine vs la précédente</h3>
        <div className="compare">
          <Compare label="Envies" values={extra.week.cravings} lowerIsBetter />
          <Compare label="Envies battues" values={extra.week.resisted} />
          <Compare label={habit.mode === 'quit' ? 'Écarts' : 'Consommé'} values={extra.week.used} lowerIsBetter />
        </div>
      </section>

      <section className="card">
        <div className="row between">
          <h3>8 dernières semaines</h3>
          <span className="muted small">
            {extra.cleanDays} jour{extra.cleanDays > 1 ? 's' : ''} {habit.mode === 'quit' ? `sans ${habit.label.toLowerCase()}` : 'dans l’objectif'}
          </span>
        </div>
        <div className="calendar" role="img" aria-label="Calendrier des 8 dernières semaines">
          {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((d, k) => (
            <span key={k} className="cal-head">
              {d}
            </span>
          ))}
          {extra.calendar.map((c) => (
            <span key={c.key} className={`cal ${c.status}`} title={`${c.key}`} />
          ))}
        </div>
        <div className="cal-legend muted small">
          <span>
            <span className="cal clean" /> {habit.mode === 'quit' ? 'jour sans' : 'objectif tenu'}
          </span>
          <span>
            <span className="cal used" /> {habit.mode === 'quit' ? 'écart' : 'dépassé'}
          </span>
        </div>
      </section>

      <section className="card">
        <h3>Tes moments de la journée</h3>
        <ul className="dayparts">
          {extra.dayparts.map((p) => (
            <li key={p.id}>
              <span className="dp-label">{p.label}</span>
              <span className="dp-track">
                <span className="dp-fill" style={{ width: `${p.rate == null ? 0 : p.rate * 100}%` }} />
              </span>
              <span className="dp-value">{p.count ? `${pct(p.rate)} battues` : '—'}</span>
            </li>
          ))}
        </ul>
        <p className="muted small">Part des envies surmontées selon le moment. Le plus faible est celui à préparer.</p>
      </section>

      {insights.length > 0 && (
        <section className="card">
          <h3>Ce que Déclic remarque</h3>
          <ul className="insights">
            {insights.map((i) => (
              <li key={i.id}>{i.text}</li>
            ))}
          </ul>
        </section>
      )}

      <div className="charts">
        <CravingsChart series={stats.series} />
        {habit.costPerUnit > 0 && <SavingsChart series={stats.series} currency={habit.currency} />}
        <Heatmap heat={stats.heat} />
        <TriggersChart triggers={stats.triggers} />
      </div>

      {habit.mode === 'quit' && (
        <section className="card">
          <h3>Tes caps</h3>
          <ul className="caps">
            {stats.milestones.map((m) => (
              <li key={m.minutes} className={m.achieved ? 'done' : ''}>
                <span className="cap-dot">{m.achieved && <IconCheck size={14} stroke={3} aria-hidden />}</span>
                <div>
                  <strong>{m.title}</strong>
                  <p className="muted small">{m.text}</p>
                </div>
              </li>
            ))}
          </ul>
          {tpl.source && <p className="muted small">Repères indicatifs : {tpl.source}.</p>}
        </section>
      )}

      {tpl.helpline && (
        <p className="muted small center">
          Besoin d’un accompagnement ? {tpl.helpline.name} : <a href={`tel:${tpl.helpline.phone.replace(/\s/g, '')}`}>{tpl.helpline.phone}</a>
        </p>
      )}
    </div>
  );
}

function Compare({ label, values: [now, before], lowerIsBetter }) {
  const diff = now - before;
  const good = lowerIsBetter ? diff < 0 : diff > 0;
  const Icon = diff < 0 ? IconTrendingDown : IconTrendingUp;
  return (
    <div className="cmp">
      <span className="tile-label">{label}</span>
      <span className="tile-value">{num(now, 1)}</span>
      {before > 0 || now > 0 ? (
        <span className={`cmp-delta ${diff === 0 ? '' : good ? 'good' : 'bad'}`}>
          {diff !== 0 && <Icon size={14} aria-hidden />} {diff === 0 ? 'stable' : `${diff > 0 ? '+' : ''}${num(diff, 1)}`}
        </span>
      ) : (
        <span className="cmp-delta">—</span>
      )}
    </div>
  );
}

function Tile({ label, value, sub }) {
  return (
    <div className="tile">
      <span className="tile-label">{label}</span>
      <span className="tile-value">{value}</span>
      {sub && <span className="muted small">{sub}</span>}
    </div>
  );
}
