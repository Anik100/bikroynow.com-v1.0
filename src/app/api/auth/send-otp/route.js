import { NextResponse } from 'next/server';
import { supabase } from '../../../../lib/supabaseClient';
import { sendOtpEmail } from '../../../../lib/emailSender';

// Global in-memory storage for pending OTPs (Expires in 5 mins)
if (!global.pendingOtps) {
  global.pendingOtps = new Map();
}

export async function POST(req) {
  try {
    const { email, fullName, phone, password } = await req.json();

    if (!email || !fullName || !phone || !password) {
      return NextResponse.json({ error: 'সকল তথ্য প্রদান করা আবশ্যক।' }, { status: 400 });
    }

    // Validate phone number (Bangladeshi format)
    const bdPhoneRegex = /^01[3-9]\d{8}$/;
    if (!bdPhoneRegex.test(phone)) {
      return NextResponse.json({ error: 'সঠিক বাংলাদেশি মোবাইল নম্বর দিন (যেমন: 017XXXXXXXX)।' }, { status: 400 });
    }

    // Check if email already exists in profiles
    const { data: existingUser } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', email.toLowerCase().trim())
      .maybeSingle();

    if (existingUser) {
      return NextResponse.json({ error: 'এই ইমেইলটি দিয়ে ইতিমধ্যে একটি অ্যাকাউন্ট তৈরি করা আছে।' }, { status: 400 });
    }

    // Generate 6-digit OTP
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes validity

    // Store in global memory map
    global.pendingOtps.set(email.toLowerCase().trim(), {
      otpCode,
      expiresAt,
      fullName: fullName.trim(),
      phone: phone.trim(),
      password,
      attempts: 0
    });

    // Send OTP via Gmail SMTP Pool
    const sendResult = await sendOtpEmail(email.toLowerCase().trim(), otpCode, fullName.trim());

    return NextResponse.json({
      success: true,
      message: 'আপনার ইমেইলে ৬ ডিজিটের ওটিপি কোড পাঠানো হয়েছে।',
      simulated: sendResult.simulated || false,
      // For development simulation when no App Passwords are configured
      simulatedOtp: sendResult.simulated ? otpCode : undefined
    });
  } catch (err) {
    console.error('Send OTP Error:', err);
    return NextResponse.json({ error: err.message || 'ওটিপি পাঠাতে সমস্যা হয়েছে।' }, { status: 500 });
  }
}
