export const uploadToImgBB = async (file) => {
  const fileToBase64 = (f) => new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.readAsDataURL(f);
  });

  const formData = new FormData();
  formData.append('image', file);

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 seconds max timeout

    const response = await fetch('/api/upload', {
      method: 'POST',
      body: formData,
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    const data = await response.json();
    if (response.ok && data.url) {
      return data.url;
    } else {
      return await fileToBase64(file);
    }
  } catch (error) {
    console.warn('ImgBB upload timeout/fallback to Base64:', error);
    return await fileToBase64(file);
  }
};
