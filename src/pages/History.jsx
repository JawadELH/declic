// Historique détaillé : ce qu'on a évité, ce qu'on n'a pas évité, jour par jour.
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { IconArrowLeft, IconChevronDown, IconTrash } from '@tabler/icons-react';
import { useAppData } from '../hooks/useAppData.jsx';
import { deleteLog } from '../lib/db.js';
import { num } from '../lib/format.js';
import { dayKey, usedLabel } from '../../shared/index.js';

const PAGE = 30;

export default function History() {
  const { user, habits, logs } = useAppData();
  const [id, setId] = useState(habits[0].id);
  const [open, setOpen] = useState(null);
  const [shown, setShown] = useState(PAGE);
  const habit = habits.find((h) => h.id === id) ?? habits[0];

  const days = useMemo(() => {
    const map = new Map();
    for (const l of logs) {
      if (l.habitId !== habit.id) continue;
      const k = dayKey(l.at);
      const d = map.get(k) ?? { key: k, ts: l.at, won: 0, lost: 0, used: 0, items: [] };
      if (l.type === 'craving') l.resisted ? d.won++ : d.lost++;
      if (l.type === 'use') d.used += l.quantity || 1;
      d.items.push(l);
      map.set(k, d);
    }
    return [...map.values()].sort((a, b) => b.ts - a.ts).map((d) => ({ ...d, items: d.items.sort((a, b) => b.at - a.at) }));
  }, [logs, habit.id]);

  return (
    <div className="page history">
      <Link to="/" className="back">
        <IconArrowLeft size={18} aria-hidden /> Aujourd’hui
      </Link>
      <h1>Historique</h1>
      {habits.length > 1 && (
        <div className="chips">
          {habits.map((h) => (
            <button key={h.id} className={`chip ${h.id === habit.id ? 'on' : ''}`} onClick={() => setId(h.id)}>
              {h.label}
            </button>
          ))}
        </div>
      )}
      <p className="muted small">Touche un jour pour voir le détail. Tu peux supprimer une entrée saisie par erreur.</p>

      {days.length === 0 ? (
        <p className="empty-note">Rien pour l’instant. Chaque envie notée apparaîtra ici.</p>
      ) : (
        <ul className="days">
          {days.slice(0, shown).map((d) => (
            <li key={d.key} className="day">
              <button className="day-head" onClick={() => setOpen(open === d.key ? null : d.key)} aria-expanded={open === d.key}>
                <span className="day-date">{new Date(d.ts).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}</span>
                <span className="day-stats">
                  <span className="good">{d.won} battue{d.won > 1 ? 's' : ''}</span>
                  {d.lost > 0 && <span className="bad">{d.lost} craquage{d.lost > 1 ? 's' : ''}</span>}
                  {d.used > 0 && (
                    <span className="muted">
                      {num(d.used, 1)} {usedLabel(habit, d.used)}
                    </span>
                  )}
                </span>
                <IconChevronDown size={18} aria-hidden className={open === d.key ? 'rot' : ''} />
              </button>
              {open === d.key && (
                <ul className="entries">
                  {d.items.map((l) => (
                    <li key={l.id}>
                      <span className="entry-time">{new Date(l.at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
                      <span className="grow">
                        {l.type === 'craving' ? (l.resisted ? 'Envie battue' : 'Envie non surmontée') : `${num(l.quantity || 1, 1)} ${usedLabel(habit, l.quantity || 1)}`}
                        {l.trigger && <span className="muted"> · {l.trigger}</span>}
                        {l.demo && <span className="tag">démo</span>}
                      </span>
                      <button className="icon-btn" aria-label="Supprimer cette entrée" onClick={() => deleteLog(user.uid, l, habit, logs).catch(() => {})}>
                        <IconTrash size={16} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
      {days.length > shown && (
        <button className="btn ghost" onClick={() => setShown((n) => n + PAGE)}>
          Voir plus
        </button>
      )}
    </div>
  );
}
