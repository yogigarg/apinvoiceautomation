// src/components/ErrorBoundary.js - Enhanced with vendor object error detection
import React from 'react';
import {
    Box,
    Typography,
    Button,
    Paper,
    Container,
    Alert,
    Accordion,
    AccordionSummary,
    AccordionDetails
} from '@mui/material';
import {
    Error as ErrorIcon,
    Refresh,
    Home,
    ExpandMore,
    BugReport,
    Warning
} from '@mui/icons-material';

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true };
    }

    componentDidCatch(error, errorInfo) {
        this.setState({
            error: error,
            errorInfo: errorInfo
        });

        // Enhanced logging for vendor object errors
        console.error('ErrorBoundary caught an error:', error, errorInfo);

        // Check if this is the vendor object rendering error
        if (error.message && error.message.includes('Objects are not valid as a React child')) {
            console.error('🚨 VENDOR OBJECT ERROR DETECTED!');
            console.error('📍 Error location:', errorInfo.componentStack);
            console.error('💡 This is likely caused by trying to render a vendor object directly in JSX');
            console.error('🔧 Solution: Replace {vendor} with {vendor.name} or use safe extraction');
        }

        // In production, you would send this to your error reporting service
        // e.g., Sentry, LogRocket, etc.
    }

    handleReload = () => {
        window.location.reload();
    };

    handleGoHome = () => {
        window.location.href = '/dashboard';
    };

    isVendorObjectError = () => {
        return this.state.error?.message?.includes('Objects are not valid as a React child') &&
            this.state.error?.message?.includes('name, address, phone, email');
    };

    render() {
        if (this.state.hasError) {
            const isVendorError = this.isVendorObjectError();

            return (
                <Container maxWidth="md" sx={{ py: 8 }}>
                    <Paper sx={{ p: 4, textAlign: 'center' }}>
                        <ErrorIcon sx={{ fontSize: 80, color: 'error.main', mb: 3 }} />

                        <Typography variant="h4" gutterBottom color="error.main">
                            {isVendorError ? 'Vendor Data Rendering Error' : 'Oops! Something went wrong'}
                        </Typography>

                        {isVendorError ? (
                            <Alert severity="warning" sx={{ mb: 3, textAlign: 'left' }}>
                                <Typography variant="subtitle2" gutterBottom>
                                    <Warning sx={{ mr: 1, verticalAlign: 'middle' }} />
                                    Vendor Object Rendering Issue Detected
                                </Typography>
                                <Typography variant="body2" component="div">
                                    This error occurs when trying to display vendor information directly.<br />
                                    <strong>Quick Fix:</strong> The vendor data structure has changed from a simple string to an object.<br />
                                    <strong>Technical Details:</strong> Replace <code>{`{vendor}`}</code> with <code>{`{vendor.name}`}</code> in your components.
                                </Typography>
                            </Alert>
                        ) : (
                            <Typography variant="body1" color="text.secondary" paragraph>
                                We're sorry, but something unexpected happened. Our team has been notified and is working to fix this issue.
                            </Typography>
                        )}

                        <Alert severity="info" sx={{ mb: 3, textAlign: 'left' }}>
                            <Typography variant="subtitle2" gutterBottom>
                                What you can do:
                            </Typography>
                            <Typography variant="body2" component="div">
                                • Try refreshing the page<br />
                                • Go back to the dashboard<br />
                                {isVendorError && '• Apply the vendor object fix to your components<br/>'}
                                • If the problem persists, contact support
                            </Typography>
                        </Alert>

                        <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', mb: 4 }}>
                            <Button
                                variant="contained"
                                startIcon={<Refresh />}
                                onClick={this.handleReload}
                                size="large"
                            >
                                Reload Page
                            </Button>
                            <Button
                                variant="outlined"
                                startIcon={<Home />}
                                onClick={this.handleGoHome}
                                size="large"
                            >
                                Go to Dashboard
                            </Button>
                        </Box>

                        {/* Enhanced Error Details for Development */}
                        {process.env.NODE_ENV === 'development' && this.state.error && (
                            <Accordion sx={{ textAlign: 'left', mt: 3 }}>
                                <AccordionSummary expandIcon={<ExpandMore />}>
                                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                        <BugReport sx={{ mr: 1 }} />
                                        <Typography>
                                            {isVendorError ? 'Vendor Object Error Details' : 'Error Details'} (Development Only)
                                        </Typography>
                                    </Box>
                                </AccordionSummary>
                                <AccordionDetails>
                                    {isVendorError && (
                                        <Alert severity="error" sx={{ mb: 2 }}>
                                            <Typography variant="subtitle2" gutterBottom>
                                                🔧 Quick Fix Instructions:
                                            </Typography>
                                            <Typography variant="body2" component="div">
                                                1. Find the component mentioned in the stack trace below<br />
                                                2. Look for <code>{`{invoiceData?.vendor}`}</code> or similar<br />
                                                3. Replace with <code>{`{invoiceData?.vendor?.name || invoiceData?.vendor || 'N/A'}`}</code><br />
                                                4. Or use the safe extraction utility functions provided
                                            </Typography>
                                        </Alert>
                                    )}

                                    <Typography variant="subtitle2" gutterBottom>
                                        Error Message:
                                    </Typography>
                                    <Typography
                                        variant="body2"
                                        sx={{
                                            fontFamily: 'monospace',
                                            bgcolor: isVendorError ? 'error.light' : 'grey.100',
                                            color: isVendorError ? 'error.contrastText' : 'text.primary',
                                            p: 1,
                                            borderRadius: 1,
                                            mb: 2,
                                            wordBreak: 'break-all'
                                        }}
                                    >
                                        {this.state.error.toString()}
                                    </Typography>

                                    <Typography variant="subtitle2" gutterBottom>
                                        Component Stack Trace:
                                    </Typography>
                                    <Typography
                                        variant="body2"
                                        sx={{
                                            fontFamily: 'monospace',
                                            bgcolor: 'grey.100',
                                            p: 1,
                                            borderRadius: 1,
                                            whiteSpace: 'pre-wrap',
                                            fontSize: '0.75rem',
                                            maxHeight: 300,
                                            overflow: 'auto'
                                        }}
                                    >
                                        {this.state.errorInfo.componentStack}
                                    </Typography>

                                    {isVendorError && (
                                        <Alert severity="warning" sx={{ mt: 2 }}>
                                            <Typography variant="body2">
                                                <strong>Most Common Locations:</strong><br />
                                                • DocumentUpload.js (line ~400-500)<br />
                                                • DocumentList.js (DataGrid vendor column)<br />
                                                • Dashboard/Analytics components<br />
                                                • Any component displaying recent documents
                                            </Typography>
                                        </Alert>
                                    )}
                                </AccordionDetails>
                            </Accordion>
                        )}

                        {/* Development Helper */}
                        {process.env.NODE_ENV === 'development' && isVendorError && (
                            <Paper sx={{ p: 2, mt: 2, bgcolor: 'warning.light', textAlign: 'left' }}>
                                <Typography variant="subtitle2" gutterBottom>
                                    🛠️ Development Helper - Copy & Paste Fix:
                                </Typography>
                                <Typography
                                    variant="body2"
                                    sx={{
                                        fontFamily: 'monospace',
                                        bgcolor: 'white',
                                        p: 1,
                                        borderRadius: 1,
                                        fontSize: '0.75rem'
                                    }}
                                >
                                    {`// Add this helper function to your component:
const safeVendor = (data) => {
  if (!data?.vendor) return 'N/A';
  if (typeof data.vendor === 'string') return data.vendor;
  if (typeof data.vendor === 'object') return data.vendor.name || 'Unknown';
  return String(data.vendor);
};

// Replace: {invoiceData?.vendor}
// With: {safeVendor(invoiceData)}`}
                                </Typography>
                            </Paper>
                        )}
                    </Paper>
                </Container>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;