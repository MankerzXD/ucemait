import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function POST(request) {
  try {
    const { email, token } = await request.json();

    if (!email || !token) {
      return NextResponse.json({ error: 'Email y código token son requeridos.' }, { status: 400 });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanToken = token.trim();

    // 1. Fetch code from DB
    const { data, error } = await supabaseAdmin
      .from('otp_codes')
      .select('code')
      .eq('email', cleanEmail)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: 'El código OTP ha expirado o no es válido.' }, { status: 400 });
    }

    // 2. Validate token code
    if (data.code !== cleanToken) {
      return NextResponse.json({ error: 'Código de verificación incorrecto.' }, { status: 400 });
    }

    // 3. Match successful - Delete OTP record from table for safety
    await supabaseAdmin
      .from('otp_codes')
      .delete()
      .eq('email', cleanEmail);

    return NextResponse.json({ 
      success: true, 
      message: 'Verificado con éxito.',
      email: cleanEmail
    });

  } catch (err) {
    console.error('OTP Verification Route error:', err);
    return NextResponse.json({ error: 'Error interno de verificación.' }, { status: 500 });
  }
}
