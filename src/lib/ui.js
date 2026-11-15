// Petits utilitaires d'interface.
import { IconSmokingNo, IconGlassOff, IconCandyOff, IconDeviceMobileOff, IconCoinOff, IconHandStop, IconSparkles } from '@tabler/icons-react';

export const HABIT_ICONS = {
  tabac: IconSmokingNo,
  alcool: IconGlassOff,
  sucre: IconCandyOff,
  ecrans: IconDeviceMobileOff,
  jeux: IconCoinOff,
  ongles: IconHandStop,
  custom: IconSparkles,
};

export const habitIcon = (templateId) => HABIT_ICONS[templateId] ?? IconSparkles;

const HUES = [160, 200, 25, 280, 340, 45, 100, 220];
/** Couleur stable dérivée de l'identifiant (pour les pastilles d'initiale). */
export function avatarHue(uid = '') {
  let h = 0;
  for (const c of uid) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return HUES[h % HUES.length];
}

/** Petite vibration de récompense (si le téléphone le permet). */
export function buzz(pattern = [30, 40, 60]) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* non supporté */
  }
}
