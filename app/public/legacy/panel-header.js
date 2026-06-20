/* panel-header.js — 리팩토링 2단계 9번째 조각: 블록 추가 팝업 + 헤더 패널(이미지 변형 포함) + showBlockPanel 디스패처 (app/public/legacy/main.js에서 추출, 로직 변경 없음. enterHeaderImgEditMode 등 재작성 금지 함수 포함 — 그대로 이동만 함) */
/* ══════════════════════════════════════════
   블록 추가 팝업
══════════════════════════════════════════ */
function showBlkPopup(anchorEl) {
  popupTarget = { anchorEl: anchorEl };
  _openBlkPopup(anchorEl);
}
/* 구버전 호환용 — gi/ci/insertIdx 무시하고 캔버스 하단에 추가 */
function showBlkPopupAt(gi, ci, insertIdx, anchorEl) { showBlkPopup(anchorEl); }

function _openBlkPopup(anchorEl) {
  var pop = document.getElementById('blk-popup');
  pop.innerHTML = '';
  var types = [
    { type: 'img',       label: '이미지',  miniHtml: '<div class="pmini-img"></div>' },
    { type: 'txt',       label: '텍스트',  miniHtml: '<div class="pmini-txt">T</div>' },
    { type: 'colorchip', label: '컬러칩',  miniHtml: '<div class="pmini-color"><span></span><span></span></div>' },
    { type: 'item',      label: '항목',    miniHtml: '<div class="pmini-item"><div class="k" style="width:30%"></div><div class="v" style="width:60%"></div><div class="k" style="width:25%"></div><div class="v" style="width:70%"></div></div>' }
  ];
  types.forEach(function(t) {
    var btn = document.createElement('button'); btn.className = 'popup-btn';
    var frame = document.createElement('div'); frame.className = 'popup-mini-frame';
    frame.innerHTML = t.miniHtml;
    var lbl = document.createElement('span'); lbl.className = 'popup-mini-lbl';
    lbl.textContent = t.label;
    btn.appendChild(frame);
    btn.appendChild(lbl);
    btn.onclick = function(e) {
      e.stopPropagation();
      /* 새 블록 배치: 현재 blocks 최하단 + pad 아래 */
      var maxY = blocks.reduce(function(m, b) { return Math.max(m, b.y + b.h); }, 0);
      var _side = 160;
      var newW = _side;
      var newX = Math.round((canvasW - newW) / 2);
      var newY = maxY > 0 ? maxY + gaps.pad : gaps.pad;
      var newBlk = { id: _nextBlkId(), x: newX, y: newY, w: newW, h: _side, groupId: null, type: t.type, radius: null, shadow: null, opacity: null, bgColor: null, stroke: globalVals.stroke || 0, tstroke: globalVals.tstroke || 0, tstrokeColor: '#ffffff' };
      if (t.type === 'txt' || t.type === 'title') {
        newBlk.listMode = 'none';
        newBlk.spans = [{ text: '' }];
      }
      if (t.type === 'img') {
        newBlk.imgSrc = null;
        newBlk.imgTransform = { scale: 1, x: 0, y: 0 };
      }
      if (t.type === 'colorchip') {
        newBlk.chips = [
          { id: 'cc0_' + Date.now(), color: '#2F4D9E', label: 'A', textColor: '#ffffff', desc: '' },
          { id: 'cc1_' + Date.now(), color: '#5B7CE6', label: 'B', textColor: '#ffffff', desc: '' },
          { id: 'cc2_' + Date.now(), color: '#7E9BEE', label: 'C', textColor: '#212121', desc: '' }
        ];
        newBlk.chipLayout = 'row'; newBlk.chipRadius = 0;
        newBlk.showSwatch = true; newBlk.showText = false;
        newBlk.opacity = 0; newBlk.shadow = 0;
        newBlk.h = _ccMinH(newBlk);
      }
      if (t.type === 'item') {
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
      pop.classList.remove('show');
      render();
      selKey = newBlk.id;
      selKeys = [];
      showBlockPanel(t.type, null, newBlk);
    };
    pop.appendChild(btn);
  });
  var rect = anchorEl.getBoundingClientRect();
  pop.style.top  = (rect.bottom + 4) + 'px';
  pop.style.left = rect.left + 'px';
  pop.classList.add('show');
  var pr = pop.getBoundingClientRect();
  var vw = window.innerWidth;
  var vh = window.innerHeight;
  var top  = rect.bottom + 4;
  var left = rect.left;
  if (pr.right > vw - 8) left = vw - pr.width - 8;
  if (left < 8) left = 8;
  if (pr.bottom > vh - 8) top = rect.top - pr.height - 4;
  if (top < 8) top = 8;
  pop.style.top  = top + 'px';
  pop.style.left = left + 'px';
}

/* ══════════════════════════════════════════
   패널 전환
══════════════════════════════════════════ */
/* 헤더 패널 닫을 때 공통 스타일 섹션 복원 */
function restoreBlockPanelCommon() {
  /* 공통 그룹 복원 */
  var grpCommon = document.getElementById('bp-common-grp');
  if (grpCommon) grpCommon.style.display = '';
  var padvRow = document.getElementById('bp-padv-row');
  if (padvRow) padvRow.style.display = '';
  /* action-dock 복원 */
  var actionDock = document.getElementById('bp-action-dock');
  if (actionDock) actionDock.style.display = '';
  var actionDivider = document.getElementById('bp-action-divider');
  if (actionDivider) actionDivider.style.display = '';
}

/* headerData 속성 동기화 */
function syncHeaderProp(prop, val) {
  if (!_pendingHistorySave) { saveHistory(); _pendingHistorySave = true; }
  var type = headerData.type || 'basic';

  /* ── 헬퍼 ── */
  var syncSlider = function(slId, snId, v) {
    _updateSliderUI(slId, v);
    var sn = document.getElementById(snId); if (sn) sn.value = v;
  };
  var syncSwatch = function(swId, lbId, color) {
    var sw = document.getElementById(swId); if (sw) sw.style.background = color;
    var lb = document.getElementById(lbId); if (lb) { if (lb.tagName === 'INPUT') lb.value = color.toUpperCase(); else lb.textContent = color.toUpperCase(); }
  };
  var syncGradSwatch = function(swId, lbId, color) {
    var sw = document.getElementById(swId);
    if (sw) sw.style.background = bannerGradient(color);
    var lb = document.getElementById(lbId); if (lb) { if (lb.tagName === 'INPUT') lb.value = color.toUpperCase(); else lb.textContent = color.toUpperCase(); }
  };

  /* ── basic 고유 ── */
  if (prop === 'bannerH') {
    val = Math.min(300, Math.max(20, parseInt(val) || 160));
    headerData.bannerH = val;
    syncSlider('bp-sl-banner-h', 'bp-sn-banner-h', val);

  /* ── SNS 고유 ── */
  } else if (prop === 'snsH') {
    val = Math.min(240, Math.max(60, parseInt(val) || 120));
    headerData.snsH = val;
    syncSlider('bp-sl-sns-h', 'bp-sn-sns-h', val);
  } else if (prop === 'navH') {
    val = Math.min(56, Math.max(24, parseInt(val) || 32));
    headerData.navH = val;
    syncSlider('bp-sl-nav-h', 'bp-sn-nav-h', val);
  } else if (prop === 'navBgColor') {
    headerData.navBgColor = val;
    syncSwatch('bp-nav-bg-swatch', 'bp-nav-bg-label', val);
  } else if (prop === 'navFontColor') {
    headerData.navFontColor = val;
    syncSwatch('bp-nav-font-swatch', 'bp-nav-font-label', val);
  } else if (prop === 'navText') {
    headerData.navText = val;

  /* ── 라운드 고유 ── */
  } else if (prop === 'roundH') {
    val = Math.min(300, Math.max(40, parseInt(val) || 120));
    headerData.roundH = val;
    syncSlider('bp-sl-round-h', 'bp-sn-round-h', val);
    render();
    return;
  } else if (prop === 'roundOverlap') {
    var _ov = parseInt(val, 10); val = Math.min(60, Math.max(0, isNaN(_ov) ? 24 : _ov));
    headerData.roundOverlap = val;
    syncSlider('bp-sl-round-overlap', 'bp-sn-round-overlap', val);
    render();
    return;

  /* ── 공통: 배경색 ── */
  } else if (prop === 'bannerBgColor') {
    headerData.bannerBgColor = val;
    syncSwatch('bp-banner-bg-swatch', 'bp-banner-bg-label', val);
    /* 프리뷰 배너 배경 실시간 갱신 */
    var slot = headerPos === 'top'
      ? document.getElementById('hdr-top-slot')
      : document.getElementById('hdr-bot-slot');
    if (slot) {
      var bannerEl = slot.querySelector('.sheet-header-banner');
      if (bannerEl) bannerEl.style.background = bannerGradient(val);
    }

  /* ── 공통: 이미지 토글 ── */
  } else if (prop === 'bannerImgOn') {
    headerData.bannerImgOn = !!val;
    var sw = document.getElementById('bp-banner-img-sw');
    if (sw) sw.classList.toggle('on', !!val);
    var panel = document.getElementById('bp-hdr-img-opts');
    if (panel) panel.style.display = val ? '' : 'none';
  }

  /* ── 헤더 DOM 즉시 패치 (render() 없이 부분 갱신) ── */
  var slot = headerPos === 'top'
    ? document.getElementById('hdr-top-slot')
    : document.getElementById('hdr-bot-slot');
  if (!slot) { render(); return; }

  if (type === 'basic') {
    var bannerEl = slot.querySelector('.sheet-header-banner');
    if (bannerEl) bannerEl.style.height = headerData.bannerH + 'px';

  } else if (type === 'sns') {
    var navbar = slot.querySelector('.sns-navbar');
    if (navbar) {
      navbar.style.height     = headerData.navH + 'px';
      navbar.style.background = headerData.navBgColor   || '#ffffff';
      navbar.style.color      = headerData.navFontColor || '#212121';
      navbar.textContent      = headerData.navText      || '← BACK';
    }
    var bannerEl = slot.querySelector('.sheet-header-banner');
    if (bannerEl) bannerEl.style.height = headerData.snsH + 'px';

  } else if (type === 'round') {
    /* round는 겹침 구조상 render()가 필요 */
    render();
    return;
  }

  render();
}

/* ── 헤더 타입 전환 ── */
function switchHeaderType(type) {
  /* 헤더 이미지 편집 모드 중이면 먼저 종료 — render() 차단 해소 */
  if (activeHdrImgKind) exitHeaderImgEditMode();
  headerData.type = type;
  /* 타입 선택 버튼 on 갱신 */
  ['basic','sns','round'].forEach(function(t) {
    var btn = document.getElementById('hdr-type-' + t);
    if (btn) btn.classList.toggle('on', t === type);
  });
  /* 타입별 섹션 표시/숨김 */
  var typeMap = { basic: 'bp-hdr-basic-opts', sns: 'bp-hdr-sns-opts', round: 'bp-hdr-round-opts' };
  Object.keys(typeMap).forEach(function(t) {
    var el = document.getElementById(typeMap[t]);
    if (el) el.style.display = (t === type) ? '' : 'none';
  });
  render();
}

/* ── 헤더 이미지 트랜스폼 DOM 반영 ── */
function applyHeaderImgTransform(kind) {
  var slot = headerPos === 'top'
    ? document.getElementById('hdr-top-slot')
    : document.getElementById('hdr-bot-slot');
  if (!slot) return;
  var container = slot.querySelector('.sheet-header-banner');
  if (!container) return;
  var imgEl = container.querySelector('.hdr-img-el');
  if (!imgEl) return;
  var t = headerData.bannerImgTransform || { scale: 1, x: 0, y: 0 };
  imgEl.style.transform = 'translate(calc(-50% + ' + t.x + 'px), calc(-50% + ' + t.y + 'px)) scale(' + t.scale + ')';
}

/* ── 헤더 이미지 초기 트랜스폼 — contain 방식 (블록 initImgTransform과 동일) ── */
function initHeaderImgTransform(kind, containerEl) {
  var imgEl = containerEl.querySelector('.hdr-img-el');
  if (!imgEl) return;
  var cw = containerEl.offsetWidth;
  var ch = containerEl.offsetHeight;
  var iw = imgEl.naturalWidth  || imgEl.width  || 1;
  var ih = imgEl.naturalHeight || imgEl.height || 1;
  if (!cw || !ch || !iw || !ih) return;
  /* cover 기준(긴 변으로 맞춤) × 0.85 — 약간 작게 시작 */
  var scale = Math.max(cw / iw, ch / ih) * 0.4;
  var t = { scale: scale, x: 0, y: 0 };
  headerData.bannerImgTransform = t;
  applyHeaderImgTransform(kind);
}

/* ── 헤더 이미지 편집 모드 진입 (블록 enterImgEditMode 동일 구조) ── */

function enterHeaderImgEditMode(kind, containerEl) {
  /* 기존 편집 모드 종료 */
  if (activeHdrImgKind) exitHeaderImgEditMode();
  /* 블록 이미지 편집 모드도 종료 */
  if (activeImgKey) exitImgEditMode();
  activeHdrImgKind = kind;

  /* 편집 모드 진입 시 플로팅 툴바 제거 (힌트와 겹침 방지) */
  var hdrEl = containerEl.closest('.sheet-header-banner');
  if (hdrEl) {
    var ftb = hdrEl.querySelector('.hdr-float-toolbar');
    if (ftb) ftb.remove();
  }

  /* 기존 오버레이 재사용 */
  var overlay = containerEl.querySelector('.img-edit-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.className = 'img-edit-overlay';

    /* SVG 그라디언트 테두리 */
    var svgNS = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('class', 'march-border');
    var defs   = document.createElementNS(svgNS, 'defs');
    var grad   = document.createElementNS(svgNS, 'linearGradient');
    var gradId = 'mg-hdr-' + kind;
    grad.setAttribute('id', gradId);
    grad.setAttribute('gradientUnits', 'userSpaceOnUse');
    grad.setAttribute('x1','0'); grad.setAttribute('y1','0');
    grad.setAttribute('x2','0'); grad.setAttribute('y2','0');
    [{ offset:'0%', color:'#6B5FD0' },{ offset:'50%', color:'#d4cffa' },{ offset:'100%', color:'#6B5FD0' }].forEach(function(s) {
      var stop = document.createElementNS(svgNS, 'stop');
      stop.setAttribute('offset', s.offset);
      stop.setAttribute('stop-color', s.color);
      grad.appendChild(stop);
    });
    defs.appendChild(grad); svg.appendChild(defs);

    var rectBg = document.createElementNS(svgNS, 'rect');
    rectBg.setAttribute('class','mg-rect-bg'); rectBg.setAttribute('fill','none');
    rectBg.setAttribute('stroke','url(#' + gradId + ')'); rectBg.setAttribute('stroke-width','4'); rectBg.setAttribute('stroke-opacity','0.12');
    svg.appendChild(rectBg);
    var rect = document.createElementNS(svgNS, 'rect');
    rect.setAttribute('class','mg-rect'); rect.setAttribute('fill','none');
    rect.setAttribute('stroke','url(#' + gradId + ')'); rect.setAttribute('stroke-width','1.5');
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
      b.className = 'img-edit-btn'; b.textContent = label;
      b.onclick = function(e) { e.stopPropagation(); fn(); };
      return b;
    };
    toolbar.appendChild(mkBtn('↺ 리셋', function() { resetHeaderImgTransform(kind, containerEl); }));
    toolbar.appendChild(mkBtn('↑ 변경', function() { triggerHeaderImgUpload(kind); }));
    toolbar.appendChild(mkBtn('✓ 완료', function() { exitHeaderImgEditMode(); }));
    overlay.appendChild(toolbar);

    /* rAF 그라디언트 회전 */
    var rafId = null;
    function updateBorder() {
      var W = containerEl.offsetWidth;
      var H = containerEl.offsetHeight;
      svg.setAttribute('width', W); svg.setAttribute('height', H);
      [rect, rectBg].forEach(function(r) {
        r.setAttribute('x', 1); r.setAttribute('y', 1);
        r.setAttribute('width', W - 2); r.setAttribute('height', H - 2);
        r.setAttribute('rx', 0); r.setAttribute('ry', 0);
      });
      var perimeter = 2 * (W + H);
      var angle = ((performance.now() / 8) % 360) * Math.PI / 180;
      var cx = W / 2, cy = H / 2, dist = perimeter / 2;
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
      var t = headerData.bannerImgTransform;
      startTX = t ? t.x : 0; startTY = t ? t.y : 0;
      e.preventDefault();
    });
    window.addEventListener('mousemove', function(e) {
      if (!dragging || activeHdrImgKind !== kind) return;
      var dx = e.clientX - startX, dy = e.clientY - startY;
      if (Math.abs(dx) > 2 || Math.abs(dy) > 2) didDrag = true;
      var t = headerData.bannerImgTransform;
      if (!t) return;
      t.x = startTX + dx; t.y = startTY + dy;
      applyHeaderImgTransform(kind);
    });
    window.addEventListener('mouseup', function() { dragging = false; });
    overlay.addEventListener('click', function(e) {
      if (didDrag) { didDrag = false; e.stopPropagation(); }
    }, true);

    /* 휠 줌 */
    overlay.addEventListener('wheel', function(e) {
      e.preventDefault();
      var t = headerData.bannerImgTransform;
      if (!t) return;
      var delta = e.deltaY > 0 ? -0.05 : 0.05;
      t.scale = Math.max(0.1, Math.min(10, t.scale + delta));
      applyHeaderImgTransform(kind);
    }, { passive: false });

    containerEl.appendChild(overlay);
  }

  overlay.classList.add('active');
  overlay._startRaf && overlay._startRaf();
}

/* 헤더 이미지 편집 모드 종료 */
function exitHeaderImgEditMode() {
  if (!activeHdrImgKind) return;
  var slot = headerPos === 'top'
    ? document.getElementById('hdr-top-slot')
    : document.getElementById('hdr-bot-slot');
  if (slot) {
    /* 오버레이 비활성화 */
    var container = slot.querySelector('.sheet-header-banner');
    if (container) {
      var overlay = container.querySelector('.img-edit-overlay');
      if (overlay) { overlay.classList.remove('active'); overlay._stopRaf && overlay._stopRaf(); }
    }
    /* 플로팅 툴바 제거 — 다시 보려면 단일 클릭 */
    var hdrEl = slot.querySelector('.sheet-header-banner');
    if (hdrEl) {
      var ftb = hdrEl.querySelector('.hdr-float-toolbar');
      if (ftb) ftb.remove();
    }
  }
  activeHdrImgKind = null;
}

/* 헤더 이미지 트랜스폼 리셋 */
function resetHeaderImgTransform(kind, containerEl) {
  var t = { scale: 1, x: 0, y: 0 };
  headerData.bannerImgTransform = t;
  applyHeaderImgTransform(kind);
}

/* 헤더 이미지 변경 업로드 트리거 */
function triggerHeaderImgUpload(kind) {
  var inp = document.createElement('input');
  inp.type = 'file'; inp.accept = 'image/*'; inp.style.display = 'none';
  inp.onchange = function() {
    var file = inp.files[0];
    if (!file) { document.body.removeChild(inp); return; }
    var reader = new FileReader();
    reader.onload = function(ev) {
      /* 편집 모드 중이면 먼저 해제 — render() 차단 해소 */
      if (activeHdrImgKind) exitHeaderImgEditMode();

      headerData.bannerImgSrc = ev.target.result;
      headerData.bannerImgTransform = { scale: 1, x: 0, y: 0 };
      headerData.bannerImgOn = true;
      /* 패널 토글 버튼 on 상태 갱신 */
      var imgSw = document.getElementById('bp-banner-img-sw');
      if (imgSw) imgSw.classList.add('on');
      var imgOpts = document.getElementById('bp-hdr-img-opts');
      if (imgOpts) imgOpts.style.display = '';
      updateHdrImgThumb();
      render();
      /* 업로드 직후 contain 기준 scale 초기화 → 편집 모드 자동 재진입 */
      requestAnimationFrame(function() {
        var slot = headerPos === 'top'
          ? document.getElementById('hdr-top-slot')
          : document.getElementById('hdr-bot-slot');
        var container = slot ? slot.querySelector('.sheet-header-banner') : null;
        if (container) {
          initHeaderImgTransform(kind, container);
          enterHeaderImgEditMode(kind, container);
        }
      });
    };
    reader.readAsDataURL(file);
    document.body.removeChild(inp);
  };
  document.body.appendChild(inp);
  inp.click();
}

function showBlockPanel(type, label, blk) {
  /* 다른 블록 선택 시 스티커 편집 모드 종료 — 스티커 패널과 블록 패널이 동시에 떠 있는 문제 방지 */
  if (stickerEditMode) toggleStickerEdit();
  /* 다중 선택 상태이면 캔버스 패널로 복귀 */
  if (selKeys.length > 1) {
    showCanvasPanel();
    return;
  }
  /* 헤더 전용 패널에서 복귀할 경우 공통 스타일 섹션 복원 */
  restoreBlockPanelCommon();
  /* 현재 활성 nav 탭 기억 (블록 닫을 때 복귀용) */
  var activeBtn = document.querySelector('.float-tab.active');
  if (activeBtn) showCanvasPanel._lastNav = activeBtn.id.replace('nb-','');
  /* 모든 nav 뷰 비활성화 (BUG-9: panel-bg 추가, B-2: panel-sticker 추가) */
  ['panel-preset','panel-canvas','panel-header-nav','panel-bg','panel-sticker'].forEach(function(id) {
    var el = document.getElementById(id); if (el) el.classList.remove('active');
  });
  document.getElementById('panel-block').classList.add('active');
  var labels  = { img: '이미지 블록', title: '제목 블록', txt: '텍스트 블록', colorchip: '컬러칩 블록', item: '항목 블록', header: '헤더 블록' };
  var chipMap = { img: 'IMG', title: 'TTL', txt: 'TXT', colorchip: 'CLR', item: 'ITM', header: 'HDR' };
  var _bpSub = document.getElementById('bp-sub');
  if (_bpSub) _bpSub.textContent = (label || labels[type] || '블록') + ' 선택됨';

  /* ── ctx.fill 헤더 갱신 ── */
  var ctxThumb = document.getElementById('bp-ctx-thumb');
  var ctxName  = document.getElementById('bp-ctx-name');
  if (ctxThumb) ctxThumb.textContent = chipMap[type] || 'BLK';
  if (ctxName)  ctxName.textContent  = label || labels[type] || '블록';

  var isText      = type === 'txt' || type === 'title';
  var isImg       = type === 'img';
  var isColorchip = type === 'colorchip';
  var isItem      = type === 'item';
  document.getElementById('bp-img-opts').style.display       = isImg        ? '' : 'none';
  document.getElementById('bp-txt-opts').style.display       = isText       ? '' : 'none';
  document.getElementById('bp-colorchip-opts').style.display = isColorchip  ? '' : 'none';
  document.getElementById('bp-item-opts').style.display      = isItem       ? '' : 'none';
  /* colorchip / item — padV 미지원 → 숨김, 패널 데이터 로드 */
  if (isColorchip || isItem) {
    var padvRowCC = document.getElementById('bp-padv-row');
    if (padvRowCC) padvRowCC.style.display = 'none';
    var padvAutoRowCC = document.getElementById('bp-padv-auto-row');
    if (padvAutoRowCC) padvAutoRowCC.style.display = 'none';
    if (isColorchip && blk) renderColorchipPanel(blk);
    if (isItem && blk) showItemPanel(blk);
  }
  /* BUG-006: img 블록은 패딩 미지원 — padV 슬라이더 숨김 */
  if (isImg) {
    var padvRowImg = document.getElementById('bp-padv-row');
    if (padvRowImg) padvRowImg.style.display = 'none';
    var padvAutoRowImg = document.getElementById('bp-padv-auto-row');
    if (padvAutoRowImg) padvAutoRowImg.style.display = 'none';
    /* 업로드박스 섬네일 상태 갱신 */
    _refreshImgUploadBox(blk);
    /* 오버레이 패널 값 로드 */
    _loadImgOverlayPanel(blk);
  }
  if (isText) {
    document.getElementById('bp-txt-type-lbl').textContent = labels[type];
  }
  /* 블록 현재값을 패널에 로드 (null이면 전역값 표시) */
  if (blk) {
    /* 블록 설정 — 기본(전역 유지)/커스텀 토글 동기화 */
    var isCustomStyle  = _blkHasCustomStyle(blk);
    var styleModeDefBtn = document.getElementById('bp-style-mode-default');
    var styleModeCusBtn = document.getElementById('bp-style-mode-custom');
    if (styleModeDefBtn) styleModeDefBtn.classList.toggle('on', !isCustomStyle);
    if (styleModeCusBtn) styleModeCusBtn.classList.toggle('on', isCustomStyle);
    var bpCommonGrpEl = document.getElementById('bp-common-grp');
    if (bpCommonGrpEl) bpCommonGrpEl.style.display = isCustomStyle ? '' : 'none';
    var bpAdvEl = document.getElementById('bp-adv');
    if (bpAdvEl) bpAdvEl.style.display = isCustomStyle ? '' : 'none';
    /* 타일/세그 일괄 갱신 */
    _refreshBpTiles(blk);
    var rv  = (blk.radius  !== null && blk.radius  !== undefined) ? blk.radius  : globalVals.radius;
    var sv  = (blk.shadow  !== null && blk.shadow  !== undefined) ? blk.shadow  : globalVals.shadow;
    var opv = (blk.opacity !== null && blk.opacity !== undefined) ? blk.opacity : 100;
    var strk  = blk.stroke  || 0;
    ['bp-sl-radius','bp-sn-radius'].forEach(function(id){ var el=document.getElementById(id); if(el) el.value=rv; });
    ['bp-sl-shadow','bp-sn-shadow'].forEach(function(id){ var el=document.getElementById(id); if(el) el.value=sv; });
    ['bp-sl-stroke','bp-sn-stroke'].forEach(function(id){ var el=document.getElementById(id); if(el) el.value=strk; });
    _updateSliderUI('bp-sl-stroke', strk);
    ['bp-sl-opacity','bp-sn-opacity'].forEach(function(id){ var el=document.getElementById(id); if(el) el.value=opv; });
    var bgEl = document.getElementById('bp-bg-color');
    var bgVal = (blk.bgColor !== null && blk.bgColor !== undefined) ? blk.bgColor : globalVals.bgColor;
    if (bgEl) bgEl.value = bgVal;
    var bgSw = document.getElementById('bp-color-swatch');
    if (bgSw) bgSw.style.background = bgVal;
    var bgHex2 = document.getElementById('bp-color-hexedit');
    if (bgHex2) bgHex2.value = bgVal.toUpperCase();
    /* padV 슬라이더 로드 — null이면 라운딩 연동 자동값 표시, 자동 버튼 숨김 */
    var padVautoRow = document.getElementById('bp-padv-auto-row');
    var padVIsAuto = (blk.padV === null || blk.padV === undefined);
    var padVDisplay = padVIsAuto
      ? (rv >= 999 ? 40 : Math.max(8, Math.round(Math.min(rv, 32) * 0.5 + 8)))
      : blk.padV;
    ['bp-sl-padv','bp-sn-padv'].forEach(function(id){ var el=document.getElementById(id); if(el) el.value=padVDisplay; });
    if (padVautoRow) padVautoRow.style.display = padVIsAuto ? 'none' : '';
    /* 텍스트 스타일 로드 */
    if (type === 'txt' || type === 'title') {
      var fsEl  = document.getElementById('bp-font-size');
      var alEl  = document.getElementById('bp-align');
      var ffEl  = document.getElementById('bp-font-family');
      var fcEl  = document.getElementById('bp-font-color');
      var fcSwEl = document.getElementById('bp-font-color-swatch');
      var fcLbEl = document.getElementById('bp-font-color-label');
      var fs = blk.fontSize   || (blk.type === 'title' ? 15 : 12);
      var al = blk.textAlign  || 'left';
      var ff = blk.fontFamily || globalVals.font || 'Pretendard';
      var fc = blk.fontColor  || globalVals.fontColor || '#212121';
      if (fsEl)  fsEl.value = fs;
      if (alEl)  alEl.value = al;
      if (ffEl)  ffEl.value = ff;
      if (fcEl)  fcEl.value = fc;
      if (fcSwEl) fcSwEl.style.background = fc;
      if (fcLbEl) fcLbEl.textContent = fc.toUpperCase();
      /* 목록 형식 버튼 로드 */
      var lm = blk.listMode || 'none';
      ['none','bullet-circle','bullet-check','bullet-tri','bullet-arrow','bullet-diamond','numbered'].forEach(function(m) {
        var btn = document.getElementById('bp-lm-' + m);
        if (btn) btn.classList.toggle('on', m === lm);
        var tbtn = document.getElementById('tfb-lm-' + m);
        if (tbtn) tbtn.classList.toggle('on', m === lm);
      });
    }
  }
}

