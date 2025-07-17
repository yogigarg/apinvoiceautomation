// Enhanced PDF Viewer Component with zoom controls and full screen usage
import React, { useState, useEffect } from 'react';
import {
    Box,
    Button,
    Typography,
    Toolbar,
    Paper,
    Alert,
    CircularProgress,
    Card,
    CardContent,
    IconButton,
    Slider
} from '@mui/material';
import {
    OpenInNew,
    Download,
    PictureAsPdf,
    Visibility,
    Warning,
    ZoomIn,
    ZoomOut,
    Fullscreen,
    FullscreenExit,
    FitScreen
} from '@mui/icons-material';

const SimplePDFViewer = ({ documentUrl, filename }) => {
    const [viewStrategy, setViewStrategy] = useState('object');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [zoom, setZoom] = useState(100);
    const [isFullscreen, setIsFullscreen] = useState(false);

    useEffect(() => {
        if (documentUrl) {
            testPDFAccess();
        }
    }, [documentUrl]);

    const testPDFAccess = async () => {
        try {
            const response = await fetch(documentUrl, { method: 'HEAD' });
            if (response.ok) {
                setLoading(false);
                setError(null);
            } else {
                throw new Error('PDF not accessible');
            }
        } catch (err) {
            console.warn('PDF access test failed:', err);
            setLoading(false);
            setError('PDF access limited');
        }
    };

    const downloadPDF = () => {
        const link = document.createElement('a');
        link.href = documentUrl;
        link.download = filename || 'document.pdf';
        link.click();
    };

    const openInNewTab = () => {
        window.open(documentUrl, '_blank', 'noopener,noreferrer');
    };

    const handleZoomIn = () => {
        setZoom(prev => Math.min(prev + 25, 300));
    };

    const handleZoomOut = () => {
        setZoom(prev => Math.max(prev - 25, 50));
    };

    const handleFitToScreen = () => {
        setZoom(100);
    };

    const handleZoomChange = (event, newValue) => {
        setZoom(newValue);
    };

    const toggleFullscreen = () => {
        setIsFullscreen(!isFullscreen);
    };

    if (!documentUrl) {
        return (
            <Box
                sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: '100%',
                    color: 'text.secondary'
                }}
            >
                <CircularProgress size={40} sx={{ mb: 2 }} />
                <Typography variant="body1">Loading PDF...</Typography>
            </Box>
        );
    };

    const renderPDFViewer = () => {
        if (loading) {
            return (
                <Box
                    sx={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        height: '100%'
                    }}
                >
                    <CircularProgress size={40} sx={{ mb: 2 }} />
                    <Typography variant="body1">Loading PDF...</Typography>
                </Box>
            );
        }

        // Enhanced object tag with zoom
        if (viewStrategy === 'object') {
            return (
                <Box
                    sx={{
                        width: '100%',
                        height: '100%',
                        overflow: 'auto',
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'flex-start',
                        bgcolor: 'grey.100',
                        p: 1
                    }}
                >
                    <Box
                        sx={{
                            width: `${zoom}%`,
                            height: `${zoom}%`,
                            minWidth: '100%',
                            minHeight: '100%',
                            transform: zoom !== 100 ? `scale(${zoom / 100})` : 'none',
                            transformOrigin: 'top center'
                        }}
                    >
                        <object
                            data={documentUrl}
                            type="application/pdf"
                            style={{
                                width: '100%',
                                height: '100%',
                                border: 'none',
                                display: 'block'
                            }}
                            onLoad={() => setError(null)}
                            onError={() => setViewStrategy('embed')}
                        >
                            <Typography>Loading PDF...</Typography>
                        </object>
                    </Box>
                </Box>
            );
        }

        // Strategy 2: Embed tag with zoom
        if (viewStrategy === 'embed') {
            return (
                <Box
                    sx={{
                        width: '100%',
                        height: '100%',
                        overflow: 'auto',
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'flex-start',
                        bgcolor: 'grey.100',
                        p: 1
                    }}
                >
                    <Box
                        sx={{
                            width: `${zoom}%`,
                            height: `${zoom}%`,
                            minWidth: '100%',
                            minHeight: '100%'
                        }}
                    >
                        <embed
                            src={documentUrl}
                            type="application/pdf"
                            style={{
                                width: '100%',
                                height: '100%',
                                border: 'none'
                            }}
                            onError={() => setViewStrategy('iframe')}
                        />
                    </Box>
                </Box>
            );
        }

        // Strategy 3: IFrame with zoom
        if (viewStrategy === 'iframe') {
            return (
                <Box
                    sx={{
                        width: '100%',
                        height: '100%',
                        overflow: 'auto',
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'flex-start',
                        bgcolor: 'grey.100',
                        p: 1
                    }}
                >
                    <Box
                        sx={{
                            width: `${zoom}%`,
                            height: `${zoom}%`,
                            minWidth: '100%',
                            minHeight: '100%'
                        }}
                    >
                        <iframe
                            src={documentUrl}
                            style={{
                                width: '100%',
                                height: '100%',
                                border: 'none'
                            }}
                            title="PDF Document"
                            onError={() => setViewStrategy('fallback')}
                        />
                    </Box>
                </Box>
            );
        }

        // Strategy 4: Fallback UI
        return (
            <Box
                sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: '100%',
                    p: 3,
                    color: 'text.secondary',
                    bgcolor: 'grey.50'
                }}
            >
                <Card sx={{ maxWidth: 500, textAlign: 'center' }}>
                    <CardContent>
                        <PictureAsPdf sx={{ fontSize: 100, mb: 2, color: 'primary.main' }} />
                        <Typography variant="h5" gutterBottom>
                            PDF Document Ready
                        </Typography>
                        <Typography variant="body1" sx={{ mb: 3, color: 'text.secondary' }}>
                            {filename}
                        </Typography>
                        
                        {error && (
                            <Alert severity="info" sx={{ mb: 3, textAlign: 'left' }}>
                                <Typography variant="body2">
                                    Direct PDF preview is not available due to browser security settings, 
                                    but you can view the document using the options below.
                                </Typography>
                            </Alert>
                        )}
                        
                        <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap' }}>
                            <Button
                                variant="contained"
                                size="large"
                                startIcon={<OpenInNew />}
                                onClick={openInNewTab}
                            >
                                Open in New Tab
                            </Button>
                            <Button
                                variant="outlined"
                                size="large"
                                startIcon={<Download />}
                                onClick={downloadPDF}
                            >
                                Download PDF
                            </Button>
                        </Box>
                        
                        <Typography variant="caption" sx={{ mt: 2, display: 'block', color: 'text.secondary' }}>
                            Opening in a new tab provides the best viewing experience with full zoom controls
                        </Typography>
                    </CardContent>
                </Card>
            </Box>
        );
    };

    return (
        <Box 
            sx={{ 
                height: '100%', 
                display: 'flex', 
                flexDirection: 'column',
                position: isFullscreen ? 'fixed' : 'relative',
                top: isFullscreen ? 0 : 'auto',
                left: isFullscreen ? 0 : 'auto',
                right: isFullscreen ? 0 : 'auto',
                bottom: isFullscreen ? 0 : 'auto',
                zIndex: isFullscreen ? 9999 : 'auto',
                bgcolor: isFullscreen ? 'white' : 'transparent'
            }}
        >
            {/* Enhanced PDF Controls */}
            <Paper elevation={0} sx={{ borderBottom: 1, borderColor: 'divider' }}>
                <Toolbar variant="dense" sx={{ justifyContent: 'space-between', minHeight: 56, px: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <PictureAsPdf sx={{ mr: 1, color: 'error.main' }} />
                        <Typography variant="subtitle2" sx={{ color: 'text.secondary', maxWidth: 200 }} noWrap>
                            {filename}
                        </Typography>
                        {error && (
                            <Warning sx={{ ml: 1, fontSize: 16, color: 'warning.main' }} />
                        )}
                    </Box>

                    {/* Zoom Controls */}
                    {viewStrategy !== 'fallback' && (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mx: 2 }}>
                            <IconButton size="small" onClick={handleZoomOut} disabled={zoom <= 50}>
                                <ZoomOut />
                            </IconButton>
                            
                            <Box sx={{ minWidth: 120, mx: 1 }}>
                                <Slider
                                    value={zoom}
                                    onChange={handleZoomChange}
                                    min={50}
                                    max={300}
                                    step={25}
                                    size="small"
                                    valueLabelDisplay="auto"
                                    valueLabelFormat={(value) => `${value}%`}
                                />
                            </Box>
                            
                            <IconButton size="small" onClick={handleZoomIn} disabled={zoom >= 300}>
                                <ZoomIn />
                            </IconButton>
                            
                            <IconButton size="small" onClick={handleFitToScreen} title="Fit to Screen">
                                <FitScreen />
                            </IconButton>
                            
                            <Typography variant="caption" sx={{ minWidth: 40, textAlign: 'center' }}>
                                {zoom}%
                            </Typography>
                        </Box>
                    )}

                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <IconButton 
                            size="small" 
                            onClick={toggleFullscreen}
                            title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
                        >
                            {isFullscreen ? <FullscreenExit /> : <Fullscreen />}
                        </IconButton>
                        
                        <Button
                            size="small"
                            startIcon={<Visibility />}
                            onClick={openInNewTab}
                            variant="contained"
                        >
                            View
                        </Button>
                        <Button
                            size="small"
                            startIcon={<Download />}
                            onClick={downloadPDF}
                            variant="outlined"
                        >
                            Download
                        </Button>
                    </Box>
                </Toolbar>
            </Paper>

            {/* PDF Content */}
            <Box sx={{ flexGrow: 1, position: 'relative', overflow: 'hidden' }}>
                {renderPDFViewer()}
            </Box>
        </Box>
    );
};

export default SimplePDFViewer;