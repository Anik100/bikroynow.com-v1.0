import { compressImage } from './utils';

export const uploadToImgBB = async (file) => {
  // Compress client-side to max 1280px / 0.8 JPEG before uploading (~100-150KB)
  let uploadFile = file;
  if (typeof window !== 'undefined' && file && file.type && file.type.startsWith('image/')) {
    try {
      uploadFile = await compressImage(file, 1280, 1280, 0.8);
    } catch (e) {
      console.warn('Canvas pre-upload compression fallback to original:', e);
    }
  }

  const formData = new FormData();
  formData.append('image', uploadFile);

  // 1. Try server-side upload proxy
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000); // 20 seconds timeout

    const response = await fetch('/api/upload', {
      method: 'POST',
      body: formData,
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    const data = await response.json();
    if (response.ok && data.url) {
      return data.url;
    }
  } catch (error) {
    console.warn('Server upload failed or timed out, trying direct ImgBB upload...', error);
  }

  // 2. Fallback: Direct client-to-ImgBB upload
  try {
    const apiKey = process.env.NEXT_PUBLIC_IMGBB_API_KEY || 'c52a3d353ee5e984e631296cdd631f1c';
    const directForm = new FormData();
    directForm.append('image', uploadFile);

    const directRes = await fetch(`https://api.imgbb.com/1/upload?key=${apiKey}`, {
      method: 'POST',
      body: directForm
    });

    const directData = await directRes.json();
    if (directRes.ok && directData?.data?.url) {
      return directData.data.url;
    }
  } catch (directErr) {
    console.error('Direct ImgBB upload failed:', directErr);
  }

  throw new Error('Failed to upload image to ImgBB');
};
