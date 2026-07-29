import { NextResponse } from 'next/server';
import { supabase } from '../../../../lib/supabaseClient';

if (!global.pendingOtps) {
  global.pendingOtps = new Map();
}

export async function POST(req) {
  try {
    const { email, otpCode } = await req.json();
    const cleanEmail = email?.toLowerCase().trim();
    const cleanOtp = otpCode?.toString().trim();

    if (!cleanEmail || !cleanOtp) {
      return NextResponse.json({ error: 'ইমেইল এবং ওটিপি কোড প্রদান করুন।' }, { status: 400 });
    }

    const pending = global.pendingOtps.get(cleanEmail);

    if (!pending) {
      return NextResponse.json({ error: 'ওটিপি সেশন পাওয়া যায়নি বা মেয়াদ শেষ হয়ে গেছে। অনুগ্রহ করে আবার ওটিপি পাঠান।' }, { status: 400 });
    }

    if (Date.now() > pending.expiresAt) {
      global.pendingOtps.delete(cleanEmail);
      return NextResponse.json({ error: 'ওটিপি কোডের মেয়াদের ৫ মিনিট শেষ হয়ে গেছে। নতুন ওটিপি পাঠান।' }, { status: 400 });
    }

    if (pending.otpCode !== cleanOtp) {
      pending.attempts = (pending.attempts || 0) + 1;
      if (pending.attempts >= 5) {
        global.pendingOtps.delete(cleanEmail);
        return NextResponse.json({ error: 'সর্বোচ্চ ৫ বার ভুল ওটিপি দেওয়া হয়েছে। নতুন ওটিপি পাঠান।' }, { status: 400 });
      }
      return NextResponse.json({ error: 'ভুল ওটিপি কোড। অনুগ্রহ করে সঠিক কোডটি লিখুন।' }, { status: 400 });
    }

    // OTP Verified successfully! Register user in Supabase Auth
    const { data: signupData, error: signupError } = await supabase.auth.signUp({
      email: cleanEmail,
      password: pending.password,
      options: {
        data: {
          full_name: pending.fullName,
          phone: pending.phone
        }
      }
    });

    if (signupError) {
      // If user already exists in Auth but not in profiles
      if (signupError.message.includes('already registered')) {
        const { data: signInData, error: signInErr } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password: pending.password
        });

        if (signInErr) {
          return NextResponse.json({ error: 'অ্যাকাউন্ট ভেরিফাইড কিন্তু লগইন করতে সমস্যা হচ্ছে: ' + signInErr.message }, { status: 400 });
        }

        global.pendingOtps.delete(cleanEmail);
        return NextResponse.json({
          success: true,
          message: 'অ্যাকাউন্ট ভেরিফিকেশন ও লগইন সফল হয়েছে!',
          session: signInData.session,
          user: signInData.user
        });
      }

      return NextResponse.json({ error: 'রেজিস্ট্রেশন ত্রুটি: ' + signupError.message }, { status: 400 });
    }

    // Clean up memory store
    global.pendingOtps.delete(cleanEmail);

    // Auto sign in if session exists, else log in explicitly
    let session = signupData.session;
    let user = signupData.user;

    if (!session) {
      const { data: signInData } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password: pending.password
      });
      session = signInData?.session || null;
      user = signInData?.user || user;
    }

    return NextResponse.json({
      success: true,
      message: 'অভিনন্দন! আপনার ইমেইল ওটিপি ভেরিফিকেশন সফল হয়েছে।',
      session,
      user
    });

  } catch (err) {
    console.error('Verify OTP Error:', err);
    return NextResponse.json({ error: err.message || 'ওটিপি ভেরিফাই করতে সমস্যা হয়েছে।' }, { status: 500 });
  }
}
