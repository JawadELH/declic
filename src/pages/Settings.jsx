import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase.js';
import { useAppData } from '../hooks/useAppData.jsx';
import { useToast } from '../components/Toast.jsx';
import { deleteMyAccount, exportMyData, saveProfile, sendTestNotification, updateHabit, updateUser } from '../lib/db.js';
import { disablePush, enablePush, pushSupported } from '../lib/messaging.js';
import { AVATARS } from '../lib/format.js';
import { DEFAULT_PREFS, NOTIF_LEVELS } from '../../shared/index.js';

const HOURS = Array.from({ length: 24 }, (_, h) => h);

export default function Settings() {
  const { user, userDoc, profile, habits } = useAppData();
  const toast = useToast();
  const prefs = { ...DEFAULT_PREFS, ...(userDoc?.notifPrefs ?? {}) };
  const [pseudo, setPseudo] = useState(profile?.pseudo ?? '');
  const [avatar, setAvatar] = useState(profile?.avatar ?? AVATARS[0]);
  const [canPush, setCanPush] = useState(false);
  const [confirm, setConfirm] = useState('');

  useEffect(() => {
    pushSupported().then(setCanPush);
  }, []);
  useEffect(() => {
    setPseudo(profile?.pseudo ?? '');
    setAvatar(profile?.avatar ?? AVATARS[0]);
  }, [profile]);

  const setPref = (k, v) => updateUser(user.uid, { [`notifPrefs.${k}`]: v });

  async function togglePush() {
    if (prefs.push) {
      await disablePush(user.uid);
      return toast('Notifications push désactivées. Tu les retrouveras dans l’app.', { icon: '🔕' });
    }
    const res = await enablePush(user.uid);
    const msg = {
      granted: ['Notifications activées. Promis, on reste discrets.', '🔔'],
      denied: ['Permission refusée par le navigateur. Tu peux la réactiver dans ses réglages.', '🚫'],
      default: ['Permission non accordée.', '🤷'],
      unsupported: ['Ce navigateur ne gère pas les notifications push. Sur iPhone, ajoute d’abord Déclic à l’écran d’accueil.', 'ℹ️'],
    }[res];
    toast(msg[0], { icon: msg[1], duration: 6000 });
  }

  async function test() {
    try {
      await sendTestNotification();
      toast('Notification de test envoyée.', { icon: '📨' });
    } catch (e) {
      toast(e.message, { icon: '⚠️' });
    }
  }

  async function download() {
    const data = await exportMyData(user.uid);
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: 'declic-mes-donnees.json' });
    a.click();
    URL.revokeObjectURL(url);
  }

  async function destroy() {
    await deleteMyAccount();
    await signOut(auth);
  }

  return (
    <div className="settings">
      <h1>Réglages</h1>

      <section className="card">
        <h2>Profil</h2>
        <form
          className="stack"
          onSubmit={async (e) => {
            e.preventDefault();
            await saveProfile(user.uid, { pseudo, avatar });
            toast('Profil enregistré.');
          }}
        >
          <label>
            Pseudo
            <input required minLength={2} maxLength={30} value={pseudo} onChange={(e) => setPseudo(e.target.value)} />
          </label>
          <fieldset className="avatars">
            <legend>Avatar</legend>
            {AVATARS.map((a) => (
              <button type="button" key={a} className={`avatar ${a === avatar ? 'on' : ''}`} onClick={() => setAvatar(a)} aria-pressed={a === avatar}>
                {a}
              </button>
            ))}
          </fieldset>
          <button className="btn primary">Enregistrer</button>
        </form>
      </section>

      <section className="card">
        <h2>Notifications</h2>
        <fieldset className="levels">
          <legend>Fréquence</legend>
          {Object.entries(NOTIF_LEVELS).map(([id, l]) => (
            <label key={id} className={`level ${prefs.level === id ? 'on' : ''}`}>
              <input type="radio" name="level" checked={prefs.level === id} onChange={() => setPref('level', id)} />
              <span>
                <strong>{l.label}</strong>
                <span className="muted small"> {l.description}</span>
              </span>
            </label>
          ))}
        </fieldset>

        <div className="row wrap">
          <label>
            Heures calmes de
            <select value={prefs.quietStart} onChange={(e) => setPref('quietStart', Number(e.target.value))}>
              {HOURS.map((h) => (
                <option key={h} value={h}>
                  {h} h
                </option>
              ))}
            </select>
          </label>
          <label>
            à
            <select value={prefs.quietEnd} onChange={(e) => setPref('quietEnd', Number(e.target.value))}>
              {HOURS.map((h) => (
                <option key={h} value={h}>
                  {h} h
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="inline">
          <input type="checkbox" checked={prefs.milestones} onChange={(e) => setPref('milestones', e.target.checked)} /> Célébrer mes paliers
        </label>
        <label className="inline">
          <input type="checkbox" checked={prefs.social} onChange={(e) => setPref('social', e.target.checked)} /> Push quand on répond à mes messages
          <span className="muted small">(sinon, uniquement dans l’app)</span>
        </label>

        <div className="row wrap">
          {canPush ? (
            <button className="btn soft" onClick={togglePush}>
              {prefs.push ? '🔕 Désactiver les notifications push' : '🔔 Activer les notifications push'}
            </button>
          ) : (
            <p className="muted small">Notifications push indisponibles sur ce navigateur : tes rappels restent visibles dans l’app.</p>
          )}
          {prefs.push && (
            <button className="btn ghost" onClick={test}>
              Envoyer un test
            </button>
          )}
        </div>
      </section>

      <section className="card">
        <div className="row between">
          <h2>Mes habitudes</h2>
          <Link className="btn soft" to="/nouvelle-habitude">
            ＋ Ajouter
          </Link>
        </div>
        {habits.map((h) => (
          <HabitEditor key={h.id} habit={h} uid={user.uid} canArchive={habits.length > 1} />
        ))}
      </section>

      <section className="card">
        <h2>Mes données</h2>
        <p className="muted small">Tes données t’appartiennent : tu peux les télécharger ou tout supprimer à tout moment.</p>
        <div className="row wrap">
          <button className="btn ghost" onClick={download}>
            Télécharger mes données (JSON)
          </button>
          <button className="btn ghost" onClick={() => signOut(auth)}>
            Se déconnecter
          </button>
        </div>
        <details className="danger">
          <summary>Supprimer mon compte</summary>
          <p className="small">Tout sera effacé définitivement : habitudes, journal, messages, notifications. Tape SUPPRIMER pour confirmer.</p>
          <div className="row">
            <input value={confirm} onChange={(e) => setConfirm(e.target.value)} aria-label="Confirmation" />
            <button className="btn danger" disabled={confirm !== 'SUPPRIMER'} onClick={destroy}>
              Supprimer définitivement
            </button>
          </div>
        </details>
      </section>
    </div>
  );
}

function HabitEditor({ habit, uid, canArchive }) {
  const toast = useToast();
  const [h, setH] = useState(habit);
  const [open, setOpen] = useState(false);
  const set = (k) => (e) => setH((x) => ({ ...x, [k]: e.target.type === 'number' ? Number(e.target.value) : e.target.value }));

  async function save(e) {
    e.preventDefault();
    await updateHabit(uid, habit.id, {
      mode: h.mode,
      baselinePerDay: h.baselinePerDay,
      targetPerDay: h.targetPerDay,
      costPerUnit: h.costPerUnit,
      motivation: (h.motivation ?? '').slice(0, 300),
    });
    toast('Habitude mise à jour.');
    setOpen(false);
  }

  return (
    <div className="habit-row">
      <button className="row between habit-toggle" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span>
          {habit.emoji} {habit.label} <span className="muted small">· {habit.mode === 'quit' ? 'arrêt' : 'réduction'}</span>
        </span>
        <span aria-hidden>{open ? '▴' : '▾'}</span>
      </button>
      {open && (
        <form className="form-grid" onSubmit={save}>
          <label>
            Objectif
            <select value={h.mode} onChange={set('mode')}>
              <option value="quit">Arrêter</option>
              <option value="reduce">Réduire</option>
            </select>
          </label>
          <label>
            Avant, par jour
            <input type="number" min="0" step="any" value={h.baselinePerDay} onChange={set('baselinePerDay')} />
          </label>
          {h.mode === 'reduce' && (
            <label>
              Objectif max / jour
              <input type="number" min="0" step="any" value={h.targetPerDay} onChange={set('targetPerDay')} />
            </label>
          )}
          <label>
            Coût par {h.unit} (€)
            <input type="number" min="0" step="0.01" value={h.costPerUnit} onChange={set('costPerUnit')} />
          </label>
          <label className="full">
            Mon pourquoi
            <textarea rows={2} maxLength={300} value={h.motivation ?? ''} onChange={set('motivation')} />
          </label>
          <div className="row full">
            <button className="btn primary">Enregistrer</button>
            {canArchive && (
              <button type="button" className="btn ghost" onClick={() => updateHabit(uid, habit.id, { active: false })}>
                Archiver
              </button>
            )}
          </div>
        </form>
      )}
    </div>
  );
}
