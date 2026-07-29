export const uploadToImgBB = async (file) => {
  const formData = new FormData();
  formData.append('image', file);

  try {
    const response = await fetch('/api/upload', {
      method: 'POST',
      body: formData,
    });

    const data = await response.json();
    if (response.ok && data.url) {
      return data.url;
    } else {
      throw new Error(data.error || 'Failed to upload image via server proxy');
    }
  } catch (error) {
    console.error('Client ImgBB Proxy Upload Error:', error);
    throw error;
  }
};
