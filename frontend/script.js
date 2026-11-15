document.addEventListener('DOMContentLoaded', () => {
  const dot = document.getElementById('backend-status');
  fetch('/api/health')
    .then(r => r.json())
    .then(() => dot.classList.add('ok'))
    .catch(() => dot.classList.add('err'));
});

function show(id, html, isError) {
  const el = document.getElementById(id);
  el.innerHTML = html;
  el.className = 'result' + (isError ? ' error' : '');
}

function sendGreeting() {
  const name = document.getElementById('greet-name').value.trim();
  if (!name) return show('greet-result', 'Please enter your name.', true);
  const language = document.getElementById('greet-lang').value;

  fetch('/api/greet', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, language })
  })
    .then(r => r.json())
    .then(d => show('greet-result', `<strong>${d.message}</strong>`))
    .catch(() => show('greet-result', 'Failed to reach the backend.', true));
}

function sendCalc() {
  const a = document.getElementById('calc-a').value;
  const b = document.getElementById('calc-b').value;
  const operation = document.getElementById('calc-op').value;
  if (a === '' || b === '') return show('calc-result', 'Please fill in both numbers.', true);

  fetch('/api/calculate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ operation, a, b })
  })
    .then(r => r.json())
    .then(d => {
      if (d.error) return show('calc-result', d.error, true);
      const ops = { add: '+', subtract: '−', multiply: '×', divide: '÷' };
      show('calc-result', `<strong>${a} ${ops[operation]} ${b} = ${d.result}</strong>`);
    })
    .catch(() => show('calc-result', 'Failed to reach the backend.', true));
}

function sendText() {
  const text = document.getElementById('text-input').value;
  if (!text.trim()) return show('text-result', 'Please enter some text.', true);
  const action = document.getElementById('text-action').value;

  fetch('/api/text', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, action })
  })
    .then(r => r.json())
    .then(d => {
      if (d.error) return show('text-result', d.error, true);
      show('text-result', `<strong>${d.result}</strong>`);
    })
    .catch(() => show('text-result', 'Failed to reach the backend.', true));
}

function fetchInfo() {
  fetch('/api/info')
    .then(r => r.json())
    .then(d => {
      const items = Object.entries(d).map(([k, v]) =>
        `<div class="info-item"><div class="info-label">${k}</div><div class="info-value">${v}</div></div>`
      ).join('');
      show('info-result', `<div class="info-grid">${items}</div>`);
    })
    .catch(() => show('info-result', 'Failed to reach the backend.', true));
}
