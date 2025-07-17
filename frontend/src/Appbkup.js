// src/App.js - Enhanced with Document Processing Routes
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { CssBaseline, Box, Typography, Button } from '@mui/material';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { useNavigate } from 'react-router-dom';

// Context
import { AuthProvider } from './contexts/AuthContext';

// Components
import LoginForm from './components/LoginForm';
import RegistrationForm from './components/RegistrationForm';
import EmailVerification from './components/EmailVerification';
import AcceptInvitation from './components/AcceptInvitation';
import Dashboard from './components/Dashboard';
import ProtectedRoute from './components/ProtectedRoute';
import UserList from './components/UserManagement/UserList';

// New Document Processing Components
import DocumentList from './components/DocumentProcessing/DocumentList';
import SampleInvoices from './components/DocumentProcessing/SampleInvoices';
import OnboardingProgress from './components/DocumentProcessing/OnboardingProgress';

// Error Boundary Component
import ErrorBoundary from './components/ErrorBoundary';

// Create theme
const theme = createTheme({
  palette: {
    primary: {
      main: '#1976d2',
    },
    secondary: {
      main: '#dc004e',
    },
    background: {
      default: '#f5f5f5',
    },
  },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
    h4: {
      fontWeight: 600,
    },
    h5: {
      fontWeight: 600,
    },
    h6: {
      fontWeight: 600,
    },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          borderRadius: 8,
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 12,
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          borderRadius: 12,
        },
      },
    },
  },
});

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
  },
});

// Unauthorized Component
const Unauthorized = () => (
  <Box
    display="flex"
    flexDirection="column"
    alignItems="center"
    justifyContent="center"
    minHeight="100vh"
    textAlign="center"
    p={3}
  >
    <Typography variant="h4" gutterBottom color="error">
      403 - Unauthorized
    </Typography>
    <Typography variant="body1" color="text.secondary" paragraph>
      You don't have permission to access this resource.
    </Typography>
    <Button
      variant="contained"
      onClick={() => window.history.back()}
      sx={{ mt: 2 }}
    >
      Go Back
    </Button>
  </Box>
);

// Not Found Component
const NotFound = () => {
  const navigate = useNavigate();
  
  return (
    <Box
      display="flex"
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
      minHeight="100vh"
      textAlign="center"
      p={3}
    >
      <Typography variant="h4" gutterBottom color="error">
        404 - Page Not Found
      </Typography>
      <Typography variant="body1" color="text.secondary" paragraph>
        The page you're looking for doesn't exist.
      </Typography>
      <Button
        variant="contained"
        onClick={() => navigate('/dashboard')}
        sx={{ mt: 2 }}
      >
        Go to Dashboard
      </Button>
    </Box>
  );
};

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <ErrorBoundary>
          <AuthProvider>
            <Router>
              <Routes>
                {/* Public Routes */}
                <Route path="/login" element={<LoginForm />} />
                <Route path="/register" element={<RegistrationForm />} />
                <Route path="/verify-email" element={<EmailVerification />} />
                <Route path="/accept-invitation" element={<AcceptInvitation />} />
                
                {/* Protected Routes */}
                <Route 
                  path="/dashboard" 
                  element={
                    <ProtectedRoute>
                      <Dashboard />
                    </ProtectedRoute>
                  } 
                />
                
                {/* User Management Routes */}
                <Route 
                  path="/users" 
                  element={
                    <ProtectedRoute requiredPermission="user.read">
                      <UserList />
                    </ProtectedRoute>
                  } 
                />
                
                {/* Document Processing Routes */}
                <Route 
                  path="/documents" 
                  element={
                    <ProtectedRoute>
                      <DocumentList />
                    </ProtectedRoute>
                  } 
                />
                
                <Route 
                  path="/documents/samples" 
                  element={
                    <ProtectedRoute>
                      <SampleInvoices />
                    </ProtectedRoute>
                  } 
                />
                
                <Route 
                  path="/onboarding" 
                  element={
                    <ProtectedRoute>
                      <OnboardingProgress />
                    </ProtectedRoute>
                  } 
                />
                
                {/* Business Entities Route (placeholder) */}
                <Route 
                  path="/business-entities" 
                  element={
                    <ProtectedRoute requiredPermission="business_entity.read">
                      <div style={{ padding: '2rem', textAlign: 'center' }}>
                        <Typography variant="h4" gutterBottom>
                          Business Entities
                        </Typography>
                        <Typography variant="body1" color="text.secondary">
                          Business entities management coming soon...
                        </Typography>
                      </div>
                    </ProtectedRoute>
                  } 
                />
                
                {/* Audit Logs Route (placeholder) */}
                <Route 
                  path="/audit-logs" 
                  element={
                    <ProtectedRoute requiredPermission="audit.read">
                      <div style={{ padding: '2rem', textAlign: 'center' }}>
                        <Typography variant="h4" gutterBottom>
                          Audit Logs
                        </Typography>
                        <Typography variant="body1" color="text.secondary">
                          Audit logs viewer coming soon...
                        </Typography>
                      </div>
                    </ProtectedRoute>
                  } 
                />
                
                {/* Error Routes */}
                <Route path="/unauthorized" element={<Unauthorized />} />
                <Route path="/404" element={<NotFound />} />
                
                {/* Default redirect */}
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                
                {/* Catch all route */}
                <Route path="*" element={<Navigate to="/404" replace />} />
              </Routes>
            </Router>
          </AuthProvider>
        </ErrorBoundary>
        
        {/* React Query Devtools (only in development) */}
        <ReactQueryDevtools 
          initialIsOpen={false} 
          position="bottom-right"
        />
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;