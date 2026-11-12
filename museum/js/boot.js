// Opens the place the visitor chose: the well of light or the galaxy. The choice was read in the
// page's head (the address first, then what was chosen last time) so the first paint is already the
// right colour; here the names follow it and that place's code is loaded.

import { NAMES } from './panel.js';

const theme = document.documentElement.dataset.theme === 'galaxy' ? 'galaxy' : 'well';
document.title = NAMES[theme];
document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'galaxy' ? '#05060a' : '#f3e8d2');
document.querySelector('#plain h1').textContent = NAMES[theme];
document.getElementById('rail').setAttribute('aria-label', theme === 'galaxy' ? '은하 이동' : '층 이동');
if (theme === 'galaxy') document.body.classList.add('dark');

import(theme === 'galaxy' ? './space/main.js' : './main.js');
