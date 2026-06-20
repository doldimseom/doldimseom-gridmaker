/* panel-block-img.js — 리팩토링 2단계 6번째 조각: 이미지 블록 오버레이+편집(imgTransform) (두 군데로 나뉜 블록을 합침, app/public/legacy/main.js에서 추출, 로직 변경 없음) */
/* ══════════════════════════════════════════
   이미지 블록 오버레이 (그라디언트 + 텍스트)
══════════════════════════════════════════ */
function _hexAlpha(hex, a) {
  var c = (hex || '#000000').replace('#', '');
  if (c.length === 3) c = c[0]+c[0]+c[1]+c[1]+c[2]+c[2];
  var alpha = Math.min(100, Math.max(0, a !== undefined ? +a : 0)) / 100;
  return 'rgba('+parseInt(c.substr(0,2),16)+','+parseInt(c.substr(2,2),16)+','+parseInt(c.substr(4,2),16)+','+alpha.toFixed(2)+')';
}

var _gradSelIdx = 0; /* 현재 선택된 그라디언트 마커 인덱스 (0=시작, 1=끝) */

/* gradStart/gradEnd가 없거나 pos가 없으면 기본값으로 초기화 */
function _ensureGradStops(blk) {
  if (!blk.gradStart) blk.gradStart = { hex: '#000000', a: 0,  pos: 0   };
  else if (blk.gradStart.pos === undefined) blk.gradStart.pos = 0;
  if (!blk.gradEnd)   blk.gradEnd   = { hex: '#000000', a: 65, pos: 100 };
  else if (blk.gradEnd.pos === undefined)   blk.gradEnd.pos   = 100;
}

function toggleImgLayer(prop) {
  var blk = getSelBlk();
  if (!blk || blk.type !== 'img') return;
  if (prop === 'grad') {
    blk.gradOn = !blk.gradOn;
    var sw = document.getElementById('bp-grad-sw');
    var opts = document.getElementById('bp-grad-opts');
    if (sw) sw.classList.toggle('on', blk.gradOn);
    if (opts) opts.style.display = blk.gradOn ? '' : 'none';
    if (blk.gradOn) { _ensureGradStops(blk); _initGradMarkers(); _paintGradRamp(); _loadGradEditor(_gradSelIdx); }
  }
  render();
}

function syncImgProp(prop, val) {
  var blk = getSelBlk();
  if (!blk || blk.type !== 'img') return;
  if (!_pendingHistorySave) { saveHistory(); _pendingHistorySave = true; }
  var _dirs = { top:'top', bottom:'bot', left:'lft', right:'rgt' };
  if (prop === 'gradDir') {
    blk.gradDir = val;
    Object.keys(_dirs).forEach(function(k) {
      var btn = document.getElementById('bp-gdir-' + _dirs[k]);
      if (btn) btn.classList.toggle('on', k === val);
    });
  }
  render();
}

/* 그라디언트 막대 + 마커 위치·색 업데이트 */
function _paintGradRamp() {
  var blk = getSelBlk();
  if (!blk) return;
  var gs = blk.gradStart || { hex: '#000000', a: 0,  pos: 0   };
  var ge = blk.gradEnd   || { hex: '#000000', a: 65, pos: 100 };
  var p0 = gs.pos !== undefined ? gs.pos : 0;
  var p1 = ge.pos !== undefined ? ge.pos : 100;
  var fill = document.getElementById('bp-grad-fill');
  if (fill) fill.style.background = 'linear-gradient(to right,' + _hexAlpha(gs.hex, gs.a) + ' ' + p0 + '%,' + _hexAlpha(ge.hex, ge.a) + ' ' + p1 + '%)';
  var st0 = document.getElementById('bp-gstop-0');
  var st1 = document.getElementById('bp-gstop-1');
  if (st0) { st0.style.left = p0 + '%'; var pt0 = st0.querySelector('path'); if (pt0) pt0.setAttribute('fill', gs.hex || '#000000'); }
  if (st1) { st1.style.left = p1 + '%'; var pt1 = st1.querySelector('path'); if (pt1) pt1.setAttribute('fill', ge.hex || '#000000'); }
}

/* 선택된 마커(idx)에 맞춰 에디터 UI 업데이트 */
function _loadGradEditor(idx) {
  _gradSelIdx = idx;
  var blk = getSelBlk();
  if (!blk) return;
  var stop = idx === 0
    ? (blk.gradStart || { hex: '#000000', a: 0,  pos: 0   })
    : (blk.gradEnd   || { hex: '#000000', a: 65, pos: 100 });
  var hex = stop.hex || '#000000';
  var a   = stop.a !== undefined ? stop.a : (idx === 0 ? 0 : 65);
  /* 마커 선택 표시 */
  [document.getElementById('bp-gstop-0'), document.getElementById('bp-gstop-1')].forEach(function(el, i) {
    if (!el) return;
    el.classList.toggle('sel', i === idx);
    var path = el.querySelector('path');
    if (path) path.setAttribute('stroke', i === idx ? '#5B7CE6' : '#ffffff');
  });
  /* 에디터 */
  var sw = document.getElementById('bp-gstop-sw');
  var ci = document.getElementById('bp-gstop-hex');
  var he = document.getElementById('bp-gstop-hexedit');
  if (sw) sw.style.background = _hexAlpha(hex, a);
  if (ci) ci.value = hex;
  if (he) he.value = hex.toUpperCase();
  _updateSliderUI('bp-sl-gstop', a);
  var sn = document.getElementById('bp-sn-gstop');
  if (sn) sn.value = a;
}

/* 마커 드래그 이벤트 바인딩 (최초 1회) */
function _initGradMarkers() {
  var ramp = document.getElementById('bp-grad-ramp');
  if (!ramp || ramp._gradInited) return;
  ramp._gradInited = true;
  [document.getElementById('bp-gstop-0'), document.getElementById('bp-gstop-1')].forEach(function(st) {
    if (!st) return;
    var i = +st.dataset.i;
    st.addEventListener('pointerdown', function(e) {
      _loadGradEditor(i);
      try { st.setPointerCapture(e.pointerId); } catch(_) {}
      st._drag = true;
    });
    st.addEventListener('pointermove', function(e) {
      if (!st._drag) return;
      var blk = getSelBlk();
      if (!blk) return;
      if (!_pendingHistorySave) { saveHistory(); _pendingHistorySave = true; }
      var r = ramp.getBoundingClientRect();
      var pos = Math.round(Math.max(0, Math.min(100, (e.clientX - r.left) / r.width * 100)));
      _ensureGradStops(blk);
      if (i === 0) blk.gradStart.pos = pos;
      else         blk.gradEnd.pos   = pos;
      _paintGradRamp();
      render();
    });
    st.addEventListener('pointerup', function() { st._drag = false; _pendingHistorySave = false; });
  });
}

/* 색/불투명도 변경 → blk 업데이트 + 막대 리페인트 */
function _syncGradStop() {
  var blk = getSelBlk();
  if (!blk || blk.type !== 'img') return;
  var ci = document.getElementById('bp-gstop-hex');
  var sn = document.getElementById('bp-sn-gstop');
  if (!ci) return;
  var hex = ci.value;
  var a   = Math.max(0, Math.min(100, +sn.value || 0));
  var sw  = document.getElementById('bp-gstop-sw');
  var he  = document.getElementById('bp-gstop-hexedit');
  if (sw) sw.style.background = _hexAlpha(hex, a);
  if (he) he.value = hex.toUpperCase();
  if (_gradSelIdx === 0) { blk.gradStart = blk.gradStart || {}; blk.gradStart.hex = hex; blk.gradStart.a = a; }
  else                   { blk.gradEnd   = blk.gradEnd   || {}; blk.gradEnd.hex   = hex; blk.gradEnd.a   = a; }
  _paintGradRamp();
  render();
}

function _onGradStopColorInput(val) {
  var blk = getSelBlk();
  if (!blk || blk.type !== 'img') return;
  if (!_pendingHistorySave) { saveHistory(); _pendingHistorySave = true; }
  var he = document.getElementById('bp-gstop-hexedit');
  if (he) he.value = val.toUpperCase();
  if (_gradSelIdx === 0) { blk.gradStart = blk.gradStart || {}; blk.gradStart.hex = val; }
  else                   { blk.gradEnd   = blk.gradEnd   || {}; blk.gradEnd.hex   = val; }
  _syncGradStop();
}

function _onGradStopHexEdit(val) {
  var v = (val || '').trim();
  if (v[0] !== '#') v = '#' + v;
  if (!/^#[0-9a-fA-F]{6}$/.test(v)) return;
  var ci = document.getElementById('bp-gstop-hex');
  if (ci) ci.value = v;
  _onGradStopColorInput(v);
}

function _onGradStopOpacityInput(val) {
  var blk = getSelBlk();
  if (!blk || blk.type !== 'img') return;
  if (!_pendingHistorySave) { saveHistory(); _pendingHistorySave = true; }
  var a = Math.max(0, Math.min(100, +val || 0));
  _updateSliderUI('bp-sl-gstop', a);
  var sn = document.getElementById('bp-sn-gstop');
  if (sn) sn.value = a;
  _ensureGradStops(blk);
  if (_gradSelIdx === 0) blk.gradStart.a = a;
  else                   blk.gradEnd.a   = a;
  var ci = document.getElementById('bp-gstop-hex');
  var sw = document.getElementById('bp-gstop-sw');
  if (sw && ci) sw.style.background = _hexAlpha(ci.value, a);
  _paintGradRamp();
  render();
}

function _loadImgOverlayPanel(blk) {
  if (!blk || blk.type !== 'img') return;
  /* 그라디언트 토글 */
  var gradOn = !!blk.gradOn;
  var gsw   = document.getElementById('bp-grad-sw');
  var gopts = document.getElementById('bp-grad-opts');
  if (gsw)   gsw.classList.toggle('on', gradOn);
  if (gopts) gopts.style.display = gradOn ? '' : 'none';
  /* 방향 타일 */
  var gDir  = blk.gradDir || 'bottom';
  var _dirs = { top:'top', bottom:'bot', left:'lft', right:'rgt' };
  Object.keys(_dirs).forEach(function(k) {
    var btn = document.getElementById('bp-gdir-' + _dirs[k]);
    if (btn) btn.classList.toggle('on', k === gDir);
  });
  /* 막대 + 에디터 (패널이 열려 있을 때만) */
  if (gradOn) {
    _ensureGradStops(blk);
    _initGradMarkers();
    _paintGradRamp();
    _loadGradEditor(_gradSelIdx);
  }
}

/* ══════════════════════════════════════════
   이미지 편집 (imgTransform — 돌딤섬 시트메이커 이식)
══════════════════════════════════════════ */
/* transform CSS 적용 */
function applyImgTransform(key) {
  var blk = getBlkByKey(key);
  if (!blk) return;
  var blkEl = document.querySelector('.blk[data-key="' + key + '"]');
  if (!blkEl) return;
  var wrap = blkEl.querySelector('.blk-img-wrap');
  var imgEl = wrap ? wrap.querySelector('.blk-img-el') : blkEl.querySelector('.blk-img-el');
  if (!imgEl) return;
  var t = blk.imgTransform || { scale:1, x:0, y:0 };
  imgEl.style.transform =
    'translate(calc(-50% + ' + t.x + 'px), calc(-50% + ' + t.y + 'px)) scale(' + t.scale + ')';
}

/* 업로드 직후 contain 기준 초기 scale 계산 (이미지 전체가 블록 안에 들어오는 크기) */
function initImgTransform(key) {
  var blk = getBlkByKey(key);
  if (!blk) return;
  var blkEl = document.querySelector('.blk[data-key="' + key + '"]');
  if (!blkEl) return;
  var imgEl = blkEl.querySelector('.blk-img-el');
  if (!imgEl) return;
  var cw = blkEl.offsetWidth;
  var ch = blkEl.offsetHeight;
  var iw = imgEl.naturalWidth  || imgEl.width  || 1;
  var ih = imgEl.naturalHeight || imgEl.height || 1;
  if (!cw || !ch) return;
  /* contain: 이미지 전체가 블록 안에 들어오는 최소 배율 */
  var scale = Math.min(cw / iw, ch / ih);
  blk.imgTransform = { scale: scale, x: 0, y: 0 };
  applyImgTransform(key);
}

/* 편집 모드 진입 */
function enterImgEditMode(key) {
  var blk = getBlkByKey(key);
  if (!blk || !blk.imgSrc) return;
  if (activeImgKey && activeImgKey !== key) exitImgEditMode();
  activeImgKey = key;

  var blkEl = document.querySelector('.blk[data-key="' + key + '"]');
  if (!blkEl) return;
  blkEl.classList.add('editing');

  /* 기존 오버레이 재사용 */
  var overlay = blkEl.querySelector('.img-edit-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.className = 'img-edit-overlay';

    /* SVG 그라디언트 테두리 */
    var svgNS = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('class', 'march-border');
    svg.setAttribute('xmlns', svgNS);

    var defs   = document.createElementNS(svgNS, 'defs');
    var grad   = document.createElementNS(svgNS, 'linearGradient');
    var gradId = 'mg-' + key.replace(/-/g, '_');
    grad.setAttribute('id', gradId);
    grad.setAttribute('gradientUnits', 'userSpaceOnUse');
    grad.setAttribute('x1', '0'); grad.setAttribute('y1', '0');
    grad.setAttribute('x2', '0'); grad.setAttribute('y2', '0');
    var stops = [
      { offset: '0%',   color: '#6B5FD0' },
      { offset: '50%',  color: '#d4cffa' },
      { offset: '100%', color: '#6B5FD0' }
    ];
    stops.forEach(function(s) {
      var stop = document.createElementNS(svgNS, 'stop');
      stop.setAttribute('offset', s.offset);
      stop.setAttribute('stop-color', s.color);
      grad.appendChild(stop);
    });
    defs.appendChild(grad);
    svg.appendChild(defs);

    var rectBg = document.createElementNS(svgNS, 'rect');
    rectBg.setAttribute('class', 'mg-rect-bg');
    rectBg.setAttribute('fill', 'none');
    rectBg.setAttribute('stroke', 'url(#' + gradId + ')');
    rectBg.setAttribute('stroke-width', '4');
    rectBg.setAttribute('stroke-opacity', '0.12');
    svg.appendChild(rectBg);

    var rect = document.createElementNS(svgNS, 'rect');
    rect.setAttribute('class', 'mg-rect');
    rect.setAttribute('fill', 'none');
    rect.setAttribute('stroke', 'url(#' + gradId + ')');
    rect.setAttribute('stroke-width', '1.5');
    svg.appendChild(rect);

    overlay.appendChild(svg);

    /* 힌트 */
    var hint = document.createElement('div');
    hint.className = 'img-edit-hint';
    hint.textContent = '드래그: 위치  ·  휠: 확대/축소  ·  방향키: 미세 조정';
    overlay.appendChild(hint);

    /* 툴바 */
    var toolbar = document.createElement('div');
    toolbar.className = 'img-edit-toolbar';
    var mkBtn = function(label, fn) {
      var b = document.createElement('button');
      b.className = 'img-edit-btn';
      b.textContent = label;
      b.onclick = function(e) { e.stopPropagation(); fn(); };
      return b;
    };
    toolbar.appendChild(mkBtn('↺ 리셋',  function() { resetImgTransform(key); }));
    toolbar.appendChild(mkBtn('↑ 변경',  function() { triggerImgUpload(key); }));
    toolbar.appendChild(mkBtn('✓ 완료',  function() { exitImgEditMode(); }));
    overlay.appendChild(toolbar);

    /* rAF 그라디언트 회전 */
    var rafId = null;
    function updateBorder() {
      var W = blkEl.offsetWidth;
      var H = blkEl.offsetHeight;
      var R = parseFloat(window.getComputedStyle(blkEl).borderRadius) || parseFloat(blkEl.style.borderRadius) || 0;
      var S = 1;
      svg.setAttribute('width',  W);
      svg.setAttribute('height', H);
      [rect, rectBg].forEach(function(r) {
        r.setAttribute('x',      S);
        r.setAttribute('y',      S);
        r.setAttribute('width',  W - S * 2);
        r.setAttribute('height', H - S * 2);
        r.setAttribute('rx',     Math.max(0, R - S));
        r.setAttribute('ry',     Math.max(0, R - S));
      });
      var perimeter = 2 * (W + H);
      var angle = ((performance.now() / 8) % 360) * Math.PI / 180;
      var cx = W / 2, cy = H / 2;
      var dist = perimeter / 2;
      grad.setAttribute('x1', cx + Math.cos(angle) * dist);
      grad.setAttribute('y1', cy + Math.sin(angle) * dist);
      grad.setAttribute('x2', cx - Math.cos(angle) * dist);
      grad.setAttribute('y2', cy - Math.sin(angle) * dist);
      rafId = requestAnimationFrame(updateBorder);
    }
    overlay._startRaf = function() { if (!rafId) updateBorder(); };
    overlay._stopRaf  = function() { if (rafId) { cancelAnimationFrame(rafId); rafId = null; } };

    /* 드래그 */
    var dragging = false, startX = 0, startY = 0, startTX = 0, startTY = 0, didDrag = false;
    overlay.addEventListener('mousedown', function(e) {
      if (e.button !== 0) return; /* 휠클릭(1)/우클릭(2) 차단 */
      if (e.target.closest('.img-edit-toolbar')) return;
      dragging = true; didDrag = false;
      startX = e.clientX; startY = e.clientY;
      var blkObj = getBlkByKey(key);
      startTX = blkObj ? blkObj.imgTransform.x : 0;
      startTY = blkObj ? blkObj.imgTransform.y : 0;
      e.preventDefault();
    });
    window.addEventListener('mousemove', function(e) {
      if (!dragging || activeImgKey !== key) return;
      var dx = e.clientX - startX, dy = e.clientY - startY;
      if (Math.abs(dx) > 2 || Math.abs(dy) > 2) didDrag = true;
      var blkObj = getBlkByKey(key);
      if (!blkObj) return;
      blkObj.imgTransform.x = startTX + dx;
      blkObj.imgTransform.y = startTY + dy;
      applyImgTransform(key);
    });
    window.addEventListener('mouseup', function() { dragging = false; });
    overlay.addEventListener('click', function(e) {
      if (didDrag) { didDrag = false; e.stopPropagation(); }
    }, true);

    /* 휠 줌 */
    overlay.addEventListener('wheel', function(e) {
      e.preventDefault();
      var blkObj = getBlkByKey(key);
      if (!blkObj) return;
      var delta = e.deltaY > 0 ? -0.05 : 0.05;
      blkObj.imgTransform.scale = Math.max(0.1, Math.min(10, blkObj.imgTransform.scale + delta));
      applyImgTransform(key);
    }, { passive: false });

    blkEl.appendChild(overlay);
  }

  overlay.classList.add('active');
  overlay._startRaf && overlay._startRaf();
  /* 편집모드 진입 시 툴바 제거 — onclick에서만 생성 */
  var ftb = blkEl.querySelector('.blk-float-toolbar');
  if (ftb) ftb.remove();
}

/* 편집 모드 종료 — 오버레이 닫기 + activeImgKey 초기화만 담당
   selKey 초기화·showCanvasPanel·render 는 호출한 쪽에서 처리 */
function exitImgEditMode() {
  if (!activeImgKey) return;
  var blkEl = document.querySelector('.blk[data-key="' + activeImgKey + '"]');
  if (blkEl) {
    var overlay = blkEl.querySelector('.img-edit-overlay');
    if (overlay) {
      overlay.classList.remove('active');
      overlay._stopRaf && overlay._stopRaf();
    }
    /* 편집모드 종료 시 툴바 제거 — 다시 보려면 단일 클릭 */
    var ftb = blkEl.querySelector('.blk-float-toolbar');
    if (ftb) ftb.remove();
    /* 편집 모드 CSS 해제 */
    blkEl.classList.remove('editing');
    /* 선택 표시 해제 */
    blkEl.style.outline = '';
    blkEl.style.outlineOffset = '';
    blkEl.classList.remove('selected');
  }
  activeImgKey = null;
}

/* transform 리셋 */
function resetImgTransform(key) {
  initImgTransform(key);
}

/* 업로드 트리거 — 동적 input 생성 후 즉시 click */
function triggerImgUpload(key) {
  var inp = document.createElement('input');
  inp.type = 'file'; inp.accept = 'image/*';
  inp.style.display = 'none';
  inp.onchange = function() {
    var file = inp.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function(ev) {
      var blk = getBlkByKey(key);
      if (!blk) return;
      blk.imgSrc = ev.target.result;
      blk.imgTransform = { scale: 1, x: 0, y: 0 };
      selKey = key;
      activeImgKey = null;  /* 기존 오버레이 재사용 방지 — 새 이미지로 교체 시 상태 초기화 */
      render();
      /* 업로드박스 섬네일 갱신 */
      _refreshImgUploadBox(blk);
      /* 업로드 직후 contain 기준 scale 초기화 → 편집 모드 자동 진입 */
      requestAnimationFrame(function() {
        initImgTransform(key);
        enterImgEditMode(key);
      });
    };
    reader.readAsDataURL(file);
    document.body.removeChild(inp);
  };
  document.body.appendChild(inp);
  inp.click();
}
function _refreshImgUploadBox(blk) {
  var box = document.getElementById('bp-img-upload-box');
  if (!box) return;
  if (blk && blk.imgSrc) {
    /* 섬네일 상태 */
    box.classList.add('has-img');
    box.innerHTML =
      '<img class="ub-thumb" src="' + blk.imgSrc + '" alt="섬네일">' +
      '<button class="ub-del-x" title="이미지 삭제" aria-label="이미지 삭제" onclick="event.stopPropagation();if(selKey)clearImgSrc(selKey);">' +
        '<svg width="8" height="8" viewBox="0 0 10 10" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M1 1l8 8M9 1l-8 8"/></svg>' +
      '</button>';
  } else {
    /* 기본 업로드 상태 */
    box.classList.remove('has-img');
    box.innerHTML =
      '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 4v12M7 9l5-5 5 5M5 20h14"/></svg>' +
      '이미지 업로드' +
      '<em>또는 드래그&amp;드롭</em>';
  }
}
function clearImgSrc(key) {
  var blk = getBlkByKey(key);
  if (!blk) return;
  blk.imgSrc = null;
  blk.imgTransform = { scale: 1, x: 0, y: 0 };
  activeImgKey = null;
  render();
  _refreshImgUploadBox(blk);
}
