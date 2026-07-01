/* panel-colorchip-item.js — 리팩토링 2단계 4번째 조각: 컬러칩·항목 블록 패널/렌더 (두 그룹이 서로 얽혀있어 한 파일로 묶음, app/public/legacy/main.js에서 추출, 로직 변경 없음) */
/* ══════════════════════════════════════════
   컬러칩 패널 렌더 + 동기화
   ══════════════════════════════════════════ */

/* 패널 스트립 + 편집 카드를 blk 기준으로 채움 */
/* ══════════════════════════════════════════
   항목 블록
══════════════════════════════════════════ */
function ptVars(hex) {
  var c = hex || '#5B7CE6';
  function _rgb(h){ var m=(h||'').replace('#',''); return m.length===6?[parseInt(m.substr(0,2),16),parseInt(m.substr(2,2),16),parseInt(m.substr(4,2),16)]:null; }
  function _mix(h1,h2,t){ var a=_rgb(h1),b=_rgb(h2); if(!a||!b) return h1; return 'rgb('+Math.round(a[0]+(b[0]-a[0])*t)+','+Math.round(a[1]+(b[1]-a[1])*t)+','+Math.round(a[2]+(b[2]-a[2])*t)+')'; }
  return '--pt:'+c+';--pt-tint:'+_mix(c,'#FFFFFF',.85)+';--pt-mid:'+_mix(c,'#FFFFFF',.42)+';--pt-ink:'+_mix(c,'#000000',.28)+';';
}

function _defaultItems() {
  return [
    {k:'키/체중', v:'예시 키/체중'},
    {k:'체형',   v:'예시 체형'},
    {k:'나이',   v:'예시 나이'},
    {k:'직업',   v:'예시 직업'},
    {k:'동물화', v:'예시 동물화'},
  ];
}

function renderItemContent(blk, el) {
  var preset    = blk.preset    || 'pm-chip';
  var ptColor   = blk.ptColor   || '#5B7CE6';
  var direction = blk.direction || 'h';
  var divider   = blk.divider   === true;
  var chipStyle = blk.chipStyle || 'fill';
  /* blk.items 초기화 보장 — 편집 시 직접 쓸 수 있도록 */
  if (!blk.items || !blk.items.length) blk.items = _defaultItems();
  var items = blk.items;

  var cls = 'pm ' + preset;
  if (preset === 'pm-chip' && chipStyle === 'outline') cls += ' outline';
  cls += ' dir-' + direction;
  cls += divider ? ' div-line' : ' div-none';

  /* 가로 정렬 (세 값 지원) */
  var iHA = blk.itemAlign || 'left';
  var _iAlignStyle = iHA === 'center' ? 'width:fit-content;margin-left:auto;margin-right:auto;'
                   : iHA === 'right'  ? 'width:fit-content;margin-left:auto;margin-right:0;'
                   :                    'width:100%;';
  if (iHA === 'center') cls += ' align-center';

  var wrap = document.createElement('div');
  wrap.className = cls;
  wrap.setAttribute('style', ptVars(ptColor) + _iAlignStyle);

  /* 세로 정렬 — 부모 컨테이너(.blk-item)의 flex justify-content */
  if (el) {
    var iVA = blk.vAlign || 'center';
    el.style.justifyContent = iVA === 'top' ? 'flex-start' : iVA === 'bottom' ? 'flex-end' : 'center';
  }

  /* F-13 4번: 내용 편집은 패널로 이동 — 캔버스 클릭은 패널 "내용" 탭의 해당 행으로 포커스 이동만.
     setTimeout으로 한 틱 미룸 — 이 클릭이 .blk의 el.onclick(블록 선택, showBlockPanel 재호출)으로
     버블링되어 패널을 다시 그리는 게 같은 틱에 나중에 실행되므로, 그 재렌더 이후에 포커스해야
     플래시 효과가 새로 그려진 DOM에서 살아남는다. */
  function _focusItemRow(idx) {
    setTimeout(function() {
      var itemPanel = document.getElementById('bp-item-opts');
      if (!itemPanel) return;
      var tabbar = itemPanel.querySelector('[data-tabs="item"]');
      if (tabbar) {
        var contentTab = tabbar.querySelector('.tab[data-tab="content"]');
        if (contentTab && !contentTab.classList.contains('on')) contentTab.click();
      }
      _leFlashRow('bp-item-list', idx);
    }, 0);
  }

  items.forEach(function(item, idx) {
    var ir = document.createElement('div');
    ir.className = 'ir';
    if (preset === 'pm-grid' && idx === items.length - 1 && items.length % 2 === 1) {
      ir.classList.add('span2');
    }
    /* 구분선: pm-grid 제외, 첫 행 제외, divider ON 시 직접 적용 */
    if (divider && idx > 0 && preset !== 'pm-grid') {
      ir.style.borderTop = '1px solid #ECEAE4';
      ir.style.paddingTop = '9px';
    }
    var k = document.createElement('span');
    k.className = 'k';
    k.textContent = item.k || '';
    var v = document.createElement('span');
    v.className = 'v';
    v.textContent = item.v || '';

    /* 행 추가/삭제는 패널 리스트(bp-item-list)로 통일 — 캔버스 위 +/✕ 버튼은 중복이라 제거(0620_2) */
    ir.addEventListener('click', function(e) {
      _focusItemRow(idx);
    });

    ir.appendChild(k);
    ir.appendChild(v);
    wrap.appendChild(ir);
  });

  el.appendChild(wrap);
}

function showItemPanel(blk) {
  var preset    = blk.preset    || 'pm-chip';
  var direction = blk.direction || 'h';
  var divider   = blk.divider   === true;
  var chipStyle = blk.chipStyle || 'fill';
  var ptColor   = blk.ptColor   || '#5B7CE6';

  /* 프리셋 tiles */
  document.querySelectorAll('#bp-item-preset-tiles .ps-tile').forEach(function(t) {
    t.classList.toggle('on', t.dataset.ps === preset);
  });
  /* 채움/테두리 행 */
  var csRow = document.getElementById('bp-item-chipstyle-row');
  if (csRow) csRow.style.display = preset === 'pm-chip' ? '' : 'none';
  document.querySelectorAll('#bp-item-chipstyle-tiles .tile').forEach(function(t) {
    t.classList.toggle('on', t.dataset.v === chipStyle);
  });
  /* 포인트색 */
  var ptSw  = document.getElementById('bp-item-pt-swatch');
  var ptInp = document.getElementById('bp-item-pt-color');
  var ptHex = document.getElementById('bp-item-pt-hexedit');
  if (ptSw)  ptSw.style.background = ptColor;
  if (ptInp) ptInp.value = ptColor;
  if (ptHex) ptHex.value = ptColor.toUpperCase();
  /* 방향 tiles */
  document.querySelectorAll('#bp-item-dir-tiles .tile').forEach(function(t) {
    t.classList.toggle('on', t.dataset.v === direction);
  });
  /* 구분선 tiles + 필드 표시 (pm-grid는 숨김) */
  var divField = document.getElementById('bp-item-div-field');
  if (divField) divField.style.display = preset === 'pm-grid' ? 'none' : '';
  document.querySelectorAll('#bp-item-div-tiles .tile').forEach(function(t) {
    t.classList.toggle('on', t.dataset.v === (divider ? 'line' : 'none'));
  });
  /* 정렬 */
  _refreshBpAlign9(blk);
  /* 개별 블록 크기·간격 슬라이더 동기화 */
  var isz = blk.itemSizeScale || 100;
  var igp = blk.itemGapScale  || 100;
  _updateSliderUI('bp-item-sl-size', isz);
  var snIS = document.getElementById('bp-item-sn-size'); if (snIS) snIS.value = isz;
  _updateSliderUI('bp-item-sl-gap', igp);
  var snIG = document.getElementById('bp-item-sn-gap'); if (snIG) snIG.value = igp;
  /* 버튼식(pm-chip) 전용 — 버튼 폰트색·텍스트크기·라운딩 */
  var btnRow = document.getElementById('bp-item-btnstyle-row');
  if (btnRow) btnRow.style.display = preset === 'pm-chip' ? '' : 'none';
  var btnColor = blk.itemBtnColor || '#FFFFFF';
  var btnSw  = document.getElementById('bp-item-btn-color-swatch');
  var btnInp = document.getElementById('bp-item-btn-color');
  var btnHex = document.getElementById('bp-item-btn-color-hexedit');
  if (btnSw)  btnSw.style.background = btnColor;
  if (btnInp) btnInp.value = btnColor;
  if (btnHex) btnHex.value = btnColor.toUpperCase();
  var ibf = blk.itemBtnFontScale || 100;
  var ibr = (blk.itemBtnRadius !== null && blk.itemBtnRadius !== undefined) ? blk.itemBtnRadius : 8;
  _updateSliderUI('bp-item-sl-btnfont', ibf);
  var snBF = document.getElementById('bp-item-sn-btnfont'); if (snBF) snBF.value = ibf;
  _updateSliderUI('bp-item-sl-btnradius', ibr);
  var snBR = document.getElementById('bp-item-sn-btnradius'); if (snBR) snBR.value = ibr;
  renderItemListEdit(blk);
}

/* 프리셋·방향별 1행 실측 수치(px, 100% 배율 기준 — 2026-06-17 Chrome headless 실측/CSS 박스모델 산출)
   rowH: 항목 1행의 실제 높이(패딩 포함, 행간 gap 제외) / rowGap: 행 사이 간격(pm-grid는 카드 사이 간격)
   PNG 렌더(_iPre 분기)·_itemMinH()와 동일한 값을 참조해 DOM·PNG·최소높이 3곳이 항상 일치하도록 함 */

/* 항목 수·프리셋·방향·구분선 기반 블록 크기 자동 계산
   pad = blk-item padding(8px) × 2 = 16px
   divAdd = 구분선 ON 시 행 간 추가 높이 (9px × 구분선 수, pm-grid 제외) */
function _applyItemSize(blk) {
  var n      = Math.max(1, (blk.items || []).length);
  var pre    = blk.preset    || 'pm-chip';
  var dir    = blk.direction === 'v' ? 'v' : 'h';
  var div    = blk.divider   === true;
  var pad    = 16;
  /* 개별 블록 크기·간격 배율 반영 */
  var sizeScale = (blk.itemSizeScale || 100) / 100;
  var gapScale  = (blk.itemGapScale  || 100) / 100;
  var m = _ITEM_METRICS[pre][dir];
  var rowH   = m.rowH   * sizeScale;
  var rowGap = m.rowGap * gapScale;
  var divAdd = (div && pre !== 'pm-grid') ? (n - 1) * 9 * gapScale : 0;

  if (pre === 'pm-grid') {
    var rows = Math.ceil(n / 2);
    blk.w = 220;
    blk.h = Math.round(rows * rowH + Math.max(0, rows - 1) * rowGap + 6 * gapScale + pad);
  } else {
    blk.w = (pre === 'pm-hair') ? 220 : 200;
    blk.h = Math.round(n * rowH + Math.max(0, n - 1) * rowGap + pad + divAdd);
  }
}

function syncItemPreset(preset) {
  var blk = getSelBlk(); if (!blk || blk.type !== 'item') return;
  if (!_pendingHistorySave) { saveHistory(); _pendingHistorySave = true; }
  blk.preset = preset;
  /* 프리셋별 자연스러운 방향으로 초기화 */
  blk.direction = (preset === 'pm-cap' || preset === 'pm-grid') ? 'v' : 'h';
  _applyItemSize(blk);
  render();
  if (_itemAutoExpand(blk, blk.id)) render();
  showItemPanel(blk);
}

function syncItemPtColor(hex) {
  var blk = getSelBlk(); if (!blk || blk.type !== 'item') return;
  if (!_pendingHistorySave) { saveHistory(); _pendingHistorySave = true; }
  blk.ptColor = hex;
  /* 실시간 업데이트 — render 없이 CSS 변수만 주입 */
  var blkEl = document.querySelector('.blk[data-key="' + selKey + '"]');
  if (blkEl) {
    var pm = blkEl.querySelector('.pm');
    if (pm) pm.setAttribute('style', ptVars(hex) + 'width:100%;');
  }
  var ptSw  = document.getElementById('bp-item-pt-swatch');
  var ptHex = document.getElementById('bp-item-pt-hexedit');
  if (ptSw)  ptSw.style.background = hex;
  if (ptHex) ptHex.value = hex.toUpperCase();
}

function syncItemLayout(prop, val) {
  var blk = getSelBlk(); if (!blk || blk.type !== 'item') return;
  if (!_pendingHistorySave) { saveHistory(); _pendingHistorySave = true; }
  blk[prop] = val;
  /* 방향·구분선 변경 시 블록 사이즈 자동 조정 */
  if (prop === 'direction' || prop === 'divider') _applyItemSize(blk);
  render();
  if (prop === 'direction' || prop === 'divider') { if (_itemAutoExpand(blk, blk.id)) render(); }
  showItemPanel(blk);
}

function syncItemChipStyle(style) {
  var blk = getSelBlk(); if (!blk || blk.type !== 'item') return;
  if (!_pendingHistorySave) { saveHistory(); _pendingHistorySave = true; }
  blk.chipStyle = style;
  render();
  showItemPanel(blk);
}

/* 버튼식(pm-chip) 전용 — 버튼 폰트색 (항목 크기 슬라이더와 무관, .k 라벨에만 적용) */
function syncItemBtnColor(hex) {
  var blk = getSelBlk(); if (!blk || blk.type !== 'item') return;
  if (!_pendingHistorySave) { saveHistory(); _pendingHistorySave = true; }
  blk.itemBtnColor = hex;
  var sw  = document.getElementById('bp-item-btn-color-swatch');
  var hexEl = document.getElementById('bp-item-btn-color-hexedit');
  if (sw)    sw.style.background = hex;
  if (hexEl) hexEl.value = hex.toUpperCase();
  render();
}

/* 버튼식(pm-chip) 전용 — 버튼 텍스트 크기 (항목 크기 슬라이더 itemSizeScale과 별개 배율) */
function syncItemBtnFontScale(val) {
  var blk = getSelBlk(); if (!blk || blk.type !== 'item') return;
  if (!_pendingHistorySave) { saveHistory(); _pendingHistorySave = true; }
  val = Math.min(100, Math.max(50, parseInt(val) || 100));
  blk.itemBtnFontScale = val;
  _updateSliderUI('bp-item-sl-btnfont', val);
  var sn = document.getElementById('bp-item-sn-btnfont'); if (sn) sn.value = val;
  render();
}

/* 버튼식(pm-chip) 전용 — 버튼 라운딩 */
function syncItemBtnRadius(val) {
  var blk = getSelBlk(); if (!blk || blk.type !== 'item') return;
  if (!_pendingHistorySave) { saveHistory(); _pendingHistorySave = true; }
  val = Math.min(20, Math.max(0, parseInt(val) || 0));
  blk.itemBtnRadius = val;
  _updateSliderUI('bp-item-sl-btnradius', val);
  var sn = document.getElementById('bp-item-sn-btnradius'); if (sn) sn.value = val;
  render();
}

function renderColorchipPanel(blk) {
  var rad = (blk.chipRadius !== null && blk.chipRadius !== undefined) ? blk.chipRadius : 0;
  var shape = rad === 0 ? 'square' : (rad >= 50 ? 'circle' : 'round');
  document.querySelectorAll('#bp-cc-shape-seg .tile').forEach(function(b) {
    b.classList.toggle('on', b.dataset.ccshape === shape);
  });
  _refreshBpAlign9(blk);
  /* 개별 블록 크기·간격·글자크기 슬라이더 동기화 */
  var csz = blk.ccSizeScale || 100;
  var cgp = blk.ccGapScale  || 100;
  var cfs = blk.ccFontScale || 100;
  _updateSliderUI('bp-cc-sl-size', csz);
  var snCS = document.getElementById('bp-cc-sn-size'); if (snCS) snCS.value = csz;
  _updateSliderUI('bp-cc-sl-gap', cgp);
  var snCG = document.getElementById('bp-cc-sn-gap'); if (snCG) snCG.value = cgp;
  _updateSliderUI('bp-cc-sl-font', cfs);
  var snCF = document.getElementById('bp-cc-sn-font'); if (snCF) snCF.value = cfs;
  /* 기본 글자색 컬러피커 동기화 */
  var ccTextColorVal = blk.ccTextColor || '#212121';
  var ccTextEl = document.getElementById('bp-cc-text-color');
  if (ccTextEl) ccTextEl.value = ccTextColorVal;
  var ccTextSw = document.getElementById('bp-cc-text-color-swatch2');
  if (ccTextSw) ccTextSw.style.background = ccTextColorVal;
  var ccTextHex = document.getElementById('bp-cc-text-color-hexedit');
  if (ccTextHex) ccTextHex.value = ccTextColorVal.toUpperCase();
  renderCcListEdit(blk);
}

function syncCcAlign(val) {
  var blk = getSelBlk();
  if (!blk || blk.type !== 'colorchip') return;
  if (!_pendingHistorySave) { saveHistory(); _pendingHistorySave = true; }
  blk.ccAlign = val;
  document.querySelectorAll('#bp-cc-align-seg .tile').forEach(function(b) {
    b.classList.toggle('on', b.dataset.ccalign === val);
  });
  render();
}

function syncCcTextColor(val) {
  var blk = getSelBlk();
  if (!blk || blk.type !== 'colorchip') return;
  if (!_pendingHistorySave) { saveHistory(); _pendingHistorySave = true; }
  blk.ccTextColor = val;
  var sw = document.getElementById('bp-cc-text-color-swatch2');
  if (sw) sw.style.background = val;
  var hex = document.getElementById('bp-cc-text-color-hexedit');
  if (hex) hex.value = val.toUpperCase();
  render();
}

/* ══════════════════════════════════════════
   패널 리스트 편집 (F-13 4번) — 칩/항목 목록을 패널에서 추가·삭제·수정·재정렬
   design_brief/02_패널편집_시안.html "씸리스형" 패턴
   ══════════════════════════════════════════ */

function _leHandle() {
  return '<div class="drag-handle"><i><b></b><b></b></i><i><b></b><b></b></i><i><b></b><b></b></i></div>';
}

/* 패널 리스트 드래그 재정렬 — 캔버스용 _ccWireDrag와 별개(패널 행 전용) */
function _leWireDrag(listEl, arr, onReorder) {
  var from = null;
  function showGuide(di) {
    var g = listEl.querySelector('.le-guide');
    if (!g) { g = document.createElement('div'); g.className = 'le-guide'; }
    var rows = listEl.querySelectorAll('.le-row');
    if (di >= rows.length) listEl.appendChild(g); else listEl.insertBefore(g, rows[di]);
  }
  function clearGuide() { var g = listEl.querySelector('.le-guide'); if (g) g.parentNode.removeChild(g); }
  function dropIdxFor(row, idx, e) { var r = row.getBoundingClientRect(); return (e.clientY - r.top) < r.height / 2 ? idx : idx + 1; }
  listEl.querySelectorAll('.le-row').forEach(function(row, idx) {
    row.draggable = false;
    var hnd = row.querySelector('.drag-handle');
    if (hnd) hnd.addEventListener('mousedown', function() { row.draggable = true; });
    row.addEventListener('mouseup', function() { row.draggable = false; });
    row.addEventListener('dragstart', function(e) {
      from = idx; row.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      try { e.dataTransfer.setData('text/plain', String(idx)); } catch(_) {}
    });
    row.addEventListener('dragover', function(e) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; showGuide(dropIdxFor(row, idx, e)); });
    row.addEventListener('drop', function(e) {
      e.preventDefault(); var di = dropIdxFor(row, idx, e); clearGuide();
      if (from === null) return;
      saveHistory();
      var moved = arr.splice(from, 1)[0]; var at = di > from ? di - 1 : di; arr.splice(at, 0, moved); from = null;
      onReorder();
    });
    row.addEventListener('dragend', function() { row.classList.remove('dragging'); row.draggable = false; clearGuide(); from = null; });
  });
}

function _leSelectAllOnFocus(input) {
  input.addEventListener('focus', function() { var el = this; setTimeout(function() { el.select(); }, 0); });
}

/* 캔버스 칩/항목 클릭 시 패널 리스트 행으로 포커스·하이라이트 이동 */
function _leFlashRow(listId, idx) {
  var rows = document.querySelectorAll('#' + listId + ' .le-row');
  var row = rows[idx];
  if (!row) return;
  row.scrollIntoView({ block: 'nearest' });
  row.classList.add('le-flash');
  setTimeout(function() { row.classList.remove('le-flash'); }, 900);
}

function renderCcListEdit(blk) {
  var list = document.getElementById('bp-cc-list');
  if (!list) return;
  var chips = blk.chips || [];
  var MAX = 5;
  list.innerHTML = '';
  chips.forEach(function(chip, idx) {
    var row = document.createElement('div');
    row.className = 'le-row';
    row.innerHTML = _leHandle() +
      '<div class="le-sw" style="background:' + (chip.color || '#888888') + '"></div>' +
      '<input class="le-input le-label" value="' + (chip.label || '').replace(/&/g,'&amp;').replace(/"/g,'&quot;') + '" placeholder="라벨" maxlength="12">' +
      '<button class="le-del" type="button" title="삭제" aria-label="삭제">×</button>';
    var sw = row.querySelector('.le-sw');
    sw.addEventListener('click', function() {
      gmOpenColorPicker(sw, {
        label: (chip.label || ('칩 ' + (idx + 1))) + ' 색상',
        getValue: function() { return _toHex6(chip.color || '#888888'); },
        onChange: function(hex) {
          if (!_pendingHistorySave) { saveHistory(); _pendingHistorySave = true; }
          chip.color = hex;
          sw.style.background = hex;
          render();
        }
      });
    });
    var labelInput = row.querySelector('.le-label');
    labelInput.addEventListener('input', function(e) { chip.label = e.target.value.slice(0, 12); render(); if (_ccAutoExpand(blk, selKey)) render(); });
    labelInput.addEventListener('blur', function() { _pendingHistorySave = false; });
    _leSelectAllOnFocus(labelInput);
    row.querySelector('.le-del').addEventListener('click', function() {
      if (blk.chips.length <= 1) return;
      saveHistory();
      blk.chips.splice(idx, 1);
      if (blk._activeChipId === chip.id) blk._activeChipId = null;
      render();
      renderCcListEdit(blk);
    });
    list.appendChild(row);
  });
  var countEl = document.getElementById('bp-cc-list-count');
  if (countEl) countEl.textContent = chips.length + '개';
  var addBtn = document.getElementById('bp-cc-list-add');
  if (addBtn) {
    addBtn.disabled = chips.length >= MAX;
    addBtn.onclick = function() {
      if (blk.chips.length >= MAX) return;
      saveHistory();
      var palette = ['#5B7CE6','#E2574C','#3E8E6E','#E0A23B','#4A7FB5'];
      var color = palette[blk.chips.length % palette.length];
      var letter = String.fromCharCode(65 + blk.chips.length);
      /* textColor 미지정 — 블록 기본 글자색(ccTextColor)을 동적으로 따라가게 함(자동대비 폐지) */
      blk.chips.push({ id: 'cc' + Date.now(), color: color, label: letter, desc: '' });
      render();
      if (_ccAutoExpand(blk, selKey)) render();
      renderCcListEdit(blk);
    };
  }
  _leWireDrag(list, chips, function() { render(); renderCcListEdit(blk); });
}

function renderItemListEdit(blk) {
  var list = document.getElementById('bp-item-list');
  if (!list) return;
  if (!blk.items || !blk.items.length) blk.items = _defaultItems();
  var items = blk.items;
  list.innerHTML = '';
  items.forEach(function(item, idx) {
    var row = document.createElement('div');
    row.className = 'le-row';
    row.innerHTML = _leHandle() +
      '<input class="le-input le-key" value="' + (item.k || '').replace(/&/g,'&amp;').replace(/"/g,'&quot;') + '" placeholder="키">' +
      '<input class="le-input le-val" value="' + (item.v || '').replace(/&/g,'&amp;').replace(/"/g,'&quot;') + '" placeholder="값">' +
      '<button class="le-del" type="button" title="삭제" aria-label="삭제">×</button>';
    var keyInput = row.querySelector('.le-key');
    var valInput = row.querySelector('.le-val');
    keyInput.addEventListener('input', function(e) { item.k = e.target.value; render(); if (_itemAutoExpand(blk, blk.id)) render(); });
    valInput.addEventListener('input', function(e) { item.v = e.target.value; render(); if (_itemAutoExpand(blk, blk.id)) render(); });
    keyInput.addEventListener('blur', function() { _pendingHistorySave = false; });
    valInput.addEventListener('blur', function() { _pendingHistorySave = false; });
    [keyInput, valInput].forEach(function(inp) {
      inp.addEventListener('focus', function() {
        if (!_pendingHistorySave) { saveHistory(); _pendingHistorySave = true; }
      });
    });
    _leSelectAllOnFocus(keyInput); _leSelectAllOnFocus(valInput);
    row.querySelector('.le-del').addEventListener('click', function() {
      if (blk.items.length <= 1) return;
      saveHistory();
      blk.items.splice(idx, 1);
      render();
      renderItemListEdit(blk);
    });
    list.appendChild(row);
  });
  var countEl = document.querySelector('#bp-item-list-count');
  if (countEl) countEl.textContent = items.length + '개';
  var addBtn = document.getElementById('bp-item-list-add');
  if (addBtn) {
    addBtn.onclick = function() {
      saveHistory();
      blk.items.push({ k: '항목', v: '' });
      render();
      if (_itemAutoExpand(blk, blk.id)) render();
      renderItemListEdit(blk);
    };
  }
  _leWireDrag(list, items, function() { render(); renderItemListEdit(blk); });
}

/* 항목 패널 탭(내용/스타일) — 정적 DOM이라 1회만 와이어링 */
function _initPanelTabs() {
  document.querySelectorAll('[data-tabs]').forEach(function(bar) {
    var scope = bar.parentNode;
    bar.addEventListener('click', function(e) {
      var t = e.target.closest('.tab'); if (!t) return;
      bar.querySelectorAll('.tab').forEach(function(b) { b.classList.toggle('on', b === t); });
      scope.querySelectorAll('.tabpanel').forEach(function(p) { p.classList.toggle('on', p.dataset.panel === t.dataset.tab); });
    });
  });
}
_initPanelTabs();

/* 선택 칩 속성 동기화 */
function syncColorchip(prop, val) {
  var blk = getSelBlk();
  if (!blk || blk.type !== 'colorchip') return;
  if (!_pendingHistorySave) { saveHistory(); _pendingHistorySave = true; }

  if (prop === 'chipRadius' || prop === 'showSwatch' || prop === 'showText'
      || prop === 'chipSize' || prop === 'chipGap'   || prop === 'chipPadH') {
    blk[prop] = val;
    render();
    if ((prop === 'chipSize' || prop === 'chipGap' || prop === 'chipPadH') && _ccAutoExpand(blk, selKey)) {
      render();
    }
    renderColorchipPanel(blk);
    return;
  }
  /* 칩별 속성 */
  var sel = blk.chips && blk.chips.find(function(c){ return c.id === blk._selChipId; });
  if (!sel) return;
  sel[prop] = val;
  /* 칩 DOM 직접 갱신 (render 없이) */
  var chipEl = document.querySelector('.cc-chip[data-cc-id="' + sel.id + '"]');
  if (prop === 'color') {
    if (chipEl) chipEl.style.background = val;
    var sw = document.getElementById('bp-cc-chip-color-swatch');
    if (sw) sw.style.background = val;
    var hex = document.getElementById('bp-cc-chip-color-hex');
    if (hex) hex.textContent = val.toUpperCase();
    /* 스트립 미니칩도 갱신 */
    var mini = document.querySelector('.cc-mini[data-cc-id="' + sel.id + '"]');
    if (mini) mini.style.background = val;
  }
  if (prop === 'textColor') {
    var lbl = chipEl && chipEl.querySelector('.cc-chip-label');
    if (lbl) lbl.style.color = val;
    var sw2 = document.getElementById('bp-cc-text-color-swatch');
    if (sw2) sw2.style.background = val;
    var hex2 = document.getElementById('bp-cc-text-color-hex');
    if (hex2) hex2.textContent = val.toUpperCase();
    var mini2 = document.querySelector('.cc-mini[data-cc-id="' + sel.id + '"]');
    if (mini2) mini2.style.color = val;
  }
  if (prop === 'label') {
    var lbl2 = chipEl && chipEl.querySelector('.cc-chip-label');
    if (lbl2) lbl2.textContent = val;
    var mini3 = document.querySelector('.cc-mini[data-cc-id="' + sel.id + '"] .cc-mini-t');
    if (mini3) mini3.textContent = val || ' ';
  }
  if (prop === 'desc') {
    var rowEl = chipEl && chipEl.closest('.cc-chip-row');
    var descSpan = rowEl && rowEl.querySelector('.cc-chip-desc');
    if (descSpan) descSpan.textContent = val;
  }
}

function _toHex6(v) {
  if (!v) return '#000000';
  if (/^#[0-9a-fA-F]{6}$/.test(v)) return v;
  var m = v.match(/\d+/g);
  if (m && m.length >= 3) return '#' + m.slice(0,3).map(function(n){ return (+n).toString(16).padStart(2,'0'); }).join('');
  return '#000000';
}

/* ══════════════════════════════════════════
   컬러칩 블록 렌더 + 인터랙션
   ══════════════════════════════════════════ */
/* 칩 수치 상수 */

/* 방향·칩 수 기반 최소 블록 높이 계산 */
function _ccMinH(blk) {
  var scale = (blk.ccSizeScale || 100) / 100;
  var h = (blk && blk.chipSize !== undefined) ? blk.chipSize : _CC.h;
  return Math.round(h * scale) + _CC.padV * 2;
}

/* 가장 긴 단일 칩(+showText 시 desc 포함)이 잘리지 않을 최소 블록 너비 —
   renderColorchipContent()와 동일한 공식으로 칩 폭을 재계산(canvas measureText) */
function _ccMinW(blk) {
  var chips = blk.chips || [];
  if (!chips.length) return 80;
  var sizeScale = (blk.ccSizeScale || 100) / 100;
  var fontScale = (blk.ccFontScale || 100) / 100;
  var ccSize = Math.round((blk.chipSize !== undefined ? blk.chipSize : 30) * sizeScale);
  var ccPadH = Math.round((blk.chipPadH !== undefined ? blk.chipPadH : 8) * sizeScale);
  var ccFontSize = Math.max(9, Math.round(ccSize * 11 / 30 * fontScale));
  var canvas = document.createElement('canvas');
  var ctx = canvas.getContext('2d');
  ctx.font = '600 ' + ccFontSize + 'px Pretendard, sans-serif';
  var maxW = 0;
  chips.forEach(function(chip) {
    var chipW = Math.max(ccSize, Math.round(ctx.measureText(chip.label || '').width) + ccPadH * 2);
    if (blk.showText === true) {
      var descW = Math.round(ctx.measureText(chip.desc || '').width);
      chipW += 8 + descW; /* .cc-chip-row gap(8px) + desc 폭 */
    }
    maxW = Math.max(maxW, chipW);
  });
  return Math.max(80, maxW + 16); /* .cc-block padding(8px*2) */
}

/* DOM 렌더 후 칩 오버플로우(높이/너비) 감지 → blk.h/blk.w 자동 확장, 확장 시 true 반환 */
function _ccAutoExpand(blk, key) {
  var blkEl = document.querySelector('.blk[data-key="' + key + '"]');
  var ccWrap = blkEl && blkEl.querySelector('.cc-block');
  if (!ccWrap) return false;
  var changed = false;
  if (ccWrap.scrollHeight > ccWrap.clientHeight) {
    blk.h = ccWrap.scrollHeight;
    changed = true;
  }
  var minW = _ccMinW(blk);
  if (minW > blk.w) {
    blk.w = minW;
    changed = true;
  }
  return changed;
}

/* 프리셋·방향별 1행 기준 높이(px, 100% 배율) — _applyItemSize()와 동일 상수 재사용
   정확한 멀티행 높이는 _itemAutoExpand가 DOM 측정으로 보정 */
/* 프리셋·방향·전역 크기 배율 기반 최소 블록 높이(1행) 계산 — .blk-item padding 8px*2 포함
   _ITEM_METRICS(= _applyItemSize 위쪽에 정의) 의 rowH 재사용 — 두 함수가 항상 같은 기준을 쓰도록 보장 */
function _itemMinH(blk) {
  var scale = (blk.itemSizeScale || 100) / 100;
  var preset = (blk && blk.preset) || 'pm-chip';
  var dir = (blk && blk.direction === 'v') ? 'v' : 'h';
  var rowH = (_ITEM_METRICS[preset] || _ITEM_METRICS['pm-chip'])[dir].rowH;
  return Math.round(rowH * scale) + 16;
}

/* 키(.k) 라벨이 잘리지 않을 최소 블록 너비 — 값(.v)은 의도적으로 줄바꿈되는
   필드라 측정 대상에서 제외(긴 값 때문에 블록이 과도하게 넓어지는 것을 방지).
   .k에 white-space:nowrap을 일시 적용해 줄바꿈 없는 본연의 폭을 측정 후 즉시 복구.
   pm-grid는 2열 고정 레이아웃이라 가변 너비 개념이 약해 자동조정 대상에서 제외 */
function _itemMinW(blk, key) {
  if ((blk.preset || 'pm-chip') === 'pm-grid') return 220;
  var blkEl = document.querySelector('.blk[data-key="' + key + '"]');
  var pmWrap = blkEl && blkEl.querySelector('.pm');
  if (!pmWrap) return 160;
  var keys = pmWrap.querySelectorAll('.k');
  if (!keys.length) return 160;
  var maxKW = 0;
  keys.forEach(function(kEl) {
    var prevWs = kEl.style.whiteSpace;
    kEl.style.whiteSpace = 'nowrap';
    maxKW = Math.max(maxKW, kEl.scrollWidth);
    kEl.style.whiteSpace = prevWs;
  });
  return Math.max(160, Math.round(maxKW) + 80); /* 키 폭 + 값 최소공간·간격·패딩 여유 */
}

/* DOM 렌더 후 항목 오버플로우(높이/너비) 감지 → blk.h/blk.w 자동 확장, 확장 시 true 반환
   .pm은 colorchip의 .cc-block과 달리 자체 padding이 없고 .blk-item(부모)이 padding:8px 보유 */
function _itemAutoExpand(blk, key) {
  var blkEl = document.querySelector('.blk[data-key="' + key + '"]');
  var pmWrap = blkEl && blkEl.querySelector('.pm');
  if (!pmWrap) return false;
  var changed = false;
  var neededH = pmWrap.scrollHeight + 16;
  if (neededH > blkEl.clientHeight) {
    blk.h = neededH;
    changed = true;
  }
  var minW = _itemMinW(blk, key);
  if (minW > blk.w) {
    blk.w = minW;
    changed = true;
  }
  return changed;
}

function _ccWireDrag(chipEl, chip, blk, axis, key) {
  chipEl.setAttribute('draggable', 'true');
  chipEl.addEventListener('dragstart', function(e) {
    _ccDragId = chip.id;
    chipEl.classList.add('cc-dragging');
    e.dataTransfer.effectAllowed = 'move';
    try { e.dataTransfer.setData('text/plain', chip.id); } catch(_) {}
  });
  chipEl.addEventListener('dragend', function() {
    _ccDragId = null;
    chipEl.classList.remove('cc-dragging');
    document.querySelectorAll('.cc-drop-target').forEach(function(n) { n.classList.remove('cc-drop-target'); });
  });
  chipEl.addEventListener('dragover', function(e) {
    e.preventDefault();
    if (_ccDragId !== chip.id) chipEl.classList.add('cc-drop-target');
  });
  chipEl.addEventListener('dragleave', function() { chipEl.classList.remove('cc-drop-target'); });
  chipEl.addEventListener('drop', function(e) {
    e.preventDefault(); e.stopPropagation();
    chipEl.classList.remove('cc-drop-target');
    if (!_ccDragId || _ccDragId === chip.id) return;
    var chips = blk.chips;
    var fromIdx = chips.findIndex(function(c) { return c.id === _ccDragId; });
    if (fromIdx < 0) return;
    var moved = chips.splice(fromIdx, 1)[0];
    var toIdx = chips.findIndex(function(c) { return c.id === chip.id; });
    var r = chipEl.getBoundingClientRect();
    var after = axis === 'x' ? (e.clientX > r.left + r.width/2) : (e.clientY > r.top + r.height/2);
    chips.splice(after ? toIdx+1 : toIdx, 0, moved);
    render();
    selKey = key;
    showBlockPanel('colorchip', '컬러칩 블록', blk);
  });
}

function renderColorchipContent(blk, el, key) {
  var chips  = blk.chips || [];
  var rad    = (blk.chipRadius !== null && blk.chipRadius !== undefined) ? blk.chipRadius : 0;
  var showText = blk.showText === true;
  var sizeScale = (blk.ccSizeScale || 100) / 100;
  var gapScale  = (blk.ccGapScale  || 100) / 100;
  var fontScale = (blk.ccFontScale || 100) / 100;
  var ccSize = Math.round((blk.chipSize  !== undefined ? blk.chipSize  : 30) * sizeScale);
  var ccGapV = Math.round((blk.chipGap   !== undefined ? blk.chipGap   : 6)  * gapScale);
  var ccPadH = Math.round((blk.chipPadH  !== undefined ? blk.chipPadH  : 8)  * sizeScale);
  var ccFontSize = Math.max(9, Math.round(ccSize * 11 / 30 * fontScale));

  /* 세로 정렬 — 부모 컨테이너(.blk-colorchip)의 flex justify-content */
  if (el) {
    var ccVA = blk.vAlign || 'center';
    el.style.justifyContent = ccVA === 'top' ? 'flex-start' : ccVA === 'bottom' ? 'flex-end' : 'center';
  }

  var wrap = document.createElement('div');
  wrap.className = 'cc-block';
  wrap.style.gap = ccGapV + 'px';
  wrap.style.justifyContent = blk.ccAlign === 'center' ? 'center'
                            : blk.ccAlign === 'right'  ? 'flex-end'
                            :                            'flex-start';

  chips.forEach(function(chip, idx) {
    if (!chip.id) chip.id = 'cc' + idx + '_' + Date.now();

    var ink = chip.textColor || blk.ccTextColor || '#212121';
    var isActive = blk._activeChipId === chip.id;

    var chipEl = document.createElement('div');
    chipEl.className = 'cc-chip' + (isActive ? ' active' : '');
    chipEl.dataset.ccId = chip.id;
    chipEl.style.cssText = [
      'height:' + ccSize + 'px',
      'min-width:' + ccSize + 'px',
      'padding:0 ' + ccPadH + 'px',
      'border-radius:' + Math.round(ccSize / 2 * rad / 50) + 'px',
      'background:' + (chip.color || '#888888'),
    ].join(';');

    /* ── 라벨 ── */
    var lbl = document.createElement('span');
    lbl.className   = 'cc-chip-label';
    lbl.textContent = chip.label || '';
    lbl.style.color    = ink;
    lbl.style.fontSize = ccFontSize + 'px';
    lbl.style.pointerEvents = 'none';
    chipEl.appendChild(lbl);

    /* F-13 4번: 색상·라벨 편집은 패널로 이동 — 캔버스 클릭은 active 표시 + 패널 행 포커스 이동만.
       패널 플래시는 setTimeout으로 한 틱 미룸(이유: _focusItemRow 주석 참고 — .blk의 el.onclick이
       같은 틱에서 나중에 패널을 재렌더하므로, 그 뒤에 플래시해야 살아남음)
       삭제는 패널 리스트(bp-cc-list)의 le-del 버튼으로 통일 — 캔버스 위 ×버튼은 중복이라 제거(0620_2) */
    chipEl.addEventListener('click', function(e) {
      var prev = wrap.querySelector('.cc-chip.active');
      if (prev && prev !== chipEl) prev.classList.remove('active');
      blk._activeChipId = chip.id;
      chipEl.classList.add('active');
      setTimeout(function() { _leFlashRow('bp-cc-list', idx); }, 0);
    });

    /* 드래그 */
    _ccWireDrag(chipEl, chip, blk, 'x', key);

    if (showText) {
      var rowEl = document.createElement('div');
      rowEl.className = 'cc-chip-row';
      rowEl.appendChild(chipEl);
      var descEl = document.createElement('span');
      descEl.className   = 'cc-chip-desc';
      descEl.textContent = chip.desc || '';
      descEl.style.fontSize = ccFontSize + 'px';
      rowEl.appendChild(descEl);
      wrap.appendChild(rowEl);
    } else {
      wrap.appendChild(chipEl);
    }
  });

  /* 칩 추가는 패널 리스트(bp-cc-list-add)로 통일 — 캔버스 위 +버튼은 중복이라 제거(0620_2) */

  el.appendChild(wrap);
}
