// Updated DocumentUpload.js with proper authentication
import React, { useState, useCallback } from 'react';
import {
    Box,
    Typography,
    Button,
    LinearProgress,
    Alert,
    Paper,
    List,
    ListItem,
    ListItemIcon,
    ListItemText,
    Chip,
    IconButton
} from '@mui/material';
import {
    CloudUpload,
    Description,
    PictureAsPdf,
    Image,
    CheckCircle,
    Error as ErrorIcon,
    Close,
    Delete
} from '@mui/icons-material';
import { useDropzone } from 'react-dropzone';
import axios from 'axios';
import io from 'socket.io-client';

// Configure axios for authenticated requests
const api = axios.create({
    baseURL: 'http://localhost:5000',
    timeout: 60000, // 60 second timeout for uploads
});

// Add auth token to requests
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

const DocumentUpload = ({ onUploadComplete }) => {
    const [uploadingFiles, setUploadingFiles] = useState([]);
    const [socket, setSocket] = useState(null);
    const [connectionError, setConnectionError] = useState(null);

    // Initialize socket connection
    React.useEffect(() => {
        const token = localStorage.getItem('token');
        if (!token) {
            setConnectionError('Not authenticated');
            return;
        }

        console.log('🔌 Connecting to socket server...');

        const newSocket = io('http://localhost:5000', {
            transports: ['websocket', 'polling'],
            timeout: 20000,
            forceNew: true
        });

        newSocket.on('connect', () => {
            console.log('✅ Socket connected:', newSocket.id);
            setSocket(newSocket);
            setConnectionError(null);
        });

        newSocket.on('connect_error', (error) => {
            console.error('❌ Socket connection failed:', error);
            setConnectionError('Failed to connect to processing server');
        });

        newSocket.on('processing_update', (data) => {
            console.log('📊 Processing update:', data);
            setUploadingFiles(prev => prev.map(file =>
                file.documentId === data.documentId
                    ? { ...file, progress: data.progress, stage: data.stage, message: data.message }
                    : file
            ));
        });

        newSocket.on('processing_complete', (data) => {
            console.log('✅ Processing complete:', data);
            setUploadingFiles(prev => prev.map(file =>
                file.documentId === data.documentId
                    ? { ...file, status: 'completed', progress: 100, message: 'Processing completed!' }
                    : file
            ));

            // Auto-remove completed files after 3 seconds
            setTimeout(() => {
                setUploadingFiles(prev => prev.filter(file => file.documentId !== data.documentId));
                if (onUploadComplete) {
                    onUploadComplete();
                }
            }, 3000);
        });

        newSocket.on('processing_error', (data) => {
            console.error('❌ Processing error:', data);
            setUploadingFiles(prev => prev.map(file =>
                file.documentId === data.documentId
                    ? { ...file, status: 'failed', message: `Error: ${data.error}` }
                    : file
            ));
        });

        setSocket(newSocket);

        return () => {
            console.log('🔌 Disconnecting socket...');
            newSocket.disconnect();
        };
    }, [onUploadComplete]);

    const onDrop = useCallback(async (acceptedFiles) => {
        const token = localStorage.getItem('token');
        if (!token) {
            setConnectionError('Please log in to upload documents');
            return;
        }

        if (!socket || !socket.connected) {
            setConnectionError('Not connected to processing server. Please try again.');
            return;
        }

        console.log(`📁 Files dropped: ${acceptedFiles.length}`);

        for (const file of acceptedFiles) {
            const fileId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

            // Add file to uploading list
            const newFile = {
                id: fileId,
                file: file,
                status: 'uploading',
                progress: 0,
                message: 'Preparing upload...',
                documentId: null
            };

            setUploadingFiles(prev => [...prev, newFile]);

            try {
                // Create form data
                const formData = new FormData();
                formData.append('document', file);
                formData.append('socketId', socket.id);

                console.log(`📤 Uploading ${file.name} with socket ID: ${socket.id}`);

                // Update status to uploading
                setUploadingFiles(prev => prev.map(f =>
                    f.id === fileId
                        ? { ...f, status: 'uploading', message: 'Uploading file...' }
                        : f
                ));

                // Upload file with auth
                const response = await api.post('/api/upload', formData, {
                    headers: {
                        'Content-Type': 'multipart/form-data',
                    },
                    onUploadProgress: (progressEvent) => {
                        const uploadProgress = Math.round(
                            (progressEvent.loaded * 100) / progressEvent.total
                        );

                        setUploadingFiles(prev => prev.map(f =>
                            f.id === fileId
                                ? {
                                    ...f,
                                    progress: Math.min(uploadProgress, 90), // Reserve 10% for processing start
                                    message: `Uploading... ${uploadProgress}%`
                                }
                                : f
                        ));
                    }
                });

                console.log('✅ Upload response:', response.data);

                // Update with document ID and start processing
                setUploadingFiles(prev => prev.map(f =>
                    f.id === fileId
                        ? {
                            ...f,
                            documentId: response.data.documentId,
                            status: 'processing',
                            progress: 95,
                            message: 'Upload complete, starting processing...'
                        }
                        : f
                ));

            } catch (error) {
                console.error(`❌ Upload failed for ${file.name}:`, error);

                const errorMessage = error.response?.data?.error ||
                    error.message ||
                    'Upload failed';

                setUploadingFiles(prev => prev.map(f =>
                    f.id === fileId
                        ? { ...f, status: 'failed', message: `Upload failed: ${errorMessage}` }
                        : f
                ));
            }
        }
    }, [socket]);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: {
            'application/pdf': ['.pdf'],
            'image/jpeg': ['.jpg', '.jpeg'],
            'image/png': ['.png'],
            'image/tiff': ['.tif', '.tiff']
        },
        maxFiles: 10,
        maxSize: 10 * 1024 * 1024 // 10MB
    });

    const removeFile = (fileId) => {
        setUploadingFiles(prev => prev.filter(f => f.id !== fileId));
    };

    const getFileIcon = (filename) => {
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

    const getStatusColor = (status) => {
        switch (status) {
            case 'completed': return 'success';
            case 'failed': return 'error';
            case 'processing': return 'warning';
            case 'uploading': return 'info';
            default: return 'default';
        }
    };

    const getStatusIcon = (status) => {
        switch (status) {
            case 'completed': return <CheckCircle color="success" />;
            case 'failed': return <ErrorIcon color="error" />;
            default: return null;
        }
    };

    return (
        <Box>
            {/* Connection Status */}
            {connectionError && (
                <Alert severity="error" sx={{ mb: 2 }}>
                    {connectionError}
                </Alert>
            )}

            {socket && socket.connected && (
                <Alert severity="success" sx={{ mb: 2 }}>
                    Connected to processing server
                </Alert>
            )}

            {/* Upload Area */}
            <Paper
                {...getRootProps()}
                sx={{
                    p: 4,
                    border: '2px dashed',
                    borderColor: isDragActive ? 'primary.main' : 'grey.300',
                    bgcolor: isDragActive ? 'primary.50' : 'background.paper',
                    cursor: 'pointer',
                    textAlign: 'center',
                    transition: 'all 0.3s ease',
                    '&:hover': {
                        borderColor: 'primary.main',
                        bgcolor: 'primary.50'
                    }
                }}
            >
                <input {...getInputProps()} />

                <CloudUpload sx={{ fontSize: 48, color: 'primary.main', mb: 2 }} />

                <Typography variant="h6" gutterBottom>
                    {isDragActive ? 'Drop files here' : 'Drop files here or click to browse'}
                </Typography>

                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    Supported formats: PDF, JPEG, PNG, TIFF (max 10MB each)
                </Typography>

                <Button variant="contained" component="span" disabled={!socket || !socket.connected}>
                    Select Files
                </Button>
            </Paper>

            {/* Upload Progress */}
            {uploadingFiles.length > 0 && (
                <Box sx={{ mt: 3 }}>
                    <Typography variant="h6" gutterBottom>
                        Processing Files ({uploadingFiles.length})
                    </Typography>

                    <List>
                        {uploadingFiles.map((file) => (
                            <ListItem key={file.id} sx={{ border: 1, borderColor: 'divider', borderRadius: 1, mb: 1 }}>
                                <ListItemIcon>
                                    {getFileIcon(file.file.name)}
                                </ListItemIcon>

                                <ListItemText
                                    primary={
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                            <Typography variant="body1" noWrap>
                                                {file.file.name}
                                            </Typography>
                                            <Chip
                                                label={file.status}
                                                color={getStatusColor(file.status)}
                                                size="small"
                                                icon={getStatusIcon(file.status)}
                                            />
                                        </Box>
                                    }
                                    secondary={
                                        <Box sx={{ mt: 1 }}>
                                            <Typography variant="body2" color="text.secondary">
                                                {file.message}
                                            </Typography>

                                            {(file.status === 'uploading' || file.status === 'processing') && (
                                                <LinearProgress
                                                    variant="determinate"
                                                    value={file.progress}
                                                    sx={{ mt: 1 }}
                                                    color={file.status === 'uploading' ? 'info' : 'warning'}
                                                />
                                            )}
                                        </Box>
                                    }
                                />

                                {(file.status === 'failed' || file.status === 'completed') && (
                                    <IconButton
                                        edge="end"
                                        onClick={() => removeFile(file.id)}
                                        size="small"
                                    >
                                        <Close />
                                    </IconButton>
                                )}
                            </ListItem>
                        ))}
                    </List>
                </Box>
            )}
        </Box>
    );
};

export default DocumentUpload;