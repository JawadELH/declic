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
        <h1>Se libérer d’une habitude, ensemble.</h1>
        <p className="muted">
          Suis tes progrès, comprends tes moments difficiles et avance avec une communauté bienveillante.
          Tabac, alcool, sucre, écrans… Déclic s’adapte à ton combat.
        </p>
      </section>
      <form className="card narrow" onSubmit={submit}>
        <h2>{mode === 'login' ? 'Connexion' : 'Créer un compte'}</h2>
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
        <button className="btn primary" disabled={busy}>
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
