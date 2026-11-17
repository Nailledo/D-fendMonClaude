// polices hébergées avec le jeu (aucune requête vers un service tiers)
import '@fontsource/atkinson-hyperlegible/400.css';
import '@fontsource/atkinson-hyperlegible/700.css';
import '@fontsource/grenze/500.css';
import '@fontsource/grenze/700.css';
import '@fontsource/grenze-gotisch/700.css';
import './app.css';
import { mount } from 'svelte';
import { app } from './app';
import { renderPortraits } from './render/portraits';
import { detectLayout, settings } from './settings';
import { ui } from './state.svelte';
import { loadRaw } from './storage';
import App from './ui/App.svelte';

document.documentElement.style.setProperty('--scale', String(settings.textScale));
document.documentElement.classList.toggle('show-keys', !!settings.showKeys);
const canvas = document.getElementById('scene') as HTMLCanvasElement;
app.init(canvas);
ui.portraits = renderPortraits();
void detectLayout();
if (new URLSearchParams(location.search).has('bench')) app.startBench();
// reconnexion automatique à une partie en cours (jeton conservé)
if (loadRaw('token', '')) app.connect();
mount(App, { target: document.getElementById('app')! });

// accès de débogage / tests automatisés
(window as unknown as { __dfend: unknown }).__dfend = { app, ui };
