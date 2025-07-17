// src/components/EmailVerification.js - Email verification component
import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  Container,
  Paper,
  Typography,
  Box,
  Alert,
  Button,
  CircularProgress,
  Stepper,
  Step,
  StepLabel,
} from '@mui/material';
import { CheckCircle, Error, Email } from '@mui/icons-material';
import axios from 'axios';

const EmailVerification = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState('verifying'); // 'verifying', 'success', 'error'
  const [message, setMessage] = useState('');
  const [countdown, setCountdown] = useState(3);

  const steps = ['Email Sent', 'Click Link', 'Verification Complete'];
  const activeStep = status === 'success' ? 2 : status === 'error' ? 1 : 1;

  useEffect(() => {
    const token = searchParams.get('token');
    
    if (!token) {
      setStatus('error');
      setMessage('Invalid verification link. Please check your email for the correct link or contact support.');
      return;
    }

    const verifyEmail = async () => {
      try {
        const response = await axios.post('/verify-email', { token });
        setStatus('success');
        setMessage(response.data.message);
        
        // Start countdown timer
        const timer = setInterval(() => {
          setCountdown(prev => {
            if (prev <= 1) {
              clearInterval(timer);
              navigate('/login');
              return 0;
            }
            return prev - 1;
          });
        }, 1000);

        return () => clearInterval(timer);
      } catch (error) {
        setStatus('error');
        setMessage(error.response?.data?.error || 'Email verification failed. Please try again or contact support.');
      }
    };

    // Add a small delay to show the verification process
    const delayedVerify = setTimeout(() => {
      verifyEmail();
    }, 1500);

    return () => clearTimeout(delayedVerify);
  }, [searchParams, navigate]);

  const getStatusIcon = () => {
    switch (status) {
      case 'verifying':
        return <CircularProgress size={60} color="primary" />;
      case 'success':
        return <CheckCircle sx={{ fontSize: 60, color: 'success.main' }} />;
      case 'error':
        return <Error sx={{ fontSize: 60, color: 'error.main' }} />;
      default:
        return <Email sx={{ fontSize: 60, color: 'primary.main' }} />;
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'success':
        return 'success';
      case 'error':
        return 'error';
      default:
        return 'info';
    }
  };

  return (
    <Container maxWidth="sm" style={{ marginTop: '4rem' }}>
      <Paper elevation={3} style={{ padding: '2rem', textAlign: 'center' }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Email Verification
        </Typography>

        {/* Progress Stepper */}
        <Box mb={4}>
          <Stepper activeStep={activeStep} alternativeLabel>
            {steps.map((label) => (
              <Step key={label}>
                <StepLabel>{label}</StepLabel>
              </Step>
            ))}
          </Stepper>
        </Box>

        {/* Status Icon */}
        <Box mb={3}>
          {getStatusIcon()}
        </Box>

        {/* Verification States */}
        {status === 'verifying' && (
          <Box>
            <Typography variant="h6" gutterBottom>
              Verifying your email address...
            </Typography>
            <Typography variant="body2" color="textSecondary">
              Please wait while we verify your account.
            </Typography>
          </Box>
        )}

        {status === 'success' && (
          <Box>
            <Alert severity="success" style={{ marginBottom: '2rem', textAlign: 'left' }}>
              {message}
            </Alert>
            
            <Typography variant="h6" gutterBottom color="success.main">
              🎉 Email Verified Successfully!
            </Typography>
            
            <Typography variant="body1" paragraph>
              Your account is now active and ready to use. You'll be redirected to the login page in {countdown} seconds.
            </Typography>
            
            <Box mt={3}>
              <Button
                variant="contained"
                color="primary"
                size="large"
                onClick={() => navigate('/login')}
                style={{ marginRight: '1rem' }}
              >
                Go to Login
              </Button>
              <Button
                variant="outlined"
                color="primary"
                onClick={() => navigate('/dashboard')}
              >
                Go to Dashboard
              </Button>
            </Box>
          </Box>
        )}

        {status === 'error' && (
          <Box>
            <Alert severity="error" style={{ marginBottom: '2rem', textAlign: 'left' }}>
              {message}
            </Alert>
            
            <Typography variant="h6" gutterBottom color="error.main">
              Verification Failed
            </Typography>
            
            <Typography variant="body1" paragraph>
              The verification link may have expired or is invalid. Here are some options:
            </Typography>
            
            <Box mt={3}>
              <Button
                variant="contained"
                color="primary"
                onClick={() => navigate('/login')}
                style={{ marginRight: '1rem', marginBottom: '1rem' }}
              >
                Try Login
              </Button>
              <Button
                variant="outlined"
                color="primary"
                onClick={() => navigate('/register')}
                style={{ marginBottom: '1rem' }}
              >
                Register Again
              </Button>
            </Box>
            
            {/* Localhost helper */}
            <Box mt={2} p={2} bgcolor="grey.100" borderRadius={1}>
              <Typography variant="caption" color="textSecondary" display="block" mb={1}>
                🔧 Localhost Development: If you're testing, try using the "Manually Verify Email" button on the login page.
              </Typography>
            </Box>
          </Box>
        )}

        {/* Additional Information */}
        <Box mt={4} p={2} bgcolor="info.light" borderRadius={1}>
          <Typography variant="caption" color="info.contrastText">
            💡 Development Mode: In localhost, verification links are also printed to the backend console for easy testing.
          </Typography>
        </Box>
      </Paper>
    </Container>
  );
};

export default EmailVerification;