import type { CreateUploadResponse, ImageKind, ImageRef } from '@miscellary/shared';
import * as FileSystem from 'expo-file-system';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { apiFetch } from './api';

const CARD_ASPECT: [number, number] = [4, 5];
const OUTPUT_WIDTH = 1200;

// The system crop UI handles 4:5 framing; the image is resized before upload.
export async function takePhoto(): Promise<ImagePicker.ImagePickerAsset | null> {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) throw new Error('Camera permission is needed to photograph your item.');
  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: CARD_ASPECT,
    quality: 1,
  });
  return result.canceled ? null : (result.assets[0] ?? null);
}

export async function pickPhoto(): Promise<ImagePicker.ImagePickerAsset | null> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: CARD_ASPECT,
    quality: 1,
  });
  return result.canceled ? null : (result.assets[0] ?? null);
}

export async function uploadAsset(
  asset: ImagePicker.ImagePickerAsset,
  kind: ImageKind,
): Promise<ImageRef> {
  const resized = await ImageManipulator.manipulateAsync(
    asset.uri,
    asset.width > OUTPUT_WIDTH ? [{ resize: { width: OUTPUT_WIDTH } }] : [],
    { compress: 0.9, format: ImageManipulator.SaveFormat.JPEG },
  );

  const { image, upload_url, max_size } = await apiFetch<CreateUploadResponse>('/api/v1/uploads/', {
    method: 'POST',
    body: { kind, content_type: 'image/jpeg' },
  });
  const info = await FileSystem.getInfoAsync(resized.uri);
  if (info.exists && info.size > max_size) throw new Error('That image is too large (10 MB max).');

  const put = await FileSystem.uploadAsync(upload_url, resized.uri, {
    httpMethod: 'PUT',
    headers: { 'Content-Type': 'image/jpeg' },
    uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
  });
  if (put.status < 200 || put.status >= 300) throw new Error('Upload failed. Please try again.');

  return apiFetch<ImageRef>(`/api/v1/uploads/${image.id}/complete/`, {
    method: 'POST',
    body: { width: resized.width, height: resized.height },
  });
}
