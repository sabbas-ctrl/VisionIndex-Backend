/**
 * VisionIndex — Professional branded email templates.
 *
 * All emails share a consistent layout wrapper with the VisionIndex logo,
 * brand colors (#42A5F5 primary blue, #0f172a dark navy), and footer.
 *
 * Usage:
 *   import { emailTemplates } from '../utils/emailTemplates.js';
 *   const { html, text, subject } = emailTemplates.verification({ username, verifyUrl });
 */

const BRAND = {
  name: 'VisionIndex',
  primary: '#42A5F5',        // Brand blue
  primaryDark: '#1e88e5',    // Hover blue
  dark: '#0f172a',           // Navy dark
  bg: '#f1f5f9',             // Light slate bg
  cardBg: '#ffffff',
  textPrimary: '#0f172a',
  textSecondary: '#475569',
  textMuted: '#94a3b8',
  border: '#e2e8f0',
  year: new Date().getFullYear(),
  website: 'https://visionindex.tech',
};

/**
 * Wraps email body content in the VisionIndex branded layout.
 * Uses inline styles for maximum email client compatibility.
 */
const wrapInLayout = (bodyContent) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${BRAND.name}</title>
</head>
<body style="margin:0; padding:0; background-color:${BRAND.bg}; font-family:'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif; -webkit-font-smoothing:antialiased;">
  <!-- Outer wrapper -->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${BRAND.bg}; padding:40px 20px;">
    <tr>
      <td align="center">
        <!-- Card container -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px; background:${BRAND.cardBg}; border-radius:16px; overflow:hidden; box-shadow:0 4px 24px rgba(0,0,0,0.06);">
          
          <!-- Header bar -->
          <tr>
            <td style="background:linear-gradient(135deg, ${BRAND.dark} 0%, #1e293b 100%); padding:32px 40px; text-align:center;">
              <!-- Logo text (inline SVG-safe) -->
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;">
                <tr>
                  <td style="width:36px; height:36px; background:${BRAND.primary}; border-radius:10px; text-align:center; vertical-align:middle;">
                    <span style="color:#ffffff; font-size:18px; font-weight:700; line-height:36px;">V</span>
                  </td>
                  <td style="padding-left:12px;">
                    <span style="color:#ffffff; font-size:22px; font-weight:700; letter-spacing:-0.5px;">Vision</span><span style="color:${BRAND.primary}; font-size:22px; font-weight:700; letter-spacing:-0.5px;">Index</span>
                  </td>
                </tr>
              </table>
              <p style="color:${BRAND.textMuted}; font-size:13px; margin:12px 0 0 0; letter-spacing:0.5px;">INTELLIGENT VIDEO SURVEILLANCE</p>
            </td>
          </tr>

          <!-- Body content -->
          <tr>
            <td style="padding:40px 40px 32px;">
              ${bodyContent}
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding:0 40px;">
              <div style="border-top:1px solid ${BRAND.border}; margin:0;"></div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:24px 40px 32px; text-align:center;">
              <p style="font-size:12px; color:${BRAND.textMuted}; margin:0 0 6px 0;">
                &copy; ${BRAND.year} ${BRAND.name}. All rights reserved.
              </p>
              <p style="font-size:12px; color:${BRAND.textMuted}; margin:0;">
                You received this email because your account is registered with ${BRAND.name}.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

/**
 * Reusable CTA button.
 */
const ctaButton = (href, label) => `
<div style="text-align:center; margin:32px 0;">
  <a href="${href}"
     style="display:inline-block; background:${BRAND.primary}; color:#ffffff; text-decoration:none;
            padding:14px 36px; border-radius:8px; font-size:15px; font-weight:600;
            letter-spacing:0.3px; box-shadow:0 4px 12px rgba(66,165,245,0.35);">
    ${label}
  </a>
</div>
`;

/**
 * Fallback link block (shown below the CTA).
 */
const fallbackLink = (href) => `
<p style="font-size:12px; color:${BRAND.textMuted}; margin:0; line-height:1.6; word-break:break-all;">
  If the button doesn't work, copy and paste this link into your browser:<br />
  <a href="${href}" style="color:${BRAND.primary}; text-decoration:none;">${href}</a>
</p>
`;

// ─── Template generators ────────────────────────────────────────────────

export const emailTemplates = {
  /**
   * Email verification (self-registration).
   */
  verification({ username, verifyUrl }) {
    const subject = 'Verify your VisionIndex account';

    const html = wrapInLayout(`
      <h2 style="font-size:22px; font-weight:700; color:${BRAND.textPrimary}; margin:0 0 8px;">
        Welcome aboard! 🎉
      </h2>
      <p style="font-size:15px; color:${BRAND.textSecondary}; margin:0 0 24px; line-height:1.6;">
        Hi <strong>${username || 'there'}</strong>, thanks for signing up for VisionIndex.
        Please verify your email address to activate your account and start using our intelligent video surveillance platform.
      </p>
      ${ctaButton(verifyUrl, 'Verify My Email')}
      ${fallbackLink(verifyUrl)}
      <p style="font-size:13px; color:${BRAND.textMuted}; margin:20px 0 0; line-height:1.5;">
        This link expires in <strong>24 hours</strong>. If you didn't create an account, you can safely ignore this email.
      </p>
    `);

    const text = `Welcome to VisionIndex!\n\nHi ${username || 'there'}, please verify your email by visiting:\n${verifyUrl}\n\nThis link expires in 24 hours.\n\nIf you didn't create this account, please ignore this email.`;

    return { subject, html, text };
  },

  /**
   * Email verification (admin-created user).
   */
  adminCreatedVerification({ username, verifyUrl }) {
    const subject = 'Your VisionIndex account has been created';

    const html = wrapInLayout(`
      <h2 style="font-size:22px; font-weight:700; color:${BRAND.textPrimary}; margin:0 0 8px;">
        You're invited! 📧
      </h2>
      <p style="font-size:15px; color:${BRAND.textSecondary}; margin:0 0 24px; line-height:1.6;">
        Hi <strong>${username || 'there'}</strong>, an administrator has created a VisionIndex account for you.
        Please verify your email address below to activate your account.
      </p>
      ${ctaButton(verifyUrl, 'Verify & Activate')}

      <p style="font-size:13px; color:${BRAND.textMuted}; margin:20px 0 0; line-height:1.5;">
        This link expires in <strong>24 hours</strong>. If this was unexpected, you can ignore this email or contact your administrator.
      </p>
    `);

    const text = `Your VisionIndex account has been created.\n\nHi ${username || 'there'}, an administrator created your account. Verify your email:\n${verifyUrl}\n\nThis link expires in 24 hours.`;

    return { subject, html, text };
  },

  /**
   * Password reset.
   */
  passwordReset({ username, resetUrl }) {
    const subject = 'Reset your VisionIndex password';

    const html = wrapInLayout(`
      <h2 style="font-size:22px; font-weight:700; color:${BRAND.textPrimary}; margin:0 0 8px;">
        Password Reset 🔐
      </h2>
      <p style="font-size:15px; color:${BRAND.textSecondary}; margin:0 0 8px; line-height:1.6;">
        Hi <strong>${username || 'there'}</strong>,
      </p>
      <p style="font-size:15px; color:${BRAND.textSecondary}; margin:0 0 24px; line-height:1.6;">
        We received a request to reset the password for your VisionIndex account. Click the button below to choose a new password.
      </p>
      ${resetUrl ? ctaButton(resetUrl, 'Reset Password') : ''}
      ${resetUrl ? fallbackLink(resetUrl) : ''}
      <div style="background:${BRAND.bg}; border-radius:8px; padding:16px 20px; margin:24px 0 0;">
        <p style="font-size:13px; color:${BRAND.textSecondary}; margin:0; line-height:1.5;">
          ⏱ This link expires in <strong>30 minutes</strong> for your security.<br />
          🔒 If you didn't request this, no action is needed — your password remains unchanged.
        </p>
      </div>
    `);

    const text = `Hi ${username || 'there'},\n\nWe received a request to reset your VisionIndex password.\n\n${resetUrl ? `Reset your password: ${resetUrl}\n\nThis link expires in 30 minutes.` : 'A password reset was requested.'}\n\nIf you didn't request this, please ignore this email.`;

    return { subject, html, text };
  },
};

export default emailTemplates;
