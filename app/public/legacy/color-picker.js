/* color-picker.js — 그리드메이커 전역 공용 컬러피커 (Phase 6 디자인 이식)
   앱 전체의 모든 색상 선택 UI(텍스트 툴바 3곳 + 전역설정/헤더/배경지/그라디언트/
   컬러칩/블록배경 11곳)가 공유하는 단일 HSV 인라인 피커 팝오버.
   맞춤 색상(최대 18개)은 localStorage에 저장되어 14곳 전부가 공유한다. */

var GM_CP_CUSTOM_KEY = 'gm_customColors';
var GM_CP_CUSTOM_MAX = 18;

var _gmCpOpts = null;
var _gmCpHue = 0, _gmCpSat = 0, _gmCpVal = 0;

function _gmGetCustomColors() {
  try {
    var raw = localStorage.getItem(GM_CP_CUSTOM_KEY);
    var arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch (e) { return []; }
}
function _gmSetCustomColors(arr) {
  try { localStorage.setItem(GM_CP_CUSTOM_KEY, JSON.stringify(arr.slice(0, GM_CP_CUSTOM_MAX))); } catch (e) {}
}

/* ── HSV ↔ HEX 변환 ── */
function hsvToHex(h, s, v) {
  h = ((h % 360) + 360) % 360;
  var c = v * s;
  var x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  var m = v - c;
  var r = 0, g = 0, b = 0;
  if (h < 60)       { r = c; g = x; b = 0; }
  else if (h < 120) { r = x; g = c; b = 0; }
  else if (h < 180) { r = 0; g = c; b = x; }
  else if (h < 240) { r = 0; g = x; b = c; }
  else if (h < 300) { r = x; g = 0; b = c; }
  else              { r = c; g = 0; b = x; }
  var to2 = function(n) { return Math.round((n + m) * 255).toString(16).padStart(2, '0'); };
  return '#' + to2(r) + to2(g) + to2(b);
}
function hexToHsv(hex) {
  var m = (hex || '').match(/^#([0-9A-Fa-f]{6})$/);
  if (!m) return { h: 0, s: 0, v: 0 };
  var r = parseInt(m[1].substr(0,2),16) / 255;
  var g = parseInt(m[1].substr(2,2),16) / 255;
  var b = parseInt(m[1].substr(4,2),16) / 255;
  var mx = Math.max(r,g,b), mn = Math.min(r,g,b), d = mx - mn;
  var h = 0;
  if (d !== 0) {
    if (mx === r)      h = ((g - b) / d) % 6;
    else if (mx === g) h = (b - r) / d + 2;
    else               h = (r - g) / d + 4;
    h *= 60; if (h < 0) h += 360;
  }
  return { h: h, s: mx === 0 ? 0 : d / mx, v: mx };
}

/* ── 팝오버 열기/닫기 ──
   opts.pickerId가 있으면 "기본 모드": 숨겨진 <input type=color>의 .value를 갱신하고
   input 이벤트를 릴레이해서 기존 oninput 로직(11개 .cpC-chip 패턴)을 그대로 재사용한다.
   opts.getValue/onChange/onReset을 직접 주면 "고급 모드"(텍스트 툴바 3곳처럼 null-리셋
   등 네이티브 input이 표현 못 하는 상태가 필요한 경우). */
function gmOpenColorPicker(triggerEl, opts) {
  opts = opts || {};
  if (opts.pickerId) {
    var pid = opts.pickerId, defaultHex = opts.defaultHex;
    var relay = function(hex) {
      var inp = document.getElementById(pid);
      if (!inp) return;
      inp.value = hex;
      inp.dispatchEvent(new Event('input', { bubbles: true }));
    };
    opts = Object.assign({}, opts, {
      getValue: function() { var inp = document.getElementById(pid); return (inp && inp.value) || defaultHex || '#ffffff'; },
      onChange: relay,
      onReset: defaultHex ? function() { relay(defaultHex); } : null
    });
  }

  var pop = document.getElementById('gm-cp-pop');
  if (!pop) return;

  /* 같은 트리거를 다시 클릭하면 닫기(토글) */
  if (pop.classList.contains('open') && _gmCpOpts && _gmCpOpts.triggerEl === triggerEl) {
    gmCloseColorPicker();
    return;
  }

  _gmCpOpts = Object.assign({ triggerEl: triggerEl }, opts);

  var rect = triggerEl.getBoundingClientRect();
  pop.style.top = (rect.bottom + 8) + 'px';
  pop.style.left = rect.left + 'px';

  var labelEl = document.getElementById('gm-cp-mode-label');
  if (labelEl) labelEl.textContent = opts.label || '색상';

  var strengthEl = document.getElementById('gm-cp-strength');
  if (strengthEl) strengthEl.style.display = opts.outlineLevel ? 'block' : 'none';
  if (opts.outlineLevel) _gmCpSyncOutlineLevel();

  var resetBtn = document.getElementById('gm-cp-reset-btn');
  if (resetBtn) resetBtn.style.display = opts.onReset ? '' : 'none';

  var hex = (opts.getValue && opts.getValue()) || '#212121';
  if (!/^#[0-9A-Fa-f]{6}$/.test(hex)) hex = '#212121';
  _gmCpSetHex(hex);
  _gmCpRenderCustomRow();

  pop.classList.add('open');
}

function gmCloseColorPicker() {
  var pop = document.getElementById('gm-cp-pop');
  if (pop) pop.classList.remove('open');
  _gmCpOpts = null;
}

/* 팝오버 바깥(또는 다른 트리거) mousedown 시 닫기 */
document.addEventListener('mousedown', function(e) {
  var pop = document.getElementById('gm-cp-pop');
  if (!pop || !pop.classList.contains('open')) return;
  if (pop.contains(e.target)) return;
  if (_gmCpOpts && _gmCpOpts.triggerEl && _gmCpOpts.triggerEl.contains(e.target)) return;
  gmCloseColorPicker();
});

/* ── 외곽선 강도(없음/약/강) ── */
function _gmCpSyncOutlineLevel() {
  if (!_gmCpOpts || !_gmCpOpts.outlineLevel) return;
  var lv = _gmCpOpts.outlineLevel.get();
  document.querySelectorAll('#gm-cp-strength .cp-strength-tile').forEach(function(t) {
    t.classList.toggle('on', parseInt(t.dataset.lv, 10) === lv);
  });
}
function gmSetOutlineLevel(lv) {
  if (!_gmCpOpts || !_gmCpOpts.outlineLevel) return;
  _gmCpOpts.outlineLevel.onChange(lv);
  _gmCpSyncOutlineLevel();
}

/* ── 인라인 HSV 피커 ── */
function _gmCpRenderPicker() {
  var hueHex = hsvToHex(_gmCpHue, 1, 1);
  var sv = document.getElementById('gm-cp-sv');
  if (sv) sv.style.background = hueHex;
  var svCursor = document.getElementById('gm-cp-sv-cursor');
  if (svCursor) { svCursor.style.left = (_gmCpSat * 100) + '%'; svCursor.style.top = ((1 - _gmCpVal) * 100) + '%'; }
  var hueCursor = document.getElementById('gm-cp-hue-cursor');
  if (hueCursor) hueCursor.style.left = (_gmCpHue / 360 * 100) + '%';
}
function _gmCpUpdatePreview(hex) {
  var prev = document.getElementById('gm-cp-hex-prev');
  if (prev) prev.style.background = hex;
  var input = document.getElementById('gm-cp-hex-input');
  if (input) input.value = hex.slice(1).toUpperCase();
}
function _gmCpSetHex(hex) {
  var hsv = hexToHsv(hex);
  _gmCpHue = hsv.h; _gmCpSat = hsv.s; _gmCpVal = hsv.v;
  _gmCpRenderPicker();
  _gmCpUpdatePreview(hex);
  _gmCpUpdateSelDots(hex);
}
function _gmCpCommit() {
  var hex = hsvToHex(_gmCpHue, _gmCpSat, _gmCpVal);
  _gmCpUpdatePreview(hex);
  if (_gmCpOpts && _gmCpOpts.onChange) _gmCpOpts.onChange(hex);
  _gmCpUpdateSelDots(hex);
}
function gmCpSvPointerDown(e) {
  var box = document.getElementById('gm-cp-sv');
  function move(ev) {
    var r = box.getBoundingClientRect();
    _gmCpSat = Math.min(1, Math.max(0, (ev.clientX - r.left) / r.width));
    _gmCpVal = Math.min(1, Math.max(0, 1 - (ev.clientY - r.top) / r.height));
    _gmCpRenderPicker(); _gmCpCommit();
  }
  move(e);
  function up() { document.removeEventListener('pointermove', move); document.removeEventListener('pointerup', up); }
  document.addEventListener('pointermove', move);
  document.addEventListener('pointerup', up);
}
function gmCpHuePointerDown(e) {
  var bar = document.getElementById('gm-cp-hue');
  function move(ev) {
    var r = bar.getBoundingClientRect();
    _gmCpHue = Math.min(360, Math.max(0, (ev.clientX - r.left) / r.width * 360));
    _gmCpRenderPicker(); _gmCpCommit();
  }
  move(e);
  function up() { document.removeEventListener('pointermove', move); document.removeEventListener('pointerup', up); }
  document.addEventListener('pointermove', move);
  document.addEventListener('pointerup', up);
}
function gmCpHexInputChanged(v) {
  var hex = '#' + v.replace(/[^0-9A-Fa-f]/g, '').slice(0, 6);
  if (!/^#[0-9A-Fa-f]{6}$/.test(hex)) return;
  _gmCpSetHex(hex);
  if (_gmCpOpts && _gmCpOpts.onChange) _gmCpOpts.onChange(hex);
}
function gmCpPickColor(hex) {
  if (!/^#[0-9A-Fa-f]{6}$/.test(hex)) return;
  _gmCpSetHex(hex);
  if (_gmCpOpts && _gmCpOpts.onChange) _gmCpOpts.onChange(hex);
}
function gmCpReset() {
  if (_gmCpOpts && _gmCpOpts.onReset) _gmCpOpts.onReset();
  gmCloseColorPicker();
}

/* ── 맞춤 색상 (전역 공유, localStorage) ── */
function gmCpAddCustomColor() {
  var hex = hsvToHex(_gmCpHue, _gmCpSat, _gmCpVal);
  var arr = _gmGetCustomColors();
  var idx = arr.indexOf(hex);
  if (idx !== -1) arr.splice(idx, 1);
  arr.unshift(hex);
  if (arr.length > GM_CP_CUSTOM_MAX) arr = arr.slice(0, GM_CP_CUSTOM_MAX);
  _gmSetCustomColors(arr);
  _gmCpRenderCustomRow();
}
function _gmCpRenderCustomRow() {
  var row = document.getElementById('gm-cp-custom-row');
  if (!row) return;
  row.innerHTML = '';
  _gmGetCustomColors().forEach(function(hex) {
    var btn = document.createElement('button');
    btn.className = 'cp-dot';
    btn.dataset.c = hex;
    btn.style.background = hex;
    btn.onclick = function() { gmCpPickColor(hex); };
    row.appendChild(btn);
  });
  var add = document.createElement('button');
  add.className = 'cp-add-btn';
  add.title = '현재 색을 맞춤 색상에 추가';
  add.textContent = '+';
  add.onclick = gmCpAddCustomColor;
  row.appendChild(add);
  _gmCpUpdateSelDots(hsvToHex(_gmCpHue, _gmCpSat, _gmCpVal));
}
function _gmCpUpdateSelDots(hex) {
  document.querySelectorAll('#gm-cp-pop .cp-dot').forEach(function(d) {
    d.classList.toggle('sel', !!hex && d.dataset.c.toLowerCase() === hex.toLowerCase());
  });
}
