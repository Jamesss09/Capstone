import { fetch as expoFetch } from 'expo/fetch';
import { File, Paths } from 'expo-file-system';

export async function persistAnswerSheetPhoto(uri: string, mimeType = 'image/jpeg'): Promise<string> {
  const extension = mimeType === 'image/png' || uri.toLowerCase().includes('.png') ? 'png' : 'jpg';
  const destination = new File(
    Paths.cache,
    `answer-sheet-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extension}`,
  );
  const source = new File(uri);

  if (source.exists && source.size > 0) {
    await source.copy(destination);
  } else {
    const response = await expoFetch(uri);
    const bytes = await response.bytes();

    if (bytes.length === 0) {
      throw new Error('The selected image is empty.');
    }

    destination.create();
    await destination.write(bytes);
  }

  if (!destination.exists || destination.size === 0) {
    throw new Error('The selected image could not be saved for processing.');
  }

  return destination.uri;
}
