/* png-export.js — 리팩토링 2단계 11번째 조각: PNG 캡처 파이프라인 (collectLayout/renderHeaderPngBg/renderBgLayerPng/saveAsPNG) — REFACTOR_PLAN상 가장 조심스럽게 분리해야 할 영역, app/public/legacy/main.js에서 그대로 이동만 함 */
/* ══════════════════════════════════════════
   PNG 렌더러 — 레이아웃 좌표 수집
   13-3 Canvas 렌더러에 넘기는 픽셀 좌표 맵
══════════════════════════════════════════ */
function collectLayout() {
  var sheetEl = document.getElementById('sheet');
  var padEl   = document.getElementById('sheet-pad');
  if (!sheetEl || !padEl) {
    return null;
  }

  var sheetRect = sheetEl.getBoundingClientRect();
  var sheetW    = canvasW;
  /* getBoundingClientRect()는 canvas-stage의 CSS scale(_zoomLevel)이 반영된 화면 좌표를 반환.
     PNG 렌더러는 실제 px 좌표가 필요하므로 모든 측정값을 _zoomLevel로 나눠 역산한다. */
  var Z = _zoomLevel || 1;

  var result = { sheetW: sheetW, sheetH: 0, header: null, blocks: [], pad: null };

  /* 헤더 */
  if (headerPos) {
    var slotId  = headerPos === 'top' ? 'hdr-top-slot' : 'hdr-bot-slot';
    var hdrEl   = document.querySelector('#' + slotId + ' .sheet-header-block, #' + slotId + ' .sheet-header-sns, #' + slotId + ' .sheet-header-round');
    if (hdrEl) {
      var hr = hdrEl.getBoundingClientRect();
      result.header = {
        x:   Math.round((hr.left - sheetRect.left) / Z),
        y:   Math.round((hr.top  - sheetRect.top)  / Z),
        w:   Math.round(hr.width  / Z),
        h:   Math.round(hr.height / Z),
        pos: headerPos
      };
    }
  }

  /* sheet-pad 위치 (헤더 유무/라운드 오버랩 반영) */
  var padRect = padEl.getBoundingClientRect();
  result.pad = {
    x: Math.round((padRect.left - sheetRect.left) / Z),
    y: Math.round((padRect.top  - sheetRect.top)  / Z),
    w: Math.round(padRect.width  / Z),
    h: 0  /* 아래서 블록 기준으로 계산 */
  };

  /* blocks 배열 직접 순회 — blk.x/y/w/h가 sheet-pad 기준 절대좌표 */
  blocks.forEach(function(blk) {
    /* txt 블록은 min-height 클램프 등으로 DOM이 blk.h보다 클 수 있음 —
       PNG 중앙정렬 offset이 DOM과 일치하도록 실제 렌더 높이를 우선 사용 */
    var h = blk.h;
    if (blk.type === 'txt') {
      var domEl = document.querySelector('.blk[data-key="' + blk.id + '"]');
      if (domEl) h = domEl.offsetHeight;
    }
    result.blocks.push({
      x:   result.pad.x + blk.x,
      y:   result.pad.y + blk.y,
      w:   blk.w,
      h:   h,
      blk: blk
    });
  });

  /* sheetH / pad.h — 블록 실좌표 기반 계산 (DOM 높이는 렌더 타이밍에 따라 불안정) */
  var _maxBlkBottom = 0;
  result.blocks.forEach(function(item) {
    _maxBlkBottom = Math.max(_maxBlkBottom, item.y - result.pad.y + item.h);
  });
  result.pad.h  = Math.max(canvasH, _maxBlkBottom + gaps.pad);
  result.sheetH = result.pad.y + result.pad.h;
  if (result.header && result.header.pos === 'bot') result.sheetH += result.header.h;

  return result;
}

/* ══════════════════════════════════════════
   PNG 헤더 배경 렌더 헬퍼 — 타입별 분기
   ctx.scale(DPR,DPR) 이후 호출 → 좌표에 DPR 불필요
══════════════════════════════════════════ */
function renderHeaderPngBg(ctx, ox, oy, hdr) {
  var hType = headerData.type || 'basic';
  var hx = ox + hdr.x;
  var hy = oy + hdr.y;
  var hw = hdr.w;
  var hh = hdr.h;
  var bbc = headerData.bannerBgColor || '#5B7CE6';


  /* ── 공통: 배너 레이어 렌더 헬퍼 ──
     배경색(mixWhite 그라데이션) → 이미지(on/off) 순으로 그림 */
  function renderBannerLayer(bx, by, bw, bh) {
    /* 배경 — mixWhite 12% 방식 */
    var brightCol = mixWhite(bbc, 0.12);
    var grad = ctx.createLinearGradient(bx, by, bx, by + bh);
    grad.addColorStop(0, bbc);
    grad.addColorStop(1, brightCol);
    ctx.fillStyle = grad;
    ctx.fillRect(bx, by, bw, bh);

    /* 이미지 — bannerImgOn + bannerImgSrc 모두 충족 시만 */
    if (headerData.bannerImgOn && headerData.bannerImgSrc) {
      var img = new Image();
      img.src = headerData.bannerImgSrc;
      var t  = headerData.bannerImgTransform || { scale: 1, x: 0, y: 0 };
      var iw = img.naturalWidth  || img.width  || bw;
      var ih = img.naturalHeight || img.height || bh;
      var cx = bx + bw / 2 + (t.x || 0);
      var cy = by + bh / 2 + (t.y || 0);
      ctx.save();
      ctx.beginPath(); ctx.rect(bx, by, bw, bh); ctx.clip();
      ctx.translate(cx, cy);
      ctx.scale(t.scale || 1, t.scale || 1);
      ctx.drawImage(img, -iw / 2, -ih / 2, iw, ih);
      ctx.restore();
    }
  }

  /* ── basic ── */
  if (hType === 'basic') {
    renderBannerLayer(hx, hy, hw, hh);

  /* ── sns ── */
  } else if (hType === 'sns') {
    var navH    = headerData.navH || 32;
    var snsH    = headerData.snsH || 120;
    /* 네비바 */
    ctx.fillStyle = headerData.navBgColor || '#ffffff';
    ctx.fillRect(hx, hy, hw, navH);
    /* 배너 레이어 */
    renderBannerLayer(hx, hy + navH, hw, snsH);

  /* ── round ── */
  } else if (hType === 'round') {
    var roundH  = headerData.roundH || 120;
    var overlap = headerData.roundOverlap !== undefined ? headerData.roundOverlap : 24;
    /* DOM과 동일: overlap + sheetRadius 합산으로 빈틈 방지 */
    var bannerRenderH = roundH + overlap + sheetRadius;
    renderBannerLayer(hx, hy, hw, bannerRenderH);
  }
}

/* ══════════════════════════════════════════
   PNG 배경지 렌더 헬퍼
   적용 범위: sheet-pad (layout.pad) 영역만, 헤더 제외
   호출 시점: saveAsPNG 내 시트 배경 + 헤더 렌더 완료 직후
══════════════════════════════════════════ */
/* renderBgLayerPng — Promise 반환
   ※ 호출 시점에서 clip 상태 무관 — 함수 내부에서 자체 ctx.save/clip/restore 처리
   ※ pad 좌표는 sheet-pad DOM 기준 (ox/oy 오프셋 더함)
   ※ 배경색: hexWithAlpha(color, opacity) — GUIDE opacity 규칙 준수
   ※ 모눈종이: SVG stroke-opacity에 이미 반영 — globalAlpha 불필요
   ※ 이 함수가 resolve된 뒤 블록 루프 진입 — 배경지가 블록 아래에 그려짐 보장 */
function renderBgLayerPng(ctx, ox, oy, layout, SHEET_R) {
  if (!bgLayer.on) {
    return Promise.resolve();
  }
  var pad = layout.pad;
  if (!pad) {
    return Promise.resolve();
  }

  var pdX = ox + pad.x;
  var pdY = oy + pad.y;
  var pdW = pad.w;
  var pdH = pad.h;

  /* 상단 핸들 확장(canvasExtraTop>0) 시 헤더~pad 사이에 생기는 간격까지 배경지가
     덮도록 위로 확장 — DOM의 _syncBgOverlayBounds()(panel-bg.js)와 동일한 보정
     (2026-06-22, F-17 모델: pad 박스 자체는 안 커지고 위치만 이동하므로 PNG도 동일 보정 필요) */
  var _bgExtend = Math.max(0, canvasExtraTop);
  pdY -= _bgExtend;
  pdH += _bgExtend;
  var _bgExtendLeft = Math.max(0, canvasExtraLeft);
  pdX -= _bgExtendLeft;
  pdW += _bgExtendLeft;

  /* round 타입 보정 불필요 —
     round clip이 saveAsPNG에서 배경지보다 먼저 열리므로
     배경지는 round clip 영역 안에서 자연스럽게 잘림.
     pdY는 DOM pad 좌표 그대로 사용. */


  /* pad 영역을 시트 라운딩으로 clip — 헤더 영역 침범 방지 + 모서리 라운딩 보장
     roundRectPath는 saveAsPNG 내부 헬퍼이므로 직접 path 작성 */
  function _padClipPath() {
    var r = Math.min(SHEET_R, pdW / 2, pdH / 2);
    ctx.beginPath();
    ctx.moveTo(pdX + r, pdY);
    ctx.lineTo(pdX + pdW - r, pdY);
    ctx.arcTo(pdX + pdW, pdY,          pdX + pdW, pdY + r,          r);
    ctx.lineTo(pdX + pdW, pdY + pdH - r);
    ctx.arcTo(pdX + pdW, pdY + pdH,    pdX + pdW - r, pdY + pdH,    r);
    ctx.lineTo(pdX + r,  pdY + pdH);
    ctx.arcTo(pdX,       pdY + pdH,    pdX,           pdY + pdH - r, r);
    ctx.lineTo(pdX,      pdY + r);
    ctx.arcTo(pdX,       pdY,          pdX + r,       pdY,           r);
    ctx.closePath();
  }

  ctx.save();
  _padClipPath();
  ctx.clip();

  /* ── 1. 배경색 — hexWithAlpha로 opacity 반영 (GUIDE 규칙 준수) ── */
  if (bgLayer.color) {
    var bgColorRgba = hexWithAlpha(bgLayer.color, bgLayer.opacity);
    ctx.fillStyle = bgColorRgba;
    ctx.fillRect(pdX, pdY, pdW, pdH);
  }

  /* ── 2. 이미지 레이어 ── */
  if (!bgLayer.imgOn) {
    ctx.restore();
    return Promise.resolve();
  }

  if (bgLayer.imgMode === 'grid') {
    /* 모눈종이 — Canvas용 px 고정 SVG, 비동기 로드
       opacity는 SVG stroke-opacity에 이미 반영 → globalAlpha 불필요 */
    return new Promise(function(resolve) {
      var gSize   = bgLayer.gridSize;
      var gAngle  = bgLayer.gridAngle || 0;
      var gColor  = bgLayer.gridColor;
      var gAlpha  = (bgLayer.opacity / 100).toFixed(3);
      var gStroke = 'stroke="' + gColor + '" stroke-opacity="' + gAlpha + '" stroke-width="0.5"';

      /* 격자 구현:
         가로선 패턴(ph)을 gAngle로 회전 + 세로선 패턴(pv)을 (gAngle+90)으로 회전
         두 rect를 겹쳐 격자 완성 */
      var ptH = gAngle !== 0 ? ' patternTransform="rotate(' + gAngle + ')"' : '';
      var ptV = ' patternTransform="rotate(' + (gAngle + 90) + ')"';

      /* SVG 크기를 실제 px 고정 (100%는 Canvas에서 0으로 해석됨) */
      var gSvg =
        '<svg xmlns="http://www.w3.org/2000/svg" width="' + pdW + '" height="' + pdH + '">' +
          '<defs>' +
            '<pattern id="ph" x="0" y="0" width="' + gSize + '" height="' + gSize + '" patternUnits="userSpaceOnUse"' + ptH + '>' +
              '<line x1="0" y1="0" x2="' + (gSize * 30) + '" y2="0" ' + gStroke + '/>' +
            '</pattern>' +
            '<pattern id="pv" x="0" y="0" width="' + gSize + '" height="' + gSize + '" patternUnits="userSpaceOnUse"' + ptV + '>' +
              '<line x1="0" y1="0" x2="' + (gSize * 30) + '" y2="0" ' + gStroke + '/>' +
            '</pattern>' +
          '</defs>' +
          '<rect width="' + pdW + '" height="' + pdH + '" fill="url(#ph)"/>' +
          '<rect width="' + pdW + '" height="' + pdH + '" fill="url(#pv)"/>' +
        '</svg>';

      var img = new Image();
      img.onload = function() {
        ctx.drawImage(img, pdX, pdY, pdW, pdH);
        ctx.restore();
        resolve();
      };
      img.onerror = function(e) {
        ctx.restore();
        resolve();
      };
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(gSvg);
    });
  }

  /* ── upload 이미지 모드 (none / cover / tile) ── */
  if (bgLayer.imgMode === 'upload') {
    if (!bgLayer.imgSrc) {
      ctx.restore();
      return Promise.resolve();
    }

    var repeat    = bgLayer.repeat || 'cover';
    var opacity   = bgLayer.opacity / 100;

    return new Promise(function(resolve) {

      /* opacity는 ctx.globalAlpha로 격리 처리 (save/restore 쌍 안에서만 적용) */
      function drawWithOpacity(drawFn) {
        ctx.save();
        ctx.globalAlpha = opacity;
        drawFn();
        ctx.restore();  /* globalAlpha 복원 */
        ctx.restore();  /* pad clip 복원 */
        resolve();
      }

      /* ── cover ── */
      if (repeat === 'cover') {
        var img = new Image();
        img.onload = function() {
          var iw = img.naturalWidth  || pdW;
          var ih = img.naturalHeight || pdH;
          var scale = Math.max(pdW / iw, pdH / ih);
          var dw = iw * scale;
          var dh = ih * scale;
          var dx = pdX + (pdW - dw) / 2;
          var dy = pdY + (pdH - dh) / 2;
          drawWithOpacity(function() { ctx.drawImage(img, dx, dy, dw, dh); });
        };
        img.onerror = function() {
          ctx.restore(); resolve();
        };
        img.src = bgLayer.imgSrc;

      /* ── none (원본) ── */
      } else if (repeat === 'none') {
        var img = new Image();
        img.onload = function() {
          var iw    = img.naturalWidth  || pdW;
          var ih    = img.naturalHeight || pdH;
          var scale = bgLayer.zoom / 100;
          var dw    = iw * scale;
          var dh    = ih * scale;
          var cx    = pdX + pdW / 2 + (bgLayer.posX || 0);
          var cy    = pdY + pdH / 2 + (bgLayer.posY || 0);
          var dx    = cx - dw / 2;
          var dy    = cy - dh / 2;
          drawWithOpacity(function() { ctx.drawImage(img, dx, dy, dw, dh); });
        };
        img.onerror = function() {
          ctx.restore(); resolve();
        };
        img.src = bgLayer.imgSrc;

      /* ── tile ── */
      } else if (repeat === 'tile') {
        var tileW = Math.round(bgLayer.zoom);
        var tileH = (bgLayer._imgNaturalH && bgLayer._imgNaturalW)
          ? Math.round(tileW * bgLayer._imgNaturalH / bgLayer._imgNaturalW)
          : tileW;
        var angle  = bgLayer.tileAngle || 0;

        /* makeTileSvgDataUriPx: width/height px 고정 버전 사용 */
        var svgUri = makeTileSvgDataUriPx(bgLayer.imgSrc, tileW, tileH, angle, pdW, pdH);
        var svgImg = new Image();
        svgImg.onload = function() {
          drawWithOpacity(function() { ctx.drawImage(svgImg, pdX, pdY, pdW, pdH); });
        };
        svgImg.onerror = function() {
          ctx.restore(); resolve();
        };
        svgImg.src = svgUri;

      } else {
        /* 알 수 없는 repeat 값 */
        ctx.restore(); resolve();
      }
    });
  }

  /* 알 수 없는 imgMode */
  ctx.restore();
  return Promise.resolve();
}

/* ══════════════════════════════════════════
   PNG 저장 — Canvas 렌더러
══════════════════════════════════════════ */
function saveAsPNG() {
  var layout = collectLayout();
  if (!layout || !layout.blocks.length) {
    showToast('저장할 블록이 없습니다');
    return;
  }

  /* 저장 중 피드백 */
  var _saveBtn = document.getElementById('btn-save');
  var _saveBtnOrigHTML = _saveBtn ? _saveBtn.innerHTML : '';
  if (_saveBtn) { _saveBtn.disabled = true; _saveBtn.textContent = '저장 중…'; }

  /* 웹폰트가 로드되기 전에 ctx.fillText가 호출되면 canvas는 DOM처럼 폰트 로드 후 자동
     재렌더되지 않아 시스템 폴백 폰트로 그대로 캡처됨 — "계단현상"처럼 보이거나 글자
     너비가 달라져 자간이 어긋난 것처럼 보이는 현상의 주된 원인. 그리기 시작 전 대기. */
  document.fonts.ready.then(function() {

  var DPR     = 3;                    /* 고해상도 ×3 — 포토샵/피그마급 출력 요청에 따라 ×2→×3 상향 */
  var MARGIN  = pngMargin ? 40 : 0;   /* 여백 px (1x 기준) */

  var canvW = layout.sheetW + MARGIN * 2;
  var canvH = layout.sheetH + MARGIN * 2;

  var canvas = document.createElement('canvas');
  canvas.width  = canvW * DPR;
  canvas.height = canvH * DPR;
  var ctx = canvas.getContext('2d');
  ctx.scale(DPR, DPR);


  /* 헬퍼: roundRect path (saveAsPNG 전체에서 공유) */
  function roundRectPath(x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.arcTo(x + w, y,     x + w, y + r,     r);
    ctx.lineTo(x + w, y + h - r);
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h);
    ctx.arcTo(x,     y + h, x,     y + h - r, r);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x,     y,     x + r, y,         r);
    ctx.closePath();
  }

  /* 오프셋 — 여백만큼 이동 */
  var ox = MARGIN, oy = MARGIN;

  /* 1. 여백 배경 */
  ctx.fillStyle = pngMargin ? pngBg : sheetBg;
  ctx.fillRect(0, 0, canvW, canvH);

  /* 헬퍼: 4모서리 개별 라운딩 (tl/tr/br/bl 각각 지정) */
  function roundRectCorners(x, y, w, h, tl, tr, br, bl) {
    ctx.beginPath();
    ctx.moveTo(x + tl, y);
    ctx.lineTo(x + w - tr, y);
    ctx.arcTo(x + w, y,     x + w, y + tr,    tr);
    ctx.lineTo(x + w, y + h - br);
    ctx.arcTo(x + w, y + h, x + w - br, y + h, br);
    ctx.lineTo(x + bl, y + h);
    ctx.arcTo(x,     y + h, x,     y + h - bl, bl);
    ctx.lineTo(x, y + tl);
    ctx.arcTo(x,     y,     x + tl, y,          tl);
    ctx.closePath();
  }

  /* 2. 시트 배경 + 헤더
       핵심 전략: 시트 전체를 roundRect로 clip한 뒤
                 내부를 fillRect로 색상 구역만 채움
                 → 모서리 잔재·경계 흰 선 원천 차단
       여백 on  → 쉐도우(clip 전 투명 fill로 그림자만) + clip + 채우기
       여백 off → clip 없이 fillRect만 */
  var SHEET_R = sheetRadius;
  var hdr     = layout.header;  /* null | { x,y,w,h,pos } */

  if (pngMargin) {
    /* 2-a. 드롭쉐도우 — clip 전에 투명 fill로 그림자만 생성 (시트 배경색 칠 금지) */
    ctx.save();
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 2;
    ctx.shadowBlur    = 16 * DPR;
    ctx.shadowColor   = 'rgba(0,0,0,0.07)';
    ctx.fillStyle     = 'rgba(0,0,0,0)';
    roundRectPath(ox, oy, layout.sheetW, layout.sheetH, SHEET_R);
    ctx.fill();
    ctx.restore();

    /* 2-b. 시트 전체 clip + 배경·헤더 채우기 */
    ctx.save();
    roundRectPath(ox, oy, layout.sheetW, layout.sheetH, SHEET_R);
    ctx.clip();
    ctx.fillStyle = sheetBg;
    ctx.fillRect(ox, oy, layout.sheetW, layout.sheetH);
    if (hdr) { renderHeaderPngBg(ctx, ox, oy, hdr); }
    ctx.restore(); /* 시트 clip 해제 */

  } else {
    /* 여백 off */
    ctx.fillStyle = sheetBg;
    ctx.fillRect(ox, oy, layout.sheetW, layout.sheetH);
    if (hdr) { renderHeaderPngBg(ctx, ox, oy, hdr); }
  }

  /* 2-c. 라운드 타입 — 시트 카드 그림자 + clip
     ⚠️ 배경지(renderBgLayerPng) 보다 먼저 열어야 함
        순서: round clip → 배경지 → 블록루프 → round clip 닫기
        이 순서여야 배경지가 흰 카드 안에서 블록 아래에 보임 */
  var roundClipOpen = false;
  if (headerData.type === 'round' && hdr && layout.pad) {
    var pd_r  = layout.pad;
    var pdX_r = ox + pd_r.x, pdY_r = oy + pd_r.y;
    var pdW_r = pd_r.w,      pdH_r = pd_r.h;
    /* 그림자 */
    ctx.save();
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = hdr.pos === 'top' ? -4 : 4;
    ctx.shadowBlur    = 12 * DPR;
    ctx.shadowColor   = 'rgba(0,0,0,0.13)';
    ctx.fillStyle     = sheetBg;
    roundRectPath(pdX_r, pdY_r, pdW_r, pdH_r, SHEET_R);
    ctx.fill();
    ctx.restore();
    /* clip 열기 — 배경지 + 블록 렌더 후 명시적으로 닫음 */
    ctx.save();
    roundRectPath(pdX_r, pdY_r, pdW_r, pdH_r, SHEET_R);
    ctx.clip();
    ctx.fillStyle = sheetBg;
    ctx.fillRect(pdX_r, pdY_r, pdW_r, pdH_r);
    roundClipOpen = true;
  }

  /* 2-d. 배경지 — round clip 안에서 그려야 흰 카드 위, 블록 아래에 보임
     bgLayerPromise 완료 후 블록 루프 진입 → 배경지가 블록 아래에 그려짐 보장 */
  var bgLayerPromise = renderBgLayerPng(ctx, ox, oy, layout, SHEET_R);

  /* 배경지 완료 → 블록 루프 → 스티커 → 다운로드 */
  var now    = new Date();
  var yy     = String(now.getFullYear()).slice(2);
  var mm     = String(now.getMonth() + 1).padStart(2, '0');
  var dd     = String(now.getDate()).padStart(2, '0');
  var fname  = yy + mm + dd + '_grid';
  fname      = fname.replace(/[\\/:*?"<>|]/g, '') + '.png';

  var a = document.createElement('a');
  a.download = fname;

  bgLayerPromise.then(function() {

    /* 헬퍼: 텍스트 줄바꿈
       dryRun=true 시 실제 fillText 없이 총 렌더 높이만 반환 (vAlign 중앙 오프셋 계산용) */
    /* tsh = { color, lw } 전달 시 strokeText로 외곽선 선행 렌더 */
    function wrapText(text, x, y, maxW, lineH, dryRun, tsh) {
      if (!text) return 0;
      var lines = text.split('\n');
      var curY  = y;
      lines.forEach(function(line) {
        if (!line) { curY += lineH; return; }
        var words = line.split('');  /* 한글 대응 — 글자 단위 */
        var cur   = '';
        words.forEach(function(ch) {
          var test = cur + ch;
          if (ctx.measureText(test).width > maxW && cur) {
            if (!dryRun) {
              if (tsh) { ctx.save(); ctx.strokeStyle=tsh.color; ctx.lineWidth=tsh.lw; ctx.lineJoin='round'; ctx.strokeText(cur, x, curY); ctx.restore(); }
              ctx.fillText(cur, x, curY);
            }
            curY += lineH;
            cur   = ch;
          } else {
            cur = test;
          }
        });
        if (cur) {
          if (!dryRun) {
            if (tsh) { ctx.save(); ctx.strokeStyle=tsh.color; ctx.lineWidth=tsh.lw; ctx.lineJoin='round'; ctx.strokeText(cur, x, curY); ctx.restore(); }
            ctx.fillText(cur, x, curY);
          }
          curY += lineH;
        }
      });
      return curY - y;  /* 총 렌더 높이 반환 */
    }

    /* 헬퍼: 드롭쉐도우 설정 */
    function setShadow(sh) {
      if (sh > 0) {
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = (sh === 1 ? 1 : 6) * DPR;  /* BUG-8: offsetY도 DPR 보정 */
        ctx.shadowBlur    = (sh === 1 ? 3 : 16) * DPR;
        ctx.shadowColor   = sh === 1 ? 'rgba(0,0,0,0.15)' : 'rgba(0,0,0,0.18)';
      } else {
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
        ctx.shadowBlur    = 0;
        ctx.shadowColor   = 'transparent';
      }
    }
    function clearShadow() {
      ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0;
      ctx.shadowBlur = 0; ctx.shadowColor = 'transparent';
    }

    /* 3. 헤더 콘텐츠 — renderHeaderPngBg에서 배경·이미지·공통텍스트 처리 완료
       여기서는 타입별 고유 텍스트(SNS 네비바)만 추가 렌더 */
    if (layout.header) {
      var hd = layout.header;
      var hx = ox + hd.x, hy = oy + hd.y;
      var hType = headerData.type || 'basic';

      if (hType === 'sns') {
        /* SNS 네비바 텍스트 */
        var navH = headerData.navH || 32;
        ctx.font         = "600 11px 'Pretendard', sans-serif";
        ctx.fillStyle    = headerData.navFontColor || '#212121';
        ctx.textAlign    = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(headerData.navText || '← BACK', hx + 12, hy + navH / 2);
        ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
      }
    }

    /* 4. 블록 */
    layout.blocks.forEach(function(item) {
    var blk = item.blk;
    var bx  = ox + item.x;
    var by  = oy + item.y;
    var bw  = item.w;
    var bh  = item.h;

    var r   = (blk.radius  !== null && blk.radius  !== undefined) ? blk.radius  : globalVals.radius;
    var sh  = (blk.shadow  !== null && blk.shadow  !== undefined) ? blk.shadow  : globalVals.shadow;
    var op  = (blk.opacity !== null && blk.opacity !== undefined) ? blk.opacity : 100;
    var bg  = (blk.bgColor !== null && blk.bgColor !== undefined) ? blk.bgColor : globalVals.bgColor;

    ctx.save();

    /* 4-a. 배경 + 쉐도우 (clip 전) — opacity는 배경색 알파로만 반영, 그림자/콘텐츠 유지 */
    setShadow(sh);
    ctx.fillStyle = hexWithAlpha(bg, op);
    roundRectPath(bx, by, bw, bh, r);
    ctx.fill();
    clearShadow();

    /* 4-a-2. 블록 테두리 (stroke) — 이미지 블록은 이미지 위에 그려야 하므로 이미지 렌더 후 처리 */
    var pStrk = blk.stroke || 0;
    function _drawStrokePng() {
      if (pStrk <= 0) return;
      ctx.save();
      roundRectPath(bx, by, bw, bh, r);
      ctx.clip();
      ctx.strokeStyle = hexWithAlpha(blk.strokeColor || '#1C1C20', pStrk >= 2 ? 55 : 28);
      ctx.lineWidth   = pStrk >= 2 ? 4 : 2;
      roundRectPath(bx, by, bw, bh, r);
      ctx.stroke();
      ctx.restore();
    }
    if (blk.type !== 'img') _drawStrokePng();

    /* 4-b. 이미지 블록 */
    if (blk.type === 'img') {
      if (blk.imgSrc) {
        var imgObj = new Image();
        /* 동기 방식 불가 — 이미지는 Promise 없이 base64 직접 드로우 */
        imgObj.src = blk.imgSrc;
        ctx.save();
        roundRectPath(bx, by, bw, bh, r);
        ctx.clip();
        var t    = blk.imgTransform || { scale: 1, x: 0, y: 0 };
        var cx   = bx + bw / 2 + t.x;
        var cy   = by + bh / 2 + t.y;
        var iw   = imgObj.naturalWidth  || imgObj.width  || bw;
        var ih   = imgObj.naturalHeight || imgObj.height || bh;
        ctx.translate(cx, cy);
        ctx.scale(t.scale, t.scale);
        ctx.drawImage(imgObj, -iw / 2, -ih / 2, iw, ih);
        ctx.restore();
      }
      /* 그라디언트 오버레이 */
      if (blk.gradOn) {
        ctx.save();
        roundRectPath(bx, by, bw, bh, r);
        ctx.clip();
        var _gs2 = blk.gradStart || { hex: '#000000', a: 0 };
        var _ge2 = blk.gradEnd   || { hex: '#000000', a: 65 };
        var _gPos0 = (_gs2.pos !== undefined ? _gs2.pos : (blk.gradOffset !== undefined ? blk.gradOffset : 0)) / 100;
        var _gPos1 = (_ge2.pos !== undefined ? _ge2.pos : 100) / 100;
        var _gDir2 = blk.gradDir || 'bottom';
        var _pgx0, _pgy0, _pgx1, _pgy1;
        if (_gDir2 === 'top')    { _pgx0=bx; _pgy0=by+bh; _pgx1=bx;    _pgy1=by;    }
        else if (_gDir2 === 'left')  { _pgx0=bx+bw; _pgy0=by; _pgx1=bx;    _pgy1=by;    }
        else if (_gDir2 === 'right') { _pgx0=bx;    _pgy0=by; _pgx1=bx+bw; _pgy1=by;    }
        else                         { _pgx0=bx;    _pgy0=by; _pgx1=bx;    _pgy1=by+bh; } /* bottom */
        var _pgrad = ctx.createLinearGradient(_pgx0, _pgy0, _pgx1, _pgy1);
        _pgrad.addColorStop(Math.min(_gPos0, 0.999), _hexAlpha(_gs2.hex, _gs2.a));
        _pgrad.addColorStop(Math.max(_gPos1, Math.min(_gPos0, 0.999) + 0.001), _hexAlpha(_ge2.hex, _ge2.a));
        ctx.fillStyle = _pgrad;
        ctx.fillRect(bx, by, bw, bh);
        ctx.restore();
      }
      /* 이미지 위에 stroke 표시 */
      _drawStrokePng();
    /* 4-c. 텍스트 블록 */
    } else if (blk.type === 'txt') {
      var pad     = (blk.padV !== null && blk.padV !== undefined)
        ? blk.padV
        : Math.max(Math.max(8, Math.round(Math.min(r, 32) * 0.5 + 8)), _cornerSafeMargin(r, bw, bh));
      var tFont   = blk.fontFamily || globalVals.font || 'Pretendard';
      var tSize   = blk.fontSize || 12;
      var tColor  = blk.fontColor  || globalVals.fontColor || '#212121';
      /* 글자 외곽선 opts — wrapText/wrapSpans에 전달 */
      var pTsh = (blk.tstroke || 0) > 0
        ? { color: blk.tstrokeColor || '#ffffff', lw: (blk.tstroke >= 2 ? 3.2 : 1.8) }
        : null;
      var tAlign  = blk.textAlign  || 'left';
      var lineH   = Math.round(tSize * (blk.lineHeight || 1.6));
      var textX   = tAlign === 'center' ? bx + bw / 2
                  : tAlign === 'right'  ? bx + bw - pad
                  : bx + pad;
      ctx.textAlign    = tAlign;
      ctx.textBaseline = 'top';
      var maxTextW = bw - pad * 2;
      var tListMode = blk.listMode || 'none';

      /* spans 존재 + 서식 있음 + 목록형 아닐 때 → span 단위 렌더링 */
      var hasSpanFormat = tListMode === 'none' && blk.spans && blk.spans.length > 0 &&
        blk.spans.some(function(s) {
          return s.bold || s.italic || s.underline || s.color || s.bg ||
                 (s.fontSize && s.fontSize !== tSize) || s.tstroke !== undefined;
        });

      /* ── 헬퍼: span 단위 줄바꿈 렌더링 ── */
      function wrapSpans(spans, startX, startY, maxW, baseLineH, dryRun) {
        /* spans를 글자 단위 토큰으로 분해 */
        var tokens = []; /* { ch, bold, italic, underline, color, bg, fontSize } */
        spans.forEach(function(sp) {
          var chars = (sp.text || '').split('');
          chars.forEach(function(ch) {
            tokens.push({
              ch: ch,
              bold:         sp.bold      || false,
              italic:       sp.italic    || false,
              underline:    sp.underline || false,
              color:        sp.color     || tColor,
              bg:           sp.bg        || null,
              fontSize:     sp.fontSize  || tSize,
              tstroke:      sp.tstroke !== undefined ? sp.tstroke : undefined,
              tstrokeColor: sp.tstrokeColor || null
            });
          });
        });

        var curY   = startY;
        var lineTokens = []; /* 현재 줄에 쌓인 토큰들 */
        var lineW  = 0;

        function flushLine(tokens, y, isLast) {
          if (!tokens.length) return;
          /* 정렬에 따른 시작 X 계산 */
          var totalW = tokens.reduce(function(sum, t) {
            ctx.font = (t.bold ? '700' : '400') + ' ' + t.fontSize + 'px \'' + tFont + '\', \'Pretendard\', sans-serif';
            return sum + ctx.measureText(t.ch).width;
          }, 0);
          /* 좌표를 정수로 고정 — 글자 단위 measureText 폭을 그대로 누적하면
             부동소수점 오차가 글자 수만큼 쌓여 뒤쪽 글자/형광펜 위치가 어긋남 */
          var drawX = Math.round(tAlign === 'center' ? bx + bw / 2 - totalW / 2
                    : tAlign === 'right'  ? bx + bw - pad - totalW
                    : bx + pad);
          /* 글자별 위치를 먼저 계산 — 형광펜을 글자 단위가 아니라 연속 구간 단위로
             한 번에 그리기 위함(글자마다 따로 그리면 사이에 흰 틈이 보임 — 0620_2) */
          var positioned = tokens.map(function(t) {
            var fw = t.bold ? '700' : '400';
            var fs = t.italic ? 'italic ' : '';
            ctx.font = fs + fw + ' ' + t.fontSize + 'px \'' + tFont + '\', \'Pretendard\', sans-serif';
            var cw = ctx.measureText(t.ch).width;
            var x = drawX;
            drawX = Math.round(drawX + cw);
            return { t: t, x: x, cw: cw };
          });
          if (dryRun) return;
          /* 형광펜(배경) — 같은 색이 연속된 구간을 fillRect 1회로 묶어서 그림 */
          var ri = 0;
          while (ri < positioned.length) {
            var bg = positioned[ri].t.bg;
            if (!bg) { ri++; continue; }
            var runStart = positioned[ri].x;
            var runEnd   = positioned[ri].x + positioned[ri].cw;
            var runSize  = positioned[ri].t.fontSize;
            var rj = ri + 1;
            while (rj < positioned.length && positioned[rj].t.bg === bg) {
              runEnd = positioned[rj].x + positioned[rj].cw;
              rj++;
            }
            ctx.fillStyle = bg;
            ctx.fillRect(runStart, y, runEnd - runStart, runSize * 1.2);
            ri = rj;
          }
          /* 글자·외곽선·밑줄 */
          positioned.forEach(function(p) {
            var t = p.t;
            var fw = t.bold ? '700' : '400';
            var fs = t.italic ? 'italic ' : '';
            ctx.font = fs + fw + ' ' + t.fontSize + 'px \'' + tFont + '\', \'Pretendard\', sans-serif';
            var _tTsh = t.tstroke !== undefined
              ? (t.tstroke > 0 ? { color: t.tstrokeColor || '#ffffff', lw: (t.tstroke >= 2 ? 3.2 : 1.8) } : null)
              : pTsh;
            if (_tTsh) { ctx.save(); ctx.strokeStyle=_tTsh.color; ctx.lineWidth=_tTsh.lw; ctx.lineJoin='round'; ctx.strokeText(t.ch, p.x, y); ctx.restore(); }
            ctx.fillStyle = t.color;
            ctx.fillText(t.ch, p.x, y);
            if (t.underline) {
              ctx.fillStyle = t.color;
              ctx.fillRect(p.x, y + t.fontSize + 1, p.cw, 1);
            }
          });
        }

        var i = 0;
        while (i < tokens.length) {
          var t = tokens[i];
          if (t.ch === '\n') {
            if (!dryRun) flushLine(lineTokens, curY, false);
            curY += baseLineH;
            lineTokens = [];
            lineW = 0;
            i++;
            continue;
          }
          ctx.font = (t.bold ? '700' : '400') + ' ' + t.fontSize + 'px \'' + tFont + '\', \'Pretendard\', sans-serif';
          var cw = ctx.measureText(t.ch).width;
          if (lineW + cw > maxW && lineTokens.length > 0) {
            if (!dryRun) flushLine(lineTokens, curY, false);
            curY += baseLineH;
            lineTokens = [];
            lineW = 0;
          }
          lineTokens.push(t);
          lineW += cw;
          i++;
        }
        if (lineTokens.length > 0) {
          if (!dryRun) flushLine(lineTokens, curY, true);
          curY += baseLineH;
        }
        return curY - startY;
      }

      var textStartY = by + pad;

      var _tVA = blk.vAlign || 'center';

      if (hasSpanFormat) {
        var totalTextH = wrapSpans(blk.spans, textX, 0, maxTextW, lineH, true);
        var innerH = bh - pad * 2;
        var offset = _tVA === 'top'    ? 0
                   : _tVA === 'bottom' ? Math.max(0, innerH - totalTextH)
                   :                     Math.max(0, (innerH - totalTextH) / 2);
        textStartY = by + pad + offset;
        wrapSpans(blk.spans, textX, textStartY, maxTextW, lineH, false);
      } else {
        /* 기존 단색 렌더링 (목록형 포함) */
        ctx.font      = tSize + 'px \'' + tFont + '\', \'Pretendard\', sans-serif';
        ctx.fillStyle = tColor;
        var rawText   = blk.text || '';
        var renderText = rawText;
        if (tListMode !== 'none') {
          var tLines = rawText.split('\n');
          renderText = tLines.map(function(line, idx) {
            if (!line) return '';
            if (tListMode === 'bullet-circle')  return '• '  + line;
            if (tListMode === 'bullet-check')   return '✔ '  + line;
            if (tListMode === 'bullet-tri')     return '‣ '  + line;
            if (tListMode === 'bullet-arrow')   return '➤ '  + line;
            if (tListMode === 'bullet-diamond') return '❖ '  + line;
            if (tListMode === 'numbered')       return (idx + 1) + '. ' + line;
            return line;
          }).join('\n');
        }
        var totalTextH = wrapText(renderText, textX, 0, maxTextW, lineH, true);
        var innerH = bh - pad * 2;
        var offset = _tVA === 'top'    ? 0
                   : _tVA === 'bottom' ? Math.max(0, innerH - totalTextH)
                   :                     Math.max(0, (innerH - totalTextH) / 2);
        textStartY = by + pad + offset;
        wrapText(renderText, textX, textStartY, maxTextW, lineH, false, pTsh);
      }
      ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';

    /* 4-f. 컬러칩 블록 */
    } else if (blk.type === 'colorchip') {
      var ccChips    = blk.chips || [];
      var ccRad      = (blk.chipRadius !== null && blk.chipRadius !== undefined) ? blk.chipRadius : 0;
      /* 블록 자체 라운딩(r)이 박스 크기 대비 과대한 경우(원형 등) 칩이 모서리 호에 깎이지
         않도록 추가 여백 확보 — DOM(canvas-render.js makeBlk)과 동일한 공식 */
      var ccPad      = Math.max(8, _cornerSafeMargin(r, bw, bh));
      /* 개별 블록 크기·간격 배율 */
      var ccSizeScale = (blk.ccSizeScale || 100) / 100;
      var ccGapScale  = (blk.ccGapScale  || 100) / 100;
      var ccGap      = Math.round((blk.chipGap   !== undefined ? blk.chipGap   : 6)  * ccGapScale);
      var ccChipH    = Math.round((blk.chipSize  !== undefined ? blk.chipSize  : 30) * ccSizeScale);
      var ccChipPadH = Math.round((blk.chipPadH  !== undefined ? blk.chipPadH  : 8)  * ccSizeScale);
      var ccFont     = globalVals.font || 'Pretendard';
      var ccFontScale = (blk.ccFontScale || 100) / 100;
      var ccFSize    = Math.round(11 * ccSizeScale * ccFontScale);
      var showSwatch = blk.showSwatch !== false;
      var showText   = blk.showText === true;
      var ccHAlign   = blk.ccAlign || 'left';
      var ccVAlign   = blk.vAlign  || 'center';
      var ccDescGap  = 8;
      var ccAvailW   = bw - ccPad * 2;
      var _ccRowX = function(rowW) {
        return ccHAlign === 'center' ? bx + ccPad + (ccAvailW - rowW) / 2
             : ccHAlign === 'right'  ? bx + ccPad + (ccAvailW - rowW)
             :                         bx + ccPad;
      };
      var _ccStartY = function(totalH) {
        var avail = bh - ccPad * 2;
        return by + ccPad + (ccVAlign === 'top'    ? 0
                           : ccVAlign === 'bottom' ? Math.max(0, avail - totalH)
                           :                         Math.max(0, (avail - totalH) / 2));
      };

      ctx.font         = '600 ' + ccFSize + 'px \'' + ccFont + '\', \'Pretendard\', sans-serif';
      ctx.textBaseline = 'middle';

      if (showText) {
        /* showText=ON: [칩 + desc 텍스트] 행 단위 wrap */
        var ccRows2 = [[]];
        var ccRowWidths2 = [0];
        ccChips.forEach(function(chip) {
          ctx.font = '600 ' + ccFSize + 'px \'' + ccFont + '\', \'Pretendard\', sans-serif';
          var tw    = ctx.measureText(chip.label || '').width;
          var chipW = Math.max(ccChipH, tw + ccChipPadH * 2);
          ctx.font  = ccFSize + 'px \'' + ccFont + '\', \'Pretendard\', sans-serif';
          var descW = chip.desc ? ctx.measureText(chip.desc).width : 0;
          var rowW  = chipW + (descW > 0 ? ccDescGap + descW : 0);
          var ri = ccRows2.length - 1;
          var needed = ccRowWidths2[ri] > 0 ? ccRowWidths2[ri] + ccGap + rowW : rowW;
          if (needed > ccAvailW && ccRows2[ri].length > 0) {
            ccRows2.push([]);
            ccRowWidths2.push(0);
            ri++;
          }
          ccRows2[ri].push({ chip: chip, chipW: chipW, descW: descW, rowW: rowW });
          ccRowWidths2[ri] = ccRowWidths2[ri] > 0 ? ccRowWidths2[ri] + ccGap + rowW : rowW;
        });
        var ccTotalH2 = ccRows2.length * ccChipH + Math.max(0, ccRows2.length - 1) * ccGap;
        var ccStartY2 = _ccStartY(ccTotalH2);
        ccRows2.forEach(function(row, ri) {
          var rowY = ccStartY2 + ri * (ccChipH + ccGap);
          if (rowY + ccChipH > by + bh) return;
          var curX = _ccRowX(ccRowWidths2[ri]);
          row.forEach(function(item) {
            var chipRadPx = Math.round(ccChipH / 2 * ccRad / 50);
            if (showSwatch) {
              ctx.fillStyle = item.chip.color || '#888888';
              roundRectPath(curX, rowY, item.chipW, ccChipH, chipRadPx);
              ctx.fill();
            } else {
              ctx.save();
              ctx.strokeStyle = item.chip.color || '#888888';
              ctx.lineWidth   = 1.5;
              roundRectPath(curX, rowY, item.chipW, ccChipH, chipRadPx);
              ctx.stroke();
              ctx.restore();
            }
            ctx.fillStyle = showSwatch ? (item.chip.textColor || blk.ccTextColor || '#212121') : (item.chip.color || '#888888');
            ctx.font      = '600 ' + ccFSize + 'px \'' + ccFont + '\', \'Pretendard\', sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(item.chip.label || '', curX + item.chipW / 2, rowY + ccChipH / 2);
            if (item.chip.desc) {
              ctx.fillStyle = '#212121';
              ctx.font      = ccFSize + 'px \'' + ccFont + '\', \'Pretendard\', sans-serif';
              ctx.textAlign = 'left';
              ctx.fillText(item.chip.desc, curX + item.chipW + ccDescGap, rowY + ccChipH / 2);
            }
            curX += item.rowW + ccGap;
          });
        });
      } else {
        /* showText=OFF: 칩만 wrap */
        var ccRows = [[]];
        var ccRowWidths = [0];
        ccChips.forEach(function(chip) {
          var tw  = ctx.measureText(chip.label || '').width;
          var ccw = Math.max(ccChipH, tw + ccChipPadH * 2);
          var ri  = ccRows.length - 1;
          var needed = ccRowWidths[ri] > 0 ? ccRowWidths[ri] + ccGap + ccw : ccw;
          if (needed > ccAvailW && ccRows[ri].length > 0) {
            ccRows.push([]);
            ccRowWidths.push(0);
            ri++;
          }
          ccRows[ri].push({ chip: chip, w: ccw });
          ccRowWidths[ri] = ccRowWidths[ri] > 0 ? ccRowWidths[ri] + ccGap + ccw : ccw;
        });
        var ccTotalH = ccRows.length * ccChipH + Math.max(0, ccRows.length - 1) * ccGap;
        var ccStartY = _ccStartY(ccTotalH);
        ccRows.forEach(function(row, ri) {
          var rowY = ccStartY + ri * (ccChipH + ccGap);
          if (rowY + ccChipH > by + bh) return;
          var curX = _ccRowX(ccRowWidths[ri]);
          row.forEach(function(item) {
            var chipRadPx = Math.round(ccChipH / 2 * ccRad / 50);
            if (showSwatch) {
              ctx.fillStyle = item.chip.color || '#888888';
              roundRectPath(curX, rowY, item.w, ccChipH, chipRadPx);
              ctx.fill();
            } else {
              ctx.save();
              ctx.strokeStyle = item.chip.color || '#888888';
              ctx.lineWidth   = 1.5;
              roundRectPath(curX, rowY, item.w, ccChipH, chipRadPx);
              ctx.stroke();
              ctx.restore();
            }
            ctx.fillStyle = showSwatch ? (item.chip.textColor || blk.ccTextColor || '#212121') : (item.chip.color || '#888888');
            ctx.textAlign = 'center';
            ctx.fillText(item.chip.label || '', curX + item.w / 2, rowY + ccChipH / 2);
            curX += item.w + ccGap;
          });
        });
      }
      ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';

    /* 4-g. 항목 블록 */
    } else if (blk.type === 'item') {
      var _iPre  = blk.preset    || 'pm-chip';
      var _iDir  = blk.direction || 'h';
      var _iDiv  = blk.divider   === true;
      var _iCS   = blk.chipStyle || 'fill';
      var _iPt   = blk.ptColor   || '#5B7CE6';
      var _iItms = blk.items     || [];
      var _iFnt  = globalVals.font || 'Pretendard';
      var _iFS   = "'" + _iFnt + "', 'Pretendard', sans-serif";
      /* 개별 블록 크기·간격 배율 */
      var _iSizeScale = (blk.itemSizeScale || 100) / 100;
      var _iGapScale  = (blk.itemGapScale  || 100) / 100;
      /* 버튼식(pm-chip) 전용 — 버튼 텍스트크기·라운딩·폰트색 (항목 전체 크기와 별개) */
      var _iBtnFontScale = (blk.itemBtnFontScale || 100) / 100;
      var _iBtnRadius = (blk.itemBtnRadius !== null && blk.itemBtnRadius !== undefined) ? blk.itemBtnRadius : 8;
      var _iBtnColor = blk.itemBtnColor || null;

      /* ptColor 파생색 (ptVars와 동일 로직) */
      var _iRgb = function(h){ var m=(h||'').replace('#',''); return m.length===6?[parseInt(m.substr(0,2),16),parseInt(m.substr(2,2),16),parseInt(m.substr(4,2),16)]:[0,0,0]; };
      var _iMix = function(h1,h2,t){ var a=_iRgb(h1),b=_iRgb(h2); return 'rgb('+Math.round(a[0]+(b[0]-a[0])*t)+','+Math.round(a[1]+(b[1]-a[1])*t)+','+Math.round(a[2]+(b[2]-a[2])*t)+')'; };
      var _iPtInk = _iMix(_iPt,'#000000',0.28);

      /* 블록 내부 여백 (blk-item padding:8px 기본값 + 박스 크기 대비 라운딩이 과대한 경우
         모서리 호에 깎이지 않도록 추가 여백 — DOM(canvas-render.js makeBlk)과 동일한 공식) */
      var _iP  = Math.max(8, _cornerSafeMargin(r, bw, bh));
      var _iX  = bx + _iP;
      var _iY  = by + _iP;
      var _iW  = bw - _iP * 2;
      var _iVA = blk.vAlign || 'center';
      var _iVOffset = function(totalH) {
        var avail = bh - _iP * 2;
        return _iVA === 'top'    ? 0
             : _iVA === 'bottom' ? Math.max(0, avail - totalH)
             :                     Math.max(0, (avail - totalH) / 2);
      };

      ctx.save();
      roundRectPath(bx, by, bw, bh, r);
      ctx.clip();

      /* 아래 4개 프리셋은 wrapText()로 값(v) 텍스트 줄바꿈 높이를 dryRun 사전 측정한 뒤
         행 높이를 동적으로 계산함 — DOM이 폭 부족 시 자동 줄바꿈하는 것과 동일하게 맞춤(BUG-39, 2026-06-17).
         _applyItemSize()/_itemMinH()는 여전히 _ITEM_METRICS(고정 1줄 기준)를 초기 추정치로 사용하며,
         실제 줄바꿈 발생 시 정확한 높이는 _itemAutoExpand()가 DOM 측정으로 보정함. */

      /* ── pm-chip ── */
      if (_iPre === 'pm-chip') {
        var _cTokenH = 18 * _iSizeScale;  /* 칩 토큰 높이(패딩 3px+3px + 폰트10.5px 실측) */
        var _cRowGap = 8 * _iGapScale;
        var _cKVGapH = 10 * _iGapScale;   /* 가로형: 칩-값 간격 */
        var _cKVGapV = 5  * _iGapScale;   /* 세로형: 칩-값 간격 */
        var _cPadR   = 20 * _iGapScale;   /* .pm-chip .ir padding-right:20px */
        var _cChipR  = _iBtnRadius;
        var _cKFont = Math.round(10.5 * _iSizeScale * _iBtnFontScale);
        var _cVFont = Math.round(12 * _iSizeScale);
        var _cVLineH = 12 * 1.5 * _iSizeScale;  /* .pm-chip .v line-height:1.5 */
        /* draw=false: 높이만 측정(드로잉 생략), draw=true: 실제로 그림 — 항상 수직 중앙정렬을
           위해 1차 측정 후 오프셋 계산, 2차에서 실제 드로잉 */
        var _runPmChip = function(startY, draw) {
          var curY = startY, lastBottom = startY;
          _iItms.forEach(function(it, idx) {
            if (_iDiv && idx > 0) {
              if (draw) {
                ctx.save(); ctx.strokeStyle = '#ECEAE4'; ctx.lineWidth = 0.5;
                ctx.beginPath();
                ctx.moveTo(_iX, curY); ctx.lineTo(_iX + _iW, curY);
                ctx.stroke(); ctx.restore();
              }
              curY += 9 * _iGapScale;
            }
            ctx.font = '700 ' + _cKFont + 'px ' + _iFS;
            var _lw = ctx.measureText(it.k || '').width;
            var _cw2 = Math.max(Math.round(48 * _iSizeScale), _lw + Math.round(20 * _iSizeScale));
            /* 값 텍스트 줄바꿈 높이 사전 측정(dryRun) — 실제 폭이 좁아 줄바꿈되면 행 높이도 함께 늘림 */
            var _vMaxW = _iDir === 'h' ? Math.max(20, _iW - _cw2 - _cKVGapH - _cPadR) : _iW;
            ctx.font = '400 ' + _cVFont + 'px ' + _iFS;
            var _vH = wrapText(it.v || '', 0, 0, _vMaxW, _cVLineH, true) || _cVLineH;
            var _rowH = Math.max(_cTokenH, _vH);
            var _chipY = _iDir === 'h' ? (curY + (_rowH - _cTokenH) / 2) : curY;
            if (draw) {
              if (_iCS === 'fill') {
                ctx.fillStyle = _iPt;
                roundRectPath(_iX, _chipY, _cw2, _cTokenH, _cChipR);
                ctx.fill();
                ctx.fillStyle = _iBtnColor || '#ffffff';
              } else {
                ctx.save(); ctx.strokeStyle = _iPt; ctx.lineWidth = 1.3;
                roundRectPath(_iX, _chipY, _cw2, _cTokenH, _cChipR);
                ctx.stroke(); ctx.restore();
                ctx.fillStyle = _iBtnColor || _iPtInk;
              }
              ctx.font = '700 ' + _cKFont + 'px ' + _iFS;
              ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
              ctx.fillText(it.k || '', _iX + _cw2 / 2, _chipY + _cTokenH / 2);
              ctx.fillStyle = '#212121';
              ctx.font = '400 ' + _cVFont + 'px ' + _iFS;
              ctx.textAlign = 'left'; ctx.textBaseline = 'top';
            }
            if (_iDir === 'h') {
              if (draw) wrapText(it.v || '', _iX + _cw2 + _cKVGapH, curY + (_rowH - _vH) / 2, _vMaxW, _cVLineH, false);
            } else {
              if (draw) wrapText(it.v || '', _iX, _chipY + _cTokenH + _cKVGapV, _vMaxW, _cVLineH, false);
              _rowH = _cTokenH + _cKVGapV + _vH;
            }
            curY += _rowH;
            lastBottom = curY;
            curY += _cRowGap;
          });
          return lastBottom - startY;
        };
        var _chipTotalH = _runPmChip(_iY, false);
        _runPmChip(_iY + _iVOffset(_chipTotalH), true);

      /* ── pm-hair ── */
      } else if (_iPre === 'pm-hair') {
        var _hPadTB = 9 * _iGapScale;
        var _hPadR  = 20 * _iGapScale;
        var _hKVGap = 3 * _iGapScale;
        var _hKH    = 13 * _iSizeScale;
        var _hKFont = Math.round(11 * _iSizeScale);
        var _hVFont = Math.round(12 * _iSizeScale);
        var _hVLineH = 12 * 1.45 * _iSizeScale;  /* .pm-hair .v line-height:1.45 */
        /* draw=false: 높이만 측정, draw=true: 실제로 그림 — 항상 수직 중앙정렬을 위해
           1차 측정 후 오프셋 계산, 2차에서 실제 드로잉 */
        var _runPmHair = function(startY, draw) {
          var curY = startY;
          _iItms.forEach(function(it, idx) {
            if (_iDiv && idx > 0) {
              if (draw) {
                ctx.save(); ctx.strokeStyle = '#ECEAE4'; ctx.lineWidth = 0.5;
                ctx.beginPath();
                ctx.moveTo(_iX, curY); ctx.lineTo(_iX + _iW - _hPadR, curY);
                ctx.stroke(); ctx.restore();
              }
              curY += 9 * _iGapScale;
            }
            ctx.font = '600 ' + _hKFont + 'px ' + _iFS;
            var _kw = ctx.measureText(it.k || '').width;  /* .pm-hair .k는 nowrap — 줄바꿈 없음 */
            if (_iDir === 'h') {
              var _vMaxW = Math.max(20, _iW - _hPadR - _kw - 8);
              ctx.font = '400 ' + _hVFont + 'px ' + _iFS;
              var _vH = wrapText(it.v || '', 0, 0, _vMaxW, _hVLineH, true) || _hVLineH;
              var _rowH = Math.max(_hKH, _vH) + _hPadTB * 2;
              if (draw) {
                ctx.fillStyle = _iPtInk; ctx.font = '600 ' + _hKFont + 'px ' + _iFS;
                ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
                ctx.fillText(it.k || '', _iX, curY + _rowH / 2);
                ctx.fillStyle = '#212121'; ctx.font = '400 ' + _hVFont + 'px ' + _iFS;
                ctx.textAlign = 'right'; ctx.textBaseline = 'top';
                wrapText(it.v || '', _iX + _iW - _hPadR, curY + (_rowH - _vH) / 2, _vMaxW, _hVLineH, false);
              }
              curY += _rowH;
            } else {
              var _vMaxW2 = _iW;
              ctx.font = '400 ' + _hVFont + 'px ' + _iFS;
              var _vH2 = wrapText(it.v || '', 0, 0, _vMaxW2, _hVLineH, true) || _hVLineH;
              if (draw) {
                ctx.fillStyle = _iPtInk; ctx.font = '600 ' + _hKFont + 'px ' + _iFS;
                ctx.textAlign = 'left'; ctx.textBaseline = 'top';
                ctx.fillText(it.k || '', _iX, curY + _hPadTB);
                ctx.fillStyle = '#212121'; ctx.font = '400 ' + _hVFont + 'px ' + _iFS;
                ctx.textAlign = 'left';
                wrapText(it.v || '', _iX, curY + _hPadTB + _hKH + _hKVGap, _vMaxW2, _hVLineH, false);
              }
              curY += _hPadTB + _hKH + _hKVGap + _vH2 + _hPadTB;
            }
          });
          return curY - startY;
        };
        var _hairTotalH = _runPmHair(_iY, false);
        _runPmHair(_iY + _iVOffset(_hairTotalH), true);

      /* ── pm-cap ── */
      } else if (_iPre === 'pm-cap') {
        var _capGap   = 12 * _iGapScale;
        var _capPadR  = 20 * _iGapScale;
        var _capKH    = 11 * _iSizeScale;
        var _capKVGap = 3 * _iGapScale;
        var _capKFont = Math.round(9 * _iSizeScale);
        var _capVFont = Math.round(12.5 * _iSizeScale);
        var _capVLineH = 12.5 * 1.4 * _iSizeScale;  /* .pm-cap .v line-height:1.4 */
        /* draw=false: 높이만 측정, draw=true: 실제로 그림 — 항상 수직 중앙정렬을 위해
           1차 측정 후 오프셋 계산, 2차에서 실제 드로잉 */
        var _runPmCap = function(startY, draw) {
          var curY = startY, lastBottom = startY;
          _iItms.forEach(function(it, idx) {
            if (_iDiv && idx > 0) {
              if (draw) {
                ctx.save(); ctx.strokeStyle = '#ECEAE4'; ctx.lineWidth = 0.5;
                ctx.beginPath();
                ctx.moveTo(_iX, curY); ctx.lineTo(_iX + _iW - _capPadR, curY);
                ctx.stroke(); ctx.restore();
              }
              curY += 9 * _iGapScale;
            }
            if (_iDir === 'h') {
              ctx.font = '800 ' + _capKFont + 'px ' + _iFS;
              var _capKw = ctx.measureText((it.k || '').toUpperCase()).width;
              var _capVMaxW = Math.max(20, _iW - _capPadR - _capKw - 14);
              ctx.font = '400 ' + _capVFont + 'px ' + _iFS;
              var _capVH = wrapText(it.v || '', 0, 0, _capVMaxW, _capVLineH, true) || _capVLineH;
              var _capRowH = Math.max(_capKH, _capVH);
              if (draw) {
                ctx.fillStyle = _iPt; ctx.font = '800 ' + _capKFont + 'px ' + _iFS;
                ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
                ctx.fillText((it.k || '').toUpperCase(), _iX, curY + _capRowH / 2);
                ctx.fillStyle = '#212121'; ctx.font = '400 ' + _capVFont + 'px ' + _iFS;
                ctx.textAlign = 'right'; ctx.textBaseline = 'top';
                wrapText(it.v || '', _iX + _iW - _capPadR, curY + (_capRowH - _capVH) / 2, _capVMaxW, _capVLineH, false);
              }
              curY += _capRowH;
            } else {
              ctx.font = '400 ' + _capVFont + 'px ' + _iFS;
              var _capVH2 = wrapText(it.v || '', 0, 0, _iW, _capVLineH, true) || _capVLineH;
              if (draw) {
                ctx.fillStyle = _iPt; ctx.font = '800 ' + _capKFont + 'px ' + _iFS;
                ctx.textAlign = 'left'; ctx.textBaseline = 'top';
                ctx.fillText((it.k || '').toUpperCase(), _iX, curY);
                ctx.fillStyle = '#212121'; ctx.font = '400 ' + _capVFont + 'px ' + _iFS;
                ctx.textAlign = 'left';
                wrapText(it.v || '', _iX, curY + _capKH + _capKVGap, _iW, _capVLineH, false);
              }
              curY += _capKH + _capKVGap + _capVH2;
            }
            lastBottom = curY;
            curY += _capGap;
          });
          return lastBottom - startY;
        };
        var _capTotalH = _runPmCap(_iY, false);
        _runPmCap(_iY + _iVOffset(_capTotalH), true);

      /* ── pm-grid (2열 카드) ── */
      } else if (_iPre === 'pm-grid') {
        var _gGap    = 7 * _iGapScale;
        var _gR      = 9;
        var _gCardW  = (_iW - _gGap) / 2;
        var _gPadT   = 6 * _iGapScale; /* pm-grid padding-top */
        var _gPadL   = 11 * _iGapScale;
        var _gPadTop = 10 * _iGapScale;
        var _gKH     = 10 * _iSizeScale;
        var _gKVGap  = 4 * _iGapScale;
        var _gKFont = Math.round(8.5 * _iSizeScale);
        var _gVFont = Math.round(11.5 * _iSizeScale);
        var _gVLineH = 11.5 * 1.35 * _iSizeScale;  /* .pm-grid .v line-height:1.35 */

        var _gPadRCard = 20 * _iGapScale;  /* .pm-grid .ir padding-right:20px */
        var _gHGap     = 8 * _iGapScale;   /* .pm-grid.dir-h .ir gap:8px */
        /* 1패스: 카드별 필요한 값 텍스트 줄바꿈 높이 사전 측정 */
        var _gCardData = _iItms.map(function(it, gi) {
          var _span = (gi === _iItms.length - 1 && _iItms.length % 2 === 1);
          var _cw3  = _span ? _iW : _gCardW;
          var _vMaxW;
          if (_iDir === 'h') {
            ctx.font = '800 ' + _gKFont + 'px ' + _iFS;
            var _gKw = ctx.measureText((it.k || '').toUpperCase()).width;
            _vMaxW = Math.max(20, _cw3 - _gPadL - _gPadRCard - _gKw - _gHGap);
          } else {
            _vMaxW = Math.max(20, _cw3 - _gPadL - _gPadRCard);
          }
          ctx.font = '400 ' + _gVFont + 'px ' + _iFS;
          var _vH = wrapText(it.v || '', 0, 0, _vMaxW, _gVLineH, true) || _gVLineH;
          var _natH = _iDir === 'h'
            ? Math.max(_gKH, _vH) + _gPadTop * 2
            : _gPadTop + _gKH + _gKVGap + _vH + _gPadTop;
          return { vMaxW: _vMaxW, vH: _vH, natH: _natH, cw3: _cw3 };
        });
        /* 2패스: 2개씩 짝지어 행 높이 = 둘 중 더 큰 카드 기준(CSS grid 자동 행높이와 동일) */
        var _gRowH = [];
        for (var _gi2 = 0; _gi2 < _gCardData.length; _gi2 += 2) {
          var _h1 = _gCardData[_gi2].natH;
          var _h2 = (_gi2 + 1 < _gCardData.length) ? _gCardData[_gi2 + 1].natH : 0;
          var _rh = Math.max(_h1, _h2);
          _gRowH.push(_rh);
          _gCardData[_gi2].rowH = _rh;
          if (_gCardData[_gi2 + 1]) _gCardData[_gi2 + 1].rowH = _rh;
        }

        /* 항상 수직 중앙정렬 — .pm-grid의 padding-top까지 포함한 전체 콘텐츠 높이를
           구해(DOM에서 .pm 전체가 .blk-item 안에서 중앙정렬되는 것과 동일하게) 오프셋 계산 */
        var _gTotalH = _gRowH.reduce(function(s, h) { return s + h; }, 0) + Math.max(0, _gRowH.length - 1) * _gGap;
        var _gWholeH = _gPadT + _gTotalH;
        var _gCurY = _iY + _gPadT + _iVOffset(_gWholeH);
        _iItms.forEach(function(it, gi) {
          var _col  = gi % 2;
          var _row2 = Math.floor(gi / 2);
          var _cd   = _gCardData[gi];
          var _cx2  = _iX + _col * (_gCardW + _gGap);
          var _cy2  = _gCurY;
          for (var _ri = 0; _ri < _row2; _ri++) { _cy2 += _gRowH[_ri] + _gGap; }
          var _cw3  = _cd.cw3;
          var _cardH = _cd.rowH;
          /* 카드 배경 + 테두리 */
          ctx.save();
          ctx.fillStyle = '#ffffff';
          roundRectPath(_cx2, _cy2, _cw3, _cardH, _gR);
          ctx.fill();
          ctx.strokeStyle = '#EAE8E2'; ctx.lineWidth = 1;
          roundRectPath(_cx2, _cy2, _cw3, _cardH, _gR);
          ctx.stroke();
          ctx.restore();
          /* 카드 콘텐츠 */
          if (_iDir === 'h') {
            ctx.fillStyle = _iPt;
            ctx.font = '800 ' + _gKFont + 'px ' + _iFS;
            ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
            ctx.fillText((it.k || '').toUpperCase(), _cx2 + _gPadL, _cy2 + _cardH / 2);
            ctx.fillStyle = '#212121';
            ctx.font = '400 ' + _gVFont + 'px ' + _iFS;
            ctx.textAlign = 'right'; ctx.textBaseline = 'top';
            wrapText(it.v || '', _cx2 + _cw3 - _gPadL, _cy2 + (_cardH - _cd.vH) / 2, _cd.vMaxW, _gVLineH, false);
          } else {
            ctx.fillStyle = _iPt;
            ctx.font = '800 ' + _gKFont + 'px ' + _iFS;
            ctx.textAlign = 'left'; ctx.textBaseline = 'top';
            ctx.fillText((it.k || '').toUpperCase(), _cx2 + _gPadL, _cy2 + _gPadTop);
            ctx.fillStyle = '#212121';
            ctx.font = '400 ' + _gVFont + 'px ' + _iFS;
            ctx.textAlign = 'left';
            wrapText(it.v || '', _cx2 + _gPadL, _cy2 + _gPadTop + _gKH + _gKVGap, _cd.vMaxW, _gVLineH, false);
          }
        });
      }

      ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
      ctx.restore();
    }

    ctx.restore();
    });

    /* 라운드 타입 클립 해제 */
    if (roundClipOpen) {
      ctx.restore();
    }

    /* 스티커 합성 후 다운로드
       F-17: #sticker-layer가 canvasExtraTop만큼 아래로 이동해 렌더되므로(라이브 DOM과 동일하게)
       oy에도 canvasExtraTop을 더해 보정 — renderStickersToCanvas(재작성 금지) 내부는 안 건드림 */
    var stickerPromise = (typeof renderStickersToCanvas === 'function' && stickers.length > 0)
      ? renderStickersToCanvas(ctx, ox + canvasExtraLeft, oy + canvasExtraTop, DPR)
      : Promise.resolve();

    return stickerPromise;

  }).then(function() {
    a.href = canvas.toDataURL('image/png');
    a.click();
    /* 버튼 복원 + 완료 토스트 */
    if (_saveBtn) { _saveBtn.disabled = false; _saveBtn.innerHTML = _saveBtnOrigHTML; }
    showToast('PNG 저장 완료');
  });

  }); /* /document.fonts.ready */
}

