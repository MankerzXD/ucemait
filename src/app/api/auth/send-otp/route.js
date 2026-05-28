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

    const cleanEmail = email.trim().toLowerCase();
    const isUcemaEmail = cleanEmail.endsWith('@ucema.edu.ar');
    const isAdminEmail = cleanEmail === 'sanchezmanuel397@gmail.com';

    if (!isUcemaEmail && !isAdminEmail) {
      return NextResponse.json({ 
        error: 'Acceso restringido. Solo se permiten correos @ucema.edu.ar o administradores autorizados.' 
      }, { status: 403 });
    }

    // 1. Generate a random 6-digit OTP code for real delivery
    let otpCode = String(Math.floor(100000 + Math.random() * 900000));
    let isDemo = false;

    // 2. Try sending the email using Resend
    try {
      const fromEmail = process.env.RESEND_FROM_EMAIL || 'Soporte IT <noreply@ucema.edu.ar>';
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

      if (emailError || !emailData) {
        console.warn('Resend failed to send email. Falling back to Demo Mode:', emailError);
        otpCode = '123456';
        isDemo = true;
      }
    } catch (sendErr) {
      console.warn('Resend caught exception. Falling back to Demo Mode:', sendErr);
      otpCode = '123456';
      isDemo = true;
    }

    // 3. Save the final OTP code (real or demo 123456) to public.otp_codes using supabaseAdmin
    const { error: dbError } = await supabaseAdmin
      .from('otp_codes')
      .upsert({ email: cleanEmail, code: otpCode }, { onConflict: 'email' });

    if (dbError) {
      console.error('Error saving OTP to database:', dbError);
      return NextResponse.json({ error: 'Fallo al guardar el código de acceso en el servidor.' }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      isDemo,
      message: isDemo 
        ? 'Modo demostración activado. Use el código de bypass.' 
        : 'Código de verificación enviado con éxito.' 
    });

  } catch (err) {
    console.error('OTP Send Route error:', err);
    return NextResponse.json({ error: 'Error interno del servidor.' }, { status: 500 });
  }
}
