import { NextResponse } from 'next/server';

export async function POST(req) {
  try {
    const formData = await req.formData();
    const file = formData.get('image');
    if (!file) {
      return NextResponse.json({ error: 'No image file provided' }, { status: 400 });
    }

    const apiKey = process.env.NEXT_PUBLIC_IMGBB_API_KEY || 'c52a3d353ee5e984e631296cdd631f1c';
    
    // Direct binary streaming using standard Multipart FormData
    // This avoids slow base64 conversions and CPU-heavy URL encoding serialization.
    const imgbbForm = new FormData();
    imgbbForm.append('image', file);

    const imgbbResponse = await fetch(`https://api.imgbb.com/1/upload?key=${apiKey}`, {
      method: 'POST',
      body: imgbbForm,
    });

    const result = await imgbbResponse.json();
    if (result.success) {
      return NextResponse.json({ url: result.data.url });
    } else {
      return NextResponse.json({ error: result.error?.message || 'ImgBB uploading failed' }, { status: 500 });
    }
  } catch (err) {
    console.error('Server Upload Catch Exception:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
