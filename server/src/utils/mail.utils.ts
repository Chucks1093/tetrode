import nodemailer from 'nodemailer';
import { Resend } from 'resend';
import { envConfig } from '../config';
export interface ISendMailOptions {
   to: string;
   subject: string;
   text?: string;
   html?: string;
   attachments?: any[];
}

// Create reusable transporter
const createTransporter = () => {
   const { GMAIL_USER, GMAIL_APP_PASSWORD } = envConfig;

   if (!GMAIL_USER || !GMAIL_APP_PASSWORD) {
      return null;
   }

   return nodemailer.createTransport({
      service: 'gmail',
      auth: {
         user: GMAIL_USER,
         pass: GMAIL_APP_PASSWORD,
      },
   });
};

const createResendClient = () => {
   if (!envConfig.RESEND_API_KEY) {
      return null;
   }

   return new Resend(envConfig.RESEND_API_KEY);
};

export const SendMail = async ({
   to,
   subject,
   text,
   html,
   attachments,
}: ISendMailOptions) => {
   const { GMAIL_USER, GMAIL_APP_PASSWORD, RESEND_FROM_EMAIL } = envConfig;
   const resendFromEmail = RESEND_FROM_EMAIL || 'onboarding@resend.dev';

   const resendClient = createResendClient();
   if (resendClient) {
      try {
         const result = await resendClient.emails.send({
            from: resendFromEmail,
            to,
            subject,
            text,
            html: html || generateProjectTemplate(text || '', subject),
         });

         if (result.error) {
            console.error('❌ Failed to send email via Resend:', result.error);
            return false;
         }

         console.log('✅ Email sent successfully via Resend to:', to);
         return true;
      } catch (error) {
         console.error('❌ Failed to send email via Resend:', error);
         return false;
      }
   }

   // Skip email in development if not configured
   if (!GMAIL_USER || !GMAIL_APP_PASSWORD) {
      console.log('📧 Email skipped (Gmail not configured):', { to, subject });
      return true;
   }

   try {
      const transporter = createTransporter();

      if (!transporter) {
         console.error('❌ Could not create email transporter');
         return false;
      }

      const mailOptions = {
         from: `National Toilet Campaign <${GMAIL_USER}>`,
         to: to,
         subject: subject,
         text: text,
         html: html || generateProjectTemplate(text || '', subject),
         ...(attachments && attachments.length > 0 && { attachments }),
      };

      const info = await transporter.sendMail(mailOptions);

      console.log(
         '✅ Email sent successfully via Gmail to:',
         to,
         'ID:',
         info.messageId
      );
      return true;
   } catch (error) {
      console.error('❌ Failed to send email via Gmail:', error);
      return false;
   }
};

// Helper function - adjust based on your actual template
function generateProjectTemplate(text: string, subject: string): string {
   return `
      <!DOCTYPE html>
      <html>
      <head>
         <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #f4f4f4; padding: 20px; text-align: center; }
         </style>
      </head>
      <body>
         <div class="container">
            <div class="header">
               <h2>${subject}</h2>
            </div>
            <div style="padding: 20px;">
               ${text}
            </div>
         </div>
      </body>
      </html>
   `;
}

// Async version that doesn't block API responses
export const SendMailAsync = async ({
   to,
   subject,
   text,
   html,
   attachments,
}: ISendMailOptions) => {
   // Fire and forget - don't wait for response
   SendMail({ to, subject, text, html, attachments })
      .then(() => {
         console.log('📧 Async email sent to:', to);
      })
      .catch(error => {
         console.error('📧 Async email failed:', error);
      });
};

// Project-specific email templates (keeping your existing ones)
export const EmailTemplates = {
   reportSubmission: (
      submitterName: string,
      reportId: string,
      location: string
   ) => `
      <h2>Thank you for your submission!</h2>
      <p>Dear ${submitterName},</p>
      <p>We have received your toilet report for <strong>${location}</strong>.</p>
      <p>Your report ID is: <strong>${reportId}</strong></p>
      <p>Our team will review your submission and update the status accordingly.</p>
      <p>Thank you for contributing to better sanitation in Nigeria!</p>
   `,

   reportNotification: (reportData: any) => `
      <h2>New Toilet Report Submitted</h2>
      
      <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
         <h3>📋 Report Details</h3>
         <p><strong>Report ID:</strong> ${reportData.id}</p>
         <p><strong>Submitter:</strong> ${reportData.submitterName}</p>
         <p><strong>Email:</strong> ${reportData.submitterEmail || 'Not provided'}</p>
         <p><strong>Phone:</strong> ${reportData.submitterPhone || 'Not provided'}</p>
         <p><strong>Submitted:</strong> ${new Date(reportData.createdAt).toLocaleString()}</p>
      </div>

      <div style="background: #e8f5e8; padding: 20px; border-radius: 8px; margin: 20px 0;">
         <h3>📍 Location Information</h3>
         <p><strong>State:</strong> ${reportData.state}</p>
         <p><strong>LGA:</strong> ${reportData.lga}</p>
         <p><strong>Ward:</strong> ${reportData.ward || 'Not specified'}</p>
         <p><strong>Address:</strong> ${reportData.specificAddress}</p>
         ${reportData.coordinates ? `<p><strong>Coordinates:</strong> ${reportData.coordinates}</p>` : ''}
      </div>

      <div style="background: #fff3cd; padding: 20px; border-radius: 8px; margin: 20px 0;">
         <h3>🚽 Facility Details</h3>
         <p><strong>Condition:</strong> <span style="text-transform: capitalize; font-weight: bold; color: ${
            reportData.toiletCondition === 'EXCELLENT'
               ? '#28a745'
               : reportData.toiletCondition === 'GOOD'
                 ? '#6f42c1'
                 : reportData.toiletCondition === 'FAIR'
                   ? '#ffc107'
                   : reportData.toiletCondition === 'POOR'
                     ? '#fd7e14'
                     : '#dc3545'
         };">${reportData.toiletCondition?.toLowerCase().replace('_', ' ')}</span></p>
         <p><strong>Facility Type:</strong> <span style="text-transform: capitalize;">${reportData.facilityType?.toLowerCase()}</span></p>
         ${reportData.description ? `<p><strong>Description:</strong> ${reportData.description}</p>` : ''}
      </div>

      ${
         reportData.images && reportData.images.length > 0
            ? `
         <div style="background: #f0f8ff; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3>📷 Images (${reportData.images.length})</h3>
            <p>Images have been uploaded and are available in the admin dashboard.</p>
         </div>
      `
            : ''
      }

      <div style="text-align: center; margin: 30px 0;">
         <a href="${envConfig.FRONTEND_URL}/admin/dashboard/reports/${reportData.id}" 
            style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
            📊 View Full Report
         </a>
      </div>

      <p style="color: #666; font-size: 14px; margin-top: 30px;">
         Please review this report in the admin dashboard and update its status as appropriate.
      </p>
   `,

   adminInvitation: (
      adminName: string,
      inviterName: string,
      role: string,
      inviteLink: string
   ) => `
      <h2>You've been invited to join as an admin</h2>
      <p>Dear ${adminName},</p>
      <p>You have been invited by ${inviterName} to join the National Toilet Campaign admin panel as a <strong>${role}</strong>.</p>
      
      <div style="background: #f0f8ff; padding: 20px; border-radius: 8px; margin: 20px 0;">
         <h3>🛡️ Your Role</h3>
         <p><strong>${role}</strong></p>
         ${
            role === 'SYSTEM_ADMIN'
               ? '<p>As a System Admin, you have full access to manage reports, users, and system settings.</p>'
               : '<p>As an Admin, you can manage toilet reports and view analytics.</p>'
         }
      </div>

      <div style="text-align: center; margin: 30px 0;">
         <p>Click the button below to accept your invitation:</p>
         <a href="${inviteLink}" style="background-color: #2563eb; color: white; padding: 15px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold; font-size: 16px;">
            🚀 Accept Invitation
         </a>
      </div>

      <div style="background: #fff3cd; padding: 15px; border-radius: 6px; margin: 20px 0;">
         <p><strong>⏰ Important:</strong> This invitation will expire in 7 days.</p>
      </div>

      <p>If you didn't expect this invitation, you can safely ignore this email.</p>
   `,

   reportStatusUpdate: (
      submitterName: string,
      reportId: string,
      status: string,
      adminNotes?: string
   ) => `
      <h2>📋 Report Status Update</h2>
      <p>Dear ${submitterName},</p>
      <p>Your toilet report (ID: <strong>${reportId}</strong>) has been <strong style="text-transform: capitalize; color: ${
         status === 'APPROVED'
            ? '#28a745'
            : status === 'REJECTED'
              ? '#dc3545'
              : '#6c757d'
      };">${status.toLowerCase()}</strong>.</p>
      
      ${
         adminNotes
            ? `
         <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3>💬 Admin Notes</h3>
            <p>${adminNotes}</p>
         </div>
      `
            : ''
      }

      ${
         status === 'APPROVED'
            ? `
         <div style="background: #d4edda; border: 1px solid #c3e6cb; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3>✅ Report Approved</h3>
            <p>Your report is now visible on our public map and will help improve sanitation awareness across Nigeria!</p>
         </div>
      `
            : ''
      }

      ${
         status === 'REJECTED'
            ? `
         <div style="background: #f8d7da; border: 1px solid #f5c6cb; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3>❌ Report Not Approved</h3>
            <p>Unfortunately, your report did not meet our guidelines. Please review the admin notes above for details.</p>
         </div>
      `
            : ''
      }

      <p>Thank you for your contribution to improving sanitation in Nigeria!</p>
   `,

   passwordReset: (adminName: string, resetLink: string) => `
      <h2>🔐 Password Reset Request</h2>
      <p>Dear ${adminName},</p>
      <p>We received a request to reset your password for the National Toilet Campaign admin panel.</p>
      
      <div style="text-align: center; margin: 30px 0;">
         <a href="${resetLink}" style="background-color: #2563eb; color: white; padding: 15px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
            🔑 Reset Password
         </a>
      </div>

      <div style="background: #fff3cd; padding: 15px; border-radius: 6px; margin: 20px 0;">
         <p><strong>⏰ Important:</strong> This link will expire in 1 hour for security reasons.</p>
      </div>

      <p>If you didn't request this password reset, you can safely ignore this email.</p>
   `,
};
