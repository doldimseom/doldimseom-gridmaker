/* ui-nav.js — 리팩토링 2단계 10번째 조각: 그룹 선택/정렬 + 정렬 툴바 + 컨텍스트 메뉴 + 캔버스 패널 전환 + 캔버스 클릭 처리 (app/public/legacy/main.js에서 추출, 로직 변경 없음) */
/* ══════════════════════════════════════════
   그룹 선택 / 해제
══════════════════════════════════════════ */
function selectGroup(gi, innerEl) {
  /* 이미지 편집 모드는 종료 (편집 중 그룹 조작 방지) */
  if (activeImgKey) exitImgEditMode();
  selectedGi = gi;
  /* 모든 group-inner에서 grp-selected 제거 후 해당 inner에만 적용 */
  document.querySelectorAll('.group-inner').forEach(function(el) {
    el.classList.remove('grp-selected');
  });
  /* 모든 그룹 높이 핸들 숨김 */
  document.querySelectorAll('.grp-height-handle').forEach(function(el) {
    el.classList.remove('visible');
  });
  /* 모든 dock-tb 숨김 */
  document.querySelectorAll('.dock-tb').forEach(function(el) {
    el.classList.remove('visible');
  });
  if (innerEl) {
    innerEl.classList.add('grp-selected');
    /* 해당 그룹의 높이 핸들 표시 */
    var g = innerEl.closest('.group');
    if (g) {
      var hh = g.querySelector('.grp-height-handle');
      if (hh) hh.classList.add('visible');
      /* dock-tb 표시 */
      var dock = g.querySelector('.dock-tb');
      if (dock) dock.classList.add('visible');
    }
  }
}

function deselectGroup() {
  selectedGi = null;
  selKeys = []; selKey = null;
  hideGroupToolbar();
  document.querySelectorAll('.group-inner').forEach(function(el) {
    el.classList.remove('grp-selected');
  });
  document.querySelectorAll('.grp-height-handle').forEach(function(el) {
    el.classList.remove('visible');
  });
  document.querySelectorAll('.dock-tb').forEach(function(el) {
    el.classList.remove('visible');
  });
  /* 블록이 선택된 상태면 패널 유지, 아니면 캔버스 설정으로 복귀 */
  if (!selKey) showCanvasPanel();
}

/* ══════════════════════════════════════════
   높이 맞추기 (기능 2)
══════════════════════════════════════════ */
function alignGroupHeight(mode) {
  if (selectedGi === null) return;
  var grp = _grp(selectedGi);
  if (!grp || grp.cols.length < 2) { showToast('열이 2개 이상이어야 합니다'); return; }

  /* 각 열의 총 높이 계산 */
  var colHeights = grp.cols.map(function(col) {
    return col.rows.reduce(function(s, r) { return s + r.h; }, 0)
           + gaps.blk * Math.max(0, col.rows.length - 1);
  });

  var targetH = (mode === 'max')
    ? Math.max.apply(null, colHeights)
    : Math.min.apply(null, colHeights);

  var skipped = 0;
  grp.cols.forEach(function(col, ci) {
    var currentH = colHeights[ci];
    if (currentH === targetH) return;
    var lastBi = col.rows.length - 1;
    var lastBlk = col.rows[lastBi];
    var diff = targetH - currentH;
    var newH = lastBlk.h + diff;
    /* 최소 높이 제약 — 줄이는 방향일 때만 적용 */
    if (diff < 0) {
      var minH = getBlkMinH(selectedGi, ci, lastBi);
      if (newH < minH) { skipped++; return; }
    }
    lastBlk.h = Math.round(newH);
  });

  if (skipped > 0) showToast(skipped + '개 열은 최소 높이 제약으로 조정 생략됨');
  render();
  /* render 후 그룹 선택 복원 */
  requestAnimationFrame(function() {
    var gEl = document.querySelectorAll('.group')[selectedGi];
    if (gEl) {
      var innerEl = gEl.querySelector('.group-inner');
      if (innerEl) selectGroup(selectedGi, innerEl);
    }
  });
}

/* ══════════════════════════════════════════
   열 너비 균등 대칭 (기능 3)
══════════════════════════════════════════ */
/* ── 그룹 바운딩박스 계산 ── */
function _grpBBox(groupId) {
  var blks = blocks.filter(function(b) { return b.groupId === groupId; });
  if (!blks.length) return null;
  var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  blks.forEach(function(b) {
    if (b.x < minX)         minX = b.x;
    if (b.y < minY)         minY = b.y;
    if (b.x + b.w > maxX)  maxX = b.x + b.w;
    if (b.y + b.h > maxY)  maxY = b.y + b.h;
  });
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

/* ── 그룹 툴바 표시/숨김 ── */
function showGroupToolbar(groupId) {
  hideGroupToolbar();
  var pad = document.getElementById('sheet-pad');
  if (!pad) return;
  var bbox = _grpBBox(groupId);
  if (!bbox) return;

  /* 그룹 선택 오버레이 — 실선 프레임 (inset -5px) */
  var ov = document.createElement('div');
  ov.id = 'grp-selection-overlay';
  ov.className = 'grp-selection-overlay';
  ov.style.left   = (bbox.x - 5) + 'px';
  ov.style.top    = (bbox.y - 5) + 'px';
  ov.style.width  = (bbox.w + 10) + 'px';
  ov.style.height = (bbox.h + 10) + 'px';
  pad.appendChild(ov);

  /* "그룹·N개" 라벨 칩 — 블록보다 높은 z-index (bug 1 방지) */
  var grpBlksCount = blocks.filter(function(b) { return b.groupId === groupId; }).length;
  var chip = document.createElement('div');
  chip.id = 'grp-label-chip';
  chip.className = 'grp-label-chip';
  chip.textContent = '그룹 · ' + grpBlksCount + '개';
  chip.style.left = (bbox.x - 5 - 4 + 1) + 'px';
  chip.style.top  = (bbox.y - 5 - 13) + 'px';
  pad.appendChild(chip);

  /* 그룹 툴바 */
  var tb = document.createElement('div');
  tb.id = 'grp-toolbar';
  tb.className = 'grp-toolbar';
  tb.style.left = (bbox.x + bbox.w + 12) + 'px';
  tb.style.top  = bbox.y + 'px';

  function mkBtn(label, cls, fn) {
    var btn = document.createElement('button');
    btn.className = cls || 'dock-btn';
    btn.innerHTML = label;
    btn.addEventListener('mousedown', function(e) { e.stopPropagation(); });
    btn.addEventListener('click', function(e) { e.stopPropagation(); fn(); });
    return btn;
  }

  var eyebrow = document.createElement('div');
  eyebrow.className = 'dock-eyebrow';
  eyebrow.textContent = 'GROUP';
  tb.appendChild(eyebrow);

  var sec1 = document.createElement('div');
  sec1.className = 'dock-section';
  var lbl1 = document.createElement('div');
  lbl1.className = 'dock-label';
  lbl1.textContent = '편집';
  sec1.appendChild(lbl1);
  sec1.appendChild(mkBtn(
    '<svg width="12" height="12" viewBox="0 0 16 16" fill="none" style="flex-shrink:0"><rect x="5" y="1" width="9" height="11" rx="1.5" stroke="currentColor" stroke-width="1.4"/><rect x="2" y="4" width="9" height="11" rx="1.5" stroke="currentColor" stroke-width="1.4"/></svg>그룹 복사',
    'dock-btn',
    function() { duplicateGroup(groupId); }
  ));
  sec1.appendChild(mkBtn(
    '<svg width="12" height="12" viewBox="0 0 16 16" fill="none" style="flex-shrink:0"><rect x="1" y="4" width="4" height="8" rx="1" stroke="currentColor" stroke-width="1.4"/><rect x="11" y="4" width="4" height="8" rx="1" stroke="#B0AADB" stroke-width="1.4"/><line x1="5.5" y1="8" x2="10.5" y2="8" stroke="currentColor" stroke-width="1.2"/><polyline points="8,5.5 10.5,8 8,10.5" fill="none" stroke="currentColor" stroke-width="1.2"/><polyline points="8,5.5 5.5,8 8,10.5" fill="none" stroke="currentColor" stroke-width="1.2"/></svg>좌우 반전',
    'dock-btn',
    function() { flipGroupBlocks(groupId); }
  ));
  tb.appendChild(sec1);

  var sec2 = document.createElement('div');
  sec2.className = 'dock-section';
  sec2.appendChild(mkBtn('그룹 해제', 'dock-btn del', function() { ungroupBlocks(groupId); }));
  tb.appendChild(sec2);

  var closeBtn = document.createElement('button');
  closeBtn.className = 'dock-close';
  closeBtn.textContent = '닫기';
  closeBtn.addEventListener('mousedown', function(e) { e.stopPropagation(); });
  closeBtn.addEventListener('click', function(e) { e.stopPropagation(); deselect(); });
  tb.appendChild(closeBtn);

  pad.appendChild(tb);
}

function hideGroupToolbar() {
  var tb = document.getElementById('grp-toolbar');
  if (!tb) return;  /* BUG-3: 이미 숨겨진 경우 이중 실행 방지 */
  tb.remove();
  var ov = document.getElementById('grp-selection-overlay');
  if (ov) ov.remove();
  var chip = document.getElementById('grp-label-chip');
  if (chip) chip.remove();
}

/* ── 그룹 좌우 반전 ── */
function flipGroupBlocks(groupId) {
  var grpBlks = blocks.filter(function(b) { return b.groupId === groupId; });
  if (grpBlks.length < 2) return;
  saveHistory();
  var minX = Math.min.apply(null, grpBlks.map(function(b) { return b.x; }));
  var maxX = Math.max.apply(null, grpBlks.map(function(b) { return b.x + b.w; }));
  var centerX = (minX + maxX) / 2;
  grpBlks.forEach(function(b) {
    b.x = Math.round(2 * centerX - b.x - b.w);
  });
  render();
}

/* ── 그룹 복사 (BUG-10 / F-07) ── */
function duplicateGroup(groupId) {
  var grpBlks = blocks.filter(function(b) { return b.groupId === groupId; });
  if (!grpBlks.length) return;
  saveHistory();
  var minX = Math.min.apply(null, grpBlks.map(function(b) { return b.x; }));
  var maxX = Math.max.apply(null, grpBlks.map(function(b) { return b.x + b.w; }));
  var offsetX = maxX - minX + gaps.pad;
  var newGid = 'g_' + _nextBlkId();
  grpBlks.forEach(function(b) {
    var clone = JSON.parse(JSON.stringify(b));
    clone.id      = _nextBlkId();
    clone.groupId = newGid;
    clone.x       = b.x + offsetX;
    blocks.push(clone);
  });
  /* 캔버스 너비 확장 — updateCanvasWidth()는 내부 render()를 포함하므로
     더블 렌더 방지를 위해 DOM 갱신만 인라인 처리 */
  var reqW = Math.max.apply(null, blocks.map(function(b) { return b.x + b.w; })) + gaps.pad;
  if (reqW > canvasW) {
    reqW = Math.max(400, reqW);
    canvasW = reqW;
    var _stEl = document.getElementById('canvas-stage');
    if (_stEl) { _stEl.style.width = reqW + 'px'; _stEl.style.marginLeft = (-reqW / 2) + 'px'; }
    var _pdEl = document.getElementById('sheet-pad');
    if (_pdEl) _pdEl.style.width = reqW + 'px';
    _updateSliderUI('sl-canvas-w', reqW);
    var _snW = document.getElementById('sn-canvas-w'); if (_snW) _snW.value = reqW;
  }
  render();
  /* 복사된 그룹 자동 선택 */
  var newBlkIds = blocks.filter(function(b) { return b.groupId === newGid; }).map(function(b) { return b.id; });
  selectedGi = newGid;
  selKeys    = newBlkIds;
  selKey     = null;
  showGroupToolbar(newGid);
  showToast('그룹이 복제되었습니다');
}

/* ── 그룹 해제 ── */
function ungroupBlocks(groupId) {
  saveHistory();
  blocks.forEach(function(b) { if (b.groupId === groupId) b.groupId = null; });
  selectedGi = null;
  selKeys = []; selKey = null;
  hideGroupToolbar();
  hideAlignToolbar();
  render();
  showToast('그룹이 해제되었습니다');
}

function alignGroupSymmetry() { /* 스텝7 이후 확장 예정 */ }

/* ══════════════════════════════════════════
   스텝 8 — 정렬 툴바
══════════════════════════════════════════ */
function _selBBox() {
  var keys = selKeys.length > 0 ? selKeys : (selKey ? [selKey] : []);
  if (keys.length === 0) return null;
  var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  keys.forEach(function(k) {
    var b = getBlkByKey(k);
    if (!b) return;
    if (b.x < minX) minX = b.x;
    if (b.y < minY) minY = b.y;
    if (b.x + b.w > maxX) maxX = b.x + b.w;
    if (b.y + b.h > maxY) maxY = b.y + b.h;
  });
  if (minX === Infinity) return null;
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

function alignSelBlks(mode) {
  var keys = selKeys.length > 0 ? selKeys : (selKey ? [selKey] : []);
  if (keys.length < 2) return;
  var bbox = _selBBox();
  if (!bbox) return;
  saveHistory();
  keys.forEach(function(k) {
    var b = getBlkByKey(k);
    if (!b) return;
    switch (mode) {
      case 'left':    b.x = bbox.x; break;
      case 'right':   b.x = bbox.x + bbox.w - b.w; break;
      case 'top':     b.y = bbox.y; break;
      case 'bottom':  b.y = bbox.y + bbox.h - b.h; break;
      case 'centerH': b.x = Math.round(bbox.x + (bbox.w - b.w) / 2); break;
      case 'centerV': b.y = Math.round(bbox.y + (bbox.h - b.h) / 2); break;
    }
  });
  render();
  if (selKeys.length >= 2) showAlignToolbar();
}

function showAlignToolbar() {
  hideAlignToolbar();
  if (selKeys.length < 2) return;
  var pad = document.getElementById('sheet-pad');
  if (!pad) return;
  var bbox = _selBBox();
  if (!bbox) return;

  var tb = document.createElement('div');
  tb.id = 'align-toolbar';
  tb.className = 'align-toolbar';

  var TOOLBAR_W = 204; /* 버튼 26px × 6 + sep 7px × 1 + padding = 약 200px */
  tb.style.left = Math.round(bbox.x + bbox.w / 2 - TOOLBAR_W / 2) + 'px';
  tb.style.top  = Math.max(0, bbox.y - 44) + 'px';

  function mkAlignBtn(svgPath, title, mode) {
    var btn = document.createElement('button');
    btn.title = title;
    btn.innerHTML = svgPath;
    btn.addEventListener('mousedown', function(e) { e.stopPropagation(); });
    btn.addEventListener('click', function(e) { e.stopPropagation(); alignSelBlks(mode); });
    return btn;
  }

  /* 좌 정렬 */
  tb.appendChild(mkAlignBtn('<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="2" y="2" width="1.5" height="10" rx="0.75" fill="currentColor"/><rect x="4" y="3.5" width="7" height="2.5" rx="1" fill="currentColor"/><rect x="4" y="8" width="5" height="2.5" rx="1" fill="currentColor"/></svg>', '왼쪽 정렬', 'left'));
  /* 수평 중앙 */
  tb.appendChild(mkAlignBtn('<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="6.25" y="1" width="1.5" height="12" rx="0.75" fill="currentColor"/><rect x="2.5" y="3" width="9" height="2.5" rx="1" fill="currentColor"/><rect x="3.5" y="8" width="7" height="2.5" rx="1" fill="currentColor"/></svg>', '수평 중앙 정렬', 'centerH'));
  /* 우 정렬 */
  tb.appendChild(mkAlignBtn('<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="10.5" y="2" width="1.5" height="10" rx="0.75" fill="currentColor"/><rect x="3" y="3.5" width="7" height="2.5" rx="1" fill="currentColor"/><rect x="5" y="8" width="5" height="2.5" rx="1" fill="currentColor"/></svg>', '오른쪽 정렬', 'right'));

  var sep = document.createElement('div'); sep.className = 'align-toolbar-sep';
  tb.appendChild(sep);

  /* 상 정렬 */
  tb.appendChild(mkAlignBtn('<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="2" y="2" width="10" height="1.5" rx="0.75" fill="currentColor"/><rect x="3.5" y="4" width="2.5" height="7" rx="1" fill="currentColor"/><rect x="8" y="4" width="2.5" height="5" rx="1" fill="currentColor"/></svg>', '위쪽 정렬', 'top'));
  /* 수직 중앙 */
  tb.appendChild(mkAlignBtn('<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="1" y="6.25" width="12" height="1.5" rx="0.75" fill="currentColor"/><rect x="3" y="2.5" width="2.5" height="9" rx="1" fill="currentColor"/><rect x="8" y="3.5" width="2.5" height="7" rx="1" fill="currentColor"/></svg>', '수직 중앙 정렬', 'centerV'));
  /* 하 정렬 */
  tb.appendChild(mkAlignBtn('<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="2" y="10.5" width="10" height="1.5" rx="0.75" fill="currentColor"/><rect x="3.5" y="3" width="2.5" height="7" rx="1" fill="currentColor"/><rect x="8" y="5" width="2.5" height="5" rx="1" fill="currentColor"/></svg>', '아래쪽 정렬', 'bottom'));

  pad.appendChild(tb);
}

function hideAlignToolbar() {
  var tb = document.getElementById('align-toolbar');
  if (tb) tb.remove();
}

/* ══════════════════════════════════════════
   스텝 6 — 다중 선택 → 그룹화
══════════════════════════════════════════ */
function groupFromSelection() {
  var targets = selKeys.length > 1 ? selKeys.slice() : [];
  if (targets.length < 2) { showToast('블록을 2개 이상 선택하세요 (Ctrl+클릭)'); return; }
  saveHistory();
  var newGid = 'g_' + Date.now();
  targets.forEach(function(key) {
    var blk = getBlkByKey(key);
    if (blk) blk.groupId = newGid;
  });
  selectedGi = newGid;
  selKeys = targets.slice();
  selKey = targets[targets.length - 1];
  render();
  showToast(targets.length + '개 블록으로 새 그룹을 만들었습니다');
}

function showCanvasPanel() {
  document.getElementById('panel-block').classList.remove('active');
  /* 텍스트 서식 툴바 숨김 */
  hideTxtFormatBar();
  /* 마지막 활성 nav 탭(preset/canvas/header) 복원 */
  var lastNav = showCanvasPanel._lastNav || 'canvas';
  switchNav(lastNav);
}

function deselect() {
  var wasHeader = (selKey === 'header');
  /* 컬러칩 active 칩 초기화 */
  if (selKey) {
    var prevBlk = getSelBlk();
    if (prevBlk && prevBlk.type === 'colorchip') prevBlk._activeChipId = null;
  }
  selKey = null;
  selKeys = [];
  selectedGi = null;
  _grpIndividualMode = false;
  hideGroupToolbar();
  hideAlignToolbar();
  /* DOM 선택 표시 정리 */
  document.querySelectorAll('.blk').forEach(function(blkEl) {
    blkEl.style.outline = ''; blkEl.style.outlineOffset = '';
    blkEl.classList.remove('selected');
  });
  /* 그룹 선택 표시 정리 */
  document.querySelectorAll('.group-inner').forEach(function(el) {
    el.classList.remove('grp-selected');
  });
  document.querySelectorAll('.grp-height-handle').forEach(function(el) {
    el.classList.remove('visible');
  });
  /* 이미지 편집 모드도 종료 */
  if (activeImgKey) exitImgEditMode();
  /* 헤더 선택 표시 정리 */
  ['hdr-top-slot','hdr-bot-slot'].forEach(function(id) {
    var slot = document.getElementById(id);
    if (slot) {
      var hel = slot.querySelector('.sheet-header-block');
      if (hel) { hel.classList.remove('selected'); hel.classList.remove('editing'); }
    }
  });
  /* 헤더 패널에서 복귀 시 공통 스타일 복원 */
  if (wasHeader) restoreBlockPanelCommon();
  showCanvasPanel();
  render();
}

/* ══════════════════════════════════════════
   캔버스 클릭 처리
══════════════════════════════════════════ */
/* Ctrl+B / Ctrl+I / Ctrl+U — 텍스트 편집 중 인라인 서식 단축키 */
document.addEventListener('keydown', function(e) {
  if (!(e.ctrlKey || e.metaKey)) return;
  /* Ctrl+Z — 실행 취소 (편집 중 아닐 때만 — 편집 중엔 브라우저 기본 동작 유지) */
  if (e.key.toLowerCase() === 'z' && !e.shiftKey && !isEditing) {
    e.preventDefault(); performUndo(); return;
  }
  /* Ctrl+Y / Ctrl+Shift+Z — 다시 실행 */
  if ((e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey)) && !isEditing) {
    e.preventDefault(); performRedo(); return;
  }
  /* Ctrl+G — 다중 선택 블록 그룹화 (편집 중 아닐 때만) */
  if (e.key.toLowerCase() === 'g' && !isEditing) {
    e.preventDefault();
    groupFromSelection();
    return;
  }
  /* Ctrl+C — 블록 복사 (편집 중이 아닐 때 + 블록 선택 중일 때만) */
  if (e.key.toLowerCase() === 'c' && !isEditing && selKey) {
    var _cblk = getBlkByKey(selKey);
    if (_cblk) { _blkCopyClipboard = JSON.parse(JSON.stringify(_cblk)); }
    e.preventDefault();
    return;
  }
  /* Ctrl+V — 블록 붙여넣기 (클립보드에 복사된 블록이 있을 때) */
  if (e.key.toLowerCase() === 'v' && !isEditing && _blkCopyClipboard) {
    saveHistory();
    var _nb = JSON.parse(JSON.stringify(_blkCopyClipboard));
    _nb.id = _nextBlkId(); _nb.x += 20; _nb.y += 20;
    _nb.groupId = null;
    blocks.push(_nb); selKey = _nb.id; selKeys = [];
    render();
    e.preventDefault();
    return;
  }
  /* Ctrl+B/I/U — 텍스트 편집 중 인라인 서식 */
  if (!isEditing) return;
  var keyMap = { b: 'bold', i: 'italic', u: 'underline' };
  var type = keyMap[e.key.toLowerCase()];
  if (!type) return;
  e.preventDefault();
  tfbToggle(type);
});

/* Escape — 편집 종료 / 이미지 편집 종료 / 블록 선택 해제 */
document.addEventListener('keydown', function(e) {
  if (e.key !== 'Escape') return;
  if (isEditing) { commitTextEdit(); return; }
  if (activeImgKey) { exitImgEditMode(); render(); showCanvasPanel(); return; }
  if (activeHdrImgKind) { exitHeaderImgEditMode(); return; }
  if (selKey || selKeys.length > 0) { deselect(); return; }
});

/* Delete / Backspace — 선택 블록 삭제 */
document.addEventListener('keydown', function(e) {
  if (e.key !== 'Delete' && e.key !== 'Backspace') return;
  if (isEditing || editingKey || activeImgKey) return;
  var tgt = document.activeElement;
  if (tgt && (tgt.tagName === 'INPUT' || tgt.tagName === 'TEXTAREA' || tgt.contentEditable === 'true')) return;
  if (!selKey || selKey === 'header') return;
  /* 잠긴 블록은 키보드 삭제 차단 */
  var _delKeys = selKeys.length > 1 ? selKeys.slice() : [selKey];
  if (_delKeys.some(function(k) { var b = getBlkByKey(k); return b && b.locked; })) return;
  e.preventDefault();
  saveHistory();
  var toDelete = _delKeys;
  blocks = blocks.filter(function(b) { return toDelete.indexOf(b.id) === -1; });
  if (blocks.length === 0) {
    blocks.push({ id: _nextBlkId(), x: gaps.pad, y: gaps.pad, w: canvasW - gaps.pad * 2, h: 120, groupId: null, type: 'img', imgSrc: null, imgTransform: { scale:1, x:0, y:0 }, radius: null, shadow: null, opacity: null, bgColor: null });
  }
  selKey = null; selKeys = []; selectedGi = null; _grpIndividualMode = false;
  hideTxtFormatBar(); hideAlignToolbar(); hideGroupToolbar();
  render(); showCanvasPanel();
});

/* Arrow keys — 선택 블록 이동 (1px / Shift: 10px) */
document.addEventListener('keydown', function(e) {
  var dirs = { ArrowLeft: [-1,0], ArrowRight: [1,0], ArrowUp: [0,-1], ArrowDown: [0,1] };
  if (!dirs[e.key]) return;
  if (isEditing || activeImgKey) return;
  var tgt = document.activeElement;
  if (tgt && (tgt.tagName === 'INPUT' || tgt.tagName === 'TEXTAREA' || tgt.contentEditable === 'true')) return;
  var targets = selKeys.length > 1 ? selKeys.slice() : (selKey && selKey !== 'header' ? [selKey] : []);
  if (!targets.length) return;
  e.preventDefault();
  var step = e.shiftKey ? 10 : 1;
  var d = dirs[e.key];
  targets.forEach(function(k) {
    var blk = getBlkByKey(k);
    if (!blk || blk.locked) return;
    blk.x += d[0] * step;
    blk.y += d[1] * step;
    var el = document.querySelector('.blk[data-key="' + k + '"]');
    if (el) { el.style.left = blk.x + 'px'; el.style.top = blk.y + 'px'; }
  });
  autoCanvasH();
});

/* ── 캔버스 빈 영역 우클릭 메뉴 ── */
function _removeCanvasCtxMenu() {
  var old = document.getElementById('canvas-ctx-menu');
  if (old) old.remove();
}

function _selectAllBlocks() {
  if (!blocks.length) return;
  selKey = null;
  selectedGi = null;
  selKeys = blocks.map(function(b) { return b.id; });
  render();
}

function _addBlkOfType(type, snapX, snapY) {
  var _side = 160;
  var newX, newY;
  if (snapX !== undefined && snapY !== undefined) {
    var _w = (type === 'item') ? 200 : _side;
    var _h = (type === 'item') ? 180 : _side;
    newX = Math.max(0, Math.round(snapX - _w / 2));
    newY = Math.max(0, Math.round(snapY - _h / 2));
  } else {
    var maxY = blocks.reduce(function(m, b) { return Math.max(m, b.y + b.h); }, 0);
    newX = Math.round((canvasW - _side) / 2);
    newY = maxY > 0 ? maxY + gaps.pad : gaps.pad;
  }
  var newBlk = { id: _nextBlkId(), x: newX, y: newY, w: _side, h: _side, groupId: null, type: type, radius: null, shadow: null, opacity: null, bgColor: null, stroke: globalVals.stroke || 0, tstroke: globalVals.tstroke || 0, tstrokeColor: '#ffffff' };
  if (type === 'txt' || type === 'title') { newBlk.listMode = 'none'; newBlk.spans = [{ text: '' }]; }
  if (type === 'img') { newBlk.imgSrc = null; newBlk.imgTransform = { scale: 1, x: 0, y: 0 }; }
  if (type === 'colorchip') {
    newBlk.chips = [
      { id: 'cc0_' + Date.now(), color: '#2F4D9E', label: 'A', textColor: '#ffffff', desc: '' },
      { id: 'cc1_' + Date.now(), color: '#5B7CE6', label: 'B', textColor: '#ffffff', desc: '' },
      { id: 'cc2_' + Date.now(), color: '#7E9BEE', label: 'C', textColor: '#212121', desc: '' },
      { id: 'cc3_' + Date.now(), color: '#A9BEF5', label: 'D', textColor: '#212121', desc: '' },
      { id: 'cc4_' + Date.now(), color: '#CCDBFD', label: 'E', textColor: '#212121', desc: '' }
    ];
    newBlk.chipLayout = 'row'; newBlk.chipRadius = 0;
    newBlk.showSwatch = true; newBlk.showText = false;
    newBlk.opacity = 0; newBlk.shadow = 0;
    newBlk.h = _ccMinH(newBlk);
  }
  if (type === 'item') {
    newBlk.preset    = 'pm-chip';
    newBlk.ptColor   = '#5B7CE6';
    newBlk.direction = 'h';
    newBlk.divider   = false;
    newBlk.chipStyle = 'fill';
    newBlk.items     = _defaultItems();
    _applyItemSize(newBlk);
  }
  saveHistory();
  blocks.push(newBlk);
  render();
  selKey = newBlk.id;
  selKeys = [];
  showBlockPanel(type, null, newBlk);
}

function _showCanvasCtxMenu(e) {
  e.preventDefault();
  _removeCanvasCtxMenu();

  var menu = document.createElement('div');
  menu.className = 'ctx-menu';
  menu.id = 'canvas-ctx-menu';
  menu.style.position = 'fixed';
  menu.style.left = e.clientX + 'px';
  menu.style.top  = e.clientY + 'px';

  /* 우클릭 위치를 캔버스 좌표로 변환 */
  var _stageEl = document.getElementById('canvas-stage');
  var _sr = _stageEl ? _stageEl.getBoundingClientRect() : { left: 0, top: 0 };
  var _snapX = (e.clientX - _sr.left) / _zoomLevel;
  var _snapY = (e.clientY - _sr.top)  / _zoomLevel;

  /* 블록 추가 (▸ 서브메뉴) */
  var addItem = document.createElement('div');
  addItem.className = 'ctx-menu-item ctx-has-sub';
  addItem.innerHTML = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="7" height="7" rx="1.4"/><rect x="13" y="4" width="7" height="7" rx="1.4"/><rect x="4" y="13" width="7" height="7" rx="1.4"/><rect x="13" y="13" width="7" height="7" rx="1.4"/></svg>블록 추가<span class="ctx-arrow">▸</span>';

  var sub = document.createElement('div');
  sub.className = 'ctx-submenu';

  [{ type: 'img', label: '이미지' }, { type: 'txt', label: '텍스트' }, { type: 'colorchip', label: '컬러칩' }, { type: 'item', label: '항목' }].forEach(function(t) {
    var subItem = document.createElement('div');
    subItem.className = 'ctx-menu-item';
    subItem.textContent = t.label;
    subItem.addEventListener('mousedown', function(ev) {
      ev.stopPropagation();
      _removeCanvasCtxMenu();
      _addBlkOfType(t.type, _snapX, _snapY);
    });
    sub.appendChild(subItem);
  });

  addItem.appendChild(sub);
  menu.appendChild(addItem);

  /* 붙여넣기 (미구현 — disabled) */
  var pasteItem = document.createElement('div');
  pasteItem.className = 'ctx-menu-item disabled';
  pasteItem.innerHTML = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="11" height="11" rx="1.5"/><path d="M15 9V6A1.5 1.5 0 0 0 13.5 4.5h-7A1.5 1.5 0 0 0 5 6v7A1.5 1.5 0 0 0 6.5 14.5H9"/></svg>붙여넣기';
  menu.appendChild(pasteItem);

  var div1 = document.createElement('div'); div1.className = 'ctx-menu-divider';
  menu.appendChild(div1);

  /* 전체 선택 */
  var selAllItem = document.createElement('div');
  selAllItem.className = 'ctx-menu-item';
  selAllItem.innerHTML = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M9 7V4.5h6V7M6 7l1 13h10l1-13"/></svg>전체 선택';
  selAllItem.addEventListener('mousedown', function(ev) {
    ev.stopPropagation();
    _removeCanvasCtxMenu();
    _selectAllBlocks();
  });
  menu.appendChild(selAllItem);

  document.body.appendChild(menu);

  setTimeout(function() {
    document.addEventListener('click', function _closeCanvasCtx() {
      _removeCanvasCtxMenu();
      document.removeEventListener('click', _closeCanvasCtx);
    });
  }, 0);
}

/* ── 우클릭 컨텍스트 메뉴 ── */
function _blkIdx(key) {
  for (var i = 0; i < blocks.length; i++) if (blocks[i].id === key) return i;
  return -1;
}

function blkBringForward(key) {
  var i = _blkIdx(key);
  if (i < 0 || i >= blocks.length - 1) return;
  var tmp = blocks[i]; blocks[i] = blocks[i + 1]; blocks[i + 1] = tmp;
  render();
}

function blkSendBackward(key) {
  var i = _blkIdx(key);
  if (i <= 0) return;
  var tmp = blocks[i]; blocks[i] = blocks[i - 1]; blocks[i - 1] = tmp;
  render();
}

function blkToggleLock(key) {
  var blk = getBlkByKey(key);
  if (!blk) return;
  blk.locked = !blk.locked;
  render();
}

function _removeCtxMenu() {
  var old = document.getElementById('blk-ctx-menu');
  if (old) old.remove();
}

function showCtxMenu(e, ctxGroupId) {
  e.preventDefault();
  _removeCtxMenu();

  /* 우클릭 대상 블록을 event.target에서 직접 결정 —
     mousedown(button!==0) 무시로 selKey가 미설정된 경우를 보완 */
  var _tgtBlkEl = e.target.closest ? e.target.closest('.blk[data-key]') : null;
  var _ctxKeyFromEvt = _tgtBlkEl ? _tgtBlkEl.dataset.key : null;
  if (_ctxKeyFromEvt && _ctxKeyFromEvt !== selKey) {
    selKey = _ctxKeyFromEvt;
    selKeys = [];
  }

  var menu = document.createElement('div');
  menu.className = 'ctx-menu';
  menu.id = 'blk-ctx-menu';

  /* "그룹 선택" — 우클릭한 블록이 그룹 멤버일 때 최상단에 표시 (여집합 0 대비 안전장치) */
  if (ctxGroupId) {
    var grpSelItem = document.createElement('div');
    grpSelItem.className = 'ctx-menu-item ctx-menu-item--accent';
    grpSelItem.textContent = '그룹 선택';
    grpSelItem.style.cssText = 'color:#2F4D9E;font-weight:700;background:#E7EDFC;border-radius:5px;margin:2px 4px;';
    grpSelItem.addEventListener('mousedown', function(ev) {
      ev.stopPropagation();
      _removeCtxMenu();
      _grpIndividualMode = false;
      selectedGi = ctxGroupId;
      var grpBlks2 = blocks.filter(function(b) { return b.groupId === ctxGroupId; });
      selKeys = grpBlks2.map(function(b) { return b.id; });
      selKey = null;
      hideTxtFormatBar();
      hideAlignToolbar();
      document.querySelectorAll('.blk').forEach(function(el) {
        el.classList.remove('selected');
        el.style.outline = '';
        el.style.outlineOffset = '';
      });
      showCanvasPanel();
      showGroupToolbar(ctxGroupId);
    });
    menu.appendChild(grpSelItem);
    var divGSel = document.createElement('div'); divGSel.className = 'ctx-menu-divider';
    menu.appendChild(divGSel);
  }

  var canGroup = selKeys.length > 1;
  /* 선택된 블록 전체가 같은 그룹인지 확인 */
  var activeGid = null;
  if (selectedGi && selKeys.length > 0) {
    var allSameGrp = selKeys.every(function(k) {
      var b = getBlkByKey(k); return b && b.groupId === selectedGi;
    });
    if (allSameGrp) activeGid = selectedGi;
  }

  /* 그룹 해제 (그룹 선택 상태일 때) */
  if (activeGid) {
    var ungroupItem = document.createElement('div');
    ungroupItem.className = 'ctx-menu-item';
    ungroupItem.textContent = '그룹 해제';
    ungroupItem.addEventListener('mousedown', function(ev) {
      ev.stopPropagation(); _removeCtxMenu(); ungroupBlocks(activeGid);
    });
    menu.appendChild(ungroupItem);
    var divG = document.createElement('div'); divG.className = 'ctx-menu-divider';
    menu.appendChild(divG);
  }

  /* 새 그룹으로 묶기 */
  var groupItem = document.createElement('div');
  groupItem.className = 'ctx-menu-item' + (canGroup ? '' : ' disabled');
  groupItem.innerHTML = '<span>새 그룹으로 묶기</span><span style="margin-left:auto;opacity:0.5;font-size:11px">Ctrl+G</span>';
  groupItem.addEventListener('mousedown', function(ev) {
    ev.stopPropagation(); /* 외부 mousedown 감지 차단 */
    _removeCtxMenu();
    groupFromSelection();
  });
  menu.appendChild(groupItem);

  /* 구분선 */
  var div1 = document.createElement('div');
  div1.className = 'ctx-menu-divider';
  menu.appendChild(div1);

  /* 앞으로/뒤로 — 단일 블록 선택일 때만 (_ctxKeyFromEvt 우선) */
  var _ctxKey = _ctxKeyFromEvt || (selKeys.length === 1 ? selKeys[0] : selKey);
  if (_ctxKey && selKeys.length <= 1) {
    var _ctxIdx = _blkIdx(_ctxKey);
    var fwdItem = document.createElement('div');
    fwdItem.className = 'ctx-menu-item' + (_ctxIdx < blocks.length - 1 ? '' : ' disabled');
    fwdItem.innerHTML = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" style="width:13px;height:13px;margin-right:6px;flex-shrink:0"><polyline points="8,3 13,8 8,13"/><line x1="3" y1="8" x2="13" y2="8"/></svg>앞으로 가져오기';
    fwdItem.style.display = 'flex'; fwdItem.style.alignItems = 'center';
    fwdItem.addEventListener('mousedown', function(ev) {
      ev.stopPropagation(); _removeCtxMenu(); blkBringForward(_ctxKey);
    });
    menu.appendChild(fwdItem);

    var bkdItem = document.createElement('div');
    bkdItem.className = 'ctx-menu-item' + (_ctxIdx > 0 ? '' : ' disabled');
    bkdItem.innerHTML = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" style="width:13px;height:13px;margin-right:6px;flex-shrink:0"><polyline points="8,3 3,8 8,13"/><line x1="3" y1="8" x2="13" y2="8"/></svg>뒤로 보내기';
    bkdItem.style.display = 'flex'; bkdItem.style.alignItems = 'center';
    bkdItem.addEventListener('mousedown', function(ev) {
      ev.stopPropagation(); _removeCtxMenu(); blkSendBackward(_ctxKey);
    });
    menu.appendChild(bkdItem);

    var divZ = document.createElement('div'); divZ.className = 'ctx-menu-divider';
    menu.appendChild(divZ);

    /* 잠금 / 잠금 해제 */
    var _ctxBlk = getBlkByKey(_ctxKey);
    var lockItem = document.createElement('div');
    lockItem.className = 'ctx-menu-item';
    if (_ctxBlk && _ctxBlk.locked) {
      lockItem.innerHTML = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" style="width:13px;height:13px;margin-right:6px;flex-shrink:0"><rect x="3" y="7.5" width="10" height="7" rx="1.5"/><path d="M5.5 7.5V5.5a2.5 2.5 0 015 0v2"/></svg>잠금 해제';
    } else {
      lockItem.innerHTML = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" style="width:13px;height:13px;margin-right:6px;flex-shrink:0"><rect x="3" y="7.5" width="10" height="7" rx="1.5"/><path d="M5.5 7.5V5.5a2.5 2.5 0 015 0"/></svg>잠금';
    }
    lockItem.style.display = 'flex'; lockItem.style.alignItems = 'center';
    lockItem.addEventListener('mousedown', function(ev) {
      ev.stopPropagation(); _removeCtxMenu(); blkToggleLock(_ctxKey);
    });
    menu.appendChild(lockItem);

    var divL = document.createElement('div'); divL.className = 'ctx-menu-divider';
    menu.appendChild(divL);
  }

  /* 블록 옵션 복사 / 붙여넣기 (단일 블록에만 표시) */
  var _styleTargetKey = _ctxKey || selKey;
  if (_styleTargetKey && _styleTargetKey !== 'header' && selKeys.length <= 1) {
    var cpStyleItem = document.createElement('div');
    cpStyleItem.className = 'ctx-menu-item';
    cpStyleItem.textContent = '블록 옵션 복사';
    cpStyleItem.addEventListener('mousedown', function(ev) {
      ev.stopPropagation();
      _removeCtxMenu();
      var _sb = getBlkByKey(_styleTargetKey);
      if (_sb) {
        _blkStyleClipboard = {
          radius:  _sb.radius,
          shadow:  _sb.shadow,
          bgColor: _sb.bgColor,
          stroke:  _sb.stroke,
          opacity: _sb.opacity
        };
      }
    });
    menu.appendChild(cpStyleItem);

    var paStyleItem = document.createElement('div');
    paStyleItem.className = 'ctx-menu-item' + (_blkStyleClipboard ? '' : ' disabled');
    paStyleItem.textContent = '블록 옵션 붙여넣기';
    paStyleItem.addEventListener('mousedown', function(ev) {
      ev.stopPropagation();
      _removeCtxMenu();
      if (!_blkStyleClipboard) return;
      var _tb = getBlkByKey(_styleTargetKey);
      if (!_tb) return;
      saveHistory();
      _tb.radius  = _blkStyleClipboard.radius;
      _tb.shadow  = _blkStyleClipboard.shadow;
      _tb.bgColor = _blkStyleClipboard.bgColor;
      _tb.stroke  = _blkStyleClipboard.stroke;
      _tb.opacity = _blkStyleClipboard.opacity;
      render();
      var _pastedBlk = getBlkByKey(_styleTargetKey);
      if (_pastedBlk) showBlockPanel(_pastedBlk.type, null, _pastedBlk);
    });
    menu.appendChild(paStyleItem);

    var divStyle = document.createElement('div'); divStyle.className = 'ctx-menu-divider';
    menu.appendChild(divStyle);
  }

  /* 복제 */
  var dupItem = document.createElement('div');
  dupItem.className = 'ctx-menu-item';
  dupItem.textContent = selKeys.length > 1 ? '선택 블록 복제' : '블록 복제';
  dupItem.addEventListener('mousedown', function(ev) {
    ev.stopPropagation();
    _removeCtxMenu();
    duplicateSelBlk();
  });
  menu.appendChild(dupItem);

  /* 삭제 */
  var delItem = document.createElement('div');
  delItem.className = 'ctx-menu-item';
  delItem.textContent = selKeys.length > 1 ? '선택 블록 삭제' : '블록 삭제';
  delItem.addEventListener('mousedown', function(ev) {
    ev.stopPropagation();
    _removeCtxMenu();
    deleteSelBlk();
  });
  menu.appendChild(delItem);

  /* 위치 결정 */
  document.body.appendChild(menu);
  var mx = e.clientX, my = e.clientY;
  var mw = menu.offsetWidth, mh = menu.offsetHeight;
  if (mx + mw > window.innerWidth)  mx = window.innerWidth  - mw - 8;
  if (my + mh > window.innerHeight) my = window.innerHeight - mh - 8;
  menu.style.left = mx + 'px';
  menu.style.top  = my + 'px';

  /* 외부 mousedown 시 제거 — 메뉴 항목 mousedown은 stopPropagation으로 차단됨 */
  setTimeout(function() {
    document.addEventListener('mousedown', _removeCtxMenu, { once: true });
  }, 0);
}

/* 블록 우클릭 이벤트 — canvas-area에서 위임 */
document.addEventListener('contextmenu', function(e) {
  var blkEl = e.target.closest('.blk');

  if (!blkEl) {
    _removeCtxMenu();
    if (e.target.closest('#canvas-area')) _showCanvasCtxMenu(e);
    return;
  }

  var key = blkEl.dataset.key;
  var _ctxBlkData = key ? getBlkByKey(key) : null;
  var _ctxGroupId = _ctxBlkData ? (_ctxBlkData.groupId || null) : null;

  /* 콘텐츠 우선: 우클릭도 개별 블록 선택 (그룹 상태는 항상 해제) */
  if (selectedGi) { selectedGi = null; hideGroupToolbar(); }
  var alreadySelected = key && selKey === key && selKeys.length <= 1;
  var alreadyInMulti  = key && selKeys.indexOf(key) !== -1 && selKeys.length > 1;
  if (key && !alreadySelected && !alreadyInMulti) {
    selKeys = [];
    selKey = key;
    document.querySelectorAll('.blk').forEach(function(el) {
      el.classList.remove('selected');
      el.style.outline = '';
      el.style.outlineOffset = '';
    });
    blkEl.classList.add('selected');
    blkEl.style.outline = '2.5px solid var(--accent)';
    blkEl.style.outlineOffset = '-1px';
    blkEl.style.boxShadow = _blkSelBoxShadow(_ctxBlkData);
  }
  /* 우클릭으로 selKey가 바뀔 때 패널도 동기화 — 이전 블록의 패널이 남는 현상 방지 */
  if (_ctxBlkData) {
    showBlockPanel(_ctxBlkData.type, null, _ctxBlkData);
    if (_ctxBlkData.type === 'txt' || _ctxBlkData.type === 'title') showTxtFormatBar(_ctxBlkData);
    else hideTxtFormatBar();
  }

  showCtxMenu(e, _ctxGroupId);
});

function handleCanvasClick(e) {
  /* 팬 동작 직후에는 클릭 이벤트 무시 */
  if (_isPanning) return;
  var pop = document.getElementById('blk-popup');
  if (pop.classList.contains('show')) { pop.classList.remove('show'); return; }
  var tgt = e.target;
  if (tgt === document.getElementById('canvas-area') ||
      tgt === document.getElementById('canvas-stage') ||
      tgt === document.getElementById('canvas-inner') ||
      tgt === document.getElementById('sheet') ||
      tgt === document.getElementById('sheet-pad')) {
    /* 헤더 이미지 편집 모드 종료 */
    if (activeHdrImgKind) exitHeaderImgEditMode();
    /* 시트 바깥 클릭 시 항상 캔버스 탭으로 복귀 */
    showCanvasPanel._lastNav = 'canvas';
    /* 그룹·블록 동시 선택 가능하므로 둘 다 해제 */
    var _hadSel = !!(selKey || selKeys.length);
    if (selectedGi !== null) deselectGroup();
    if (_hadSel) deselect();
    /* 아무것도 선택되지 않은 상태에서도 캔버스 탭으로 전환 */
    else switchNav('canvas');
  }
}

/* ══════════════════════════════════════════
   캔버스 높이 자동 확장
══════════════════════════════════════════ */
function autoCanvasH() {
  var pad = document.getElementById('sheet-pad');
  if (!pad) return;
  var maxBottom = 0;
  blocks.forEach(function(blk) {
    var b = blk.y + blk.h;
    if (b > maxBottom) maxBottom = b;
  });
  pad.style.height = (maxBottom + gaps.pad + canvasExtraBottom) + 'px';
  updateResizeHandles();
  updateSizeInfo();
}

function updateSizeInfo() {
  /* 너비: updateCanvasWidth()에서 동기화, 높이: 자동 계산
     패널 표시 UI 없음 — 스텝4 캔버스 핸들 연동 시 확장 예정 */
}

