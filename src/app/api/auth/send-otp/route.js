import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY || 're_placeholderKey_123');

export async function POST(request) {
  try {
    const { email } = await request.json();

    if (!email || !email.trim()) {
      return NextResponse.json({ error: 'Email es requerido.' }, { status: 400 });
    }

    // 1. Generate 6-digit OTP code
    const otpCode = String(Math.floor(100000 + Math.random() * 900000));

    // 2. Save OTP code to public.otp_codes using supabaseAdmin (bypassing RLS)
    const { error: dbError } = await supabaseAdmin
      .from('otp_codes')
      .upsert({ email: email.trim().toLowerCase(), code: otpCode }, { onConflict: 'email' });

    if (dbError) {
      console.error('Error saving OTP to database:', dbError);
      throw new Error('Fallo al guardar código de acceso.');
    }

    // 3. Send email using Resend
    const fromEmail = process.env.RESEND_FROM_EMAIL || 'Soporte IT UCEMA <onboarding@resend.dev>';
    const { data: emailData, error: emailError } = await resend.emails.send({
      from: fromEmail,
      to: [email.trim().toLowerCase()],
      subject: 'Código de Acceso OTP - Support IT',
      html: `
        <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #e4e4e7; rounded: 8px;">
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
      throw new Error(emailError.message || 'Fallo al enviar correo.');
    }

    return NextResponse.json({ success: true, message: 'Código de verificación enviado con éxito.' });

  } catch (err) {
    console.error('OTP Send Route error:', err);
    return NextResponse.json({ error: err.message || 'Error interno del servidor.' }, { status: 500 });
  }
}
