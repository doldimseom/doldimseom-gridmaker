/* ══════════════════════════════════════════
   상태
══════════════════════════════════════════ */
/* ── blocks: 캔버스 위 모든 블록. 각 블록이 x, y, w, h를 직접 보유. ── */



/* ── 구 groupRows 헬퍼 스텁 ─────────────────────────────────────────
   엔진 재설계 완료 후 남은 빈 스텁.
   alignGroupHeight(), getBlkMinH() 등이 아직 _grp()를 호출하므로 유지. ── */
function _grpFlat()                     { return []; }
function _grp(gi)                       { return null; }
function _grpCount()                    { return 0; }
function _grpPos(gi)                    { return null; }
function _grpRowOf(gi)                  { return null; }
function _grpSpliceFlat(gi, n)          { return []; }
function _grpPushRow(grp)               { }
function _ensureWidthPct(row)           { }


/* ── 배경지 ── */

/* 드래그 상태 */
/* 블록 이동 드래그 (A: 열 내 순서 / B: 열 간 이동 / C: 새 열 생성) */
/* blkDrag = { id, ghostEl, startX, startY, startBlkX, startBlkY, didMove } */
/* 블록 우하단 리사이즈 드래그 */
/* 캔버스 너비/높이 핸들 드래그 */
/* 그룹 선택 상태 */

/* 스냅 */
/* _snapH: blkResize 핸들러에서 호출 중 (고정값 패스스루) */
function _snapH(h) { return h; }


/* ══════════════════════════════════════════
   스냅 시스템 — 자유 배치 엔진 (스텝6)
   엣지·중앙선·캔버스 중앙·간격 균등 스냅
══════════════════════════════════════════ */

function _clearSnapGuides() {
  var pad = document.getElementById('sheet-pad');
  if (!pad) return;
  pad.querySelectorAll('.snap-guide, .snap-spacing-bar-h, .snap-spacing-bar-v')
     .forEach(function(g) { g.remove(); });
}

/* g: { type:'edge'|'center'|'spacing', axis?:'v'|'h', pos?,
         orient?:'h'|'v', from?, to?, barY?, barX?, gap? } */
function _drawSnapGuide(g) {
  var pad = document.getElementById('sheet-pad');
  if (!pad) return;

  if (g.type === 'spacing') {
    /* 브래킷 바 — 간격 구간에 걸쳐지는 수평 or 수직 바 */
    var span = g.to - g.from;
    if (span < 1) return; /* 0px 간격은 표시 안 함 */
    var bar = document.createElement('div');
    if (g.orient === 'h') {
      bar.className = 'snap-spacing-bar-h';
      bar.style.left  = g.from + 'px';
      bar.style.top   = g.barY + 'px';
      bar.style.width = span + 'px';
    } else {
      bar.className = 'snap-spacing-bar-v';
      bar.style.top    = g.from + 'px';
      bar.style.left   = g.barX + 'px';
      bar.style.height = span + 'px';
    }
    var lbl = document.createElement('div');
    lbl.className = 'snap-spacing-lbl';
    lbl.textContent = g.gap + 'px';
    bar.appendChild(lbl);
    pad.appendChild(bar);
  } else {
    /* 엣지·중앙 — 전체 폭/높이 빨간 가이드선 */
    var el = document.createElement('div');
    el.className = 'snap-guide snap-guide-' + g.axis + ' snap-guide-red';
    if (g.axis === 'v') el.style.left = g.pos + 'px';
    else                el.style.top  = g.pos + 'px';
    pad.appendChild(el);
  }
}

function _computeSnap(nx, ny, dragBlk) {
  var w = dragBlk.w, h = dragBlk.h;
  var T = SNAP_THRESH;
  var guides = [];

  /* ── X축: 엣지·중앙·캔버스 스냅 후보 ── */
  var xCands = [];
  xCands.push({ snapX: 0,                             guideX: 0,                             type: 'edge'   });
  xCands.push({ snapX: canvasW - w,                   guideX: canvasW,                       type: 'edge'   });
  xCands.push({ snapX: Math.round(canvasW/2 - w/2),   guideX: Math.round(canvasW/2),         type: 'center' });
  blocks.forEach(function(b) {
    if (b.id === dragBlk.id) return;
    xCands.push({ snapX: b.x,           guideX: b.x,         type: 'edge'   });
    xCands.push({ snapX: b.x + b.w,     guideX: b.x + b.w,   type: 'edge'   });
    xCands.push({ snapX: b.x - w,       guideX: b.x,         type: 'edge'   });
    xCands.push({ snapX: b.x + b.w - w, guideX: b.x + b.w,   type: 'edge'   });
    xCands.push({ snapX: Math.round(b.x + b.w/2 - w/2), guideX: Math.round(b.x + b.w/2), type: 'center' });
  });
  var bestDX = T + 1, snapX = nx, gXpos = null, gXtype = null;
  xCands.forEach(function(c) {
    var d = Math.abs(nx - c.snapX);
    if (d < bestDX) { bestDX = d; snapX = c.snapX; gXpos = c.guideX; gXtype = c.type; }
  });
  if (gXpos !== null) guides.push({ axis: 'v', pos: gXpos, type: gXtype });

  /* ── Y축: 엣지·중앙·캔버스 스냅 후보 ── */
  var padEl  = document.getElementById('sheet-pad');
  var canvasH = padEl ? (parseInt(padEl.style.height) || 0) : 0;
  var yCands = [];
  yCands.push({ snapY: 0,                             guideY: 0,                             type: 'edge'   });
  yCands.push({ snapY: Math.max(0, canvasH - h),      guideY: canvasH,                       type: 'edge'   });
  yCands.push({ snapY: Math.round(canvasH/2 - h/2),   guideY: Math.round(canvasH/2),         type: 'center' });
  blocks.forEach(function(b) {
    if (b.id === dragBlk.id) return;
    yCands.push({ snapY: b.y,           guideY: b.y,         type: 'edge'   });
    yCands.push({ snapY: b.y + b.h,     guideY: b.y + b.h,   type: 'edge'   });
    yCands.push({ snapY: b.y - h,       guideY: b.y,         type: 'edge'   });
    yCands.push({ snapY: b.y + b.h - h, guideY: b.y + b.h,   type: 'edge'   });
    yCands.push({ snapY: Math.round(b.y + b.h/2 - h/2), guideY: Math.round(b.y + b.h/2), type: 'center' });
  });
  var bestDY = T + 1, snapY = ny, gYpos = null, gYtype = null;
  yCands.forEach(function(c) {
    var d = Math.abs(ny - c.snapY);
    if (d < bestDY) { bestDY = d; snapY = c.snapY; gYpos = c.guideY; gYtype = c.type; }
  });
  if (gYpos !== null) guides.push({ axis: 'h', pos: gYpos, type: gYtype });

  /* ── 간격 균등 스냅 (가로) ── */
  var others = blocks.filter(function(b) { return b.id !== dragBlk.id; });
  var lN = null, rN = null;
  others.forEach(function(b) {
    if (b.x + b.w <= nx) { if (!lN || b.x + b.w > lN.x + lN.w) lN = b; }
    if (b.x >= nx + w)   { if (!rN || b.x < rN.x)               rN = b; }
  });

  /* 케이스 A: 양쪽 이웃 모두 있음 → 중간에 등간격 */
  if (lN && rN) {
    var tgX = rN.x - (lN.x + lN.w) - w;
    if (tgX >= -T) {
      var eqX  = Math.round(lN.x + lN.w + Math.max(0, tgX) / 2);
      var dEqX = Math.abs(nx - eqX);
      if (dEqX <= T && dEqX < bestDX) {
        var gpX  = Math.round(Math.max(0, tgX) / 2);
        var barY = Math.round(ny + h / 2);
        snapX = eqX; bestDX = dEqX;
        guides = guides.filter(function(g) { return g.axis !== 'v'; });
        guides.push({ type: 'spacing', orient: 'h',
          from: lN.x + lN.w, to: eqX,   barY: barY, gap: gpX });
        guides.push({ type: 'spacing', orient: 'h',
          from: eqX + w,      to: rN.x,  barY: barY, gap: gpX });
      }
    }
  }

  /* 케이스 B: 왼쪽 이웃만 있음 → lN의 이웃 간격을 참조해 오른쪽으로 패턴 연장 */
  if (lN && !rN) {
    var llN = null;
    others.forEach(function(b) {
      if (b.id !== lN.id && b.x + b.w <= lN.x) {
        if (!llN || b.x + b.w > llN.x + llN.w) llN = b;
      }
    });
    if (llN) {
      var refGapB = lN.x - (llN.x + llN.w);
      if (refGapB >= 0) {
        var eqXb  = lN.x + lN.w + refGapB;
        var dEqXb = Math.abs(nx - eqXb);
        if (dEqXb <= T && dEqXb < bestDX) {
          var barYb = Math.round(ny + h / 2);
          snapX = eqXb; bestDX = dEqXb;
          guides = guides.filter(function(g) { return g.axis !== 'v'; });
          /* 기준 간격 (llN → lN) */
          guides.push({ type: 'spacing', orient: 'h',
            from: llN.x + llN.w, to: lN.x,  barY: barYb, gap: Math.round(refGapB) });
          /* 연장 간격 (lN → drag) */
          guides.push({ type: 'spacing', orient: 'h',
            from: lN.x + lN.w,   to: eqXb,  barY: barYb, gap: Math.round(refGapB) });
        }
      }
    }
  }

  /* 케이스 C: 오른쪽 이웃만 있음 → rN의 이웃 간격을 참조해 왼쪽으로 패턴 연장 */
  if (!lN && rN) {
    var rrN = null;
    others.forEach(function(b) {
      if (b.id !== rN.id && b.x >= rN.x + rN.w) {
        if (!rrN || b.x < rrN.x) rrN = b;
      }
    });
    if (rrN) {
      var refGapC = rrN.x - (rN.x + rN.w);
      if (refGapC >= 0) {
        var eqXc  = rN.x - w - refGapC;
        var dEqXc = Math.abs(nx - eqXc);
        if (dEqXc <= T && dEqXc < bestDX) {
          var barYc = Math.round(ny + h / 2);
          snapX = eqXc; bestDX = dEqXc;
          guides = guides.filter(function(g) { return g.axis !== 'v'; });
          /* 연장 간격 (drag → rN) */
          guides.push({ type: 'spacing', orient: 'h',
            from: eqXc + w,      to: rN.x,         barY: barYc, gap: Math.round(refGapC) });
          /* 기준 간격 (rN → rrN) */
          guides.push({ type: 'spacing', orient: 'h',
            from: rN.x + rN.w,   to: rrN.x,        barY: barYc, gap: Math.round(refGapC) });
        }
      }
    }
  }

  /* ── 간격 균등 스냅 (세로) ── */
  var tN = null, bN = null;
  others.forEach(function(b) {
    if (b.y + b.h <= ny) { if (!tN || b.y + b.h > tN.y + tN.h) tN = b; }
    if (b.y >= ny + h)   { if (!bN || b.y < bN.y)               bN = b; }
  });

  /* 케이스 A: 상하 이웃 모두 있음 */
  if (tN && bN) {
    var tgY = bN.y - (tN.y + tN.h) - h;
    if (tgY >= -T) {
      var eqY  = Math.round(tN.y + tN.h + Math.max(0, tgY) / 2);
      var dEqY = Math.abs(ny - eqY);
      if (dEqY <= T && dEqY < bestDY) {
        var gpY  = Math.round(Math.max(0, tgY) / 2);
        var barX = Math.round(nx + w / 2);
        snapY = eqY; bestDY = dEqY;
        guides = guides.filter(function(g) { return g.axis !== 'h'; });
        guides.push({ type: 'spacing', orient: 'v',
          from: tN.y + tN.h, to: eqY,   barX: barX, gap: gpY });
        guides.push({ type: 'spacing', orient: 'v',
          from: eqY + h,      to: bN.y,  barX: barX, gap: gpY });
      }
    }
  }

  /* 케이스 B: 위쪽 이웃만 있음 → 아래로 패턴 연장 */
  if (tN && !bN) {
    var ttN = null;
    others.forEach(function(b) {
      if (b.id !== tN.id && b.y + b.h <= tN.y) {
        if (!ttN || b.y + b.h > ttN.y + ttN.h) ttN = b;
      }
    });
    if (ttN) {
      var refGapD = tN.y - (ttN.y + ttN.h);
      if (refGapD >= 0) {
        var eqYd  = tN.y + tN.h + refGapD;
        var dEqYd = Math.abs(ny - eqYd);
        if (dEqYd <= T && dEqYd < bestDY) {
          var barXd = Math.round(nx + w / 2);
          snapY = eqYd; bestDY = dEqYd;
          guides = guides.filter(function(g) { return g.axis !== 'h'; });
          guides.push({ type: 'spacing', orient: 'v',
            from: ttN.y + ttN.h, to: tN.y,  barX: barXd, gap: Math.round(refGapD) });
          guides.push({ type: 'spacing', orient: 'v',
            from: tN.y + tN.h,   to: eqYd,  barX: barXd, gap: Math.round(refGapD) });
        }
      }
    }
  }

  /* 케이스 C: 아래쪽 이웃만 있음 → 위로 패턴 연장 */
  if (!tN && bN) {
    var bbN = null;
    others.forEach(function(b) {
      if (b.id !== bN.id && b.y >= bN.y + bN.h) {
        if (!bbN || b.y < bbN.y) bbN = b;
      }
    });
    if (bbN) {
      var refGapE = bbN.y - (bN.y + bN.h);
      if (refGapE >= 0) {
        var eqYe  = bN.y - h - refGapE;
        var dEqYe = Math.abs(ny - eqYe);
        if (dEqYe <= T && dEqYe < bestDY) {
          var barXe = Math.round(nx + w / 2);
          snapY = eqYe; bestDY = dEqYe;
          guides = guides.filter(function(g) { return g.axis !== 'h'; });
          guides.push({ type: 'spacing', orient: 'v',
            from: eqYe + h,    to: bN.y,        barX: barXe, gap: Math.round(refGapE) });
          guides.push({ type: 'spacing', orient: 'v',
            from: bN.y + bN.h, to: bbN.y,       barX: barXe, gap: Math.round(refGapE) });
        }
      }
    }
  }

  return { nx: snapX, ny: snapY, guides: guides };
}


/* ══════════════════════════════════════════
   유틸 — hex 컬러에 알파값 합성
   opacity: 0~100 (100 = 불투명)
══════════════════════════════════════════ */
function hexWithAlpha(hex, opacity) {
  if (opacity === null || opacity === undefined || opacity >= 100) return hex;
  var h = hex.replace('#', '');
  if (h.length === 3) h = h[0]+h[0]+h[1]+h[1]+h[2]+h[2];
  var r = parseInt(h.slice(0,2),16);
  var g = parseInt(h.slice(2,4),16);
  var b = parseInt(h.slice(4,6),16);
  return 'rgba(' + r + ',' + g + ',' + b + ',' + (opacity / 100).toFixed(2) + ')';
}

/* 글자 외곽선 — 16방향 text-shadow 합성 (부드러운 외곽선) */
function _textShadowCSS(tstroke, tstrokeColor) {
  if (!tstroke) return '';
  var w = tstroke >= 2 ? 1.4 : 0.8;
  var c = tstrokeColor || '#ffffff';
  var shadows = [];
  var steps = 16;
  for (var i = 0; i < steps; i++) {
    var angle = (i / steps) * 2 * Math.PI;
    var sx = Math.round(Math.cos(angle) * w * 10) / 10;
    var sy = Math.round(Math.sin(angle) * w * 10) / 10;
    shadows.push(sx + 'px ' + sy + 'px 0 ' + c);
  }
  return shadows.join(',');
}

/* ══════════════════════════════════════════
   우하단 pill — 줌 / 메뉴
══════════════════════════════════════════ */
/* ── 줌/팬 상태 ── */

/* stage transform 적용 */
function _applyStageTransform() {
  var stage = document.getElementById('canvas-stage');
  if (!stage) return;
  stage.style.transform =
    'translate(' + _panX + 'px,' + _panY + 'px) scale(' + _zoomLevel + ')';
}

/* 버튼(−/+): 뷰포트 중앙 기준 줌 */
function zoomCanvas(delta) {
  var area  = document.getElementById('canvas-area');
  if (!area) return;
  var rect  = area.getBoundingClientRect();
  var cx    = rect.width  / 2;
  var cy    = rect.height / 2;
  _zoomAtPoint(cx, cy, delta);
}

/* 원본보기: 줌 1.0 + 팬 초기화 */
function resetCamera() {
  _zoomLevel = 1.0;
  _panX = 0;
  _panY = 0;
  _applyStageTransform();
  var numEl = document.getElementById('zoom-num');
  if (numEl) numEl.textContent = '100%';
}

/* 특정 포인트 기준 줌 (휠 이벤트에서도 사용) */
function _zoomAtPoint(px, py, delta) {
  var prev = _zoomLevel;
  var next = Math.min(3.0, Math.max(0.2, Math.round((prev + delta) * 100) / 100));
  if (next === prev) return;

  /* 포인트가 stage 좌표계에서 고정되도록 pan 보정 */
  _panX = px - (px - _panX) * (next / prev);
  _panY = py - (py - _panY) * (next / prev);
  _zoomLevel = next;

  _applyStageTransform();
  var numEl = document.getElementById('zoom-num');
  if (numEl) numEl.textContent = Math.round(_zoomLevel * 100) + '%';
}

/* ── 팬(이동) 상태 ── */

/* ══════════════════════════════════════════
   마퀴 셀렉션 — 빈 캔버스 드래그 다중선택
══════════════════════════════════════════ */
function _drawMarqueeRect(x1, y1, x2, y2) {
  var pad = document.getElementById('sheet-pad');
  if (!pad) return;
  var rect = document.getElementById('marquee-select');
  if (!rect) {
    rect = document.createElement('div');
    rect.id = 'marquee-select';
    rect.className = 'marquee-select';
    pad.appendChild(rect);
  }
  rect.style.left   = Math.min(x1, x2) + 'px';
  rect.style.top    = Math.min(y1, y2) + 'px';
  rect.style.width  = Math.abs(x2 - x1) + 'px';
  rect.style.height = Math.abs(y2 - y1) + 'px';
}

function _removeMarqueeRect() {
  var rect = document.getElementById('marquee-select');
  if (rect) rect.remove();
}

function _rectsOverlap(r1, r2) {
  return r1.x < r2.x + r2.w && r1.x + r1.w > r2.x &&
         r1.y < r2.y + r2.h && r1.y + r1.h > r2.y;
}

function _applyMarqueeSelection(x1, y1, x2, y2) {
  var rect = { x: Math.min(x1, x2), y: Math.min(y1, y2), w: Math.abs(x2 - x1), h: Math.abs(y2 - y1) };
  var hits = blocks
    .filter(function(b) { return _rectsOverlap(rect, { x: b.x, y: b.y, w: b.w, h: b.h }); })
    .map(function(b) { return b.id; });
  if (selectedGi !== null) { selectedGi = null; hideGroupToolbar(); }
  if (hits.length) deselectSticker();

  selKeys = hits;
  selKey = hits.length ? hits[hits.length - 1] : null;
  document.querySelectorAll('.blk').forEach(function(el) {
    var k = el.dataset.key;
    var bdata = getBlkByKey(k);
    if (!bdata) return;
    if (hits.indexOf(k) !== -1) {
      el.classList.add('selected');
      el.style.outline = '2.0px solid var(--accent)';
      el.style.outlineOffset = '3px';
      el.style.boxShadow = _blkSelBoxShadow(bdata);
    } else {
      el.classList.remove('selected');
      el.style.outline = '';
      el.style.outlineOffset = '';
      el.style.boxShadow = _blkNormalBoxShadow(bdata);
    }
  });
  hideTxtFormatBar();
  if (hits.length >= 2) showAlignToolbar(); else hideAlignToolbar();
}

/* 줌/팬 이벤트 초기화 — DOMContentLoaded 후 호출 */
function initZoomPan() {
  var area = document.getElementById('canvas-area');
  if (!area) return;

  /* ── 휠 줌 ── */
  area.addEventListener('wheel', function(e) {
    /* 패널/스티커 위에서는 무시 */
    if (e.target.closest('#edit-panel, .float-tabs, .float-pill, .float-save, .combo-pill')) return;
    /* 이미지 편집 모드 중에는 캔버스 줌 무시 — 오버레이 휠이 처리 */
    if (activeImgKey || activeHdrImgKind) return;
    e.preventDefault();

    var rect  = area.getBoundingClientRect();
    var px    = e.clientX - rect.left;
    var py    = e.clientY - rect.top;
    /* trackpad pinch: ctrlKey / 일반 휠: deltaY */
    var delta = e.ctrlKey
      ? -e.deltaY * 0.005
      : -e.deltaY * 0.001;
    delta = Math.max(-0.3, Math.min(0.3, delta));
    _zoomAtPoint(px, py, delta);
  }, { passive: false });

  /* ── 팬: Space + 드래그 ── */
  document.addEventListener('keydown', function(e) {
    if (e.code === 'Space' && !isEditing && !e.target.closest('input, textarea, [contenteditable]')) {
      if (!_spaceDown) {
        _spaceDown = true;
        area.classList.add('panning');
      }
      e.preventDefault();
    }
  });
  document.addEventListener('keyup', function(e) {
    if (e.code === 'Space') {
      _spaceDown = false;
      if (!_isPanning) area.classList.remove('panning');
    }
  });

  area.addEventListener('mousedown', function(e) {
    /* Space + 좌클릭 OR 미들클릭 */
    if ((_spaceDown && e.button === 0) || e.button === 1) {
      e.preventDefault();
      _isPanning    = true;
      _panStartX    = e.clientX;
      _panStartY    = e.clientY;
      _panStartOffX = _panX;
      _panStartOffY = _panY;
      area.classList.add('panning');
      return;
    }
    /* 빈 영역 좌클릭 드래그 → 마퀴 셀렉션 시작 */
    if (e.button === 0 && !isEditing && !activeImgKey &&
        !e.target.closest('.blk, .sticker-item, .canvas-resize-handle, .sheet-header-block, #txt-format-bar, #sticker-float-bar, #blk-popup')) {
      /* preventDefault 없으면 드래그가 브라우저 네이티브 텍스트 선택으로 처리돼
         블록 내부 텍스트(안내문 포함)가 영역과 무관하게 통째로 긁힘 */
      e.preventDefault();
      document.body.style.userSelect = 'none';
      /* sheet-pad(position:relative)가 블록의 실제 포지셔닝 기준점 — 헤더가 있으면
         canvas-stage보다 아래로 밀려 있으므로 반드시 sheet-pad 기준으로 환산해야 함 */
      var stageEl0 = document.getElementById('sheet-pad');
      var sr0 = stageEl0 ? stageEl0.getBoundingClientRect() : { left: 0, top: 0 };
      _marqueeDrag = {
        startX: (e.clientX - sr0.left) / _zoomLevel,
        startY: (e.clientY - sr0.top)  / _zoomLevel,
        didMove: false
      };
    }
  });

  document.addEventListener('mousemove', function(e) {
    if (_isPanning) {
      _panX = _panStartOffX + (e.clientX - _panStartX);
      _panY = _panStartOffY + (e.clientY - _panStartY);
      _applyStageTransform();
      return;
    }
    if (_marqueeDrag) {
      var stageEl1 = document.getElementById('sheet-pad');
      var sr1 = stageEl1 ? stageEl1.getBoundingClientRect() : { left: 0, top: 0 };
      var curX = (e.clientX - sr1.left) / _zoomLevel;
      var curY = (e.clientY - sr1.top)  / _zoomLevel;
      if (!_marqueeDrag.didMove &&
          (Math.abs(curX - _marqueeDrag.startX) > 3 || Math.abs(curY - _marqueeDrag.startY) > 3)) {
        _marqueeDrag.didMove = true;
      }
      if (_marqueeDrag.didMove) {
        _drawMarqueeRect(_marqueeDrag.startX, _marqueeDrag.startY, curX, curY);
        /* 드래그 중 실시간으로 겹치는 블록을 선택 표시 — 손을 떼야 표시되던 것을 개선 */
        _applyMarqueeSelection(_marqueeDrag.startX, _marqueeDrag.startY, curX, curY);
      }
    }
  });

  document.addEventListener('mouseup', function(e) {
    if (_isPanning) {
      _isPanning = false;
      if (!_spaceDown) area.classList.remove('panning');
      return;
    }
    if (_marqueeDrag) {
      if (_marqueeDrag.didMove) {
        var stageEl2 = document.getElementById('sheet-pad');
        var sr2 = stageEl2 ? stageEl2.getBoundingClientRect() : { left: 0, top: 0 };
        var endX = (e.clientX - sr2.left) / _zoomLevel;
        var endY = (e.clientY - sr2.top)  / _zoomLevel;
        _applyMarqueeSelection(_marqueeDrag.startX, _marqueeDrag.startY, endX, endY);
        if (selKeys.length) _justFinishedMarquee = true;
      }
      _removeMarqueeRect();
      _marqueeDrag = null;
      document.body.style.userSelect = '';
    }
  });

  /* 미들클릭 기본 스크롤 방지 */
  area.addEventListener('auxclick', function(e) {
    if (e.button === 1) e.preventDefault();
  });

  /* 초기 transform 적용 */
  _applyStageTransform();
}

/* ══════════════════════════════════════════
   Proximity scale — float-tabs / float-pill
   커서가 가까워질수록 인접 버튼이 부드럽게 커짐
══════════════════════════════════════════ */
function _initProximity(containerEl, selector, maxScale, radius) {
  if (!containerEl) return;
  var els = Array.from(containerEl.querySelectorAll(selector));
  if (!els.length) return;

  containerEl.addEventListener('pointermove', function(e) {
    els.forEach(function(el) {
      /* active 탭은 proximity 제외 — flex-grow 애니메이션과 충돌 방지 */
      if (el.classList.contains('active')) {
        el.style.scale = '';
        return;
      }
      var r = el.getBoundingClientRect();
      var cx = r.left + r.width  / 2;
      var cy = r.top  + r.height / 2;
      var dist = Math.sqrt(Math.pow(e.clientX - cx, 2) + Math.pow(e.clientY - cy, 2));
      var t = Math.max(0, 1 - dist / radius);
      el.style.scale = String(1 + t * (maxScale - 1));
    });
  });

  containerEl.addEventListener('pointerleave', function() {
    els.forEach(function(el) {
      el.style.scale = '';
    });
  });
}

/* ══════════════════════════════════════════
   네비 전환
══════════════════════════════════════════ */
function switchNav(tab) {
  /* A안: 탭 클릭 시 블록 선택 해제 */
  if (selKey) {
    var prevBlk = getSelBlk();
    if (prevBlk && prevBlk.type === 'colorchip') prevBlk._activeChipId = null;
    selKey = null;
    document.querySelectorAll('.blk').forEach(function(el) {
      el.style.outline = ''; el.style.outlineOffset = '';
      el.classList.remove('selected');
    });
    if (activeImgKey) exitImgEditMode();
    hideTxtFormatBar();
  }
  /* 컬러칩 active 칩 표시 정리 */
  document.querySelectorAll('.cc-chip.active').forEach(function(chipEl) {
    chipEl.classList.remove('active');
  });
  /* panel-block 닫기 */
  var pb = document.getElementById('panel-block');
  if (pb) pb.classList.remove('active');

  var tabs = ['canvas','sticker','bg','header','preset','tools'];
  tabs.forEach(function(t) {
    var btn = document.getElementById('nb-' + t);
    if (btn) btn.classList.toggle('active', t === tab);
  });
  /* 패널 뷰 전환 */
  ['panel-preset','panel-canvas','panel-header-nav','panel-bg','panel-tools','panel-sticker'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.classList.remove('active');
  });
  if (tab === 'preset')  { var el = document.getElementById('panel-preset');     if (el) el.classList.add('active'); }
  if (tab === 'canvas')  { var el = document.getElementById('panel-canvas');     if (el) el.classList.add('active'); }
  if (tab === 'header')  {
    var el = document.getElementById('panel-header-nav'); if (el) el.classList.add('active');
    /* 헤더 없을 때 기본값 자동 적용 */
    if (headerPos === null) toggleHeader('top');
  }
  if (tab === 'bg')      {
    var el = document.getElementById('panel-bg'); if (el) el.classList.add('active');
    syncBgLayerPanel();
  }
  if (tab === 'tools')   { var el = document.getElementById('panel-tools');      if (el) el.classList.add('active'); }
  if (tab === 'sticker') {
    var el = document.getElementById('panel-sticker');
    if (el) el.classList.add('active');
  }
}

/* ══════════════════════════════════════════
   시트 너비 슬라이더
══════════════════════════════════════════ */
function updateCanvasWidth(val) {
  if (!_pendingHistorySave) { saveHistory(); _pendingHistorySave = true; }
  val = Math.min(1400, Math.max(400, parseInt(val) || 800));
  _setStageWidth(val, 'center');
  _updateSliderUI('sl-canvas-w', val);
  var snW = document.getElementById('sn-canvas-w');
  if (snW) snW.value = val;
  render();
}

/* ══════════════════════════════════════════
   캔버스 리사이즈 핸들
══════════════════════════════════════════ */
function initResizeHandles() {
  var stage = document.getElementById('canvas-stage');
  if (!stage) return;
  ['left','right','top','bottom'].forEach(function(side) {
    var h = document.createElement('div');
    h.id = 'canvas-handle-' + side;
    h.className = 'canvas-resize-handle handle-' + side;
    h.addEventListener('mousedown', function(e) {
      e.stopPropagation();
      e.preventDefault();
      saveHistory();
      if (side === 'left' || side === 'right') {
        cwDrag = { prevX: e.clientX, side: side };
      } else {
        chDrag = { prevY: e.clientY, side: side };
      }
      document.body.style.userSelect = 'none';
    });
    stage.appendChild(h);
  });
  updateResizeHandles();
}

function updateResizeHandles() {
  var sheetEl = document.getElementById('sheet');
  if (!sheetEl) return;
  var sheetH = sheetEl.offsetHeight;
  var midY   = sheetH / 2;
  var midX   = canvasW / 2;
  var OFF    = 10; /* 시트로부터 핸들까지 거리 */
  var HL     = 44; /* 핸들 길이 */
  var HT     = 8;  /* 핸들 두께 */

  var hl = document.getElementById('canvas-handle-left');
  var hr = document.getElementById('canvas-handle-right');
  var ht = document.getElementById('canvas-handle-top');
  var hb = document.getElementById('canvas-handle-bottom');

  if (hl) { hl.style.top = (midY - HL/2) + 'px'; hl.style.left = (-OFF - HT) + 'px'; }
  if (hr) { hr.style.top = (midY - HL/2) + 'px'; hr.style.left = (canvasW + OFF) + 'px'; }
  if (ht) { ht.style.left = (midX - HL/2) + 'px'; ht.style.top = (-OFF - HT) + 'px'; }
  if (hb) { hb.style.left = (midX - HL/2) + 'px'; hb.style.top = (sheetH + OFF) + 'px'; }
}

function _syncCanvasLeft() {
  /* canvasExtraTop / autoCanvasH()와 대칭 — 좌측 핸들 확장 시 콘텐츠 화면위치 고정 */
  var padEl = document.getElementById('sheet-pad');
  if (padEl) padEl.style.marginLeft = canvasExtraLeft + 'px';
  var stickerLayerEl = document.getElementById('sticker-layer');
  if (stickerLayerEl) stickerLayerEl.style.left = canvasExtraLeft + 'px';
  if (typeof _syncBgOverlayBounds === 'function') _syncBgOverlayBounds();
}

/* ══════════════════════════════════════════
   시트 너비(canvasW) + 화면 위치(marginLeft) 통일 적용
   canvasW를 바꾸는 모든 곳(핸들 드래그/슬라이더/블록 자동확장/그룹복제/슬롯복원/초기화)이
   이 함수 하나만 거치도록 통일 — 곳곳에 흩어진 "-canvasW/2 재중앙" 중복을 없애 한 경로만
   고치고 다른 경로가 남아 재발하는 문제(2026-06-22, 좌측 핸들 버그 재발 원인)를 방지.

   anchor:
     'left'   — 좌측 화면 경계 고정(우측만 늘어남) — 우측 핸들 단독 드래그
     'right'  — 우측 화면 경계 고정(좌측만 늘어남) — 좌측 핸들 단독 드래그
     'center' — 항상 자기 중심으로 재배치 — 그 외 전부(대칭 리사이즈, 슬라이더, 블록 자동
                확장, 그룹복제, 슬롯복원/초기화) — 기존 동작 그대로 보존
══════════════════════════════════════════ */
function _setStageWidth(newW, anchor) {
  var stageEl = document.getElementById('canvas-stage');
  var padEl   = document.getElementById('sheet-pad');
  var oldW = canvasW;
  canvasW = newW;
  if (stageEl) {
    stageEl.style.width = newW + 'px';
    if (anchor === 'right') {
      /* 좌측 핸들: 우측 경계 고정 + 콘텐츠 반대방향 상쇄 → 콘텐츠 화면위치 불변
         canvas-stage가 delta만큼 왼쪽으로 이동하는 동시에 sheet-pad가 delta만큼 오른쪽으로 이동
         → 블록/스티커는 화면 기준 제자리, 캔버스 좌측 경계만 확장 */
      var delta = newW - oldW;
      canvasExtraLeft = Math.max(0, canvasExtraLeft + delta);
      if (_stageML === null) _stageML = -(oldW / 2);
      _stageML -= delta;
      stageEl.style.marginLeft = _stageML + 'px';
      _syncCanvasLeft();
    } else if (anchor === 'left') {
      /* 우측 핸들: 좌측 경계 고정, marginLeft/canvasExtraLeft 불변 */
      if (_stageML === null) _stageML = -(oldW / 2);
    } else {
      /* center: 슬라이더·슬롯복원·초기화 등 → canvasExtraLeft 리셋 */
      canvasExtraLeft = 0;
      _stageML = -(newW / 2);
      stageEl.style.marginLeft = _stageML + 'px';
      _syncCanvasLeft();
    }
  }
  if (padEl) padEl.style.width = newW + 'px';
}

/* ══════════════════════════════════════════
   캔버스 확장 공통 처리
   left/right: 늘어날 px (양수=확장, 음수=축소)
   top: canvasExtraTop 조정량 (F-17 — 블록·스티커 데이터는 안 건드림)
   bottom: canvasH 조정량
══════════════════════════════════════════ */
function _applyCanvasExpand(left, right, top, bottom) {
  /* ── 좌/우 ── */
  if (left !== 0 || right !== 0) {
    var requestedW = canvasW + left + right;
    /* 축소 브레이크: 블록·스티커 우측 끝보다 더 줄어들지 않도록.
       우측 핸들 단독·좌측 핸들 단독(0620_2: 좌측도 블록 고정 요구) 모두 동일하게 적용 —
       블록을 안 움직이는 한 "콘텐츠 우측 끝" 기준 브레이크가 좌/우 어느 쪽이든 그대로 유효함 */
    if (requestedW < canvasW) {
      if (left < 0 && right === 0) {
        /* 좌핸들 단독 축소:
           ① canvasExtraLeft (핸들로 직접 확장한 여분)
           ② 최좌단 블록 ~ gaps.pad (블록 드래그 자동확장으로 생긴 좌측 빈 공간)
           두 범위 합산까지 허용 — Phase 2에서 ②만큼 블록을 왼쪽으로 이동해 화면 위치 유지 */
        var _minBX = Infinity;
        blocks.forEach(function(b) { if (b.x < _minBX) _minBX = b.x; });
        stickers.forEach(function(s) { if (s.x < _minBX) _minBX = s.x; });
        if (_minBX === Infinity) _minBX = gaps.pad;
        var _shrinkFromBlocks = Math.max(0, _minBX - gaps.pad);
        requestedW = Math.max(requestedW, canvasW - canvasExtraLeft - _shrinkFromBlocks);
      } else {
        var minNeededW = gaps.pad * 2;
        blocks.forEach(function(b) {
          var re = b.x + b.w + gaps.pad;
          if (re > minNeededW) minNeededW = re;
        });
        stickers.forEach(function(s) {
          var re = s.x + (s.size || 0) + gaps.pad;
          if (re > minNeededW) minNeededW = re;
        });
        requestedW = Math.max(requestedW, minNeededW);
      }
    }
    var newW = Math.round(Math.min(1400, Math.max(400, requestedW)));
    var actual = newW - canvasW;
    if (actual !== 0) {
      /* 좌측 핸들 단독 조작은 우측 핸들과 완전히 동일하게 — 블록을 전혀 이동시키지 않고
         canvasW만 조정(0620_2 재확인: "블록이 안 움직이는 것처럼" 보여야 함 — 늘릴 때 좌측에
         여백이 생기는 기존 효과는 포기). Shift/Alt 좌우 동시 조작(대칭 리사이즈)은 기존 그대로
         블록을 부분 이동시키는 동작 유지(이번 범위 제외) */
      var actualLeft = (left !== 0 && right !== 0)
        ? Math.round(actual * left / (left + right))
        : 0;
      if (actualLeft !== 0) {
        /* 좌측 축소 브레이크: 블록·스티커가 x=0 미만으로 이동하지 않도록 */
        var minX = Infinity;
        blocks.forEach(function(b) { if (b.x < minX) minX = b.x; });
        stickers.forEach(function(s) { if (s.x < minX) minX = s.x; });
        var safeL = Math.max(-(minX === Infinity ? 0 : minX), actualLeft);
        blocks.forEach(function(b) {
          b.x += safeL;
          var el = document.querySelector('.blk[data-key="' + b.id + '"]');
          if (el) el.style.left = b.x + 'px';
        });
        stickers.forEach(function(s) {
          s.x += safeL;
          var sEl = document.getElementById('sticker-' + s.id);
          if (sEl) sEl.style.left = s.x + 'px';
        });
      }
      /* 핸들별로 "잡지 않은 반대쪽 화면 경계"가 고정되도록 — 좌측 단독은 우측 경계 고정,
         우측 단독은 좌측 경계 고정, Shift·Alt 대칭 리사이즈(actualLeft!==0, 블록 일부 이동)는
         재중앙(_setStageWidth 공용 헬퍼 — 모든 canvasW 변경 경로가 이 함수 하나만 거치도록
         통일, 2026-06-22 좌측 핸들 버그 재발 원인 수정) */
      var _isLeftOnly = (left < 0 && right === 0);
      var _extraBefore = _isLeftOnly ? canvasExtraLeft : 0;
      var _anchor = actualLeft !== 0 ? 'center' : (left !== 0 ? 'right' : 'left');
      _setStageWidth(newW, _anchor);
      /* Phase 2: 좌핸들 단독 축소에서 canvasExtraLeft 소진 후 남은 축소량 → 블록을 왼쪽으로 이동.
         canvas-stage는 오른쪽으로 이동(anchor='right')하고 블록도 같은 양만큼 왼쪽으로 이동 →
         블록의 화면 위치 유지됨 */
      if (_isLeftOnly && actual < 0) {
        var _phase2 = Math.max(0, -actual - _extraBefore);
        if (_phase2 > 0) {
          blocks.forEach(function(b) {
            b.x -= _phase2;
            var bEl = document.querySelector('.blk[data-key="' + b.id + '"]');
            if (bEl) bEl.style.left = b.x + 'px';
          });
        }
      }
    }
  }

  /* ── 상단: canvasExtraTop — 블록·스티커 데이터는 건드리지 않고 여백 변수만 조정
     (좌/우/하단 canvasW/canvasH 모델과 동일, F-17) ── */
  if (top !== 0) {
    var minY = Infinity;
    blocks.forEach(function(b) { if (b.y < minY) minY = b.y; });
    stickers.forEach(function(s) { if (s.y < minY) minY = s.y; });
    if (minY === Infinity) minY = 0;
    /* 확장(top>0): 헤더 높이만큼 위로 허용 / 축소(top<0): 블록 끝 + gaps.pad까지만 허용
       (좌/우/하단과 동일한 여백 기준으로 통일 — 0620_2: 핸들마다 정지 패딩이 다르던 문제.
       헤더 겹침 허용은 F-17 통일 후에도 그대로 유지).
       블록이 더 이상 이동하지 않으므로(F-17) minY는 매 호출 고정값 — "유효 상단 여백"은
       canvasExtraTop + minY로 계산해 그 값이 _yFloor 밑으로 내려가지 않게 막는다 */
    var _yFloor = top > 0 ? -getHeaderH() : gaps.pad;
    var _newExtraTop = Math.max(canvasExtraTop + top, _yFloor - minY);
    /* 축소 시 배경지(모눈종이 등)가 헤더 영역을 침범하지 않도록 — pad가 헤더 경계 위로
       올라가는 걸 막는 별도 바닥값. round 헤더는 디자인상 정해진 만큼(roundOverlap)만
       겹침 허용, 그 외(basic/sns)는 전혀 겹치지 않게(0) — 블록 위치(minY)와 무관하게
       항상 적용돼야 하므로 위 블록 기준 바닥과 별개로 한 번 더 클램프 */
    if (top < 0 && headerPos === 'top') {
      var _headerOverlapFloor = (headerData.type === 'round')
        ? -(headerData.roundOverlap !== undefined ? headerData.roundOverlap : 24)
        : 0;
      _newExtraTop = Math.max(_newExtraTop, _headerOverlapFloor);
    }
    canvasExtraTop = _newExtraTop;
  }

  /* ── 하단: canvasH — 블록·스티커 하단이 잘리지 않도록 브레이크 (canvasW 모델과 대칭) ── */
  if (bottom !== 0) {
    var minNeededH = gaps.pad;
    blocks.forEach(function(b) {
      var be = b.y + b.h + gaps.pad;
      if (be > minNeededH) minNeededH = be;
    });
    stickers.forEach(function(s) {
      var se = s.y + (s.size || 0) + gaps.pad;
      if (se > minNeededH) minNeededH = se;
    });
    canvasH = Math.max(minNeededH, canvasH + bottom);
  }

  autoCanvasH();
}

/* ══════════════════════════════════════════
   간격 슬라이더
══════════════════════════════════════════ */
/* 상하좌우 여백 균등화 — 블록 bounding box 기준으로 네 방향 여백을 동일하게 재배치 */
function equalizeBlockMargins() {
  if (blocks.length === 0) return;
  var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  blocks.forEach(function(b) {
    if (b.x < minX) minX = b.x;
    if (b.y < minY) minY = b.y;
    if (b.x + b.w > maxX) maxX = b.x + b.w;
    if (b.y + b.h > maxY) maxY = b.y + b.h;
  });
  var totalW = canvasW;
  var contentW = maxX - minX;
  var contentH = maxY - minY;
  var hPad = Math.max(0, Math.round((totalW - contentW) / 2));
  var dx = hPad - minX;
  var dy = hPad - minY;
  if (dx !== 0 || dy !== 0) {
    blocks.forEach(function(b) { b.x += dx; b.y += dy; });
  }
  render();
  showToast('여백을 균등하게 정렬했습니다');
}

function updateGap(key, val) {
  val = Math.max(0, parseInt(val) || 0);
  if (!_pendingHistorySave) { saveHistory(); _pendingHistorySave = true; }
  gaps[key] = val;
  _updateSliderUI('sl-' + key, val);
  var sn = document.getElementById('sn-' + key);
  if (sn) sn.value = val;
  applyGaps();
  updateSizeInfo();
}

function applyGaps() {
  /* pad만 유지 — col/blk/grp 제거됨 */
  var pad = document.getElementById('sheet-pad');
  if (pad) pad.style.padding = gaps.pad + 'px';
}

/* ══════════════════════════════════════════
   일괄 컨트롤러
══════════════════════════════════════════ */
/* radius 변경 시 txt 블록 높이를 새 패딩 기준으로 재조정 */
function adjustTextBlkHeights(newRadius) {
  blocks.forEach(function(blk) {
    if (blk.type !== 'txt') return;
    var r = (blk.radius !== null && blk.radius !== undefined) ? blk.radius : newRadius;
    var pad = r >= 999 ? 40 : Math.max(8, Math.round(Math.min(r, 32) * 0.5 + 8));
    var padTotal = pad * 2;
    var el = document.querySelector('.blk[data-key="' + blk.id + '"]');
    if (!el) return;
    var ta = el.querySelector('.blk-text-area');
    if (!ta) return;
    var lineH = parseFloat(window.getComputedStyle(ta).lineHeight) || 20;
    var lns = (ta.textContent || '').split('\n').length || 1;
    var minH  = Math.max(40, Math.ceil(lineH * lns) + padTotal);
    if (blk.h < minH) blk.h = minH;
  });
  /* colorchip 블록 최소 높이 보정 */
  blocks.forEach(function(blk) {
    if (blk.type !== 'colorchip') return;
    var minH = _ccMinH(blk);
    if (blk.h < minH) blk.h = minH;
  });
}

/* radius 변경 직후 — render()로 새 패딩/라운딩이 DOM에 반영된 뒤, 실측(scrollHeight) 기반
   자동확장(_ccAutoExpand/_itemAutoExpand)으로 한 번 더 보정. adjustTextBlkHeights()의
   사전 계산(렌더 전 추정치)만으로는 박스 크기 대비 라운딩이 과대한 경우(원형 등) 패딩이
   커진 만큼 콘텐츠 영역이 줄어드는 걸 못 따라잡을 수 있어 사후 보정 한 단계를 추가 */
function _autoExpandAfterRadiusChange(targetBlk) {
  var changed = false;
  var list = targetBlk ? [targetBlk] : blocks;
  list.forEach(function(b) {
    if (b.type === 'colorchip') { if (_ccAutoExpand(b, b.id)) changed = true; }
    else if (b.type === 'item') { if (_itemAutoExpand(b, b.id)) changed = true; }
  });
  if (changed) render();
}

function updateGlobal(key, val) {
  if (!_pendingHistorySave) { saveHistory(); _pendingHistorySave = true; }
  if (key === 'radius' || key === 'shadow' || key === 'opacity') val = parseInt(val) || 0;
  globalVals[key] = val;
  /* 슬라이더 양방향 동기화 */
  _updateSliderUI('sl-' + key, val);
  var sn = document.getElementById('sn-' + key);
  if (sn) sn.value = val;
  /* radius 변경 시 txt 블록 높이 재조정 후 render */
  if (key === 'radius') adjustTextBlkHeights(val);
  render();
  if (key === 'radius') _autoExpandAfterRadiusChange(null);
}

/* 전체 폰트 크기 배율 슬라이더 */
/* 컬러칩 블록 전용 — 콘텐츠 크기·간격 배율(%) 전역 슬라이더
   시트 내 모든 컬러칩 블록에 동시 적용. 다중행으로 줄바꿈된 블록이 있으면 자동 확장 후 재렌더 */
function updateCcScale(key, val) {
  var blk = getSelBlk();
  if (!blk || blk.type !== 'colorchip') return;
  if (!_pendingHistorySave) { saveHistory(); _pendingHistorySave = true; }
  val = Math.min(160, Math.max(60, parseInt(val) || 100));
  blk[key] = val;
  var idMap = { ccSizeScale: ['bp-cc-sl-size','bp-cc-sn-size'], ccGapScale: ['bp-cc-sl-gap','bp-cc-sn-gap'], ccFontScale: ['bp-cc-sl-font','bp-cc-sn-font'] };
  var ids = idMap[key] || idMap.ccSizeScale;
  _updateSliderUI(ids[0], val);
  var sn = document.getElementById(ids[1]);
  if (sn) sn.value = val;
  render();
  if (_ccAutoExpand(blk, blk.id)) render();
}

/* 항목 블록 전용 — 개별 블록 크기·간격 배율(%) 슬라이더 */
function updateItemScale(key, val) {
  var blk = getSelBlk();
  if (!blk || blk.type !== 'item') return;
  if (!_pendingHistorySave) { saveHistory(); _pendingHistorySave = true; }
  val = Math.min(160, Math.max(60, parseInt(val) || 100));
  blk[key] = val;
  /* 해당 블록 요소에만 CSS 변수 설정 */
  var blkEl = document.querySelector('.blk[data-key="' + selKey + '"]');
  if (blkEl) {
    blkEl.style.setProperty('--item-size-scale', (blk.itemSizeScale || 100) / 100);
    blkEl.style.setProperty('--item-gap-scale',  (blk.itemGapScale  || 100) / 100);
  }
  var sliderId = key === 'itemSizeScale' ? 'bp-item-sl-size' : 'bp-item-sl-gap';
  var numId    = key === 'itemSizeScale' ? 'bp-item-sn-size' : 'bp-item-sn-gap';
  _updateSliderUI(sliderId, val);
  var sn = document.getElementById(numId);
  if (sn) sn.value = val;
  _applyItemSize(blk);
  render();
  if (_itemAutoExpand(blk, blk.id)) render();
}

function updateCanvasBg(val) {
  if (!_pendingHistorySave) { saveHistory(); _pendingHistorySave = true; }
  sheetBg = val;
  document.getElementById('sheet').style.background = val;
}

function updateSheetRadius(val) {
  if (!_pendingHistorySave) { saveHistory(); _pendingHistorySave = true; }
  sheetRadius = parseInt(val) || 0;
  var r = sheetRadius;
  /* 슬라이더 동기화 */
  _updateSliderUI('sl-sheet-r', r);
  var sn = document.getElementById('sn-sheet-r');
  if (sn) sn.value = r;
  /* .sheet 라운딩 */
  var sheet = document.getElementById('sheet');
  if (sheet) sheet.style.borderRadius = r + 'px';
  /* 헤더 슬롯 라운딩 — 헤더 있을 때만 연동 */
  var topSlot = document.getElementById('hdr-top-slot');
  var botSlot = document.getElementById('hdr-bot-slot');
  if (topSlot && topSlot.classList.contains('visible')) {
    topSlot.style.borderRadius = r + 'px ' + r + 'px 0 0';
  }
  if (botSlot && botSlot.classList.contains('visible')) {
    botSlot.style.borderRadius = '0 0 ' + r + 'px ' + r + 'px';
  }
  /* sheet-pad 라운딩 — 항상 동기화 (bgl-overlay가 border-radius:inherit로 상속함) */
  var pad = document.getElementById('sheet-pad');
  if (pad) pad.style.borderRadius = r + 'px';
}

function togglePngMargin() {
  pngMargin = !pngMargin;
  var sw = document.getElementById('png-margin-sw');
  if (sw) sw.classList.toggle('on', pngMargin);
}

function toggleSnap() {
  snapEnabled = !snapEnabled;
  var sw = document.getElementById('snap-sw');
  if (sw) sw.classList.toggle('on', snapEnabled);
  var snapTile = document.getElementById('snap-tile');
  if (snapTile) snapTile.classList.toggle('on', snapEnabled);
  var snapLbl = document.getElementById('snap-tile-lbl');
  if (snapLbl) snapLbl.textContent = '스냅 정렬 ' + (snapEnabled ? '켜짐' : '꺼짐');
}

function updatePngBg(val) {
  pngBg = val;
  var swatch = document.getElementById('png-bg-swatch');
  var hex    = document.getElementById('png-bg-hex');
  if (swatch) swatch.style.background = val;
  if (hex) { if (hex.tagName === 'INPUT') hex.value = val.toUpperCase(); else hex.textContent = val.toUpperCase(); }
  /* 프리뷰 캔버스 배경 실시간 반영 */
  var canvasArea = document.getElementById('canvas-area');
  if (canvasArea) canvasArea.style.background = val;
}


function syncSlider(key, val) {
  /* 양방향 동기화 */
  var prop = key.replace('bp-', '');  /* 'radius' | 'shadow' | 'opacity' */
  if (prop !== 'opacity') val = Math.max(0, parseInt(val) || 0);
  else val = Math.min(100, Math.max(0, parseInt(val) || 0));
  var sl = document.getElementById('bp-sl-' + prop);
  var sn = document.getElementById('bp-sn-' + prop);
  _updateSliderUI('bp-sl-' + prop, val);
  if (sn) sn.value = val;
  /* 선택된 블록 데이터 업데이트 */
  if (!selKey) return;
  var blk = getSelBlk();
  if (!blk) return;
  blk[prop] = val;
  /* radius 변경 시 해당 블록 높이 재조정 후 render */
  if (prop === 'radius') adjustTextBlkHeights(globalVals.radius);
  render();
  if (prop === 'radius') _autoExpandAfterRadiusChange(blk);
}

/* ── 패널 타일 전용 동기화 함수 ── */

function toggleBpAdv() {
  var adv  = document.getElementById('bp-adv');
  var body = document.getElementById('bp-adv-body');
  if (!adv || !body) return;
  adv.classList.toggle('open');
  body.style.display = adv.classList.contains('open') ? '' : 'none';
}


function toggleCanvasAdv() {
  var adv  = document.getElementById('canvas-adv');
  var body = document.getElementById('canvas-adv-body');
  if (!adv || !body) return;
  adv.classList.toggle('open');
  body.style.display = adv.classList.contains('open') ? '' : 'none';
}

/* 세부 조정 패널의 시트 모서리 슬라이더 — 타일 on 상태도 동기화 */
function updateSheetRadiusAdv(val) {
  val = Math.min(40, Math.max(0, parseInt(val) || 0));
  updateSheetRadius(val);
  _updateSliderUI('sl-sheet-r-adv', val);
  var sn = document.getElementById('sn-sheet-r-adv');
  if (sn) sn.value = val;
  /* 타일 on 동기화 */
  var tileVals = [0, 6, 14, 28];
  var tiles = document.querySelectorAll('#canvas-radius-tiles .tile');
  tiles.forEach(function(t, i) { t.classList.toggle('on', tileVals[i] === val); });
}

function _setTileActive(containerId, activeIdx) {
  var cont = document.getElementById(containerId);
  if (!cont) return;
  cont.querySelectorAll('.tile').forEach(function(t, i) {
    t.classList.toggle('on', i === activeIdx);
  });
}

function _updateSegState(segId, pillId, btnIds, activeId) {
  var idx = btnIds.indexOf(activeId);
  if (idx < 0) idx = 0;
  var n = btnIds.length;
  var pill = document.getElementById(pillId);
  if (pill) {
    pill.style.left  = 'calc(3px + ' + idx + ' * ((100% - 6px) / ' + n + '))';
    pill.style.width = 'calc((100% - 6px) / ' + n + ')';
  }
  btnIds.forEach(function(id) {
    var btn = document.getElementById(id);
    if (btn) btn.classList.toggle('on', id === activeId);
  });
}

function syncBlkRadius(v) {
  if (!selKey) return;
  var blk = getSelBlk(); if (!blk) return;
  if (!_pendingHistorySave) { saveHistory(); _pendingHistorySave = true; }
  blk.radius = v;
  var idx = [0,8,16,999].indexOf(v >= 999 ? 999 : (v >= 16 ? 16 : (v >= 8 ? 8 : 0)));
  _setTileActive('bp-radius-tiles', idx < 0 ? -1 : idx);
  var rv = v >= 999 ? 32 : v;
  ['bp-sl-radius','bp-sn-radius'].forEach(function(id){ var el=document.getElementById(id); if(el) el.value=rv; });
  _updateSliderUI('bp-sl-radius', rv);
  render();
}

function syncBlkShadow(v) {
  if (!selKey) return;
  var blk = getSelBlk(); if (!blk) return;
  if (!_pendingHistorySave) { saveHistory(); _pendingHistorySave = true; }
  blk.shadow = v;
  _setTileActive('bp-shadow-tiles', v);
  ['bp-sl-shadow','bp-sn-shadow'].forEach(function(id){ var el=document.getElementById(id); if(el) el.value=v; });
  _updateSliderUI('bp-sl-shadow', v);
  render();
}

function syncBlkStroke(v) {
  v = Math.min(2, Math.max(0, parseInt(v) || 0));
  if (!selKey) return;
  var blk = getSelBlk(); if (!blk) return;
  if (!_pendingHistorySave) { saveHistory(); _pendingHistorySave = true; }
  blk.stroke = v;
  _setTileActive('bp-stroke-tiles', v);
  ['bp-sl-stroke','bp-sn-stroke'].forEach(function(id){ var el=document.getElementById(id); if(el) el.value=v; });
  render();
}

function syncBlkFontSize(v) {
  if (!selKey) return;
  syncTextStyle('fontSize', v);
}

function syncBlkHAlign(v) {
  if (!selKey) return;
  var blk = getSelBlk(); if (!blk) return;
  if (!_pendingHistorySave) { saveHistory(); _pendingHistorySave = true; }
  blk.textAlign = v;
  var hiddenAl = document.getElementById('bp-align');
  if (hiddenAl) hiddenAl.value = v;
  var lBtn = document.getElementById('bp-halign-left');
  var cBtn = document.getElementById('bp-halign-center');
  if (lBtn) lBtn.classList.toggle('on', v === 'left');
  if (cBtn) cBtn.classList.toggle('on', v === 'center');
  render();
}

function syncBlkVAlign(v) {
  if (!selKey) return;
  var blk = getSelBlk(); if (!blk) return;
  if (!_pendingHistorySave) { saveHistory(); _pendingHistorySave = true; }
  blk.vAlign = v;
  render();
}

function syncBlkAlign9(h, v) {
  if (!selKey) return;
  var blk = getSelBlk(); if (!blk) return;
  if (!_pendingHistorySave) { saveHistory(); _pendingHistorySave = true; }
  if (blk.type === 'txt')            blk.textAlign = h;
  else if (blk.type === 'colorchip') blk.ccAlign   = h;
  else if (blk.type === 'item')      blk.itemAlign  = h;
  blk.vAlign = v;
  render();
  _refreshBpAlign9(blk);
}

function _refreshBpAlign9(blk) {
  if (!blk) return;
  var h = blk.type === 'txt'       ? (blk.textAlign  || 'left')
        : blk.type === 'colorchip' ? (blk.ccAlign    || 'left')
        :                             (blk.itemAlign  || 'left');
  var v = blk.vAlign || 'center';
  var grid = document.getElementById('bp-' + blk.type + '-align9');
  if (!grid) return;
  grid.querySelectorAll('.align9-btn').forEach(function(btn) {
    btn.classList.toggle('on', btn.dataset.h === h && btn.dataset.v === v);
  });
}

function toggleBgRemove() {
  if (!selKey) return;
  var blk = getSelBlk(); if (!blk) return;
  if (blk.opacity === 0) { blk.opacity = 100; }
  else { blk.opacity = 0; blk.shadow = 0; }
  _refreshBpTiles(blk);
  render();
}

function togglePadRemove() {
  if (!selKey) return;
  var blk = getSelBlk(); if (!blk) return;
  var isText = blk.type==='txt'||blk.type==='item'||blk.type==='tag';
  if (!isText) return;
  if (blk.padV === 0) {
    /* 여백 복원 */
    blk.padV = null; /* 자동값(라운딩 연동)으로 복귀 */
    var r0 = (blk.radius !== null && blk.radius !== undefined) ? blk.radius : globalVals.radius;
    var restoredPad = r0 >= 999 ? 40 : Math.max(8, Math.round(Math.min(r0, 32) * 0.5 + 8));
    blk.h = blk.h + restoredPad * 2;
  } else {
    /* 여백 제거 — DOM에서 텍스트 실제 높이 측정 후 딱 맞게 */
    var blkEl = document.querySelector('.blk[data-key="' + blk.id + '"]');
    var ta = blkEl ? blkEl.querySelector('.blk-text-area') : null;
    var curPad = (blk.padV != null ? blk.padV : 8);
    blk.padV = 0;
    if (ta) {
      blk.h = Math.max(28, ta.scrollHeight);
    } else {
      blk.h = Math.max(28, blk.h - curPad * 2);
    }
  }
  _refreshBpTiles(blk);
  var snPadv = document.getElementById('bp-sn-padv');
  if (snPadv) snPadv.value = blk.padV;
  _updateSliderUI('bp-sl-padv', blk.padV);
  render();
}

function _refreshBpTiles(blk) {
  if (!blk) return;
  var rv = (blk.radius!==null&&blk.radius!==undefined)?blk.radius:globalVals.radius;
  var rKey = rv>=999?999:(rv>=16?16:(rv>=8?8:0));
  _setTileActive('bp-radius-tiles', [0,8,16,999].indexOf(rKey));
  var sv = (blk.shadow!==null&&blk.shadow!==undefined)?blk.shadow:globalVals.shadow;
  _setTileActive('bp-shadow-tiles', Math.min(2, sv));
  _setTileActive('bp-stroke-tiles', blk.stroke||0);
  var ts = blk.tstroke || 0;
  ['tfb-ts-0','tfb-ts-1','tfb-ts-2'].forEach(function(id, i) {
    var btn = document.getElementById(id);
    if (btn) btn.classList.toggle('on', i === ts);
  });
  var tsColorBtn = document.getElementById('tfb-ts-color-btn');
  if (tsColorBtn) tsColorBtn.style.display = ts > 0 ? '' : 'none';
  var tscUl = document.getElementById('tfb-ts-color-underline');
  if (tscUl) tscUl.style.background = blk.tstrokeColor || '#ffffff';
  var tscPk = document.getElementById('tfb-ts-color-input');
  if (tscPk) tscPk.value = blk.tstrokeColor || '#ffffff';
  var bgTile = document.getElementById('bp-bg-remove-tile');
  if (bgTile) bgTile.classList.toggle('on', blk.opacity===0);
  var padTile = document.getElementById('bp-pad-remove-tile');
  var isText = blk.type==='txt'||blk.type==='item'||blk.type==='tag';
  if (padTile) {
    padTile.classList.toggle('on', isText && blk.padV === 0);
    padTile.disabled = !isText;
    padTile.style.opacity = isText ? '' : '0.4';
  }
  var ha = blk.textAlign||'left';
  var lBtn = document.getElementById('bp-halign-left');
  var cBtn = document.getElementById('bp-halign-center');
  if (lBtn) lBtn.classList.toggle('on', ha === 'left');
  if (cBtn) cBtn.classList.toggle('on', ha === 'center');
  _refreshBpAlign9(blk);
}

function applyAllStroke(val) {
  val = Math.min(2, Math.max(0, parseInt(val) || 0));
  _setTileActive('canvas-stroke-tiles', val);
  _updateSliderUI('sl-stroke-adv', val);
  var snAdv = document.getElementById('sn-stroke-adv');
  if (snAdv) snAdv.value = val;
  globalVals.stroke = val;
  blocks.forEach(function(b) { b.stroke = val; });
  render();
}

function applyAllStrokeAdv(val) {
  applyAllStroke(val);
}

function syncTstroke(val) {
  val = Math.min(2, Math.max(0, parseInt(val) || 0));
  if (!selKey) return;
  var blk = getSelBlk();
  if (!blk) return;
  if (!_pendingHistorySave) { saveHistory(); _pendingHistorySave = true; }
  /* 편집 중 선택 범위 있으면 선택 부분에만 적용 */
  if (isEditing && _userEnteredEdit) {
    var _ar = (typeof _tfbStickyRange !== 'undefined' && _tfbStickyRange) ||
              (typeof savedTfbRange !== 'undefined' && savedTfbRange);
    if (_ar && !_ar.collapsed) {
      var _bk = savedTfbRange;
      savedTfbRange = _ar;
      applyFormatToRange('tstroke', val);
      savedTfbRange = _bk;
      return;
    }
  }
  /* 블록 전체 적용 (기존 동작) */
  blk.tstroke = val;
  /* 편집 중에는 render()가 차단되므로 DOM에 직접 반영 — 실시간 적용 */
  var blkEl = document.querySelector('.blk[data-key="' + selKey + '"]');
  var texEl = blkEl ? blkEl.querySelector('.blk-text-area') : null;
  if (texEl) texEl.style.textShadow = _textShadowCSS(blk.tstroke, blk.tstrokeColor);
  render();
}

function syncTstrokeColor(val) {
  var ul = document.getElementById('tfb-ts-color-underline');
  if (ul) ul.style.background = val;
  if (!selKey) return;
  var blk = getSelBlk();
  if (!blk) return;
  if (!_pendingHistorySave) { saveHistory(); _pendingHistorySave = true; }
  blk.tstrokeColor = val;
  /* 편집 중에는 render()가 차단되므로 DOM에 직접 반영 — 실시간 적용 */
  var blkEl = document.querySelector('.blk[data-key="' + selKey + '"]');
  var texEl = blkEl ? blkEl.querySelector('.blk-text-area') : null;
  if (texEl) texEl.style.textShadow = _textShadowCSS(blk.tstroke, blk.tstrokeColor);
  render();
}

function applySheetRadiusTile(v) {
  updateSheetRadius(v);
  var tiles = document.querySelectorAll('#canvas-radius-tiles .tile');
  var vals = [0,6,14,28];
  tiles.forEach(function(t,i){ t.classList.toggle('on', vals[i]===v); });
  /* 세부 조정 슬라이더 동기화 */
  _updateSliderUI('sl-sheet-r-adv', v);
  var sn2 = document.getElementById('sn-sheet-r-adv');
  if (sn2) sn2.value = v;
}

function applyAllRadius(v) {
  saveHistory();
  _setTileActive('canvas-radius-all-tiles', [0,8,16,999].indexOf(v >= 999 ? 999 : (v >= 16 ? 16 : (v >= 8 ? 8 : 0))));
  globalVals.radius = v;
  blocks.forEach(function(b){ b.radius = v; });
  render();
}

function applyAllShadow(v) {
  saveHistory();
  v = Math.min(2, Math.max(0, parseInt(v)||0));
  _setTileActive('canvas-shadow-tiles', v);
  globalVals.shadow = v;
  blocks.forEach(function(b){ b.shadow = v; });
  render();
}

function applyAllTstroke(val) {
  saveHistory();
  val = Math.min(2, Math.max(0, parseInt(val) || 0));
  _setTileActive('canvas-tstroke-tiles', val);
  globalVals.tstroke = val;
  var textTypes = { txt:1, item:1, tag:1 };
  blocks.forEach(function(b) { if (textTypes[b.type]) b.tstroke = val; });
  render();
}

function syncBgColor(val) {
  var bgEl = document.getElementById('bp-bg-color');
  if (bgEl) bgEl.value = val;
  var bgSw = document.getElementById('bp-color-swatch');
  if (bgSw) bgSw.style.background = val;
  var bgHex = document.getElementById('bp-color-hexedit');
  if (bgHex) bgHex.value = val.toUpperCase();
  if (!selKey) return;
  var blk = getSelBlk();
  if (!blk) return;
  if (!_pendingHistorySave) { saveHistory(); _pendingHistorySave = true; }
  blk.bgColor = val;
  render();
}

function syncStrokeColor(val) {
  var swEl = document.getElementById('bp-stroke-color-swatch');
  if (swEl) swEl.style.background = val;
  var hexEl = document.getElementById('bp-stroke-color-hexedit');
  if (hexEl) hexEl.value = val.toUpperCase();
  if (!selKey) return;
  var blk = getSelBlk();
  if (!blk) return;
  if (!_pendingHistorySave) { saveHistory(); _pendingHistorySave = true; }
  blk.strokeColor = val;
  render();
}

/* 블록이 전역값과 다른 커스텀 스타일을 갖고 있는지 판단 (구버전 데이터 호환 — styleCustom
   필드가 없어도 실제 커스텀 값이 있으면 커스텀으로 추론) */
function _blkHasCustomStyle(blk) {
  if (!blk) return false;
  if (blk.styleCustom === true)  return true;
  if (blk.styleCustom === false) return false;
  /* C-1: 배경 제거(opacity===0)는 커스텀 판정에서 제외 — 별도 토글로 분리됨.
     toggleBgRemove()는 배경 제거 시 그림자도 같이 0으로 끄므로(의도된 동작),
     그 조합(opacity===0 && shadow===0)도 커스텀으로 보지 않음 — 컬러칩 기본값이
     이 조합이라 분리 전에는 항상 "커스텀"으로 오인되던 문제 해결 */
  var isBgRemoved = blk.opacity === 0;
  return (blk.radius  !== null && blk.radius  !== undefined) ||
         (blk.shadow  !== null && blk.shadow  !== undefined && !(isBgRemoved && blk.shadow === 0)) ||
         (blk.stroke  !== 0 && blk.stroke !== null && blk.stroke !== undefined) ||
         (blk.opacity !== null && blk.opacity !== undefined && blk.opacity !== 100 && !isBgRemoved) ||
         (blk.bgColor !== null && blk.bgColor !== undefined) ||
         (blk.padV    !== null && blk.padV    !== undefined);
}

/* 블록 설정 패널 — 기본(전역 유지) / 커스텀 모드 전환 */
function toggleBlkStyleMode(mode) {
  if (!selKey || selKey === 'header') return;
  var blk = getSelBlk();
  if (!blk) return;
  if (mode === 'custom') {
    blk.styleCustom = true;
    showBlockPanel(blk.type, null, blk);
  } else {
    blk.styleCustom = false;
    resetBlkStyle(); /* radius/shadow/stroke/bgColor/opacity/padV 초기화 + render() + showBlockPanel() 포함 */
  }
}

function resetBlkStyle() {
  if (!selKey || selKey === 'header') return;
  var blk = getSelBlk();
  if (!blk) return;
  blk.radius       = null;
  blk.shadow       = null;
  blk.stroke       = 0;
  blk.tstroke      = 0;
  blk.tstrokeColor = '#ffffff';
  blk.opacity      = null;
  blk.bgColor      = null;
  blk.padV         = null;
  render();
  showBlockPanel(blk.type, null, blk);
}



function syncPadV(val) {
  val = Math.min(40, Math.max(0, parseInt(val) || 0));
  _updateSliderUI('bp-sl-padv', val);
  var sn = document.getElementById('bp-sn-padv');
  if (sn) sn.value = val;
  if (!selKey) return;
  var blk = getSelBlk();
  if (!blk) return;
  if (!_pendingHistorySave) { saveHistory(); _pendingHistorySave = true; }
  blk.padV = val;  /* 수동 모드 전환 */
  /* 자동 버튼 표시 */
  var autoRow = document.getElementById('bp-padv-auto-row');
  if (autoRow) autoRow.style.display = '';
  /* 패딩 변경 시 텍스트 잘림 방지 — minH 재계산 후 확장 */
  var blkEl = document.querySelector('.blk[data-key="' + selKey + '"]');
  if (blkEl && blk.type === 'txt') {
    blkEl.style.padding = val + 'px';
    blkEl.dataset.pad = val;
    var minH = getTextMinH(blkEl);
    if (minH > blk.h) blk.h = minH;
  }
  render();
}

/* 패딩 자동 초기화 — null 복귀 */
function resetPadV() {
  if (!selKey) return;
  var blk = getSelBlk();
  if (!blk) return;
  saveHistory();
  blk.padV = null;  /* 자동 모드 복귀 */
  /* 슬라이더를 자동 계산값으로 갱신 */
  var r = (blk.radius !== null && blk.radius !== undefined) ? blk.radius : globalVals.radius;
  var autoPad = r >= 999 ? 40 : Math.max(8, Math.round(Math.min(r, 32) * 0.5 + 8));
  _updateSliderUI('bp-sl-padv', autoPad);
  var sn = document.getElementById('bp-sn-padv');
  if (sn) sn.value = autoPad;
  var autoRow = document.getElementById('bp-padv-auto-row');
  if (autoRow) autoRow.style.display = 'none';
  render();
}

/* 텍스트 스타일 동기화 — 패널 → 블록 데이터 → DOM 즉시 반영 */
function syncTextStyle(prop, val) {
  if (!selKey) return;
  var blk = getSelBlk();
  if (!blk) return;
  if (!_pendingHistorySave) { saveHistory(); _pendingHistorySave = true; }
  if (prop === 'fontSize') {
    val = Math.min(72, Math.max(8, parseInt(val) || 12));
    blk.fontSize = val;
    document.getElementById('bp-font-size').value = val;
    /* spans에 개별 fontSize가 박혀있으면 blk.fontSize로 일괄 동기화
       (클릭 상태 서식 적용 시 그 시점 크기가 고정되는 문제 방지) */
    if (blk.spans) {
      blk.spans = blk.spans.map(function(s) {
        var ns = Object.assign({}, s);
        delete ns.fontSize;
        return ns;
      });
    }
  } else if (prop === 'align') {
    blk.textAlign = val;
    /* 공통 섹션 hidden input + seg 갱신 */
    var hidAl = document.getElementById('bp-align');
    if (hidAl) hidAl.value = val;
    var lB = document.getElementById('bp-halign-left');
    var cB = document.getElementById('bp-halign-center');
    if (lB) lB.classList.toggle('on', val === 'left');
    if (cB) cB.classList.toggle('on', val === 'center');
    _refreshBpAlign9(blk);
  } else if (prop === 'fontFamily') {
    blk.fontFamily = val;
  } else if (prop === 'fontColor') {
    blk.fontColor = val;
    var swEl = document.getElementById('bp-font-color-swatch');
    var lbEl = document.getElementById('bp-font-color-label');
    if (swEl) swEl.style.background = val;
    if (lbEl) lbEl.textContent = val.toUpperCase();
  } else if (prop === 'vAlign') {
    blk.vAlign = val;
  } else if (prop === 'listMode') {
    blk.listMode = val;
    /* 버튼 UI 갱신 */
    ['none','bullet-circle','bullet-check','bullet-tri','bullet-arrow','bullet-diamond','numbered'].forEach(function(m) {
      var btn = document.getElementById('bp-lm-' + m);
      if (btn) btn.classList.toggle('on', m === val);
      var tbtn = document.getElementById('tfb-lm-' + m);
      if (tbtn) tbtn.classList.toggle('on', m === val);
    });
    /* 보기/편집 모드 모두 즉시 표시 갱신 */
    var blkEl2 = document.querySelector('.blk[data-key="' + selKey + '"]');
    var ta2 = blkEl2 ? blkEl2.querySelector('.blk-text-area') : null;
    if (ta2) {
      if (isEditing && editingKey === selKey) {
        /* 편집 모드 — 현재 contenteditable의 기호를 벗기고 새 기호로 재적용 */
        var pureText = stripListPrefix(ta2.textContent || '', val);
        applyListDisplay(ta2, pureText, val);
        /* 커서를 끝으로 이동 */
        try {
          var nd = ta2.firstChild;
          if (nd) {
            var rng = document.createRange();
            rng.setStart(nd, nd.textContent.length);
            rng.collapse(true);
            var s = window.getSelection();
            s.removeAllRanges();
            s.addRange(rng);
          }
        } catch(err) {}
      } else {
        applyListDisplay(ta2, blk.text || '', val);
      }
    }
  }
  /* 더블클릭으로 명시적 편집 진입한 경우만 직접 스타일 적용 — 그 외는 항상 render() */
  if (!isEditing || !_userEnteredEdit) {
    render();
    /* 클릭 상태에서 fontSize 변경 시: render() 후 DOM 반영 완료 시점에 높이 보정 */
    if (prop === 'fontSize') {
      var _selKeyC = selKey;
      var _blkC = blk;
      requestAnimationFrame(function() {
        var blkElC = document.querySelector('.blk[data-key="' + _selKeyC + '"]');
        if (blkElC) {
          var minHC = getTextMinH(blkElC);
          if (minHC > _blkC.h) {
            _blkC.h = minHC;
            blkElC.style.height = _blkC.h + 'px';
          }
          if (_blkC.type !== 'txt') {
            var minWC = getTextMinW(blkElC);
            if (minWC > _blkC.w) {
              _blkC.w = minWC;
              blkElC.style.width = _blkC.w + 'px';
            }
          }
        }
      });
    }

  } else {
    /* 편집 중에는 현재 편집 textarea에 직접 스타일 적용 */
    var blkEl = editingKey ? document.querySelector('.blk[data-key="' + editingKey + '"]') : null;
    var activeArea = blkEl ? blkEl.querySelector('.blk-text-area') : null;
    if (activeArea) {
      applyTextStyleToEl(activeArea, blk);
      /* fontSize 변경 시: applyTextStyleToEl 후 DOM 반영 완료 시점에 높이 보정 */
      if (prop === 'fontSize') {
        var _selKey2 = selKey;
        var _blk2 = blk;
        requestAnimationFrame(function() {
          var blkElFs2 = document.querySelector('.blk[data-key="' + _selKey2 + '"]');
          if (blkElFs2) {
            var minHFs2 = getTextMinH(blkElFs2);
            if (minHFs2 > _blk2.h) {
              _blk2.h = minHFs2;
              blkElFs2.style.height = _blk2.h + 'px';
            }
            if (_blk2.type !== 'txt') {
              var minWFs2 = getTextMinW(blkElFs2);
              if (minWFs2 > _blk2.w) {
                _blk2.w = minWFs2;
                blkElFs2.style.width = _blk2.w + 'px';
              }
            }
          }
        });
      }
    }
  }
}

function syncLineHeight(val) {
  if (!selKey) return;
  var blk = getSelBlk();
  if (!blk || blk.type !== 'txt') return;
  blk.lineHeight = Math.round(parseFloat(val) * 10) / 10 || 1.6;
  var blkEl = document.querySelector('.blk[data-key="' + selKey + '"]');
  if (blkEl) {
    var ta = blkEl.querySelector('.blk-text-area');
    if (ta) ta.style.lineHeight = blk.lineHeight;
  }
  _updateSliderUI('bp-txt-sl-lh', blk.lineHeight);
  var snEl = document.getElementById('bp-txt-sn-lh');
  if (snEl) snEl.value = blk.lineHeight;
}

/* 블록 텍스트 스타일을 DOM 요소에 적용 */
function applyTextStyleToEl(el, blk) {
  var fontSize   = blk.fontSize   || 12;
  var textAlign  = blk.textAlign  || 'left';
  var fontFamily = blk.fontFamily || globalVals.font || 'Pretendard';
  var fontColor  = blk.fontColor  || globalVals.fontColor || '#212121';
  el.style.fontSize = fontSize + 'px';
  el.style.textAlign  = textAlign;
  el.style.fontFamily = "'" + fontFamily + "', 'Pretendard', sans-serif";
  el.style.color      = fontColor;
  /* vAlign 보정은 render() 후 applyVAlignAll()에서 처리 */
}

/* 목록 모드 + 줄 인덱스 → 기호 문자열 반환 */
function getListPrefix(listMode, lineIdx) {
  if (listMode === 'bullet-circle')  return '• ';
  if (listMode === 'bullet-check')   return '✔ ';
  if (listMode === 'bullet-tri')     return '‣ ';
  if (listMode === 'bullet-arrow')   return '➤ ';
  if (listMode === 'bullet-diamond') return '❖ ';
  if (listMode === 'numbered')       return (lineIdx + 1) + '. ';
  return '';
}

/* 목록형 표시용 텍스트 생성 + contenteditable div에 반영
   보기 모드(contenteditable=false)에서만 호출 — 저장값(blk.text)은 항상 순수 텍스트 유지 */
function applyListDisplay(el, text, listMode) {
  if (!listMode || listMode === 'none') {
    el.textContent = text || '';
    return;
  }
  var lines = (text || '').split('\n');
  el.textContent = lines.map(function(line, idx) {
    return getListPrefix(listMode, idx) + line;
  }).join('\n');
}



/* 키가 현재 선택 상태인지 판단 (단일·다중 선택 통합) */
function _isSelected(key) {
  if (!key) return false;
  return selKey === key || selKeys.indexOf(key) !== -1;
}

/* 블록의 stroke 인셋 boxShadow 조각 */
function _blkStrokeShadow(bdata) {
  var strk = bdata ? (bdata.stroke || 0) : 0;
  if (!strk) return '';
  var c = (bdata && bdata.strokeColor) || '#1C1C20';
  return strk >= 2 ? 'inset 0 0 0 2px ' + hexWithAlpha(c, 55)
       : 'inset 0 0 0 1px ' + hexWithAlpha(c, 28);
}

/* 블록의 드롭섀도 boxShadow 조각 */
function _blkDropShadow(bdata) {
  var bsh = (bdata && bdata.shadow !== null && bdata.shadow !== undefined) ? bdata.shadow : globalVals.shadow;
  if (!(bsh > 0)) return '';
  return bsh >= 2 ? '0 6px 16px rgba(0,0,0,.18)'
       : bsh >= 1 ? '0 1px 3px rgba(0,0,0,.12), 0 1px 2px rgba(0,0,0,.06)'
       : '0 ' + Math.round(bsh*0.8*0.5) + 'px ' + Math.round(bsh*0.8*2) + 'px rgba(0,0,0,' + (0.06+bsh*0.012) + ')';
}

/* 블록의 비선택 상태 boxShadow (drop shadow + stroke 인셋 모두 포함) */
function _blkNormalBoxShadow(bdata) {
  var dropShadow = _blkDropShadow(bdata);
  var strokeShadow = _blkStrokeShadow(bdata);
  if (dropShadow && strokeShadow) return dropShadow + ',' + strokeShadow;
  return dropShadow || strokeShadow || 'none';
}

/* 블록의 선택 상태 boxShadow (선택 글로우 + drop shadow + stroke 인셋) */
function _blkSelBoxShadow(bdata) {
  /* 이미지(스티커) 선택 표시와 통일 — 선택 글로우 링 없이 outline만으로 표시(2026-06-23).
     블록 자체의 드롭섀도/외곽선은 선택 중에도 그대로 유지 */
  var dropShadow = _blkDropShadow(bdata);
  var strokeShadow = _blkStrokeShadow(bdata);
  return [dropShadow, strokeShadow].filter(Boolean).join(',') || 'none';
}

/* selKey → 블록 객체 반환 */
function getSelBlk() {
  if (!selKey || selKey === 'header') return null;
  return getBlkByKey(selKey);
}

function duplicateSelBlk() {
  var targets = selKeys.length > 1 ? selKeys.slice() : (selKey && selKey !== 'header' ? [selKey] : []);
  if (targets.length === 0) return;
  saveHistory();

  /* y 기준 내림차순 정렬 — 아래쪽 블록부터 처리해 삽입 위치 오염 방지 */
  targets.sort(function(a, b) {
    var ba = blocks.find(function(x) { return x.id === a; });
    var bb = blocks.find(function(x) { return x.id === b; });
    return (bb ? bb.y : 0) - (ba ? ba.y : 0);
  });

  targets.forEach(function(key) {
    var orig = blocks.find(function(b) { return b.id === key; });
    if (!orig) return;
    var clone = JSON.parse(JSON.stringify(orig));
    clone.id = _nextBlkId();
    clone.y  = orig.y + orig.h + gaps.pad;
    blocks.push(clone);
  });

  selKeys = [];
  selKey = null;
  render();
  showToast(targets.length > 1 ? targets.length + '개 블록이 복제되었습니다' : '블록이 복제되었습니다');
}

function deleteSelBlk() {
  var targets = selKeys.length > 1 ? selKeys.slice() : (selKey && selKey !== 'header' ? [selKey] : []);
  if (targets.length === 0) return;
  saveHistory();

  var _savedGi = selectedGi;

  /* 선택된 블록들을 blocks 배열에서 제거 */
  blocks = blocks.filter(function(b) { return targets.indexOf(b.id) === -1; });

  /* 블록이 하나도 없으면 기본 블록 1개 추가 */
  if (blocks.length === 0) {
    blocks.push({ id: _nextBlkId(), x: 0, y: 0, w: canvasW, h: 120, groupId: null, type: 'img', imgSrc: null, imgTransform: { scale:1, x:0, y:0 }, radius: null, shadow: null, opacity: null, bgColor: null });
  }

  /* bug 4 방지: 그룹 선택 중 일부 블록 삭제 후 그룹 선택 유지 */
  var remainingInGrp = _savedGi ? blocks.filter(function(b) { return b.groupId === _savedGi; }) : [];
  if (_savedGi && remainingInGrp.length > 0) {
    selKeys = remainingInGrp.map(function(b) { return b.id; });
    selKey = null;
    hideAlignToolbar();
    document.querySelectorAll('.blk').forEach(function(blkEl) {
      blkEl.classList.remove('selected');
      blkEl.style.outline = '';
      blkEl.style.outlineOffset = '';
    });
    render();
  } else {
    selKeys = [];
    selKey = null;
    deselect();
    render();
  }
}

/* ══════════════════════════════════════════
   드래그 이벤트
══════════════════════════════════════════ */
/* textarea scrollHeight 정확 측정 — height:auto 일시 전환 후 즉시 복구 */
function getTextMinH(blkEl) {
  if (!blkEl) return 40;
  var ta = blkEl.querySelector('.blk-text-area');
  if (!ta) return 40;
  var padV = parseInt(blkEl.dataset.pad || 8) * 2;
  /* scrollHeight로 실제 콘텐츠 높이 직접 측정
     인라인 fontSize가 다양하게 섞여도 브라우저가 정확하게 계산함
     단, height를 auto로 풀어야 scrollHeight가 실제 콘텐츠 높이를 반환함 */
  var prevH = ta.style.height;
  ta.style.height = 'auto';
  var contentH = ta.scrollHeight || 0;
  ta.style.height = prevH;
  var raw = contentH + padV;
  return (padV === 0) ? Math.max(1, raw) : Math.max(40, raw);
}

/* 가장 긴 줄이 줄바꿈 없이 들어갈 최소 너비 측정 — white-space를 잠시 nowrap으로
   풀어 "줄바꿈 없는 본연의 폭"을 측정 후 즉시 복구 */
function getTextMinW(blkEl) {
  if (!blkEl) return 80;
  var ta = blkEl.querySelector('.blk-text-area');
  if (!ta) return 80;
  var padH = parseInt(blkEl.dataset.pad || 8) * 2;
  var prevWhiteSpace = ta.style.whiteSpace;
  var prevWidth = ta.style.width;
  ta.style.whiteSpace = 'nowrap';
  ta.style.width = 'auto';
  var contentW = ta.scrollWidth || 0;
  ta.style.whiteSpace = prevWhiteSpace;
  ta.style.width = prevWidth;
  return Math.max(80, contentW + padH);
}


/* 블록 최소 높이 반환 — 텍스트 블록은 현재 scrollHeight 기준, 나머지는 40px */
function getBlkMinH(gi, ci, bi) {
  var grpRef = _grp(gi);
  var blk = grpRef && grpRef.cols[ci] && grpRef.cols[ci].rows[bi];
  if (!blk) return 40;
  if (blk.type === 'txt') {
    /* height:auto로 일시 전환 → 순수 콘텐츠 높이 측정 후 즉시 복구
       (현재 블록 h 크기와 무관하게 실제 텍스트가 잘리는 시점만 차단) */
    var key = gi + '-' + ci + '-' + bi;
    var blkEl = document.querySelector('.blk[data-key="' + key + '"]');
    if (blkEl) return getTextMinH(blkEl);
  }
  if (blk.type === 'colorchip') return _ccMinH(blk);
  return 40;
}
document.addEventListener('mousemove', function(e) {
  /* ── 블록 우하단 리사이즈 ── */
  if (blkResize) {
    var dx_r = (e.clientX - blkResize.startX) / _zoomLevel;
    var dy_r = (e.clientY - blkResize.startY) / _zoomLevel;
    var b_r  = getBlkByKey(blkResize.id);
    if (b_r) {
      var rawW = blkResize.startW + dx_r;
      var rawH = blkResize.startH + dy_r;
      var newW, newH;

      if (e.shiftKey) {
        /* Shift: 비율 유지 — 드래그 방향(dx/dy 중 큰 쪽) 기준 스케일 */
        var ratio = blkResize.startW / blkResize.startH;
        var scaleByW = rawW / blkResize.startW;
        var scaleByH = rawH / blkResize.startH;
        var scale = Math.abs(dx_r) >= Math.abs(dy_r) ? scaleByW : scaleByH;
        scale = Math.max(scale, 80 / blkResize.startW, 40 / blkResize.startH);
        newW = Math.max(80, Math.round(blkResize.startW * scale / 8) * 8);
        newH = Math.max(40, Math.round(blkResize.startH * scale));
      } else if (e.altKey) {
        /* Alt: 축 잠금 — dx/dy 중 큰 방향만 조절, 나머지는 원본 고정 */
        if (Math.abs(dx_r) >= Math.abs(dy_r)) {
          /* 가로만 */
          newW = Math.max(80, Math.round(rawW / 8) * 8);
          newH = blkResize.startH;
        } else {
          /* 세로만 */
          newW = blkResize.startW;
          newH = Math.max(40, _snapH(Math.round(rawH)));
        }
      } else {
        /* 기본: 너비 8px 단위, 높이 자유 */
        newW = Math.max(80, Math.round(rawW / 8) * 8);
        newH = Math.max(40, _snapH(Math.round(rawH)));
      }

      /* 우측 엣지 스냅 가이드 (Shift/Alt 아닐 때만) */
      _clearSnapGuides();
      if (snapEnabled && !e.shiftKey && !e.altKey) {
        var rightEdge = b_r.x + newW;
        blocks.forEach(function(ob) {
          if (ob.id === blkResize.id) return;
          [ob.x, ob.x + ob.w].forEach(function(ex) {
            if (Math.abs(rightEdge - ex) <= SNAP_THRESH) {
              newW = Math.max(80, ex - b_r.x);
              _drawSnapGuide({ type: 'edge', axis: 'v', pos: ex });
            }
          });
        });
      }

      /* 콘텐츠 기반 최소 높이 방지턱 — 드래그 중에도 내용물 잘림 방지 */
      if (b_r.type === 'txt') {
        var _txtFloor = document.querySelector('.blk[data-key="' + blkResize.id + '"]');
        if (_txtFloor) newH = Math.max(newH, getTextMinH(_txtFloor));
      } else if (b_r.type === 'colorchip') {
        newH = Math.max(newH, _ccMinH(b_r));
      } else if (b_r.type === 'item') {
        newH = Math.max(newH, _itemMinH(b_r));
      }
      b_r.w = newW; b_r.h = newH;
      var blkEl_r = document.querySelector('.blk[data-key="' + blkResize.id + '"]');
      if (blkEl_r) { blkEl_r.style.width = newW + 'px'; blkEl_r.style.height = newH + 'px'; }
      if (b_r.type === 'txt') applyVAlignAll();
      autoCanvasH();
    }
    return;
  }

  /* ── 캔버스 너비 핸들 드래그 ── */
  if (cwDrag) {
    var dx_c = (e.clientX - cwDrag.prevX) / _zoomLevel;
    cwDrag.prevX = e.clientX;
    var delta_cw = Math.round(cwDrag.side === 'right' ? dx_c : -dx_c);
    if (delta_cw !== 0) {
      if (e.shiftKey) {
        _applyCanvasExpand(delta_cw, delta_cw, delta_cw, delta_cw);
      } else if (e.altKey) {
        _applyCanvasExpand(delta_cw, delta_cw, 0, 0);
      } else {
        cwDrag.side === 'right'
          ? _applyCanvasExpand(0, delta_cw, 0, 0)
          : _applyCanvasExpand(delta_cw, 0, 0, 0);
      }
    }
    updateResizeHandles();
    return;
  }

  /* ── 캔버스 높이 핸들 드래그 ── */
  if (chDrag) {
    var dy_c = (e.clientY - chDrag.prevY) / _zoomLevel;
    chDrag.prevY = e.clientY;
    var delta_ch = Math.round(chDrag.side === 'bottom' ? dy_c : -dy_c);
    if (delta_ch !== 0) {
      if (e.shiftKey) {
        _applyCanvasExpand(delta_ch, delta_ch, delta_ch, delta_ch);
      } else if (e.altKey) {
        _applyCanvasExpand(0, 0, delta_ch, delta_ch);
      } else {
        chDrag.side === 'top'
          ? _applyCanvasExpand(0, 0, delta_ch, 0)
          : _applyCanvasExpand(0, 0, 0, delta_ch);
      }
    }
    return;
  }

  /* ── 블록 이동 드래그 (자유 배치) ── */
  if (blkDrag) {
    var dx3 = e.clientX - blkDrag.startX, dy3 = e.clientY - blkDrag.startY;
    if (!blkDrag.didMove && Math.abs(dx3) + Math.abs(dy3) > 5) {
      blkDrag.didMove = true;
      var origEl0 = document.querySelector('.blk[data-key="' + blkDrag.id + '"]');
      if (origEl0) origEl0.classList.add('blk-dragging');
    }
    if (blkDrag.didMove) {
      /* 캔버스 좌표 역산 */
      var stEl5 = document.getElementById('canvas-stage');
      var sr5   = stEl5.getBoundingClientRect();
      var cx5   = (e.clientX - sr5.left) / _zoomLevel;
      var cy5   = (e.clientY - sr5.top)  / _zoomLevel;
      var blk5  = getBlkByKey(blkDrag.id);
      if (blk5) {
        var nx = Math.round(cx5 - blkDrag.offsetX);
        var ny = Math.round(cy5 - blkDrag.offsetY);
        var hasRel = blkDrag.relPositions && Object.keys(blkDrag.relPositions).length > 0;

        /* 이동 세트 전체의 바운딩박스 계산 (주 블록 + relPositions) */
        var moveMinX = nx, moveMinY = ny, moveMaxX = nx + blk5.w;
        if (hasRel) {
          Object.keys(blkDrag.relPositions).forEach(function(gid) {
            var rel = blkDrag.relPositions[gid];
            var gb  = getBlkByKey(gid);
            if (!gb) return;
            var gx = nx + rel.dx, gy = ny + rel.dy;
            if (gx < moveMinX)        moveMinX = gx;
            if (gy < moveMinY)        moveMinY = gy;
            if (gx + gb.w > moveMaxX) moveMaxX = gx + gb.w;
          });
        }

        /* 좌측 자동 확장 — 이동 세트 최좌단 기준
           marginLeft 변화량(lx/2)만큼 cx5가 다음 프레임에서 증가하므로
           offsetX 보정은 (lx - lx/2) = lx/2 만큼만 해야 피드백루프를 막을 수 있음 */
        if (moveMinX < 0) {
          var lx = -moveMinX;
          blkDrag.offsetX -= Math.round(lx / 2);  /* lx 전체가 아닌 절반만 보정 */
          nx += lx;
          blocks.forEach(function(b) {
            b.x += lx;
            if (b.id === blkDrag.id) return;
            var bEl = document.querySelector('.blk[data-key="' + b.id + '"]');
            if (bEl) bEl.style.left = b.x + 'px';
          });
          /* _setStageWidth 공용 헬퍼로 통일(2026-06-22) — 동작은 기존과 동일(center 재중앙) */
          _setStageWidth(canvasW + lx, 'center');
        }

        /* 우측 자동 확장 — 이동 세트 최우단 기준
           우측 확장 시 stage가 왼쪽으로 이동(marginLeft 감소)하여 cx5가 증가하므로
           offsetX를 확장량/2 만큼 증가시켜 블록이 튀는 현상 방지 */
        var adjustedMaxX = nx + blk5.w;
        if (hasRel) {
          Object.keys(blkDrag.relPositions).forEach(function(gid) {
            var rel = blkDrag.relPositions[gid];
            var gb  = getBlkByKey(gid);
            if (gb) { var rx = nx + rel.dx + gb.w; if (rx > adjustedMaxX) adjustedMaxX = rx; }
          });
        }
        if (adjustedMaxX > canvasW) {
          var rExp = adjustedMaxX - canvasW;
          blkDrag.offsetX += Math.round(rExp / 2);  /* stage 이동량만큼 offsetX 보정 */
          /* _setStageWidth 공용 헬퍼로 통일(2026-06-22) — 동작은 기존과 동일(center 재중앙) */
          _setStageWidth(adjustedMaxX, 'center');
        }

        /* 상단 자동 확장 — 헤더 있을 때: 헤더 위는 차단 / 없을 때: gaps.pad 여백 유지 */
        var _yFloor = headerPos === 'top' ? -getHeaderH() : 0;
        if (moveMinY < _yFloor) {
          var ty = _yFloor - moveMinY;
          blkDrag.offsetY -= ty;
          ny += ty;
          blocks.forEach(function(b) {
            b.y += ty;
            if (b.id === blkDrag.id) return;
            var bEl = document.querySelector('.blk[data-key="' + b.id + '"]');
            if (bEl) bEl.style.top = b.y + 'px';
          });
          autoCanvasH();
        }

        /* 스냅 적용 (자동확장 후) */
        _clearSnapGuides();
        if (snapEnabled) {
          var sr6 = _computeSnap(nx, ny, blk5);
          nx = sr6.nx; ny = sr6.ny;
          sr6.guides.forEach(function(g) { _drawSnapGuide(g); });
        }

        blk5.x = nx; blk5.y = ny;
        var blkEl5 = document.querySelector('.blk[data-key="' + blkDrag.id + '"]');
        if (blkEl5) { blkEl5.style.left = nx + 'px'; blkEl5.style.top = ny + 'px'; }

        /* 그룹/다중선택 드래그: 상대 위치 기반 동시 이동 */
        if (hasRel) {
          Object.keys(blkDrag.relPositions).forEach(function(gid) {
            var rel = blkDrag.relPositions[gid];
            var gb  = getBlkByKey(gid);
            if (!gb) return;
            gb.x = blk5.x + rel.dx;
            gb.y = blk5.y + rel.dy;
            var gEl = document.querySelector('.blk[data-key="' + gid + '"]');
            if (gEl) { gEl.style.left = gb.x + 'px'; gEl.style.top = gb.y + 'px'; }
          });
        }

        /* 그룹 드래그 중 점선 오버레이 + 툴바 위치 갱신 */
        if (blkDrag.groupId) {
          var _ov = document.getElementById('grp-selection-overlay');
          var _tb = document.getElementById('grp-toolbar');
          var _nb = _grpBBox(blkDrag.groupId);
          if (_ov && _nb) {
            _ov.style.left   = (_nb.x - 4) + 'px';
            _ov.style.top    = (_nb.y - 4) + 'px';
            _ov.style.width  = (_nb.w + 8) + 'px';
            _ov.style.height = (_nb.h + 8) + 'px';
          }
          if (_tb && _nb) {
            _tb.style.left = (_nb.x + _nb.w + 12) + 'px';
            _tb.style.top  = _nb.y + 'px';
          }
        }

        autoCanvasH();
        updateResizeHandles();
      }
    }
    return;
  }

});

document.addEventListener('mouseup', function() {
  _pendingHistorySave = false;
  /* 블록 리사이즈 종료 */
  if (blkResize) {
    _clearSnapGuides();
    document.body.style.userSelect = '';
    /* 콘텐츠가 필요로 하는 최소 크기 밑으로 줄었으면 즉시 복귀 */
    var _rb = getBlkByKey(blkResize.id);
    if (_rb && _rb.type === 'txt') {
      var _rEl = document.querySelector('.blk[data-key="' + blkResize.id + '"]');
      if (_rEl) {
        var _minH = getTextMinH(_rEl);
        if (_minH > _rb.h) _rb.h = _minH;
        // txt 블록은 수동 폭 조절 허용 — nowrap 기준 폭 강제 적용 안 함
      }
    } else if (_rb && _rb.type === 'colorchip') {
      _ccAutoExpand(_rb, _rb.id);
    } else if (_rb && _rb.type === 'item') {
      _itemAutoExpand(_rb, _rb.id);
    }
    blkResize = null;
    render();
    return;
  }

  /* 캔버스 핸들 드래그 종료 */
  var wasCwDrag = !!cwDrag, wasChDrag = !!chDrag;
  cwDrag = null; chDrag = null;
  document.body.style.userSelect = '';
  if (wasCwDrag || wasChDrag) render();

  /* 블록 이동 드래그 종료 */
  if (blkDrag) {
    _clearSnapGuides();
    var _savedGroupId = blkDrag.groupId;
    if (blkDrag.didMove) {
      var origEl2 = document.querySelector('.blk[data-key="' + blkDrag.id + '"]');
      if (origEl2) origEl2.classList.remove('blk-dragging');
      render();
      if (_savedGroupId) showGroupToolbar(_savedGroupId);
    }
    blkDrag = null;
  }
});

/* ══════════════════════════════════════════
   텍스트 편집 종료 처리
   blur 대신 document mousedown으로 감지 — 패널 클릭 시 편집 유지 안 함 (충돌 #3)
══════════════════════════════════════════ */
document.addEventListener('mousedown', function(e) {
  /* 텍스트 편집 종료 감지 */
  if (isEditing) {
    if (editingKey === 'header') { commitTextEdit(); render(); return; }
    /* 텍스트 서식 툴바 · 색상 팝업 클릭은 편집 종료하지 않음 */
    if (e.target.closest('#txt-format-bar') || e.target.closest('#gm-cp-pop') || e.target.closest('.tfb-popover')) return;
    var blkEl2 = editingKey ? document.querySelector('.blk[data-key="' + editingKey + '"]') : null;
    /* BUG-34: item 블록 편집 중 — commitTextEdit 대신 blur로 저장 처리
       .blk-text-area가 없으므로 activeArea=null 경로를 타면 데이터 미저장 + saveHistory 중복 발생 */
    var blk2 = blkEl2 ? getBlkByKey(editingKey) : null;
    if (blk2 && blk2.type === 'item') {
      var editSpan = blkEl2.querySelector('[contenteditable="true"]');
      if (editSpan && editSpan.contains(e.target)) return;  /* 같은 span 내 클릭 → 계속 편집 */
      if (editSpan) editSpan.blur();  /* blur 핸들러가 저장 + isEditing=false 담당 */
      requestAnimationFrame(render);
      return;
    }
    var activeArea = blkEl2 ? blkEl2.querySelector('.blk-text-area') : null;
    if (activeArea && activeArea.contains(e.target)) return;
    commitTextEdit();
    requestAnimationFrame(function() {
      if (selKey) { return; }
      showCanvasPanel();
      render();
    });
    return;
  }
  /* 이미지 편집 모드 종료 감지 (mousedown 사용 — stopPropagation 영향 없음) */
  if (activeImgKey) {
    var imgBlkEl = document.querySelector('.blk[data-key="' + activeImgKey + '"]');
    if (imgBlkEl && imgBlkEl.contains(e.target)) return;
    exitImgEditMode();
    /* render()를 rAF로 지연 — mousedown(편집종료) → click(블록선택) → rAF(render) 순서 보장
       즉시 render()하면 DOM이 click보다 먼저 교체되어 블록 선택이 무효화됨 */
    requestAnimationFrame(function() {
      /* 다른 블록이 click으로 선택된 경우 — onclick이 DOM 직접 반영 완료, 추가 작업 불필요 */
      if (selKey) { return; }
      /* 빈 캔버스·외부 영역 클릭 — 선택 해제 + 패널 복귀 + 재렌더 */
      selectedGi = null;
      showCanvasPanel();
      render();
    });
  }
});




/* key 문자열로 블록 객체 반환 (header 제외) */
function getBlkByKey(key) {
  if (!key || key === 'header') return null;
  return blocks.find(function(b) { return b.id === key; }) || null;
}



/* ══════════════════════════════════════════
   토스트
══════════════════════════════════════════ */
function showToast(msg) {
  var t = document.getElementById('slot-toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(function() { t.classList.remove('show'); }, 1800);
}

/* ══════════════════════════════════════════
   초기 렌더
══════════════════════════════════════════ */
render();
updatePngBg(pngBg); /* 에디터 배경색 초기 동기화 */

/* 이미지(스티커)는 탭 진입 여부와 무관하게 캔버스에서 항상 클릭·드래그 가능 */
if (!stickerEditMode) toggleStickerEdit();

/* 줌/팬 이벤트 초기화 */
initZoomPan();

/* 캔버스 리사이즈 핸들 초기화 */
initResizeHandles();

/* proximity scale 초기화 */
_initProximity(
  document.getElementById('float-tabs'),
  '.float-tab',
  1.18,   /* 최대 scale */
  90      /* 감지 반경(px) */
);
_initProximity(
  document.getElementById('float-pill'),
  'button',
  1.22,   /* 최대 scale */
  80      /* 감지 반경(px) */
);
_initProximity(
  document.getElementById('combo-pill'),
  'button',
  1.18,   /* 최대 scale */
  80      /* 감지 반경(px) */
);

/* ── 이미지 블록 업로드 박스 드래그 앤 드롭 ── */
(function() {
  var box = document.getElementById('bp-img-upload-box');
  if (!box) return;
  box.addEventListener('dragover', function(e) {
    e.preventDefault();
    e.stopPropagation();
    box.classList.add('drag-over');
  });
  box.addEventListener('dragleave', function(e) {
    e.stopPropagation();
    box.classList.remove('drag-over');
  });
  box.addEventListener('drop', function(e) {
    e.preventDefault();
    e.stopPropagation();
    box.classList.remove('drag-over');
    if (!selKey) return;
    var file = e.dataTransfer.files[0];
    if (!file || !file.type.startsWith('image/')) return;
    var reader = new FileReader();
    reader.onload = function(ev) {
      var blk = getBlkByKey(selKey);
      if (!blk) return;
      blk.imgSrc = ev.target.result;
      blk.imgTransform = { scale: 1, x: 0, y: 0 };
      var key = selKey;
      activeImgKey = null;
      render();
      _refreshImgUploadBox(blk);
      requestAnimationFrame(function() {
        initImgTransform(key);
        enterImgEditMode(key);
      });
    };
    reader.readAsDataURL(file);
  });
})();

/* ── 스티커 레이어 우클릭 컨텍스트 메뉴 ── */
(function() {
  var layer = document.getElementById('sticker-layer');
  if (!layer) return;
  layer.addEventListener('contextmenu', function(e) {
    var item = e.target.closest('.sticker-item');
    if (!item) return;
    e.preventDefault();
    var id = parseInt((item.id || '').replace('sticker-', ''), 10);
    if (isNaN(id)) return;
    /* 선택 동기화 */
    if (selectedStickerIds.indexOf(id) === -1) selectSticker(id);
    _openStickerCtx(e.clientX, e.clientY, id);
  });
  /* 외부 클릭 시 메뉴 닫기 */
  document.addEventListener('mousedown', function(e) {
    var menu = document.getElementById('sticker-ctx-menu');
    if (menu && !menu.contains(e.target)) _closeStickerCtx();
  }, true);
})();

/* ══════════════════════════════════════════
   커스텀 슬라이더 — UI 업데이트 헬퍼 + 이벤트 초기화
══════════════════════════════════════════ */
function _updateSliderUI(id, val) {
  var el = document.getElementById(id);
  if (!el || !el.classList.contains('row-slider')) return;
  var min = parseFloat(el.dataset.min) || 0;
  var max = parseFloat(el.dataset.max) || 100;
  var pct = Math.max(0, Math.min(100, (val - min) / (max - min) * 100));
  var fill  = el.querySelector('.row-slider-fill');
  var thumb = el.querySelector('.row-slider-thumb');
  if (fill)  fill.style.width = pct + '%';
  if (thumb) thumb.style.left = pct + '%';
  el.dataset.val = val;
}

function initSliders() {
  document.querySelectorAll('.row-slider').forEach(function(el) {
    function getValFromX(clientX) {
      var rect = el.getBoundingClientRect();
      var min  = parseFloat(el.dataset.min) || 0;
      var max  = parseFloat(el.dataset.max) || 100;
      var pct  = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      var raw  = min + pct * (max - min);
      var step = parseFloat(el.dataset.step);
      if (!isNaN(step) && step > 0 && step < 1) {
        return Math.round(raw / step) * step;
      }
      return Math.round(raw);
    }
    function applyVal(clientX) {
      var val = getValFromX(clientX);
      _updateSliderUI(el.id, val);
      /* 연동된 숫자 인풋 갱신 */
      var snId = el.id.replace(/^sl-/, 'sn-').replace(/^bp-sl-/, 'bp-sn-').replace(/-sl-/, '-sn-');
      var sn   = document.getElementById(snId);
      if (sn) sn.value = val;
      /* 연결 함수 호출 */
      var fn = el.dataset.fn;
      if (fn) {
        try { eval(fn.replace('this.value', val)); } catch(e) {}
      }
    }
    el.addEventListener('mousedown', function(e) {
      e.preventDefault();
      applyVal(e.clientX);
      function onMove(ev) { applyVal(ev.clientX); }
      function onUp()     {
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup',   onUp);
      }
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup',   onUp);
    });
  });
}
initSliders();

/* ── 컬러칩 패널 이벤트 바인딩 (DOM 준비 후 1회 실행) ── */
(function() {
  /* 칩 색상 picker */
  var chipColorInp = document.getElementById('bp-cc-chip-color');
  if (chipColorInp) {
    chipColorInp.addEventListener('input', function() {
      syncColorchip('color', this.value);
    });
  }

  /* 라벨 입력 */
  var labelInp = document.getElementById('bp-cc-label');
  if (labelInp) {
    labelInp.addEventListener('input', function() {
      syncColorchip('label', this.value);
    });
  }

  /* 글자 색 picker */
  var textColorInp = document.getElementById('bp-cc-text-color');
  if (textColorInp) {
    textColorInp.addEventListener('input', function() {
      syncColorchip('textColor', this.value);
    });
  }

  /* 설명 입력 */
  var descInp = document.getElementById('bp-cc-desc');
  if (descInp) {
    descInp.addEventListener('input', function() {
      syncColorchip('desc', this.value);
    });
  }

  /* 모양 tiles */
  document.querySelectorAll('#bp-cc-shape-seg .tile').forEach(function(b) {
    b.addEventListener('click', function() {
      var r = b.dataset.ccshape === 'square' ? 0 : (b.dataset.ccshape === 'circle' ? 50 : 20);
      syncColorchip('chipRadius', r);
    });
  });
})();

/* ══════════════════════════════════════════
   허브(🪨) · 투어(?) — ≡ 드롭다운으로 통합됨
   (DOMContentLoaded 동적 삽입 제거)
══════════════════════════════════════════ */

