export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error('FileReader failed'));
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== 'string') {
        reject(new Error('FileReader result is not a string'));
        return;
      }
      const commaIndex = result.indexOf(',');
      resolve(commaIndex === -1 ? '' : result.slice(commaIndex + 1));
    };
    reader.readAsDataURL(blob);
  });
}
