/* stickers.js — 리팩토링 2단계 12번째(마지막) 조각: 스티커 시스템 전체 — REFACTOR_PLAN상 가장 마지막에 가장 조심스럽게 분리해야 할 영역. bindStickerEvents/bindResizeHandle/bindRotateHandle/renderStickersToCanvas/bindResizeHandleMulti/bindRotateHandleMulti 재작성 금지 함수 포함 — app/public/legacy/main.js에서 그대로 이동만 함 */
/* ══════════════════════════════════════════
   스티커 시스템 (돌딤섬 동일 UI/UX)
══════════════════════════════════════════ */

function stickerLayer() { return document.getElementById('sticker-layer'); }

function toggleSpAcc(id) {
  var el = document.getElementById(id);
  if (!el) return;
  var body = el.querySelector('.sp-acc-b');
  if (!body) return;
  var isOpen = el.classList.contains('open');
  if (isOpen) {
    /* 닫기 — max-height:none일 수 있으므로 scrollHeight를 먼저 px로 고정 후 0으로 */
    body.style.maxHeight = body.scrollHeight + 'px';
    requestAnimationFrame(function() {
      requestAnimationFrame(function() {
        body.style.maxHeight = '0';
      });
    });
    el.classList.remove('open');
  } else {
    /* 열기 — scrollHeight 측정 후 주입 */
    el.classList.add('open');
    body.style.maxHeight = body.scrollHeight + 'px';
    body.addEventListener('transitionend', function onEnd() {
      body.style.maxHeight = 'none';
      body.removeEventListener('transitionend', onEnd);
    });
  }
}

function updateSpAccCount() {
  var imgCount = document.getElementById('sp-grp-img-count');
  if (imgCount) imgCount.textContent = stickerLibrary.length;
}

function toggleStickerEdit() {
  stickerEditMode = !stickerEditMode;
  var layer = stickerLayer();
  if (stickerEditMode) {
    layer.classList.add('editing');
  } else {
    layer.classList.remove('editing');
    deselectSticker();
  }
}

function uploadStickerImages(input) {
  var files = Array.from(input.files);
  if (!files.length) return;
  files.forEach(function(file) {
    var reader = new FileReader();
    reader.onload = function(e) {
      stickerLibrary.push({ libId: ++stickerLibIdCounter, src: e.target.result });
      renderStickerLibrary();
    };
    reader.readAsDataURL(file);
  });
  input.value = '';
}

function renderStickerLibrary() {
  var grid = document.getElementById('sticker-library-grid');
  if (!grid) return;
  grid.innerHTML = '';
  if (stickerLibrary.length === 0) {
    grid.innerHTML = '<div class="sticker-library-empty">업로드한 이미지가 없어요</div>';
    return;
  }
  stickerLibrary.forEach(function(item) {
    var cell = document.createElement('div');
    cell.className = 'sticker-thumb-item';
    cell.title = '클릭: 시트에 추가 · 드래그: 원하는 위치에 배치';
    cell.draggable = true;
    cell.dataset.libId = item.libId;
    var img = document.createElement('img');
    img.src = item.src;
    var delBtn = document.createElement('button');
    delBtn.className = 'sticker-thumb-del';
    delBtn.title = '라이브러리에서 삭제';
    delBtn.textContent = '✕';
    (function(id){ delBtn.onclick = function(e){ e.stopPropagation(); removeFromLibrary(id); }; })(item.libId);
    var badge = document.createElement('span');
    badge.className = 'sticker-thumb-add-badge';
    badge.textContent = '＋';
    cell.appendChild(img); cell.appendChild(delBtn); cell.appendChild(badge);
    (function(src){ cell.addEventListener('click', function(){ placeSticker(src); }); })(item.src);
    (function(lid){
      cell.addEventListener('dragstart', function(e){
        e.dataTransfer.setData('text/plain', String(lid));
        e.dataTransfer.effectAllowed = 'copy';
        cell.classList.add('dragging');
      });
      cell.addEventListener('dragend', function(){ cell.classList.remove('dragging'); });
    })(item.libId);
    grid.appendChild(cell);
  });
  updateSpAccCount();
}

function removeFromLibrary(libId) {
  stickerLibrary = stickerLibrary.filter(function(i){ return i.libId !== libId; });
  renderStickerLibrary();
}

function placeSticker(src) {
  var sheet = document.getElementById('sheet');
  var sw = sheet.offsetWidth;
  var sh = sheet.offsetHeight;
  var tmpImg = new Image();
  tmpImg.onload = function() {
    var defaultSize = Math.round(sw * 0.25);
    var naturalPx = tmpImg.naturalWidth;
    var initSize = Math.min(defaultSize, naturalPx > 0 ? naturalPx : defaultSize);
    var sticker = {
      id: ++stickerIdCounter,
      type: 'img',
      content: src,
      x: Math.round(sw * 0.1 + Math.random() * sw * 0.6),
      y: Math.round(sh * 0.05 + Math.random() * sh * 0.4),
      size: Math.max(80, initSize),
      rotate: 0,
      locked: false
    };
    saveHistory();
    stickers.push(sticker);
    renderSticker(sticker);
    if (!stickerEditMode) toggleStickerEdit();
    selectSticker(sticker.id);
  };
  tmpImg.src = src;
}

function renderSticker(sticker) {
  var layer = stickerLayer();
  var el = document.getElementById('sticker-' + sticker.id);
  if (!el) {
    el = document.createElement('div');
    el.id = 'sticker-' + sticker.id;
    el.className = 'sticker-item';
    layer.appendChild(el);
  }
  el.style.left      = sticker.x + 'px';
  el.style.top       = sticker.y + 'px';
  el.style.transform = 'rotate(' + sticker.rotate + 'deg)';

  el.innerHTML = '<img src="' + sticker.content + '" style="width:' + sticker.size + 'px;height:auto;display:block;pointer-events:none;" draggable="false">';

  if (!el.dataset.bound) {
    el.dataset.bound = '1';
    bindStickerEvents(el, sticker);
  }
  el.classList.toggle('selected', selectedStickerIds.indexOf(sticker.id) !== -1);
  updateStickerHandles(el, sticker);
}

function updateStickerHandles(el, sticker) {
  el.querySelectorAll('.sticker-handle, .sh-rotate-line, .sk-corner, .sk-unlock, .sk-lock-badge').forEach(function(h){ h.remove(); });
  var isSelected = selectedStickerIds.indexOf(sticker.id) !== -1;
  var isMulti = selectedStickerIds.length > 1;

  /* 잠금 배지 — 선택 여부와 무관하게 잠금 시 표시 */
  el.classList.toggle('sk-locked', !!sticker.locked);
  if (sticker.locked) {
    var badge = document.createElement('div');
    badge.className = 'sk-lock-badge';
    badge.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="10.5" width="14" height="9.5" rx="2"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/></svg>';
    el.appendChild(badge);
  }

  if (!isSelected || !stickerEditMode) return;

  var LOCK_SVG   = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="10.5" width="14" height="9.5" rx="2"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/></svg>';
  var UNLOCK_SVG = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="10.5" width="14" height="9.5" rx="2"/><path d="M8 10.5V7.5a4 4 0 0 1 7.8-1.2"/></svg>';
  var DEL_SVG    = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>';
  var ROT_SVG    = '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/></svg>';

  /* 잠금 상태: 해제 버튼만 표시, 핸들 없음 */
  if (sticker.locked) {
    var unlockBtn = document.createElement('div');
    unlockBtn.className = 'sk-unlock';
    unlockBtn.title = '잠금 해제';
    unlockBtn.innerHTML = LOCK_SVG;
    unlockBtn.addEventListener('mousedown', function(e){ e.stopPropagation(); toggleStickerLock(); });
    el.appendChild(unlockBtn);
    _refreshStickerActionUI();
    return;
  }

  /* 8방향 리사이즈 핸들 */
  var dirMap = [
    ['nw', -1, -1], ['n',  0, -1], ['ne',  1, -1],
    ['e',   1,  0],                 ['w',  -1,  0],
    ['sw', -1,  1], ['s',  0,  1], ['se',  1,  1]
  ];
  dirMap.forEach(function(d) {
    var h = document.createElement('div');
    h.className = 'sticker-handle ' + d[0];
    if (isMulti) bindResizeHandleMultiDir(h, sticker, d[1], d[2]);
    else bindResizeHandleDir(h, sticker, d[1], d[2]);
    el.appendChild(h);
  });

  /* 회전 핸들 — 연결선은 ::before 대신 별도 형제 div(.sh-rotate-line)로 분리(Phase 6 (4),
     'n' 핸들과의 겹침 해결). 위치는 CSS가 담당, 여기선 마크업 생성만 */
  var rotH = document.createElement('div');
  rotH.className = 'sticker-handle rotate';
  rotH.innerHTML = ROT_SVG;
  rotH.title = isMulti ? '일괄 회전' : '회전';
  if (isMulti) bindRotateHandleMulti(rotH, sticker);
  else bindRotateHandle(rotH, sticker);
  el.appendChild(rotH);

  var rotLine = document.createElement('div');
  rotLine.className = 'sh-rotate-line';
  el.appendChild(rotLine);

  /* sk-corner (단일 선택 시 — 잠금 + 삭제 세로 미니바) */
  if (!isMulti) {
    var corner = document.createElement('div');
    corner.className = 'sk-corner';

    var lockBtn = document.createElement('button');
    lockBtn.className = 'sk-cn-btn';
    lockBtn.innerHTML = UNLOCK_SVG;
    lockBtn.title = '잠금';
    lockBtn.addEventListener('mousedown', function(e){ e.stopPropagation(); toggleStickerLock(); });
    corner.appendChild(lockBtn);

    var sep = document.createElement('div'); sep.className = 'sk-cn-sep';
    corner.appendChild(sep);

    var delBtn = document.createElement('button');
    delBtn.className = 'sk-cn-btn danger';
    delBtn.innerHTML = DEL_SVG;
    delBtn.title = '삭제';
    delBtn.addEventListener('mousedown', function(e){ e.stopPropagation(); removeSticker(sticker.id); });
    corner.appendChild(delBtn);

    el.appendChild(corner);
  }

  _refreshStickerActionUI();
}

/* bindStickerEvents 내부 keydown 리스너 — 스티커 DOM이 재생성될 때마다(undo/redo,
   슬롯 불러오기) bindStickerEvents가 다시 호출되며 동일 로직의 리스너가 계속 누적되는
   문제 방지. 로직은 그대로 두고 이름 있는 함수로 분리해 addEventListener의 동일 참조
   중복등록 방지 기본동작에 맡김(bindStickerEvents 본문은 호출부 한 줄만 교체) */
function _stickerDeleteKeyHandler(e) {
  if (!stickerEditMode) return;
  if ((e.key === 'Delete' || e.key === 'Backspace') && selectedStickerIds.length > 0) {
    var inInput = document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA');
    if (inInput) return;
    selectedStickerIds.slice().forEach(function(id){ removeSticker(id); });
  }
}

function bindStickerEvents(el, sticker) {
  var dragging = false, startX = 0, startY = 0, startSX = 0, startSY = 0, didDrag = false;
  el.addEventListener('mousedown', function(e) {
    if (!stickerEditMode || sticker.locked) return;
    if (e.target.closest('.sticker-handle') || e.target.closest('.sticker-inline-editor')) return;
    dragging = true; didDrag = false;
    startX = e.clientX; startY = e.clientY;
    startSX = sticker.x; startSY = sticker.y;
    /* 다중 드래그를 위해 현재 시점 x/y + 실제 높이를 임시 스냅샷으로 기록 */
    stickers.forEach(function(s) {
      if (selectedStickerIds.indexOf(s.id) !== -1) {
        s._dragStartX = s.x; s._dragStartY = s.y;
        var el2 = document.getElementById('sticker-' + s.id);
        s._dragH = el2 ? el2.offsetHeight : s.size;
      }
    });
    e.preventDefault(); e.stopPropagation();
    if (!e.shiftKey) { if (selectedStickerIds.indexOf(sticker.id) === -1) selectSticker(sticker.id); }
    else toggleStickerSelection(sticker.id);
  });
  window.addEventListener('mousemove', function(e) {
    if (!dragging) return;
    var dx = e.clientX - startX, dy = e.clientY - startY;
    if (Math.abs(dx) > 2 || Math.abs(dy) > 2) didDrag = true;
    /* zoom 보정: 뷰포트 px → 캔버스 px */
    var z = typeof _zoomLevel === 'number' && _zoomLevel > 0 ? _zoomLevel : 1;
    var cdx = dx / z, cdy = dy / z;
    if (selectedStickerIds.length > 1) {
      /* 다중: 선택된 모든 스티커 DOM + 데이터 동시 갱신
         (데이터 미갱신 시 renderSticker 호출 시점에 위치 복귀 버그 발생) */
      var moved = selectedStickerIds.indexOf(sticker.id) !== -1;
      if (moved) {
        stickers.forEach(function(s) {
          if (selectedStickerIds.indexOf(s.id) !== -1 && !s.locked) {
            var el2 = document.getElementById('sticker-' + s.id);
            if (stickerOverflow) {
              s.x = s._dragStartX + cdx;
              s.y = s._dragStartY + cdy;
            } else {
              s.x = Math.max(-canvasExtraLeft, Math.min(canvasW - s.size, s._dragStartX + cdx));
              s.y = Math.max(-canvasExtraTop,  Math.min(canvasH - s.size, s._dragStartY + cdy));
            }
            if (el2) { el2.style.left = s.x + 'px'; el2.style.top = s.y + 'px'; }
          }
        });
      }
    } else {
      if (stickerOverflow) {
        sticker.x = startSX + cdx;
        sticker.y = startSY + cdy;
      } else {
        sticker.x = Math.max(-canvasExtraLeft, Math.min(canvasW - sticker.size, startSX + cdx));
        sticker.y = Math.max(-canvasExtraTop,  Math.min(canvasH - sticker.size, startSY + cdy));
      }
      el.style.left = sticker.x + 'px'; el.style.top = sticker.y + 'px';
    }
    _showStickerFloatBar();
  });
  window.addEventListener('mouseup', function() {
    if (!dragging) return;
    /* 다중 드래그 시작 시 기록해 둔 임시 프로퍼티 정리 */
    if (selectedStickerIds.length > 1) {
      stickers.forEach(function(s) { delete s._dragStartX; delete s._dragStartY; delete s._dragH; });
    }
    dragging = false;
  });
  el.addEventListener('click', function(e) {
    if (didDrag) { didDrag = false; e.stopPropagation(); }
  }, true);
  /* Delete 키 삭제 */
  document.addEventListener('keydown', _stickerDeleteKeyHandler);
}

/* 방향별 리사이즈 — dxSign/dySign: -1(왼/위), 0(무시), 1(오른/아래) */
function bindResizeHandleDir(handle, sticker, dxSign, dySign) {
  handle.addEventListener('mousedown', function(e) {
    e.stopPropagation(); e.preventDefault();
    if (sticker.locked) return;
    var el = document.getElementById('sticker-' + sticker.id);
    var startX = e.clientX, startY = e.clientY, startSize = sticker.size;
    var axes = (dxSign !== 0 ? 1 : 0) + (dySign !== 0 ? 1 : 0);
    function onMove(e2) {
      var z2 = typeof _zoomLevel === 'number' && _zoomLevel > 0 ? _zoomLevel : 1;
      var delta = (dxSign * (e2.clientX - startX) + dySign * (e2.clientY - startY)) / (axes || 1) / z2;
      sticker.size = Math.max(20, startSize + delta);
      var img = el.querySelector('img');
      if (img) img.style.width = sticker.size + 'px';
    }
    function onUp() {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      renderSticker(sticker);
    }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  });
}

function bindResizeHandleMultiDir(handle, triggerSticker, dxSign, dySign) {
  handle.addEventListener('mousedown', function(e) {
    e.stopPropagation(); e.preventDefault();
    var startX = e.clientX, startY = e.clientY;
    var axes = (dxSign !== 0 ? 1 : 0) + (dySign !== 0 ? 1 : 0);
    var initSizes = {};
    selectedStickerIds.forEach(function(id) {
      var s = stickers.find(function(s){ return s.id === id; });
      if (s) initSizes[id] = s.size;
    });
    function onMove(e2) {
      var z2 = typeof _zoomLevel === 'number' && _zoomLevel > 0 ? _zoomLevel : 1;
      var delta = (dxSign * (e2.clientX - startX) + dySign * (e2.clientY - startY)) / (axes || 1) / z2;
      selectedStickerIds.forEach(function(id) {
        var s = stickers.find(function(s){ return s.id === id; });
        var el2 = document.getElementById('sticker-' + id);
        if (!s || !el2 || s.locked) return;
        s.size = Math.max(20, initSizes[id] + delta);
        var img = el2.querySelector('img'); if (img) img.style.width = s.size + 'px';
      });
    }
    function onUp() {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      selectedStickerIds.forEach(function(id) {
        var s = stickers.find(function(s){ return s.id === id; });
        if (s) renderSticker(s);
      });
    }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  });
}

function bindRotateHandle(handle, sticker) {
  handle.addEventListener('mousedown', function(e) {
    e.stopPropagation(); e.preventDefault();
    if (sticker.locked) return;
    var el = document.getElementById('sticker-' + sticker.id);
    var rect = el.getBoundingClientRect();
    var cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2;
    var startAngle = Math.atan2(e.clientY - cy, e.clientX - cx) * 180 / Math.PI;
    var startRotate = sticker.rotate;
    function onMove(e2) {
      var angle = Math.atan2(e2.clientY - cy, e2.clientX - cx) * 180 / Math.PI;
      sticker.rotate = startRotate + (angle - startAngle);
      el.style.transform = 'rotate(' + sticker.rotate + 'deg)';
    }
    function onUp() {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  });
}

function bindRotateHandleMulti(handle, triggerSticker) {
  handle.addEventListener('mousedown', function(e) {
    e.stopPropagation(); e.preventDefault();
    var trigEl = document.getElementById('sticker-' + triggerSticker.id);
    var rect = trigEl.getBoundingClientRect();
    var cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2;
    var startAngle = Math.atan2(e.clientY - cy, e.clientX - cx) * 180 / Math.PI;
    var initRotates = {};
    selectedStickerIds.forEach(function(id) {
      var s = stickers.find(function(s){ return s.id === id; });
      if (s) initRotates[id] = s.rotate;
    });
    function onMove(e2) {
      var angle = Math.atan2(e2.clientY - cy, e2.clientX - cx) * 180 / Math.PI;
      var delta = angle - startAngle;
      selectedStickerIds.forEach(function(id) {
        var s = stickers.find(function(s){ return s.id === id; });
        var el = document.getElementById('sticker-' + id);
        if (!s || !el || s.locked) return;
        s.rotate = initRotates[id] + delta;
        el.style.transform = 'rotate(' + s.rotate + 'deg)';
      });
    }
    function onUp() {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  });
}

function selectSticker(id) {
  _deselectBlocksOnly();
  selectedStickerIds = [id];
  _refreshStickerSelection();
}
function toggleStickerSelection(id) {
  _deselectBlocksOnly();
  var idx = selectedStickerIds.indexOf(id);
  if (idx !== -1) selectedStickerIds.splice(idx, 1);
  else selectedStickerIds.push(id);
  _refreshStickerSelection();
}
function deselectSticker() {
  selectedStickerIds = [];
  _refreshStickerSelection();
}
function _refreshStickerSelection() {
  stickers.forEach(function(s) {
    var el = document.getElementById('sticker-' + s.id);
    if (!el) return;
    el.classList.toggle('selected', selectedStickerIds.indexOf(s.id) !== -1);
    updateStickerHandles(el, s);
  });
  _refreshStickerActionUI();
  _showStickerFloatBar();
}
function _refreshStickerActionUI() {
  /* sticker-action-btns/sticker-align-btns는 v2에서 제거됨 — null guard 유지 */
  var actionBtns = document.getElementById('sticker-action-btns');
  var alignBtns  = document.getElementById('sticker-align-btns');
  var n = selectedStickerIds.length;
  if (actionBtns) actionBtns.style.display = (n === 1) ? 'flex' : 'none';
  if (alignBtns)  alignBtns.style.display  = (n >= 2) ? 'flex' : 'none';
}

function alignStickers(type) {
  var selected = stickers.filter(function(s){ return selectedStickerIds.indexOf(s.id) !== -1 && !s.locked; });
  if (selected.length < 2) return;
  var xs = selected.map(function(s){ return s.x; });
  var ys = selected.map(function(s){ return s.y; });
  var minX = Math.min.apply(null, xs), maxX = Math.max.apply(null, xs);
  var minY = Math.min.apply(null, ys), maxY = Math.max.apply(null, ys);
  selected.forEach(function(s) {
    if (type === 'left')         s.x = minX;
    else if (type === 'right')   s.x = maxX;
    else if (type === 'center-h') s.x = (minX + maxX) / 2;
    else if (type === 'top')     s.y = minY;
    else if (type === 'bottom')  s.y = maxY;
    else if (type === 'center-v') s.y = (minY + maxY) / 2;
    else if (type === 'distribute-h') {
      var sorted = selected.slice().sort(function(a,b){ return a.x - b.x; });
      var step = (maxX - minX) / (sorted.length - 1);
      sorted.forEach(function(st, i){ st.x = minX + step * i; });
    } else if (type === 'distribute-v') {
      var sorted = selected.slice().sort(function(a,b){ return a.y - b.y; });
      var step = (maxY - minY) / (sorted.length - 1);
      sorted.forEach(function(st, i){ st.y = minY + step * i; });
    }
    var el = document.getElementById('sticker-' + s.id);
    if (el) { el.style.left = s.x + 'px'; el.style.top = s.y + 'px'; }
  });
}

function toggleStickerLock() {
  if (selectedStickerIds.length !== 1) return;
  var s = stickers.find(function(s){ return s.id === selectedStickerIds[0]; });
  if (!s) return;
  saveHistory();
  s.locked = !s.locked;
  _refreshStickerSelection();
}

function bringToFront(id) {
  var idx = stickers.findIndex(function(s){ return s.id === id; });
  if (idx === -1) return;
  saveHistory();
  var item = stickers.splice(idx, 1)[0];
  stickers.push(item);
  var layer = stickerLayer();
  var el = document.getElementById('sticker-' + id);
  if (el) layer.appendChild(el);
}

function sendToBack(id) {
  var idx = stickers.findIndex(function(s){ return s.id === id; });
  if (idx === -1) return;
  saveHistory();
  var item = stickers.splice(idx, 1)[0];
  stickers.unshift(item);
  var layer = stickerLayer();
  var el = document.getElementById('sticker-' + id);
  var first = layer.querySelector('.sticker-item');
  if (el && first) layer.insertBefore(el, first);
}

function removeSticker(id) {
  saveHistory();
  stickers = stickers.filter(function(s){ return s.id !== id; });
  var el = document.getElementById('sticker-' + id);
  if (el) el.remove();
  selectedStickerIds = selectedStickerIds.filter(function(i){ return i !== id; });
  _refreshStickerActionUI();
}

function clearAllStickers() {
  if (stickers.length === 0) { showToast('삭제할 이미지가 없어요.'); return; }
  if (!confirm('이미지를 모두 삭제할까요?')) return;
  saveHistory();
  stickers.forEach(function(s) {
    var el = document.getElementById('sticker-' + s.id);
    if (el) el.remove();
  });
  stickers = [];
  selectedStickerIds = [];
}

/* ── 스티커 드래그앤드롭 (라이브러리 → 시트) ── */
(function() {
  var sheet = document.getElementById('sheet');
  if (!sheet) return;
  sheet.addEventListener('dragover', function(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    sheet.classList.add('sticker-drop-over');
  });
  sheet.addEventListener('dragleave', function() {
    sheet.classList.remove('sticker-drop-over');
  });
  sheet.addEventListener('drop', function(e) {
    e.preventDefault();
    sheet.classList.remove('sticker-drop-over');
    var libId = parseInt(e.dataTransfer.getData('text/plain'));
    if (!libId) return;
    var item = stickerLibrary.find(function(i){ return i.libId === libId; });
    if (!item) return;
    var rect = sheet.getBoundingClientRect();
    var dropX = e.clientX - rect.left;
    var dropY = e.clientY - rect.top;
    var tmpImg = new Image();
    tmpImg.onload = function() {
      var sticker = {
        id: ++stickerIdCounter, type: 'img', content: item.src,
        x: Math.round(dropX - 40), y: Math.round(dropY - 40),
        size: Math.max(80, Math.min(tmpImg.naturalWidth || 80, Math.round(sheet.offsetWidth * 0.25))),
        rotate: 0, locked: false
      };
      saveHistory();
      stickers.push(sticker);
      renderSticker(sticker);
      if (!stickerEditMode) toggleStickerEdit();
      selectSticker(sticker.id);
    };
    tmpImg.src = item.src;
  });
  /* 스티커 레이어 빈 곳 클릭 → 선택 해제 */
  var layer = document.getElementById('sticker-layer');
  if (layer) {
    layer.addEventListener('click', function(e) {
      if (e.target === layer) deselectSticker();
    });
  }
  /* 캔버스 밖 클릭 시 선택 해제만 (이미지는 상시 활성 상태이므로 모드 체크 불필요) */
  document.addEventListener('mousedown', function(e) {
    var inSticker = e.target.closest('.sticker-item') ||
                    e.target.closest('#panel-sticker') ||
                    e.target.closest('.float-tab') ||
                    e.target.closest('#sticker-float-bar');
    if (!inSticker) deselectSticker();
  });
})();

/* ── 스티커 위 휠 클릭(button===1) → 캔버스 팬 ──
   C-4: 기존엔 단순 stopPropagation으로 bindStickerEvents(재작성 금지)의 드래그
   시작만 막으려 했는데, capture 단계에서 멈춰버려 #canvas-area의 팬 시작 로직
   (main.js)까지 같이 막혀 휠클릭 화면이동이 안 되는 부작용이 있었음. 전파를
   끊는 대신 여기서 팬을 직접 시작시켜, 스티커 드래그는 막고 화면이동은 살림 */
document.addEventListener('mousedown', function(e) {
  if (e.button === 1 && e.target.closest('.sticker-item')) {
    e.preventDefault();
    e.stopPropagation();
    var area = document.getElementById('canvas-area');
    if (!area) return;
    _isPanning    = true;
    _panStartX    = e.clientX;
    _panStartY    = e.clientY;
    _panStartOffX = _panX;
    _panStartOffY = _panY;
    area.classList.add('panning');
  }
}, true);

/* ── PNG 저장 시 스티커 Canvas에 합성 ── */
function renderStickersToCanvas(ctx, ox, oy, DPR) {
  /* ctx는 이미 ctx.scale(DPR, DPR) 적용 상태 —
     좌표·크기는 1x 기준으로만 계산, DPR 중복 적용 금지 */
  if (stickers.length === 0) return;
  var promises = stickers.map(function(s) {
    return new Promise(function(resolve) {
      ctx.save();
      var px = ox + s.x;
      var py = oy + s.y;
      if (s.rotate) {
        ctx.translate(px, py);
        ctx.rotate(s.rotate * Math.PI / 180);
        ctx.translate(-px, -py);
      }
      var img = new Image();
      img.onload = function() {
        var w = s.size;
        var h = (img.naturalHeight / img.naturalWidth) * w;
        ctx.drawImage(img, px, py, w, h);
        ctx.restore();
        resolve();
      };
      img.onerror = function() { ctx.restore(); resolve(); };
      img.src = s.content;
    });
  });
  return Promise.all(promises);
}

/* ══ 플로팅 정렬 툴바 ══ */
function _showStickerFloatBar() {
  var bar = document.getElementById('sticker-float-bar');
  if (!bar) return;
  var n = selectedStickerIds.length;
  if (n < 2) { bar.style.display = 'none'; return; }
  var xs = [], x2s = [], ys = [];
  selectedStickerIds.forEach(function(id) {
    var el = document.getElementById('sticker-' + id);
    if (!el) return;
    var l = el.offsetLeft, t = el.offsetTop, w = el.offsetWidth;
    xs.push(l); x2s.push(l + w); ys.push(t);
  });
  if (xs.length === 0) { bar.style.display = 'none'; return; }
  var cx = (Math.min.apply(null, xs) + Math.max.apply(null, x2s)) / 2;
  var ty = Math.min.apply(null, ys);
  bar.style.left = Math.round(cx) + 'px';
  bar.style.top  = Math.round(ty) + 'px';
  bar.style.display = 'flex';
  /* 분배 버튼: n≥3일 때 활성(accent 솔리드), n=2이면 비활성 */
  var dh = document.getElementById('ft-dist-h');
  var dv = document.getElementById('ft-dist-v');
  if (dh && dv) {
    var active = n >= 3;
    dh.classList.toggle('inactive', !active);
    dv.classList.toggle('inactive', !active);
    dh.disabled = !active;
    dv.disabled = !active;
  }
}

/* ══ 우클릭 컨텍스트 메뉴 ══ */
function _openStickerCtx(x, y, stickerId) {
  _ctxTargetId = stickerId;
  var menu = document.getElementById('sticker-ctx-menu');
  if (!menu) return;
  /* 잠금 버튼 레이블 동기화 */
  var s = stickers.find(function(s){ return s.id === stickerId; });
  var lockLbl = document.getElementById('sticker-ctx-lock-lbl');
  if (lockLbl && s) lockLbl.textContent = s.locked ? '잠금 해제' : '잠금';
  menu.style.left = x + 'px';
  menu.style.top  = y + 'px';
  menu.style.display = 'block';
}
function _closeStickerCtx() {
  var menu = document.getElementById('sticker-ctx-menu');
  if (menu) menu.style.display = 'none';
  _ctxTargetId = null;
}
function _ctxDuplicate() {
  _closeStickerCtx();
  if (_ctxTargetId === null) return;
  var src = stickers.find(function(s){ return s.id === _ctxTargetId; });
  if (!src) return;
  var dup = JSON.parse(JSON.stringify(src));
  dup.id = ++stickerIdCounter;
  dup.x += 16; dup.y += 16;
  stickers.push(dup);
  renderSticker(dup);
  selectSticker(dup.id);
}
function _ctxBringToFront() {
  _closeStickerCtx();
  if (_ctxTargetId !== null) { bringToFront(_ctxTargetId); }
}
function _ctxSendToBack() {
  _closeStickerCtx();
  if (_ctxTargetId !== null) { sendToBack(_ctxTargetId); }
}
function _ctxToggleLock() {
  _closeStickerCtx();
  if (_ctxTargetId !== null) {
    selectedStickerIds = [_ctxTargetId];
    toggleStickerLock();
  }
}
function _ctxDelete() {
  _closeStickerCtx();
  if (_ctxTargetId !== null) { removeSticker(_ctxTargetId); }
}

function toggleStickerOverflow() {
  stickerOverflow = !stickerOverflow;
  var btn = document.getElementById('sticker-overflow-sw');
  if (btn) btn.classList.toggle('on', stickerOverflow);
}

function syncStickerOverflowUI() {
  var btn = document.getElementById('sticker-overflow-sw');
  if (btn) btn.classList.toggle('on', stickerOverflow);
}

