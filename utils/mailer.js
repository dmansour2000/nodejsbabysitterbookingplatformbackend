const nodemailer = require('nodemailer');

const defaultResendFrom = 'CareNest <onboarding@resend.dev>';

async function sendViaResend({ to, subject, html, text }) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
        throw new Error('RESEND_API_KEY is not configured');
    }

    let from = process.env.RESEND_FROM_EMAIL || defaultResendFrom;
    if (/@(gmail|yahoo|hotmail|outlook)\.com/i.test(from)) {
        console.warn(`[Mailer] '${from}' is a public webmail domain and cannot be used directly with Resend without domain verification. Falling back to '${defaultResendFrom}'.`);
        from = defaultResendFrom;
    }

    const payload = {
        from,
        to: Array.isArray(to) ? to : [to],
        subject,
        html,
        text,
    };

    let response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
    });

    let data = await response.json().catch(() => ({}));

    // If it failed because of unverified sender domain, retry once with onboarding@resend.dev
    if (!response.ok && data?.name === 'validation_error' && from !== defaultResendFrom) {
        console.warn(`[Mailer] Resend rejected '${from}'. Retrying with '${defaultResendFrom}'...`);
        payload.from = defaultResendFrom;
        response = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        });
        data = await response.json().catch(() => ({}));
    }

    // Resend test-tier recipient restriction:
    if (!response.ok && data?.statusCode === 403 && data?.message?.includes('You can only send testing emails to your own email address')) {
        const match = data.message.match(/\(([^)]+)\)/);
        const verifiedOwnerEmail = match ? match[1] : 'dinamansour2000@gmail.com';
        const originalRecipient = Array.isArray(to) ? to.join(', ') : to;

        console.warn(`[Mailer] Resend test domain restriction: recipient '${originalRecipient}' is not the Resend account owner. Rerouting to verified email '${verifiedOwnerEmail}' for testing...`);

        payload.to = [verifiedOwnerEmail];
        payload.subject = `[Test for ${originalRecipient}] ${subject}`;
        payload.html = `
          <div style="padding: 12px 16px; margin-bottom: 20px; background-color: #fff3cd; border: 1px solid #ffeeba; border-radius: 8px; color: #856404; font-size: 13px; line-height: 1.5;">
            <strong>Resend Testing Mode:</strong> This email was requested for <code>${originalRecipient}</code>. Because Resend's test sender (<code>onboarding@resend.dev</code>) can only deliver to the Resend account owner's inbox, it was safely routed to your verified email (<code>${verifiedOwnerEmail}</code>).
          </div>
        ` + html;

        response = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        });
        data = await response.json().catch(() => ({}));
    }

    if (!response.ok) {
        const errorMsg = data?.message || response.statusText || 'Failed to send email';
        console.error('[Mailer] Resend API error:', response.status, data);
        throw new Error(`Email delivery failed: ${errorMsg}`);
    }

    return { id: data.id, provider: 'resend' };
}

async function sendViaGmail({ to, subject, html, text }) {
    const user = process.env.GMAIL_USER || process.env.SMTP_USER || process.env.EMAIL_USER;
    const pass = process.env.GMAIL_APP_PASSWORD || process.env.GMAIL_PASS || process.env.SMTP_PASS || process.env.EMAIL_PASS;

    if (!user || !pass) {
        throw new Error('Gmail SMTP credentials are not configured (GMAIL_USER, GMAIL_APP_PASSWORD)');
    }

    const transporter = nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 465,
        secure: true,
        auth: {
            user,
            pass: pass.replace(/\s+/g, ''),
        },
        connectionTimeout: 15000,
        greetingTimeout: 15000,
        socketTimeout: 20000,
    });

    const from = process.env.GMAIL_FROM || `CareNest <${user}>`;
    const info = await transporter.sendMail({
        from,
        to: Array.isArray(to) ? to.join(', ') : to,
        subject,
        text,
        html,
    });

    console.log(`[Mailer] Email delivered via Gmail SMTP to: ${to} (Message ID: ${info.messageId})`);
    return { id: info.messageId, provider: 'gmail' };
}

async function sendEmail({ to, subject, html, text }) {
    const gmailUser = process.env.GMAIL_USER || process.env.SMTP_USER || process.env.EMAIL_USER;
    const gmailPass = process.env.GMAIL_APP_PASSWORD || process.env.GMAIL_PASS || process.env.SMTP_PASS || process.env.EMAIL_PASS;
    const provider = (process.env.EMAIL_PROVIDER || 'gmail').toLowerCase();

    // 1. Explicit Resend provider preference
    if (provider === 'resend') {
        return sendViaResend({ to, subject, html, text });
    }

    // 2. Default: Gmail SMTP
    if (gmailUser && gmailPass) {
        return await sendViaGmail({ to, subject, html, text });
    }

    // If default is gmail but credentials are not found in environment
    if (provider === 'gmail') {
        throw new Error('Gmail SMTP credentials are not configured. Please set GMAIL_USER and GMAIL_APP_PASSWORD in your environment variables.');
    }

    // 3. Fallback to Resend only if explicitly configured or non-gmail provider
    if (process.env.RESEND_API_KEY) {
        return sendViaResend({ to, subject, html, text });
    }

    throw new Error('No email provider is configured. Please provide GMAIL_USER and GMAIL_APP_PASSWORD in environment variables.');
}

async function sendPasswordResetEmail({ to, resetUrl, name }) {
    const subject = 'CareNest - Password Reset / إعادة تعيين كلمة المرور';
    const recipientName = name ? String(name).trim() : 'there';

    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Reset your CareNest password</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #fbf7fb; margin: 0; padding: 24px;">
  <div style="max-width: 560px; margin: 0 auto; background-color: #ffffff; border: 1px solid #f1dff0; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 14px rgba(100, 30, 80, 0.06);">
    <div style="background: linear-gradient(135deg, #e779c9 0%, #9b8af2 100%); padding: 28px 24px; text-align: center;">
      <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 800; letter-spacing: 0.5px;">CareNest · كير نست</h1>
    </div>
    
    <div style="padding: 28px 24px; color: #333333; line-height: 1.6;">
      <p style="font-size: 16px; margin-top: 0;">Hello ${recipientName},</p>
      <p style="font-size: 15px; color: #555555;">
        We received a request to reset the password for your CareNest account. Click the button below to choose a new password. This link will expire in <strong>15 minutes</strong>.
      </p>

      <div style="text-align: center; margin: 28px 0;">
        <a href="${resetUrl}" style="background-color: #d954b2; color: #ffffff; padding: 13px 28px; text-decoration: none; border-radius: 10px; font-weight: 700; font-size: 15px; display: inline-block; box-shadow: 0 2px 8px rgba(217, 84, 178, 0.35);">
          Reset Password / إعادة تعيين كلمة المرور
        </a>
      </div>

      <p style="font-size: 13px; color: #777777; word-break: break-all; margin-bottom: 24px;">
        If the button doesn't work, copy and paste this link into your browser:<br/>
        <a href="${resetUrl}" style="color: #9333ea; text-decoration: underline;">${resetUrl}</a>
      </p>

      <hr style="border: none; border-top: 1px solid #f3e6f2; margin: 24px 0;" />

      <div dir="rtl" style="text-align: right; color: #444444; font-size: 15px; line-height: 1.7;">
        <p style="margin-top: 0;">مرحباً ${recipientName}،</p>
        <p style="color: #555555;">
          تلقينا طلباً لإعادة تعيين كلمة المرور الخاصة بحسابك على كير نست. يمكنك الضغط على الزر أعلاه لتعيين كلمة مرور جديدة. هذا الرابط صالح لمدة <strong>15 دقيقة</strong> فقط.
        </p>
        <p style="font-size: 13px; color: #888888; margin-bottom: 0;">
          إذا لم تطلبي إعادة تعيين كلمة المرور، يمكنك تجاهل هذا البريد الإلكتروني بأمان وستظل كلمة مرورك الحالية دون تغيير.
        </p>
      </div>
    </div>
  </div>
</body>
</html>
    `.trim();

    const text = `Hello ${recipientName},\n\nWe received a request to reset your CareNest account password. Use this link (valid for 15 minutes):\n${resetUrl}\n\nIf you did not request this, you can ignore this email.`;

    return sendEmail({ to, subject, html, text });
}

module.exports = {
    sendEmail,
    sendViaGmail,
    sendViaResend,
    sendPasswordResetEmail,
};
