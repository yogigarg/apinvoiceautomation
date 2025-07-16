// server.js - Simplified server for localhost development
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const validator = require('validator');
const crypto = require('crypto');
const Joi = require('joi');
require('dotenv').config();

const app = express();

// Registration schema
const registerSchema = Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().min(8).required(),
    firstName: Joi.string().min(2).max(100).required(),
    lastName: Joi.string().min(2).max(100).required()
});

// Add these imports
const { authenticateToken } = require('./middleware/auth');


// Middleware
app.use(helmet());
app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true
}));

// Add these middleware BEFORE your routes
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
// Add these routes after your existing routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
app.use('/api/auth', authRoutes);
app.use('/api/users', authenticateToken, userRoutes);
// Rate limiting - more relaxed for localhost
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Much higher limit for localhost
  message: 'Too many requests from this IP'
});
app.use(limiter);

// Database connection
const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'customer_registration',
  password: String(process.env.DB_PASSWORD),
  port: process.env.DB_PORT || 5432,
});

// Test database connection
pool.connect((err, client, release) => {
  if (err) {
    console.error('❌ Database connection failed:', err.message);
    console.log('💡 Make sure PostgreSQL is running and database exists');
  } else {
    console.log('✅ Database connected successfully');
    release();
  }
});

// Utility functions
const generateSecureToken = () => crypto.randomBytes(32).toString('hex');

const validatePassword = (password) => {
  const minLength = 8;
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumbers = /\d/.test(password);
  const hasNonalphas = /\W/.test(password);
  
  return {
    isValid: password.length >= minLength && hasUpperCase && hasLowerCase && hasNumbers && hasNonalphas,
    requirements: {
      minLength: password.length >= minLength,
      hasUpperCase,
      hasLowerCase,
      hasNumbers,
      hasSpecialChar: hasNonalphas
    }
  };
};

// Mock email service for localhost (prints to console)
const sendEmail = async (email, subject, message) => {
  console.log('\n📧 EMAIL SENT:');
  console.log('To:', email);
  console.log('Subject:', subject);
  console.log('Message:', message);
  console.log('────────────────────────────────\n');
  return true;
};

// THEN your routes
app.use('/api/auth', require('./routes/auth'));

// Routes

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    environment: 'localhost'
  });
});

// Updated Registration endpoint - Compatible with User Management System
app.post('/api/register', async (req, res) => {
    const client = await pool.connect();

    try {
        const {
            email,
            password,
            firstName,
            lastName,
            phone,
            companyName,
            companyDomain,
            termsAccepted
        } = req.body;

        // Basic validation
        if (!email || !password || !firstName || !lastName || !companyName || !termsAccepted) {
            return res.status(400).json({
                error: 'All required fields must be provided and terms must be accepted'
            });
        }

        if (!validator.isEmail(email)) {
            return res.status(400).json({ error: 'Invalid email format' });
        }

        const passwordValidation = validatePassword(password);
        if (!passwordValidation.isValid) {
            return res.status(400).json({
                error: 'Password does not meet requirements',
                requirements: passwordValidation.requirements
            });
        }

        // Check if user exists
        const existingUser = await client.query('SELECT id FROM users WHERE email = $1', [email]);
        if (existingUser.rows.length > 0) {
            return res.status(409).json({ error: 'User with this email already exists' });
        }

        // Hash password
        const passwordHash = await bcrypt.hash(password, 12);
        const verificationToken = generateSecureToken();
        const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

        await client.query('BEGIN');

        // Create company (your existing logic)
        const companyResult = await client.query(
            'INSERT INTO companies (name, domain, trial_expires_at) VALUES ($1, $2, $3) RETURNING id',
            [companyName, companyDomain, new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)]
        );
        const companyId = companyResult.rows[0].id;

        // Create user with BOTH your existing schema AND new user management columns
        // In your registration route, update the email verification check:
        const userResult = await client.query(
            `INSERT INTO users (
    email, 
    password, 
    password_hash, 
    first_name, 
    last_name, 
    phone, 
    company_id, 
    email_verification_token, 
    email_verification_expires, 
    terms_accepted, 
    terms_accepted_at,
    role,
    status,
    created_at,
    updated_at,
    is_email_verified
  ) VALUES ($1, $2, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) RETURNING id, email, first_name, last_name, role, status`,
            [
                email,
                passwordHash,
                firstName,
                lastName,
                phone,
                companyId,
                verificationToken,
                verificationExpires,
                termsAccepted,
                new Date(),
                'viewer',
                'pending',
                new Date(),
                new Date(),
                false // is_email_verified starts as false
            ]
        );

        const newUser = userResult.rows[0];

        // Create trial limitations (your existing logic)
        await client.query(
            'INSERT INTO trial_limitations (company_id) VALUES ($1)',
            [companyId]
        );

        await client.query('COMMIT');

        // Send verification email (your existing logic)
        const verificationUrl = `http://localhost:3000/verify-email?token=${verificationToken}`;
        await sendEmail(
            email,
            'Verify Your Email Address',
            `Hi ${firstName}! Click here to verify: ${verificationUrl}`
        );

        console.log(`🎉 User registered: ${email}`);
        console.log(`🔗 Verification URL: ${verificationUrl}`);

        // Generate JWT token for immediate login (optional)
        const token = jwt.sign(
            { userId: newUser.id, email: newUser.email, role: newUser.role },
            process.env.JWT_SECRET ,
            { expiresIn: '24h' }
        );

        res.status(201).json({
            message: 'Registration successful! Check console for verification link.',
            requiresVerification: true,
            verificationUrl: verificationUrl, // For localhost testing
            token, // JWT token for immediate login
            user: {
                id: newUser.id,
                email: newUser.email,
                firstName: newUser.first_name,
                lastName: newUser.last_name,
                role: newUser.role,
                status: newUser.status
            }
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Registration error:', error);

        // More specific error handling
        if (error.code === '23505') { // Unique constraint violation
            return res.status(409).json({ error: 'User with this email already exists' });
        }

        if (error.code === '42703') { // Column does not exist
            return res.status(500).json({
                error: 'Database schema error. Please run user management migrations first.'
            });
        }

        res.status(500).json({ error: 'Registration failed. Please try again.' });
    } finally {
        client.release();
    }
});

// Email verification endpoint
app.post('/api/verify-email', async (req, res) => {
    const client = await pool.connect();

    try {
        const { token } = req.body;

        if (!token) {
            return res.status(400).json({ error: 'Verification token is required' });
        }

        // Find user with this token
        const userResult = await client.query(
            'SELECT id, email, first_name, last_name, role FROM users WHERE email_verification_token = $1 AND email_verification_expires > NOW()',
            [token]
        );

        if (userResult.rows.length === 0) {
            return res.status(400).json({ error: 'Invalid or expired verification token' });
        }

        const user = userResult.rows[0];

        await client.query('BEGIN');

        // Update user: clear verification token AND set status to active
        await client.query(
            `UPDATE users 
       SET email_verification_token = NULL, 
           email_verification_expires = NULL, 
           is_email_verified = true,
           status = 'active',
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
            [user.id]
        );

        await client.query('COMMIT');

        // Generate JWT token for login
        const jwtToken = jwt.sign(
            { userId: user.id, email: user.email, role: user.role },
            process.env.JWT_SECRET || 'your-secret-key',
            { expiresIn: '24h' }
        );

        console.log(`✅ Email verified for: ${user.email}`);

        res.json({
            message: 'Email verified successfully!',
            token: jwtToken,
            user: {
                id: user.id,
                email: user.email,
                firstName: user.first_name,
                lastName: user.last_name,
                role: user.role,
                status: 'active'
            }
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Email verification error:', error);
        res.status(500).json({ error: 'Email verification failed. Please try again.' });
    } finally {
        client.release();
    }
});

// Login endpoint
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Find user
    const result = await pool.query(
      `SELECT u.id, u.password_hash, u.is_email_verified, u.first_name, 
              u.last_name, u.company_id, c.subscription_type
       FROM users u
       JOIN companies c ON u.company_id = c.id
       WHERE u.email = $1`,
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];

    // Check if email is verified
    if (!user.is_email_verified) {
      return res.status(401).json({
        error: 'Please verify your email address before logging in',
        requiresVerification: true
      });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Update last login
    await pool.query('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id]);

    // Generate JWT token
    const token = jwt.sign(
      {
        userId: user.id,
        email: email,
        companyId: user.company_id
      },
      process.env.JWT_SECRET ,
      { expiresIn: '24h' }
    );

    console.log(`🔐 User logged in: ${email}`);

    res.json({
      token,
      user: {
        id: user.id,
        email: email,
        firstName: user.first_name,
        lastName: user.last_name,
        companyId: user.company_id,
        subscriptionType: user.subscription_type
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed. Please try again.' });
  }
});

// Password strength check endpoint
app.post('/api/check-password-strength', async(req, res) => {
  const { password } = req.body;
  
  if (!password) {
    return res.status(400).json({ error: 'Password is required' });
  }

  const validation = validatePassword(password);
  
  res.json({
    isValid: validation.isValid,
    requirements: validation.requirements,
    strength: validation.isValid ? 'Strong' : 'Weak'
  });
});

// Get company info endpoint
app.get('/api/company/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query(
      `SELECT c.*, tl.max_users, tl.max_projects, tl.max_storage_mb, tl.features_enabled
       FROM companies c
       LEFT JOIN trial_limitations tl ON c.id = tl.company_id
       WHERE c.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Company not found' });
    }

    res.json(result.rows[0]);

  } catch (error) {
    console.error('Get company error:', error);
    res.status(500).json({ error: 'Failed to get company information' });
  }
});

// Add this route to help migrate your existing users to the new schema
app.post('/api/admin/migrate-users', async (req, res) => {
    try {
        // Add missing columns to existing users
        await pool.query(`
      UPDATE users 
      SET 
        role = COALESCE(role, 'viewer'),
        status = CASE 
          WHEN email_verified = true THEN 'active'
          WHEN email_verification_token IS NOT NULL THEN 'pending'
          ELSE 'active'
        END,
        password = COALESCE(password, password_hash),
        created_at = COALESCE(created_at, CURRENT_TIMESTAMP),
        updated_at = COALESCE(updated_at, CURRENT_TIMESTAMP)
      WHERE role IS NULL OR status IS NULL
    `);

        const result = await pool.query('SELECT COUNT(*) as migrated_users FROM users');

        res.json({
            message: 'User migration completed',
            migrated_users: result.rows[0].migrated_users
        });

    } catch (error) {
        console.error('Migration error:', error);
        res.status(500).json({ error: 'Migration failed: ' + error.message });
    }
});

// Add this temporary debug route to your server.js
app.post('/api/debug/token', (req, res) => {
    try {
        const { token } = req.body;

        console.log('JWT_SECRET exists:', !!process.env.JWT_SECRET);
        console.log('JWT_SECRET length:', process.env.JWT_SECRET?.length);
        console.log('Token received:', token?.substring(0, 20) + '...');

        if (!process.env.JWT_SECRET) {
            return res.json({ error: 'JWT_SECRET not set in environment' });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        res.json({
            valid: true,
            decoded: decoded,
            secretLength: process.env.JWT_SECRET.length
        });
    } catch (error) {
        res.json({
            valid: false,
            error: error.message,
            secretExists: !!process.env.JWT_SECRET
        });
    }
});

// Add this route to your server.js if it doesn't exist
app.get('/api/users/profile', async (req, res) => {
    try {
        // Get token from Authorization header
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];

        if (!token) {
            return res.status(401).json({ error: 'Access token required' });
        }

        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Get user from database
        const client = await pool.connect();
        try {
            const userResult = await client.query(`
        SELECT id, email, first_name, last_name, role, status, created_at, last_login
        FROM users 
        WHERE id = $1 AND status = 'active'
      `, [decoded.userId]);

            if (userResult.rows.length === 0) {
                return res.status(404).json({ error: 'User not found' });
            }

            const user = userResult.rows[0];
            res.json({
                id: user.id,
                email: user.email,
                first_name: user.first_name,
                last_name: user.last_name,
                role: user.role,
                status: user.status,
                created_at: user.created_at,
                last_login: user.last_login
            });
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('Profile fetch error:', error);
        if (error.name === 'JsonWebTokenError') {
            return res.status(403).json({ error: 'Invalid token' });
        }
        res.status(500).json({ error: 'Failed to get profile' });
    }
});


// Localhost helper endpoint - manually verify email
app.post('/api/localhost/verify-user', async (req, res) => {
  try {
    const { email } = req.body;
    
    await pool.query(
      'UPDATE users SET is_email_verified = true WHERE email = $1',
      [email]
    );
    
    console.log(`🔧 Manually verified user: ${email}`);
    res.json({ message: 'User verified successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to verify user' });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ error: 'Something went wrong!' });
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log('\n🚀 Customer Registration Server');
  console.log(`📍 Running on: http://localhost:${PORT}`);
  console.log(`🗄️  Database: ${process.env.DB_NAME || 'customer_registration'}`);
  console.log(`🌐 Frontend: http://localhost:3000`);
  console.log('📧 Email: Console logging (localhost mode)');
  console.log('────────────────────────────────');
  console.log('✨ Ready for development!\n');
});

module.exports = app;