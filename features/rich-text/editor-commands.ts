// Formatting manipulates a selected fragment; React never rewrites a focused editor.
export function insertEditorNode(editor: HTMLElement, node: Node): void {
  const selection = window.getSelection();
  if (!selection?.rangeCount || !editor.contains(selection.anchorNode)) {
    editor.append(node);
    return;
  }
  const range = selection.getRangeAt(0);
  const last = node instanceof DocumentFragment ? node.lastChild : node;
  range.deleteContents();
  range.insertNode(node);
  if (last) range.setStartAfter(last);
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);
}
// Keep native formatting isolated until a structured editor passes feature-parity
// tests: caret formatting, toggles, list splitting and browser undo must survive.
export function formatSelection(
  editor: HTMLElement,
  command: string,
  argument?: string,
): void {
  const selection = window.getSelection();
  if (!selection?.rangeCount || !editor.contains(selection.anchorNode)) return;
  editor.focus();
  document.execCommand(command, false, argument);
}
