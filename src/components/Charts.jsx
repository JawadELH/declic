// Graphiques du tableau de bord.
// Couleurs : palette catégorielle validée (bleu = surmontées, orange = craquées),
// rampe séquentielle bleue pour la carte de chaleur. Les valeurs vivent dans styles.css.
import { useEffect, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { DOW_LABELS } from '../../shared/index.js';
import { money, pct } from '../lib/format.js';

const VARS = ['--series-1', '--series-2', '--surface-1', '--grid', '--text-secondary', '--text-muted'];

/** Lit les jetons de couleur CSS (et suit le passage clair/sombre). */
function useTokens() {
  const read = () => Object.fromEntries(VARS.map((v) => [v, getComputedStyle(document.documentElement).getPropertyValue(v).trim()]));
  const [tokens, setTokens] = useState(read);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const on = () => setTokens(read());
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return tokens;
}

function ChartTooltip({ active, payload, label, format = (v) => v }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tip">
      <div className="chart-tip-title">{label}</div>
      {payload.map((p) => (
        <div key={p.dataKey} className="chart-tip-row">
          <span className="swatch" style={{ background: p.color }} aria-hidden />
          <span>{p.name}</span>
          <strong>{format(p.value)}</strong>
        </div>
      ))}
    </div>
  );
}

function Legend({ items }) {
  return (
    <ul className="legend">
      {items.map((i) => (
        <li key={i.label}>
          <span className="swatch" style={{ background: i.color }} aria-hidden />
          {i.label}
        </li>
      ))}
    </ul>
  );
}

const axisProps = (t) => ({
  tick: { fill: t['--text-muted'], fontSize: 12 },
  axisLine: false,
  tickLine: false,
});

/** Envies par jour : surmontées vs non surmontées (barres empilées). */
export function CravingsChart({ series }) {
  const t = useTokens();
  const [table, setTable] = useState(false);
  const total = series.reduce((a, d) => a + d.resisted + d.gaveIn, 0);
  return (
    <section className="card chart-card">
      <header className="chart-head">
        <h3>Envies des 30 derniers jours</h3>
        <button className="link small" onClick={() => setTable(!table)}>
          {table ? 'Voir le graphique' : 'Voir en tableau'}
        </button>
      </header>
      <Legend
        items={[
          { label: 'Surmontées', color: t['--series-1'] },
          { label: 'Non surmontées', color: t['--series-2'] },
        ]}
      />
      {total === 0 ? (
        <p className="empty">Aucune envie notée pour l’instant. Appuie sur « J’ai une envie » quand elle arrive.</p>
      ) : table ? (
        <DataTable
          cols={['Jour', 'Surmontées', 'Non surmontées']}
          rows={series.filter((d) => d.resisted + d.gaveIn > 0).map((d) => [d.label, d.resisted, d.gaveIn])}
        />
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={series} margin={{ top: 8, right: 4, left: -24, bottom: 0 }} barCategoryGap={2}>
            <CartesianGrid vertical={false} stroke={t['--grid']} />
            <XAxis dataKey="label" {...axisProps(t)} interval="preserveStartEnd" minTickGap={24} />
            <YAxis allowDecimals={false} {...axisProps(t)} />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: t['--grid'], opacity: 0.5 }} />
            <Bar dataKey="resisted" name="Surmontées" stackId="a" fill={t['--series-1']} stroke={t['--surface-1']} strokeWidth={1} />
            <Bar dataKey="gaveIn" name="Non surmontées" stackId="a" fill={t['--series-2']} stroke={t['--surface-1']} strokeWidth={1} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </section>
  );
}

/** Économies cumulées (une seule série : pas de légende, le titre la nomme). */
export function SavingsChart({ series, currency }) {
  const t = useTokens();
  const last = series[series.length - 1]?.savedCumulative ?? 0;
  return (
    <section className="card chart-card">
      <header className="chart-head">
        <h3>Économies sur 30 jours</h3>
        <strong className="chart-kpi">{money(last, currency)}</strong>
      </header>
      <ResponsiveContainer width="100%" height={180}>
        <LineChart data={series} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke={t['--grid']} />
          <XAxis dataKey="label" {...axisProps(t)} interval="preserveStartEnd" minTickGap={24} />
          <YAxis {...axisProps(t)} tickFormatter={(v) => `${Math.round(v)} €`} />
          <Tooltip content={<ChartTooltip format={(v) => money(v, currency)} />} cursor={{ stroke: t['--text-muted'], strokeDasharray: '3 3' }} />
          <Line type="monotone" dataKey="savedCumulative" name="Économisé" stroke={t['--series-1']} strokeWidth={2} dot={false} activeDot={{ r: 5, stroke: t['--surface-1'], strokeWidth: 2 }} />
        </LineChart>
      </ResponsiveContainer>
    </section>
  );
}

/** Déclencheurs les plus fréquents, avec le taux de réussite en texte. */
export function TriggersChart({ triggers }) {
  const top = triggers.slice(0, 6);
  const max = Math.max(1, ...top.map((x) => x.count));
  return (
    <section className="card chart-card">
      <header className="chart-head">
        <h3>Tes déclencheurs</h3>
      </header>
      {top.length === 0 ? (
        <p className="empty">Indique ce qui déclenche tes envies pour voir apparaître tes schémas.</p>
      ) : (
        <ul className="hbars">
          {top.map((x) => (
            <li key={x.trigger} title={`${x.count} envies, ${pct(x.resistRate)} surmontées`}>
              <span className="hbar-label">{x.trigger}</span>
              <span className="hbar-track">
                <span className="hbar-fill" style={{ width: `${(x.count / max) * 100}%` }} />
              </span>
              <span className="hbar-value">
                {x.count} · <span className="muted">{pct(x.resistRate)} surmontées</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Carte de chaleur jour × heure des envies. */
export function Heatmap({ heat }) {
  const max = Math.max(0, ...heat);
  const [hover, setHover] = useState(null);
  const order = [1, 2, 3, 4, 5, 6, 0]; // lundi → dimanche
  const step = (v) => (v === 0 || max === 0 ? 0 : Math.min(6, Math.ceil((v / max) * 6)));
  return (
    <section className="card chart-card">
      <header className="chart-head">
        <h3>Tes moments à risque</h3>
        <span className="muted small" aria-live="polite">
          {hover ? `${DOW_LABELS[hover.d]} ${hover.h} h : ${hover.v} envie${hover.v > 1 ? 's' : ''}` : 'Survole une case'}
        </span>
      </header>
      {max === 0 ? (
        <p className="empty">La carte se remplit au fil des envies que tu notes.</p>
      ) : (
        <>
          <div className="heatmap" role="table" aria-label="Nombre d’envies par jour et par heure" onMouseLeave={() => setHover(null)}>
            <div className="hm-row" role="row">
              <span className="hm-day" />
              {Array.from({ length: 24 }, (_, h) => (
                <span key={h} className="hm-hour" role="columnheader">
                  {h % 3 === 0 ? h : ''}
                </span>
              ))}
            </div>
            {order.map((d) => (
              <div className="hm-row" role="row" key={d}>
                <span className="hm-day" role="rowheader">
                  {DOW_LABELS[d]}
                </span>
                {Array.from({ length: 24 }, (_, h) => {
                  const v = heat[d * 24 + h];
                  return (
                    <span
                      key={h}
                      role="cell"
                      className={`hm-cell seq-${step(v)}`}
                      aria-label={`${DOW_LABELS[d]} ${h} h : ${v}`}
                      onMouseEnter={() => setHover({ d, h, v })}
                    />
                  );
                })}
              </div>
            ))}
          </div>
          <div className="hm-scale muted small">
            Moins
            {[1, 2, 3, 4, 5, 6].map((s) => (
              <span key={s} className={`hm-cell seq-${s}`} aria-hidden />
            ))}
            Plus
          </div>
        </>
      )}
    </section>
  );
}

function DataTable({ cols, rows }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {cols.map((c) => (
              <th key={c}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((c, j) => (
                <td key={j}>{c}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
