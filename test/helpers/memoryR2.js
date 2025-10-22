export function createMemoryR2() {
  const objects = new Map();

  return {
    store: objects,
    async put(key, value, options = {}) {
      let buffer;

      if (value instanceof ArrayBuffer) {
        buffer = value;
      } else if (value instanceof Uint8Array) {
        buffer = value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength);
      } else if (typeof value.arrayBuffer === 'function') {
        buffer = await value.arrayBuffer();
      } else {
        throw new Error('Unsupported R2 object type');
      }

      const bytes = new Uint8Array(buffer);
      objects.set(key, {
        bytes,
        httpMetadata: options.httpMetadata ?? {},
      });
      return { key };
    },
    async get(key) {
      const entry = objects.get(key);
      if (!entry) {
        return null;
      }
      const blob = new Blob([entry.bytes], {
        type: entry.httpMetadata.contentType ?? 'application/octet-stream',
      });
      return {
        body: blob.stream(),
        httpMetadata: entry.httpMetadata,
      };
    },
    async delete(key) {
      objects.delete(key);
    },
  };
}
