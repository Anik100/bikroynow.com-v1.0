export const uploadToImgBB = async (file) => {
  const formData = new FormData();
  formData.append('image', file);

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
    directForm.append('image', file);

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
