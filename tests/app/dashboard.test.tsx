// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within, act } from '@testing-library/react';
import { Dashboard } from '@/app/_dashboard/Dashboard';
import { foldVi, relativeTimeVi } from '@/lib/text';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }) }));

const NOW = new Date('2026-11-09T12:00:00Z');
const maps = [
  { id: '1', title: 'Cũ', updated_at: '2026-11-01T12:00:00Z' },
  { id: '2', title: 'Dự án Alpha', updated_at: '2026-11-09T10:00:00Z' },
  { id: '3', title: 'Kế hoạch', updated_at: '2026-11-09T11:59:30Z' },
];

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('text helpers', () => {
  it('folds Vietnamese diacritics and case', () => {
    expect(foldVi('Dự Án Đường')).toBe('du an duong');
  });
  it('formats relative time in Vietnamese', () => {
    expect(relativeTimeVi('2026-11-09T10:00:00Z', NOW)).toBe('2 giờ trước');
    expect(relativeTimeVi('2026-11-01T12:00:00Z', NOW)).toBe('8 ngày trước');
    expect(relativeTimeVi('2026-11-09T11:59:30Z', NOW)).toBe('vừa xong');
  });
});

describe('Dashboard', () => {
  it('lists maps newest first with relative times', () => {
    render(<Dashboard initialMaps={maps} now={NOW} />);
    const titles = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
    expect(titles).toEqual(['Kế hoạch', 'Dự án Alpha', 'Cũ']);
    expect(screen.getByText(/2 giờ trước/)).toBeInTheDocument();
  });

  it('search ignores case and diacritics', () => {
    render(<Dashboard initialMaps={maps} now={NOW} />);
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'du an' } });
    const titles = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
    expect(titles).toEqual(['Dự án Alpha']);
  });

  it('asks for confirmation before deleting', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 204 }));
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<Dashboard initialMaps={maps} now={NOW} />);
    const card = screen.getByRole('heading', { name: 'Cũ' }).closest('article')!;
    fireEvent.click(within(card).getByRole('button', { name: 'Thao tác' }));
    fireEvent.click(within(card).getByRole('menuitem', { name: 'Xóa' }));
    expect(confirm).toHaveBeenCalledWith('Xóa mindmap này? Không thể hoàn tác.');
    expect(fetchMock).not.toHaveBeenCalled();

    confirm.mockReturnValue(true);
    fireEvent.click(within(card).getByRole('button', { name: 'Thao tác' }));
    await act(async () => {
      fireEvent.click(within(card).getByRole('menuitem', { name: 'Xóa' }));
    });
    expect(fetchMock).toHaveBeenCalledWith('/api/maps/1', expect.objectContaining({ method: 'DELETE' }));
    expect(screen.queryByRole('heading', { name: 'Cũ' })).toBeNull();
  });

  it('shows an empty state', () => {
    render(<Dashboard initialMaps={[]} now={NOW} />);
    expect(screen.getByText(/Chưa có mindmap nào/)).toBeInTheDocument();
  });
});
