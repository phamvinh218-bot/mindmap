// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { ShareDialog } from '@/editor/ShareDialog';

const share = (over: Record<string, unknown> = {}) => ({
  id: 's1', label: 'Partner Minh', permission: 'edit', enabled: true,
  url: 'http://localhost/s/abc', created_at: '2026-11-09T00:00:00Z', last_used_at: null, ...over,
});

let calls: { url: string; init?: RequestInit }[];
beforeEach(() => {
  calls = [];
  vi.restoreAllMocks();
});

function mockFetch(handler: (url: string, init?: RequestInit) => Response) {
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (u, init) => {
    calls.push({ url: String(u), init });
    return handler(String(u), init);
  });
}

describe('ShareDialog', () => {
  it('creates a link and shows its full URL with a copy button', async () => {
    mockFetch((url, init) =>
      init?.method === 'POST' ? Response.json(share({ id: 's2', url: 'http://localhost/s/NEW' })) : Response.json([]),
    );
    await act(async () => {
      render(<ShareDialog mapId="m1" onClose={vi.fn()} />);
    });
    fireEvent.change(screen.getByLabelText('Mật khẩu cho link'), { target: { value: 'bimat1' } });
    fireEvent.change(screen.getByLabelText('Quyền'), { target: { value: 'view' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Tạo link' }));
    });
    const post = calls.find((c) => c.init?.method === 'POST')!;
    expect(post.url).toBe('/api/maps/m1/shares');
    expect(JSON.parse(String(post.init!.body))).toMatchObject({ permission: 'view', password: 'bimat1' });
    expect(screen.getByDisplayValue('http://localhost/s/NEW')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Sao chép' }).length).toBeGreaterThan(0);
  });

  it('blocks passwords shorter than 4 characters', async () => {
    mockFetch(() => Response.json([]));
    await act(async () => {
      render(<ShareDialog mapId="m1" onClose={vi.fn()} />);
    });
    fireEvent.change(screen.getByLabelText('Mật khẩu cho link'), { target: { value: '12' } });
    expect(screen.getByRole('button', { name: 'Tạo link' })).toBeDisabled();
  });

  it('toggling a link off calls PATCH with enabled=false', async () => {
    mockFetch((_url, init) =>
      init?.method === 'PATCH' ? Response.json(share({ enabled: false })) : Response.json([share()]),
    );
    await act(async () => {
      render(<ShareDialog mapId="m1" onClose={vi.fn()} />);
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Tắt' }));
    });
    const patch = calls.find((c) => c.init?.method === 'PATCH')!;
    expect(patch.url).toBe('/api/shares/s1');
    expect(JSON.parse(String(patch.init!.body))).toEqual({ enabled: false });
    expect(screen.getByRole('button', { name: 'Bật' })).toBeInTheDocument();
  });
});
