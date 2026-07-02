import { getDownloadURL, ref, uploadBytes, uploadString } from 'firebase/storage';
import { storage } from '../firebase';

type UploadEditorImageParams =
  | {
      userId: string;
      scope: string;
      file: File;
      fileName?: string;
    }
  | {
      userId: string;
      scope: string;
      dataUrl: string;
      fileName?: string;
    };

const MIME_TO_EXTENSION: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
};

const sanitizeSegment = (value: string) => value.replace(/[^a-zA-Z0-9/_-]/g, '-');

const sanitizeName = (value: string) => value.replace(/[^a-zA-Z0-9._-]/g, '-');

const buildStoragePath = (userId: string, scope: string, fileName: string) => {
  const safeScope = sanitizeSegment(scope).replace(/\/+/g, '/');
  const safeName = sanitizeName(fileName);
  const randomSuffix = Math.random().toString(36).slice(2, 8);
  return `editor-images/${userId}/${safeScope}/${Date.now()}-${randomSuffix}-${safeName}`;
};

const extensionFromMime = (mimeType: string) => MIME_TO_EXTENSION[mimeType] || 'png';

const fileNameFromDataUrl = (dataUrl: string, fileName?: string) => {
  if (fileName) return fileName;
  const mimeMatch = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,/);
  const mimeType = mimeMatch?.[1] || 'image/png';
  return `image.${extensionFromMime(mimeType)}`;
};

export const uploadEditorImage = async (params: UploadEditorImageParams) => {
  const storagePath =
    'file' in params
      ? buildStoragePath(params.userId, params.scope, params.fileName || params.file.name || 'image')
      : buildStoragePath(params.userId, params.scope, fileNameFromDataUrl(params.dataUrl, params.fileName));

  const storageRef = ref(storage, storagePath);

  if ('file' in params) {
    await uploadBytes(storageRef, params.file, { contentType: params.file.type || 'image/png' });
  } else {
    await uploadString(storageRef, params.dataUrl, 'data_url');
  }

  return getDownloadURL(storageRef);
};

export const replaceInlineImagesWithStorageUrls = async (
  html: string,
  options: { userId: string; scope: string },
) => {
  if (!html || typeof window === 'undefined' || !html.includes('data:image/')) return html;

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const inlineImages = Array.from(doc.querySelectorAll('img')).filter((img) => {
    const src = img.getAttribute('src') || '';
    return src.startsWith('data:image/');
  });

  if (!inlineImages.length) return html;

  await Promise.all(
    inlineImages.map(async (img, index) => {
      const src = img.getAttribute('src') || '';
      const uploadUrl = await uploadEditorImage({
        userId: options.userId,
        scope: options.scope,
        dataUrl: src,
        fileName: `inline-${index + 1}.png`,
      });
      img.setAttribute('src', uploadUrl);
    }),
  );

  return doc.body.innerHTML;
};
