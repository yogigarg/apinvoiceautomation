// src/components/DocumentProcessing/OnboardingProgress.js
import React from 'react';
import {
  Container,
  Typography,
  Box,
  Card,
  CardContent,
  Grid,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Button,
  LinearProgress,
  Alert,
  Paper,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Chip,
  Divider
} from '@mui/material';
import {
  CheckCircle,
  RadioButtonUnchecked,
  UploadFile,
  Visibility,
  Analytics,
  ApiOutlined,
  School,
  TrendingUp,
  Assignment,
  PlayArrow,
  GetApp
} from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import axios from 'axios';

const OnboardingProgress = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  // Fetch onboarding progress
  const { data: onboardingProgress, isLoading } = useQuery({
    queryKey: ['onboarding-progress'],
    queryFn: async () => {
      const response = await axios.get('/api/onboarding/progress');
      return response.data;
    }
  });

  // Fetch user profile for additional stats
  const { data: userProfile } = useQuery({
    queryKey: ['user-profile'],
    queryFn: async () => {
      const response = await axios.get('/api/users/profile');
      return response.data;
    }
  });

  const handleNavigateToDocuments = () => navigate('/documents');
  const handleNavigateToSamples = () => navigate('/documents/samples');
  const handleNavigateToDashboard = () => navigate('/dashboard');
  const handleOpenApiDocs = () => window.open('https://docs.anthropic.com', '_blank');

  const onboardingSteps = [
    {
      label: 'Account Setup',
      description: 'Create your account and verify email',
      completed: true, // Always completed if user can access this page
      action: null,
      icon: <CheckCircle color="success" />
    },
    {
      label: 'Upload First Document',
      description: 'Process your first invoice to see how the system works',
      completed: onboardingProgress?.documentsProcessed > 0,
      action: onboardingProgress?.documentsProcessed === 0 ? {
        label: 'Upload Document',
        onClick: handleNavigateToDocuments,
        icon: <UploadFile />
      } : null,
      icon: onboardingProgress?.documentsProcessed > 0 ? <CheckCircle color="success" /> : <RadioButtonUnchecked />
    },
    {
      label: 'Review Results',
      description: 'Examine the extracted data and processing metrics',
      completed: onboardingProgress?.documentsProcessed > 0,
      action: onboardingProgress?.documentsProcessed > 0 ? {
        label: 'View Documents',
        onClick: handleNavigateToDocuments,
        icon: <Visibility />
      } : null,
      icon: onboardingProgress?.documentsProcessed > 0 ? <CheckCircle color="success" /> : <RadioButtonUnchecked />
    },
    {
      label: 'Explore Features',
      description: 'Learn about advanced features and integrations',
      completed: onboardingProgress?.onboardingComplete,
      action: {
        label: 'View Analytics',
        onClick: handleNavigateToDocuments,
        icon: <Analytics />
      },
      icon: onboardingProgress?.onboardingComplete ? <CheckCircle color="success" /> : <RadioButtonUnchecked />
    }
  ];

  const currentStep = onboardingSteps.findIndex(step => !step.completed);
  const progressPercentage = (onboardingSteps.filter(step => step.completed).length / onboardingSteps.length) * 100;

  const quickActions = [
    {
      title: 'Try Sample Invoice',
      description: 'Process a sample invoice to see how it works',
      icon: <School />,
      action: handleNavigateToSamples,
      color: '#1976d2'
    },
    {
      title: 'Upload Document',
      description: 'Upload your own invoice for processing',
      icon: <UploadFile />,
      action: handleNavigateToDocuments,
      color: '#388e3c'
    },
    {
      title: 'View Analytics',
      description: 'See processing metrics and performance data',
      icon: <TrendingUp />,
      action: handleNavigateToDocuments,
      color: '#f57c00'
    },
    {
      title: 'API Documentation',
      description: 'Learn how to integrate with your systems',
      icon: <ApiOutlined />,
      action: handleOpenApiDocs,
      color: '#9c27b0'
    }
  ];

  const benefits = [
    'Automatic text extraction from invoices',
    'Structured data extraction (vendor, amount, date)',
    'High accuracy OCR processing',
    'Real-time processing progress',
    'Export capabilities for integration',
    'Audit trail and processing metrics'
  ];

  if (isLoading) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <LinearProgress />
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Box sx={{ textAlign: 'center', mb: 4 }}>
        <Typography variant="h3" gutterBottom>
          🚀 Welcome to Document Processing
        </Typography>
        <Typography variant="h6" color="text.secondary">
          Let's get you started with automated invoice processing
        </Typography>
      </Box>

      <Paper sx={{ p: 4, mb: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h5">
            Onboarding Progress
          </Typography>
          <Chip 
            label={onboardingProgress?.onboardingComplete ? 'Complete' : 'In Progress'}
            color={onboardingProgress?.onboardingComplete ? 'success' : 'primary'}
            size="large"
          />
        </Box>

        <Box sx={{ mb: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
            <Typography variant="body2" color="text.secondary">
              Overall Progress
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {Math.round(progressPercentage)}%
            </Typography>
          </Box>
          <LinearProgress 
            variant="determinate" 
            value={progressPercentage}
            sx={{ height: 8, borderRadius: 4 }}
          />
        </Box>

        {onboardingProgress?.onboardingComplete ? (
          <Alert severity="success" sx={{ mt: 2 }}>
            <Typography variant="h6" gutterBottom>
              🎉 Congratulations! Onboarding Complete
            </Typography>
            <Typography variant="body2">
              You have successfully completed the onboarding process. Your document processing system is ready for production use.
            </Typography>
          </Alert>
        ) : (
          <Alert severity="info" sx={{ mt: 2 }}>
            <Typography variant="body1">
              Complete the steps below to finish your onboarding and unlock the full potential of automated document processing.
            </Typography>
          </Alert>
        )}
      </Paper>

      <Grid container spacing={4}>
        <Grid item xs={12} md={8}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Getting Started Steps
              </Typography>
              
              <Stepper activeStep={currentStep === -1 ? onboardingSteps.length : currentStep} orientation="vertical">
                {onboardingSteps.map((step, index) => (
                  <Step key={step.label}>
                    <StepLabel 
                      icon={step.icon}
                      sx={{
                        '& .MuiStepLabel-label': {
                          color: step.completed ? 'success.main' : 'text.primary',
                          fontWeight: step.completed ? 600 : 400
                        }
                      }}
                    >
                      {step.label}
                    </StepLabel>
                    <StepContent>
                      <Typography variant="body2" color="text.secondary" paragraph>
                        {step.description}
                      </Typography>
                      {step.action && (
                        <Button
                          variant="contained"
                          startIcon={step.action.icon}
                          onClick={step.action.onClick}
                          sx={{ mt: 1 }}
                        >
                          {step.action.label}
                        </Button>
                      )}
                    </StepContent>
                  </Step>
                ))}
              </Stepper>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Your Progress
              </Typography>
              
              <List dense>
                <ListItem>
                  <ListItemIcon>
                    <Assignment />
                  </ListItemIcon>
                  <ListItemText 
                    primary="Documents Processed" 
                    secondary={userProfile?.stats?.totalDocuments || 0}
                  />
                </ListItem>
                <ListItem>
                  <ListItemIcon>
                    <CheckCircle />
                  </ListItemIcon>
                  <ListItemText 
                    primary="Successful Extractions" 
                    secondary={userProfile?.stats?.completedDocuments || 0}
                  />
                </ListItem>
                <ListItem>
                  <ListItemIcon>
                    <TrendingUp />
                  </ListItemIcon>
                  <ListItemText 
                    primary="Member Since" 
                    secondary={new Date(userProfile?.createdAt || new Date()).toLocaleDateString()}
                  />
                </ListItem>
              </List>
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Quick Actions
              </Typography>
              
              {quickActions.map((action, index) => (
                <Box key={index}>
                  <Box 
                    sx={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      p: 2, 
                      borderRadius: 1,
                      cursor: 'pointer',
                      '&:hover': { bgcolor: 'grey.50' },
                      transition: 'background-color 0.2s'
                    }}
                    onClick={action.action}
                  >
                    <Box sx={{ 
                      p: 1, 
                      borderRadius: 1, 
                      bgcolor: action.color, 
                      color: 'white',
                      mr: 2
                    }}>
                      {action.icon}
                    </Box>
                    <Box sx={{ flexGrow: 1 }}>
                      <Typography variant="subtitle2">
                        {action.title}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {action.description}
                      </Typography>
                    </Box>
                  </Box>
                  {index < quickActions.length - 1 && <Divider />}
                </Box>
              ))}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Paper sx={{ p: 4, mt: 4 }}>
        <Typography variant="h5" gutterBottom>
          What You Will Get
        </Typography>
        <Typography variant="body1" color="text.secondary" paragraph>
          Our document processing system provides powerful automation capabilities:
        </Typography>
        
        <Grid container spacing={2}>
          {benefits.map((benefit, index) => (
            <Grid item xs={12} sm={6} md={4} key={index}>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <CheckCircle sx={{ color: 'success.main', mr: 1, fontSize: 20 }} />
                <Typography variant="body2">
                  {benefit}
                </Typography>
              </Box>
            </Grid>
          ))}
        </Grid>
      </Paper>

      {!onboardingProgress?.onboardingComplete && (
        <Paper sx={{ p: 4, mt: 4, bgcolor: 'primary.light' }}>
          <Typography variant="h6" gutterBottom sx={{ color: 'primary.contrastText' }}>
            Ready to Get Started?
          </Typography>
          <Typography variant="body1" sx={{ color: 'primary.contrastText', mb: 3 }}>
            {onboardingProgress?.documentsProcessed === 0 
              ? "Upload your first document or try a sample invoice to see the system in action."
              : "Great job! Continue exploring the features to complete your onboarding."
            }
          </Typography>
          
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            {onboardingProgress?.documentsProcessed === 0 ? (
              <>
                <Button
                  variant="contained"
                  startIcon={<PlayArrow />}
                  onClick={handleNavigateToSamples}
                  sx={{ bgcolor: 'white', color: 'primary.main', '&:hover': { bgcolor: 'grey.100' } }}
                >
                  Try Sample Invoice
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<UploadFile />}
                  onClick={handleNavigateToDocuments}
                  sx={{ borderColor: 'white', color: 'white', '&:hover': { borderColor: 'white', bgcolor: 'rgba(255,255,255,0.1)' } }}
                >
                  Upload Document
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="contained"
                  startIcon={<Analytics />}
                  onClick={handleNavigateToDocuments}
                  sx={{ bgcolor: 'white', color: 'primary.main', '&:hover': { bgcolor: 'grey.100' } }}
                >
                  View Analytics
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<GetApp />}
                  onClick={handleOpenApiDocs}
                  sx={{ borderColor: 'white', color: 'white', '&:hover': { borderColor: 'white', bgcolor: 'rgba(255,255,255,0.1)' } }}
                >
                  API Documentation
                </Button>
              </>
            )}
          </Box>
        </Paper>
      )}

      {onboardingProgress?.onboardingComplete && (
        <Paper sx={{ p: 4, mt: 4, textAlign: 'center', bgcolor: 'success.light' }}>
          <CheckCircle sx={{ fontSize: 60, color: 'success.main', mb: 2 }} />
          <Typography variant="h5" gutterBottom sx={{ color: 'success.contrastText' }}>
            You are All Set!
          </Typography>
          <Typography variant="body1" sx={{ color: 'success.contrastText', mb: 3 }}>
            Your document processing system is fully configured and ready for production use.
          </Typography>
          
          <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Button
              variant="contained"
              startIcon={<UploadFile />}
              onClick={handleNavigateToDocuments}
              sx={{ bgcolor: 'white', color: 'success.main' }}
            >
              Process More Documents
            </Button>
            <Button
              variant="outlined"
              startIcon={<TrendingUp />}
              onClick={handleNavigateToDashboard}
              sx={{ borderColor: 'white', color: 'white' }}
            >
              View Dashboard
            </Button>
          </Box>
        </Paper>
      )}
    </Container>
  );
};

export default OnboardingProgress;