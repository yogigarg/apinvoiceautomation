// backend/routes/users.js
const express = require('express');
const bcrypt = require('bcrypt');
const { Pool } = require('pg');
const { requirePermission, auditLog } = require('../middleware/auth');
const Joi = require('joi');

const router = express.Router();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Validation schemas
const updateProfileSchema = Joi.object({
  firstName: Joi.string().min(2).max(100).optional(),
  lastName: Joi.string().min(2).max(100).optional(),
  currentPassword: Joi.string().when('newPassword', {
    is: Joi.exist(),
    then: Joi.required(),
    otherwise: Joi.optional()
  }),
  newPassword: Joi.string().min(8).optional()
});

const updateUserSchema = Joi.object({
  firstName: Joi.string().min(2).max(100).optional(),
  lastName: Joi.string().min(2).max(100).optional(),
  role: Joi.string().valid('admin', 'validator', 'viewer').optional(),
  status: Joi.string().valid('active', 'suspended').optional()
});

// Get current user profile
router.get('/profile', async (req, res) => {
  try {
    const userResult = await pool.query(`
      SELECT 
        u.id, 
        u.email, 
        u.first_name, 
        u.last_name, 
        u.role, 
        u.status, 
        u.created_at, 
        u.last_login,
        array_agg(
          json_build_object(
            'id', be.id, 
            'name', be.name, 
            'code', be.code
          )
        ) FILTER (WHERE be.id IS NOT NULL) as business_entities
      FROM users u
      LEFT JOIN user_business_entities ube ON u.id = ube.user_id
      LEFT JOIN business_entities be ON ube.business_entity_id = be.id
      WHERE u.id = $1
      GROUP BY u.id
    `, [req.user.id]);

    const user = userResult.rows[0];
    res.json({
      ...user,
      business_entities: user.business_entities || []
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Failed to get profile' });
  }
});

// Get all users (with pagination and search)
router.get('/', requirePermission('user.read'), auditLog('list_users', 'user'), async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    const search = req.query.search || '';
    const role = req.query.role || '';
    const status = req.query.status || '';

    let query = `
      SELECT 
        u.id, 
        u.email, 
        u.first_name, 
        u.last_name, 
        u.role, 
        u.status, 
        u.created_at, 
        u.last_login,
        array_agg(
          json_build_object(
            'id', be.id, 
            'name', be.name, 
            'code', be.code
          )
        ) FILTER (WHERE be.id IS NOT NULL) as business_entities
      FROM users u
      LEFT JOIN user_business_entities ube ON u.id = ube.user_id
      LEFT JOIN business_entities be ON ube.business_entity_id = be.id
    `;

    const params = [];
    const conditions = [];
    let paramIndex = 1;

    if (search) {
      conditions.push(`(u.first_name ILIKE $${paramIndex} OR u.last_name ILIKE $${paramIndex} OR u.email ILIKE $${paramIndex})`);
      params.push(`%${search}%`);
      paramIndex++;
    }

    if (role) {
      conditions.push(`u.role = $${paramIndex}`);
      params.push(role);
      paramIndex++;
    }

    if (status) {
      conditions.push(`u.status = $${paramIndex}`);
      params.push(status);
      paramIndex++;
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    query += ` GROUP BY u.id ORDER BY u.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const usersResult = await pool.query(query, params);
    
    // Get total count
    let countQuery = 'SELECT COUNT(*) FROM users u';
    let countParams = [];
    let countParamIndex = 1;

    if (conditions.length > 0) {
      const countConditions = [];
      if (search) {
        countConditions.push(`(u.first_name ILIKE $${countParamIndex} OR u.last_name ILIKE $${countParamIndex} OR u.email ILIKE $${countParamIndex})`);
        countParams.push(`%${search}%`);
        countParamIndex++;
      }

      if (role) {
        countConditions.push(`u.role = $${countParamIndex}`);
        countParams.push(role);
        countParamIndex++;
      }

      if (status) {
        countConditions.push(`u.status = $${countParamIndex}`);
        countParams.push(status);
        countParamIndex++;
      }

      if (countConditions.length > 0) {
        countQuery += ` WHERE ${countConditions.join(' AND ')}`;
      }
    }
    
    const countResult = await pool.query(countQuery, countParams);
    const totalCount = parseInt(countResult.rows[0].count);

    res.json({
      users: usersResult.rows.map(user => ({
        ...user,
        business_entities: user.business_entities || []
      })),
      pagination: {
        page,
        limit,
        total: totalCount,
        pages: Math.ceil(totalCount / limit)
      }
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Failed to get users' });
  }
});

// Get user by ID
router.get('/:id', requirePermission('user.read'), auditLog('view_user', 'user'), async (req, res) => {
  try {
    const userId = req.params.id;

    const userResult = await pool.query(`
      SELECT 
        u.id, 
        u.email, 
        u.first_name, 
        u.last_name, 
        u.role, 
        u.status, 
        u.created_at, 
        u.last_login,
        array_agg(
          json_build_object(
            'id', be.id, 
            'name', be.name, 
            'code', be.code
          )
        ) FILTER (WHERE be.id IS NOT NULL) as business_entities
      FROM users u
      LEFT JOIN user_business_entities ube ON u.id = ube.user_id
      LEFT JOIN business_entities be ON ube.business_entity_id = be.id
      WHERE u.id = $1
      GROUP BY u.id
    `, [userId]);

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = userResult.rows[0];
    res.json({
      ...user,
      business_entities: user.business_entities || []
    });
  } catch (error) {
    console.error('Get user by ID error:', error);
    res.status(500).json({ error: 'Failed to get user' });
  }
});

// Update user profile (self)
router.put('/profile', auditLog('update_profile', 'user'), async (req, res) => {
  try {
    const { error } = updateProfileSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    const { firstName, lastName, currentPassword, newPassword } = req.body;

    let updateFields = [];
    let updateParams = [];
    let paramIndex = 1;

    if (firstName) {
      updateFields.push(`first_name = $${paramIndex}`);
      updateParams.push(firstName);
      paramIndex++;
    }

    if (lastName) {
      updateFields.push(`last_name = $${paramIndex}`);
      updateParams.push(lastName);
      paramIndex++;
    }

    if (newPassword) {
      // Verify current password
      const userResult = await pool.query('SELECT password FROM users WHERE id = $1', [req.user.id]);
      const isValidPassword = await bcrypt.compare(currentPassword, userResult.rows[0].password);
      
      if (!isValidPassword) {
        return res.status(400).json({ error: 'Current password is incorrect' });
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10);
      updateFields.push(`password = $${paramIndex}`);
      updateParams.push(hashedPassword);
      paramIndex++;
    }

    if (updateFields.length > 0) {
      updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
      updateParams.push(req.user.id);

      const updateQuery = `UPDATE users SET ${updateFields.join(', ')} WHERE id = $${paramIndex}`;
      await pool.query(updateQuery, updateParams);
    }

    res.json({ message: 'Profile updated successfully' });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// Update user (admin only)
router.put('/:id', requirePermission('user.update'), auditLog('update_user', 'user'), async (req, res) => {
  try {
    const { error } = updateUserSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    const { firstName, lastName, role, status } = req.body;
    const userId = req.params.id;

    // Check if user exists
    const userExists = await pool.query('SELECT id FROM users WHERE id = $1', [userId]);
    if (userExists.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Prevent self-demotion from admin
    if (userId === req.user.id && role && role !== 'admin' && req.user.role === 'admin') {
      return res.status(400).json({ error: 'Cannot change your own admin role' });
    }

    // Build update query
    let updateFields = [];
    let updateParams = [];
    let paramIndex = 1;

    if (firstName) {
      updateFields.push(`first_name = $${paramIndex}`);
      updateParams.push(firstName);
      paramIndex++;
    }

    if (lastName) {
      updateFields.push(`last_name = $${paramIndex}`);
      updateParams.push(lastName);
      paramIndex++;
    }

    if (role) {
      updateFields.push(`role = $${paramIndex}`);
      updateParams.push(role);
      paramIndex++;
    }

    if (status) {
      updateFields.push(`status = $${paramIndex}`);
      updateParams.push(status);
      paramIndex++;
    }

    if (updateFields.length > 0) {
      updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
      updateParams.push(userId);

      const updateQuery = `UPDATE users SET ${updateFields.join(', ')} WHERE id = $${paramIndex}`;
      await pool.query(updateQuery, updateParams);
    }

    res.json({ message: 'User updated successfully' });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// Delete user (soft delete)
router.delete('/:id', requirePermission('user.delete'), auditLog('delete_user', 'user'), async (req, res) => {
  try {
    const userId = req.params.id;

    // Check if user exists and is not already deleted
    const userResult = await pool.query('SELECT id, status FROM users WHERE id = $1', [userId]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (userResult.rows[0].status === 'deleted') {
      return res.status(400).json({ error: 'User is already deleted' });
    }

    // Prevent self-deletion
    if (userId === req.user.id) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }

    // Soft delete user
    await pool.query('UPDATE users SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', ['deleted', userId]);

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// Get user statistics (admin only)
router.get('/stats/overview', requirePermission('user.read'), auditLog('view_user_stats', 'user'), async (req, res) => {
  try {
    const stats = await pool.query(`
      SELECT 
        COUNT(*) as total_users,
        COUNT(*) FILTER (WHERE status = 'active') as active_users,
        COUNT(*) FILTER (WHERE status = 'pending') as pending_users,
        COUNT(*) FILTER (WHERE status = 'suspended') as suspended_users,
        COUNT(*) FILTER (WHERE role = 'admin') as admin_users,
        COUNT(*) FILTER (WHERE role = 'validator') as validator_users,
        COUNT(*) FILTER (WHERE role = 'viewer') as viewer_users,
        COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE - INTERVAL '30 days') as users_last_30_days,
        COUNT(*) FILTER (WHERE last_login >= CURRENT_DATE - INTERVAL '30 days') as active_last_30_days
      FROM users
      WHERE status != 'deleted'
    `);

    res.json(stats.rows[0]);
  } catch (error) {
    console.error('Get user stats error:', error);
    res.status(500).json({ error: 'Failed to get user statistics' });
  }
});

// Suspend user (admin only)
router.post('/:id/suspend', requirePermission('user.update'), auditLog('suspend_user', 'user'), async (req, res) => {
  try {
    const userId = req.params.id;

    // Prevent self-suspension
    if (userId === req.user.id) {
      return res.status(400).json({ error: 'Cannot suspend your own account' });
    }

    // Check if user exists
    const userResult = await pool.query('SELECT id, status FROM users WHERE id = $1', [userId]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (userResult.rows[0].status === 'suspended') {
      return res.status(400).json({ error: 'User is already suspended' });
    }

    await pool.query('UPDATE users SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', ['suspended', userId]);

    res.json({ message: 'User suspended successfully' });
  } catch (error) {
    console.error('Suspend user error:', error);
    res.status(500).json({ error: 'Failed to suspend user' });
  }
});

// Reactivate user (admin only)
router.post('/:id/reactivate', requirePermission('user.update'), auditLog('reactivate_user', 'user'), async (req, res) => {
  try {
    const userId = req.params.id;

    // Check if user exists
    const userResult = await pool.query('SELECT id, status FROM users WHERE id = $1', [userId]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (userResult.rows[0].status === 'active') {
      return res.status(400).json({ error: 'User is already active' });
    }

    await pool.query('UPDATE users SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', ['active', userId]);

    res.json({ message: 'User reactivated successfully' });
  } catch (error) {
    console.error('Reactivate user error:', error);
    res.status(500).json({ error: 'Failed to reactivate user' });
  }
});

module.exports = router;