import { google } from 'googleapis';
import { NextRequest, NextResponse } from 'next/server';
import { PassThrough } from 'stream';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('photo') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    // convert file → buffer
    const buffer = Buffer.from(await file.arrayBuffer());

    // buffer → stream (WAJIB pakai PassThrough)
    const stream = new PassThrough();
    stream.end(buffer);

    const auth = new google.auth.GoogleAuth({
      keyFile: process.cwd() + '/credentials.json',
      scopes: ['https://www.googleapis.com/auth/drive'],
    });

    const drive = google.drive({ version: 'v3', auth });

    const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID!;
    const fileName = `photo-${Date.now()}.jpg`;

    const upload = await drive.files.create({
      requestBody: {
        name: fileName,
        parents: [folderId],
      },
      media: {
        mimeType: 'image/jpeg',
        body: stream, // ✅ FIX UTAMA
      },
      supportsAllDrives: true, // wajib untuk Shared Drive
    });

    return NextResponse.json({
      success: true,
      fileId: upload.data.id,
      fileName,
    });
  } catch (err) {
    console.error('UPLOAD ERROR:', err);
    return NextResponse.json(
      { success: false, error: String(err) },
      { status: 500 }
    );
  }
}
