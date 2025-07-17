// src/components/DocumentProcessing/DocumentDetailView.js - Improved version with better data handling
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
    Download,
    Print,
    Share,
    OpenInNew,
    Edit,
    Save,
    Cancel,
    Check,
    Warning,
    Code,
    ContentCopy,
    ExpandMore,
    Add,
    Delete,
    ShoppingCart,
    Calculate
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import SimplePDFViewer from './SimplePDFViewer';

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
            const response = await axios.get(`/documents/${documentId}`);
            return response.data;
        },
        enabled: !!documentId
    });

    // Save document changes mutation
    const saveDocumentMutation = useMutation({
        mutationFn: async (updatedData) => {
            const response = await axios.put(`/documents/${documentId}`, {
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

    // IMPROVED: Initialize edited data when document loads
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

    // IMPROVED: Data normalization function
    const normalizeInvoiceData = (data) => {
        const normalized = { ...data };

        // Ensure all required nested objects exist
        if (!normalized.vendor) normalized.vendor = {};
        if (!normalized.billTo) normalized.billTo = {};
        if (!normalized.amounts) normalized.amounts = {};
        if (!normalized.paymentDetails) normalized.paymentDetails = {};
        if (!normalized.orderInfo) normalized.orderInfo = {};

        // IMPROVED: Handle line items from multiple possible sources
        if (!normalized.lineItems || normalized.lineItems.length === 0) {
            // Try to get from 'items' field
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
        } else {
            // Normalize existing lineItems
            normalized.lineItems = normalized.lineItems.map((item, index) => ({
                id: item.id || `item-${index}`,
                description: getItemDescription(item),
                quantity: parseFloat(item.quantity || item.qty || 1),
                unitPrice: parseFloat(item.unitPrice || item.price || item.rate || 0),
                amount: parseFloat(item.amount || item.total || (item.quantity * item.unitPrice) || 0)
            }));
        }

        // IMPROVED: Vendor name normalization
        if (!normalized.vendor.name) {
            normalized.vendor.name = getVendorName(data);
        }

        // IMPROVED: Currency normalization
        if (!normalized.amounts.currency) {
            normalized.amounts.currency = detectCurrency(data);
        }

        // IMPROVED: Date normalization
        if (normalized.date && typeof normalized.date === 'string') {
            normalized.date = normalizeDate(normalized.date);
        }
        if (normalized.dueDate && typeof normalized.dueDate === 'string') {
            normalized.dueDate = normalizeDate(normalized.dueDate);
        }

        // Ensure items array is in sync with lineItems
        normalized.items = normalized.lineItems;

        return normalized;
    };

    // IMPROVED: Helper function to get item description from various formats
    const getItemDescription = (item) => {
        if (item.description) return item.description;
        if (item.name) return item.name;
        if (item.itemDescription) return item.itemDescription;
        if (item.service) return item.service;
        if (item.product) return item.product;
        return 'Unknown Item';
    };

    // IMPROVED: Enhanced vendor name extraction
    const getVendorName = (invoiceData) => {
        // Try multiple possible vendor name fields
        const vendorNameFields = [
            'vendor.name',
            'vendor.companyName',
            'vendorName',
            'supplier',
            'from',
            'company',
            'businessName'
        ];

        for (const field of vendorNameFields) {
            const value = getNestedValue(invoiceData, field);
            if (value && typeof value === 'string' && value !== '[object Object]' && value.length > 1) {
                return value;
            }
        }

        // Fallback: try to extract from vendor object
        if (invoiceData.vendor && typeof invoiceData.vendor === 'object') {
            const vendor = invoiceData.vendor;
            if (vendor.email) return vendor.email;
            if (vendor.phone) return vendor.phone;
        }

        return 'Unknown Vendor';
    };

    // IMPROVED: Currency detection
    const detectCurrency = (invoiceData) => {
        // Check explicit currency fields
        if (invoiceData.amounts?.currency) return invoiceData.amounts.currency;
        if (invoiceData.currency) return invoiceData.currency;

        // Try to detect from text or amounts
        const text = JSON.stringify(invoiceData).toLowerCase();
        if (text.includes('myr') || text.includes(' rm ')) return 'MYR';
        if (text.includes('usd') || text.includes('$')) return 'USD';
        if (text.includes('cad')) return 'CAD';
        if (text.includes('eur') || text.includes('€')) return 'EUR';
        if (text.includes('gbp') || text.includes('£')) return 'GBP';
        if (text.includes('inr') || text.includes('₹')) return 'INR';

        return 'MYR'; // Default for Malaysian invoices
    };

    // Helper function to get nested object values
    const getNestedValue = (obj, path) => {
        return path.split('.').reduce((current, key) => current?.[key], obj);
    };

    // Helper function to normalize dates
    const normalizeDate = (dateString) => {
        if (!dateString) return '';

        try {
            // Handle various date formats
            let date;

            // DD/MM/YYYY or DD-MM-YYYY
            const ddmmyyyy = dateString.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
            if (ddmmyyyy) {
                const day = ddmmyyyy[1].padStart(2, '0');
                const month = ddmmyyyy[2].padStart(2, '0');
                const year = ddmmyyyy[3];
                return `${year}-${month}-${day}`;
            }

            // Try standard Date parsing
            date = new Date(dateString);
            if (date instanceof Date && !isNaN(date)) {
                return date.toISOString().split('T')[0];
            }

            return dateString;
        } catch (error) {
            return dateString;
        }
    };

    // Helper functions for UI
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

    // IMPROVED: Line Items functions
    const addLineItem = () => {
        const newLineItem = {
            id: Date.now().toString(),
            description: '',
            quantity: 1,
            unitPrice: 0,
            amount: 0
        };

        const newData = { ...editedData };
        if (!newData.lineItems) {
            newData.lineItems = [];
        }
        newData.lineItems.push(newLineItem);

        setEditedData(newData);
        setHasChanges(true);
    };

    const removeLineItem = (index) => {
        const newData = { ...editedData };
        newData.lineItems.splice(index, 1);
        setEditedData(newData);
        setHasChanges(true);
        recalculateTotals(newData);
    };

    const updateLineItem = (index, field, value) => {
        const newData = { ...editedData };
        if (!newData.lineItems) return;

        newData.lineItems[index][field] = value;

        // Auto-calculate amount if quantity or unitPrice changes
        if (field === 'quantity' || field === 'unitPrice') {
            const item = newData.lineItems[index];
            item.amount = (parseFloat(item.quantity) || 0) * (parseFloat(item.unitPrice) || 0);
        }

        setEditedData(newData);
        setHasChanges(true);
        recalculateTotals(newData);
    };

    const recalculateTotals = (data) => {
        if (!data.lineItems || data.lineItems.length === 0) return;

        const subtotal = data.lineItems.reduce((sum, item) => {
            return sum + (parseFloat(item.amount) || 0);
        }, 0);

        // Update amounts object
        if (!data.amounts) data.amounts = {};
        data.amounts.subtotal = subtotal;

        // Calculate tax if tax rate exists
        const taxRateMatch = data.amounts.taxRate?.match(/(\d+(?:\.\d+)?)/);
        const taxRate = taxRateMatch ? parseFloat(taxRateMatch[1]) : 0;
        const tax = subtotal * (taxRate / 100);
        data.amounts.tax = tax;
        data.amounts.total = subtotal + tax;

        // Also update the items array to keep it in sync
        data.items = data.lineItems;
    };

    const calculateLineItemsTotal = () => {
        if (!editedData.lineItems) return 0;
        return editedData.lineItems.reduce((sum, item) => {
            return sum + (parseFloat(item.amount) || 0);
        }, 0);
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
            <ListItem sx={{ px: 0, py: 1 }}>
                <ListItemIcon sx={{ minWidth: 40 }}>
                    {icon}
                </ListItemIcon>
                <ListItemText
                    primary={
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
                                {label}
                            </Typography>
                            <Tooltip title={`Confidence: ${confidence.toFixed(1)}%`}>
                                <Chip
                                    size="small"
                                    label={`${confidence.toFixed(0)}%`}
                                    color={getConfidenceColor(confidence)}
                                    variant="outlined"
                                />
                            </Tooltip>
                        </Box>
                    }
                    secondary={
                        isEditing ? (
                            <TextField
                                fullWidth
                                size="small"
                                type={type}
                                value={fieldValue}
                                onChange={(e) => handleFieldChange(path, e.target.value)}
                                multiline={multiline}
                                rows={multiline ? 2 : 1}
                                sx={{ mt: 0.5 }}
                                placeholder={`Enter ${label.toLowerCase()}`}
                            />
                        ) : (
                            <Typography variant="body1" sx={{ fontWeight: 500, mt: 0.5 }}>
                                {fieldValue || 'Not found'}
                            </Typography>
                        )
                    }
                />
            </ListItem>
        );
    };

    // IMPROVED: Line Items Table Component
    const LineItemsTable = () => {
        const lineItems = editedData.lineItems || [];
        const lineItemsTotal = calculateLineItemsTotal();
        const currency = editedData.amounts?.currency || 'MYR';

        return (
            <Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
                    <Typography variant="subtitle1" sx={{ display: 'flex', alignItems: 'center', fontWeight: 'bold' }}>
                        <ShoppingCart sx={{ mr: 1 }} />
                        Line Items
                        <Chip
                            label={`${lineItems.length} items`}
                            size="small"
                            color="primary"
                            variant="outlined"
                            sx={{ ml: 1 }}
                        />
                    </Typography>
                    {editMode && (
                        <Button
                            variant="outlined"
                            size="small"
                            startIcon={<Add />}
                            onClick={addLineItem}
                            color="primary"
                        >
                            Add Item
                        </Button>
                    )}
                </Box>

                {lineItems.length === 0 ? (
                    <Box sx={{ textAlign: 'center', py: 3, color: 'text.secondary' }}>
                        <ShoppingCart sx={{ fontSize: 48, mb: 1, opacity: 0.5 }} />
                        <Typography variant="body1" sx={{ mb: 1 }}>
                            No line items found in extracted data
                        </Typography>
                        <Typography variant="caption" sx={{ display: 'block', mb: 2, fontStyle: 'italic' }}>
                            This could be a service invoice or the extraction may need improvement
                        </Typography>
                        {editMode && (
                            <Button
                                variant="contained"
                                size="small"
                                startIcon={<Add />}
                                onClick={addLineItem}
                                sx={{ mt: 1 }}
                            >
                                Add Item Manually
                            </Button>
                        )}

                        {/* IMPROVED: Debug Information */}
                        <Accordion sx={{ mt: 2, textAlign: 'left' }}>
                            <AccordionSummary expandIcon={<ExpandMore />}>
                                <Typography variant="caption" sx={{ fontWeight: 'bold' }}>
                                    Debug Info - Click to expand
                                </Typography>
                            </AccordionSummary>
                            <AccordionDetails>
                                <Typography variant="caption" sx={{ display: 'block', mb: 1 }}>
                                    Available fields: {Object.keys(editedData).join(', ')}
                                </Typography>
                                {editedData.items && (
                                    <Typography variant="caption" sx={{ display: 'block', color: 'primary.main', mb: 1 }}>
                                        Found 'items' field with {Array.isArray(editedData.items) ? editedData.items.length : 'non-array'} entries
                                    </Typography>
                                )}
                                {editedData.items && Array.isArray(editedData.items) && editedData.items.length > 0 && (
                                    <Box sx={{ maxHeight: 100, overflow: 'auto', bgcolor: 'grey.100', p: 1, borderRadius: 1 }}>
                                        <pre style={{ margin: 0, fontSize: '10px' }}>
                                            {JSON.stringify(editedData.items, null, 2)}
                                        </pre>
                                    </Box>
                                )}
                            </AccordionDetails>
                        </Accordion>
                    </Box>
                ) : (
                    <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 400 }}>
                        <Table size="small" stickyHeader>
                            <TableHead>
                                <TableRow sx={{ bgcolor: 'grey.50' }}>
                                    <TableCell sx={{ fontWeight: 'bold', fontSize: '0.75rem' }}>Description</TableCell>
                                    <TableCell align="center" sx={{ fontWeight: 'bold', minWidth: 80, fontSize: '0.75rem' }}>Quantity</TableCell>
                                    <TableCell align="right" sx={{ fontWeight: 'bold', minWidth: 100, fontSize: '0.75rem' }}>Unit Price ({currency})</TableCell>
                                    <TableCell align="right" sx={{ fontWeight: 'bold', minWidth: 100, fontSize: '0.75rem' }}>Amount ({currency})</TableCell>
                                    {editMode && (
                                        <TableCell align="center" sx={{ fontWeight: 'bold', width: 60 }}>Actions</TableCell>
                                    )}
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {lineItems.map((item, index) => (
                                    <TableRow key={item.id || index} hover>
                                        <TableCell sx={{ py: 0.5 }}>
                                            {editMode ? (
                                                <TextField
                                                    fullWidth
                                                    size="small"
                                                    value={item.description || ''}
                                                    onChange={(e) => updateLineItem(index, 'description', e.target.value)}
                                                    placeholder="Item description"
                                                    variant="outlined"
                                                    multiline
                                                    maxRows={3}
                                                    sx={{ '& .MuiInputBase-input': { fontSize: '0.75rem', py: 0.5 } }}
                                                />
                                            ) : (
                                                <Typography variant="body2" sx={{ fontSize: '0.75rem', lineHeight: 1.2 }}>
                                                    {item.description || 'No description'}
                                                </Typography>
                                            )}
                                        </TableCell>
                                        <TableCell align="center" sx={{ py: 0.5 }}>
                                            {editMode ? (
                                                <TextField
                                                    size="small"
                                                    type="number"
                                                    value={item.quantity || ''}
                                                    onChange={(e) => updateLineItem(index, 'quantity', parseFloat(e.target.value) || 0)}
                                                    sx={{ width: 70, '& .MuiInputBase-input': { fontSize: '0.75rem', py: 0.5, textAlign: 'center' } }}
                                                    inputProps={{ min: 0, step: 0.01 }}
                                                />
                                            ) : (
                                                <Typography variant="body2" sx={{ fontSize: '0.75rem' }}>
                                                    {parseFloat(item.quantity || 0).toLocaleString()}
                                                </Typography>
                                            )}
                                        </TableCell>
                                        <TableCell align="right" sx={{ py: 0.5 }}>
                                            {editMode ? (
                                                <TextField
                                                    size="small"
                                                    type="number"
                                                    value={item.unitPrice || ''}
                                                    onChange={(e) => updateLineItem(index, 'unitPrice', parseFloat(e.target.value) || 0)}
                                                    sx={{ width: 90, '& .MuiInputBase-input': { fontSize: '0.75rem', py: 0.5, textAlign: 'right' } }}
                                                    inputProps={{ min: 0, step: 0.01 }}
                                                />
                                            ) : (
                                                <Typography variant="body2" sx={{ fontSize: '0.75rem' }}>
                                                    {formatCurrency(item.unitPrice, currency)}
                                                </Typography>
                                            )}
                                        </TableCell>
                                        <TableCell align="right" sx={{ py: 0.5 }}>
                                            <Typography variant="body2" sx={{ fontWeight: 'bold', fontSize: '0.75rem' }}>
                                                {formatCurrency(item.amount, currency)}
                                            </Typography>
                                        </TableCell>
                                        {editMode && (
                                            <TableCell align="center" sx={{ py: 0.5 }}>
                                                <IconButton
                                                    size="small"
                                                    color="error"
                                                    onClick={() => removeLineItem(index)}
                                                    sx={{ minWidth: 'auto', p: 0.5 }}
                                                >
                                                    <Delete fontSize="small" />
                                                </IconButton>
                                            </TableCell>
                                        )}
                                    </TableRow>
                                ))}
                            </TableBody>
                            <TableFooter>
                                <TableRow sx={{ bgcolor: 'primary.light' }}>
                                    <TableCell colSpan={editMode ? 3 : 3} sx={{ fontWeight: 'bold', color: 'primary.contrastText', fontSize: '0.8rem' }}>
                                        Line Items Total
                                    </TableCell>
                                    <TableCell align="right" sx={{ fontWeight: 'bold', color: 'primary.contrastText', fontSize: '0.8rem' }}>
                                        {formatCurrency(lineItemsTotal, currency)}
                                    </TableCell>
                                    {editMode && <TableCell />}
                                </TableRow>
                            </TableFooter>
                        </Table>
                    </TableContainer>
                )}

                {lineItems.length > 0 && (
                    <Box sx={{ mt: 1, p: 1.5, bgcolor: 'grey.50', borderRadius: 1 }}>
                        <Grid container spacing={2}>
                            <Grid item xs={4}>
                                <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
                                    Total Items
                                </Typography>
                                <Typography variant="subtitle2">
                                    {lineItems.length}
                                </Typography>
                            </Grid>
                            <Grid item xs={4}>
                                <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
                                    Total Quantity
                                </Typography>
                                <Typography variant="subtitle2">
                                    {lineItems.reduce((sum, item) => sum + (parseFloat(item.quantity) || 0), 0).toLocaleString()}
                                </Typography>
                            </Grid>
                            <Grid item xs={4}>
                                <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
                                    Average Unit Price
                                </Typography>
                                <Typography variant="subtitle2">
                                    {formatCurrency(lineItems.length > 0 ? lineItemsTotal / lineItems.reduce((sum, item) => sum + (parseFloat(item.quantity) || 0), 0) : 0, currency)}
                                </Typography>
                            </Grid>
                        </Grid>
                    </Box>
                )}
            </Box>
        );
    };

    return (
        <Box sx={{ flexGrow: 1, bgcolor: 'background.default', minHeight: '100vh' }}>
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
                <Alert severity="warning" sx={{ m: 2 }}>
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

            {/* Main Content */}
            <Box sx={{ flexGrow: 1, p: 3 }}>
                <Grid container spacing={3}>
                    {/* Left Panel */}
                    <Grid item xs={12} lg={5} md={6}>
                        <Paper sx={{
                            overflow: 'auto',
                            p: 2,
                            maxHeight: { md: 'calc(100vh - 250px)', xs: 'none' },
                            minHeight: { xs: '500px', md: 'auto' }
                        }}>
                            <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                                <Receipt sx={{ mr: 1 }} />
                                Invoice Data
                                {editMode && (
                                    <Tooltip title="Edit mode active">
                                        <Edit color="primary" fontSize="small" sx={{ ml: 1 }} />
                                    </Tooltip>
                                )}
                            </Typography>

                            {/* Confidence Score */}
                            <Card variant="outlined" sx={{ mb: 2, bgcolor: 'primary.light', color: 'primary.contrastText' }}>
                                <CardContent sx={{ py: 1.5 }}>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <Typography variant="subtitle1">Overall Confidence</Typography>
                                        <Typography variant="h5" sx={{ fontWeight: 'bold' }}>
                                            {invoiceDocument.metrics?.averageConfidence?.toFixed(1) || 0}%
                                        </Typography>
                                    </Box>
                                    <LinearProgress
                                        variant="determinate"
                                        value={invoiceDocument.metrics?.averageConfidence || 0}
                                        sx={{ mt: 1, height: 4, borderRadius: 2 }}
                                        color="inherit"
                                    />
                                </CardContent>
                            </Card>

                            {/* Invoice Details */}
                            <Card variant="outlined" sx={{ mb: 2 }}>
                                <CardContent sx={{ py: 1.5 }}>
                                    <Typography variant="subtitle1" gutterBottom sx={{ display: 'flex', alignItems: 'center', fontWeight: 'bold' }}>
                                        <Receipt sx={{ mr: 1 }} />
                                        Invoice Details
                                    </Typography>
                                    <List dense>
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
                                    </List>
                                </CardContent>
                            </Card>

                            {/* Vendor Information */}
                            <Card variant="outlined" sx={{ mb: 2 }}>
                                <CardContent sx={{ py: 1.5 }}>
                                    <Typography variant="subtitle1" gutterBottom sx={{ display: 'flex', alignItems: 'center', fontWeight: 'bold' }}>
                                        <Business sx={{ mr: 1 }} />
                                        Vendor Information
                                    </Typography>
                                    <List dense>
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
                                    </List>
                                </CardContent>
                            </Card>

                            {/* Line Items */}
                            <Card variant="outlined" sx={{ mb: 2 }}>
                                <CardContent sx={{ py: 1.5 }}>
                                    <LineItemsTable />
                                </CardContent>
                            </Card>

                            {/* Financial Details */}
                            <Card variant="outlined" sx={{ mb: 2 }}>
                                <CardContent sx={{ py: 1.5 }}>
                                    <Typography variant="subtitle1" gutterBottom sx={{ display: 'flex', alignItems: 'center', fontWeight: 'bold' }}>
                                        <TrendingUp sx={{ mr: 1 }} />
                                        Financial Details
                                    </Typography>
                                    <List dense>
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
                                    </List>

                                    {/* IMPROVED: Financial Summary */}
                                    {editedData.amounts?.total && (
                                        <Box sx={{ mt: 2, p: 1.5, bgcolor: 'success.light', borderRadius: 1 }}>
                                            <Typography variant="h6" color="success.contrastText" align="center">
                                                Total: {formatCurrency(editedData.amounts.total, editedData.amounts?.currency)}
                                            </Typography>
                                        </Box>
                                    )}
                                </CardContent>
                            </Card>

                            {/* Processing Metrics */}
                            <Card variant="outlined">
                                <CardContent>
                                    <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
                                        <Assignment sx={{ mr: 1 }} />
                                        Processing Metrics
                                    </Typography>
                                    <Grid container spacing={2}>
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
                                        <Box sx={{ mt: 2 }}>
                                            <Typography variant="body2" color="text.secondary" gutterBottom>
                                                Extraction Methods Used:
                                            </Typography>
                                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
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
                                </CardContent>
                            </Card>
                        </Paper>
                    </Grid>

                    {/* Right Panel - Document Viewer */}
                    <Grid item xs={12} lg={7} md={6}>
                        <Paper sx={{
                            height: { md: 'calc(100vh - 250px)', xs: '600px' },
                            display: 'flex',
                            flexDirection: 'column'
                        }}>
                            <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider', flexShrink: 0 }}>
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

                            <Box sx={{ flexGrow: 1, position: 'relative', overflow: 'hidden' }}>
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
                                                objectFit: 'contain'
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
                    </Grid>
                </Grid>
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
                            onClick={() => copyToClipboard(JSON.stringify({
                                original: invoiceDocument.invoiceData,
                                normalized: editedData,
                                currentView: editMode ? editedData : invoiceDocument.invoiceData,
                                hasChanges: hasChanges,
                                metadata: {
                                    documentId: invoiceDocument.id,
                                    filename: invoiceDocument.originalName,
                                    status: invoiceDocument.status,
                                    extractionMethods: invoiceDocument.extractionMethods,
                                    metrics: invoiceDocument.metrics
                                }
                            }, null, 2))}
                        >
                            Copy All
                        </Button>
                    </Box>
                </DialogTitle>
                <DialogContent>
                    <Accordion defaultExpanded>
                        <AccordionSummary expandIcon={<ExpandMore />}>
                            <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
                                Current Data {editMode && hasChanges && "(Modified)"}
                            </Typography>
                        </AccordionSummary>
                        <AccordionDetails>
                            <Paper
                                sx={{
                                    p: 2,
                                    bgcolor: editMode && hasChanges ? 'warning.light' : 'grey.50',
                                    maxHeight: 400,
                                    overflow: 'auto',
                                    fontFamily: 'monospace',
                                    fontSize: '0.75rem'
                                }}
                            >
                                <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
                                    {JSON.stringify(editMode ? editedData : editedData, null, 2)}
                                </pre>
                            </Paper>
                        </AccordionDetails>
                    </Accordion>

                    {editMode && hasChanges && (
                        <Accordion>
                            <AccordionSummary expandIcon={<ExpandMore />}>
                                <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
                                    Original Extracted Data
                                </Typography>
                            </AccordionSummary>
                            <AccordionDetails>
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
                                        {JSON.stringify(invoiceDocument.invoiceData, null, 2)}
                                    </pre>
                                </Paper>
                            </AccordionDetails>
                        </Accordion>
                    )}

                    <Accordion>
                        <AccordionSummary expandIcon={<ExpandMore />}>
                            <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
                                Document Metadata
                            </Typography>
                        </AccordionSummary>
                        <AccordionDetails>
                            <Paper
                                sx={{
                                    p: 2,
                                    bgcolor: 'info.light',
                                    maxHeight: 400,
                                    overflow: 'auto',
                                    fontFamily: 'monospace',
                                    fontSize: '0.75rem'
                                }}
                            >
                                <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
                                    {JSON.stringify({
                                        documentId: invoiceDocument.id,
                                        filename: invoiceDocument.originalName,
                                        status: invoiceDocument.status,
                                        createdAt: invoiceDocument.createdAt,
                                        completedAt: invoiceDocument.completedAt,
                                        extractionMethods: invoiceDocument.extractionMethods,
                                        metrics: invoiceDocument.metrics,
                                        editingStatus: {
                                            isInEditMode: editMode,
                                            hasUnsavedChanges: hasChanges
                                        }
                                    }, null, 2)}
                                </pre>
                            </Paper>
                        </AccordionDetails>
                    </Accordion>

                    {invoiceDocument.extractedText && (
                        <Accordion>
                            <AccordionSummary expandIcon={<ExpandMore />}>
                                <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
                                    Raw Extracted Text (OCR Output)
                                </Typography>
                            </AccordionSummary>
                            <AccordionDetails>
                                <Paper
                                    sx={{
                                        p: 2,
                                        bgcolor: 'grey.100',
                                        maxHeight: 300,
                                        overflow: 'auto',
                                        fontFamily: 'monospace',
                                        fontSize: '0.7rem'
                                    }}
                                >
                                    <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
                                        {invoiceDocument.extractedText}
                                    </pre>
                                </Paper>
                            </AccordionDetails>
                        </Accordion>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setShowRawData(false)}>
                        Close
                    </Button>
                    <Button
                        startIcon={<ContentCopy />}
                        onClick={() => copyToClipboard(JSON.stringify(editMode ? editedData : editedData, null, 2))}
                    >
                        Copy Current Data
                    </Button>
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

                    {/* Summary of changes */}
                    <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                        <Typography variant="subtitle2" gutterBottom>
                            Summary of Changes:
                        </Typography>
                        <Typography variant="body2">
                            • Line Items: {editedData.lineItems?.length || 0} items
                        </Typography>
                        <Typography variant="body2">
                            • Total Amount: {formatCurrency(editedData.amounts?.total, editedData.amounts?.currency)}
                        </Typography>
                        <Typography variant="body2">
                            • Vendor: {editedData.vendor?.name || 'Not specified'}
                        </Typography>
                        <Typography variant="body2">
                            • Invoice Number: {editedData.invoiceNumber || 'Not specified'}
                        </Typography>
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setSaveDialog(false)}>
                        Cancel
                    </Button>
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