// frontend/src/contexts/AuthContext.js - Fixed for Enhanced ML Server
import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const AuthContext = createContext();

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};

// Configure axios defaults
axios.defaults.baseURL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (token) {
            axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
            fetchUserProfile();
        } else {
            setLoading(false);
        }
    }, []);

    const fetchUserProfile = async () => {
        try {
            const token = localStorage.getItem('token');
            if (!token) {
                setLoading(false);
                return;
            }

            // Fixed endpoint - matches enhanced server
            const response = await axios.get('/users/profile', {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            });

            setUser(response.data);
        } catch (error) {
            console.error('Failed to fetch user profile:', error);

            // If 403 or 401, clear the token and logout
            if (error.response?.status === 403 || error.response?.status === 401) {
                localStorage.removeItem('token');
                delete axios.defaults.headers.common['Authorization'];
                setUser(null);
            }
        } finally {
            setLoading(false);
        }
    };

    const login = async (email, password) => {
        try {
            // Fixed endpoint - matches enhanced server
            const response = await axios.post('/auth/login', { email, password });
            const { token, user: userData } = response.data;

            if (token) {
                localStorage.setItem('token', token);
                axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;

                // Set user data from login response
                setUser({
                    id: userData.id,
                    email: userData.email,
                    firstName: userData.firstName,
                    lastName: userData.lastName,
                    role: userData.role,
                    status: userData.status || 'active',
                    companyId: userData.companyId,
                    company: userData.company,
                    subscriptionType: userData.subscriptionType
                });

                return { success: true };
            }
        } catch (error) {
            console.error('Login failed:', error);
            return {
                success: false,
                error: error.response?.data?.error || 'Login failed'
            };
        }
    };

    const register = async (userData) => {
        try {
            // Fixed endpoint - matches enhanced server
            const response = await axios.post('/register', userData);
            const { token, user: newUser } = response.data;

            if (token) {
                localStorage.setItem('token', token);
                axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;

                // Set user data from registration response
                setUser({
                    id: newUser.id,
                    email: newUser.email,
                    firstName: newUser.firstName,
                    lastName: newUser.lastName,
                    role: newUser.role,
                    status: newUser.status
                });

                return { success: true };
            }
        } catch (error) {
            console.error('Registration failed:', error);
            return {
                success: false,
                error: error.response?.data?.error || 'Registration failed'
            };
        }
    };

    const verifyEmail = async (token) => {
        try {
            // Fixed endpoint - matches enhanced server
            const response = await axios.post('/verify-email', { token });
            const { token: authToken, user: userData } = response.data;

            if (authToken) {
                localStorage.setItem('token', authToken);
                axios.defaults.headers.common['Authorization'] = `Bearer ${authToken}`;

                setUser({
                    id: userData.id,
                    email: userData.email,
                    firstName: userData.firstName,
                    lastName: userData.lastName,
                    role: userData.role,
                    status: userData.status
                });

                return { success: true };
            }
        } catch (error) {
            console.error('Email verification failed:', error);
            return {
                success: false,
                error: error.response?.data?.error || 'Email verification failed'
            };
        }
    };

    const logout = () => {
        localStorage.removeItem('token');
        delete axios.defaults.headers.common['Authorization'];
        setUser(null);
    };

    const acceptInvitation = async (token, password) => {
        try {
            // This endpoint might not exist in the enhanced server yet
            const response = await axios.post('/auth/accept-invitation', { token, password });
            const { token: authToken, user: userData } = response.data;

            localStorage.setItem('token', authToken);
            axios.defaults.headers.common['Authorization'] = `Bearer ${authToken}`;
            setUser(userData);

            return { success: true };
        } catch (error) {
            console.error('Accept invitation failed:', error);
            return {
                success: false,
                error: error.response?.data?.error || 'Failed to accept invitation'
            };
        }
    };

    const updateProfile = async (profileData) => {
        try {
            // Fixed endpoint - matches enhanced server
            await axios.put('/users/profile', profileData);
            await fetchUserProfile(); // Refresh user data
            return { success: true };
        } catch (error) {
            console.error('Update profile failed:', error);
            return {
                success: false,
                error: error.response?.data?.error || 'Failed to update profile'
            };
        }
    };

    // Enhanced permission checking
    const hasPermission = (permission) => {
        if (!user) return false;

        const rolePermissions = {
            admin: [
                'user.create', 'user.read', 'user.update', 'user.delete', 'user.invite',
                'business_entity.read', 'business_entity.create', 'business_entity.update', 'business_entity.delete',
                'audit.read', 'document.read', 'document.create', 'document.delete',
                'analytics.read'
            ],
            validator: [
                'user.read', 'business_entity.read', 'document.read', 'analytics.read'
            ],
            viewer: [
                'user.read', 'business_entity.read', 'document.read'
            ]
        };

        return rolePermissions[user.role]?.includes(permission) || false;
    };

    // Helper function to check password strength
    const checkPasswordStrength = async (password) => {
        try {
            const response = await axios.post('/check-password-strength', { password });
            return response.data;
        } catch (error) {
            console.error('Password strength check failed:', error);
            return { isValid: false, error: 'Failed to check password strength' };
        }
    };

    // Helper function for localhost email verification bypass
    const manualVerifyUser = async (email) => {
        try {
            const response = await axios.post('/localhost/verify-user', { email });
            return { success: true, message: response.data.message };
        } catch (error) {
            console.error('Manual verification failed:', error);
            return {
                success: false,
                error: error.response?.data?.error || 'Manual verification failed'
            };
        }
    };

    // Enhanced value object with additional helpers
    const value = {
        user,
        login,
        register,
        verifyEmail,
        logout,
        acceptInvitation,
        updateProfile,
        hasPermission,
        checkPasswordStrength,
        manualVerifyUser,
        loading,
        isAuthenticated: !!user,

        // Backward compatibility
        userRole: user?.role,
        userId: user?.id,
        isAdmin: user?.role === 'admin',
        isValidator: user?.role === 'validator',
        isViewer: user?.role === 'viewer',

        // Additional user info
        userEmail: user?.email,
        userName: user ? `${user.firstName} ${user.lastName}` : null,
        companyId: user?.companyId,
        subscriptionType: user?.subscriptionType,

        // Document processing related
        documentsProcessed: user?.onboarding?.documentsProcessed || 0,
        onboardingComplete: user?.onboarding?.completed || false
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};