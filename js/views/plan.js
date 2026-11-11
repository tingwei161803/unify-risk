// Next steps page: follow-up tests and services the person appears to qualify for.
// Rules live in js/data/services.js; this file only draws them.

import { followUpTests, matchingServices, REGION_NAMES } from '../data/services.js';
import { assess } from '../engine/run.js';
import { getPersona } from '../data/personas.js';

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function list(items) {
  const ul = el('ul', 'plain-list');
  for (const item of items) ul.append(el('li', null, item));
  return ul;
}

function labelled(label, text) {
  const p = el('p');
  p.append(el('strong', null, `${label} `), text);
  return p;
}

export function render(root, ctx) {
  const record = ctx.store.get();
  const profile = record.profile || {};
  const labs = record.labs || {};
  // Region decides which services apply. It comes from the saved choice, else the sample person.
  const region = record.region || getPersona(record.personaId)?.region || 'TW';
  const person = { profile, labs, region };
  const { results, labs: labRows, metabolicSyndrome: mets, placeholder } = assess(person);
  const context = { profile, labs, results, labRows, mets, region };

  root.replaceChildren();
  root.append(
    el('h1', null, 'Next steps'),
    el('p', 'lead', 'What you could do with these numbers: tests worth repeating or adding, and public services whose published rules your own values meet.')
  );

  // Region switch: the same person, the other country's services.
  const regionRow = el('div', 'row');
  regionRow.append(el('span', 'muted', 'Services for:'));
  for (const code of Object.keys(REGION_NAMES)) {
    const button = el('button', code === region ? 'btn' : 'btn secondary', REGION_NAMES[code]);
    button.type = 'button';
    button.addEventListener('click', () => { ctx.store.set({ region: code }); render(root, ctx); });
    regionRow.append(button);
  }
  root.append(regionRow);

  if (placeholder) {
    root.append(el('p', 'warn', 'The formula engine did not load, so no next steps can be worked out.'));
    return;
  }
  if (!Object.keys(profile).length) {
    const empty = el('div', 'card');
    empty.append(el('p', null, 'There are no answers yet. Fill in the questionnaire or add a lab report first.'));
    root.append(empty);
    return;
  }

  // Follow-up tests
  root.append(el('h2', 'section-title', 'Follow-up tests'));
  const tests = followUpTests(context);
  if (!tests.length) {
    root.append(el('p', 'muted', 'Every formula could be computed and no reading is outside its standard, so no test is suggested.'));
  }
  for (const test of tests) {
    const card = el('div', 'card');
    card.append(el('h2', null, test.name));
    // Keep the card readable when many answers are missing.
    const reasons = test.reasons.length > 4
      ? [...test.reasons.slice(0, 4), `…and ${test.reasons.length - 4} more.`]
      : test.reasons;
    card.append(el('div', 'muted', 'Why for you'), list(reasons));
    card.append(labelled('What it adds:', test.adds), labelled('Where:', test.where));
    root.append(card);
  }

  // Services
  root.append(el('h2', 'section-title', `Services in ${REGION_NAMES[region]}`));
  const services = matchingServices(context);
  if (!services.length) {
    root.append(el('p', 'muted', 'None of the service rules listed here is met by your current answers.'));
  }
  for (const service of services) {
    const card = el('div', 'card');
    card.append(el('h2', null, service.name), el('p', null, service.what));
    card.append(labelled('Published rule:', service.rule));
    card.append(el('div', 'muted', 'Your values that meet it'), list(service.matched));
    card.append(labelled('How:', service.how));
    const source = el('p', 'muted');
    const link = el('a', null, service.source.name);
    link.href = service.source.url;
    link.target = '_blank';
    link.rel = 'noopener';
    source.append('Source: ', link, '. Rules change; confirm the current one with the provider.');
    card.append(source);
    root.append(card);
  }

  root.append(el('p', 'muted', 'These are published eligibility rules matched against your own answers. They are not a referral and not medical advice. Decisions about tests and care are for you and a clinician.'));

  const back = el('div', 'row');
  const results_ = el('a', 'btn secondary', 'Back to results');
  results_.href = '#/results';
  back.append(results_);
  root.append(back);
}
