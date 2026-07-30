import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY || 're_placeholderKey_123');

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
    if (!process.env.RESEND_API_KEY || process.env.RESEND_API_KEY.includes('placeholderKey')) {
      missingVars.push('RESEND_API_KEY');
    }

    if (missingVars.length > 0) {
      return NextResponse.json({ 
        error: `Error de configuración en el servidor. Faltan configurar las siguientes variables de entorno en Vercel: ${missingVars.join(', ')}. Por favor agrégalas en settings de Vercel.` 
      }, { status: 500 });
    }

    const { email } = await request.json();

    if (!email || !email.trim()) {
      return NextResponse.json({ error: 'Email es requerido.' }, { status: 400 });
    }

    const cleanEmail = email.trim().toLowerCase();
    const isUcemaEmail = cleanEmail.endsWith('@ucema.edu.ar');
    const isAdminEmail = cleanEmail === 'sanchezmanuel397@gmail.com';

    if (!isUcemaEmail && !isAdminEmail) {
      return NextResponse.json({ 
        error: 'Acceso restringido. Solo se permiten correos @ucema.edu.ar o administradores autorizados.' 
      }, { status: 403 });
    }

    // 1. Generate a random 6-digit OTP code for real delivery
    const otpCode = String(Math.floor(100000 + Math.random() * 900000));

    // 2. Send the email using Resend
    const fromEmail = process.env.RESEND_FROM_EMAIL || 'Soporte IT <no-reply@mankerz.net>';
    const { data: emailData, error: emailError } = await resend.emails.send({
      from: fromEmail,
      to: [cleanEmail],
      subject: 'Código de Acceso OTP - Support IT',
      html: `
        <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #e4e4e7; border-radius: 8px;">
          <h2 style="color: #c20e2c; margin-bottom: 5px;">SUPPORT IT // UCEMA</h2>
          <p style="font-size: 14px; color: #71717a; margin-top: 0;">SISTEMA DE CONTROL DE DASHBOARD</p>
          <hr style="border: 0; border-top: 1px solid #e4e4e7; margin: 20px 0;" />
          <p style="font-size: 15px; color: #18181b;">Tu código de verificación OTP de acceso único es:</p>
          <div style="background-color: #f4f4f5; padding: 15px; text-align: center; font-size: 28px; font-weight: bold; letter-spacing: 5px; color: #18181b; border-radius: 4px; margin: 20px 0; font-family: monospace;">
            ${otpCode}
          </div>
          <p style="font-size: 12px; color: #a1a1aa; line-height: 1.5;">Este código es de un solo uso. Si no has solicitado este acceso, por favor desestima este correo.</p>
        </div>
      `
    });

    if (emailError) {
      console.error('Resend email error details:', emailError);
      return NextResponse.json({ error: emailError.message || 'Fallo al enviar correo por Resend.' }, { status: 400 });
    }

    // 3. Save the final OTP code to public.otp_codes using supabaseAdmin
    const { error: dbError } = await supabaseAdmin
      .from('otp_codes')
      .upsert({ email: cleanEmail, code: otpCode }, { onConflict: 'email' });

    if (dbError) {
      console.error('Error saving OTP to database:', dbError);
      const mask = (str, visibleLen = 5) => {
        if (!str) return 'vacía/no-definida';
        if (str.length <= visibleLen * 2) return `[oculta, largo=${str.length}]`;
        return `${str.substring(0, visibleLen)}...${str.substring(str.length - visibleLen)} (largo=${str.length})`;
      };
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
      const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
      const resendApiKey = process.env.RESEND_API_KEY || '';
      return NextResponse.json({ 
        error: `Fallo al guardar el código de acceso en el servidor: ${dbError.message || 'Error desconocido'} (${dbError.code || 'sin código'}). DB URL: ${mask(supabaseUrl, 15)}, DB Key: ${mask(supabaseServiceKey, 4)}, Resend Key: ${mask(resendApiKey, 4)}` 
      }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Código de verificación enviado con éxito.' 
    });

  } catch (err) {
    console.error('OTP Send Route error:', err);
    return NextResponse.json({ error: 'Error interno del servidor.' }, { status: 500 });
  }
}
