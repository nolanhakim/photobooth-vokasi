import { google } from 'googleapis';
import { NextRequest, NextResponse } from 'next/server';
import { Readable } from 'stream';

export async function POST(request: NextRequest) {
  try {
    const { photo, width, height, timestamp } = await request.json();

    if (!photo) {
      return NextResponse.json({ error: 'No photo data' }, { status: 400 });
    }

    console.log('📸 Photo received:', width, 'x', height);

    // Extract base64 data
    const base64Data = photo.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');
    
    const fileSizeMB = (buffer.length / 1024 / 1024).toFixed(2);
    console.log('💾 Buffer size:', fileSizeMB, 'MB');

    // Convert buffer to stream
    const stream = Readable.from(buffer);

    // Google Drive authentication
    const auth = new google.auth.GoogleAuth({
      keyFile: process.cwd() + '/credentials.json',
      scopes: ['https://www.googleapis.com/auth/drive'],
    });

    const drive = google.drive({ version: 'v3', auth });
    const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID!;
    
    const fileName = `vokasi-${timestamp || Date.now()}.png`;

    console.log('⬆️ Uploading to Google Drive:', fileName);

    // Upload to Google Drive
    const upload = await drive.files.create({
      requestBody: {
        name: fileName,
        parents: [folderId],
        description: `Photo captured at ${width}x${height} resolution`,
      },
      media: {
        mimeType: 'image/png',
        body: stream,
      },
      supportsAllDrives: true,
    });

    console.log('✅ Upload success:', fileName, 'ID:', upload.data.id);

    return NextResponse.json({
      success: true,
      fileId: upload.data.id,
      fileName,
      fileSize: fileSizeMB + ' MB',
      resolution: `${width}x${height}`,
    });
  } catch (err) {
    console.error('❌ UPLOAD ERROR:', err);
    return NextResponse.json(
      { success: false, error: String(err) },
      { status: 500 }
    );
  }
}