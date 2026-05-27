import { Directory, Filesystem } from '@capacitor/filesystem';
import { blobToBase64 } from './blob-to-base64';

export async function saveViaFilesystem(
  fileName: string,
  blob: Blob,
): Promise<{ uri: string }> {
  const data = await blobToBase64(blob);
  const { uri } = await Filesystem.writeFile({
    path: fileName,
    data,
    directory: Directory.Documents,
    recursive: true,
  });
  return { uri };
}
