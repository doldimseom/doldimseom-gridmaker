/* slots-storage.js — 슬롯 저장·불러오기·JSON import/export·전체 초기화 */
/* ══════════════════════════════════════════
   슬롯 — 데이터 수집 / 복원
══════════════════════════════════════════ */
function collectData(includeImages) {
  /* blocks 딥카피 */
  var blkCopy = JSON.parse(JSON.stringify(blocks));
  /* 슬롯 저장 시 base64 imgSrc 제거 — localStorage 용량 초과 방지
     doExportNow() 등 JSON 내보내기 시에만 includeImages=true로 호출 */
  if (!includeImages) {
    blkCopy.forEach(function(b) { if (b.imgSrc) b.imgSrc = null; });
  }
  var hdrCopy = JSON.parse(JSON.stringify(headerData));
  if (!includeImages) {
    if (hdrCopy.bannerImgSrc) hdrCopy.bannerImgSrc = null;
  }
  /* 스티커 수집
     슬롯(includeImages=false): 용량 문제로 스티커 미포함(C-7: 텍스트 스티커 제거로
     슬롯에 저장 가능한 가벼운 스티커 타입이 없어짐 — 스티커 없이 저장하는 쪽으로 결정)
     JSON 내보내기(includeImages=true): 전체 포함 */
  var stickersCopy = includeImages ? JSON.parse(JSON.stringify(stickers || [])) : [];
  var stickerLibCopy = includeImages ? JSON.parse(JSON.stringify(stickerLibrary || [])) : [];
  return {
    blocks:        blkCopy,
    canvasW:          canvasW,
    canvasH:          canvasH,
    canvasExtraTop:   canvasExtraTop,
    canvasExtraLeft:  canvasExtraLeft,
    headerPos:        headerPos,
    headerData:    hdrCopy,
    globalVals:    JSON.parse(JSON.stringify(globalVals)),
    gaps:          JSON.parse(JSON.stringify(gaps)),
    sheetBg:       sheetBg,
    sheetRadius:   sheetRadius,
    pngMargin:     pngMargin,
    pngBg:         pngBg,
    bgLayer:       JSON.parse(JSON.stringify(bgLayer)),
    stickers:      stickersCopy,
    stickerLibrary: stickerLibCopy,
    stickerOverflow: stickerOverflow,
    canvasSizeLocked: canvasSizeLocked
  };
}

function applyData(data) {
  if (!data) return;
  _isApplyingHistory = true;

  /* ── blocks 로드 ── */
  if (data.blocks) {
    /* v13c 이전 데이터 호환 — spacer 타입 블록 자동 제거 */
    blocks = JSON.parse(JSON.stringify(data.blocks)).filter(function(b) { return b.type !== 'spacer'; });
    /* blk.id 최대값으로 카운터 동기화 */
    _blkIdCounter = 0;
    blocks.forEach(function(b) {
      var n = parseInt((b.id || '').replace('b_', '')) || 0;
      if (n > _blkIdCounter) _blkIdCounter = n;
    });
    /* blk.spans 마이그레이션 — blk.text만 있고 blk.spans 없는 구버전 블록 처리 */
    blocks.forEach(function(blk) {
      if (blk.type === 'txt' && !blk.spans) {
        blk.spans = [{ text: blk.text || '' }];
      }
      if (blk.stroke === undefined || blk.stroke === null) blk.stroke = 0;
      if (blk.tstroke === undefined || blk.tstroke === null) blk.tstroke = 0;
      if (!blk.tstrokeColor) blk.tstrokeColor = '#ffffff';
      /* colorchip 구버전(pre-v09a) 저장 마이그레이션: chip.text → chip.label */
      if (blk.type === 'colorchip' && Array.isArray(blk.chips)) {
        blk.chips.forEach(function(c) {
          if (!c.label && c.text) c.label = c.text;
          if (c.desc === undefined) c.desc = '';
        });
      }
      /* 구버전 globalVals 기반 → 개별 blk 기반 마이그레이션: ccSizeScale/ccGapScale */
      if (blk.type === 'colorchip') {
        if (blk.ccSizeScale === undefined) blk.ccSizeScale = 100;
        if (blk.ccGapScale  === undefined) blk.ccGapScale  = 100;
      }
      /* 구버전 globalVals 기반 → 개별 blk 기반 마이그레이션: itemSizeScale/itemGapScale */
      if (blk.type === 'item') {
        if (blk.itemSizeScale === undefined) blk.itemSizeScale = 100;
        if (blk.itemGapScale  === undefined) blk.itemGapScale  = 100;
      }
      /* 그라디언트 pos 마이그레이션: gradOffset → gradStart.pos/gradEnd.pos */
      if (blk.type === 'img') {
        if (blk.gradStart && blk.gradStart.pos === undefined)
          blk.gradStart.pos = (blk.gradOffset !== undefined ? blk.gradOffset : 0);
        if (blk.gradEnd && blk.gradEnd.pos === undefined)
          blk.gradEnd.pos = 100;
        if (blk.blur  == null) blk.blur  = 0;
        if (blk.noise == null) blk.noise = 0;
      }
    });
  }

  /* canvasW 복원 (canvasH는 gaps 복원 이후 처리 — 구버전 canvasExtraBottom 마이그레이션에 gaps.pad 필요)
     canvas-stage DOM 동기화도 _setStageWidth가 같이 처리(render()는 pad만 업데이트하므로 필요) */
  if (data.canvasW !== undefined) {
    var _restoredCanvasW = typeof data.canvasW === 'number' ? data.canvasW : parseInt(data.canvasW) || 800;
    _setStageWidth(_restoredCanvasW, 'center');
  }
  _updateSliderUI('sl-canvas-w', canvasW);
  var _snCW = document.getElementById('sn-canvas-w'); if (_snCW) _snCW.value = canvasW;

  if (data.headerPos  !== undefined) headerPos  = data.headerPos;
  if (data.headerData) {
    var hd = JSON.parse(JSON.stringify(data.headerData));
    if (!hd.type) hd.type = 'basic';
    if (!hd.bannerH) hd.bannerH = 160;
    if (!hd.snsH && hd.type === 'sns') hd.snsH = hd.bannerH || 120;
    if (!hd.snsH) hd.snsH = 120;
    if (hd.bannerImgOn  === undefined) hd.bannerImgOn  = false;
    headerData = hd;
  }
  if (data.globalVals) {
    globalVals = JSON.parse(JSON.stringify(data.globalVals));
    _updateSliderUI('sl-radius', globalVals.radius); document.getElementById('sn-radius').value = globalVals.radius;
    _updateSliderUI('sl-shadow', globalVals.shadow);  document.getElementById('sn-shadow').value  = globalVals.shadow;
    var _stroke = globalVals.stroke || 0;
    _updateSliderUI('sl-stroke-adv', _stroke);
    var _snSA = document.getElementById('sn-stroke-adv'); if (_snSA) _snSA.value = _stroke;
    _setTileActive('canvas-stroke-tiles', _stroke);
    /* ccSizeScale/ccGapScale/itemSizeScale/itemGapScale는 globalVals에서 제거됨 — blk별로 관리 */
  }
  if (data.gaps) {
    gaps = JSON.parse(JSON.stringify(data.gaps));
    /* pad 슬라이더만 동기화 (col/blk/grp 제거) */
    _updateSliderUI('sl-pad', gaps.pad);
    var snPad = document.getElementById('sn-pad');
    if (snPad) snPad.value = gaps.pad;
  }
  /* canvasH 복원 — canvasW와 대칭되는 절대 높이값(0620_2: 자동 축소 방지 모델) */
  if (typeof data.canvasH === 'number') {
    canvasH = data.canvasH;
  } else {
    /* 구버전 데이터 마이그레이션: canvasExtraBottom(콘텐츠 기준 상대 여백) → canvasH(절대값).
       저장 당시 사용자가 늘려둔 높이가 그대로 보존되도록 그 시점 콘텐츠 높이 + 여백으로 환산 */
    var _migExtraBottom = (typeof data.canvasExtraBottom === 'number') ? data.canvasExtraBottom : 0;
    var _migMaxBottom = 0;
    (data.blocks || []).forEach(function(b) { var be = b.y + b.h; if (be > _migMaxBottom) _migMaxBottom = be; });
    canvasH = _migMaxBottom + gaps.pad + _migExtraBottom;
  }
  /* canvasExtraTop 복원 — F-17. 구버전 데이터(필드 없음)는 0 — 과거엔 상단 여백이 블록 y에
     이미 녹아있어 별도 마이그레이션이 필요 없음(canvasW와 동일 패턴) */
  canvasExtraTop = typeof data.canvasExtraTop === 'number' ? data.canvasExtraTop : 0;
  canvasExtraLeft = typeof data.canvasExtraLeft === 'number' ? data.canvasExtraLeft : 0;
  _syncCanvasLeft(); /* L95의 _setStageWidth('center')가 canvasExtraLeft=0으로 리셋했으므로 재반영 */
  if (data.sheetBg) {
    sheetBg = data.sheetBg;
    var sheetEl = document.getElementById('sheet');
    if (sheetEl) sheetEl.style.background = sheetBg;
    var bgPicker = document.querySelector('#panel-canvas input[type="color"][oninput*="updateCanvasBg"]');
    if (bgPicker) { bgPicker.value = sheetBg; var _cw=bgPicker.closest&&bgPicker.closest('.cw'); if(_cw)_cw.style.background=sheetBg; var _hx=document.getElementById('canvas-bg-hex'); if(_hx)_hx.value=sheetBg.toUpperCase(); }
  }
  if (data.sheetRadius !== undefined) { updateSheetRadiusAdv(data.sheetRadius); }
  if (data.pngMargin !== undefined) {
    pngMargin = data.pngMargin;
    var sw = document.getElementById('png-margin-sw');
    if (sw) sw.classList.toggle('on', pngMargin);
  }
  if (data.pngBg) {
    pngBg = data.pngBg;
    updatePngBg(pngBg);
    var picker = document.getElementById('png-bg-picker');
    if (picker) picker.value = pngBg;
  }
  if (data.bgLayer) {
    Object.assign(bgLayer, data.bgLayer);
    if (bgLayer.imgSrc && bgLayer.imgMode === 'upload') {
      var _cacheImg = new Image();
      _cacheImg.onload = function() {
        bgLayer._imgNaturalW = _cacheImg.naturalWidth;
        bgLayer._imgNaturalH = _cacheImg.naturalHeight;
        applySheetBgLayer();
      };
      _cacheImg.src = bgLayer.imgSrc;
    }
    applySheetBgLayer();
    syncBgLayerPanel();
  }
  /* 스티커 복원 — 기존 DOM 전체 제거 후 재렌더 */
  (function() {
    var layer = document.getElementById('sticker-layer');
    if (layer) {
      var oldItems = layer.querySelectorAll('.sticker-item');
      oldItems.forEach(function(el) { el.remove(); });
    }
    selectedStickerIds = [];
    stickers       = [];
    stickerLibrary = [];
    stickerIdCounter    = 0;
    stickerLibIdCounter = 0;
    if (data.stickers && data.stickers.length) {
      data.stickers.forEach(function(s) {
        if (s.type === 'text') return; /* C-7: 텍스트 스티커 기능 제거 — 구버전 데이터 방어적 스킵 */
        stickers.push(JSON.parse(JSON.stringify(s)));
        if (s.id > stickerIdCounter) stickerIdCounter = s.id;
      });
      stickers.forEach(function(s) { if (s.type !== 'img' || s.content) renderSticker(s); });
    }
    if (data.stickerLibrary && data.stickerLibrary.length) {
      data.stickerLibrary.forEach(function(lib) {
        stickerLibrary.push(JSON.parse(JSON.stringify(lib)));
        if (lib.libId > stickerLibIdCounter) stickerLibIdCounter = lib.libId;
      });
      renderStickerLibrary();
    }
  })();
  /* stickerOverflow 복원 */
  stickerOverflow = typeof data.stickerOverflow === 'boolean' ? data.stickerOverflow : false;
  if (typeof syncStickerOverflowUI === 'function') syncStickerOverflowUI();
  /* canvasSizeLocked 복원 */
  canvasSizeLocked = typeof data.canvasSizeLocked === 'boolean' ? data.canvasSizeLocked : false;
  var _lsw = document.getElementById('canvas-lock-sw');
  if (_lsw) _lsw.classList.toggle('on', canvasSizeLocked);
  var _llbl = document.getElementById('canvas-lock-lbl');
  if (_llbl) _llbl.textContent = '크기 고정 ' + (canvasSizeLocked ? '켜짐' : '꺼짐');
  var _lhs = document.querySelectorAll('.canvas-resize-handle');
  _lhs.forEach(function(h) { h.style.opacity = canvasSizeLocked ? '0.2' : ''; });
  selKey = null;
  selKeys = [];
  /* 탭 자동전환 없이 block 패널만 닫음 (프리셋 선택 시 현재 탭 유지) */
  var _pbEl = document.getElementById('panel-block');
  if (_pbEl) _pbEl.classList.remove('active');
  if (typeof hideTxtFormatBar === 'function') hideTxtFormatBar();
  _pendingHistorySave = false;
  render();
  _isApplyingHistory = false;
}

/* ══════════════════════════════════════════
   슬롯 — localStorage 헬퍼
══════════════════════════════════════════ */

function loadSlots() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } catch { return {}; }
}
function saveSlots(slots) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(slots));
    return true;
  } catch (e) {
    showToast('저장 공간이 부족해 저장하지 못했습니다');
    return false;
  }
}
function formatDate(iso) {
  if (!iso) return '';
  var d = new Date(iso);
  var mm  = String(d.getMonth() + 1).padStart(2, '0');
  var dd  = String(d.getDate()).padStart(2, '0');
  var hh  = String(d.getHours()).padStart(2, '0');
  var min = String(d.getMinutes()).padStart(2, '0');
  return mm + '/' + dd + ' ' + hh + ':' + min;
}

/* ══════════════════════════════════════════
   슬롯 — 모달 열기/닫기
══════════════════════════════════════════ */
function openSlotModal() {
  document.getElementById('slot-modal-backdrop').classList.add('open');
  renderSlotList();
}
function closeSlotModal() {
  document.getElementById('slot-modal-backdrop').classList.remove('open');
  hideSlotTooltip();
}
function handleBackdropClick(e) {
  if (e.target === document.getElementById('slot-modal-backdrop')) closeSlotModal();
}

/* ══════════════════════════════════════════
   슬롯 — 툴팁
══════════════════════════════════════════ */
function showSlotTooltip(btn) {
  var tip = btn.getAttribute('data-tip');
  if (!tip) return;
  var el = document.getElementById('slot-tooltip');
  if (!el) return;
  var rect = btn.getBoundingClientRect();
  el.textContent = tip;
  el.style.opacity = '0';
  el.style.display = 'block';
  var tw = el.offsetWidth;
  el.style.left = (rect.left + rect.width / 2 - tw / 2) + 'px';
  el.style.top  = (rect.top - el.offsetHeight - 5) + 'px';
  el.style.opacity = '1';
}
function hideSlotTooltip() {
  var el = document.getElementById('slot-tooltip');
  if (el) el.style.opacity = '0';
}

/* ══════════════════════════════════════════
   슬롯 — 이름 변경
══════════════════════════════════════════ */
function renameSlot(i, newName) {
  var slots = loadSlots();
  if (!slots[i]) return;
  slots[i].name = newName.trim() || ('슬롯 ' + (i + 1));
  saveSlots(slots);
}

/* ══════════════════════════════════════════
   슬롯 — 목록 렌더링
══════════════════════════════════════════ */
function renderSlotList() {
  var slots = loadSlots();
  var list  = document.getElementById('slot-list');
  list.innerHTML = '';
  for (var i = 0; i < 5; i++) {
    var slot    = slots[i];
    var hasData = !!(slot && slot.data);
    var name    = (slot && slot.name) ? slot.name : ('슬롯 ' + (i + 1));
    var date    = formatDate(slot ? slot.savedAt : null);
    var item    = document.createElement('div');
    item.className = 'slot-item' + (hasData ? ' has-data' : '');

    if (!hasData) {
      item.innerHTML =
        '<div class="slot-item-main">' +
          '<div class="slot-num">' + (i + 1) + '</div>' +
          '<div class="slot-text-wrap">' +
            '<input class="slot-name-input" type="text" value="" placeholder="슬롯 ' + (i + 1) + '" onclick="event.stopPropagation()">' +
          '</div>' +
          '<button class="slot-save-btn" onclick="saveToSlot(' + i + ')">저장</button>' +
        '</div>';
    } else {
      item.innerHTML =
        '<div class="slot-item-main">' +
          '<div class="slot-num filled">' + (i + 1) + '</div>' +
          '<div class="slot-text-wrap">' +
            '<input class="slot-name-input" type="text" value="' + name.replace(/"/g, '&quot;') + '" placeholder="슬롯 ' + (i + 1) + '"' +
              ' onchange="renameSlot(' + i + ', this.value)" onclick="event.stopPropagation()">' +
            '<div class="slot-date-line">' + date + ' 저장</div>' +
          '</div>' +
          '<div class="slot-icon-group">' +
            '<button class="slot-icon-btn" data-tip="덮어쓰기"' +
              ' onmouseenter="showSlotTooltip(this)" onmouseleave="hideSlotTooltip()"' +
              ' onclick="overwriteSlot(' + i + ')">' +
              '<svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="var(--text-dim)" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">' +
                '<path d="M3 10V13h10v-3"/><path d="M8 3v8M5 6l3-3 3 3"/>' +
              '</svg>' +
            '</button>' +
            '<button class="slot-icon-btn" data-tip="불러오기"' +
              ' onmouseenter="showSlotTooltip(this)" onmouseleave="hideSlotTooltip()"' +
              ' onclick="loadFromSlot(' + i + ')">' +
              '<svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="#7A736B" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">' +
                '<path d="M3 6V3h10v3"/><path d="M8 5v8M5 10l3 3 3-3"/>' +
              '</svg>' +
            '</button>' +
            '<div class="slot-icon-divider"></div>' +
            '<button class="slot-icon-btn" data-tip="삭제"' +
              ' onmouseenter="showSlotTooltip(this)" onmouseleave="hideSlotTooltip()"' +
              ' onclick="deleteSlot(' + i + ')">' +
              '<svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="#C0392B" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">' +
                '<path d="M3 4h10M6 4V3h4v1M5 4v8a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1V4"/>' +
                '<line x1="7" y1="7" x2="7" y2="10"/><line x1="9" y1="7" x2="9" y2="10"/>' +
              '</svg>' +
            '</button>' +
          '</div>' +
        '</div>';
    }
    list.appendChild(item);
  }
}

/* ══════════════════════════════════════════
   슬롯 — 저장 / 덮어쓰기 / 불러오기 / 삭제
══════════════════════════════════════════ */
function saveToSlot(i) {
  var list   = document.getElementById('slot-list');
  var inputs = list.querySelectorAll('.slot-name-input');
  var name   = inputs[i] ? inputs[i].value.trim() : '';
  var slots  = loadSlots();
  slots[i] = {
    name:    name || ('슬롯 ' + (i + 1)),
    data:    collectData(),
    savedAt: new Date().toISOString()
  };
  if (saveSlots(slots)) {
    renderSlotList();
    showToast('슬롯 ' + (i + 1) + '에 저장했습니다');
  }
}

function overwriteSlot(i) {
  if (!confirm('슬롯 ' + (i + 1) + '에 현재 내용을 덮어씁니다. 계속할까요?')) return;
  var list   = document.getElementById('slot-list');
  var inputs = list.querySelectorAll('.slot-name-input');
  var name   = inputs[i] ? inputs[i].value.trim() : '';
  var slots  = loadSlots();
  var prev   = slots[i] || {};
  slots[i] = {
    name:    name || prev.name || ('슬롯 ' + (i + 1)),
    data:    collectData(),
    savedAt: new Date().toISOString()
  };
  if (saveSlots(slots)) {
    renderSlotList();
    showToast('슬롯 ' + (i + 1) + '을 덮어썼습니다');
  }
}

function loadFromSlot(i) {
  var slots = loadSlots();
  if (!slots[i] || !slots[i].data) return;
  if (!confirm('슬롯 ' + (i + 1) + '을 불러올까요?\n현재 작업 내용이 덮어씌워집니다.')) return;
  applyData(slots[i].data);
  resetCamera();
  document.fonts.ready.then(function() { render(); });
  closeSlotModal();
  showToast('슬롯 ' + (i + 1) + '을 불러왔습니다');
}

function deleteSlot(i) {
  var slots = loadSlots();
  var name  = (slots[i] && slots[i].name) ? slots[i].name : ('슬롯 ' + (i + 1));
  document.getElementById('delete-title').textContent = '"' + name + '" 슬롯을 삭제할까요?';
  document.getElementById('delete-backdrop').classList.add('open');
  document.getElementById('delete-confirm-btn').onclick = function() {
    delete slots[i];
    if (saveSlots(slots)) {
      closeDeleteModal();
      renderSlotList();
      showToast('"' + name + '" 삭제됨');
    }
  };
}

function closeDeleteModal() {
  document.getElementById('delete-backdrop').classList.remove('open');
}

/* ══════════════════════════════════════════
   슬롯 — JSON 내보내기 / 불러오기
══════════════════════════════════════════ */
function makeGridFileName(i) {
  var today = new Date();
  var date  = today.getFullYear().toString().slice(2)
    + String(today.getMonth() + 1).padStart(2, '0')
    + String(today.getDate()).padStart(2, '0');
  return date + '_grid_slot' + (i + 1) + '.json';
}

function doExportNow() {
  var data    = collectData(true);
  var fileName = makeGridFileName(0).replace(/slot\d+/, 'current');
  var payload  = {
    gridmaker: true,
    exportedAt: new Date().toISOString(),
    slots: { 0: { name: '현재 작업', data: data, savedAt: new Date().toISOString() } }
  };
  triggerDownload(fileName, payload);
  showToast(fileName + ' 저장됨');
}

function triggerDownload(fileName, data) {
  var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  var url  = URL.createObjectURL(blob);
  var a    = document.createElement('a');
  a.href = url; a.download = fileName; a.click();
  URL.revokeObjectURL(url);
}


function openImportModal() {
  _importedSlots = null;
  var fi = document.getElementById('json-file-input');
  fi.value = '';
  fi.click();
}

function closeImportModal() {
  document.getElementById('import-backdrop').classList.remove('open');
  document.getElementById('json-file-input').value = '';
  _importedSlots = null;
}

function handleImportBackdrop(e) {
  if (e.target === document.getElementById('import-backdrop')) closeImportModal();
}

function handleJsonFile(e) {
  var file = e.target.files[0];
  if (!file) return;
  var reader = new FileReader();
  reader.onload = function(ev) {
    try {
      var parsed = JSON.parse(ev.target.result);
      if (!parsed.gridmaker || !parsed.slots) {
        showToast('DDSGrid JSON 파일이 아닙니다');
        return;
      }
      _importedSlots = parsed.slots;
      var keys = Object.keys(parsed.slots).filter(function(k) { return !!parsed.slots[k]; });
      if (keys.length === 0) {
        showToast('저장된 슬롯이 없습니다');
        return;
      }
      /* 슬롯 1개 → 즉시 적용, 여러 개 → 선택 모달 */
      if (keys.length === 1) {
        var srcIdx = parseInt(keys[0]);
        var slot   = parsed.slots[keys[0]];
        applyData(slot.data);
        resetCamera();
        document.fonts.ready.then(function() { render(); });
        closeSlotModal();
        showToast('"' + (slot.name || '슬롯' + (srcIdx + 1)) + '" 불러오기 완료');
      } else {
        renderImportPicks(parsed.slots);
        document.getElementById('import-file-area').innerHTML =
          '<div style="display:flex;align-items:center;gap:8px;background:#EEF1FD;border-radius:6px;padding:8px 10px;margin-bottom:8px;">' +
            '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="#5B7CE6" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">' +
              '<path d="M9 2H4a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V6z"/>' +
              '<path d="M9 2v4h4"/>' +
            '</svg>' +
            '<span style="font-size:11px;font-weight:700;color:#5B7CE6;font-family:sans-serif;word-break:break-all;">' + file.name + '</span>' +
          '</div>';
        document.getElementById('import-section-slots').style.display = 'block';
        document.getElementById('import-backdrop').classList.add('open');
      }
    } catch(err) {
      showToast('올바른 JSON 파일이 아닙니다');
    }
  };
  reader.readAsText(file);
}

function renderImportPicks(slots) {
  var pickList     = document.getElementById('import-pick-list');
  var currentSlots = loadSlots();
  pickList.innerHTML = '';
  var keys = Object.keys(slots).filter(function(k) { return !!slots[k]; });
  if (keys.length === 0) {
    pickList.innerHTML = '<p style="font-size:11px;color:var(--label-color);padding:8px 0;">저장된 슬롯이 없습니다.</p>';
    return;
  }
  keys.forEach(function(k) {
    var slot   = slots[k];
    var srcIdx = parseInt(k);
    var name   = slot.name || ('슬롯 ' + (srcIdx + 1));
    var date   = slot.savedAt ? formatDate(slot.savedAt) : '';
    var row    = document.createElement('div');
    row.className = 'import-pick-row';
    var options = '';
    for (var j = 0; j < 5; j++) {
      var targetSlot = currentSlots[j];
      var label = targetSlot
        ? '슬롯 ' + (j + 1) + ' · ' + (targetSlot.name || ('슬롯' + (j + 1))) + ' (덮어쓰기)'
        : '슬롯 ' + (j + 1) + ' (빈 슬롯)';
      var selected = j === srcIdx ? ' selected' : '';
      options += '<option value="' + j + '"' + selected + '>' + label + '</option>';
    }
    row.innerHTML =
      '<div class="pick-src-wrap">' +
        '<div class="pick-src-name">' + name + '</div>' +
        '<div class="pick-src-date">' + date + ' 저장</div>' +
      '</div>' +
      '<span style="font-size:11px;color:var(--label-color);flex-shrink:0;">→</span>' +
      '<select class="pick-select" onchange="onPickChange(this)">' + options + '</select>';
    pickList.appendChild(row);
  });
  checkImportWarn();
}

function onPickChange(sel) {
  var currentSlots = loadSlots();
  var targetIdx    = parseInt(sel.value);
  var hasExisting  = !!currentSlots[targetIdx];
  sel.className = 'pick-select' + (hasExisting ? ' warn' : '');
  checkImportWarn();
}

function checkImportWarn() {
  var selects = document.querySelectorAll('.pick-select');
  var hasWarn = false;
  selects.forEach(function(s) { if (s.classList.contains('warn')) hasWarn = true; });
  var banner = document.getElementById('import-warn-banner');
  if (hasWarn) banner.classList.add('show');
  else banner.classList.remove('show');
}

function doImport() {
  if (!_importedSlots) return;
  var slots    = loadSlots();
  var selects  = document.querySelectorAll('.pick-select');
  var srcKeys  = Object.keys(_importedSlots).filter(function(k) { return !!_importedSlots[k]; });
  var lastSlot = null;
  srcKeys.forEach(function(k, idx) {
    var sel = selects[idx];
    if (!sel) return;
    var targetIdx  = parseInt(sel.value);
    var slotToSave = JSON.parse(JSON.stringify(_importedSlots[k]));
    /* 이미지 데이터 제거 후 슬롯에 저장 (JSON 내보내기에만 포함) */
    if (slotToSave.data && slotToSave.data.blocks) {
      slotToSave.data.blocks.forEach(function(b) { if (b.imgSrc) b.imgSrc = null; });
    }
    /* 슬롯은 용량 문제로 스티커 미포함 */
    if (slotToSave.data) slotToSave.data.stickers = [];
    if (slotToSave.data) slotToSave.data.stickerLibrary = [];
    slots[targetIdx] = slotToSave;
    lastSlot = _importedSlots[k];
  });
  saveSlots(slots);
  closeImportModal();
  closeSlotModal();
  if (lastSlot && lastSlot.data) {
    applyData(lastSlot.data);
    resetCamera();
    document.fonts.ready.then(function() { render(); });
  }
  showToast('불러오기 완료');
}

/* ══════════════════════════════════════════
   리셋
══════════════════════════════════════════ */
function resetAll() {
  if (!confirm('모든 내용을 초기화할까요?')) return;
  /* blocks 초기화 */
  _blkIdCounter = 0;
  blocks = [
    { id: _nextBlkId(), x: 12,  y: 12,  w: 260, h: 500, groupId: 'g_01', type: 'img', imgSrc: null, imgTransform: { scale:1, x:0, y:0 }, radius: null, shadow: null, opacity: null, bgColor: null },
    { id: _nextBlkId(), x: 284, y: 12,  w: 216, h: 247, groupId: 'g_01', type: 'img', imgSrc: null, imgTransform: { scale:1, x:0, y:0 }, radius: null, shadow: null, opacity: null, bgColor: null },
    { id: _nextBlkId(), x: 284, y: 271, w: 216, h: 241, groupId: 'g_01', type: 'img', imgSrc: null, imgTransform: { scale:1, x:0, y:0 }, radius: null, shadow: null, opacity: null, bgColor: null },
    { id: _nextBlkId(), x: 512, y: 12,  w: 276, h: 500, groupId: 'g_01', type: 'txt', spans: [{ text: '' }], radius: null, shadow: null, opacity: null, bgColor: null }
  ];
  headerPos  = null;
  headerData = {
    type: 'basic',
    bannerH: 160,
    bannerBgColor: '#5B7CE6',
    bannerImgOn: false,
    bannerImgSrc: null,
    bannerImgTransform: { scale: 1, x: 0, y: 0 },
    navH: 32,
    navBgColor: '#ffffff',
    navFontColor: '#212121',
    navText: '← BACK',
    snsH: 120,
    roundH: 120,
    roundOverlap: 24
  };
  selKey = null;
  selKeys = [];
  gaps = { pad: 12 };
  canvasH = 0; /* autoCanvasH()가 다음 render()에서 콘텐츠 기준으로 다시 계산 */
  canvasExtraTop = 0;
  canvasExtraLeft = 0;
  _updateSliderUI('sl-pad', 12);
  var snPad = document.getElementById('sn-pad');
  if (snPad) snPad.value = 12;
  /* canvas-stage 너비 리셋 */
  _setStageWidth(800, 'center');
  sheetBg = '#ffffff';
  var sheetEl = document.getElementById('sheet');
  if (sheetEl) sheetEl.style.background = sheetBg;
  var bgPicker = document.querySelector('#panel-canvas input[type="color"][oninput*="updateCanvasBg"]');
  if (bgPicker) { bgPicker.value = sheetBg; var _cw=bgPicker.closest&&bgPicker.closest('.cw'); if(_cw)_cw.style.background=sheetBg; var _hx=document.getElementById('canvas-bg-hex'); if(_hx)_hx.value=sheetBg.toUpperCase(); }
  updateSheetRadius(14);
  globalVals = { radius: 16, shadow: 2, bgColor: '#ffffff', font: 'Pretendard', fontColor: '#212121', stroke: 0, tstroke: 0 };
  _updateSliderUI('sl-radius', globalVals.radius); document.getElementById('sn-radius').value = globalVals.radius;
  _updateSliderUI('sl-shadow', globalVals.shadow);  document.getElementById('sn-shadow').value  = globalVals.shadow;
  pngMargin = true;
  pngBg = '#f2f2f2';
  var sw = document.getElementById('png-margin-sw');
  if (sw) sw.classList.add('on');
  updatePngBg(pngBg);
  var pngPicker = document.getElementById('png-bg-picker');
  if (pngPicker) pngPicker.value = pngBg;
  /* 스티커 초기화 */
  var layer = document.getElementById('sticker-layer');
  if (layer) {
    var oldItems = layer.querySelectorAll('.sticker-item');
    oldItems.forEach(function(el) { el.remove(); });
  }
  stickers            = [];
  stickerLibrary      = [];
  stickerIdCounter    = 0;
  stickerLibIdCounter = 0;
  selectedStickerIds  = [];
  stickerOverflow     = false;
  if (typeof syncStickerOverflowUI === 'function') syncStickerOverflowUI();
  canvasSizeLocked    = false;
  var _rlsw = document.getElementById('canvas-lock-sw');
  if (_rlsw) _rlsw.classList.remove('on');
  var _rllbl = document.getElementById('canvas-lock-lbl');
  if (_rllbl) _rllbl.textContent = '크기 고정 꺼짐';
  renderStickerLibrary();
  showCanvasPanel();
  /* 헤더 타입 버튼 UI 동기화 — render() 안의 updateHeaderBtns()는 위치 버튼만 갱신하므로
     타입 버튼은 별도 동기화 필요 ([0630-5]) */
  ['basic','sns','round'].forEach(function(t) {
    var _b = document.getElementById('hdr-type-' + t);
    if (_b) _b.classList.toggle('on', t === 'basic');
  });
  var _hdrTypeMap = { basic: 'bp-hdr-basic-opts', sns: 'bp-hdr-sns-opts', round: 'bp-hdr-round-opts' };
  Object.keys(_hdrTypeMap).forEach(function(t) {
    var _e = document.getElementById(_hdrTypeMap[t]);
    if (_e) _e.style.display = (t === 'basic') ? '' : 'none';
  });
  render();
  showToast('초기화했습니다');
}
