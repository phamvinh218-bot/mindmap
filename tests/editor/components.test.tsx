// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ReactFlowProvider } from '@xyflow/react';
import { MindNodeBody, type MindNodeData } from '@/editor/MindNodeView';
import { NodePanel } from '@/editor/NodePanel';
import { SHAPES, PALETTE, type MindNode } from '@/lib/types';

const baseNode: MindNode = { id: 'n1', parentId: 'r', text: '', color: '#2f6fdf', shape: 'rounded', x: 0, y: 0, side: 'right' };

function data(over: Partial<MindNodeData> = {}): MindNodeData {
  return {
    node: baseNode, isRoot: false, editing: false, readOnly: false, childCount: 0, collapsed: false,
    link: null, connecting: false,
    actions: { commitText: vi.fn(), startEdit: vi.fn(), toggleCollapse: vi.fn(), openLink: vi.fn(), takeTypeahead: vi.fn(() => '') },
    ...over,
  };
}
const renderNode = (d: MindNodeData) =>
  render(
    <ReactFlowProvider>
      <MindNodeBody data={d} selected={false} />
    </ReactFlowProvider>,
  );

describe('MindNodeBody', () => {
  it('shows the placeholder for empty text', () => {
    renderNode(data());
    expect(screen.getByText('Ý mới')).toBeInTheDocument();
  });

  it('gives every shape its own class', () => {
    const classes = SHAPES.map((shape) => {
      const { container, unmount } = renderNode(data({ node: { ...baseNode, shape } }));
      const cls = container.querySelector('[data-shape]')!.className;
      unmount();
      return cls;
    });
    SHAPES.forEach((s, i) => expect(classes[i]).toContain(`mm-shape-${s}`));
    expect(new Set(classes).size).toBe(SHAPES.length);
  });

  it('double-click starts editing, but not when read-only', () => {
    const d = data();
    renderNode(d);
    fireEvent.doubleClick(screen.getByText('Ý mới'));
    expect(d.actions.startEdit).toHaveBeenCalledWith('n1');
    const ro = data({ readOnly: true });
    renderNode(ro);
    fireEvent.doubleClick(screen.getAllByText('Ý mới')[1]);
    expect(ro.actions.startEdit).not.toHaveBeenCalled();
  });

  it('Enter commits, Shift+Enter does not, Enter during IME composition does not', () => {
    const d = data({ editing: true, node: { ...baseNode, text: 'Xin chao' } });
    renderNode(d);
    const ta = screen.getByRole('textbox');
    fireEvent.change(ta, { target: { value: 'Xin chào' } });
    fireEvent.keyDown(ta, { key: 'Enter', isComposing: true });
    fireEvent.keyDown(ta, { key: 'Enter', keyCode: 229 });
    fireEvent.keyDown(ta, { key: 'Enter', shiftKey: true });
    expect(d.actions.commitText).not.toHaveBeenCalled();
    fireEvent.keyDown(ta, { key: 'Enter' });
    expect(d.actions.commitText).toHaveBeenCalledWith('n1', 'Xin chào');
  });

  it('Escape cancels editing without changing text', () => {
    const d = data({ editing: true, node: { ...baseNode, text: 'A' } });
    renderNode(d);
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Escape' });
    expect(d.actions.commitText).toHaveBeenCalledWith('n1', null);
  });

  it('shows the hidden-children count on a collapsed node', () => {
    renderNode(data({ childCount: 3, collapsed: true }));
    expect(screen.getByRole('button', { name: /mở nhánh/i })).toHaveTextContent('3');
  });
});

describe('NodePanel', () => {
  const linked: MindNode = { ...baseNode, linkMapId: 'gone' };

  it('reports a link to a deleted map and lets the owner remove it', () => {
    const onNodesPatch = vi.fn();
    render(<NodePanel nodes={[linked]} edge={null} mode="owner" maps={[{ id: 'm2', title: 'Khác' }]} currentMapId="m1"
      onNodesPatch={onNodesPatch} onEdgePatch={vi.fn()} onDeleteEdge={vi.fn()} />);
    expect(screen.getByText('mindmap không còn tồn tại')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Gỡ link' }));
    expect(onNodesPatch).toHaveBeenCalledWith({ linkMapId: null }, false);
  });

  it('applies a color to the subtree only when the checkbox is ticked', () => {
    const onNodesPatch = vi.fn();
    render(<NodePanel nodes={[baseNode]} edge={null} mode="owner" maps={[]} currentMapId="m1"
      onNodesPatch={onNodesPatch} onEdgePatch={vi.fn()} onDeleteEdge={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: `Màu ${PALETTE[2]}` }));
    expect(onNodesPatch).toHaveBeenLastCalledWith({ color: PALETTE[2] }, false);
    fireEvent.click(screen.getByLabelText('Áp cho nhánh con'));
    fireEvent.click(screen.getByRole('button', { name: `Màu ${PALETTE[3]}` }));
    expect(onNodesPatch).toHaveBeenLastCalledWith({ color: PALETTE[3] }, true);
  });

  it('changes shape', () => {
    const onNodesPatch = vi.fn();
    render(<NodePanel nodes={[baseNode]} edge={null} mode="edit" maps={[]} currentMapId="m1"
      onNodesPatch={onNodesPatch} onEdgePatch={vi.fn()} onDeleteEdge={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Hình elip' }));
    expect(onNodesPatch).toHaveBeenCalledWith({ shape: 'ellipse' }, false);
  });

  it('hides the map-link picker for partners', () => {
    render(<NodePanel nodes={[baseNode]} edge={null} mode="edit" maps={[]} currentMapId="m1"
      onNodesPatch={vi.fn()} onEdgePatch={vi.fn()} onDeleteEdge={vi.fn()} />);
    expect(screen.queryByLabelText('Link tới mindmap')).toBeNull();
  });

  it('for a connection shows only colors and delete', () => {
    const onDeleteEdge = vi.fn();
    const onEdgePatch = vi.fn();
    render(<NodePanel nodes={[]} edge={{ id: 'e', from: 'a', to: 'b', color: '#000' }} mode="owner" maps={[]} currentMapId="m1"
      onNodesPatch={vi.fn()} onEdgePatch={onEdgePatch} onDeleteEdge={onDeleteEdge} />);
    expect(screen.queryByRole('button', { name: 'Hình elip' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: `Màu ${PALETTE[0]}` }));
    expect(onEdgePatch).toHaveBeenCalledWith({ color: PALETTE[0] });
    fireEvent.click(screen.getByRole('button', { name: 'Xóa đường nối' }));
    expect(onDeleteEdge).toHaveBeenCalled();
  });
});
