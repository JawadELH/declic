import { avatarHue } from '../lib/ui.js';

/** Pastille ronde avec l'initiale du pseudo, couleur stable par personne. */
export default function Avatar({ uid, pseudo, size = 32 }) {
  const hue = avatarHue(uid);
  return (
    <span
      className="avatar"
      aria-hidden
      style={{
        width: size,
        height: size,
        fontSize: size * 0.42,
        background: `hsl(${hue} 55% var(--avatar-l, 88%))`,
        color: `hsl(${hue} 60% var(--avatar-ink, 25%))`,
      }}
    >
      {(pseudo || '?').trim().charAt(0).toUpperCase()}
    </span>
  );
}
