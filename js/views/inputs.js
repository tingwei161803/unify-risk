// Questionnaire page. Placeholder: issue #4 builds the real one.

export function render(root, ctx) {
  root.innerHTML = `
    <h1>Questionnaire</h1>
    <p class="lead">One question at a time. Answers are saved in this browser as you go.</p>
    <div class="row"><a class="btn" href="#/results">See results</a></div>`;
}
