// Complete DocumentDetailView.js with responsive layout and visible content - FIXED JSX ERRORS

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    Box,
    Container,
    Typography,
    Button,
    Paper,
    Grid,
    Card,
    CardContent,
    Chip,
    Alert,
    LinearProgress,
    IconButton,
    Breadcrumbs,
    Link,
    Divider,
    List,
    ListItem,
    ListItemText,
    ListItemIcon,
    Tooltip,
    CircularProgress,
    AppBar,
    Toolbar,
    TextField,
    Snackbar,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Switch,
    FormControlLabel,
    Accordion,
    AccordionSummary,
    AccordionDetails,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    TableFooter
} from '@mui/material';
import {
    ArrowBack,
    GetApp,
    Visibility,
    CheckCircle,
    Error as ErrorIcon,
    Schedule,
    PictureAsPdf,
    Image,
    Description,
    Receipt,
    Business,
    Assignment,
    NavigateNext,
    TrendingUp,
    Info,
    Edit,
    Save,
    Cancel,
    Code,
    ContentCopy,
    ExpandMore,
    Add,
    Delete,
    ShoppingCart
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import SimplePDFViewer from './SimplePDFViewer';

// Configure axios defaults
const api = axios.create({
    baseURL: 'http://localhost:5000',
    timeout: 30000,
});

api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

const DocumentDetailView = () => {
    const { documentId } = useParams();
    const navigate = useNavigate();
    const queryClient = useQueryClient();

    // State management
    const [pdfUrl, setPdfUrl] = useState(null);
    const [error, setError] = useState(null);
    const [editMode, setEditMode] = useState(false);
    const [editedData, setEditedData] = useState({});
    const [hasChanges, setHasChanges] = useState(false);
    const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
    const [saveDialog, setSaveDialog] = useState(false);
    const [showRawData, setShowRawData] = useState(false);

    // Fetch document details
    const { data: invoiceDocument, isLoading, error: fetchError } = useQuery({
        queryKey: ['document', documentId],
        queryFn: async () => {
            const response = await api.get(`/api/documents/${documentId}`);
            return response.data;
        },
        enabled: !!documentId
    });

    // Save document changes mutation
    const saveDocumentMutation = useMutation({
        mutationFn: async (updatedData) => {
            const response = await api.put(`/api/documents/${documentId}`, {
                invoiceData: updatedData
            });
            return response.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['document', documentId] });
            queryClient.invalidateQueries({ queryKey: ['documents'] });
            setSnackbar({
                open: true,
                message: 'Document updated successfully!',
                severity: 'success'
            });
            setEditMode(false);
            setHasChanges(false);
            setSaveDialog(false);
        },
        onError: (error) => {
            setSnackbar({
                open: true,
                message: `Failed to save changes: ${error.message}`,
                severity: 'error'
            });
        }
    });

    // Initialize edited data when document loads
    useEffect(() => {
        if (invoiceDocument?.invoiceData) {
            const data = normalizeInvoiceData(invoiceDocument.invoiceData);
            setEditedData(data);
        }
    }, [invoiceDocument]);

    // Set PDF URL when document is loaded
    useEffect(() => {
        if (invoiceDocument && invoiceDocument.filename) {
            setPdfUrl(`http://localhost:5000/uploads/${invoiceDocument.filename}`);
        }
    }, [invoiceDocument]);

    // Data normalization function
    const normalizeInvoiceData = (data) => {
        const normalized = { ...data };

        // Ensure all required nested objects exist
        if (!normalized.vendor) normalized.vendor = {};
        if (!normalized.billTo) normalized.billTo = {};
        if (!normalized.amounts) normalized.amounts = {};
        if (!normalized.paymentDetails) normalized.paymentDetails = {};
        if (!normalized.orderInfo) normalized.orderInfo = {};

        // Handle line items
        if (!normalized.lineItems || normalized.lineItems.length === 0) {
            if (data.items && Array.isArray(data.items) && data.items.length > 0) {
                normalized.lineItems = data.items.map((item, index) => ({
                    id: item.id || `item-${index}`,
                    description: getItemDescription(item),
                    quantity: parseFloat(item.quantity || item.qty || 1),
                    unitPrice: parseFloat(item.unitPrice || item.price || item.rate || 0),
                    amount: parseFloat(item.amount || item.total || (item.quantity * item.unitPrice) || 0)
                }));
            } else {
                normalized.lineItems = [];
            }
        }

        // Vendor name normalization
        if (!normalized.vendor.name) {
            normalized.vendor.name = getVendorName(data);
        }

        // Currency normalization
        if (!normalized.amounts.currency) {
            normalized.amounts.currency = detectCurrency(data);
        }

        normalized.items = normalized.lineItems;
        return normalized;
    };

    // Helper functions
    const getItemDescription = (item) => {
        if (item.description) return item.description;
        if (item.name) return item.name;
        return 'Unknown Item';
    };

    const getVendorName = (invoiceData) => {
        const vendorNameFields = ['vendor.name', 'vendorName', 'supplier', 'from', 'company'];
        for (const field of vendorNameFields) {
            const value = getNestedValue(invoiceData, field);
            if (value && typeof value === 'string' && value.length > 1) {
                return value;
            }
        }
        return 'Unknown Vendor';
    };

    const detectCurrency = (invoiceData) => {
        if (invoiceData.amounts?.currency) return invoiceData.amounts.currency;
        if (invoiceData.currency) return invoiceData.currency;
        return 'MYR';
    };

    const getNestedValue = (obj, path) => {
        return path.split('.').reduce((current, key) => current?.[key], obj);
    };

    const getFileTypeIcon = (filename) => {
        const ext = filename?.split('.').pop()?.toLowerCase();
        switch (ext) {
            case 'pdf':
                return <PictureAsPdf color="error" sx={{ fontSize: 40 }} />;
            case 'jpg':
            case 'jpeg':
            case 'png':
            case 'tiff':
                return <Image color="primary" sx={{ fontSize: 40 }} />;
            default:
                return <Description sx={{ fontSize: 40 }} />;
        }
    };

    const getStatusIcon = (status) => {
        switch (status) {
            case 'completed':
                return <CheckCircle color="success" />;
            case 'processing':
                return <Schedule color="warning" />;
            case 'failed':
                return <ErrorIcon color="error" />;
            default:
                return <Description />;
        }
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'completed': return 'success';
            case 'processing': return 'warning';
            case 'failed': return 'error';
            default: return 'default';
        }
    };

    const formatCurrency = (amount, currency = 'MYR') => {
        if (!amount && amount !== 0) return 'N/A';
        const currencyMap = {
            'USD': '$',
            'CAD': 'CAD $',
            'MYR': 'RM',
            'INR': '₹',
            'EUR': '€',
            'GBP': '£'
        };
        const symbol = currencyMap[currency] || currency + ' ';
        return `${symbol}${parseFloat(amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    };

    const getConfidenceColor = (confidence) => {
        if (confidence >= 90) return 'success';
        if (confidence >= 70) return 'warning';
        return 'error';
    };

    const getConfidenceForField = (fieldName) => {
        if (invoiceDocument?.metrics?.fieldConfidence?.[fieldName]) {
            return invoiceDocument.metrics.fieldConfidence[fieldName];
        }
        return invoiceDocument?.metrics?.averageConfidence || 0;
    };

    // Edit handling functions
    const handleFieldChange = (path, value) => {
        const pathArray = path.split('.');
        const newData = { ...editedData };

        let current = newData;
        for (let i = 0; i < pathArray.length - 1; i++) {
            if (!current[pathArray[i]]) {
                current[pathArray[i]] = {};
            }
            current = current[pathArray[i]];
        }
        current[pathArray[pathArray.length - 1]] = value;

        setEditedData(newData);
        setHasChanges(true);
    };

    const getFieldValue = (path) => {
        const pathArray = path.split('.');
        let current = editedData;
        for (const key of pathArray) {
            if (current?.[key] === undefined) return '';
            current = current[key];
        }
        return current || '';
    };

    const handleSave = () => {
        setSaveDialog(true);
    };

    const confirmSave = () => {
        saveDocumentMutation.mutate(editedData);
    };

    const handleCancel = () => {
        if (invoiceDocument?.invoiceData) {
            setEditedData(normalizeInvoiceData(invoiceDocument.invoiceData));
        }
        setEditMode(false);
        setHasChanges(false);
    };

    const copyToClipboard = async (text) => {
        try {
            await navigator.clipboard.writeText(text);
            setSnackbar({
                open: true,
                message: 'Copied to clipboard!',
                severity: 'success'
            });
        } catch (err) {
            setSnackbar({
                open: true,
                message: 'Failed to copy to clipboard',
                severity: 'error'
            });
        }
    };

    const handleExportData = () => {
        const dataToExport = {
            document: {
                id: invoiceDocument.id,
                originalName: invoiceDocument.originalName,
                status: invoiceDocument.status,
                createdAt: invoiceDocument.createdAt,
                completedAt: invoiceDocument.completedAt,
                lastModified: new Date().toISOString()
            },
            invoiceData: editMode ? editedData : invoiceDocument.invoiceData,
            extractedText: invoiceDocument.extractedText,
            metrics: invoiceDocument.metrics,
            extractionMethods: invoiceDocument.extractionMethods,
            isEdited: hasChanges || editMode
        };

        const blob = new Blob([JSON.stringify(dataToExport, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${invoiceDocument.originalName}_${editMode ? 'edited_' : ''}data.json`;
        a.click();
        URL.revokeObjectURL(url);
    };

    if (isLoading) {
        return (
            <Box display="flex" justifyContent="center" alignItems="center" minHeight="80vh">
                <CircularProgress size={60} />
            </Box>
        );
    }

    if (fetchError || !invoiceDocument) {
        return (
            <Container maxWidth="md" sx={{ py: 4 }}>
                <Alert severity="error">
                    Failed to load document details: {fetchError?.message || 'Document not found'}
                </Alert>
                <Button
                    variant="contained"
                    startIcon={<ArrowBack />}
                    onClick={() => navigate('/documents')}
                    sx={{ mt: 2 }}
                >
                    Back to Documents
                </Button>
            </Container>
        );
    }

    const EditableFieldWithConfidence = ({ label, value, fieldName, icon, path, type = 'text', multiline = false }) => {
        const confidence = getConfidenceForField(fieldName);
        const isEditing = editMode;
        const fieldValue = isEditing ? getFieldValue(path) : value;

        return (
            <Box sx={{ mb: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        {icon && <Box sx={{ mr: 1, display: 'flex' }}>{icon}</Box>}
                        <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
                            {label}
                        </Typography>
                    </Box>
                    <Tooltip title={`Confidence: ${confidence.toFixed(1)}%`}>
                        <Chip
                            size="small"
                            label={`${confidence.toFixed(0)}%`}
                            color={getConfidenceColor(confidence)}
                            variant="outlined"
                        />
                    </Tooltip>
                </Box>

                {isEditing ? (
                    <TextField
                        fullWidth
                        size="small"
                        type={type}
                        value={fieldValue}
                        onChange={(e) => handleFieldChange(path, e.target.value)}
                        multiline={multiline}
                        rows={multiline ? 2 : 1}
                        placeholder={`Enter ${label.toLowerCase()}`}
                        variant="outlined"
                    />
                ) : (
                    <Typography
                        variant="body1"
                        sx={{
                            fontWeight: 500,
                            minHeight: '1.5em',
                            p: 1,
                            bgcolor: 'grey.50',
                            borderRadius: 1,
                            border: '1px solid',
                            borderColor: 'grey.200'
                        }}
                    >
                        {fieldValue || 'Not found'}
                    </Typography>
                )}
            </Box>
        );
    };

    return (
        <Box sx={{
            display: 'flex',
            flexDirection: 'column',
            height: '100vh',
            bgcolor: 'background.default'
        }}>
            {/* Header */}
            <AppBar position="static" color="default" elevation={1}>
                <Toolbar>
                    <IconButton
                        edge="start"
                        onClick={() => navigate('/documents')}
                        sx={{ mr: 2 }}
                    >
                        <ArrowBack />
                    </IconButton>

                    <Box sx={{ flexGrow: 1, display: 'flex', alignItems: 'center' }}>
                        {getFileTypeIcon(invoiceDocument.originalName)}
                        <Box sx={{ ml: 2 }}>
                            <Typography variant="h6" component="div">
                                {invoiceDocument.originalName}
                                {(editMode || hasChanges) && (
                                    <Chip
                                        label={editMode ? "Editing" : "Modified"}
                                        color="warning"
                                        size="small"
                                        sx={{ ml: 1 }}
                                    />
                                )}
                            </Typography>
                            <Breadcrumbs
                                separator={<NavigateNext fontSize="small" />}
                                sx={{ fontSize: '0.875rem' }}
                            >
                                <Link
                                    color="inherit"
                                    href="#"
                                    onClick={(e) => {
                                        e.preventDefault();
                                        navigate('/documents');
                                    }}
                                >
                                    Documents
                                </Link>
                                <Typography color="text.primary" sx={{ fontSize: '0.875rem' }}>
                                    {invoiceDocument.originalName}
                                </Typography>
                            </Breadcrumbs>
                        </Box>
                    </Box>

                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Chip
                            icon={getStatusIcon(invoiceDocument.status)}
                            label={invoiceDocument.status}
                            color={getStatusColor(invoiceDocument.status)}
                            variant="outlined"
                        />

                        <FormControlLabel
                            control={
                                <Switch
                                    checked={editMode}
                                    onChange={(e) => {
                                        if (e.target.checked) {
                                            setEditMode(true);
                                        } else if (hasChanges) {
                                            if (window.confirm('You have unsaved changes. Are you sure you want to exit edit mode?')) {
                                                handleCancel();
                                            }
                                        } else {
                                            setEditMode(false);
                                        }
                                    }}
                                    size="small"
                                />
                            }
                            label="Edit"
                            sx={{ ml: 1 }}
                        />

                        {editMode && (
                            <>
                                <Button
                                    variant="outlined"
                                    size="small"
                                    startIcon={<Cancel />}
                                    onClick={handleCancel}
                                    disabled={saveDocumentMutation.isPending}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    variant="contained"
                                    size="small"
                                    startIcon={<Save />}
                                    onClick={handleSave}
                                    disabled={!hasChanges || saveDocumentMutation.isPending}
                                    color="success"
                                >
                                    {saveDocumentMutation.isPending ? 'Saving...' : 'Save'}
                                </Button>
                            </>
                        )}

                        <Button
                            variant="outlined"
                            startIcon={<GetApp />}
                            onClick={handleExportData}
                            size="small"
                        >
                            Export
                        </Button>

                        <Button
                            variant="outlined"
                            startIcon={<Code />}
                            onClick={() => setShowRawData(true)}
                            size="small"
                            color="info"
                        >
                            Raw Data
                        </Button>
                    </Box>
                </Toolbar>
            </AppBar>

            {/* Unsaved Changes Alert */}
            {hasChanges && (
                <Alert severity="warning" sx={{ mx: 2, mt: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <Typography variant="body2">
                            You have unsaved changes. Don't forget to save your modifications.
                        </Typography>
                        <Button size="small" onClick={handleSave} variant="contained" color="warning">
                            Save Now
                        </Button>
                    </Box>
                </Alert>
            )}

            {/* Main Content - Fixed Side-by-Side Layout */}
            <Box sx={{
                flex: 1,
                display: 'flex',
                overflow: 'hidden',
                p: 2,
                gap: 2
            }}>
                {/* Left Panel - Invoice Data */}
                <Box sx={{
                    width: '600px',
                    minWidth: '600px',
                    maxWidth: '600px',
                    display: 'flex',
                    flexDirection: 'column'
                }}>
                    <Paper sx={{ flex: 1, overflow: 'auto', p: 3 }}>
                        <Typography variant="h5" sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                            <Receipt sx={{ mr: 1 }} />
                            Invoice Data
                            {editMode && (
                                <Tooltip title="Edit mode active">
                                    <Edit color="primary" fontSize="small" sx={{ ml: 1 }} />
                                </Tooltip>
                            )}
                        </Typography>

                        {/* Confidence Score */}
                        <Card variant="outlined" sx={{ mb: 3, bgcolor: 'primary.light', color: 'primary.contrastText' }}>
                            <CardContent>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <Typography variant="h6">Overall Confidence</Typography>
                                    <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
                                        {invoiceDocument.metrics?.averageConfidence?.toFixed(1) || 0}%
                                    </Typography>
                                </Box>
                                <LinearProgress
                                    variant="determinate"
                                    value={invoiceDocument.metrics?.averageConfidence || 0}
                                    sx={{ mt: 2, height: 8, borderRadius: 4 }}
                                    color="inherit"
                                />
                            </CardContent>
                        </Card>

                        {/* Invoice Details */}
                        <Box sx={{ mb: 4 }}>
                            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', fontWeight: 'bold', mb: 2 }}>
                                <Receipt sx={{ mr: 1 }} />
                                Invoice Details
                            </Typography>

                            <EditableFieldWithConfidence
                                label="Invoice Number"
                                value={editedData.invoiceNumber}
                                fieldName="invoiceNumber"
                                path="invoiceNumber"
                                icon={<Description fontSize="small" />}
                            />
                            <EditableFieldWithConfidence
                                label="Invoice Date"
                                value={editedData.date}
                                fieldName="date"
                                path="date"
                                type="date"
                                icon={<Schedule fontSize="small" />}
                            />
                            <EditableFieldWithConfidence
                                label="Due Date"
                                value={editedData.dueDate}
                                fieldName="dueDate"
                                path="dueDate"
                                type="date"
                                icon={<Schedule fontSize="small" />}
                            />
                            <EditableFieldWithConfidence
                                label="PO Number"
                                value={editedData.orderInfo?.orderNumber}
                                fieldName="orderInfo.orderNumber"
                                path="orderInfo.orderNumber"
                                icon={<Assignment fontSize="small" />}
                            />
                        </Box>

                        {/* Vendor Information */}
                        <Box sx={{ mb: 4 }}>
                            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', fontWeight: 'bold', mb: 2 }}>
                                <Business sx={{ mr: 1 }} />
                                Vendor Information
                            </Typography>

                            <EditableFieldWithConfidence
                                label="Vendor Name"
                                value={editedData.vendor?.name}
                                fieldName="vendor.name"
                                path="vendor.name"
                                icon={<Business fontSize="small" />}
                            />
                            <EditableFieldWithConfidence
                                label="Phone"
                                value={editedData.vendor?.phone}
                                fieldName="vendor.phone"
                                path="vendor.phone"
                                type="tel"
                                icon={<Info fontSize="small" />}
                            />
                            <EditableFieldWithConfidence
                                label="Email"
                                value={editedData.vendor?.email}
                                fieldName="vendor.email"
                                path="vendor.email"
                                type="email"
                                icon={<Info fontSize="small" />}
                            />
                            <EditableFieldWithConfidence
                                label="Address"
                                value={editedData.vendor?.address}
                                fieldName="vendor.address"
                                path="vendor.address"
                                multiline={true}
                                icon={<Info fontSize="small" />}
                            />
                            <EditableFieldWithConfidence
                                label="Tax ID / SST No"
                                value={editedData.vendor?.taxId}
                                fieldName="vendor.taxId"
                                path="vendor.taxId"
                                icon={<Info fontSize="small" />}
                            />
                        </Box>

                        {/* Financial Details */}
                        <Box sx={{ mb: 4 }}>
                            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', fontWeight: 'bold', mb: 2 }}>
                                <TrendingUp sx={{ mr: 1 }} />
                                Financial Details
                            </Typography>

                            <EditableFieldWithConfidence
                                label="Subtotal"
                                value={editedData.amounts?.subtotal}
                                fieldName="amounts.subtotal"
                                path="amounts.subtotal"
                                type="number"
                                icon={<TrendingUp fontSize="small" />}
                            />
                            <EditableFieldWithConfidence
                                label="Tax Amount"
                                value={editedData.amounts?.tax}
                                fieldName="amounts.tax"
                                path="amounts.tax"
                                type="number"
                                icon={<TrendingUp fontSize="small" />}
                            />
                            <EditableFieldWithConfidence
                                label="Tax Rate (%)"
                                value={editedData.amounts?.taxRate}
                                fieldName="amounts.taxRate"
                                path="amounts.taxRate"
                                icon={<Info fontSize="small" />}
                            />
                            <EditableFieldWithConfidence
                                label="Total Amount"
                                value={editedData.amounts?.total}
                                fieldName="amounts.total"
                                path="amounts.total"
                                type="number"
                                icon={<TrendingUp fontSize="small" color="primary" />}
                            />
                            <EditableFieldWithConfidence
                                label="Currency"
                                value={editedData.amounts?.currency}
                                fieldName="amounts.currency"
                                path="amounts.currency"
                                icon={<Info fontSize="small" />}
                            />

                            {/* Financial Summary */}
                            {editedData.amounts?.total && (
                                <Box sx={{ mt: 3, p: 2, bgcolor: 'success.light', borderRadius: 2 }}>
                                    <Typography variant="h5" color="success.contrastText" align="center" sx={{ fontWeight: 'bold' }}>
                                        Total: {formatCurrency(editedData.amounts.total, editedData.amounts?.currency)}
                                    </Typography>
                                </Box>
                            )}
                        </Box>

                        {/* Line Items Section */}
                        <Box sx={{ mb: 4 }}>
                            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', fontWeight: 'bold', mb: 2 }}>
                                <ShoppingCart sx={{ mr: 1 }} />
                                Line Items
                                <Chip
                                    label={`${editedData.lineItems?.length || 0} items`}
                                    size="small"
                                    color="primary"
                                    variant="outlined"
                                    sx={{ ml: 1 }}
                                />
                            </Typography>

                            {editedData.lineItems && editedData.lineItems.length > 0 ? (
                                <Box>
                                    {editedData.lineItems.map((item, index) => (
                                        <Card key={index} variant="outlined" sx={{ mb: 2 }}>
                                            <CardContent sx={{ py: 2 }}>
                                                <Grid container spacing={2}>
                                                    <Grid item xs={12}>
                                                        <Typography variant="subtitle2" color="text.secondary">
                                                            Item {index + 1}
                                                        </Typography>
                                                        <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
                                                            {item.description || 'No description'}
                                                        </Typography>
                                                    </Grid>
                                                    <Grid item xs={4}>
                                                        <Typography variant="caption" color="text.secondary">
                                                            Quantity
                                                        </Typography>
                                                        <Typography variant="body2">
                                                            {item.quantity || 1}
                                                        </Typography>
                                                    </Grid>
                                                    <Grid item xs={4}>
                                                        <Typography variant="caption" color="text.secondary">
                                                            Unit Price
                                                        </Typography>
                                                        <Typography variant="body2">
                                                            {formatCurrency(item.unitPrice, editedData.amounts?.currency)}
                                                        </Typography>
                                                    </Grid>
                                                    <Grid item xs={4}>
                                                        <Typography variant="caption" color="text.secondary">
                                                            Amount
                                                        </Typography>
                                                        <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                                                            {formatCurrency(item.amount, editedData.amounts?.currency)}
                                                        </Typography>
                                                    </Grid>
                                                </Grid>
                                            </CardContent>
                                        </Card>
                                    ))}
                                </Box>
                            ) : (
                                <Box sx={{ textAlign: 'center', py: 4, bgcolor: 'grey.50', borderRadius: 2 }}>
                                    <ShoppingCart sx={{ fontSize: 48, mb: 2, opacity: 0.5 }} />
                                    <Typography variant="h6" sx={{ mb: 1 }}>
                                        No line items found
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary">
                                        This could be a service invoice or the extraction may need improvement
                                    </Typography>
                                </Box>
                            )}
                        </Box>

                        {/* Processing Metrics */}
                        <Box>
                            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', fontWeight: 'bold', mb: 2 }}>
                                <Assignment sx={{ mr: 1 }} />
                                Processing Metrics
                            </Typography>
                            <Grid container spacing={3}>
                                <Grid item xs={6}>
                                    <Typography variant="body2" color="text.secondary">
                                        Processing Time
                                    </Typography>
                                    <Typography variant="h6">
                                        {((invoiceDocument.metrics?.processingTime || 0) / 1000).toFixed(1)}s
                                    </Typography>
                                </Grid>
                                <Grid item xs={6}>
                                    <Typography variant="body2" color="text.secondary">
                                        Data Quality
                                    </Typography>
                                    <Typography variant="h6">
                                        {invoiceDocument.metrics?.dataExtractionScore?.toFixed(0) || 'N/A'}%
                                    </Typography>
                                </Grid>
                                <Grid item xs={6}>
                                    <Typography variant="body2" color="text.secondary">
                                        Pages Processed
                                    </Typography>
                                    <Typography variant="h6">
                                        {invoiceDocument.metrics?.pagesProcessed || 1}
                                    </Typography>
                                </Grid>
                                <Grid item xs={6}>
                                    <Typography variant="body2" color="text.secondary">
                                        Consensus Score
                                    </Typography>
                                    <Typography variant="h6">
                                        {invoiceDocument.metrics?.consensusScore?.toFixed(0) || 'N/A'}%
                                    </Typography>
                                </Grid>
                            </Grid>

                            {invoiceDocument.extractionMethods && invoiceDocument.extractionMethods.length > 0 && (
                                <Box sx={{ mt: 3 }}>
                                    <Typography variant="body2" color="text.secondary" gutterBottom>
                                        Extraction Methods Used:
                                    </Typography>
                                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                                        {invoiceDocument.extractionMethods.map((method, index) => (
                                            <Chip
                                                key={index}
                                                label={method}
                                                size="small"
                                                variant="outlined"
                                                color={
                                                    method.includes('OpenAI') ? 'primary' :
                                                        method.includes('Claude') ? 'secondary' :
                                                            method.includes('Ollama') ? 'info' :
                                                                method.includes('enhanced_regex') ? 'success' : 'default'
                                                }
                                            />
                                        ))}
                                    </Box>
                                </Box>
                            )}
                        </Box>
                    </Paper>
                </Box>

                {/* Right Panel - Document Viewer */}
                <Box sx={{
                    flex: 1,
                    minWidth: 0,
                    display: 'flex',
                    flexDirection: 'column'
                }}>
                    <Paper sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                        <Box sx={{
                            p: 2,
                            borderBottom: 1,
                            borderColor: 'divider',
                            flexShrink: 0,
                            bgcolor: 'grey.50'
                        }}>
                            <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center' }}>
                                <Visibility sx={{ mr: 1 }} />
                                Original Document
                                {editMode && (
                                    <Chip
                                        label="Refer to PDF for corrections"
                                        color="info"
                                        size="small"
                                        sx={{ ml: 2 }}
                                    />
                                )}
                            </Typography>
                        </Box>

                        <Box sx={{
                            flex: 1,
                            position: 'relative',
                            overflow: 'hidden',
                            bgcolor: 'grey.100'
                        }}>
                            {invoiceDocument.originalName?.toLowerCase().endsWith('.pdf') ? (
                                <SimplePDFViewer
                                    documentUrl={pdfUrl}
                                    filename={invoiceDocument.originalName}
                                />
                            ) : (
                                <Box
                                    sx={{
                                        height: '100%',
                                        width: '100%',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        p: 2,
                                        overflow: 'auto'
                                    }}
                                >
                                    <img
                                        src={pdfUrl || `http://localhost:5000/uploads/${invoiceDocument.filename}`}
                                        alt="Document"
                                        style={{
                                            maxWidth: '100%',
                                            maxHeight: '100%',
                                            objectFit: 'contain',
                                            border: '1px solid #ddd',
                                            borderRadius: '4px',
                                            backgroundColor: 'white'
                                        }}
                                        onError={(e) => {
                                            e.target.style.display = 'none';
                                            setError('Failed to load document image');
                                        }}
                                    />
                                </Box>
                            )}
                        </Box>
                    </Paper>
                </Box>
            </Box>

            {/* Raw Data Dialog */}
            <Dialog
                open={showRawData}
                onClose={() => setShowRawData(false)}
                maxWidth="lg"
                fullWidth
            >
                <DialogTitle>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            <Code sx={{ mr: 1 }} />
                            Complete Invoice Data Object
                        </Box>
                        <Button
                            size="small"
                            startIcon={<ContentCopy />}
                            onClick={() => copyToClipboard(JSON.stringify(editMode ? editedData : invoiceDocument.invoiceData, null, 2))}
                        >
                            Copy All
                        </Button>
                    </Box>
                </DialogTitle>
                <DialogContent>
                    <Paper
                        sx={{
                            p: 2,
                            bgcolor: 'grey.50',
                            maxHeight: 400,
                            overflow: 'auto',
                            fontFamily: 'monospace',
                            fontSize: '0.75rem'
                        }}
                    >
                        <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
                            {JSON.stringify(editMode ? editedData : invoiceDocument.invoiceData, null, 2)}
                        </pre>
                    </Paper>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setShowRawData(false)}>Close</Button>
                </DialogActions>
            </Dialog>

            {/* Save Confirmation Dialog */}
            <Dialog open={saveDialog} onClose={() => setSaveDialog(false)}>
                <DialogTitle>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <Save sx={{ mr: 1 }} />
                        Confirm Save Changes
                    </Box>
                </DialogTitle>
                <DialogContent>
                    <Typography variant="body1" gutterBottom>
                        Are you sure you want to save the changes you made to this document?
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                        This will update the extracted invoice data permanently.
                    </Typography>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setSaveDialog(false)}>Cancel</Button>
                    <Button
                        onClick={confirmSave}
                        variant="contained"
                        color="success"
                        disabled={saveDocumentMutation.isPending}
                    >
                        {saveDocumentMutation.isPending ? 'Saving...' : 'Save Changes'}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Snackbar for notifications */}
            <Snackbar
                open={snackbar.open}
                autoHideDuration={6000}
                onClose={() => setSnackbar({ ...snackbar, open: false })}
            >
                <Alert
                    onClose={() => setSnackbar({ ...snackbar, open: false })}
                    severity={snackbar.severity}
                >
                    {snackbar.message}
                </Alert>
            </Snackbar>
        </Box>
    );
};

export default DocumentDetailView;