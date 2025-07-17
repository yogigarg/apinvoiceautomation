// frontend/src/components/Dashboard.js - Enhanced version
import React from 'react';
import {
  Box,
  Grid,
  Paper,
  Typography,
  Button,
  Card,
  CardContent,
  CardActions,
  Chip,
  Container,
  Avatar,
  Divider
} from '@mui/material';
import { 
  People, 
  Business, 
  Security, 
  PersonAdd,
  Dashboard as DashboardIcon,
  AdminPanelSettings,
  ExitToApp
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const Dashboard = () => {
  const navigate = useNavigate();
  const { user, hasPermission, logout } = useAuth();

  const userManagementCards = [
    {
      title: 'User Management',
      description: 'Manage users, roles, and permissions across your organization',
      icon: <People />,
      path: '/users',
      permission: 'user.read',
      color: '#1976d2'
    },
    {
      title: 'Business Entities',
      description: 'Manage business entities and validator assignments',
      icon: <Business />,
      path: '/business-entities',
      permission: 'business_entity.read',
      color: '#388e3c'
    },
    {
      title: 'Audit Logs',
      description: 'View system audit logs and track user activities',
      icon: <Security />,
      path: '/audit-logs',
      permission: 'audit.read',
      color: '#f57c00'
    }
  ].filter(card => hasPermission(card.permission));

  const getRoleIcon = (role) => {
    switch (role) {
      case 'admin': return <AdminPanelSettings />;
      case 'validator': return <Security />;
      case 'viewer': return <People />;
      default: return <People />;
    }
  };

  const getRoleColor = (role) => {
    switch (role) {
      case 'admin': return 'error';
      case 'validator': return 'warning';
      case 'viewer': return 'info';
      default: return 'default';
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      {/* Header with User Info and Logout */}
      <Paper sx={{ p: 3, mb: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Avatar sx={{ width: 56, height: 56, bgcolor: 'primary.main' }}>
              {user?.first_name?.[0]}{user?.last_name?.[0]}
            </Avatar>
            <Box>
              <Typography variant="h4" gutterBottom>
                Welcome back, {user?.first_name || 'User'}!
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {getRoleIcon(user?.role)}
                <Chip 
                  label={user?.role?.charAt(0).toUpperCase() + user?.role?.slice(1)} 
                  color={getRoleColor(user?.role)}
                  size="small"
                />
                <Typography variant="body2" color="text.secondary">
                  • Last login: {user?.last_login ? new Date(user.last_login).toLocaleDateString() : 'Never'}
                </Typography>
              </Box>
            </Box>
          </Box>
          <Button
            variant="outlined"
            startIcon={<ExitToApp />}
            onClick={handleLogout}
            color="inherit"
          >
            Logout
          </Button>
        </Box>
      </Paper>

      {/* Your existing dashboard content goes here */}
      <Paper sx={{ p: 3, mb: 4 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
          <DashboardIcon sx={{ fontSize: 32, color: 'primary.main' }} />
          <Typography variant="h5">
            Customer Registration System
          </Typography>
        </Box>
        <Typography variant="body1" color="text.secondary" paragraph>
          This is your existing dashboard content. All your current functionality remains unchanged.
          The user management features are now available as additional capabilities.
        </Typography>
        
        {/* You can add your existing dashboard widgets/content here */}
        <Grid container spacing={3}>
          <Grid item xs={12} sm={6} md={4}>
            <Card variant="outlined">
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Customer Registration
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Your existing customer registration functionality
                </Typography>
              </CardContent>
              <CardActions>
                <Button size="small" onClick={() => navigate('/register')}>
                  Register Customer
                </Button>
              </CardActions>
            </Card>
          </Grid>
          
          <Grid item xs={12} sm={6} md={4}>
            <Card variant="outlined">
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Email Verification
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Manage email verification processes
                </Typography>
              </CardContent>
              <CardActions>
                <Button size="small" onClick={() => navigate('/verify-email')}>
                  Verify Email
                </Button>
              </CardActions>
            </Card>
          </Grid>
          
          <Grid item xs={12} sm={6} md={4}>
            <Card variant="outlined">
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  System Status
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Everything is running smoothly
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Paper>

      {/* User Management Section - Only show if user has permissions */}
      {userManagementCards.length > 0 && (
        <>
          <Divider sx={{ my: 4 }} />
          
          <Typography variant="h5" gutterBottom sx={{ mb: 2 }}>
            <AdminPanelSettings sx={{ mr: 1, verticalAlign: 'middle' }} />
            Administration
          </Typography>
          
          <Grid container spacing={3}>
            {userManagementCards.map((card, index) => (
              <Grid item xs={12} sm={6} md={4} key={index}>
                <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                  <CardContent sx={{ flexGrow: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                      <Box sx={{ 
                        p: 1, 
                        borderRadius: 1, 
                        bgcolor: card.color, 
                        color: 'white',
                        mr: 2,
                        display: 'flex',
                        alignItems: 'center'
                      }}>
                        {card.icon}
                      </Box>
                      <Typography variant="h6" component="div">
                        {card.title}
                      </Typography>
                    </Box>
                    <Typography variant="body2" color="text.secondary">
                      {card.description}
                    </Typography>
                  </CardContent>
                  <CardActions>
                    <Button 
                      size="small" 
                      onClick={() => navigate(card.path)}
                      variant="contained"
                      fullWidth
                      sx={{ bgcolor: card.color }}
                    >
                      Open {card.title}
                    </Button>
                  </CardActions>
                </Card>
              </Grid>
            ))}
          </Grid>
        </>
      )}

      {/* Quick Actions for Admins */}
      {hasPermission('user.invite') && (
        <Paper sx={{ p: 3, mt: 4 }}>
          <Typography variant="h6" gutterBottom>
            Quick Actions
          </Typography>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <Button
              variant="outlined"
              startIcon={<PersonAdd />}
              onClick={() => navigate('/users')}
            >
              Invite New User
            </Button>
            <Button
              variant="outlined"
              startIcon={<People />}
              onClick={() => navigate('/users')}
            >
              Manage Users
            </Button>
            {hasPermission('audit.read') && (
              <Button
                variant="outlined"
                startIcon={<Security />}
                onClick={() => navigate('/audit-logs')}
              >
                View Audit Logs
              </Button>
            )}
          </Box>
        </Paper>
      )}
    </Container>
  );
};

export default Dashboard;