import { useState } from 'react';
import {
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
} from 'firebase/auth';
import { auth, googleProvider } from '../firebase.js';

const ERRORS = {
  'auth/invalid-credential': 'Email ou mot de passe incorrect.',
  'auth/email-already-in-use': 'Un compte existe déjà avec cet email.',
  'auth/weak-password': 'Mot de passe trop court (6 caractères minimum).',
  'auth/invalid-email': 'Adresse email invalide.',
  'auth/popup-closed-by-user': 'Connexion annulée.',
};

export default function Login() {
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  async function run(fn) {
    setBusy(true);
    setMsg(null);
    try {
      await fn();
    } catch (e) {
      setMsg({ error: true, text: ERRORS[e.code] ?? e.message });
    } finally {
      setBusy(false);
    }
  }

  const submit = (e) => {
    e.preventDefault();
    run(() =>
      mode === 'login'
        ? signInWithEmailAndPassword(auth, email, password)
        : createUserWithEmailAndPassword(auth, email, password),
    );
  };

  return (
    <main className="center-page login">
      <section className="hero-text">
        <span className="logo big">Déclic</span>
        <h1>Lâche ce qui te retient.</h1>
        <p className="muted">Un bouton quand l’envie arrive. Un groupe qui t’envoie de la force en direct. Tes progrès, chaque jour.</p>
      </section>
      <form className="login-form" onSubmit={submit}>
        <label>
          Email
          <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label>
          Mot de passe
          <input
            type="password"
            required
            minLength={6}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {msg && <p className={msg.error ? 'error' : 'success'}>{msg.text}</p>}
        <button className="btn primary xl" disabled={busy}>
          {mode === 'login' ? 'Se connecter' : 'Créer mon compte'}
        </button>
        <button type="button" className="btn ghost" disabled={busy} onClick={() => run(() => signInWithPopup(auth, googleProvider))}>
          Continuer avec Google
        </button>
        <div className="row between small">
          <button type="button" className="link" onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}>
            {mode === 'login' ? 'Pas encore de compte ?' : 'Déjà inscrit·e ?'}
          </button>
          {mode === 'login' && (
            <button
              type="button"
              className="link"
              onClick={() =>
                email
                  ? run(async () => {
                      await sendPasswordResetEmail(auth, email);
                      setMsg({ text: 'Email de réinitialisation envoyé.' });
                    })
                  : setMsg({ error: true, text: 'Renseigne ton email d’abord.' })
              }
            >
              Mot de passe oublié
            </button>
          )}
        </div>
      </form>
    </main>
  );
}
