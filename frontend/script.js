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

let monitorInterval = null;

function startStress() {
  const type = document.getElementById('stress-type').value;
  const durationSeconds = document.getElementById('stress-duration').value;
  const btn = document.getElementById('stress-btn');

  btn.disabled = true;
  btn.textContent = 'Starting...';

  fetch('/api/stress', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type, durationSeconds })
  })
    .then(r => r.json())
    .then(d => {
      if (d.error) {
        show('stress-result', d.error, true);
        btn.disabled = false;
        btn.textContent = 'Start Load Test';
        return;
      }
      show('stress-result',
        `<strong>${type.toUpperCase()} stress started</strong> on <code>${d.hostname}</code> for ${durationSeconds}s`);
      startMonitor(parseInt(durationSeconds));
    })
    .catch(() => {
      show('stress-result', 'Failed to reach the backend.', true);
      btn.disabled = false;
      btn.textContent = 'Start Load Test';
    });
}

function startMonitor(durationSec) {
  const panel = document.getElementById('stress-monitor');
  const btn = document.getElementById('stress-btn');
  panel.classList.remove('hidden');

  let elapsed = 0;
  if (monitorInterval) clearInterval(monitorInterval);

  function poll() {
    fetch('/api/stress/status')
      .then(r => r.json())
      .then(d => {
        const maxMem = 512;
        const memPct = Math.min(100, (d.memoryMB.rss / maxMem) * 100);
        const heapPct = Math.min(100, (d.memoryMB.heapUsed / maxMem) * 100);

        document.getElementById('meter-mem').style.width = memPct + '%';
        document.getElementById('meter-mem-text').textContent = d.memoryMB.rss + ' / ' + maxMem + ' MB';
        document.getElementById('meter-heap').style.width = heapPct + '%';
        document.getElementById('meter-heap-text').textContent = d.memoryMB.heapUsed + ' / ' + maxMem + ' MB';

        const status = d.stress.active ? 'Running' : 'Idle';
        document.getElementById('monitor-meta').innerHTML =
          `Host: <code>${d.hostname}</code> &middot; Status: <strong>${status}</strong> &middot; Uptime: ${d.uptime}s`;

        if (memPct > 80) document.getElementById('meter-mem').classList.add('critical');
        else document.getElementById('meter-mem').classList.remove('critical');
      })
      .catch(() => {});

    elapsed += 2;
    if (elapsed > durationSec + 10) {
      clearInterval(monitorInterval);
      monitorInterval = null;
      btn.disabled = false;
      btn.textContent = 'Start Load Test';
      document.getElementById('monitor-indicator').classList.remove('pulse');
    }
  }

  poll();
  monitorInterval = setInterval(poll, 2000);

  setTimeout(() => {
    btn.disabled = false;
    btn.textContent = 'Start Load Test';
  }, durationSec * 1000);
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
