// frontend/src/components/UserManagement/UserList.js
import React, { useState } from 'react';
import {
  Box,
  Button,
  Paper,
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  Alert,
  Chip,
  Container,
  Card,
  CardContent,
  Grid,
  IconButton,
  Tooltip,
  Menu,
  ListItemIcon,
  ListItemText
} from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';
import { 
  Add, 
  AdminPanelSettings, 
  Security, 
  Visibility,
  MoreVert,
  Edit,
  Block,
  CheckCircle,
  Delete,
  Email
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useAuth } from '../../contexts/AuthContext';

const UserList = () => {
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [anchorEl, setAnchorEl] = useState(null);
  const [menuUserId, setMenuUserId] = useState(null);
  const [formData, setFormData] = useState({
    email: '',
    firstName: '',
    lastName: '',
    role: 'viewer'
  });
  const [editFormData, setEditFormData] = useState({
    firstName: '',
    lastName: '',
    role: '',
    status: ''
  });

  const { hasPermission, user: currentUser } = useAuth();
  const queryClient = useQueryClient();

  // Fetch users
  const { 
    data: usersData, 
    isLoading, 
    error 
  } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const response = await axios.get('/users');
      return response.data;
    }
  });

  // Fetch user statistics
  const { data: userStats } = useQuery({
    queryKey: ['user-stats'],
    queryFn: async () => {
      const response = await axios.get('/users/stats/overview');
      return response.data;
    },
    enabled: hasPermission('user.read')
  });

  // Invite user mutation
  const inviteUserMutation = useMutation({
    mutationFn: (userData) => axios.post('/auth/invite', userData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['user-stats'] });
      setInviteDialogOpen(false);
      setFormData({ email: '', firstName: '', lastName: '', role: 'viewer' });
    },
    onError: (error) => {
      console.error('Failed to invite user:', error);
    }
  });

  // Update user mutation
  const updateUserMutation = useMutation({
    mutationFn: ({ id, ...userData }) => axios.put(`/users/${id}`, userData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setEditDialogOpen(false);
      setSelectedUser(null);
      handleCloseMenu();
    }
  });

  // Suspend user mutation
  const suspendUserMutation = useMutation({
    mutationFn: (userId) => axios.post(`/users/${userId}/suspend`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['user-stats'] });
      handleCloseMenu();
    }
  });

  // Reactivate user mutation
  const reactivateUserMutation = useMutation({
    mutationFn: (userId) => axios.post(`/users/${userId}/reactivate`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['user-stats'] });
      handleCloseMenu();
    }
  });

  const getRoleIcon = (role) => {
    switch (role) {
      case 'admin': return <AdminPanelSettings fontSize="small" />;
      case 'validator': return <Security fontSize="small" />;
      case 'viewer': return <Visibility fontSize="small" />;
      default: return null;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return 'success';
      case 'pending': return 'warning';
      case 'suspended': return 'error';
      case 'deleted': return 'default';
      default: return 'default';
    }
  };

  const getRoleColor = (role) => {
    switch (role) {
      case 'admin': return 'error';
      case 'validator': return 'warning';
      case 'viewer': return 'info';
      default: return 'default';
    }
  };

  const handleMenuOpen = (event, userId) => {
    setAnchorEl(event.currentTarget);
    setMenuUserId(userId);
  };

  const handleCloseMenu = () => {
    setAnchorEl(null);
    setMenuUserId(null);
  };

  const handleEditUser = (user) => {
    setSelectedUser(user);
    setEditFormData({
      firstName: user.first_name,
      lastName: user.last_name,
      role: user.role,
      status: user.status
    });
    setEditDialogOpen(true);
    handleCloseMenu();
  };

  const handleSuspendUser = (userId) => {
    if (window.confirm('Are you sure you want to suspend this user?')) {
      suspendUserMutation.mutate(userId);
    }
  };

  const handleReactivateUser = (userId) => {
    if (window.confirm('Are you sure you want to reactivate this user?')) {
      reactivateUserMutation.mutate(userId);
    }
  };

  const columns = [
    { 
      field: 'email', 
      headerName: 'Email', 
      flex: 1,
      minWidth: 200
    },
    { 
      field: 'name', 
      headerName: 'Name', 
      flex: 1,
      minWidth: 150,
      valueGetter: (value, row) => `${row.first_name || ''} ${row.last_name || ''}`.trim()
    },
    { 
      field: 'role', 
      headerName: 'Role', 
      width: 140,
      renderCell: (params) => (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          {getRoleIcon(params.value)}
          <Chip
            label={params.value}
            color={getRoleColor(params.value)}
            size="small"
            sx={{ textTransform: 'capitalize' }}
          />
        </Box>
      )
    },
    { 
      field: 'status', 
      headerName: 'Status', 
      width: 100,
      renderCell: (params) => (
        <Chip
          label={params.value}
          color={getStatusColor(params.value)}
          size="small"
          variant="outlined"
        />
      )
    },
    { 
      field: 'created_at', 
      headerName: 'Created', 
      width: 120,
      valueFormatter: (value) => new Date(value).toLocaleDateString()
    },
    { 
      field: 'last_login', 
      headerName: 'Last Login', 
      width: 140,
      valueFormatter: (value) => 
        value ? new Date(value).toLocaleDateString() : 'Never'
    },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 100,
      sortable: false,
      renderCell: (params) => (
        <Box>
          {hasPermission('user.update') && (
            <Tooltip title="More actions">
              <IconButton
                size="small"
                onClick={(e) => handleMenuOpen(e, params.row.id)}
              >
                <MoreVert fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
        </Box>
      )
    }
  ];

  const handleInviteSubmit = (e) => {
    e.preventDefault();
    inviteUserMutation.mutate(formData);
  };

  const handleEditSubmit = (e) => {
    e.preventDefault();
    updateUserMutation.mutate({ id: selectedUser.id, ...editFormData });
  };

  if (error) {
    return (
      <Container>
        <Alert severity="error">
          Failed to load users: {error.message}
        </Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      {/* Statistics Cards */}
      {userStats && (
        <Grid container spacing={3} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom variant="body2">
                  Total Users
                </Typography>
                <Typography variant="h4">
                  {userStats.total_users}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom variant="body2">
                  Active Users
                </Typography>
                <Typography variant="h4" color="success.main">
                  {userStats.active_users}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom variant="body2">
                  Pending Users
                </Typography>
                <Typography variant="h4" color="warning.main">
                  {userStats.pending_users}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom variant="body2">
                  Active Last 30 Days
                </Typography>
                <Typography variant="h4" color="info.main">
                  {userStats.active_last_30_days}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">User Management</Typography>
        {hasPermission('user.invite') && (
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={() => setInviteDialogOpen(true)}
          >
            Invite User
          </Button>
        )}
      </Box>

      <Paper sx={{ height: 500, width: '100%' }}>
        <DataGrid
          rows={usersData?.users || []}
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
        />
      </Paper>

      {/* Actions Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleCloseMenu}
      >
        {hasPermission('user.update') && (
          <MenuItem onClick={() => {
            const user = usersData?.users.find(u => u.id === menuUserId);
            if (user) handleEditUser(user);
          }}>
            <ListItemIcon>
              <Edit fontSize="small" />
            </ListItemIcon>
            <ListItemText>Edit User</ListItemText>
          </MenuItem>
        )}
        
        {hasPermission('user.update') && menuUserId !== currentUser?.id && (
          <>
            {usersData?.users.find(u => u.id === menuUserId)?.status === 'active' ? (
              <MenuItem onClick={() => handleSuspendUser(menuUserId)}>
                <ListItemIcon>
                  <Block fontSize="small" />
                </ListItemIcon>
                <ListItemText>Suspend User</ListItemText>
              </MenuItem>
            ) : (
              <MenuItem onClick={() => handleReactivateUser(menuUserId)}>
                <ListItemIcon>
                  <CheckCircle fontSize="small" />
                </ListItemIcon>
                <ListItemText>Reactivate User</ListItemText>
              </MenuItem>
            )}
          </>
        )}
      </Menu>

      {/* Invite User Dialog */}
      <Dialog open={inviteDialogOpen} onClose={() => setInviteDialogOpen(false)} maxWidth="sm" fullWidth>
        <form onSubmit={handleInviteSubmit}>
          <DialogTitle>Invite New User</DialogTitle>
          <DialogContent>
            {inviteUserMutation.error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {inviteUserMutation.error.response?.data?.error || 'Failed to send invitation'}
              </Alert>
            )}
            
            <TextField
              autoFocus
              margin="dense"
              label="Email"
              type="email"
              fullWidth
              required
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            />
            
            <TextField
              margin="dense"
              label="First Name"
              fullWidth
              required
              value={formData.firstName}
              onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
            />
            
            <TextField
              margin="dense"
              label="Last Name"
              fullWidth
              required
              value={formData.lastName}
              onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
            />
            
            <FormControl fullWidth margin="dense">
              <InputLabel>Role</InputLabel>
              <Select
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                label="Role"
              >
                <MenuItem value="viewer">Viewer</MenuItem>
                <MenuItem value="validator">Validator</MenuItem>
                <MenuItem value="admin">Admin</MenuItem>
              </Select>
            </FormControl>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setInviteDialogOpen(false)}>Cancel</Button>
            <Button 
              type="submit" 
              variant="contained" 
              disabled={inviteUserMutation.isPending}
            >
              {inviteUserMutation.isPending ? 'Sending...' : 'Send Invitation'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} maxWidth="sm" fullWidth>
        <form onSubmit={handleEditSubmit}>
          <DialogTitle>Edit User</DialogTitle>
          <DialogContent>
            {updateUserMutation.error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {updateUserMutation.error.response?.data?.error || 'Failed to update user'}
              </Alert>
            )}
            
            <TextField
              margin="dense"
              label="First Name"
              fullWidth
              value={editFormData.firstName}
              onChange={(e) => setEditFormData({ ...editFormData, firstName: e.target.value })}
            />
            
            <TextField
              margin="dense"
              label="Last Name"
              fullWidth
              value={editFormData.lastName}
              onChange={(e) => setEditFormData({ ...editFormData, lastName: e.target.value })}
            />
            
            <FormControl fullWidth margin="dense">
              <InputLabel>Role</InputLabel>
              <Select
                value={editFormData.role}
                onChange={(e) => setEditFormData({ ...editFormData, role: e.target.value })}
                label="Role"
              >
                <MenuItem value="viewer">Viewer</MenuItem>
                <MenuItem value="validator">Validator</MenuItem>
                <MenuItem value="admin">Admin</MenuItem>
              </Select>
            </FormControl>

            <FormControl fullWidth margin="dense">
              <InputLabel>Status</InputLabel>
              <Select
                value={editFormData.status}
                onChange={(e) => setEditFormData({ ...editFormData, status: e.target.value })}
                label="Status"
              >
                <MenuItem value="active">Active</MenuItem>
                <MenuItem value="suspended">Suspended</MenuItem>
              </Select>
            </FormControl>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setEditDialogOpen(false)}>Cancel</Button>
            <Button 
              type="submit" 
              variant="contained" 
              disabled={updateUserMutation.isPending}
            >
              {updateUserMutation.isPending ? 'Updating...' : 'Update User'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </Container>
  );
};

export default UserList;