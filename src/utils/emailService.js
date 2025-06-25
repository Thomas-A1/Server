
// const path = require('path'); 
// const nodemailer = require('nodemailer');
// const envPath = path.resolve(__dirname, '/Users/macpro/Desktop/UniGhanaBackend/.env');

const dotenv = require('dotenv');
const nodemailer = require('nodemailer');

// const envPath = path.resolve(__dirname, '/Users/macpro/Desktop/UniGhanaBackend/.env');
dotenv.config();


// Configure transporter
const transporter = nodemailer.createTransport({
    service: "gmail",
    port: process.env.EMAIL_PORT || 587,
    secure: process.env.EMAIL_SECURE === 'true',
    auth: {
        user: process.env.EMAIL_USER || "unighanaofficial@gmail.com",
        pass: process.env.EMAIL_PASSWORD || "vvel ycdy nmfd xcan"
    }
});

class EmailService {
    static async sendVerificationEmail(email, code) {
        const mailOptions = {
            from: `"UniGhana" <${process.env.EMAIL_FROM}>`,
            to: email,
            subject: 'Verify Your UniGhana Account',
            html: `
        <div style="max-width: 600px; margin: 0 auto; padding: 20px; font-family: Arial, sans-serif;">
          <h2>Welcome to UniGhana!</h2>
          <p>Please use the verification code below to complete your registration:</p>
          <div style="background-color: #f4f4f4; padding: 10px; text-align: center; font-size: 24px; letter-spacing: 5px; margin: 20px 0;">
            <strong>${code}</strong>
          </div>
          <p>This code will expire in 30 minutes.</p>
          <p>If you didn't request this code, please ignore this email.</p>
        </div>
      `
        };

        try {
            const info = await transporter.sendMail(mailOptions);
            return { success: true, messageId: info.messageId };
        } catch (error) {
            console.error('Error sending email:', error);
            return { success: false, error: error.message };
        }
    }
}

module.exports = EmailService;
