import { afterEach, describe, expect, it, vi } from 'vitest';

const { initializeAppearance, initializeShell } = vi.hoisted(() => ({
  initializeAppearance: vi.fn(),
  initializeShell: vi.fn(() => vi.fn()),
}));

vi.mock('@/services/appearance', () => ({ initializeAppearance }));
vi.mock('@/services/nasShell', () => ({ initializeShell }));

afterEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
});

describe('initializeShell bootstrap', () => {
  it('initializes appearance and the NAS shell integration', async () => {
    await import('@/services/initializeShell');

    expect(initializeAppearance).toHaveBeenCalledOnce();
    expect(initializeShell).toHaveBeenCalledOnce();
  });
});
