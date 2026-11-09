'use client';

import { memo, useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import type { MindNode } from '@/lib/types';
import { displayText } from '@/lib/tree';
import { isComposing } from './keyboard';

export interface NodeActions {
  /** text === null cancels the edit. */
  commitText(id: string, text: string | null): void;
  startEdit(id: string): void;
  toggleCollapse(id: string): void;
  openLink(id: string): void;
  /** Keys typed before the text box had focus. */
  takeTypeahead(): string;
}

export interface MindNodeData extends Record<string, unknown> {
  node: MindNode;
  isRoot: boolean;
  editing: boolean;
  readOnly: boolean;
  childCount: number;
  collapsed: boolean;
  /** null = no link; otherwise the target title, or dead=true when it no longer exists / is not visible. */
  link: { title: string | null; dead: boolean } | null;
  /** True while the "Nối" tool is waiting for a target. */
  connecting: boolean;
  actions: NodeActions;
}

export type MindFlowNode = Node<MindNodeData, 'mind'>;

const hidden: CSSProperties = { opacity: 0, width: 1, height: 1, minWidth: 0, minHeight: 0, border: 0, pointerEvents: 'none' };

function Editor({ node, actions }: { node: MindNode; actions: NodeActions }) {
  const [value, setValue] = useState(node.text);
  const ref = useRef<HTMLTextAreaElement>(null);
  const done = useRef(false);

  const finish = (text: string | null) => {
    if (done.current) return;
    done.current = true;
    actions.commitText(node.id, text);
  };

  useEffect(() => {
    // A freshly added node stays visibility:hidden until React Flow measures it, and hidden
    // elements can't take focus — retry for a few frames.
    let timer: ReturnType<typeof setTimeout> | undefined;
    let tries = 0;
    const tryFocus = () => {
      const el = ref.current;
      if (!el) return;
      el.focus({ preventScroll: true });
      if (document.activeElement === el) {
        const early = actions.takeTypeahead();
        if (early) {
          const v = el.value + early;
          setValue(v);
          setTimeout(() => el.setSelectionRange(v.length, v.length), 0);
        } else {
          el.select();
        }
      } else if (tries++ < 50) {
        timer = setTimeout(tryFocus, 20);
      } else {
        // never got focus: leave edit mode so the keyboard is not stuck swallowing keys
        finish(null);
      }
    };
    tryFocus();
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    e.stopPropagation();
    if (isComposing({ ...e, isComposing: e.nativeEvent.isComposing, keyCode: e.keyCode })) return;
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      finish(value);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      finish(null);
    } else if (e.key === 'Tab') {
      e.preventDefault();
      finish(value);
    }
  };

  return (
    <textarea
      ref={ref}
      aria-label="Nội dung ý"
      className="nodrag nowheel nopan mm-node-input"
      value={value}
      rows={Math.max(1, value.split('\n').length)}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={onKeyDown}
      onBlur={() => finish(value)}
    />
  );
}

export function MindNodeBody({ data, selected }: { data: MindNodeData; selected: boolean }) {
  const { node, isRoot, editing, readOnly, childCount, collapsed, link, connecting, actions } = data;
  const side = node.side ?? 'right';
  const style = { '--node-color': node.color } as CSSProperties;

  return (
    <div className="mm-node-wrap" style={style}>
      <Handle id="ls" type="source" position={Position.Left} isConnectable={false} style={hidden} />
      <Handle id="lt" type="target" position={Position.Left} isConnectable={false} style={hidden} />
      <Handle id="rs" type="source" position={Position.Right} isConnectable={false} style={hidden} />
      <Handle id="rt" type="target" position={Position.Right} isConnectable={false} style={hidden} />
      {/* Center anchors for cross-link connections (geometry is computed in ConnectionEdge). */}
      <Handle id="c0" type="source" position={Position.Top} isConnectable={false} style={{ ...hidden, top: '50%', left: '50%' }} />
      <Handle id="ct" type="target" position={Position.Top} isConnectableStart={false} style={{ ...hidden, top: '50%', left: '50%' }} />

      <div
        data-shape={node.shape}
        className={[
          'mm-node',
          `mm-shape-${node.shape}`,
          isRoot ? 'mm-root' : '',
          selected ? 'mm-selected' : '',
          connecting ? 'mm-connect-target' : '',
        ].join(' ')}
        onDoubleClick={(e) => {
          if (readOnly) return;
          e.stopPropagation();
          actions.startEdit(node.id);
        }}
      >
        {editing && !readOnly ? (
          <Editor node={node} actions={actions} />
        ) : (
          <span className={node.text.trim() ? '' : 'mm-placeholder'}>{displayText(node)}</span>
        )}
        {link && (
          <button
            type="button"
            className={`nodrag mm-link ${link.dead ? 'mm-link-dead' : ''}`}
            title={link.dead ? 'mindmap không còn tồn tại' : link.title ? `Mở «${link.title}»` : 'Mở mindmap liên kết'}
            aria-label="Mở mindmap liên kết"
            onClick={(e) => {
              e.stopPropagation();
              actions.openLink(node.id);
            }}
          >
            ↗
          </button>
        )}
      </div>

      {!readOnly && !isRoot && (
        <Handle
          id="cs"
          type="source"
          position={Position.Bottom}
          className="mm-connect-dot"
          title="Kéo để nối tới ý khác"
        />
      )}

      {childCount > 0 && !isRoot && (
        <button
          type="button"
          aria-label={collapsed ? 'Mở nhánh' : 'Thu gọn nhánh'}
          className={`nodrag mm-collapse ${side === 'left' ? 'mm-collapse-left' : 'mm-collapse-right'}`}
          onClick={(e) => {
            e.stopPropagation();
            actions.toggleCollapse(node.id);
          }}
        >
          {collapsed ? childCount : '−'}
        </button>
      )}
    </div>
  );
}

function MindNodeView({ data, selected }: NodeProps<MindFlowNode>) {
  return <MindNodeBody data={data} selected={!!selected} />;
}

export default memo(MindNodeView);
