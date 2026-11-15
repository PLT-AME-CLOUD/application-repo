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
