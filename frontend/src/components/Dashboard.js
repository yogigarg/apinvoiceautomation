// frontend/src/components/Dashboard.js - Enhanced with Document Processing
import React, { useState } from 'react';
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
  Divider,
  LinearProgress,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  Tabs,
  Tab
} from '@mui/material';
import { 
  People, 
  Business, 
  Security, 
  PersonAdd,
  Dashboard as DashboardIcon,
  AdminPanelSettings,
  ExitToApp,
  UploadFile,
  Description,
  Analytics,
  CheckCircle,
  TrendingUp,
  Receipt,
  Assignment
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import DocumentUpload from './DocumentProcessing/DocumentUpload';

const Dashboard = () => {
  const navigate = useNavigate();
  const { user, hasPermission, logout } = useAuth();
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [selectedTab, setSelectedTab] = useState(0);

  // Fetch onboarding progress
  const { data: onboardingProgress } = useQuery({
    queryKey: ['onboarding-progress'],
    queryFn: async () => {
      const response = await axios.get('/onboarding/progress');
      return response.data;
    },
    enabled: !!user
  });

  // Fetch user's document analytics
  const { data: documentAnalytics } = useQuery({
    queryKey: ['document-analytics'],
    queryFn: async () => {
      const response = await axios.get('/analytics/dashboard');
      return response.data;
    },
    enabled: !!user
  });

  // Fetch user profile with document stats
  const { data: userProfile } = useQuery({
    queryKey: ['user-profile'],
    queryFn: async () => {
      const response = await axios.get('/users/profile');
      return response.data;
    },
    enabled: !!user
  });

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

  const handleUploadComplete = (document) => {
    setUploadDialogOpen(false);
    // Show success message or navigate to document details
  };

  const TabPanel = ({ children, value, index }) => (
    <div hidden={value !== index} style={{ marginTop: 16 }}>
      {value === index && children}
    </div>
  );

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

      {/* Onboarding Progress */}
      {onboardingProgress && !onboardingProgress.onboardingComplete && (
        <Alert severity="info" sx={{ mb: 4 }}>
          <Typography variant="h6" gutterBottom>
            🚀 Complete Your Onboarding
          </Typography>
          <Typography variant="body2" paragraph>
            Get started by uploading your first invoice to see how our document processing works!
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 2 }}>
            <LinearProgress 
              variant="determinate" 
              value={onboardingProgress.documentsProcessed * 100} 
              sx={{ flexGrow: 1, height: 8, borderRadius: 4 }}
            />
            <Typography variant="body2">
              {onboardingProgress.documentsProcessed}/1 documents processed
            </Typography>
          </Box>
          <Button
            variant="contained"
            startIcon={<UploadFile />}
            onClick={() => setUploadDialogOpen(true)}
            sx={{ mt: 2 }}
          >
            Upload Your First Document
          </Button>
        </Alert>
      )}

      {/* Document Processing Success */}
      {onboardingProgress?.onboardingComplete && (
        <Alert severity="success" sx={{ mb: 4 }}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <CheckCircle sx={{ mr: 1 }} />
            <Typography variant="h6">
              🎉 Onboarding Complete!
            </Typography>
          </Box>
          <Typography variant="body2" sx={{ mt: 1 }}>
            You've successfully processed your first document. The system is ready for production use.
          </Typography>
        </Alert>
      )}

      {/* Document Processing Stats */}
      {documentAnalytics && (
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <Description sx={{ fontSize: 40, color: 'primary.main', mr: 2 }} />
                  <Box>
                    <Typography color="textSecondary" variant="body2">
                      Total Documents
                    </Typography>
                    <Typography variant="h4">
                      {documentAnalytics.summary.totalDocuments}
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <CheckCircle sx={{ fontSize: 40, color: 'success.main', mr: 2 }} />
                  <Box>
                    <Typography color="textSecondary" variant="body2">
                      Completed
                    </Typography>
                    <Typography variant="h4" color="success.main">
                      {documentAnalytics.summary.completedDocuments}
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <TrendingUp sx={{ fontSize: 40, color: 'info.main', mr: 2 }} />
                  <Box>
                    <Typography color="textSecondary" variant="body2">
                      Avg Confidence
                    </Typography>
                    <Typography variant="h4" color="info.main">
                      {documentAnalytics.summary.averageConfidence.toFixed(1)}%
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <Receipt sx={{ fontSize: 40, color: 'warning.main', mr: 2 }} />
                  <Box>
                    <Typography color="textSecondary" variant="body2">
                      Processing
                    </Typography>
                    <Typography variant="h4" color="warning.main">
                      {documentAnalytics.summary.processingDocuments}
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Main Dashboard Content with Tabs */}
      <Paper sx={{ mb: 4 }}>
        <Tabs 
          value={selectedTab} 
          onChange={(e, newValue) => setSelectedTab(newValue)}
          sx={{ borderBottom: 1, borderColor: 'divider' }}
        >
          <Tab label="Customer Registration" icon={<DashboardIcon />} />
          <Tab label="Document Processing" icon={<Description />} />
          {userManagementCards.length > 0 && (
            <Tab label="Administration" icon={<AdminPanelSettings />} />
          )}
        </Tabs>

        {/* Customer Registration Tab */}
        <TabPanel value={selectedTab} index={0}>
          <Box sx={{ p: 3 }}>
            <Typography variant="h5" gutterBottom>
              Customer Registration System
            </Typography>
            <Typography variant="body1" color="text.secondary" paragraph>
              This is your existing dashboard content. All your current functionality remains unchanged.
            </Typography>
            
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
                  <CardActions>
                    <Chip label="Healthy" color="success" size="small" />
                  </CardActions>
                </Card>
              </Grid>
            </Grid>
          </Box>
        </TabPanel>

        {/* Document Processing Tab */}
        <TabPanel value={selectedTab} index={1}>
          <Box sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
              <Typography variant="h5">
                Document Processing
              </Typography>
              <Button
                variant="contained"
                startIcon={<UploadFile />}
                onClick={() => setUploadDialogOpen(true)}
              >
                Upload Document
              </Button>
            </Box>

            {/* Recent Documents */}
            {documentAnalytics?.recentDocuments && (
              <Box>
                <Typography variant="h6" gutterBottom>
                  Recent Documents
                </Typography>
                <Grid container spacing={2}>
                  {documentAnalytics.recentDocuments.map((doc) => (
                    <Grid item xs={12} md={6} key={doc.id}>
                      <Card variant="outlined">
                        <CardContent>
                          <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                            <Description sx={{ mr: 1, color: 'primary.main' }} />
                            <Typography variant="subtitle1" noWrap>
                              {doc.originalName}
                            </Typography>
                          </Box>
                          <Typography variant="body2" color="text.secondary">
                            Status: <Chip 
                              label={doc.status} 
                              color={doc.status === 'completed' ? 'success' : 'default'}
                              size="small"
                            />
                          </Typography>
                          {doc.vendor && (
                            <Typography variant="body2" color="text.secondary">
                              Vendor: {doc.vendor}
                            </Typography>
                          )}
                          {doc.amount && (
                            <Typography variant="body2" color="text.secondary">
                              Amount: ${doc.amount.toFixed(2)}
                            </Typography>
                          )}
                          <Typography variant="caption" color="text.secondary">
                            {new Date(doc.createdAt).toLocaleDateString()}
                          </Typography>
                        </CardContent>
                        <CardActions>
                          <Button size="small" onClick={() => navigate('/documents')}>
                            View All Documents
                          </Button>
                        </CardActions>
                      </Card>
                    </Grid>
                  ))}
                </Grid>
              </Box>
            )}

            {(!documentAnalytics?.recentDocuments || documentAnalytics.recentDocuments.length === 0) && (
              <Card variant="outlined" sx={{ textAlign: 'center', py: 4 }}>
                <CardContent>
                  <Description sx={{ fontSize: 60, color: 'grey.400', mb: 2 }} />
                  <Typography variant="h6" color="text.secondary" gutterBottom>
                    No documents yet
                  </Typography>
                  <Typography variant="body2" color="text.secondary" paragraph>
                    Upload your first invoice to get started with document processing
                  </Typography>
                  <Button
                    variant="contained"
                    startIcon={<UploadFile />}
                    onClick={() => setUploadDialogOpen(true)}
                  >
                    Upload Your First Document
                  </Button>
                </CardContent>
              </Card>
            )}
          </Box>
        </TabPanel>

        {/* Administration Tab */}
        {userManagementCards.length > 0 && (
          <TabPanel value={selectedTab} index={2}>
            <Box sx={{ p: 3 }}>
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
            </Box>
          </TabPanel>
        )}
      </Paper>

      {/* Quick Actions for Admins */}
      {hasPermission('user.invite') && (
        <Paper sx={{ p: 3 }}>
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
            <Button
              variant="outlined"
              startIcon={<UploadFile />}
              onClick={() => setUploadDialogOpen(true)}
            >
              Upload Document
            </Button>
            <Button
              variant="outlined"
              startIcon={<Analytics />}
              onClick={() => navigate('/documents')}
            >
              View Analytics
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

      {/* Document Upload Dialog */}
      <Dialog 
        open={uploadDialogOpen} 
        onClose={() => setUploadDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <UploadFile sx={{ mr: 1 }} />
            Upload Document
          </Box>
        </DialogTitle>
        <DialogContent>
          <DocumentUpload onUploadComplete={handleUploadComplete} />
        </DialogContent>
      </Dialog>
    </Container>
  );
};

export default Dashboard;