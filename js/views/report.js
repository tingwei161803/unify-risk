// Lab report page. Placeholder: issue #6 builds upload, recognition and field-by-field confirmation.
// Shows the round trip to the server so the API path is proven end to end.

export function render(root, ctx) {
  root.innerHTML = `
    <h1>Lab report</h1>
    <p class="lead">Upload a report, check each value, then add it to your record.</p>
    <div class="row"><button class="btn" id="load">Load a sample report</button></div>
    <div id="out"></div>`;

  const out = root.querySelector('#out');
  root.querySelector('#load').addEventListener('click', async () => {
    out.textContent = 'Reading…';
    try {
      const { report, demo } = await ctx.callApi('recognize', { filename: 'sample-report' });
      ctx.store.addReport(report);
      out.innerHTML = '<div class="card"><h2></h2><pre></pre><a class="btn" href="#/results">Back to results</a></div>';
      out.querySelector('h2').textContent = `Report dated ${report.date}${demo ? ' · demo data' : ''}`;
      out.querySelector('pre').textContent = JSON.stringify(report.labs, null, 2);
    } catch (error) {
      out.innerHTML = '<p class="warn"></p>';
      out.querySelector('p').textContent = `Could not read the report: ${error.message}`;
    }
  });
}
