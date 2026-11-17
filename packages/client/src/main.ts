// polices hébergées avec le jeu (aucune requête vers un service tiers)
import '@fontsource/nunito/latin-600.css';
import '@fontsource/nunito/latin-800.css';
import '@fontsource/nunito/latin-900.css';
import '@fontsource/lilita-one/latin-400.css';
import '@fontsource/im-fell-english/latin-400.css';
import '@fontsource/im-fell-english/latin-400-italic.css';
import '@fontsource/im-fell-english-sc/latin-400.css';
import './app.css';
import { mount } from 'svelte';
import { app } from './app';
import { detectLayout, settings } from './settings';
import { ui } from './state.svelte';
import { loadRaw } from './storage';
import App from './ui/App.svelte';

document.documentElement.style.setProperty('--scale', String(settings.textScale));
document.documentElement.classList.toggle('show-keys', !!settings.showKeys);
const canvas = document.getElementById('scene') as HTMLCanvasElement;
app.init(canvas);
void detectLayout();
// chargement initial (modèles, portraits, icônes, shaders) derrière l'écran de chargement
const booted = app.boot();
if (new URLSearchParams(location.search).has('bench')) void booted.then(() => app.startBench());
// reconnexion automatique à une partie en cours (jeton conservé)
if (loadRaw('token', '')) app.connect();
mount(App, { target: document.getElementById('app')! });

// accès de débogage / tests automatisés
(window as unknown as { __dfend: unknown }).__dfend = { app, ui };
