import type { CreateUploadResponse, ImageKind, ImageRef } from '@miscellary/shared';
import * as FileSystem from 'expo-file-system';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { apiFetch } from './api';

const CARD_ASPECT: [number, number] = [4, 5];
const OUTPUT_WIDTH = 1200;
const WHOLE_PHOTO_SIDE = 2000;

// The system crop UI wants whole numbers, and every aspect the editor asks for
// is a simple ratio, so a hundredth is finer than any of them need.
function cropAspect(aspect: number): [number, number] {
  if (!Number.isFinite(aspect) || aspect <= 0) return CARD_ASPECT;
  return [Math.round(aspect * 100), 100];
}

const crops = (aspect: number) => Number.isFinite(aspect) && aspect > 0;

// The system crop UI handles framing; the image is resized before upload.
export async function takePhoto(
  aspect: number = CARD_ASPECT[0] / CARD_ASPECT[1],
): Promise<ImagePicker.ImagePickerAsset | null> {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) throw new Error('Camera permission is needed to photograph your item.');
  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ['images'],
    allowsEditing: crops(aspect),
    ...(crops(aspect) ? { aspect: cropAspect(aspect) } : {}),
    quality: 1,
  });
  return result.canceled ? null : (result.assets[0] ?? null);
}

export async function pickPhoto(
  aspect: number = CARD_ASPECT[0] / CARD_ASPECT[1],
): Promise<ImagePicker.ImagePickerAsset | null> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: crops(aspect),
    ...(crops(aspect) ? { aspect: cropAspect(aspect) } : {}),
    quality: 1,
  });
  return result.canceled ? null : (result.assets[0] ?? null);
}

export type PhotoSource = 'camera' | 'library';

export async function pickAndUpload(
  kind: ImageKind,
  aspect: number,
  ask: () => Promise<PhotoSource | null>,
): Promise<ImageRef | null> {
  const source = await ask();
  if (!source) return null;
  const asset = source === 'camera' ? await takePhoto(aspect) : await pickPhoto(aspect);
  return asset ? uploadAsset(asset, kind, crops(aspect)) : null;
}

export async function uploadAsset(
  asset: ImagePicker.ImagePickerAsset,
  kind: ImageKind,
  cropped = true,
): Promise<ImageRef> {
  const longest = Math.max(asset.width, asset.height);
  const resize = cropped
    ? asset.width > OUTPUT_WIDTH
      ? { width: OUTPUT_WIDTH }
      : null
    : longest > WHOLE_PHOTO_SIDE
      ? asset.width >= asset.height
        ? { width: WHOLE_PHOTO_SIDE }
        : { height: WHOLE_PHOTO_SIDE }
      : null;
  const resized = await ImageManipulator.manipulateAsync(asset.uri, resize ? [{ resize }] : [], {
    compress: 0.9,
    format: ImageManipulator.SaveFormat.JPEG,
  });

  const { image, upload_url, max_size } = await apiFetch<CreateUploadResponse>('/api/v1/uploads/', {
    method: 'POST',
    body: { kind, content_type: 'image/jpeg' },
  });
  const info = await FileSystem.getInfoAsync(resized.uri);
  if (info.exists && info.size > max_size) throw new Error('That image is too large (10 MB max).');

  const put = await FileSystem.uploadAsync(upload_url, resized.uri, {
    httpMethod: 'PUT',
    headers: {
      'Content-Type': 'image/jpeg',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
    uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
  });
  if (put.status < 200 || put.status >= 300) throw new Error('Upload failed. Please try again.');

  return apiFetch<ImageRef>(`/api/v1/uploads/${image.id}/complete/`, {
    method: 'POST',
    body: { width: resized.width, height: resized.height },
  });
}
