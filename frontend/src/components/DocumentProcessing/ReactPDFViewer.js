// Alternative PDF Viewer Component using react-pdf library with fixed imports
// First install: npm install react-pdf

import React, { useState } from 'react';
import {
    Box,
    Button,
    Typography,
    IconButton,
    Toolbar,
    Paper,
    CircularProgress
} from '@mui/material';
import {
    ZoomIn,
    ZoomOut,
    NavigateBefore,
    NavigateNext,
    OpenInNew,
    Download,
    PictureAsPdf
} from '@mui/icons-material';

// Dynamic import to handle loading issues
let Document, Page, pdfjs;

const loadPDFJS = async () => {
    try {
        const reactPdf = await import('react-pdf');
        Document = reactPdf.Document;
        Page = reactPdf.Page;
        pdfjs = reactPdf.pdfjs;

        // Set up the worker
        pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.js`;

        return true;
    } catch (error) {
        console.error('Failed to load react-pdf:', error);
        return false;
    }
};

const ReactPDFViewer = ({ documentUrl, filename }) => {
    const [numPages, setNumPages] = useState(null);
    const [pageNumber, setPageNumber] = useState(1);
    const [scale, setScale] = useState(1.0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [pdfLoaded, setPdfLoaded] = useState(false);

    React.useEffect(() => {
        const initPDF = async () => {
            const loaded = await loadPDFJS();
            setPdfLoaded(loaded);
            if (!loaded) {
                setError('Failed to load PDF library');
                setLoading(false);
            }
        };
        initPDF();
    }, []);

    const onDocumentLoadSuccess = ({ numPages }) => {
        setNumPages(numPages);
        setLoading(false);
        setError(null);
    };

    const onDocumentLoadError = (error) => {
        console.error('PDF load error:', error);
        setError('Failed to load PDF document');
        setLoading(false);
    };

    const goToPrevPage = () => {
        setPageNumber(pageNumber - 1 <= 1 ? 1 : pageNumber - 1);
    };

    const goToNextPage = () => {
        setPageNumber(pageNumber + 1 >= numPages ? numPages : pageNumber + 1);
    };

    const zoomIn = () => {
        setScale(scale * 1.2);
    };

    const zoomOut = () => {
        setScale(scale / 1.2);
    };

    const downloadPDF = () => {
        const link = document.createElement('a');
        link.href = documentUrl;
        link.download = filename || 'document.pdf';
        link.click();
    };

    if (!pdfLoaded || error) {
        return (
            <Box
                sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: '100%',
                    p: 3,
                    color: 'text.secondary'
                }}
            >
                <PictureAsPdf sx={{ fontSize: 80, mb: 2, color: error ? 'error.main' : 'primary.main' }} />
                <Typography variant="h6" gutterBottom color={error ? 'error' : 'primary'}>
                    {error || 'Loading PDF Viewer...'}
                </Typography>
                <Typography variant="body2" sx={{ mb: 2, textAlign: 'center' }}>
                    {error ? 'You can still view the PDF by opening it in a new tab.' : 'Please wait while we load the PDF viewer...'}
                </Typography>
                <Button
                    variant="contained"
                    startIcon={<OpenInNew />}
                    onClick={() => window.open(documentUrl, '_blank')}
                >
                    Open PDF in New Tab
                </Button>
            </Box>
        );
    }

    return (
        <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            {/* PDF Controls */}
            <Paper elevation={0} sx={{ borderBottom: 1, borderColor: 'divider' }}>
                <Toolbar variant="dense" sx={{ justifyContent: 'space-between', minHeight: 48 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <IconButton
                            onClick={goToPrevPage}
                            disabled={pageNumber <= 1 || loading}
                            size="small"
                        >
                            <NavigateBefore />
                        </IconButton>

                        <Typography variant="body2" sx={{ mx: 1 }}>
                            Page {pageNumber} of {numPages || '?'}
                        </Typography>

                        <IconButton
                            onClick={goToNextPage}
                            disabled={pageNumber >= numPages || loading}
                            size="small"
                        >
                            <NavigateNext />
                        </IconButton>
                    </Box>

                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <IconButton onClick={zoomOut} disabled={loading} size="small">
                            <ZoomOut />
                        </IconButton>

                        <Typography variant="body2" sx={{ mx: 1 }}>
                            {Math.round(scale * 100)}%
                        </Typography>

                        <IconButton onClick={zoomIn} disabled={loading} size="small">
                            <ZoomIn />
                        </IconButton>

                        <Button
                            size="small"
                            startIcon={<Download />}
                            onClick={downloadPDF}
                            variant="outlined"
                        >
                            Download
                        </Button>

                        <Button
                            size="small"
                            startIcon={<OpenInNew />}
                            onClick={() => window.open(documentUrl, '_blank')}
                            variant="outlined"
                        >
                            Open
                        </Button>
                    </Box>
                </Toolbar>
            </Paper>

            {/* PDF Content */}
            <Box
                sx={{
                    flexGrow: 1,
                    overflow: 'auto',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: loading ? 'center' : 'flex-start',
                    p: 2,
                    bgcolor: 'grey.100'
                }}
            >
                {loading && (
                    <Box sx={{ textAlign: 'center' }}>
                        <CircularProgress size={40} sx={{ mb: 2 }} />
                        <Typography variant="body1">Loading PDF...</Typography>
                    </Box>
                )}

                {Document && (
                    <Document
                        file={documentUrl}
                        onLoadSuccess={onDocumentLoadSuccess}
                        onLoadError={onDocumentLoadError}
                        loading=""
                        error=""
                    >
                        <Page
                            pageNumber={pageNumber}
                            scale={scale}
                            renderTextLayer={false}
                            renderAnnotationLayer={false}
                        />
                    </Document>
                )}
            </Box>
        </Box>
    );
};

export default ReactPDFViewer;