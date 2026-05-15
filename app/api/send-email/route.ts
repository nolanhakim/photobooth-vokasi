import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: NextRequest) {
  try {
    const { photos, email, sessionName } = await request.json();

    if (!email || !photos || photos.length === 0) {
      return NextResponse.json({ error: 'Email dan foto wajib diisi' }, { status: 400 });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: 'Format email tidak valid' }, { status: 400 });
    }

    // Build attachments — each photo as a PNG file
    const attachments = photos.map((dataUrl: string, idx: number) => {
      const base64Data = dataUrl.replace(/^data:image\/\w+;base64,/, '');
      return {
        filename: `photo-${idx + 1}.png`,
        content: base64Data,
        encoding: 'base64' as const,
      };
    });

    // Build inline thumbnail HTML (first 4 photos max)
    const thumbnailHtml = photos
      .slice(0, 4)
      .map(
        (dataUrl: string, idx: number) => `
        <div style="display:inline-block;margin:6px;">
          <img src="${dataUrl}" alt="Foto ${idx + 1}" 
               style="width:160px;height:213px;object-fit:cover;border-radius:10px;border:3px solid #e2e8f0;box-shadow:0 4px 12px rgba(0,0,0,0.15);" />
          <p style="text-align:center;margin:6px 0 0;font-size:12px;color:#64748b;font-family:Arial,sans-serif;">
            Foto ${idx + 1}
          </p>
        </div>`
      )
      .join('');

    const photoCountText = photos.length === 1 ? '1 foto' : `${photos.length} foto`;
    const now = new Date().toLocaleString('id-ID', {
      timeZone: 'Asia/Jakarta',
      dateStyle: 'full',
      timeStyle: 'short',
    });

    const htmlBody = `
<!DOCTYPE html>
<html lang="id">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f0f4ff;font-family:Arial,Helvetica,sans-serif;">
  <div style="max-width:600px;margin:40px auto;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,0.1);">
    
    <!-- Header -->
    <div style="background:linear-gradient(135deg,#1e3a8a 0%,#3b82f6 50%,#60a5fa 100%);padding:40px 32px;text-align:center;">
      <div style="font-size:48px;margin-bottom:12px;">📸</div>
      <h1 style="margin:0;color:#ffffff;font-size:26px;font-weight:700;letter-spacing:-0.5px;">Photobooth Vokasi UB</h1>
      <p style="margin:8px 0 0;color:rgba(255,255,255,0.85);font-size:14px;">Fakultas Vokasi • Universitas Brawijaya</p>
    </div>

    <!-- Body -->
    <div style="padding:36px 32px;">
      <h2 style="margin:0 0 8px;color:#1e293b;font-size:20px;">Halo! 👋</h2>
      <p style="margin:0 0 24px;color:#475569;font-size:15px;line-height:1.6;">
        Foto kamu dari sesi photobooth sudah siap! Kami melampirkan <strong>${photoCountText}</strong> 
        yang diambil pada <strong>${now}</strong>.
      </p>

      <!-- Photo Thumbnails -->
      <div style="background:#f8fafc;border-radius:14px;padding:20px;text-align:center;margin-bottom:24px;">
        <p style="margin:0 0 16px;color:#64748b;font-size:13px;text-transform:uppercase;letter-spacing:1px;font-weight:600;">Preview Foto</p>
        ${thumbnailHtml}
        ${photos.length > 4 ? `<p style="margin:12px 0 0;color:#94a3b8;font-size:13px;">+${photos.length - 4} foto lainnya terlampir di bawah</p>` : ''}
      </div>

      <!-- Info Box -->
      <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:12px;padding:16px 20px;margin-bottom:24px;">
        <p style="margin:0;color:#1d4ed8;font-size:14px;line-height:1.5;">
          💡 <strong>Tips:</strong> Foto terlampir dalam format PNG beresolusi tinggi. 
          Kamu bisa langsung download dan cetak foto tersebut!
        </p>
      </div>

      <p style="margin:0;color:#64748b;font-size:14px;line-height:1.6;">
        Semoga harimu menyenangkan! 🎉<br/>
        <strong style="color:#1e293b;">Tim Photobooth Vokasi UB</strong>
      </p>
    </div>

    <!-- Footer -->
    <div style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:20px 32px;text-align:center;">
      <p style="margin:0;color:#94a3b8;font-size:12px;">
        Fakultas Vokasi • Universitas Brawijaya • Malang, Jawa Timur<br/>
        Email ini dikirim otomatis oleh sistem Photobooth. Harap tidak membalas email ini.
      </p>
    </div>
  </div>
</body>
</html>`;

    const fromEmail = process.env.RESEND_FROM_EMAIL || 'Photobooth Vokasi UB <onboarding@resend.dev>';

    const { data, error } = await resend.emails.send({
      from: fromEmail,
      to: [email],
      subject: `📸 Foto Photobooth Vokasi UB — ${now}`,
      html: htmlBody,
      attachments,
    });

    if (error) {
      console.error('❌ Resend error:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    console.log('✅ Email sent to:', email, '| ID:', data?.id);
    return NextResponse.json({ success: true, emailId: data?.id, photoCount: photos.length });

  } catch (err) {
    console.error('❌ Send email error:', err);
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}
