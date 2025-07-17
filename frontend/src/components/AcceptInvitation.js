// frontend/src/components/AcceptInvitation.js
import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Paper,
  TextField,
  Button,
  Typography,
  Alert,
  Container,
  InputAdornment,
  IconButton,
  LinearProgress,
  Link
} from '@mui/material';
import { 
  Visibility, 
  VisibilityOff, 
  Lock, 
  CheckCircle,
  Error as ErrorIcon 
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';

const AcceptInvitation = () => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState(0);
  
  const [searchParams] = useSearchParams();
  const { acceptInvitation, user } = useAuth();
  const navigate = useNavigate();
  
  const token = searchParams.get('token');

  useEffect(() => {
    // If user is already logged in, redirect to dashboard
    if (user) {
      navigate('/dashboard');
      return;
    }

    if (!token) {
      setError('Invalid invitation link. Please check your email for the correct link.');
    }
  }, [token, user, navigate]);

  // Password strength checker
  useEffect(() => {
    const calculateStrength = (pwd) => {
      let strength = 0;
      if (pwd.length >= 8) strength += 25;
      if (/[a-z]/.test(pwd)) strength += 25;
      if (/[A-Z]/.test(pwd)) strength += 25;
      if (/[0-9]/.test(pwd)) strength += 25;
      return strength;
    };

    setPasswordStrength(calculateStrength(password));
  }, [password]);

  const getPasswordStrengthColor = () => {
    if (passwordStrength <= 25) return 'error';
    if (passwordStrength <= 50) return 'warning';
    if (passwordStrength <= 75) return 'info';
    return 'success';
  };

  const getPasswordStrengthText = () => {
    if (passwordStrength <= 25) return 'Weak';
    if (passwordStrength <= 50) return 'Fair';
    if (passwordStrength <= 75) return 'Good';
    return 'Strong';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Validation
    if (!password) {
      setError('Password is required');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (passwordStrength < 50) {
      setError('Please choose a stronger password');
      return;
    }

    setLoading(true);

    const result = await acceptInvitation(token, password);
    
    if (result.success) {
      navigate('/dashboard');
    } else {
      setError(result.error);
    }
    
    setLoading(false);
  };

  if (!token) {
    return (
      <Container component="main" maxWidth="xs">
        <Box
          sx={{
            marginTop: 8,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
          }}
        >
          <Paper elevation={3} sx={{ padding: 4, width: '100%', textAlign: 'center' }}>
            <ErrorIcon sx={{ fontSize: 60, color: 'error.main', mb: 2 }} />
            <Typography variant="h5" gutterBottom>
              Invalid Invitation
            </Typography>
            <Typography variant="body1" color="text.secondary" paragraph>
              This invitation link is invalid or has expired. Please check your email for the correct link or contact an administrator.
            </Typography>
            <Button 
              variant="outlined" 
              onClick={() => navigate('/login')}
              sx={{ mt: 2 }}
            >
              Go to Login
            </Button>
          </Paper>
        </Box>
      </Container>
    );
  }

  return (
    <Container component="main" maxWidth="xs">
      <Box
        sx={{
          marginTop: 8,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        <Paper elevation={3} sx={{ padding: 4, width: '100%' }}>
          <Box sx={{ textAlign: 'center', mb: 3 }}>
            <CheckCircle sx={{ fontSize: 60, color: 'success.main', mb: 2 }} />
            <Typography component="h1" variant="h4" color="primary" fontWeight="bold">
              Welcome!
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              You've been invited to join our platform. Set up your password to complete your account setup.
            </Typography>
          </Box>

          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          <Box component="form" onSubmit={handleSubmit}>
            <TextField
              margin="normal"
              required
              fullWidth
              name="password"
              label="Password"
              type={showPassword ? 'text' : 'password'}
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              helperText="Must be at least 8 characters long"
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Lock />
                  </InputAdornment>
                ),
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      aria-label="toggle password visibility"
                      onClick={() => setShowPassword(!showPassword)}
                      edge="end"
                    >
                      {showPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />

            {/* Password Strength Indicator */}
            {password && (
              <Box sx={{ mt: 1, mb: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                  <Typography variant="caption" color="text.secondary">
                    Password Strength:
                  </Typography>
                  <Typography variant="caption" color={`${getPasswordStrengthColor()}.main`}>
                    {getPasswordStrengthText()}
                  </Typography>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={passwordStrength}
                  color={getPasswordStrengthColor()}
                  sx={{ height: 4, borderRadius: 2 }}
                />
              </Box>
            )}

            <TextField
              margin="normal"
              required
              fullWidth
              name="confirmPassword"
              label="Confirm Password"
              type={showConfirmPassword ? 'text' : 'password'}
              id="confirmPassword"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              error={confirmPassword && password !== confirmPassword}
              helperText={
                confirmPassword && password !== confirmPassword 
                  ? 'Passwords do not match' 
                  : 'Re-enter your password'
              }
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Lock />
                  </InputAdornment>
                ),
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      aria-label="toggle confirm password visibility"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      edge="end"
                    >
                      {showConfirmPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />

            <Button
              type="submit"
              fullWidth
              variant="contained"
              disabled={loading || !token || passwordStrength < 50}
              sx={{ mt: 3, mb: 2 }}
            >
              {loading ? 'Setting up your account...' : 'Complete Account Setup'}
            </Button>

            <Box sx={{ textAlign: 'center', mt: 2 }}>
              <Typography variant="body2" color="text.secondary">
                Already have an account?{' '}
                <Link 
                  component="button"
                  type="button"
                  onClick={() => navigate('/login')}
                  underline="hover"
                >
                  Sign in
                </Link>
              </Typography>
            </Box>
          </Box>
        </Paper>
      </Box>
    </Container>
  );
};

export default AcceptInvitation;