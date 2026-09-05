import type { CreateUploadResponse, ImageKind, ImageRef } from '@miscellary/shared';
import { apiFetch } from './api';

async function dimensions(blob: Blob): Promise<{ width: number; height: number }> {
  const bitmap = await createImageBitmap(blob);
  const size = { width: bitmap.width, height: bitmap.height };
  bitmap.close();
  return size;
}

export async function uploadImage(blob: Blob, kind: ImageKind): Promise<ImageRef> {
  const contentType = blob.type || 'image/jpeg';
  const { image, upload_url, max_size } = await apiFetch<CreateUploadResponse>('/api/v1/uploads/', {
    method: 'POST',
    body: { kind, content_type: contentType },
  });
  if (blob.size > max_size) throw new Error('That image is too large (10 MB max).');

  const put = await fetch(upload_url, {
    method: 'PUT',
    body: blob,
    headers: { 'Content-Type': contentType },
  });
  if (!put.ok) throw new Error('Upload failed. Please try again.');

  const size = await dimensions(blob);
  return apiFetch<ImageRef>(`/api/v1/uploads/${image.id}/complete/`, {
    method: 'POST',
    body: size,
  });
}

export async function cropToBlob(
  file: File,
  area: { x: number; y: number; width: number; height: number },
  outputWidth = 1200,
): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = outputWidth / area.width;
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(area.width * scale);
  canvas.height = Math.round(area.height * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not process the image.');
  ctx.drawImage(bitmap, area.x, area.y, area.width, area.height, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Could not process the image.'))),
      'image/jpeg',
      0.9,
    );
  });
}

// Preserve PNG alpha when resizing pack artwork.
export async function artToBlob(file: File, maxWidth = 1400): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  if (bitmap.width <= maxWidth) {
    bitmap.close();
    return file;
  }
  const scale = maxWidth / bitmap.width;
  const canvas = document.createElement('canvas');
  canvas.width = maxWidth;
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not process the image.');
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Could not process the image.'))),
      'image/png',
    );
  });
}
