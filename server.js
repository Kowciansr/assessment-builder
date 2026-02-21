require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

// Initialize DB (runs schema creation)
require('./db/schema');

const apiRoutes = require('./routes/api');

const app = express();
const PORT = process.env.PORT || 3001;

// ---- Middleware ----
app.use(cors({ origin: ['http://localhost:5173', 'http://localhost:3000'] }));
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));

// ---- Routes ----
app.use('/api', apiRoutes);

// ---- Health check ----
app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// ---- Error handler ----
app.use((err, req, res, next) => {
  console.error(err.stack);
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ success: false, error: 'File too large' });
  }
  res.status(500).json({ success: false, error: err.message || 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`✅ Assessment Builder API running on http://localhost:${PORT}`);
  console.log(`   OpenAI Model: ${process.env.OPENAI_MODEL || 'gpt-4o'}`);
});
