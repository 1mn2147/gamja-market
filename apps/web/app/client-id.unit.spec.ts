import { describe, expect, it } from 'vitest';
import { createClientId } from './client-id';

describe('createClientId', () => {
  it('uses randomUUID in secure browser contexts', () => {
    expect(createClientId({ randomUUID: () => '52a06fba-a61f-45cb-bb7c-aa9a530687aa' }))
      .toBe('52a06fba-a61f-45cb-bb7c-aa9a530687aa');
  });

  it('creates a valid UUID v4 when randomUUID is unavailable on HTTP origins', () => {
    const id = createClientId({
      getRandomValues(array) {
        new Uint8Array(array.buffer, array.byteOffset, array.byteLength).fill(0);
        return array;
      },
    });
    expect(id).toBe('00000000-0000-4000-8000-000000000000');
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });
});
