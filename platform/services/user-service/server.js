const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 8006;

const pool = new Pool({
  host: process.env.POSTGRES_HOST || 'postgres',
  port: process.env.POSTGRES_PORT || 5432,
  database: process.env.POSTGRES_DB || 'lakehouse',
  user: process.env.POSTGRES_USER || 'admin',
  password: process.env.POSTGRES_PASSWORD || 'admin123'
});

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'user-service' });
});

app.get('/users/:userId', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, email, display_name, is_active, last_login_at, created_at FROM users WHERE id = $1',
      [req.params.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/users', async (req, res) => {
  try {
    const { email, display_name, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Hash password with bcrypt
    const saltRounds = 10;
    const password_hash = await bcrypt.hash(password, saltRounds);

    const result = await pool.query(
      'INSERT INTO users (email, display_name, password_hash) VALUES ($1, $2, $3) RETURNING id, email, display_name, is_active, created_at',
      [email, display_name || email.split('@')[0], password_hash]
    );
    res.json(result.rows[0]);
  } catch (error) {
    if (error.code === '23505') { // Unique violation
      return res.status(409).json({ error: 'User with this email already exists' });
    }
    console.error('Create user error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/users/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const result = await pool.query(
      'SELECT id, email, display_name, password_hash, is_active FROM users WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];

    // Compare password using bcrypt
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (!user.is_active) {
      return res.status(403).json({ error: 'User account is disabled' });
    }

    // Update last login
    await pool.query(
      'UPDATE users SET last_login_at = NOW() WHERE id = $1',
      [user.id]
    );

    res.json({
      id: user.id,
      email: user.email,
      display_name: user.display_name
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`User Service running on port ${PORT}`);
});

module.exports = app;
