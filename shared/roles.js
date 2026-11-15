// Administrateurs de Déclic. La même adresse est inscrite dans firestore.rules (isAdmin).
export const ADMIN_EMAILS = ['jawad.elhamdani.pro@gmail.com'];

export const isAdminUser = (user) => Boolean(user?.email && user.emailVerified && ADMIN_EMAILS.includes(user.email.toLowerCase()));

/** Identifiant stable d'une alliance entre deux personnes (ordre alphabétique). */
export const allianceId = (a, b) => (a < b ? `${a}_${b}` : `${b}_${a}`);
