/**
 * Shrinks a photo in the browser before upload: longest side ≤ maxDim, re-encoded as WebP
 * (JPEG where WebP encoding is unsupported). Phone photos drop from 4–8 MB to a few hundred KB,
 * so listings load fast on mobile data. Files that are already small, or can't be decoded, pass through.
 */
export async function compressImage(file: File, maxDim = 1920, quality = 0.82): Promise<File> {
  if (!file.type.startsWith('image/') || file.size < 300 * 1024) {
    return file;
  }

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return file; // e.g. AVIF on browsers without a decoder: upload as-is, the server still validates it
  }

  const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  const blob = await toBlob(canvas, 'image/webp', quality) ?? await toBlob(canvas, 'image/jpeg', quality);
  if (!blob || blob.size >= file.size) {
    return file;
  }

  const ext = blob.type === 'image/webp' ? '.webp' : '.jpg';
  return new File([blob], file.name.replace(/\.[^.]+$/, '') + ext, { type: blob.type });
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise(resolve => canvas.toBlob(b => resolve(b && b.type === type ? b : null), type, quality));
}
