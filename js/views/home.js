// Home page: the pitch in one line and a way in.

import { PERSONAS } from '../data/personas.js';

export function render(root, ctx) {
  root.innerHTML = `
    <h1>Your health numbers, explained by formulas you can check.</h1>
    <p class="lead">Answer a few questions, add your lab report, and see what published formulas estimate. Every number opens up to show the equation and the paper it came from.</p>
    <div class="row" id="start">
      <a class="btn" href="#/inputs">Start with your own answers</a>
    </div>
    <h2>Or try a sample person</h2>
    <div id="people"></div>`;

  const people = root.querySelector('#people');
  for (const persona of PERSONAS) {
    const card = document.createElement('button');
    card.className = 'card';
    card.style.cssText = 'display:block;width:100%;text-align:left;font:inherit;cursor:pointer';
    card.innerHTML = '<h2></h2><div class="muted"></div><p></p>';
    card.querySelector('h2').textContent = persona.name;
    card.querySelector('.muted').textContent = persona.tagline;
    card.querySelector('p').textContent = persona.blurb;
    card.addEventListener('click', () => {
      ctx.store.loadPersona(persona.id);
      ctx.go('#/results');
    });
    people.append(card);
  }
}
