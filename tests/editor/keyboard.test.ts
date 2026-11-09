import { describe, it, expect } from 'vitest';
import { keyToCommand } from '@/editor/keyboard';

const k = (key: string, mods: Partial<{ ctrlKey: boolean; metaKey: boolean; shiftKey: boolean; isComposing: boolean; keyCode: number }> = {}) => ({
  key, ctrlKey: false, metaKey: false, shiftKey: false, ...mods,
});
const idle = { editing: false };

describe('keyToCommand', () => {
  it('maps the editor shortcuts', () => {
    expect(keyToCommand(k('Tab'), idle)).toBe('addChild');
    expect(keyToCommand(k('Enter'), idle)).toBe('addSibling');
    expect(keyToCommand(k('Delete'), idle)).toBe('delete');
    expect(keyToCommand(k('Backspace'), idle)).toBe('delete');
    expect(keyToCommand(k('F2'), idle)).toBe('edit');
    expect(keyToCommand(k('z', { ctrlKey: true }), idle)).toBe('undo');
    expect(keyToCommand(k('z', { metaKey: true }), idle)).toBe('undo');
    expect(keyToCommand(k('Z', { ctrlKey: true, shiftKey: true }), idle)).toBe('redo');
    expect(keyToCommand(k('y', { ctrlKey: true }), idle)).toBe('redo');
    expect(keyToCommand(k('s', { ctrlKey: true }), idle)).toBe('save');
  });

  it('ignores Enter while an IME is composing (Telex/VNI)', () => {
    expect(keyToCommand(k('Enter', { isComposing: true }), idle)).toBeNull();
    expect(keyToCommand(k('Enter', { keyCode: 229 }), idle)).toBeNull();
    expect(keyToCommand(k('Process'), idle)).toBeNull();
  });

  it('leaves keys to the text field while editing, except save', () => {
    expect(keyToCommand(k('Enter'), { editing: true })).toBeNull();
    expect(keyToCommand(k('Tab'), { editing: true })).toBeNull();
    expect(keyToCommand(k('Backspace'), { editing: true })).toBeNull();
    expect(keyToCommand(k('z', { ctrlKey: true }), { editing: true })).toBeNull();
    expect(keyToCommand(k('s', { ctrlKey: true }), { editing: true })).toBe('save');
  });

  it('plain letters do nothing', () => {
    expect(keyToCommand(k('a'), idle)).toBeNull();
  });
});
