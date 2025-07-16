// backend/routes/auth.js
const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const Joi = require('joi');
const { Pool } = require('pg');
const { sendInvitationEmail, sendWelcomeEmail } = require('../services/emailService');
const { authenticateToken, requirePermission, auditLog } = require('../middleware/auth');

const router = express.Router();
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: String(process.env.DB_PASSWORD), // Ensure it's a string
});

// Validation schemas
const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required()
});

const registerSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(8).required(),
  firstName: Joi.string().min(2).max(100).required(),
  lastName: Joi.string().min(2).max(100).required()
});

const inviteSchema = Joi.object({
  email: Joi.string().email().required(),
  firstName: Joi.string().min(2).max(100).required(),
  lastName: Joi.string().min(2).max(100).required(),
  role: Joi.string().valid('admin', 'validator', 'viewer').required()
});

const acceptInvitationSchema = Joi.object({
  token: Joi.string().required(),
  password: Joi.string().min(8).required()
});

// Login
router.post('/login', async (req, res) => {
  try {
    console.log('Login attempt - req.body:', req.body); // Debug log
    
    if (!req.body) {
      return res.status(400).json({ error: 'No request body received' });
    }

    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Find user
    const userResult = await pool.query(
      'SELECT id, email, password, password_hash, first_name, last_name, role, status FROM users WHERE email = $1',
      [email]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = userResult.rows[0];
    
    // Check password (try both password and password_hash columns)
    const passwordToCheck = user.password || user.password_hash;
    const isValidPassword = await bcrypt.compare(password, passwordToCheck);
    
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check if user is active
    if (user.status !== 'active') {
      return res.status(401).json({ error: 'Account is not active. Please verify your email.' });
    }

    // Generate token
    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Update last login
    await pool.query('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1', [user.id]);

    console.log('Login successful for:', email); // Debug log

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        role: user.role,
        status: user.status
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Register (if you want to keep existing registration functionality)
router.post('/register', auditLog('register', 'user'), async (req, res) => {
  try {
    const { error } = registerSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    const { email, password, firstName, lastName } = req.body;

    // Check if user already exists
    const existingUser = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: 'User with this email already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const userResult = await pool.query(`
      INSERT INTO users (email, password, first_name, last_name, role, status)
      VALUES ($1, $2, $3, $4, 'viewer', 'active')
      RETURNING id, email, first_name, last_name, role
    `, [email, hashedPassword, firstName, lastName]);

    const user = userResult.rows[0];

    // Send welcome email
    await sendWelcomeEmail(email, firstName);

    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.status(201).json({
      token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Invite user (admin only)
router.post('/invite', 
  authenticateToken, 
  requirePermission('user.invite'),
  auditLog('invite_user', 'user'),
  async (req, res) => {
    try {
      const { error } = inviteSchema.validate(req.body);
      if (error) return res.status(400).json({ error: error.details[0].message });

      const { email, firstName, lastName, role } = req.body;

      // Check if user already exists
      const existingUser = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
      if (existingUser.rows.length > 0) {
        return res.status(400).json({ error: 'User with this email already exists' });
      }

      const invitationToken = uuidv4();
      const invitationExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

      // Create user with pending status
      const userResult = await pool.query(`
        INSERT INTO users (email, first_name, last_name, role, status, invitation_token, invitation_expires_at)
        VALUES ($1, $2, $3, $4, 'pending', $5, $6)
        RETURNING id
      `, [email, firstName, lastName, role, invitationToken, invitationExpires]);

      // Send invitation email
      const inviterResult = await pool.query(
        'SELECT first_name, last_name FROM users WHERE id = $1',
        [req.user.id]
      );
      const inviterName = `${inviterResult.rows[0].first_name} ${inviterResult.rows[0].last_name}`;

      const emailResult = await sendInvitationEmail(email, invitationToken, inviterName);
      
      if (!emailResult.success) {
        // Rollback user creation if email fails
        await pool.query('DELETE FROM users WHERE id = $1', [userResult.rows[0].id]);
        return res.status(500).json({ error: 'Failed to send invitation email' });
      }

      res.json({ message: 'Invitation sent successfully', userId: userResult.rows[0].id });
    } catch (error) {
      console.error('Invitation error:', error);
      res.status(500).json({ error: 'Failed to send invitation' });
    }
  }
);

// Accept invitation
router.post('/accept-invitation', auditLog('accept_invitation', 'user'), async (req, res) => {
  try {
    const { error } = acceptInvitationSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    const { token, password } = req.body;

    const userResult = await pool.query(`
      SELECT id, email, first_name, last_name, role, invitation_expires_at 
      FROM users 
      WHERE invitation_token = $1 AND status = 'pending'
    `, [token]);

    if (userResult.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid or expired invitation' });
    }

    const user = userResult.rows[0];
    
    if (new Date() > new Date(user.invitation_expires_at)) {
      return res.status(400).json({ error: 'Invitation has expired' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await pool.query(`
      UPDATE users 
      SET password = $1, status = 'active', invitation_token = NULL, invitation_expires_at = NULL, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
    `, [hashedPassword, user.id]);

    // Send welcome email
    await sendWelcomeEmail(user.email, user.first_name);

    const jwtToken = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      token: jwtToken,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Accept invitation error:', error);
    res.status(500).json({ error: 'Failed to accept invitation' });
  }
});

// Logout (optional - mainly clears any server-side sessions if you have them)
router.post('/logout', authenticateToken, auditLog('logout', 'user'), async (req, res) => {
  try {
    // In a JWT-based system, logout is mainly handled on the client side
    // But you can add any server-side cleanup here if needed
    
    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Logout failed' });
  }
});

// Verify token (useful for checking if a token is still valid)
router.get('/verify', authenticateToken, async (req, res) => {
  try {
    // If we reach here, the token is valid (middleware passed)
    res.json({
      valid: true,
      user: {
        id: req.user.id,
        email: req.user.email,
        firstName: req.user.first_name,
        lastName: req.user.last_name,
        role: req.user.role
      }
    });
  } catch (error) {
    console.error('Token verification error:', error);
    res.status(500).json({ error: 'Token verification failed' });
  }
});

// Get current user info
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const userResult = await pool.query(`
      SELECT id, email, first_name, last_name, role, status, created_at, last_login
      FROM users 
      WHERE id = $1
    `, [req.user.id]);

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(userResult.rows[0]);
  } catch (error) {
    console.error('Get current user error:', error);
    res.status(500).json({ error: 'Failed to get user information' });
  }
});

module.exports = router;