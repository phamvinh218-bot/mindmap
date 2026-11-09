export type Command = 'addChild' | 'addSibling' | 'delete' | 'edit' | 'undo' | 'redo' | 'save' | null;

export interface KeyLike {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
  isComposing?: boolean;
  keyCode?: number;
}

/** True while an IME (Vietnamese Telex/VNI, etc.) is composing a character. */
export function isComposing(e: KeyLike): boolean {
  return !!e.isComposing || e.keyCode === 229 || e.key === 'Process';
}

export function keyToCommand(e: KeyLike, ctx: { editing: boolean }): Command {
  if (isComposing(e)) return null;
  const mod = e.ctrlKey || e.metaKey;
  const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  if (mod && key === 's') return 'save';
  if (ctx.editing) return null;
  if (mod && key === 'z') return e.shiftKey ? 'redo' : 'undo';
  if (mod && key === 'y') return 'redo';
  if (mod) return null;
  switch (key) {
    case 'Tab':
      return 'addChild';
    case 'Enter':
      return 'addSibling';
    case 'Delete':
    case 'Backspace':
      return 'delete';
    case 'F2':
      return 'edit';
    default:
      return null;
  }
}
