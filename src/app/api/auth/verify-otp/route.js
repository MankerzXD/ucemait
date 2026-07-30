import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function POST(request) {
  try {
    // Check environment variables configuration
    const missingVars = [];
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder-url')) {
      missingVars.push('NEXT_PUBLIC_SUPABASE_URL');
    }
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY === 'placeholder-key') {
      missingVars.push('SUPABASE_SERVICE_ROLE_KEY');
    }

    if (missingVars.length > 0) {
      return NextResponse.json({ 
        error: `Error de configuración en el servidor. Faltan configurar las siguientes variables de entorno en Vercel: ${missingVars.join(', ')}. Por favor agrégalas en settings de Vercel.` 
      }, { status: 500 });
    }

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
