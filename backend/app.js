const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { authenticate } = require('./middleware/auth');

const app = express();

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({
  origin: process.env.FRONTEND_URL || true,
  credentials: true,
  allowedHeaders: ['Authorization', 'Content-Type'],
}));
app.use(express.json({ limit: '20mb' }));

app.get('/api/health', (_, res) => res.json({ status: 'ok' }));

app.use(authenticate);

app.use('/api/employees', require('./routes/employees'));
app.use('/api/requests',  require('./routes/requests'));
app.use('/api/balances',  require('./routes/balances'));
app.use('/api/bonus',     require('./routes/bonus'));
app.use('/api/pdf',       require('./routes/pdf'));

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

module.exports = app;
