/* canvas-render.js — 리팩토링 2단계 8번째 조각: 헤더 빌드 + 시트 렌더 + 블록 렌더(getHeaderH~makeBlk) (app/public/legacy/main.js에서 추출, 로직 변경 없음) */
function getHeaderH() {
  if (!headerPos || headerPos !== 'top') return 0;
  if (headerData.type === 'sns')   return (headerData.navH || 32) + (headerData.snsH || 120);
  if (headerData.type === 'round') return headerData.roundH || 120;
  return headerData.bannerH || 160;
}

function toggleHeader(pos) {
  if (pos === 'none') pos = null;
  var wasTop = (headerPos === 'top');
  headerPos = (headerPos === pos) ? null : pos;
  /* 상단 헤더가 꺼질 때 y 음수 블록을 y=0으로 보정 */
  if (wasTop && headerPos !== 'top') {
    blocks.forEach(function(b) { if (b.y < 0) b.y = 0; });
  }
  render();
}
function updateHeaderBtns() {
  ['hdr-btn-top','hdr-btn-bot','hdr-btn-none'].forEach(function(id) {
    var btn = document.getElementById(id); if (btn) btn.classList.remove('on');
  });
  var activeId = headerPos === 'top' ? 'hdr-btn-top' : headerPos === 'bot' ? 'hdr-btn-bot' : 'hdr-btn-none';
  var btn = document.getElementById(activeId); if (btn) btn.classList.add('on');
}
/* ── 헤더 배너 그라데이션 헬퍼 ── */
function mixWhite(hex, ratio) {
  var r = parseInt(hex.slice(1,3),16);
  var g = parseInt(hex.slice(3,5),16);
  var b = parseInt(hex.slice(5,7),16);
  var mix = ratio || 0.12;
  var br = Math.round(r + (255 - r) * mix);
  var bg = Math.round(g + (255 - g) * mix);
  var bb = Math.round(b + (255 - b) * mix);
  return '#' + [br,bg,bb].map(function(v){ return v.toString(16).padStart(2,'0'); }).join('');
}
function bannerGradient(color) {
  /* 유효한 hex가 아니면 단색 반환 */
  if (!color || !/^#[0-9a-fA-F]{6}$/.test(color)) return color;
  return 'linear-gradient(to bottom,' + color + ',' + mixWhite(color, 0.12) + ')';
}
/* 헤더 이미지 업로드 박스 썸네일 갱신 */
function updateHdrImgThumb() {
  var box = document.getElementById('bp-hdr-img-upload-box');
  if (!box) return;
  /* 기존 썸네일·삭제버튼 제거 */
  var oldThumb = box.querySelector('.hdr-thumb');
  var oldDel   = box.querySelector('.hdr-img-del-btn');
  if (oldThumb) oldThumb.remove();
  if (oldDel)   oldDel.remove();

  if (headerData.bannerImgSrc) {
    var thumb = document.createElement('img');
    thumb.className = 'hdr-thumb';
    thumb.src = headerData.bannerImgSrc;
    var delBtn = document.createElement('button');
    delBtn.className   = 'hdr-img-del-btn';
    delBtn.textContent = '✕ 삭제';
    delBtn.onclick = function(e) {
      e.stopPropagation();
      headerData.bannerImgSrc       = null;
      headerData.bannerImgTransform = { scale: 1, x: 0, y: 0 };
      headerData.bannerImgOn        = false;
      var sw = document.getElementById('bp-banner-img-sw');
      if (sw) sw.classList.remove('on');
      var opts = document.getElementById('bp-hdr-img-opts');
      if (opts) opts.style.display = 'none';
      updateHdrImgThumb();
      render();
    };
    box.appendChild(thumb);
    box.appendChild(delBtn);
  }
}

function makeHeaderBlock() {
  var type = headerData.type || 'basic';
  var bbc  = headerData.bannerBgColor || '#5B7CE6';

  /* ── 공통: 제거 버튼 ── */
  function makeRemoveBtn() {
    var xbtn = document.createElement('button');
    xbtn.className   = 'sheet-header-remove';
    xbtn.textContent = '× 제거';
    xbtn.onclick = function(e) {
      e.stopPropagation();
      if (selKey === 'header') { selKey = null; showCanvasPanel(); }
      headerPos = null;
      render();
    };
    return xbtn;
  }

  /* ── 공통: 배너 레이어 (.sheet-header-banner) ──
     basic·SNS 모두 이 레이어를 가짐.
     이미지 편집 / 플로팅 툴바의 공통 진입점. */
  function makeBannerLayer(h) {
    var banner = document.createElement('div');
    banner.className = 'sheet-header-banner';
    banner.style.height     = h + 'px';
    banner.style.background = bannerGradient(bbc);
    if (headerData.bannerImgOn && headerData.bannerImgSrc) {
      var imgEl = document.createElement('img');
      imgEl.className = 'hdr-img-el';
      imgEl.src = headerData.bannerImgSrc;
      var t = headerData.bannerImgTransform || { scale: 1, x: 0, y: 0 };
      imgEl.style.transform = 'translate(calc(-50% + ' + t.x + 'px),calc(-50% + ' + t.y + 'px)) scale(' + t.scale + ')';
      banner.appendChild(imgEl);
    }
    /* 더블클릭 → 이미지 업로드 or 편집 모드 */
    banner.ondblclick = function(e) {
      e.stopPropagation();
      if (!headerData.bannerImgSrc) triggerHeaderImgUpload('banner');
      else enterHeaderImgEditMode('banner', banner);
    };
    return banner;
  }

  /* ── 공통: 클릭 핸들러 + 플로팅 툴바 ── */
  function attachHeaderClick(el) {
    el.onclick = function(e) {
      e.stopPropagation();
      if (activeHdrImgKind) return;
      /* B-3: 더미 안내 패널(showHeaderPanel) 대신 실제 헤더 탭으로 직접 전환
         — switchNav가 selKey를 null로 비우므로 그 다음에 selKey를 설정해야 함 */
      switchNav('header');
      selKey = 'header';
      document.querySelectorAll('.blk').forEach(function(b) {
        b.style.outline = ''; b.style.outlineOffset = '';
        b.classList.remove('selected');
      });
      el.classList.add('selected');

      /* 배너 레이어가 있으면 플로팅 툴바 삽입(편집/리셋만 — 업로드 버튼은 B-6에서 제거,
         더블클릭으로 업로드) */
      var bannerEl = el.querySelector('.sheet-header-banner');
      if (!bannerEl) return;
      var oldFtb = el.querySelector('.hdr-float-toolbar');
      if (oldFtb) oldFtb.remove();
      if (activeHdrImgKind) return;

      if (headerData.bannerImgSrc) {
        var ftb = document.createElement('div');
        ftb.className = 'hdr-float-toolbar';
        var edBtn = document.createElement('button');
        edBtn.className   = 'float-btn';
        edBtn.textContent = '편집';
        edBtn.onclick = function(e2) { e2.stopPropagation(); enterHeaderImgEditMode('banner', bannerEl); };
        var rsBtn = document.createElement('button');
        rsBtn.className   = 'float-btn';
        rsBtn.textContent = '리셋';
        rsBtn.onclick = function(e2) { e2.stopPropagation(); resetHeaderImgTransform('banner', bannerEl); };
        ftb.appendChild(edBtn);
        ftb.appendChild(rsBtn);
        el.appendChild(ftb);
      }
    };
    return el;
  }

  /* ── 타입: basic ── */
  if (type === 'basic') {
    var el = document.createElement('div');
    el.className = 'sheet-header-block' + (selKey === 'header' ? ' selected' : '');
    el.appendChild(makeBannerLayer(headerData.bannerH || 160));
    el.appendChild(makeRemoveBtn());
    attachHeaderClick(el);
    return el;
  }

  /* ── 타입: sns ── */
  if (type === 'sns') {
    var el = document.createElement('div');
    el.className = 'sheet-header-sns' + (selKey === 'header' ? ' selected' : '');

    var navbar = document.createElement('div');
    navbar.className = 'sns-navbar';
    navbar.style.height     = (headerData.navH || 32) + 'px';
    navbar.style.background = headerData.navBgColor   || '#ffffff';
    navbar.style.color      = headerData.navFontColor || '#212121';
    navbar.textContent      = headerData.navText      || '← BACK';

    el.appendChild(navbar);
    el.appendChild(makeBannerLayer(headerData.snsH || 120));
    el.appendChild(makeRemoveBtn());
    attachHeaderClick(el);
    return el;
  }

  /* ── 타입: round ── */
  if (type === 'round') {
    var roundH   = headerData.roundH || 120;
    var overlap  = headerData.roundOverlap !== undefined ? headerData.roundOverlap : 24;

    var el = document.createElement('div');
    el.className = 'sheet-header-round' + (selKey === 'header' ? ' selected' : '');

    /* 배너 높이는 roundH 고정.
       paddingBottom으로 overlap만큼 배경 영역을 확보 —
       sheet-pad가 올라와 덮어도 배너 배경색이 부족하지 않음.
       overflow: visible 로 sheet-pad 라운딩 모서리가 배너 위에 보임 */
    var bannerLayer = makeBannerLayer(roundH);
    bannerLayer.style.paddingBottom = (overlap + (sheetRadius || 0)) + 'px';
    bannerLayer.style.overflow      = 'visible';

    el.appendChild(bannerLayer);
    el.appendChild(makeRemoveBtn());
    attachHeaderClick(el);
    return el;
  }

  /* fallback */
  headerData.type = 'basic';
  return makeHeaderBlock();
}

/* 헤더 편집 종료 */
function commitHeaderEdit() {
  if (!isEditing || editingKey !== 'header') return;
  isEditing  = false;
  editingKey = null;
}

/* ══════════════════════════════════════════
   프리셋
══════════════════════════════════════════ */
function selectPreset(id) {
  ['a1','a2'].forEach(function(p) {
    document.getElementById('preset-' + p).classList.toggle('selected', p === id);
  });
  _blkIdCounter = 0;
  if (id === 'a1') {
    blocks = [
      { id: _nextBlkId(), x: 12,  y: 12,  w: 260, h: 500, groupId: 'g_01', type: 'img', imgSrc: null, imgTransform: { scale:1, x:0, y:0 }, radius: null, shadow: null, opacity: null, bgColor: null },
      { id: _nextBlkId(), x: 284, y: 12,  w: 216, h: 247, groupId: 'g_01', type: 'img', imgSrc: null, imgTransform: { scale:1, x:0, y:0 }, radius: null, shadow: null, opacity: null, bgColor: null },
      { id: _nextBlkId(), x: 284, y: 271, w: 216, h: 241, groupId: 'g_01', type: 'img', imgSrc: null, imgTransform: { scale:1, x:0, y:0 }, radius: null, shadow: null, opacity: null, bgColor: null },
      { id: _nextBlkId(), x: 512, y: 12,  w: 276, h: 500, groupId: 'g_01', type: 'txt', spans: [{ text: '' }], radius: null, shadow: null, opacity: null, bgColor: null }
    ];
  } else {
    blocks = [
      { id: _nextBlkId(), x: 12,  y: 12,  w: 260, h: 200, groupId: 'g_01', type: 'img', imgSrc: null, imgTransform: { scale:1, x:0, y:0 }, radius: null, shadow: null, opacity: null, bgColor: null },
      { id: _nextBlkId(), x: 284, y: 12,  w: 216, h: 94,  groupId: 'g_01', type: 'img', imgSrc: null, imgTransform: { scale:1, x:0, y:0 }, radius: null, shadow: null, opacity: null, bgColor: null },
      { id: _nextBlkId(), x: 284, y: 118, w: 216, h: 94,  groupId: 'g_01', type: 'img', imgSrc: null, imgTransform: { scale:1, x:0, y:0 }, radius: null, shadow: null, opacity: null, bgColor: null },
      { id: _nextBlkId(), x: 512, y: 12,  w: 276, h: 200, groupId: 'g_01', type: 'txt', spans: [{ text: '' }], radius: null, shadow: null, opacity: null, bgColor: null }
    ];
  }
  selKey = null;
  selKeys = [];
  render();
  showCanvasPanel();
}

/* ══════════════════════════════════════════
   렌더
══════════════════════════════════════════ */
function render() {
  if (isEditing || activeImgKey || activeHdrImgKind) return;
  _isRendering = true;
  try {

  /* ── 헤더 슬롯 ── */
  var topSlot = document.getElementById('hdr-top-slot');
  var botSlot = document.getElementById('hdr-bot-slot');
  topSlot.innerHTML = ''; botSlot.innerHTML = '';
  topSlot.classList.toggle('visible', headerPos === 'top');
  botSlot.classList.toggle('visible', headerPos === 'bot');
  if (headerPos === 'top') topSlot.appendChild(makeHeaderBlock());
  if (headerPos === 'bot') botSlot.appendChild(makeHeaderBlock());
  updateSheetRadius(sheetRadius);

  /* ── sheet-pad: 자유 배치 컨테이너 ── */
  var pad = document.getElementById('sheet-pad');
  pad.innerHTML = '';
  pad.style.display   = 'block';
  pad.style.position  = 'relative';
  pad.style.width     = canvasW + 'px';

  /* ── 라운드 헤더 겹침 처리 ── */
  var isRound = (headerData.type === 'round' && headerPos !== null);
  if (isRound) {
    var overlap = headerData.roundOverlap !== undefined ? headerData.roundOverlap : 24;
    var sr = sheetRadius;
    pad.style.marginTop    = headerPos === 'top'  ? '-' + overlap + 'px' : '';
    pad.style.marginBottom = headerPos === 'bot' ? '-' + overlap + 'px' : '';
    pad.style.borderRadius = sr + 'px';
    pad.style.position     = 'relative';
    pad.style.zIndex       = '2';
    pad.style.boxShadow    = headerPos === 'top'
      ? '0 -6px 16px rgba(0,0,0,0.13)'
      : '0  6px 16px rgba(0,0,0,0.13)';
    pad.style.backgroundColor = sheetBg || '#ffffff';
  } else {
    pad.style.marginTop       = '';
    pad.style.marginBottom    = '';
    pad.style.borderRadius    = sheetRadius + 'px';
    pad.style.zIndex          = '';
    pad.style.boxShadow       = '';
    pad.style.backgroundColor = '';
  }

  /* ── 그룹 여집합 백플레이트 (블록보다 먼저 삽입 → 블록 뒤에 위치) ── */
  (function() {
    var groupMap = {};
    blocks.forEach(function(blk) {
      if (!blk.groupId) return;
      if (!groupMap[blk.groupId]) groupMap[blk.groupId] = [];
      groupMap[blk.groupId].push(blk);
    });
    Object.keys(groupMap).forEach(function(gid) {
      var grpBlks = groupMap[gid];
      var minX = Math.min.apply(null, grpBlks.map(function(b) { return b.x; }));
      var minY = Math.min.apply(null, grpBlks.map(function(b) { return b.y; }));
      var maxX = Math.max.apply(null, grpBlks.map(function(b) { return b.x + b.w; }));
      var maxY = Math.max.apply(null, grpBlks.map(function(b) { return b.y + b.h; }));
      var plate = document.createElement('div');
      plate.className = 'grp-gap-plate';
      plate.dataset.gi = gid;
      plate.style.left   = (minX - 4) + 'px';
      plate.style.top    = (minY - 4) + 'px';
      plate.style.width  = (maxX - minX + 8) + 'px';
      plate.style.height = (maxY - minY + 8) + 'px';
      plate.addEventListener('mousedown', function(e) {
        if (e.button !== 0) return;
        if (_spaceDown) return;  /* Space+드래그 패닝은 기존 로직에 위임 */
        e.stopPropagation();
        if (isEditing) return;
        /* 여집합 드래그 — 그룹 전체 이동 설정 */
        var repBlk = grpBlks[0];
        if (!repBlk) return;
        var stageEl0 = document.getElementById('canvas-stage');
        var sr0 = stageEl0 ? stageEl0.getBoundingClientRect() : { left: 0, top: 0 };
        var mcx = (e.clientX - sr0.left) / _zoomLevel;
        var mcy = (e.clientY - sr0.top)  / _zoomLevel;
        var relPos = {};
        grpBlks.forEach(function(gb) {
          if (gb.id !== repBlk.id) relPos[gb.id] = { dx: gb.x - repBlk.x, dy: gb.y - repBlk.y };
        });
        /* 그룹 선택 상태로 전환 (이동 중 오버레이·툴바 표시) */
        _grpIndividualMode = false;
        selectedGi = gid;
        selKeys = grpBlks.map(function(b) { return b.id; });
        selKey = null;
        document.querySelectorAll('.blk').forEach(function(blkEl) {
          blkEl.classList.remove('selected');
          blkEl.style.outline = '';
          blkEl.style.outlineOffset = '';
        });
        showGroupToolbar(gid);
        saveHistory();
        blkDrag = { id: repBlk.id,
                    startX: e.clientX, startY: e.clientY,
                    offsetX: mcx - repBlk.x, offsetY: mcy - repBlk.y,
                    groupId: gid,
                    relPositions: relPos,
                    didMove: false };
      });
      plate.addEventListener('click', function(e) {
        if (e.button !== 0) return;
        e.stopPropagation();
        /* 드래그로 이동한 경우 click 무시 */
        if (blkDrag && blkDrag.didMove) return;
        if (isEditing) return;
        _grpIndividualMode = false;
        selectedGi = gid;
        selKeys = grpBlks.map(function(b) { return b.id; });
        selKey = null;
        hideTxtFormatBar();
        hideAlignToolbar();
        /* 기존 블록 outline 모두 해제 */
        document.querySelectorAll('.blk').forEach(function(blkEl) {
          blkEl.classList.remove('selected');
          blkEl.style.outline = '';
          blkEl.style.outlineOffset = '';
        });
        showCanvasPanel();
        showGroupToolbar(gid);
        /* 호버 오버레이 제거 */
        var hov = document.getElementById('grp-hover-' + gid);
        if (hov) hov.remove();
      });
      plate.addEventListener('mouseenter', function() {
        if (selectedGi === gid) return;
        if (selKey !== null || selKeys.length > 0) return;  /* F-03: 블록 선택 중 호버 억제 */
        var existing = document.getElementById('grp-hover-' + gid);
        if (existing) return;
        var hov = document.createElement('div');
        hov.className = 'grp-hover-overlay';
        hov.id = 'grp-hover-' + gid;
        hov.style.left   = (minX - 9) + 'px';
        hov.style.top    = (minY - 9) + 'px';
        hov.style.width  = (maxX - minX + 18) + 'px';
        hov.style.height = (maxY - minY + 18) + 'px';
        pad.appendChild(hov);
      });
      plate.addEventListener('mouseleave', function() {
        var hov = document.getElementById('grp-hover-' + gid);
        if (hov) hov.remove();
      });
      plate.addEventListener('contextmenu', function(e) {
        e.stopPropagation();
        /* 여집합 우클릭: 그룹 선택 상태로 전환 후 "그룹 선택" 메뉴 표시 */
        _grpIndividualMode = false;
        selectedGi = gid;
        selKeys = grpBlks.map(function(b) { return b.id; });
        selKey = null;
        document.querySelectorAll('.blk').forEach(function(blkEl) {
          blkEl.classList.remove('selected');
          blkEl.style.outline = '';
          blkEl.style.outlineOffset = '';
        });
        showCanvasPanel();
        showGroupToolbar(gid);
        showCtxMenu(e, gid);
      });
      pad.appendChild(plate);
    });
  })();

  /* ── blocks 배열 순회 → position:absolute 배치 ── */
  var maxBottom = 0;
  blocks.forEach(function(blk, _bi) {
    var el = makeBlk(blk);
    el.style.position = 'absolute';
    el.style.left     = blk.x + 'px';
    el.style.top      = blk.y + 'px';
    el.style.width    = blk.w + 'px';
    /* 선택 블록을 다른 블록 위에 — 겹침 시 외곽선 가려짐 방지
       단, 편집 중인 블록은 제외 — 중첩 블록 편집 진입 시 z-order(배치 순서)가 유지되어야 함 */
    var _isEditingThis = isEditing && editingKey === blk.id;
    var _isSelBlk = !_isEditingThis && (blk.id === selKey || selKeys.indexOf(blk.id) !== -1);
    el.style.zIndex = _isSelBlk ? String(blocks.length + 10) : String(_bi + 1);
    pad.appendChild(el);
    var bottom = blk.y + blk.h;
    if (bottom > maxBottom) maxBottom = bottom;
  });

  updateHeaderBtns();
  applyGaps();

  /* colorchip 최소 높이 보정 */
  blocks.forEach(function(blk) {
    if (blk.type !== 'colorchip') return;
    var minH = _ccMinH(blk);
    if (blk.h < minH) {
      blk.h = minH;
      var el2 = document.querySelector('.blk[data-key="' + blk.id + '"]');
      if (el2) el2.style.height = minH + 'px';
    }
  });

  /* vAlign 보정 — render 후 rAF */
  requestAnimationFrame(function() {
    applyVAlignAll();
    /* 다중 선택 DOM 복원 */
    /* 그룹 선택 상태에서는 개별 블록 outline 표시 안 함 (③ 상태: 프레임만) */
    if (selKeys.length > 0 && !selectedGi) {
      var validKeys = [];
      selKeys.forEach(function(k) {
        var blkEl = document.querySelector('.blk[data-key="' + k + '"]');
        if (blkEl) {
          blkEl.classList.add('selected');
          blkEl.style.outline = '2.0px solid var(--accent)';
          blkEl.style.outlineOffset = '3px';
          var _bd = getBlkByKey(k);
          blkEl.style.boxShadow = _blkSelBoxShadow(_bd);
          validKeys.push(k);
        }
      });
      selKeys = validKeys;
      if (selKey && selKeys.indexOf(selKey) === -1) {
        selKey = selKeys.length > 0 ? selKeys[selKeys.length - 1] : null;
      }
      if (selKeys.length >= 2) showAlignToolbar();
    }
    /* 단일 선택 outline 복원 — selKeys=[]이고 selKey만 있는 경우 rAF에서 처리 안 됨 */
    if (selKey && selKey !== 'header' && selKeys.length === 0) {
      var _soEl = document.querySelector('.blk[data-key="' + selKey + '"]');
      if (_soEl) {
        _soEl.classList.add('selected');
        _soEl.style.outline = '2.0px solid var(--accent)';
        _soEl.style.outlineOffset = '3px';
        _soEl.style.boxShadow = _blkSelBoxShadow(getBlkByKey(selKey));
      }
    }
  });
  /* 그룹 선택 오버레이 — 동기 복원 (rAF 내 처리 시 한 프레임 공백으로 깜빡임) */
  if (selectedGi && blocks.some(function(b) { return b.groupId === selectedGi; })) {
    showGroupToolbar(selectedGi);
  }
  applySheetBgLayer();
  autoCanvasH();
  } finally {
    _isRendering = false;
  }
}

/* txt 블록 콘텐츠를 항상 수직 중앙에 위치시키기 위해 padding-top/bottom을 보정
   contenteditable div의 scrollHeight로 실제 콘텐츠 높이 측정 */
function applyVAlignAll() {
  document.querySelectorAll('.blk-txt').forEach(function(blkEl) {
    var key = blkEl.dataset.key;
    if (!key) return;
    var clip = blkEl.querySelector('.blk-content-clip');
    if (!clip) return;
    var blk = getBlkByKey(key);
    if (!blk) return;
    var ta = blkEl.querySelector('.blk-text-area');
    if (!ta) return;
    var r = (blk.radius !== null && blk.radius !== undefined) ? blk.radius : globalVals.radius;
    var basePad = (blk.padV !== null && blk.padV !== undefined)
      ? blk.padV
      : Math.max(Math.max(8, Math.round(Math.min(r, 32) * 0.5 + 8)), _cornerSafeMargin(r, blkEl.offsetWidth, blkEl.offsetHeight));
    var contentH = ta.scrollHeight;
    var blkH  = blkEl.offsetHeight;
    var innerH = blkH - basePad * 2;
    var va = blk.vAlign || 'center';
    var offset = va === 'top'    ? 0
               : va === 'bottom' ? Math.max(0, innerH - contentH)
               :                   Math.max(0, Math.floor((innerH - contentH) / 2));
    clip.style.paddingTop    = (basePad + offset) + 'px';
    clip.style.paddingBottom = basePad + 'px';
  });
}

function makeBlk(blk) {
  var key = blk.id; /* 구버전 "gi-ci-bi" key 체계 대체 */
  /* gi, ci, bi 파라미터 제거 — 하위 클로저에서 blk.id 직접 사용 */
  var el = document.createElement('div');
  var isSel = _isSelected(key);
  var typeMap = { img: 'blk-img', txt: 'blk-txt', colorchip: 'blk-colorchip', item: 'blk-item' };
  el.className = 'blk ' + (typeMap[blk.type] || 'blk-txt') + (isSel ? ' selected' : '');
  el.dataset.key = key;  /* getBlkMinH에서 DOM 조회용 */
  var _minH = blk.type === 'colorchip' ? _ccMinH(blk) : blk.type === 'item' ? _itemMinH(blk) : null;
  el.style.height = (_minH !== null ? Math.max(blk.h, _minH) : blk.h) + 'px';

  /* 스타일 — 블록 개별값 우선, null이면 전역값 상속 */
  var r  = (blk.radius  !== null && blk.radius  !== undefined) ? blk.radius  : globalVals.radius;
  var sh = (blk.shadow  !== null && blk.shadow  !== undefined) ? blk.shadow  : globalVals.shadow;
  var op = (blk.opacity !== null && blk.opacity !== undefined) ? blk.opacity : 100;
  var bg = (blk.bgColor !== null && blk.bgColor !== undefined) ? blk.bgColor : globalVals.bgColor;
  el.style.borderRadius = r + 'px';
  el.style.background = hexWithAlpha(bg, op);
  var strk = blk.stroke || 0;
  var strokeShadow = _blkStrokeShadow(blk);
  /* 이미지 블록은 imgWrap이 stroke를 덮으므로 el boxShadow에는 drop shadow만 적용 (stroke는 overlay로 처리) */
  var elStrokeShadow = blk.type === 'img' ? '' : strokeShadow;
  if (sh > 0) {
    var dropShadow = sh >= 2
      ? '0 6px 16px rgba(0,0,0,.18)'
      : sh >= 1
        ? '0 1px 3px rgba(0,0,0,.12), 0 1px 2px rgba(0,0,0,.06)'
        : (function(){ var sv=sh*0.8; return '0 '+Math.round(sv*0.5)+'px '+Math.round(sv*2)+'px rgba(0,0,0,'+(0.06+sh*0.012)+')'; })();
    el.style.boxShadow = elStrokeShadow ? dropShadow + ',' + elStrokeShadow : dropShadow;
  } else {
    el.style.boxShadow = elStrokeShadow || 'none';
  }
  /* txt — 패딩: blk.padV가 수동값이면 사용, null이면 라운딩 연동 자동 계산.
     32 캡 기반 기본값에, 박스 크기 대비 라운딩이 과대한 경우(원형 등) 모서리 호가
     콘텐츠를 깎지 않도록 _cornerSafeMargin()로 계산한 여백을 추가로 보장(둘 중 큰 값) */
  var _txtClip = null;
  if (blk.type === 'txt') {
    var pad = (blk.padV !== null && blk.padV !== undefined)
      ? blk.padV
      : Math.max(Math.max(8, Math.round(Math.min(r, 32) * 0.5 + 8)), _cornerSafeMargin(r, blk.w, blk.h));
    el.dataset.pad = pad;  /* 높이 계산에서 패딩 보정용 */
    /* 원형(고라운딩) 시 내용 노출 방지 — el 자체는 overflow:visible 유지(리사이즈 핸들
       보존), 내용은 el과 동일한 박스를 덮는 클리핑 래퍼 안에 넣고 패딩도 여기로 이동 */
    _txtClip = document.createElement('div');
    _txtClip.className = 'blk-content-clip';
    _txtClip.style.padding = pad + 'px';
    el.appendChild(_txtClip);
    /* vAlign padding-top 보정은 render() 후 applyVAlignAll()에서 처리 */
  }
  /* 내부 콘텐츠 */
  if (blk.type === 'img') {
    /* 이미지 클리핑 래퍼 */
    var imgWrap = document.createElement('div');
    imgWrap.className = 'blk-img-wrap';
    if (blk.imgSrc) {
      var imgEl = document.createElement('img');
      imgEl.className = 'blk-img-el';
      imgEl.src = blk.imgSrc;
      var t = blk.imgTransform || { scale:1, x:0, y:0 };
      imgEl.style.transform =
        'translate(calc(-50% + ' + t.x + 'px), calc(-50% + ' + t.y + 'px)) scale(' + t.scale + ')';
      imgWrap.appendChild(imgEl);
    } else {
      var lb = document.createElement('div'); lb.className = 'blk-inner-label';
      lb.textContent = '더블클릭으로 이미지 업로드';
      imgWrap.appendChild(lb);
    }
    /* 이미지 있을 때 — 그라디언트·텍스트 오버레이 */
    if (blk.imgSrc) {
      if (blk.gradOn) {
        var gradDiv = document.createElement('div');
        gradDiv.className = 'blk-img-gradient';
        var _dirMap = { top:'to top', bottom:'to bottom', left:'to left', right:'to right' };
        var _gDir    = _dirMap[blk.gradDir] || 'to bottom';
        var _gs    = blk.gradStart || { hex: '#000000', a: 0,  pos: 0   };
        var _ge    = blk.gradEnd   || { hex: '#000000', a: 65, pos: 100 };
        var _gPos0 = _gs.pos !== undefined ? _gs.pos : (blk.gradOffset !== undefined ? blk.gradOffset : 0);
        var _gPos1 = _ge.pos !== undefined ? _ge.pos : 100;
        gradDiv.style.background = 'linear-gradient(' + _gDir + ',' + _hexAlpha(_gs.hex, _gs.a) + ' ' + _gPos0 + '%,' + _hexAlpha(_ge.hex, _ge.a) + ' ' + _gPos1 + '%)';
        imgWrap.appendChild(gradDiv);
      }
    }
    el.appendChild(imgWrap);

    /* 이미지 외곽선 오버레이 — imgWrap 위에 올라가 stroke를 img 위에 표시 */
    if (strk > 0) {
      var strokeOverlay = document.createElement('div');
      strokeOverlay.className = 'blk-stroke-overlay';
      strokeOverlay.style.boxShadow = strokeShadow;
      el.appendChild(strokeOverlay);
    }

    /* 더블클릭 → 이미지 없으면 업로드, 있으면 편집모드 */
    el.ondblclick = (function(k, b) { return function(e) {
      e.stopPropagation();
      if (!b.imgSrc) triggerImgUpload(k);
      else enterImgEditMode(k);
    };})(key, blk);
  } else if (blk.type === 'txt') {
    /* contenteditable div — 인라인 서식 지원 */
    var textArea = document.createElement('div');
    textArea.className = 'blk-text-area blk-text-body';
    textArea.setAttribute('contenteditable', 'false');
    textArea.setAttribute('data-placeholder', '텍스트를 입력하세요');
    textArea.setAttribute('spellcheck', 'false');
    textArea.style.textShadow = _textShadowCSS(blk.tstroke, blk.tstrokeColor);
    textArea.style.lineHeight = blk.lineHeight || 1.6;

    /* 보기 모드 초기 텍스트 표시 — spans 서식 반영 */
    (function(b, el2) {
      var lm = b.listMode || 'none';
      var hasFormat = b.spans && b.spans.some(function(s) {
        return s.bold || s.italic || s.underline || s.color || s.bg || s.fontSize || s.tstroke !== undefined;
      });
      if (lm !== 'none') {
        /* 목록형: 기호 포함 순수 텍스트 표시 */
        var lines = (b.text || '').split('\n');
        el2.textContent = lines.map(function(line, idx) {
          return getListPrefix(lm, idx) + line;
        }).join('\n');
      } else if (hasFormat) {
        /* 서식 있음: spans → innerHTML
           모든 span에 font-size 명시 — blk.fontSize 변경 시 자식 span이 컨테이너를 무시하는 문제 방지 */
        var bFs = b.fontSize || 12;
        el2.innerHTML = b.spans.map(function(s) {
          var t = s.text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br>');
          var style = 'font-size:' + (s.fontSize || bFs) + 'px;';
          if (s.bold)      style += 'font-weight:700;';
          if (s.italic)    style += 'font-style:italic;';
          if (s.underline) style += 'text-decoration:underline;';
          if (s.color)     style += 'color:' + s.color + ';';
          if (s.bg)        style += 'background:' + s.bg + ';';
          var vTshAttr = '';
          if (s.tstroke !== undefined) {
            if (s.tstroke > 0) {
              style += 'text-shadow:' + _textShadowCSS(s.tstroke, s.tstrokeColor || b.tstrokeColor) + ';';
              vTshAttr = ' data-tstroke="' + s.tstroke + '"' + (s.tstrokeColor ? ' data-tstroke-color="' + s.tstrokeColor + '"' : '');
            } else {
              style += 'text-shadow:none;';
            }
          }
          return '<span style="' + style + '"' + vTshAttr + '>' + t + '</span>';
        }).join('');
      } else {
        el2.textContent = b.text || '';
      }
    })(blk, textArea);

    /* input — 높이 자동 늘어남 + 목록 기호 실시간 유지 */
    textArea.addEventListener('input', (function(b, texEl, parentEl) { return function() {
      var lm = b.listMode || 'none';
      if (lm !== 'none') {
        /* Selection 저장 */
        var sel = window.getSelection();
        var range = sel.rangeCount ? sel.getRangeAt(0) : null;
        var anchorOffset = range ? range.startOffset : 0;

        var raw   = texEl.textContent;
        var lines = raw.split('\n');
        var fixed = lines.map(function(line, idx) {
          var prefix = getListPrefix(lm, idx);
          if (!line.startsWith(prefix)) {
            return prefix + line.replace(/^[•✔‣➤❖\d]+\.?\s?/, '');
          }
          return line;
        });
        var newText = fixed.join('\n');
        if (newText !== raw) {
          texEl.textContent = newText;
          /* 커서를 줄 끝 또는 prefix 이후로 복원 */
          try {
            var node = texEl.firstChild;
            if (node) {
              var safeOffset = Math.min(anchorOffset, node.textContent.length);
              var r2 = document.createRange();
              r2.setStart(node, safeOffset);
              r2.collapse(true);
              sel.removeAllRanges();
              sel.addRange(r2);
            }
          } catch(e) {}
        }
        /* 빈 상태 → 기호 1줄 복원 */
        if (!texEl.textContent) {
          var p0 = getListPrefix(lm, 0);
          texEl.textContent = p0;
          try {
            var nd = texEl.firstChild;
            if (nd) {
              var r3 = document.createRange();
              r3.setStart(nd, p0.length);
              r3.collapse(true);
              var s3 = window.getSelection();
              s3.removeAllRanges();
              s3.addRange(r3);
            }
          } catch(e) {}
        }
      }
      /* 높이 자동 늘어남 */
      var padV      = parseInt(parentEl.dataset.pad || 8) * 2;
      var contentH  = texEl.scrollHeight + padV;
      if (contentH > b.h) {
        b.h = contentH;
        parentEl.style.height = contentH + 'px';
      }
      /* 너비 자동 늘어남 — txt는 줄바꿈으로 대응하므로 제외 */
      if (b.type !== 'txt') {
        var minW = getTextMinW(parentEl);
        if (minW > b.w) {
          b.w = minW;
          parentEl.style.width = minW + 'px';
        }
      }
    };})(blk, textArea, el));

    /* keydown — 목록형 키 동작 제어 (Enter / Backspace / Delete) */
    textArea.addEventListener('keydown', (function(b, texEl) { return function(e) {
      var lm = b.listMode || 'none';
      if (lm === 'none') return;

      var sel   = window.getSelection();
      if (!sel.rangeCount) return;
      var range = sel.getRangeAt(0);

      /* 전체 텍스트와 커서 절대 위치 계산 */
      var fullText = texEl.textContent;
      var lines    = fullText.split('\n');

      /* 커서 절대 offset 계산 (textContent 기준) */
      function getCaretOffset(container) {
        var s = window.getSelection();
        if (!s.rangeCount) return 0;
        var r = s.getRangeAt(0);
        var pre = r.cloneRange();
        pre.selectNodeContents(container);
        pre.setEnd(r.startContainer, r.startOffset);
        return pre.toString().length;
      }
      function setCaretOffset(container, offset) {
        var node = container.firstChild;
        if (!node) return;
        var safe = Math.min(offset, node.textContent.length);
        try {
          var r2 = document.createRange();
          r2.setStart(node, safe);
          r2.collapse(true);
          var s2 = window.getSelection();
          s2.removeAllRanges();
          s2.addRange(r2);
        } catch(err) {}
      }

      var caretPos  = getCaretOffset(texEl);
      var caretEnd  = (function() {
        if (!sel.rangeCount) return caretPos;
        var r2 = sel.getRangeAt(0).cloneRange();
        var pre2 = r2.cloneRange();
        pre2.selectNodeContents(texEl);
        pre2.setEnd(r2.endContainer, r2.endOffset);
        return pre2.toString().length;
      })();

      /* 커서가 속한 줄 인덱스 + 줄 시작 절대 위치 */
      var accumulated = 0;
      var lineIdx = 0;
      for (var li = 0; li < lines.length; li++) {
        var lineEnd2 = accumulated + lines[li].length;
        if (caretPos <= lineEnd2) { lineIdx = li; break; }
        accumulated += lines[li].length + 1; /* +1: \n */
        lineIdx = li;
      }
      var lineStart   = accumulated;
      var prefix      = getListPrefix(lm, lineIdx);
      var prefixEnd   = lineStart + prefix.length;

      /* ── Enter ── */
      if (e.key === 'Enter') {
        e.preventDefault();
        var nextPrefix = getListPrefix(lm, lineIdx + 1);
        var before2    = fullText.slice(0, caretPos);
        var after2     = fullText.slice(caretEnd);
        var newText    = before2 + '\n' + nextPrefix + after2;
        texEl.textContent = newText;
        setCaretOffset(texEl, caretPos + 1 + nextPrefix.length);
        texEl.dispatchEvent(new Event('input'));
        return;
      }

      /* ── Backspace ── */
      if (e.key === 'Backspace') {
        if (caretPos !== caretEnd) {
          /* 범위 선택 — 기호 영역 포함 시 차단 */
          var safeStart = Math.max(caretPos, prefixEnd);
          if (safeStart > caretEnd) { e.preventDefault(); return; }
          e.preventDefault();
          var newText2 = fullText.slice(0, safeStart) + fullText.slice(caretEnd);
          texEl.textContent = newText2;
          setCaretOffset(texEl, safeStart);
          texEl.dispatchEvent(new Event('input'));
          return;
        }
        if (caretPos <= prefixEnd) {
          if (lineIdx === 0) { e.preventDefault(); return; }
          e.preventDefault();
          var prevLineIdx  = lineIdx - 1;
          var prevPrefix   = getListPrefix(lm, prevLineIdx);
          var prevContent  = lines[prevLineIdx].slice(prevPrefix.length);
          var curContent   = lines[lineIdx].slice(prefix.length);
          var merged       = prevPrefix + prevContent + curContent;
          var newLines     = lines.slice(0, prevLineIdx)
            .concat([merged])
            .concat(lines.slice(lineIdx + 1).map(function(ln, i) {
              if (lm !== 'numbered') return ln;
              return (prevLineIdx + 1 + i + 1) + '. ' + ln.replace(/^\d+\.\s/, '');
            }));
          var newPos = lines.slice(0, prevLineIdx).join('\n').length
            + (prevLineIdx > 0 ? 1 : 0)
            + merged.length - curContent.length;
          texEl.textContent = newLines.join('\n');
          setCaretOffset(texEl, newPos);
          texEl.dispatchEvent(new Event('input'));
          return;
        }
        return;
      }

      /* ── Delete ── */
      if (e.key === 'Delete') {
        if (caretPos !== caretEnd) return;
        var lineEnd3 = lineStart + lines[lineIdx].length;
        if (caretPos === lineEnd3 && lineIdx < lines.length - 1) {
          e.preventDefault();
          var nextContent = lines[lineIdx + 1].slice(getListPrefix(lm, lineIdx + 1).length);
          var newLines2   = lines.slice(0, lineIdx)
            .concat([lines[lineIdx] + nextContent])
            .concat(lines.slice(lineIdx + 2).map(function(ln, i) {
              if (lm !== 'numbered') return ln;
              return (lineIdx + 1 + i + 1) + '. ' + ln.replace(/^\d+\.\s/, '');
            }));
          texEl.textContent = newLines2.join('\n');
          setCaretOffset(texEl, caretPos);
          texEl.dispatchEvent(new Event('input'));
          return;
        }
        return;
      }
    };})(blk, textArea));

    _txtClip.appendChild(textArea);
    applyTextStyleToEl(textArea, blk);
  } else if (blk.type === 'colorchip') {
    renderColorchipContent(blk, el, key);
  } else if (blk.type === 'item') {
    /* 개별 블록에 CSS 변수 설정 (전역 시트 변수 대신 per-blk 방식) */
    el.style.setProperty('--item-size-scale', (blk.itemSizeScale || 100) / 100);
    el.style.setProperty('--item-gap-scale',  (blk.itemGapScale  || 100) / 100);
    /* 버튼식(pm-chip) 전용 — 버튼 텍스트크기·라운딩·폰트색 (항목 전체 크기와 별개) */
    el.style.setProperty('--item-btn-font-scale', (blk.itemBtnFontScale || 100) / 100);
    el.style.setProperty('--item-btn-radius', ((blk.itemBtnRadius !== null && blk.itemBtnRadius !== undefined) ? blk.itemBtnRadius : 8) + 'px');
    if (blk.itemBtnColor) el.style.setProperty('--item-btn-color', blk.itemBtnColor);
    else el.style.removeProperty('--item-btn-color');
    renderItemContent(blk, el);
  }
  /* .cc-block/.pm 콘텐츠(칩 라벨 등)는 자기 박스 가장자리에 바로 붙어있어서, .pm/.cc-block
     자신에게 조금이라도 양수의 border-radius를 주면 그 라운딩이 콘텐츠를 깎아먹는다(라운딩
     보정값을 "부모radius-padding"으로 줄여도 마찬가지 — 줄어든 값도 여전히 양수면 같은
     문제가 재발). 올바른 해법은 .pm/.cc-block 자신은 항상 radius:0(사각형)로 두고, 부모
     padding을 _cornerSafeMargin()으로 충분히 키워 그 사각형 박스 전체가 부모의 둥근/원형
     윤곽 안에 통째로 내접하도록 만드는 것 — 이러면 콘텐츠가 깎이지도, 윤곽 밖으로 튀어나오지도
     않는다(내접 사각형이면 그 사각형의 모든 점이 곡선 안쪽에 있다는 게 기하학적으로 보장됨).
     overflow:hidden은 안전망으로 유지(패딩이 부족한 예외 상황 대비). */
  if (blk.type === 'colorchip' || blk.type === 'item') {
    var _boxH = _minH !== null ? Math.max(blk.h, _minH) : blk.h;
    var _ccItemPad = Math.max(8, _cornerSafeMargin(r, blk.w, _boxH));
    var _innerClip = el.querySelector(blk.type === 'colorchip' ? '.cc-block' : '.pm');
    if (blk.type === 'colorchip') {
      if (_innerClip) _innerClip.style.padding = _ccItemPad + 'px';
    } else {
      el.style.padding = _ccItemPad + 'px';
    }
    if (_innerClip) _innerClip.style.borderRadius = '0px';
  }


  /* 블록 전체 드래그 — 클릭 선택과 공존: didMove=false면 클릭으로 처리 */
  el.addEventListener('mousedown', (function(b) { return function(e) {
    /* bug 3 방지: 미들클릭(휠클릭) 패닝 중 블록 이동 방지 */
    if (e.button !== 0) return;
    if (isEditing || activeImgKey) return;
    /* 잠긴 블록 — 드래그 차단 (선택은 onclick에서 허용) */
    if (b.locked) return;
    /* 리사이즈 핸들은 자체 mousedown으로 처리 */
    if (e.target.closest('.blk-resize-handle')) return;
    /* 편집 중인 contenteditable 요소나 폼 요소 제외 */
    if (e.target.closest('[contenteditable="true"], input, textarea')) return;

    e.preventDefault();
    var stageEl0 = document.getElementById('canvas-stage');
    var sr0 = stageEl0 ? stageEl0.getBoundingClientRect() : { left: 0, top: 0 };
    var mcx = (e.clientX - sr0.left) / _zoomLevel;
    var mcy = (e.clientY - sr0.top)  / _zoomLevel;
    /* 이동할 블록 세트 결정:
       ① 그룹 모드(전체 선택): 그룹 멤버 전체
       ② Ctrl 다중선택: selKeys 전체
       ③ 개별 선택 / 그룹 개별 모드: 드래그 블록만 */
    var relPos = {};
    var isGroupMode = (b.groupId && selectedGi === b.groupId && !_grpIndividualMode);
    var isMultiSel  = (!isGroupMode && selKeys.length > 1 && selKeys.indexOf(b.id) !== -1);

    if (isGroupMode) {
      blocks.forEach(function(gb) {
        if (gb.groupId === b.groupId && gb.id !== b.id) {
          relPos[gb.id] = { dx: gb.x - b.x, dy: gb.y - b.y };
        }
      });
    } else if (isMultiSel) {
      selKeys.forEach(function(kid) {
        if (kid === b.id) return;
        var kb = getBlkByKey(kid);
        if (kb) relPos[kid] = { dx: kb.x - b.x, dy: kb.y - b.y };
      });
    }

    saveHistory();
    blkDrag = { id: b.id,
                startX: e.clientX, startY: e.clientY,
                offsetX: mcx - b.x, offsetY: mcy - b.y,
                groupId: isGroupMode ? (b.groupId || null) : null,
                relPositions: relPos,
                didMove: false };
  }; })(blk));

  /* ── 잠금 아이콘 (잠긴 블록에만 표시) ── */
  if (blk.locked) {
    var lockIco = document.createElement('div');
    lockIco.className = 'blk-lock-indicator';
    lockIco.innerHTML = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="7.5" width="10" height="7" rx="1.5"/><path d="M5.5 7.5V5.5a2.5 2.5 0 015 0v2"/></svg>';
    el.appendChild(lockIco);
  }

  /* ── 우하단 리사이즈 핸들 (잠긴 블록 제외) ── */
  if (!blk.locked) {
    var resizeHandle = document.createElement('div');
    resizeHandle.className = 'blk-resize-handle';
    resizeHandle.addEventListener('mousedown', (function(b) { return function(e) {
      e.stopPropagation();
      e.preventDefault();
      saveHistory();
      blkResize = { id: b.id, startX: e.clientX, startY: e.clientY, startW: b.w, startH: b.h };
      document.body.style.userSelect = 'none';
    }; })(blk));
    el.appendChild(resizeHandle);
  }

  /* 클릭 선택 — render() 없이 DOM 직접 조작
     render()를 호출하면 el이 교체되어 dblclick 인식 불가
     outline + selected 클래스를 DOM에 직접 반영 */
  el.onclick = (function(k, bt, b, curEl) { return function(e) {
    e.stopPropagation();
    if (e.button !== 0) return;
    if (isEditing) return;
    /* 이미지 편집 모드 중 다른 블록 클릭 → 편집 모드 종료 */
    if (activeImgKey && activeImgKey !== k) exitImgEditMode();

    /* ── Shift+클릭: 다중 선택 토글 ── */
    if (e.shiftKey) {
      if (selectedStickerIds.length) deselectSticker();
      var idx = selKeys.indexOf(k);
      if (idx !== -1) {
        /* 이미 선택된 블록 → 제거 */
        selKeys.splice(idx, 1);
        curEl.classList.remove('selected');
        curEl.style.outline = '';
        curEl.style.outlineOffset = '';
        var bdata2 = getBlkByKey(k);
        if (bdata2) {
          curEl.style.boxShadow = _blkNormalBoxShadow(bdata2);
        }
        /* selKey는 마지막 선택된 항목으로 갱신 */
        selKey = selKeys.length > 0 ? selKeys[selKeys.length - 1] : null;
      } else {
        /* 새 블록 추가 선택 */
        /* selKey가 일반 선택 상태면 selKeys에 먼저 편입 */
        if (selKey && selKey !== 'header' && selKeys.indexOf(selKey) === -1) {
          selKeys.push(selKey);
        }
        selKeys.push(k);
        selKey = k;
        curEl.style.outline = '2.0px solid var(--accent)';
        curEl.style.outlineOffset = '3px';
        curEl.style.boxShadow = _blkSelBoxShadow(b);
        curEl.classList.add('selected');
        /* 플로팅 툴바는 다중 선택 시 미표시 */
      }
      /* 다중 선택 시 패널은 2차 작업에서 처리 — 현재는 패널 갱신 없음 */
      hideTxtFormatBar();
      if (selKeys.length >= 2) { showAlignToolbar(); } else { hideAlignToolbar(); }
      return;
    }

    /* ── 일반 클릭 ── */
    hideGroupToolbar();
    hideAlignToolbar();

    /* 콘텐츠 우선 모델: 그룹 멤버 블록 클릭 → 개별 선택
       단, 이미 선택된 그룹의 멤버를 클릭한 경우(그룹 생성 직후 click 이벤트 포함)는 그룹 상태 유지 */
    if (b.groupId) {
      if (b.groupId === selectedGi) return;
      _grpIndividualMode = false;
      selectedGi = null;
      hideGroupToolbar();
    }

    /* 그룹 없는 블록 클릭 → 일반 개별 선택 */
    _grpIndividualMode = false;
    selectedGi = null;
    selKeys = [];
    selKey = k;
    showBlockPanel(bt, null, b);
    /* 텍스트 블록이면 서식 툴바 표시, 아니면 숨김 */
    if (bt === 'txt') {
      showTxtFormatBar(b);
    } else {
      hideTxtFormatBar();
    }
    /* 기존 선택 표시 + 플로팅 툴바 제거 */
    document.querySelectorAll('.blk').forEach(function(blkEl) {
      blkEl.style.outline = '';
      blkEl.style.outlineOffset = '';
      /* boxShadow = '' 로 초기화하면 makeBlk에서 설정한 그림자가 날아가
         CSS 기본값으로 순간 복귀하는 번쩍임이 발생하므로,
         블록 데이터 기준 실제 shadow 값으로 직접 복원 */
      var bkey = blkEl.dataset.key;
      var bdata = getBlkByKey(bkey);
      if (bdata) {
        blkEl.style.boxShadow = _blkNormalBoxShadow(bdata);
      }
      blkEl.classList.remove('selected');
      var oldFtb = blkEl.querySelector('.blk-float-toolbar');
      if (oldFtb) oldFtb.remove();
    });
    /* 현재 블록 선택 표시 */
    curEl.style.outline = '2.0px solid var(--accent)';
    curEl.style.outlineOffset = '3px';
    curEl.style.boxShadow = _blkSelBoxShadow(b);
    curEl.classList.add('selected');
    /* img 블록 — 편집 모드 중이면 툴바 삽입 생략. 업로드 버튼은 B-7에서 제거(더블클릭으로 업로드) */
    if (bt === 'img' && activeImgKey !== k && b.imgSrc) {
      var ftb = document.createElement('div'); ftb.className = 'blk-float-toolbar';
      var edBtn = document.createElement('button'); edBtn.className = 'float-btn'; edBtn.textContent = '편집';
      edBtn.onclick = function(e2) { e2.stopPropagation(); enterImgEditMode(k); };
      var rsBtn = document.createElement('button'); rsBtn.className = 'float-btn'; rsBtn.textContent = '리셋';
      rsBtn.onclick = function(e2) { e2.stopPropagation(); resetImgTransform(k); };
      ftb.appendChild(edBtn);
      ftb.appendChild(rsBtn);
      curEl.appendChild(ftb);
    }
  };})(key, blk.type, blk, el);

  /* 더블클릭 → 텍스트 편집 진입 (txt 블록) */
  if (blk.type === 'txt') {
    el.ondblclick = (function(k, b) { return function(e) {
      e.stopPropagation();
      /* 이미 같은 블록을 편집 중이면 재진입 금지 — 안 그러면 texEl 내용을
         b(블록 데이터)로 덮어써 입력 중이던 텍스트가 사라짐. 네이티브 더블클릭
         단어선택 동작은 그대로 통과시킴 */
      if (isEditing && editingKey === k) return;
      isEditing  = true;
      _userEnteredEdit = true; /* 더블클릭으로 명시적 진입 */
      editingKey = k;
      el.classList.add('editing');
      var texEl = el.querySelector('.blk-text-area');
      if (!texEl) return;
      /* 편집 진입: contenteditable 활성화 + 서식(spans) 반영 */
      var lmEnter = b.listMode || 'none';
      var hasFormatEnter = b.spans && b.spans.some(function(s) {
        return s.bold || s.italic || s.underline || s.color || s.bg || s.fontSize || s.tstroke !== undefined;
      });
      if (lmEnter !== 'none') {
        applyListDisplay(texEl, b.text || '', lmEnter);
      } else if (hasFormatEnter) {
        var bFsEnter = b.fontSize || 12;
        texEl.innerHTML = b.spans.map(function(s) {
          var t = s.text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br>');
          var style = 'font-size:' + (s.fontSize || bFsEnter) + 'px;';
          if (s.bold)      style += 'font-weight:700;';
          if (s.italic)    style += 'font-style:italic;';
          if (s.underline) style += 'text-decoration:underline;';
          if (s.color)     style += 'color:' + s.color + ';';
          if (s.bg)        style += 'background:' + s.bg + ';';
          var tshAttr = '';
          if (s.tstroke > 0) {
            style += 'text-shadow:' + _textShadowCSS(s.tstroke, s.tstrokeColor || b.tstrokeColor) + ';';
            tshAttr = ' data-tstroke="' + s.tstroke + '"' + (s.tstrokeColor ? ' data-tstroke-color="' + s.tstrokeColor + '"' : '');
          }
          return '<span style="' + style + '"' + tshAttr + '>' + t + '</span>';
        }).join('');
      } else {
        texEl.textContent = b.text || '';
      }
      texEl.setAttribute('contenteditable', 'true');
      texEl.focus();
      /* 클릭 위치에 커서 이동 */
      try {
        if (document.caretRangeFromPoint) {
          var r = document.caretRangeFromPoint(e.clientX, e.clientY);
          if (r) { var s = window.getSelection(); s.removeAllRanges(); s.addRange(r); }
        } else if (document.caretPositionFromPoint) {
          var pos = document.caretPositionFromPoint(e.clientX, e.clientY);
          if (pos) {
            var r2 = document.createRange();
            r2.setStart(pos.offsetNode, pos.offset);
            r2.collapse(true);
            var s2 = window.getSelection();
            s2.removeAllRanges();
            s2.addRange(r2);
          }
        }
      } catch(err) {}
      /* 편집 모드 진입 시 패널·플로팅 바를 명시적으로 보장
         onclick(②)에서 이미 호출되는 경우가 대부분이지만,
         그룹 첫 클릭(①) → showCanvasPanel → hideTxtFormatBar 이후
         dblclick이 바로 이어질 때 바가 숨겨진 채 남을 수 있음 */
      showBlockPanel(b.type, null, b);
      showTxtFormatBar(b);
    };})(key, blk);
  }


  return el;
}

