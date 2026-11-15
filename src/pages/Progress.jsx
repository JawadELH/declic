import { useMemo, useState } from 'react';
import { IconCheck } from '@tabler/icons-react';
import { useAppData, useNow } from '../hooks/useAppData.jsx';
import { CravingsChart, Heatmap, SavingsChart, TriggersChart } from '../components/Charts.jsx';
import { money, num, pct } from '../lib/format.js';
import { computeHabitStats, deriveInsights, formatDuration, templateOf } from '../../shared/index.js';

export default function Progress() {
  const { habits, logs } = useAppData();
  const now = useNow(60_000);
  const [id, setId] = useState(habits[0].id);
  const habit = habits.find((h) => h.id === id) ?? habits[0];
  const stats = useMemo(() => computeHabitStats(habit, logs, now), [habit, logs, now]);
  const insights = useMemo(() => deriveInsights(habit, logs, now), [habit, logs, now]);
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

function Tile({ label, value, sub }) {
  return (
    <div className="tile">
      <span className="tile-label">{label}</span>
      <span className="tile-value">{value}</span>
      {sub && <span className="muted small">{sub}</span>}
    </div>
  );
}
