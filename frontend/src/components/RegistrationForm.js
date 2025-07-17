// src/components/RegistrationForm.js - Registration form component
import React, { useState } from 'react';
import {
  Container,
  Paper,
  TextField,
  Button,
  Typography,
  Box,
  Alert,
  FormControlLabel,
  Checkbox,
  Grid,
  LinearProgress,
  Chip,
  Link,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const RegistrationForm = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    firstName: '',
    lastName: '',
    phone: '',
    companyName: '',
    companyDomain: '',
    termsAccepted: false,
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [passwordStrength, setPasswordStrength] = useState(null);

  const handleChange = async (e) => {
    const { name, value, checked } = e.target;
    const newValue = e.target.type === 'checkbox' ? checked : value;
    
    setFormData(prev => ({
      ...prev,
      [name]: newValue
    }));

    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }

    // Check password strength in real-time
    if (name === 'password' && value) {
      try {
        const response = await axios.post('/check-password-strength', { password: value });
        setPasswordStrength(response.data);
      } catch (error) {
        console.error('Password strength check failed:', error);
      }
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.email) newErrors.email = 'Email is required';
    if (!formData.password) newErrors.password = 'Password is required';
    if (!formData.firstName) newErrors.firstName = 'First name is required';
    if (!formData.lastName) newErrors.lastName = 'Last name is required';
    if (!formData.companyName) newErrors.companyName = 'Company name is required';
    if (!formData.termsAccepted) newErrors.termsAccepted = 'You must accept the terms and conditions';

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (formData.email && !emailRegex.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    // Password validation
    if (passwordStrength && !passwordStrength.isValid) {
      newErrors.password = 'Password does not meet security requirements';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    setLoading(true);
    setMessage('');

    try {
      const response = await axios.post('/register', formData);
      setMessage(response.data.message);
      
      // Show verification URL for localhost
      if (response.data.verificationUrl) {
        setMessage(prev => prev + ` Verification URL: ${response.data.verificationUrl}`);
      }
      
      console.log('Registration successful! Check the backend console for verification link.');
    } catch (error) {
      setMessage(error.response?.data?.error || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const getPasswordRequirements = () => {
    if (!passwordStrength) return null;

    const requirements = [
      { key: 'minLength', label: 'At least 8 characters', met: passwordStrength.requirements.minLength },
      { key: 'hasUpperCase', label: 'One uppercase letter', met: passwordStrength.requirements.hasUpperCase },
      { key: 'hasLowerCase', label: 'One lowercase letter', met: passwordStrength.requirements.hasLowerCase },
      { key: 'hasNumbers', label: 'One number', met: passwordStrength.requirements.hasNumbers },
      { key: 'hasSpecialChar', label: 'One special character', met: passwordStrength.requirements.hasSpecialChar },
    ];

    return requirements.map(req => (
      <Chip
        key={req.key}
        label={req.label}
        color={req.met ? 'success' : 'default'}
        variant={req.met ? 'filled' : 'outlined'}
        size="small"
        style={{ margin: '2px' }}
      />
    ));
  };

  return (
    <Container maxWidth="md" style={{ marginTop: '2rem' }}>
      <Paper elevation={3} style={{ padding: '2rem' }}>
        <Typography variant="h4" component="h1" gutterBottom align="center">
          Create Your Account
        </Typography>
        <Typography variant="body1" align="center" color="textSecondary" paragraph>
          Start your 30-day free trial today (Localhost Version)
        </Typography>

        {message && (
          <Alert 
            severity={message.includes('successful') ? 'success' : 'error'} 
            style={{ marginBottom: '1rem' }}
          >
            {message}
          </Alert>
        )}

        <form onSubmit={handleSubmit}>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="First Name"
                name="firstName"
                value={formData.firstName}
                onChange={handleChange}
                error={!!errors.firstName}
                helperText={errors.firstName}
                required
                autoComplete="given-name"
              />
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Last Name"
                name="lastName"
                value={formData.lastName}
                onChange={handleChange}
                error={!!errors.lastName}
                helperText={errors.lastName}
                required
                autoComplete="family-name"
              />
            </Grid>
            
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Email Address"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleChange}
                error={!!errors.email}
                helperText={errors.email}
                required
                autoComplete="email"
              />
            </Grid>
            
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Phone Number"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                error={!!errors.phone}
                helperText={errors.phone}
                autoComplete="tel"
              />
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Company Name"
                name="companyName"
                value={formData.companyName}
                onChange={handleChange}
                error={!!errors.companyName}
                helperText={errors.companyName}
                required
                autoComplete="organization"
              />
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Company Domain (Optional)"
                name="companyDomain"
                value={formData.companyDomain}
                onChange={handleChange}
                error={!!errors.companyDomain}
                helperText={errors.companyDomain || 'e.g., company.com'}
                placeholder="company.com"
              />
            </Grid>
            
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Password"
                name="password"
                type="password"
                value={formData.password}
                onChange={handleChange}
                error={!!errors.password}
                helperText={errors.password}
                required
                autoComplete="new-password"
              />
              {passwordStrength && (
                <Box mt={1}>
                  <Typography variant="caption" color="textSecondary">
                    Password Requirements:
                  </Typography>
                  <Box mt={1}>
                    {getPasswordRequirements()}
                  </Box>
                </Box>
              )}
            </Grid>
            
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Checkbox
                    name="termsAccepted"
                    checked={formData.termsAccepted}
                    onChange={handleChange}
                    color="primary"
                  />
                }
                label={
                  <Typography variant="body2">
                    I accept the{' '}
                    <Link href="#" onClick={(e) => e.preventDefault()}>
                      Terms and Conditions
                    </Link>{' '}
                    and{' '}
                    <Link href="#" onClick={(e) => e.preventDefault()}>
                      Privacy Policy
                    </Link>{' '}
                    (Localhost Demo)
                  </Typography>
                }
              />
              {errors.termsAccepted && (
                <Typography variant="caption" color="error" display="block">
                  {errors.termsAccepted}
                </Typography>
              )}
            </Grid>
          </Grid>

          <Box mt={3}>
            <Button
              type="submit"
              fullWidth
              variant="contained"
              color="primary"
              disabled={loading}
              size="large"
            >
              {loading ? 'Creating Account...' : 'Create Account'}
            </Button>
            {loading && <LinearProgress style={{ marginTop: '1rem' }} />}
          </Box>
        </form>

        <Box mt={2} textAlign="center">
          <Typography variant="body2">
            Already have an account?{' '}
            <Button color="primary" onClick={() => navigate('/login')}>
              Sign in
            </Button>
          </Typography>
        </Box>
      </Paper>
    </Container>
  );
};

export default RegistrationForm;