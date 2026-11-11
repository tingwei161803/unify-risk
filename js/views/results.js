// Results page. Placeholder: issue #4 builds the real cards.
// Shows one plain card per formula so the three result states are visible end to end.

export function render(root, ctx) {
  const { profile, labs } = ctx.store.get();
  const results = ctx.runAll({ profile, labs });

  root.innerHTML = `
    <h1>Results</h1>
    <p class="lead">One card per published formula.</p>
    <div id="cards"></div>
    <div class="row">
      <a class="btn" href="#/report">Add a lab report</a>
      <a class="btn secondary" href="#/evidence">See the evidence</a>
    </div>`;

  const cards = root.querySelector('#cards');
  for (const result of results) {
    const card = document.createElement('div');
    card.className = 'card';
    const title = document.createElement('h2');
    title.textContent = `${result.name} · ${result.horizonYears}-year ${result.outcome}`;
    const body = document.createElement('div');
    if (result.status === 'ok') {
      body.className = 'value';
      body.textContent = `${Math.round(result.value * 100)}%`;
    } else if (result.status === 'missing') {
      body.className = 'warn';
      body.textContent = `Needs: ${result.missing.join(', ')}`;
    } else {
      body.className = 'muted';
      body.textContent = `Not applicable: ${result.reason}`;
    }
    const source = document.createElement('div');
    source.className = 'muted';
    source.textContent = result.source.citation + (result.placeholder ? ' · placeholder number' : '');
    card.append(title, body, source);
    cards.append(card);
  }
}
