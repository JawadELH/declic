import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { sendEmailVerification, signOut } from 'firebase/auth';
import { IconBell, IconChevronRight, IconLink, IconMail, IconPlus, IconShieldCheck } from '@tabler/icons-react';
import { auth } from '../firebase.js';
import { useAppData } from '../hooks/useAppData.jsx';
import { useToast } from '../components/Toast.jsx';
import Avatar from '../components/Avatar.jsx';
import { deleteMyAccount, exportMyData, getProfile, resetAllData, resetHabit, saveProfile, unblockUser, updateHabit, updateUser } from '../lib/db.js';
import DevPanel, { useDevMode } from '../components/DevPanel.jsx';
import { Toggle } from '../components/Toggle.jsx';
import PlanFields, { planToSave } from '../components/PlanFields.jsx';
import { useSocial } from '../hooks/useSocial.jsx';
import { shareInvite } from './Allies.jsx';
import { disablePush, enablePush, pushSupported, showLocalTest } from '../lib/messaging.js';
import { habitIcon } from '../lib/ui.js';
import { DEFAULT_PREFS, NOTIF_LEVELS, qtyOptions, templateOf, triggersOf } from '../../shared/index.js';

const HOURS = Array.from({ length: 24 }, (_, h) => h);

export default function Me() {
  const { user, userDoc, profile, habits, unread, engine } = useAppData();
  const toast = useToast();
  const prefs = { ...DEFAULT_PREFS, ...(userDoc?.notifPrefs ?? {}) };
  const [pseudo, setPseudo] = useState(profile?.pseudo ?? '');
  const [canPush, setCanPush] = useState(false);
  const [confirm, setConfirm] = useState('');
  const [confirmReset, setConfirmReset] = useState('');
  const [dev, tapVersion] = useDevMode();
  const social = useSocial();
  const needsVerify = user.providerData?.some((p) => p.providerId === 'password') && !user.emailVerified;

  useEffect(() => {
    pushSupported().then(setCanPush);
  }, []);
  useEffect(() => setPseudo(profile?.pseudo ?? ''), [profile?.pseudo]);

  const setPref = (k, v) => updateUser(user.uid, { [`notifPrefs.${k}`]: v });

  async function togglePush() {
    if (prefs.push) {
      await disablePush(user.uid);
      return toast('Notifications désactivées.');
    }
    const res = await enablePush(user.uid);
    toast(
      {
        granted: 'Notifications activées. On reste discrets.',
        denied: 'Refusé par le navigateur. Tu peux changer ça dans ses réglages.',
        default: 'Permission non accordée.',
        unsupported: 'Non disponible ici. Sur iPhone, ajoute d’abord Déclic à l’écran d’accueil.',
      }[res],
      { duration: 6000 },
    );
  }

  async function download() {
    const data = await exportMyData(user.uid);
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    Object.assign(document.createElement('a'), { href: url, download: 'declic-mes-donnees.json' }).click();
    URL.revokeObjectURL(url);
  }

  async function destroy() {
    try {
      await deleteMyAccount(user.uid);
    } catch (e) {
      if (e.code === 'auth/requires-recent-login') {
        toast('Tes données sont effacées. Reconnecte-toi puis recommence pour supprimer le compte.', { duration: 8000 });
        await signOut(auth);
      } else toast(e.message);
    }
  }

  return (
    <div className="page me">
      <header className="me-head">
        <Avatar uid={user.uid} pseudo={profile?.pseudo} size={56} />
        <div>
          <h1>{profile?.pseudo ?? 'Moi'}</h1>
          <p className="muted small">{user.email}</p>
        </div>
      </header>

      {needsVerify && (
        <section className="notice row">
          <IconMail size={20} aria-hidden />
          <span className="grow small">Confirme ton adresse e-mail pour sécuriser ton compte.</span>
          <button className="link small" onClick={() => sendEmailVerification(user).then(() => toast('E-mail envoyé. Clique sur le lien puis reconnecte-toi.'))}>
            Envoyer
          </button>
        </section>
      )}

      {social.isMod && (
        <Link to="/admin" className="row-link card admin-link">
          <IconShieldCheck size={20} aria-hidden />
          <span className="grow">{social.isAdmin ? 'Administration' : 'Modération'}</span>
          <IconChevronRight size={18} aria-hidden />
        </Link>
      )}

      <button className="row-link card" onClick={() => shareInvite(user.uid, userDoc, profile?.pseudo, toast).catch(() => {})}>
        <IconLink size={20} aria-hidden />
        <span className="grow">Inviter un allié</span>
        <IconChevronRight size={18} aria-hidden />
      </button>

      <Link to="/notifications" className="row-link card">
        <IconBell size={20} aria-hidden />
        <span className="grow">Notifications</span>
        {unread > 0 && <span className="count">{unread}</span>}
        <IconChevronRight size={18} aria-hidden />
      </Link>

      <section className="card stack">
        <h3>Mes habitudes</h3>
        {habits.map((h) => (
          <HabitRow key={h.id} habit={h} uid={user.uid} canArchive={habits.length > 1} />
        ))}
        <Link to="/nouvelle-habitude" className="btn ghost">
          <IconPlus size={18} aria-hidden /> Ajouter une habitude
        </Link>
      </section>

      <section className="card stack">
        <h3>Rappels</h3>
        <div className="segmented">
          {Object.entries(NOTIF_LEVELS).map(([id, l]) => (
            <button key={id} className={prefs.level === id ? 'on' : ''} onClick={() => setPref('level', id)} aria-pressed={prefs.level === id}>
              {l.label}
            </button>
          ))}
        </div>
        <p className="muted small">{NOTIF_LEVELS[prefs.level]?.description}</p>
        <div className="row wrap">
          <label className="inline-select">
            Silence de
            <select value={prefs.quietStart} onChange={(e) => setPref('quietStart', Number(e.target.value))}>
              {HOURS.map((h) => (
                <option key={h} value={h}>
                  {h} h
                </option>
              ))}
            </select>
          </label>
          <label className="inline-select">
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
        <Toggle checked={prefs.milestones} onChange={(v) => setPref('milestones', v)} label="Fêter mes caps" />
        {engine === null && (
          <p className="notice small">
            Les rappels <b>push automatiques</b> (téléphone verrouillé) nécessitent la formule Blaze de Firebase. En attendant, Déclic t’affiche ses rappels
            directement dans l’app, avant tes moments délicats.
          </p>
        )}
        {canPush ? (
          <div className="row wrap">
            <button className="btn ghost" onClick={togglePush}>
              {prefs.push ? 'Couper les notifications' : 'Activer les notifications'}
            </button>
            {prefs.push && (
              <button className="link" onClick={() => showLocalTest().then((ok) => !ok && toast('Autorise d’abord les notifications.'))}>
                Tester
              </button>
            )}
          </div>
        ) : (
          <p className="muted small">Notifications non disponibles sur ce navigateur.</p>
        )}
      </section>

      <section className="card stack">
        <h3>Groupe</h3>
        <form
          className="row"
          onSubmit={async (e) => {
            e.preventDefault();
            await saveProfile(user.uid, { pseudo });
            toast('Pseudo enregistré.');
          }}
        >
          <input className="grow" required minLength={2} maxLength={30} value={pseudo} onChange={(e) => setPseudo(e.target.value)} aria-label="Pseudo" />
          <button className="btn ghost">Enregistrer</button>
        </form>
        <Toggle
          checked={userDoc?.shareActivity !== false}
          onChange={(v) => updateUser(user.uid, { shareActivity: v })}
          label="Partager mes victoires et mes caps avec le groupe"
        />
      </section>

      {social.blocked.size > 0 && (
        <section className="card stack">
          <h3>Personnes bloquées</h3>
          <BlockedList uid={user.uid} ids={[...social.blocked]} />
        </section>
      )}

      <section className="card stack">
        <h3>Mes données</h3>
        <div className="row wrap">
          <button className="btn ghost" onClick={download}>
            Télécharger mes données
          </button>
          <button className="btn ghost" onClick={() => signOut(auth)}>
            Se déconnecter
          </button>
        </div>
        <details className="danger">
          <summary>Tout réinitialiser</summary>
          <p className="small">
            Efface tes habitudes, ton historique et tes notifications, puis te ramène au démarrage. Ton compte, ton pseudo, tes alliés et tes cercles sont conservés.
            Tape RÉINITIALISER pour confirmer.
          </p>
          <div className="row">
            <input className="grow" value={confirmReset} onChange={(e) => setConfirmReset(e.target.value)} aria-label="Confirmation de réinitialisation" />
            <button
              className="btn danger"
              disabled={confirmReset !== 'RÉINITIALISER' && confirmReset !== 'REINITIALISER'}
              onClick={() => resetAllData(user.uid).then(() => toast('Tout est remis à zéro. Nouveau départ !'))}
            >
              Réinitialiser
            </button>
          </div>
        </details>
        <details className="danger">
          <summary>Supprimer mon compte</summary>
          <p className="small">Tout sera effacé définitivement. Tape SUPPRIMER pour confirmer.</p>
          <div className="row">
            <input className="grow" value={confirm} onChange={(e) => setConfirm(e.target.value)} aria-label="Confirmation" />
            <button className="btn danger" disabled={confirm !== 'SUPPRIMER'} onClick={destroy}>
              Supprimer
            </button>
          </div>
        </details>
      </section>

      {(dev || social.isAdmin) && <DevPanel />}

      <button className="version" onClick={tapVersion}>
        Déclic v{__APP_VERSION__}
        {dev ? ' · mode développeur' : ''}
      </button>
    </div>
  );
}

function BlockedList({ uid, ids }) {
  const [names, setNames] = useState({});
  useEffect(() => {
    ids.forEach((id) => getProfile(id).then((p) => setNames((n) => ({ ...n, [id]: p?.pseudo ?? 'Membre' }))).catch(() => {}));
  }, [ids.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <ul className="people">
      {ids.map((id) => (
        <li key={id} className="person">
          <Avatar uid={id} pseudo={names[id]} size={32} />
          <span className="grow">{names[id] ?? '…'}</span>
          <button className="link small" onClick={() => unblockUser(uid, id)}>
            Débloquer
          </button>
        </li>
      ))}
    </ul>
  );
}

/** Liste saisie → déclencheurs perso + modèles masqués. */
function triggerPatch(h, text) {
  const list = Array.from(new Set(text.split(',').map((x) => x.trim().slice(0, 30)).filter(Boolean))).slice(0, 20);
  const tpl = templateOf(h).triggers ?? [];
  return { customTriggers: list.filter((x) => !tpl.includes(x)), hiddenTriggers: tpl.filter((x) => !list.includes(x)) };
}

function HabitRow({ habit, uid, canArchive }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [restart, setRestart] = useState(false);
  const [h, setH] = useState(habit);
  const [trig, setTrig] = useState(() => triggersOf(habit).join(', '));
  const [qty, setQty] = useState(() => qtyOptions(habit).join(', '));
  const Icon = habitIcon(habit.templateId);
  const set = (k) => (e) => setH((x) => ({ ...x, [k]: e.target.type === 'number' ? Number(e.target.value) : e.target.value }));
  async function save(e) {
    e.preventDefault();
    await updateHabit(uid, habit.id, {
      mode: h.mode,
      baselinePerDay: h.baselinePerDay,
      targetPerDay: h.targetPerDay,
      plan: planToSave(h),
      ...triggerPatch(h, trig),
      quickQty: qty
        .split(/[,;\s]+/)
        .map(Number)
        .filter((n) => n > 0 && n < 10000)
        .slice(0, 5),
      costPerUnit: h.costPerUnit,
      motivation: (h.motivation ?? '').slice(0, 300),
    });
    toast('Enregistré.');
    setOpen(false);
  }
  return (
    <div className="habit-row">
      <button className="row-link" onClick={() => setOpen(!open)} aria-expanded={open}>
        <Icon size={20} aria-hidden />
        <span className="grow">{habit.label}</span>
        <span className="muted small">{habit.mode === 'quit' ? 'arrêt' : 'réduction'}</span>
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
              Maximum par jour
              <input type="number" min="0" step="any" value={h.targetPerDay} onChange={set('targetPerDay')} />
            </label>
          )}
          {h.mode === 'reduce' && <PlanFields habit={h} onChange={(plan) => setH((x) => ({ ...x, plan }))} />}
          <label className="full">
            Mes déclencheurs (séparés par des virgules)
            <input value={trig} onChange={(e) => setTrig(e.target.value)} placeholder="Café, Stress, Pause" />
          </label>
          <label className="full">
            Quantités rapides quand je note une conso
            <input value={qty} onChange={(e) => setQty(e.target.value)} placeholder="1, 2, 3, 5" />
          </label>
          <label>
            Prix par {h.unit} (€)
            <input type="number" min="0" step="0.01" value={h.costPerUnit} onChange={set('costPerUnit')} />
          </label>
          <label className="full">
            Mon pourquoi
            <input maxLength={300} value={h.motivation ?? ''} onChange={set('motivation')} />
          </label>
          <div className="row full">
            <button className="btn primary">Enregistrer</button>
            {canArchive && (
              <button type="button" className="btn ghost" onClick={() => updateHabit(uid, habit.id, { active: false })}>
                Archiver
              </button>
            )}
          </div>
          <div className="full">
            {restart ? (
              <button type="button" className="btn danger" onClick={() => resetHabit(uid, habit.id).then(() => toast('Habitude remise à zéro, départ maintenant.'))}>
                Confirmer : effacer l’historique et repartir de zéro
              </button>
            ) : (
              <button type="button" className="link danger-link" onClick={() => setRestart(true)}>
                Recommencer cette habitude
              </button>
            )}
          </div>
        </form>
      )}
    </div>
  );
}
