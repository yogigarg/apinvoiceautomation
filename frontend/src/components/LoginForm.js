// frontend/src/components/LoginForm.js
import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
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
    Divider,
    Card,
    CardContent,
    CircularProgress
} from '@mui/material';
import {
    Visibility,
    VisibilityOff,
    Email,
    Lock,
    Login as LoginIcon,
    Person
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';

const LoginForm = () => {
    const [formData, setFormData] = useState({
        email: '',
        password: ''
    });
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const { login, user, loading: authLoading } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    // Get the intended destination or default to dashboard
    const from = location.state?.from?.pathname || '/dashboard';

    // Redirect if already logged in
    useEffect(() => {
        if (user && !authLoading) {
            navigate(from, { replace: true });
        }
    }, [user, authLoading, navigate, from]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
        // Clear error when user starts typing
        if (error) setError('');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        // Basic validation
        if (!formData.email || !formData.password) {
            setError('Please fill in all fields');
            setLoading(false);
            return;
        }

        if (!formData.email.includes('@')) {
            setError('Please enter a valid email address');
            setLoading(false);
            return;
        }

        try {
            console.log('Attempting login with:', { email: formData.email }); // Debug log

            const result = await login(formData.email, formData.password);

            if (result.success) {
                console.log('Login successful, redirecting to:', from); // Debug log
                navigate(from, { replace: true });
            } else {
                setError(result.error || 'Login failed. Please check your credentials.');
            }
        } catch (err) {
            console.error('Login error:', err);
            setError('An unexpected error occurred. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleForgotPassword = () => {
        // You can implement forgot password later
        alert('Forgot password functionality coming soon!');
    };

    // Show loading spinner while checking authentication
    if (authLoading) {
        return (
            <Box
                display="flex"
                justifyContent="center"
                alignItems="center"
                minHeight="100vh"
            >
                <CircularProgress size={60} />
            </Box>
        );
    }

    return (
        <Container component="main" maxWidth="sm">
            <Box
                sx={{
                    marginTop: 8,
                    marginBottom: 8,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                }}
            >
                {/* Header */}
                <Paper elevation={3} sx={{ padding: 4, width: '100%', borderRadius: 2 }}>
                    <Box sx={{ textAlign: 'center', mb: 3 }}>
                        <LoginIcon sx={{ fontSize: 60, color: 'primary.main', mb: 2 }} />
                        <Typography component="h1" variant="h4" color="primary" fontWeight="bold">
                            Welcome Back
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                            Sign in to your account to continue
                        </Typography>
                    </Box>

                    {/* Error Alert */}
                    {error && (
                        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>
                            {error}
                        </Alert>
                    )}

                    {/* Login Form */}
                    <Box component="form" onSubmit={handleSubmit} sx={{ mt: 1 }}>
                        <TextField
                            margin="normal"
                            required
                            fullWidth
                            id="email"
                            label="Email Address"
                            name="email"
                            autoComplete="email"
                            autoFocus
                            value={formData.email}
                            onChange={handleChange}
                            disabled={loading}
                            InputProps={{
                                startAdornment: (
                                    <InputAdornment position="start">
                                        <Email color="action" />
                                    </InputAdornment>
                                ),
                            }}
                            sx={{ mb: 2 }}
                        />

                        <TextField
                            margin="normal"
                            required
                            fullWidth
                            name="password"
                            label="Password"
                            type={showPassword ? 'text' : 'password'}
                            id="password"
                            autoComplete="current-password"
                            value={formData.password}
                            onChange={handleChange}
                            disabled={loading}
                            InputProps={{
                                startAdornment: (
                                    <InputAdornment position="start">
                                        <Lock color="action" />
                                    </InputAdornment>
                                ),
                                endAdornment: (
                                    <InputAdornment position="end">
                                        <IconButton
                                            aria-label="toggle password visibility"
                                            onClick={() => setShowPassword(!showPassword)}
                                            edge="end"
                                            disabled={loading}
                                        >
                                            {showPassword ? <VisibilityOff /> : <Visibility />}
                                        </IconButton>
                                    </InputAdornment>
                                ),
                            }}
                            sx={{ mb: 1 }}
                        />

                        {/* Forgot Password Link */}
                        <Box sx={{ textAlign: 'right', mb: 3 }}>
                            <Button
                                variant="text"
                                size="small"
                                onClick={handleForgotPassword}
                                disabled={loading}
                                sx={{ textTransform: 'none' }}
                            >
                                Forgot password?
                            </Button>
                        </Box>

                        {/* Submit Button */}
                        <Button
                            type="submit"
                            fullWidth
                            variant="contained"
                            disabled={loading}
                            sx={{
                                mt: 2,
                                mb: 3,
                                py: 1.5,
                                fontSize: '1.1rem',
                                fontWeight: 'bold'
                            }}
                            startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <LoginIcon />}
                        >
                            {loading ? 'Signing In...' : 'Sign In'}
                        </Button>

                        <Divider sx={{ my: 3 }}>
                            <Typography variant="body2" color="text.secondary">
                                Don't have an account?
                            </Typography>
                        </Divider>

                        {/* Registration Link */}
                        <Button
                            fullWidth
                            variant="outlined"
                            onClick={() => navigate('/register')}
                            disabled={loading}
                            startIcon={<Person />}
                            sx={{
                                py: 1.5,
                                textTransform: 'none',
                                fontSize: '1rem'
                            }}
                        >
                            Create New Account
                        </Button>
                    </Box>
                </Paper>

                {/* Demo Credentials Card */}
                <Card sx={{ mt: 3, width: '100%' }} variant="outlined">
                    <CardContent>
                        <Typography variant="h6" gutterBottom color="info.main">
                            Demo Credentials
                        </Typography>
                        <Typography variant="body2" color="text.secondary" paragraph>
                            Use these credentials to test the login:
                        </Typography>
                        <Box sx={{ bgcolor: 'grey.50', p: 2, borderRadius: 1, fontFamily: 'monospace' }}>
                            <Typography variant="body2">
                                <strong>Email:</strong> admin@test.com<br />
                                <strong>Password:</strong> testpass123
                            </Typography>
                        </Box>
                        <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                            * For development/testing purposes only
                        </Typography>
                    </CardContent>
                </Card>
            </Box>
        </Container>
    );
};

export default LoginForm;