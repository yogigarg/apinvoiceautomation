// Updated DocumentList.js with better error handling and authentication
import React, { useState, useEffect } from 'react';
import {
    safeGetVendorName,
    safeFormatCurrency,
    safeGetTotalAmount,
    safeGetCurrency
} from '../utils/invoiceUtils';
import {
    Box,
    Container,
    Typography,
    Button,
    Paper,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Card,
    CardContent,
    Grid,
    Chip,
    TextField,
    InputAdornment,
    IconButton,
    Menu,
    MenuItem,
    ListItemIcon,
    ListItemText,
    Alert,
    Divider,
    LinearProgress,
    CircularProgress
} from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';
import {
    Add,
    Search,
    MoreVert,
    Visibility,
    GetApp,
    Delete,
    Refresh,
    Description,
    PictureAsPdf,
    Image,
    CheckCircle,
    Error as ErrorIcon,
    Schedule,
    TrendingUp,
    Receipt,
    Assignment,
    FilterList
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import DocumentUpload from './DocumentUpload';

// Configure axios defaults with authentication
const api = axios.create({
    baseURL: 'http://localhost:5000',
    timeout: 30000,
});

// Add request interceptor to include auth token
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// Add response interceptor for better error handling
api.interceptors.response.use(
    (response) => response,
    (error) => {
        console.error('API Error:', error.response?.data || error.message);
        if (error.response?.status === 401) {
            localStorage.removeItem('token');
            window.location.href = '/login';
        }
        throw error;
    }
);

const DocumentList = () => {
    const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [anchorEl, setAnchorEl] = useState(null);
    const [menuDocumentId, setMenuDocumentId] = useState(null);
    const [statusFilter, setStatusFilter] = useState('all');
    const [debugInfo, setDebugInfo] = useState(null);

    const navigate = useNavigate();
    const queryClient = useQueryClient();

    // Check authentication on component mount
    useEffect(() => {
        const token = localStorage.getItem('token');
        if (!token) {
            console.error('No authentication token found');
            navigate('/login');
            return;
        }
        console.log('Authentication token found, proceeding with API calls');
    }, [navigate]);

    // Fetch documents with better error handling
    const {
        data: documents,
        isLoading,
        error,
        refetch
    } = useQuery({
        queryKey: ['documents', searchTerm, statusFilter],
        queryFn: async () => {
            console.log('📋 Fetching documents...');

            const params = new URLSearchParams();
            if (searchTerm) params.append('search', searchTerm);
            if (statusFilter !== 'all') params.append('status', statusFilter);

            const response = await api.get(`/api/documents?${params}`);
            console.log(`📊 Received ${response.data.length} documents:`, response.data);

            return response.data;
        },
        enabled: !!localStorage.getItem('token'), // Only run if authenticated
        retry: 3,
        retryDelay: 1000,
        onError: (error) => {
            console.error('Failed to fetch documents:', error);
        },
        onSuccess: (data) => {
            console.log('✅ Documents fetched successfully:', data);
        }
    });

    // Fetch analytics with better error handling
    const { data: analytics } = useQuery({
        queryKey: ['document-analytics'],
        queryFn: async () => {
            console.log('📊 Fetching analytics...');
            const response = await api.get('/api/analytics/dashboard');
            console.log('📈 Analytics received:', response.data);
            return response.data;
        },
        enabled: !!localStorage.getItem('token'),
        retry: 2,
        onError: (error) => {
            console.error('Failed to fetch analytics:', error);
        }
    });

    // Debug query to check what's in memory
    const { data: debugData } = useQuery({
        queryKey: ['debug-documents'],
        queryFn: async () => {
            const response = await api.get('/api/debug/documents');
            setDebugInfo(response.data);
            return response.data;
        },
        enabled: !!localStorage.getItem('token'),
        refetchInterval: 10000, // Refresh every 10 seconds for debugging
        onSuccess: (data) => {
            console.log('🔍 Debug info:', data);
        }
    });

    // Delete document mutation
    const deleteDocumentMutation = useMutation({
        mutationFn: async (documentId) => {
            const response = await api.delete(`/api/documents/${documentId}`);
            return response.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['documents'] });
            queryClient.invalidateQueries({ queryKey: ['document-analytics'] });
            queryClient.invalidateQueries({ queryKey: ['debug-documents'] });
            handleCloseMenu();
            console.log('✅ Document deleted successfully');
        },
        onError: (error) => {
            console.error('❌ Failed to delete document:', error);
        }
    });

    const getFileTypeIcon = (filename) => {
        const ext = filename?.split('.').pop()?.toLowerCase();
        switch (ext) {
            case 'pdf':
                return <PictureAsPdf color="error" />;
            case 'jpg':
            case 'jpeg':
            case 'png':
            case 'tiff':
                return <Image color="primary" />;
            default:
                return <Description />;
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

    const handleMenuOpen = (event, documentId) => {
        setAnchorEl(event.currentTarget);
        setMenuDocumentId(documentId);
    };

    const handleCloseMenu = () => {
        setAnchorEl(null);
        setMenuDocumentId(null);
    };

    const handleViewDetails = (documentId) => {
        navigate(`/documents/${documentId}`);
        handleCloseMenu();
    };

    const handleDeleteDocument = (documentId) => {
        if (window.confirm('Are you sure you want to delete this document?')) {
            deleteDocumentMutation.mutate(documentId);
        }
    };

    const handleUploadComplete = () => {
        setUploadDialogOpen(false);
        // Refresh all queries
        queryClient.invalidateQueries({ queryKey: ['documents'] });
        queryClient.invalidateQueries({ queryKey: ['document-analytics'] });
        queryClient.invalidateQueries({ queryKey: ['debug-documents'] });
        console.log('🔄 Refreshing document list after upload');
    };

    const handleExportData = (document) => {
        const dataToExport = {
            document: {
                id: document.id,
                originalName: document.originalName,
                status: document.status,
                createdAt: document.createdAt,
                completedAt: document.completedAt
            },
            invoiceData: document.invoiceData,
            extractedText: document.extractedText,
            metrics: document.metrics
        };

        const blob = new Blob([JSON.stringify(dataToExport, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${document.originalName}_data.json`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const formatCurrency = (amount, invoiceData) => {
        if (!amount && amount !== 0) return 'N/A';
        return safeFormatCurrency(amount, invoiceData);
    };

    const columns = [
        {
            field: 'originalName',
            headerName: 'Document',
            flex: 1,
            minWidth: 200,
            renderCell: (params) => (
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    {getFileTypeIcon(params.value)}
                    <Typography variant="body2" sx={{ ml: 1 }} noWrap>
                        {params.value}
                    </Typography>
                </Box>
            )
        },
        {
            field: 'status',
            headerName: 'Status',
            width: 130,
            renderCell: (params) => (
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    {getStatusIcon(params.value)}
                    <Chip
                        label={params.value}
                        color={getStatusColor(params.value)}
                        size="small"
                        sx={{ ml: 1, textTransform: 'capitalize' }}
                    />
                </Box>
            )
        },
        {
            field: 'vendor',
            headerName: 'Vendor',
            width: 150,
            valueGetter: (value, row) => {
                return safeGetVendorName(row.invoiceData);
            }
        },
        {
            field: 'amount',
            headerName: 'Amount',
            width: 120,
            valueGetter: (value, row) => {
                return safeGetTotalAmount(row.invoiceData);
            },
            renderCell: (params) => (
                <Typography variant="body2" fontWeight="medium">
                    {formatCurrency(params.value, params.row.invoiceData)}
                </Typography>
            )
        },
        {
            field: 'confidence',
            headerName: 'OCR Confidence',
            width: 140,
            valueGetter: (value, row) => row.metrics?.averageConfidence || 0,
            renderCell: (params) => (
                <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                    <LinearProgress
                        variant="determinate"
                        value={params.value}
                        sx={{ flexGrow: 1, mr: 1, height: 6, borderRadius: 3 }}
                        color={params.value > 80 ? 'success' : params.value > 60 ? 'warning' : 'error'}
                    />
                    <Typography variant="caption">
                        {params.value.toFixed(0)}%
                    </Typography>
                </Box>
            )
        },
        {
            field: 'createdAt',
            headerName: 'Uploaded',
            width: 120,
            valueFormatter: (value) => {
                try {
                    return new Date(value).toLocaleDateString();
                } catch {
                    return 'Invalid Date';
                }
            }
        },
        {
            field: 'actions',
            headerName: 'Actions',
            width: 80,
            sortable: false,
            renderCell: (params) => (
                <IconButton
                    size="small"
                    onClick={(e) => handleMenuOpen(e, params.row.id)}
                >
                    <MoreVert />
                </IconButton>
            )
        }
    ];

    const filteredDocuments = documents?.filter(doc => {
        if (statusFilter !== 'all' && doc.status !== statusFilter) return false;
        if (searchTerm && !doc.originalName.toLowerCase().includes(searchTerm.toLowerCase())) return false;
        return true;
    }) || [];

    if (error) {
        return (
            <Container>
                <Alert severity="error" sx={{ mb: 2 }}>
                    Failed to load documents: {error.message}
                </Alert>

                {/* Debug Information */}
                {debugInfo && (
                    <Alert severity="info" sx={{ mb: 2 }}>
                        <Typography variant="subtitle2">Debug Info:</Typography>
                        <Typography variant="body2">
                            User ID: {debugInfo.user?.id}<br />
                            Email: {debugInfo.user?.email}<br />
                            Total Documents in Memory: {debugInfo.totalDocuments}<br />
                            User Documents: {debugInfo.userDocuments}<br />
                        </Typography>

                        <Button
                            size="small"
                            onClick={() => refetch()}
                            sx={{ mt: 1 }}
                        >
                            Retry Loading Documents
                        </Button>
                    </Alert>
                )}
            </Container>
        );
    }

    return (
        <Container maxWidth="lg" sx={{ py: 4 }}>
            {/* Debug Panel (remove in production) */}
            {debugInfo && (
                <Alert severity="info" sx={{ mb: 2 }}>
                    <Typography variant="subtitle2">Debug Status:</Typography>
                    <Typography variant="body2">
                        User: {debugInfo.user?.email} (ID: {debugInfo.user?.id})<br />
                        Documents in memory: {debugInfo.totalDocuments}<br />
                        Your documents: {debugInfo.userDocuments}<br />
                        Filtered documents showing: {filteredDocuments.length}
                    </Typography>
                </Alert>
            )}

            {/* Analytics Cards */}
            {analytics && (
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
                                            {analytics.summary.totalDocuments}
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
                                            {analytics.summary.completedDocuments}
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
                                            {analytics.summary.averageConfidence.toFixed(1)}%
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
                                    <Schedule sx={{ fontSize: 40, color: 'warning.main', mr: 2 }} />
                                    <Box>
                                        <Typography color="textSecondary" variant="body2">
                                            Processing
                                        </Typography>
                                        <Typography variant="h4" color="warning.main">
                                            {analytics.summary.processingDocuments}
                                        </Typography>
                                    </Box>
                                </Box>
                            </CardContent>
                        </Card>
                    </Grid>
                </Grid>
            )}

            {/* Header and Controls */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Typography variant="h4">Document Processing</Typography>
                <Box sx={{ display: 'flex', gap: 2 }}>
                    <Button
                        variant="outlined"
                        startIcon={<Refresh />}
                        onClick={() => {
                            console.log('🔄 Manual refresh triggered');
                            refetch();
                            queryClient.invalidateQueries({ queryKey: ['document-analytics'] });
                            queryClient.invalidateQueries({ queryKey: ['debug-documents'] });
                        }}
                    >
                        Refresh
                    </Button>
                    <Button
                        variant="contained"
                        startIcon={<Add />}
                        onClick={() => setUploadDialogOpen(true)}
                    >
                        Upload Document
                    </Button>
                </Box>
            </Box>

            {/* Search and Filters */}
            <Paper sx={{ p: 2, mb: 3 }}>
                <Grid container spacing={2} alignItems="center">
                    <Grid item xs={12} sm={6} md={4}>
                        <TextField
                            fullWidth
                            placeholder="Search documents..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            InputProps={{
                                startAdornment: (
                                    <InputAdornment position="start">
                                        <Search />
                                    </InputAdornment>
                                )
                            }}
                            size="small"
                        />
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                        <TextField
                            select
                            fullWidth
                            label="Status"
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            size="small"
                            InputProps={{
                                startAdornment: (
                                    <InputAdornment position="start">
                                        <FilterList />
                                    </InputAdornment>
                                )
                            }}
                        >
                            <MenuItem value="all">All Status</MenuItem>
                            <MenuItem value="completed">Completed</MenuItem>
                            <MenuItem value="processing">Processing</MenuItem>
                            <MenuItem value="failed">Failed</MenuItem>
                        </TextField>
                    </Grid>
                </Grid>
            </Paper>

            {/* Documents Table */}
            <Paper sx={{ height: 500, width: '100%' }}>
                {isLoading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                        <CircularProgress />
                        <Typography sx={{ ml: 2 }}>Loading documents...</Typography>
                    </Box>
                ) : filteredDocuments.length === 0 ? (
                    <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100%', p: 3 }}>
                        <Description sx={{ fontSize: 60, color: 'text.secondary', mb: 2 }} />
                        <Typography variant="h6" color="text.secondary" gutterBottom>
                            No documents found
                        </Typography>
                        <Typography variant="body2" color="text.secondary" textAlign="center" sx={{ mb: 3 }}>
                            {documents?.length === 0
                                ? "Upload your first document to get started with invoice processing."
                                : "Try adjusting your search or filter criteria."}
                        </Typography>
                        <Button
                            variant="contained"
                            startIcon={<Add />}
                            onClick={() => setUploadDialogOpen(true)}
                        >
                            Upload Document
                        </Button>
                    </Box>
                ) : (
                    <DataGrid
                        rows={filteredDocuments}
                        columns={columns}
                        initialState={{
                            pagination: {
                                paginationModel: { pageSize: 10 }
                            }
                        }}
                        pageSizeOptions={[5, 10, 20]}
                        loading={isLoading}
                        disableRowSelectionOnClick
                        sx={{ border: 0 }}
                        onRowClick={(params) => {
                            console.log('Row clicked:', params.row.id);
                            handleViewDetails(params.row.id);
                        }}
                    />
                )}
            </Paper>

            {/* Actions Menu */}
            <Menu
                anchorEl={anchorEl}
                open={Boolean(anchorEl)}
                onClose={handleCloseMenu}
            >
                <MenuItem onClick={() => handleViewDetails(menuDocumentId)}>
                    <ListItemIcon>
                        <Visibility fontSize="small" />
                    </ListItemIcon>
                    <ListItemText>View Details</ListItemText>
                </MenuItem>

                <MenuItem onClick={() => {
                    const doc = documents?.find(d => d.id === menuDocumentId);
                    if (doc) handleExportData(doc);
                    handleCloseMenu();
                }}>
                    <ListItemIcon>
                        <GetApp fontSize="small" />
                    </ListItemIcon>
                    <ListItemText>Export Data</ListItemText>
                </MenuItem>

                <Divider />

                <MenuItem
                    onClick={() => handleDeleteDocument(menuDocumentId)}
                    sx={{ color: 'error.main' }}
                >
                    <ListItemIcon>
                        <Delete fontSize="small" color="error" />
                    </ListItemIcon>
                    <ListItemText>Delete Document</ListItemText>
                </MenuItem>
            </Menu>

            {/* Upload Dialog */}
            <Dialog
                open={uploadDialogOpen}
                onClose={() => setUploadDialogOpen(false)}
                maxWidth="md"
                fullWidth
            >
                <DialogTitle>Upload New Document</DialogTitle>
                <DialogContent>
                    <DocumentUpload onUploadComplete={handleUploadComplete} />
                </DialogContent>
            </Dialog>
        </Container>
    );
};

export default DocumentList;