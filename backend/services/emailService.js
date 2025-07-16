// backend/services/emailService.js
const sgMail = require('@sendgrid/mail');

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const sendInvitationEmail = async (email, invitationToken, inviterName) => {
  const invitationUrl = `${process.env.FRONTEND_URL}/accept-invitation?token=${invitationToken}`;
  
  const msg = {
    to: email,
    from: process.env.SENDGRID_FROM_EMAIL,
    subject: 'You\'ve been invited to join our platform',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #1976d2;">Customer Registration System</h1>
        </div>
        
        <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px;">
          <h2>You've been invited!</h2>
          <p><strong>${inviterName}</strong> has invited you to join our customer registration platform.</p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${invitationUrl}" 
               style="background-color: #1976d2; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block; font-weight: bold;">
              Accept Invitation
            </a>
          </div>
          
          <p><strong>Note:</strong> This invitation will expire in 7 days.</p>
          <p>If the button doesn't work, copy and paste this link: ${invitationUrl}</p>
        </div>
        
        <div style="margin-top: 20px; font-size: 12px; color: #666;">
          <p>If you didn't expect this invitation, please ignore this email.</p>
        </div>
      </div>
    `
  };

  try {
    await sgMail.send(msg);
    return { success: true };
  } catch (error) {
    console.error('SendGrid error:', error);
    return { success: false, error: error.message };
  }
};

const sendWelcomeEmail = async (email, firstName) => {
  const msg = {
    to: email,
    from: process.env.SENDGRID_FROM_EMAIL,
    subject: 'Welcome to Customer Registration System',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #1976d2;">Welcome to Customer Registration System</h1>
        </div>
        
        <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px;">
          <h2>Welcome, ${firstName}!</h2>
          <p>Your account has been successfully activated. You can now access all the features of our platform.</p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${process.env.FRONTEND_URL}/dashboard" 
               style="background-color: #1976d2; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block; font-weight: bold;">
              Go to Dashboard
            </a>
          </div>
          
          <p>If you have any questions, please don't hesitate to contact our support team.</p>
        </div>
      </div>
    `
  };

  try {
    await sgMail.send(msg);
    return { success: true };
  } catch (error) {
    console.error('SendGrid error:', error);
    return { success: false, error: error.message };
  }
};

const sendPasswordResetEmail = async (email, resetToken, firstName) => {
  const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;
  
  const msg = {
    to: email,
    from: process.env.SENDGRID_FROM_EMAIL,
    subject: 'Password Reset Request',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #1976d2;">Password Reset</h1>
        </div>
        
        <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px;">
          <h2>Hello, ${firstName}</h2>
          <p>We received a request to reset your password. If you didn't make this request, please ignore this email.</p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}" 
               style="background-color: #1976d2; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block; font-weight: bold;">
              Reset Password
            </a>
          </div>
          
          <p><strong>Note:</strong> This link will expire in 1 hour for security reasons.</p>
          <p>If the button doesn't work, copy and paste this link: ${resetUrl}</p>
        </div>
        
        <div style="margin-top: 20px; font-size: 12px; color: #666;">
          <p>If you didn't request a password reset, please ignore this email or contact support if you have concerns.</p>
        </div>
      </div>
    `
  };

  try {
    await sgMail.send(msg);
    return { success: true };
  } catch (error) {
    console.error('SendGrid error:', error);
    return { success: false, error: error.message };
  }
};

module.exports = { 
  sendInvitationEmail, 
  sendWelcomeEmail, 
  sendPasswordResetEmail 
};