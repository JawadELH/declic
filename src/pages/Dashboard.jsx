import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAppData, useNow } from '../hooks/useAppData.jsx';
import { CravingSheet, UseSheet } from '../components/CravingSheet.jsx';
import { CravingsChart, Heatmap, SavingsChart, TriggersChart } from '../components/Charts.jsx';
import { useToast } from '../components/Toast.jsx';
import { createPost } from '../lib/db.js';
import { money, num, pct } from '../lib/format.js';
import { computeHabitStats, deriveInsights, describePlan, formatDuration, templateOf } from '../../shared/index.js';

const STORE_KEY = 'declic.habit';
const readStored = () => {
  try {
    return localStorage.getItem(STORE_KEY);
  } catch {
    return null;
  }
};

export default function Dashboard() {
  const { user, profile, userDoc, habits, logs, engine } = useAppData();
  const now = useNow(30_000);
  const toast = useToast();
  const [selected, setSelected] = useState(readStored);
  const [sheet, setSheet] = useState(null);
  const habit = habits.find((h) => h.id === selected) ?? habits[0];

  const stats = useMemo(() => computeHabitStats(habit, logs, now), [habit, logs, now]);
  const insights = useMemo(() => deriveInsights(habit, logs, now), [habit, logs, now]);
  const tpl = templateOf(habit);
  const quit = habit.mode === 'quit';
  const plan = describePlan(engine?.nextNudge, userDoc?.tz);

  const choose = (id) => {
    setSelected(id);
    try {
      localStorage.setItem(STORE_KEY, id);
    } catch {
      /* stockage indisponible : sans conséquence */
    }
  };

  const lastAchieved = [...stats.milestones].reverse().find((m) => m.achieved);
  async function shareMilestone() {
    await createPost(user.uid, profile, {
      kind: 'victory',
      habit,
      text: `${lastAchieved.title} sans ${habit.label.toLowerCase()} ! ${lastAchieved.text}`,
    });
    toast('Partagé avec la communauté 🎉');
  }

  return (
    <div className="dashboard">
      {habits.length > 1 && (
        <div className="tabs" role="tablist">
          {habits.map((h) => (
            <button key={h.id} role="tab" aria-selected={h.id === habit.id} className={`tab ${h.id === habit.id ? 'on' : ''}`} onClick={() => choose(h.id)}>
              {h.emoji} {h.label}
            </button>
          ))}
          <Link to="/nouvelle-habitude" className="tab add">
            ＋
          </Link>
        </div>
      )}

      <section className="card hero">
        <p className="eyebrow">
          {habit.emoji} {quit ? `Sans ${habit.label.toLowerCase()} depuis` : 'Aujourd’hui'}
        </p>
        {quit ? (
          <p className="hero-number">{formatDuration(stats.streakMs)}</p>
        ) : (
          <p className="hero-number">
            {num(stats.todayUsed, 1)} <span className="hero-unit">/ {num(habit.targetPerDay, 1)} {habit.unitPlural}</span>
          </p>
        )}
        <p className="muted">
          {quit
            ? `Record : ${formatDuration(stats.longestStreakMs)}`
            : `${stats.daysOnTarget} jour${stats.daysOnTarget > 1 ? 's' : ''} d’affilée dans ton objectif`}
        </p>
        <div className="actions">
          <button className="btn primary big" onClick={() => setSheet('craving')}>
            J’ai une envie
          </button>
          <button className="btn ghost" onClick={() => setSheet('use')}>
            {quit ? 'J’ai craqué' : 'J’ai consommé'}
          </button>
        </div>
      </section>

      <div className="kpis">
        <Kpi label="Économisé" value={money(stats.moneySaved, habit.currency)} hidden={!habit.costPerUnit} />
        <Kpi label={`${habit.unitPlural} en moins`} value={num(stats.avoided)} />
        <Kpi label="Envies surmontées" value={pct(stats.resistRate)} sub={`${stats.resisted} / ${stats.cravingsTotal}`} />
        <Kpi label="Depuis le début" value={formatDuration(stats.elapsedMs).split(' ').slice(0, 2).join(' ')} />
      </div>

      {quit && (
        <section className="card milestone">
          {stats.nextMilestone ? (
            <>
              <div className="row between">
                <h3>Prochain palier : {stats.nextMilestone.title}</h3>
                <span className="muted small">{Math.round(stats.milestoneProgress * 100)} %</span>
              </div>
              <div className="progress" role="progressbar" aria-valuenow={Math.round(stats.milestoneProgress * 100)} aria-valuemin={0} aria-valuemax={100}>
                <span style={{ width: `${stats.milestoneProgress * 100}%` }} />
              </div>
              <p className="muted">{stats.nextMilestone.text}</p>
            </>
          ) : (
            <h3>Tous les paliers sont atteints. Incroyable ! 🏆</h3>
          )}
          {lastAchieved && (
            <div className="row between achieved">
              <span>
                ✅ Dernier palier atteint : <strong>{lastAchieved.title}</strong>
              </span>
              <button className="link" onClick={shareMilestone}>
                Partager
              </button>
            </div>
          )}
          {tpl.source && <p className="muted small">Repères indicatifs : {tpl.source}.</p>}
        </section>
      )}

      {habit.motivation && (
        <blockquote className="card why">
          <span className="eyebrow">Mon pourquoi</span>« {habit.motivation} »
        </blockquote>
      )}

      {insights.length > 0 && (
        <section className="insights">
          {insights.map((i) => (
            <p key={i.id} className="insight">
              <span aria-hidden>{i.icon}</span> {i.text}
            </p>
          ))}
        </section>
      )}

      <div className="charts">
        <CravingsChart series={stats.series} />
        {habit.costPerUnit > 0 && <SavingsChart series={stats.series} currency={habit.currency} />}
        <Heatmap heat={stats.heat} />
        <TriggersChart triggers={stats.triggers} />
      </div>

      <footer className="muted small dash-foot">
        {plan ? `🔔 ${plan}` : '🔕 Aucun rappel prévu pour le moment.'}{' '}
        <Link to="/reglages">Régler mes notifications</Link>
        {tpl.helpline && (
          <>
            <br />
            Besoin d’aide ? {tpl.helpline.name} : <a href={`tel:${tpl.helpline.phone.replace(/\s/g, '')}`}>{tpl.helpline.phone}</a>
          </>
        )}
      </footer>

      {sheet === 'craving' && <CravingSheet habit={habit} onClose={() => setSheet(null)} />}
      {sheet === 'use' && <UseSheet habit={habit} onClose={() => setSheet(null)} />}
    </div>
  );
}

function Kpi({ label, value, sub, hidden }) {
  if (hidden) return null;
  return (
    <div className="card kpi">
      <span className="kpi-label">{label}</span>
      <span className="kpi-value">{value}</span>
      {sub && <span className="kpi-sub muted small">{sub}</span>}
    </div>
  );
}
