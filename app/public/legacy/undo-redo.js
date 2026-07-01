/* undo-redo.js — 실행취소/재실행 */
/* ── 실행 취소 / 재실행 히스토리 ── */

/* ══════════════════════════════════════════
   실행 취소 / 재실행
══════════════════════════════════════════ */
function saveHistory() {
  if (_isApplyingHistory || _isRendering) return;
  undoStack.push(collectData(true));
  redoStack = [];
  if (undoStack.length > _maxUndoHistory) undoStack.shift();
  _updateUndoRedoUI();
}

function performUndo() {
  if (!undoStack.length) return;
  _isApplyingHistory = true;
  redoStack.push(collectData(true));
  applyData(undoStack.pop());
  deselect();
  _isApplyingHistory = false;
  _updateUndoRedoUI();
}

function performRedo() {
  if (!redoStack.length) return;
  _isApplyingHistory = true;
  undoStack.push(collectData(true));
  applyData(redoStack.pop());
  deselect();
  _isApplyingHistory = false;
  _updateUndoRedoUI();
}

function _updateUndoRedoUI() {
  var u = document.getElementById('btn-undo');
  var r = document.getElementById('btn-redo');
  if (u) u.disabled = !undoStack.length;
  if (r) r.disabled = !redoStack.length;
}
