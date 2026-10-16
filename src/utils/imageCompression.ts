/**
 * Client-side image compression utility for DNI documents.
 * Compresses images to a maximum side length of 1280px and WebP quality 0.7
 * aiming for file sizes well under 500 KB.
 */

export interface CompressedImageResult {
  dataUrl: string;
  blob: Blob;
  width: number;
  height: number;
  sizeBytes: number;
}

export async function compressDniImage(
  source: File | Blob | string,
  maxSide = 1280,
  quality = 0.7
): Promise<CompressedImageResult> {
  return new Promise((resolve, reject) => {
    let srcUrl = '';
    let shouldRevoke = false;

    if (typeof source === 'string') {
      srcUrl = source;
    } else if (source && typeof source === 'object' && 'size' in source) {
      srcUrl = URL.createObjectURL(source as Blob);
      shouldRevoke = true;
    } else {
      return reject(new Error('Invalid source provided for image compression'));
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      try {
        const origWidth = img.naturalWidth || img.width;
        const origHeight = img.naturalHeight || img.height;

        let targetWidth = origWidth;
        let targetHeight = origHeight;

        if (origWidth > maxSide || origHeight > maxSide) {
          const ratio = Math.min(maxSide / origWidth, maxSide / origHeight);
          targetWidth = Math.round(origWidth * ratio);
          targetHeight = Math.round(origHeight * ratio);
        }

        const canvas = document.createElement('canvas');
        canvas.width = targetWidth;
        canvas.height = targetHeight;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          if (shouldRevoke) URL.revokeObjectURL(srcUrl);
          return reject(new Error('Canvas 2D context not available'));
        }

        // Draw scaled image
        ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

        // Convert to WebP format with quality 0.7
        const dataUrl = canvas.toDataURL('image/webp', quality);

        canvas.toBlob(
          (blob) => {
            if (shouldRevoke) URL.revokeObjectURL(srcUrl);
            if (!blob) {
              return reject(new Error('Failed to generate Blob from canvas'));
            }
            resolve({
              dataUrl,
              blob,
              width: targetWidth,
              height: targetHeight,
              sizeBytes: blob.size
            });
          },
          'image/webp',
          quality
        );
      } catch (err) {
        if (shouldRevoke) URL.revokeObjectURL(srcUrl);
        reject(err);
      }
    };

    img.onerror = (err) => {
      if (shouldRevoke) URL.revokeObjectURL(srcUrl);
      reject(new Error(`Failed to load image for compression: ${err}`));
    };

    img.src = srcUrl;
  });
}

/**
 * Converts a base64 or Data URL string to a standard Blob.
 */
export function dataUrlToBlob(dataUrl: string): Blob {
  const parts = dataUrl.split(';base64,');
  const contentType = parts[0]?.replace('data:', '') || 'image/webp';
  const raw = parts[1] || parts[0];
  const decoded = atob(raw);
  const uInt8Array = new Uint8Array(decoded.length);
  for (let i = 0; i < decoded.length; ++i) {
    uInt8Array[i] = decoded.charCodeAt(i);
  }
  return new Blob([uInt8Array], { type: contentType });
}
