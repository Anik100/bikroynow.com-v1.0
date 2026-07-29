import nodemailer from 'nodemailer';

// Helper to get all configured SMTP accounts from environment variables
function getSmtpAccounts() {
  const envVar = process.env.GMAIL_SMTP_ACCOUNTS || '';
  if (!envVar.trim()) return [];

  return envVar
    .split(',')
    .map(item => item.trim())
    .filter(Boolean)
    .map(item => {
      const parts = item.split(':');
      const email = parts[0]?.trim();
      const pass = parts.slice(1).join(':').trim().replace(/\s+/g, '');
      return { email, pass };
    })
    .filter(acc => acc.email && acc.pass && !acc.pass.startsWith('app_password_'));
}

let currentIndex = 0;

export async function sendOtpEmail(toEmail, otpCode, name = 'User') {
  const accounts = getSmtpAccounts();

  if (accounts.length === 0) {
    console.warn('⚠️ No active Gmail App Passwords configured in .env.local. Falling back to simulation mode for dev.');
    console.log(`[SIMULATION OTP] To: ${toEmail} | OTP Code: ${otpCode}`);
    return { success: true, simulated: true, otpCode };
  }

  let lastError = null;

  // Try accounts starting from currentIndex (round-robin with fallback)
  for (let i = 0; i < accounts.length; i++) {
    const accountIndex = (currentIndex + i) % accounts.length;
    const account = accounts[accountIndex];

    try {
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: account.email,
          pass: account.pass
        }
      });

      const plainText = `প্রিয় ${name},\n\nBikroyNow.com-এ অ্যাকাউন্ট ভেরিফাই করতে নিচের ৬ ডিজিটের ওটিপি (OTP) কোডটি ব্যবহার করুন:\n\nওটিপি কোড: ${otpCode}\n\nএই কোডটি ৫ মিনিটের জন্য কার্যকর থাকবে।\n\nধন্যবাদ,\nBikroyNow টিম`;

      const htmlTemplate = `
        <div style="font-family: Arial, Helvetica, sans-serif; max-width: 520px; margin: 0 auto; padding: 25px; border-radius: 10px; background: #ffffff; border: 1px solid #e2e8f0; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
          <div style="text-align: center; margin-bottom: 20px;">
            <h2 style="color: #008b5e; font-size: 26px; margin: 0; font-weight: 800;">BikroyNow<span style="color: #f59e0b;">.com</span></h2>
            <p style="color: #64748b; font-size: 14px; margin-top: 4px;">আপনার বিশ্বস্ত কেনাবেচার প্ল্যাটফর্ম</p>
          </div>
          
          <hr style="border: none; border-top: 1px solid #f1f5f9; margin: 15px 0;" />
          
          <p style="color: #334155; font-size: 16px; line-height: 1.5;">প্রিয় <strong>${name}</strong>,</p>
          <p style="color: #475569; font-size: 15px; line-height: 1.5;">BikroyNow.com-এ রেজিস্ট্রেশন করার জন্য ধন্যবাদ। আপনার অ্যাকাউন্টটি ভেরিফাই করতে নিচের ৬ ডিজিটের ওটিপি (OTP) কোডটি ব্যবহার করুন:</p>
          
          <div style="text-align: center; margin: 30px 0;">
            <span style="display: inline-block; font-size: 32px; font-weight: 900; letter-spacing: 8px; color: #008b5e; background: #f0fdf4; padding: 14px 28px; border-radius: 10px; border: 2px dashed #86efac;">
              ${otpCode}
            </span>
            <p style="color: #ef4444; font-size: 13px; margin-top: 10px; font-weight: 600;">⏱️ এই কোডটি ৫ মিনিটের জন্য প্রযোজ্য থাকবে।</p>
          </div>

          <p style="color: #94a3b8; font-size: 13px; line-height: 1.4;">যদি আপনি এই রেজিস্ট্রেশনের অনুরোধ না করে থাকেন, তবে বার্তাটি উপেক্ষা করুন।</p>
          
          <hr style="border: none; border-top: 1px solid #f1f5f9; margin: 20px 0;" />
          <p style="text-align: center; color: #94a3b8; font-size: 12px; margin: 0;">© ${new Date().getFullYear()} BikroyNow.com. All rights reserved.</p>
        </div>
      `;

      await transporter.sendMail({
        from: account.email,
        replyTo: account.email,
        to: toEmail,
        subject: `BikroyNow অ্যাকাউন্ট ভেরিফিকেশন কোড: ${otpCode}`,
        text: plainText,
        html: htmlTemplate,
        headers: {
          'X-Priority': '1',
          'X-MSMail-Priority': 'High',
          'Importance': 'high',
          'X-Mailer': 'BikroyNow Auth'
        }
      });

      // Update current index for round-robin balancing
      currentIndex = (accountIndex + 1) % accounts.length;

      console.log(`✅ OTP Email sent successfully to ${toEmail} via ${account.email}`);
      return { success: true, accountUsed: account.email };
    } catch (err) {
      console.error(`❌ Failed sending OTP via ${account.email}:`, err.message);
      lastError = err;
    }
  }

  throw new Error(`All configured Gmail SMTP accounts failed. Last error: ${lastError?.message}`);
}
