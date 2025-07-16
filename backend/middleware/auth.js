// backend/middleware/auth.js
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');

// Database connection - adapt to your existing setup
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    const userResult = await pool.query(`
      SELECT id, email, role, status, first_name, last_name
      FROM users 
      WHERE id = $1 AND status = 'active'
    `, [decoded.userId]);

    if (userResult.rows.length === 0) {
      return res.status(401).json({ error: 'User not found or inactive' });
    }

    req.user = userResult.rows[0];
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Invalid token' });
  }
};

const requirePermission = (permission) => {
  return async (req, res, next) => {
    try {
      const rolePermissions = {
        admin: [
          'user.create', 'user.read', 'user.update', 'user.delete', 'user.invite',
          'business_entity.read', 'business_entity.create', 'business_entity.update', 'business_entity.delete',
          'audit.read'
        ],
        validator: ['user.read', 'business_entity.read'],
        viewer: ['user.read', 'business_entity.read']
      };

      const hasPermission = rolePermissions[req.user.role]?.includes(permission);
      
      if (!hasPermission) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      next();
    } catch (error) {
      return res.status(500).json({ error: 'Permission check failed' });
    }
  };
};

const auditLog = (action, resourceType) => {
  return async (req, res, next) => {
    const originalSend = res.send;
    
    res.send = function(data) {
      setImmediate(async () => {
        try {
          await pool.query(`
            INSERT INTO audit_logs (user_id, action, resource_type, resource_id, details, ip_address, user_agent)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
          `, [
            req.user?.id,
            action,
            resourceType,
            req.params.id || null,
            JSON.stringify({
              method: req.method,
              url: req.originalUrl,
              body: req.body,
              query: req.query
            }),
            req.ip,
            req.get('User-Agent')
          ]);
        } catch (error) {
          console.error('Audit logging error:', error);
        }
      });
      
      originalSend.call(this, data);
    };
    
    next();
  };
};

module.exports = { authenticateToken, requirePermission, auditLog };