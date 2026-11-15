// Copie le moteur partagé (../shared) dans functions/shared avant le déploiement ou les émulateurs.
// Firebase ne déploie que le dossier functions/, d'où cette copie (ignorée par git).
const fs = require('node:fs');
const path = require('node:path');

const src = path.resolve(__dirname, '../../shared');
const dest = path.resolve(__dirname, '../shared');
fs.rmSync(dest, { recursive: true, force: true });
fs.cpSync(src, dest, { recursive: true });
console.log(`Moteur partagé copié : ${src} → ${dest}`);
