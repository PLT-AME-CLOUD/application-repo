const express = require('express');
const cors = require('cors');
const os = require('os');
const app = express();
const port = 3000;

app.use(cors({ origin: '*' }));
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

app.post('/api/greet', (req, res) => {
  const { name, language } = req.body;
  const greetings = {
    english: `Hello, ${name}! Welcome to the ECS Workshop.`,
    spanish: `¡Hola, ${name}! Bienvenido al taller de ECS.`,
    french: `Bonjour, ${name}! Bienvenue à l'atelier ECS.`,
    german: `Hallo, ${name}! Willkommen beim ECS-Workshop.`,
    japanese: `こんにちは、${name}さん！ECSワークショップへようこそ。`,
    hindi: `नमस्ते, ${name}! ECS वर्कशॉप में आपका स्वागत है।`
  };
  const message = greetings[language] || greetings.english;
  res.json({ message, language: language || 'english', name });
});

app.post('/api/calculate', (req, res) => {
  const { operation, a, b } = req.body;
  const numA = parseFloat(a);
  const numB = parseFloat(b);

  if (isNaN(numA) || isNaN(numB)) {
    return res.status(400).json({ error: 'Please provide valid numbers.' });
  }

  let result;
  switch (operation) {
    case 'add':      result = numA + numB; break;
    case 'subtract': result = numA - numB; break;
    case 'multiply': result = numA * numB; break;
    case 'divide':
      if (numB === 0) return res.status(400).json({ error: 'Cannot divide by zero.' });
      result = numA / numB;
      break;
    default:
      return res.status(400).json({ error: 'Invalid operation.' });
  }

  res.json({
    expression: `${numA} ${operation} ${numB}`,
    result: parseFloat(result.toFixed(6))
  });
});

app.post('/api/text', (req, res) => {
  const { text, action } = req.body;
  if (!text) return res.status(400).json({ error: 'Please provide some text.' });

  let result;
  switch (action) {
    case 'uppercase':  result = text.toUpperCase(); break;
    case 'lowercase':  result = text.toLowerCase(); break;
    case 'reverse':    result = text.split('').reverse().join(''); break;
    case 'wordcount':  result = `${text.trim().split(/\s+/).filter(Boolean).length} words`; break;
    case 'charcount':  result = `${text.length} characters`; break;
    case 'titlecase':
      result = text.replace(/\w\S*/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
      break;
    default:
      return res.status(400).json({ error: 'Invalid action.' });
  }

  res.json({ original: text, action, result });
});

let stressState = { active: false, type: null, startedAt: null, endsAt: null };

app.post('/api/stress', (req, res) => {
  const { type, durationSeconds } = req.body;
  const duration = Math.min(Math.max(parseInt(durationSeconds) || 30, 5), 300);

  if (stressState.active) {
    return res.status(409).json({ error: 'Stress test already running.', ...stressState });
  }

  stressState = {
    active: true,
    type,
    startedAt: new Date().toISOString(),
    endsAt: new Date(Date.now() + duration * 1000).toISOString()
  };

  const resetState = () => { stressState = { active: false, type: null, startedAt: null, endsAt: null }; };

  if (type === 'cpu') {
    const workerCode = `
      const { parentPort, workerData } = require('worker_threads');
      const end = Date.now() + workerData.duration * 1000;
      while (Date.now() < end) {
        for (let i = 0; i < 1e6; i++) { Math.sqrt(Math.random() * 999999); }
      }
      parentPort.postMessage('done');
    `;
    const { Worker } = require('worker_threads');
    const workers = [];
    let finished = 0;
    const numWorkers = Math.max(os.cpus().length, 2);
    for (let i = 0; i < numWorkers; i++) {
      const w = new Worker(workerCode, { eval: true, workerData: { duration } });
      w.on('message', () => { finished++; if (finished >= numWorkers) resetState(); });
      w.on('error', () => { finished++; if (finished >= numWorkers) resetState(); });
      workers.push(w);
    }
  } else if (type === 'memory') {
    const chunks = [];
    const totalMB = 450;
    const chunkSize = 10 * 1024 * 1024;
    for (let i = 0; i < totalMB / 10; i++) {
      chunks.push(Buffer.alloc(chunkSize, 0xff));
    }
    setTimeout(() => {
      chunks.length = 0;
      if (global.gc) global.gc();
      resetState();
    }, duration * 1000);
  } else {
    stressState = { active: false, type: null, startedAt: null, endsAt: null };
    return res.status(400).json({ error: 'Type must be "cpu" or "memory".' });
  }

  res.json({
    message: `${type} stress test started for ${duration}s`,
    hostname: os.hostname(),
    ...stressState
  });
});

app.get('/api/stress/status', (req, res) => {
  const mem = process.memoryUsage();
  res.json({
    stress: stressState,
    hostname: os.hostname(),
    cpuUsage: process.cpuUsage(),
    memoryMB: {
      rss: Math.round(mem.rss / 1024 / 1024),
      heapUsed: Math.round(mem.heapUsed / 1024 / 1024),
      heapTotal: Math.round(mem.heapTotal / 1024 / 1024)
    },
    uptime: Math.floor(process.uptime())
  });
});

app.get('/api/info', (req, res) => {
  res.json({
    hostname: os.hostname(),
    platform: os.platform(),
    arch: os.arch(),
    nodeVersion: process.version,
    memoryUsage: `${Math.round(process.memoryUsage().rss / 1024 / 1024)} MB`,
    cpus: os.cpus().length,
    uptime: `${Math.floor(process.uptime())}s`
  });
});

app.listen(port, () => {
  console.log(`Backend running on port ${port}`);
});
