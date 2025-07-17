// src/components/DocumentProcessing/SampleInvoices.js
import React, { useState } from 'react';
import {
  Container,
  Typography,
  Grid,
  Card,
  CardContent,
  CardActions,
  Button,
  Box,
  Chip,
  Paper,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  LinearProgress
} from '@mui/material';
import {
  Description,
  GetApp,
  PlayArrow,
  CheckCircle,
  Info,
  Business,
  Receipt,
  Assignment,
  TrendingUp
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import DocumentUpload from './DocumentUpload';

const SampleInvoices = () => {
  const [processingDialogOpen, setProcessingDialogOpen] = useState(false);
  const [selectedSample, setSelectedSample] = useState(null);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Fetch sample invoices
  const { data: sampleInvoices, isLoading } = useQuery({
    queryKey: ['sample-invoices'],
    queryFn: async () => {
      const response = await axios.get('/api/sample-invoices');
      return response.data;
    }
  });

  // Fetch onboarding progress
  const { data: onboardingProgress } = useQuery({
    queryKey: ['onboarding-progress'],
    queryFn: async () => {
      const response = await axios.get('/api/onboarding/progress');
      return response.data;
    }
  });

  // Process sample mutation
  const processSampleMutation = useMutation({
    mutationFn: async (sampleId) => {
      // In a real implementation, this would trigger processing of a sample invoice
      // For now, we'll simulate the process
      const response = await axios.post('/api/process-sample', { sampleId });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      queryClient.invalidateQueries({ queryKey: ['onboarding-progress'] });
      setProcessingDialogOpen(false);
    }
  });

  const sampleData = [
    {
      id: 'sample-1',
      name: 'Tech Services Invoice',
      description: 'A typical technology services invoice with multiple line items',
      category: 'Services',
      features: ['Multiple line items', 'Tax calculations', 'Professional services'],
      estimatedProcessingTime: '15-30 seconds',
      complexity: 'Medium',
      icon: <Business sx={{ fontSize: 40 }} />,
      color: '#1976d2'
    },
    {
      id: 'sample-2',
      name: 'Office Supplies Invoice',
      description: 'Simple office supplies purchase invoice',
      category: 'Products',
      features: ['Product listings', 'Quantities', 'Unit prices'],
      estimatedProcessingTime: '10-20 seconds',
      complexity: 'Low',
      icon: <Receipt sx={{ fontSize: 40 }} />,
      color: '#388e3c'
    },
    {
      id: 'sample-3',
      name: 'Consulting Invoice',
      description: 'Professional consulting invoice with hourly rates',
      category: 'Consulting',
      features: ['Hourly billing', 'Project details', 'Terms & conditions'],
      estimatedProcessingTime: '20-35 seconds',
      complexity: 'High',
      icon: <Assignment sx={{ fontSize: 40 }} />,
      color: '#f57c00'
    }
  ];

  const getComplexityColor = (complexity) => {
    switch (complexity) {
      case 'Low': return 'success';
      case 'Medium': return 'warning';
      case 'High': return 'error';
      default: return 'default';
    }
  };

  const handleProcessSample = (sample) => {
    setSelectedSample(sample);
    setProcessingDialogOpen(true);
    // processSampleMutation.mutate(sample.id);
  };

  const handleDownloadSample = (sample) => {
    // In a real implementation, this would download the sample file
    console.log('Downloading sample:', sample.name);
    alert(`Downloading ${sample.name} sample invoice...`);
  };

  if (isLoading) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <LinearProgress />
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      {/* Header */}
      <Box sx={{ textAlign: 'center', mb: 4 }}>
        <Typography variant="h3" gutterBottom>
          📄 Sample Invoices
        </Typography>
        <Typography variant="h6" color="text.secondary" paragraph>
          Try our sample invoices to see how document processing works
        </Typography>
      </Box>

      {/* Onboarding Status */}
      {onboardingProgress && (
        <Paper sx={{ p: 3, mb: 4, bgcolor: 'primary.light', color: 'primary.contrastText' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <Info sx={{ mr: 1 }} />
            <Typography variant="h6">
              Onboarding Progress
            </Typography>
          </Box>
          <Typography variant="body1" paragraph>
            Documents processed: {onboardingProgress.documentsProcessed}/1
          </Typography>
          {onboardingProgress.onboardingComplete ? (
            <Alert severity="success" sx={{ mt: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <CheckCircle sx={{ mr: 1 }} />
                <Typography>
                  🎉 Onboarding complete! You can now process your own documents.
                </Typography>
              </Box>
            </Alert>
          ) : (
            <Alert severity="info" sx={{ mt: 2 }}>
              <Typography>
                Process any sample invoice below to complete your onboarding.
              </Typography>
            </Alert>
          )}
        </Paper>
      )}

      {/* Instructions */}
      <Paper sx={{ p: 3, mb: 4 }}>
        <Typography variant="h5" gutterBottom>
          How It Works
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} md={4}>
            <Box sx={{ textAlign: 'center', p: 2 }}>
              <Box sx={{ 
                bgcolor: 'primary.main', 
                color: 'white', 
                borderRadius: '50%', 
                width: 48, 
                height: 48, 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                mx: 'auto',
                mb: 2
              }}>
                1
              </Box>
              <Typography variant="h6" gutterBottom>
                Choose a Sample
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Select one of our sample invoices below based on your industry or use case.
              </Typography>
            </Box>
          </Grid>
          <Grid item xs={12} md={4}>
            <Box sx={{ textAlign: 'center', p: 2 }}>
              <Box sx={{ 
                bgcolor: 'secondary.main', 
                color: 'white', 
                borderRadius: '50%', 
                width: 48, 
                height: 48, 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                mx: 'auto',
                mb: 2
              }}>
                2
              </Box>
              <Typography variant="h6" gutterBottom>
                Process & Analyze
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Watch as our OCR technology extracts text and identifies key invoice data in real-time.
              </Typography>
            </Box>
          </Grid>
          <Grid item xs={12} md={4}>
            <Box sx={{ textAlign: 'center', p: 2 }}>
              <Box sx={{ 
                bgcolor: 'success.main', 
                color: 'white', 
                borderRadius: '50%', 
                width: 48, 
                height: 48, 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                mx: 'auto',
                mb: 2
              }}>
                3
              </Box>
              <Typography variant="h6" gutterBottom>
                Review Results
              </Typography>
              <Typography variant="body2" color="text.secondary">
                See the extracted data, confidence scores, and learn how to integrate with your workflow.
              </Typography>
            </Box>
          </Grid>
        </Grid>
      </Paper>

      {/* Sample Invoice Cards */}
      <Typography variant="h5" gutterBottom sx={{ mb: 3 }}>
        Sample Invoices
      </Typography>
      
      <Grid container spacing={3}>
        {sampleData.map((sample) => (
          <Grid item xs={12} md={6} lg={4} key={sample.id}>
            <Card 
              sx={{ 
                height: '100%', 
                display: 'flex', 
                flexDirection: 'column',
                transition: 'transform 0.2s, box-shadow 0.2s',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: 4
                }
              }}
            >
              <CardContent sx={{ flexGrow: 1 }}>
                {/* Header */}
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <Box sx={{ 
                    p: 1, 
                    borderRadius: 1, 
                    bgcolor: sample.color, 
                    color: 'white',
                    mr: 2
                  }}>
                    {sample.icon}
                  </Box>
                  <Box>
                    <Typography variant="h6" component="div">
                      {sample.name}
                    </Typography>
                    <Chip 
                      label={sample.category} 
                      size="small" 
                      sx={{ bgcolor: `${sample.color}20`, color: sample.color }}
                    />
                  </Box>
                </Box>

                {/* Description */}
                <Typography variant="body2" color="text.secondary" paragraph>
                  {sample.description}
                </Typography>

                {/* Features */}
                <Typography variant="subtitle2" gutterBottom>
                  Key Features:
                </Typography>
                <Box sx={{ mb: 2 }}>
                  {sample.features.map((feature, index) => (
                    <Chip 
                      key={index}
                      label={feature} 
                      size="small" 
                      variant="outlined"
                      sx={{ mr: 0.5, mb: 0.5 }}
                    />
                  ))}
                </Box>

                {/* Metadata */}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 2 }}>
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Complexity:
                    </Typography>
                    <Chip 
                      label={sample.complexity} 
                      color={getComplexityColor(sample.complexity)}
                      size="small"
                      sx={{ ml: 1 }}
                    />
                  </Box>
                  <Typography variant="caption" color="text.secondary">
                    {sample.estimatedProcessingTime}
                  </Typography>
                </Box>
              </CardContent>
              
              <CardActions sx={{ p: 2, pt: 0 }}>
                <Button
                  fullWidth
                  variant="contained"
                  startIcon={<PlayArrow />}
                  onClick={() => handleProcessSample(sample)}
                  sx={{ 
                    bgcolor: sample.color,
                    '&:hover': { bgcolor: sample.color, opacity: 0.9 }
                  }}
                >
                  Process Sample
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<GetApp />}
                  onClick={() => handleDownloadSample(sample)}
                  sx={{ ml: 1 }}
                >
                  Download
                </Button>
              </CardActions>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Custom Upload Section */}
      <Paper sx={{ p: 4, mt: 4, textAlign: 'center' }}>
        <Typography variant="h5" gutterBottom>
          Ready to Process Your Own Documents?
        </Typography>
        <Typography variant="body1" color="text.secondary" paragraph>
          Once you've tried a sample invoice, you can upload your own documents for processing.
        </Typography>
        <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Button
            variant="contained"
            size="large"
            onClick={() => navigate('/documents')}
            startIcon={<TrendingUp />}
          >
            View All Documents
          </Button>
          <Button
            variant="outlined"
            size="large"
            onClick={() => navigate('/dashboard')}
          >
            Back to Dashboard
          </Button>
        </Box>
      </Paper>

      {/* Processing Dialog */}
      <Dialog
        open={processingDialogOpen}
        onClose={() => setProcessingDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          Process Sample Invoice
        </DialogTitle>
        <DialogContent>
          {selectedSample && (
            <Box>
              <Typography variant="h6" gutterBottom>
                {selectedSample.name}
              </Typography>
              <Typography variant="body2" color="text.secondary" paragraph>
                This will demonstrate the complete document processing workflow using our sample invoice.
              </Typography>
              
              <DocumentUpload 
                onUploadComplete={() => {
                  setProcessingDialogOpen(false);
                  navigate('/documents');
                }}
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setProcessingDialogOpen(false)}>
            Cancel
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default SampleInvoices;