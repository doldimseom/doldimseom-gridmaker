/* panel-bg.js — 리팩토링 2단계 5번째 조각: 배경지(bgLayer) 패널 (app/public/legacy/main.js에서 추출, 로직 변경 없음) */
/* ══════════════════════════════════════════
   배경지 (bgLayer)
══════════════════════════════════════════ */

/* 모눈종이 SVG → data URI 생성 */
function makeBgGridDataUri(size, angle, color, opacity) {
  var a = (opacity / 100).toFixed(3);
  var stroke = 'stroke="' + color + '" stroke-opacity="' + a + '" stroke-width="0.5"';

  /* SVG 전체(100%×100%)를 덮는 하나의 rect에 pattern을 fill로 지정.
     CSS background-size / background-repeat 없이 SVG 내부에서 반복 처리.
     patternTransform="rotate(angle)"으로 격자 전체가 기울어짐. */
  var ptH = angle ? ' patternTransform="rotate(' + angle + ')"' : '';
  var ptV = ' patternTransform="rotate(' + (angle + 90) + ')"';

  var svg =
    '<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">' +
      '<defs>' +
        '<pattern id="ph" x="0" y="0" width="' + size + '" height="' + size + '" patternUnits="userSpaceOnUse"' + ptH + '>' +
          '<line x1="0" y1="0" x2="' + (size * 10) + '" y2="0" ' + stroke + '/>' +
        '</pattern>' +
        '<pattern id="pv" x="0" y="0" width="' + size + '" height="' + size + '" patternUnits="userSpaceOnUse"' + ptV + '>' +
          '<line x1="0" y1="0" x2="' + (size * 10) + '" y2="0" ' + stroke + '/>' +
        '</pattern>' +
      '</defs>' +
      '<rect width="100%" height="100%" fill="url(#ph)"/>' +
      '<rect width="100%" height="100%" fill="url(#pv)"/>' +
    '</svg>';

  var uri = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  return uri;
}

/* sheet-pad에 배경 CSS 적용 */
/* SVG <image> + patternTransform 방식으로 기울어진 타일 패턴 data URI 생성 (동기)
   imgSrc: base64 이미지, tileW: 타일 너비 px, tileH: 타일 높이 px, angle: 0|15|30|45
   Canvas 비동기 방식 폐기 — SVG 방식으로 전환하여 깜빡임 원인 제거 */
function makeTileSvgDataUri(imgSrc, tileW, tileH, angle, offsetX, offsetY) {
  var ptAttr = angle ? ' patternTransform="rotate(' + angle + ')"' : '';
  var ox = offsetX || 0;
  var oy = offsetY || 0;
  var svg =
    '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="100%" height="100%">' +
      '<defs>' +
        '<pattern id="tp" x="' + ox + '" y="' + oy + '" width="' + tileW + '" height="' + tileH + '" patternUnits="userSpaceOnUse"' + ptAttr + '>' +
          '<image xlink:href="' + imgSrc + '" x="0" y="0" width="' + tileW + '" height="' + tileH + '" preserveAspectRatio="none"/>' +
        '</pattern>' +
      '</defs>' +
      '<rect width="100%" height="100%" fill="url(#tp)"/>' +
    '</svg>';
  var uri = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  return uri;
}

/* Canvas PNG 전용 — width/height를 px 고정값으로 지정
   100%는 Canvas에서 0으로 해석되므로 svgW/svgH를 명시적으로 전달 */
function makeTileSvgDataUriPx(imgSrc, tileW, tileH, angle, svgW, svgH) {
  var ptAttr = angle ? ' patternTransform="rotate(' + angle + ')"' : '';
  var svg =
    '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="' + svgW + '" height="' + svgH + '">' +
      '<defs>' +
        '<pattern id="tp" x="0" y="0" width="' + tileW + '" height="' + tileH + '" patternUnits="userSpaceOnUse"' + ptAttr + '>' +
          '<image xlink:href="' + imgSrc + '" x="0" y="0" width="' + tileW + '" height="' + tileH + '" preserveAspectRatio="none"/>' +
        '</pattern>' +
      '</defs>' +
      '<rect width="' + svgW + '" height="' + svgH + '" fill="url(#tp)"/>' +
    '</svg>';
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}

function applySheetBgLayer() {
  var pad = document.getElementById('sheet-pad');
  if (!pad) return;

  /* pad.backgroundColor는 render()가 전적으로 관리 — 여기서 절대 건드리지 않음.
     배경지 on/off에 관계없이 overlay만 업데이트한다. */

  if (!bgLayer.on) {
    /* off — overlay 완전 초기화 */
    var ol = document.getElementById('bgl-overlay');
    if (ol) {
      ol.style.backgroundColor = '';
      ol.style.backgroundImage = '';
      ol.style.opacity = '1';
    }
    return;
  }

  var imgUrl  = null;
  var opacity = bgLayer.opacity / 100;

  if (bgLayer.imgMode === 'grid') {
    imgUrl = makeBgGridDataUri(bgLayer.gridSize, bgLayer.gridAngle, bgLayer.gridColor, bgLayer.opacity);
  } else if (bgLayer.imgOn && bgLayer.imgSrc) {
    imgUrl = bgLayer.imgSrc;
  }

  /* 이미지/색상 모두 overlay div로 위임 */
  _applyBgLayerOverlay(imgUrl, opacity);
}

/* overlay를 색상 레이어(bgl-clr)와 이미지 레이어(bgl-img)로 분리
   — 투명도 슬라이더가 배경색에 영향을 미치지 않도록 */
function _applyBgLayerOverlay(imgUrl, opacity) {
  var pad = document.getElementById('sheet-pad');
  if (!pad) return;

  var ol = document.getElementById('bgl-overlay');
  if (!ol) {
    ol = document.createElement('div');
    ol.id = 'bgl-overlay';
    ol.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:0;border-radius:inherit;';
    pad.style.position = 'relative';
    pad.insertBefore(ol, pad.firstChild);
  }

  /* 색상 레이어 — 투명도 미적용 */
  var cl = ol.querySelector('.bgl-clr');
  if (!cl) {
    cl = document.createElement('div');
    cl.className = 'bgl-clr';
    cl.style.cssText = 'position:absolute;inset:0;border-radius:inherit;pointer-events:none;';
    ol.insertBefore(cl, ol.firstChild);
  }
  cl.style.backgroundColor = bgLayer.color ? bgLayer.color : '';

  /* 이미지 레이어 — 투명도 적용 */
  var il = ol.querySelector('.bgl-img');
  if (!il) {
    il = document.createElement('div');
    il.className = 'bgl-img';
    il.style.cssText = 'position:absolute;inset:0;border-radius:inherit;pointer-events:none;';
    ol.appendChild(il);
  }

  if (!bgLayer.imgOn || !imgUrl) {
    il.style.backgroundImage = '';
    il.style.opacity = '1';
    return;
  }

  if (bgLayer.imgMode === 'grid') {
    il.style.backgroundImage = 'url("' + imgUrl + '")';
    il.style.backgroundRepeat = 'no-repeat';
    il.style.backgroundSize = '100% 100%';
    il.style.backgroundPosition = '';
    il.style.opacity = '1'; /* grid SVG에 투명도 이미 반영 */
  } else if (bgLayer.repeat === 'cover') {
    il.style.backgroundImage = 'url("' + imgUrl + '")';
    il.style.backgroundRepeat = 'no-repeat';
    il.style.backgroundSize = 'cover';
    il.style.backgroundPosition = 'center';
    il.style.opacity = opacity.toFixed(3);
  } else if (bgLayer.repeat === 'tile') {
    var tileW = Math.round(bgLayer.zoom);
    var tileH = bgLayer._imgNaturalH && bgLayer._imgNaturalW
      ? Math.round(tileW * bgLayer._imgNaturalH / bgLayer._imgNaturalW)
      : tileW;
    var svgUri = makeTileSvgDataUri(imgUrl, tileW, tileH, bgLayer.tileAngle || 0, bgLayer.posX, bgLayer.posY);
    il.style.backgroundImage = 'url("' + svgUri + '")';
    il.style.backgroundRepeat = 'no-repeat';
    il.style.backgroundSize = '100% 100%';
    il.style.backgroundPosition = '';
    il.style.opacity = opacity.toFixed(3);
  } else {
    il.style.backgroundImage = 'url("' + imgUrl + '")';
    il.style.backgroundRepeat = 'no-repeat';
    il.style.backgroundSize = bgLayer.zoom + '%';
    il.style.backgroundPosition = 'calc(50% + ' + bgLayer.posX + 'px) calc(50% + ' + bgLayer.posY + 'px)';
    il.style.opacity = opacity.toFixed(3);
  }
}

/* 패널 UI 동기화 */
function syncBgLayerPanel() {
  /* 배경색 */
  var cs = document.getElementById('bgl-color-cw');
  var ch = document.getElementById('bgl-color-hex');
  var cp = document.getElementById('bgl-color-picker');
  if (bgLayer.color) {
    if (cs) { cs.style.backgroundImage = 'none'; cs.style.backgroundColor = bgLayer.color; }
    if (ch) ch.value = bgLayer.color.toUpperCase();
    if (cp) cp.value = bgLayer.color;
  } else {
    if (cs) { cs.style.backgroundColor = 'transparent'; cs.style.backgroundImage = 'linear-gradient(45deg,#ccc 25%,transparent 25%,transparent 75%,#ccc 75%),linear-gradient(45deg,#ccc 25%,transparent 25%,transparent 75%,#ccc 75%)'; cs.style.backgroundSize = '8px 8px'; cs.style.backgroundPosition = '0 0,4px 4px'; }
    if (ch) ch.value = '없음';
  }

  /* 소스 세그먼트 */
  var su = document.getElementById('bgl-src-upload');
  var sg = document.getElementById('bgl-src-grid');
  if (su) su.classList.toggle('on', bgLayer.imgOn && bgLayer.imgMode === 'upload');
  if (sg) sg.classList.toggle('on', bgLayer.imgOn && bgLayer.imgMode === 'grid');

  /* 업로드 / 모눈 패널 */
  var up = document.getElementById('bgl-upload-panel');
  var gp = document.getElementById('bgl-grid-panel');
  if (up) up.style.display = (bgLayer.imgOn && bgLayer.imgMode === 'upload') ? '' : 'none';
  if (gp) gp.style.display = (bgLayer.imgOn && bgLayer.imgMode === 'grid')   ? '' : 'none';

  /* 업로드 박스 상태 */
  _syncBgUploadBox();

  /* 반복 방식 */
  ['none','cover','tile'].forEach(function(r) {
    var b = document.getElementById('bgl-rep-' + r);
    if (b) b.classList.toggle('on', bgLayer.repeat === r);
  });

  /* 타일 각도 행 */
  var tar = document.getElementById('bgl-tile-angle-row');
  if (tar) tar.style.display = bgLayer.repeat === 'tile' ? '' : 'none';
  var pzw = document.getElementById('bgl-pos-zoom-wrap');
  if (pzw) pzw.style.display = bgLayer.repeat === 'cover' ? 'none' : '';
  [0,15,30,45].forEach(function(a) {
    var b = document.getElementById('bgl-ta-' + a);
    if (b) b.classList.toggle('on', bgLayer.tileAngle === a);
  });

  /* X/Y/줌 슬라이더 */
  _syncSlider('sl-bgl-x',    'sn-bgl-x',    bgLayer.posX,  -200, 200);
  _syncSlider('sl-bgl-y',    'sn-bgl-y',    bgLayer.posY,  -200, 200);
  _syncSlider('sl-bgl-zoom', 'sn-bgl-zoom', bgLayer.zoom,   20,  200);

  /* 모눈 컨트롤 */
  _syncSlider('sl-bgl-gs', 'sn-bgl-gs', bgLayer.gridSize, 8, 80);
  [0,15,30,45].forEach(function(a) {
    var b = document.getElementById('bgl-ga-' + a);
    if (b) b.classList.toggle('on', bgLayer.gridAngle === a);
  });
  var gc = document.getElementById('bgl-grid-color-swatch');
  var gh = document.getElementById('bgl-grid-color-hex');
  var gcp = document.getElementById('bgl-grid-color-picker');
  if (gc)  gc.style.background = bgLayer.gridColor;
  if (gh)  gh.value           = bgLayer.gridColor.toUpperCase();
  if (gcp) gcp.value          = bgLayer.gridColor;

  /* 투명도 */
  _syncSlider('sl-bgl-op', 'sn-bgl-op', bgLayer.opacity, 0, 100);
}

/* 업로드 박스 썸네일 동기화 */
function _syncBgUploadBox() {
  var box = document.getElementById('bgl-upload-box');
  if (!box) return;
  if (bgLayer.imgSrc && bgLayer.imgMode === 'upload') {
    box.classList.add('has-img');
    box.innerHTML =
      '<img class="ub-thumb" src="' + bgLayer.imgSrc + '" alt="배경 이미지">' +
      '<button class="ub-del-x" title="이미지 삭제" aria-label="이미지 삭제" onclick="event.stopPropagation();clearBgLayerImg();">' +
        '<svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>' +
      '</button>';
  } else {
    box.classList.remove('has-img');
    box.innerHTML =
      '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 4v12M7 9l5-5 5 5M5 20h14"/></svg>' +
      '이미지 업로드<em>또는 드래그&amp;드롭</em>';
  }
}

/* 슬라이더 + 숫자 인풋 동기화 헬퍼 */
function _syncSlider(slId, snId, val, min, max) {
  var sl = document.getElementById(slId);
  var sn = document.getElementById(snId);
  if (!sl || !sn) return;
  var pct = Math.round((val - min) / (max - min) * 100);
  var fill  = sl.querySelector('.row-slider-fill');
  var thumb = sl.querySelector('.row-slider-thumb');
  if (fill)  fill.style.width = pct + '%';
  if (thumb) thumb.style.left = pct + '%';
  sn.value = val;
}

/* ── 배경지 이벤트 핸들러 ── */

function updateBgLayerColor(val) {
  bgLayer.color = val;
  var ch = document.getElementById('bgl-color-hex');
  var cs = document.getElementById('bgl-color-cw');
  if (ch) ch.value = val.toUpperCase();
  if (cs) { cs.style.backgroundImage = 'none'; cs.style.backgroundColor = val; }
  applySheetBgLayer();
}

function clearBgLayerColor() {
  bgLayer.color = '';
  applySheetBgLayer();
  syncBgLayerPanel();
}

function setBgLayerMode(mode) {
  if (bgLayer.imgOn && bgLayer.imgMode === mode) {
    bgLayer.imgOn = false;
    bgLayer.imgMode = null;
    applySheetBgLayer();
    syncBgLayerPanel();
    return;
  }
  bgLayer.imgMode = mode;
  bgLayer.imgOn = true;
  applySheetBgLayer();
  syncBgLayerPanel();
}

function triggerBgLayerUpload() {
  var inp = document.getElementById('bgl-file-input');
  if (inp) inp.click();
}

function onBgLayerFileChange(input) {
  var file = input.files[0];
  if (!file) return;
  var reader = new FileReader();
  reader.onload = function(e) {
    bgLayer.imgSrc  = e.target.result;
    bgLayer.imgOn   = true;
    bgLayer.imgMode = 'upload';
    /* 이미지 비율 캐시 — makeTileSvgDataUri에서 tileH 계산에 사용 */
    var imgTemp = new Image();
    imgTemp.onload = function() {
      bgLayer._imgNaturalW = imgTemp.naturalWidth;
      bgLayer._imgNaturalH = imgTemp.naturalHeight;
      applySheetBgLayer();
      syncBgLayerPanel();
    };
    imgTemp.onerror = function() {
      bgLayer._imgNaturalW = null;
      bgLayer._imgNaturalH = null;
      applySheetBgLayer();
      syncBgLayerPanel();
    };
    imgTemp.src = e.target.result;
  };
  reader.onerror = function() {
    showToast('이미지 파일을 읽지 못했습니다');
  };
  reader.readAsDataURL(file);
  input.value = '';
}

function clearBgLayerImg() {
  bgLayer.imgSrc = null;
  bgLayer._imgNaturalW = null;
  bgLayer._imgNaturalH = null;
  applySheetBgLayer();
  syncBgLayerPanel();
}

function setBgLayerRepeat(val) {
  bgLayer.repeat = val;
  if (val === 'cover') {
    bgLayer.posX = 0;
    bgLayer.posY = 0;
    bgLayer.zoom = 100;
  } else if (val === 'none') {
    bgLayer.zoom = 100;
  }
  applySheetBgLayer();
  syncBgLayerPanel();
}

function setBgLayerTileAngle(val) {
  bgLayer.tileAngle = val;
  applySheetBgLayer();
  syncBgLayerPanel();
}

function setBgLayerPosX(val) {
  bgLayer.posX = parseInt(val) || 0;
  _syncSlider('sl-bgl-x', 'sn-bgl-x', bgLayer.posX, -200, 200);
  applySheetBgLayer();
}

function setBgLayerPosY(val) {
  bgLayer.posY = parseInt(val) || 0;
  _syncSlider('sl-bgl-y', 'sn-bgl-y', bgLayer.posY, -200, 200);
  applySheetBgLayer();
}

function setBgLayerZoom(val) {
  bgLayer.zoom = Math.max(20, Math.min(200, parseInt(val) || 100));
  _syncSlider('sl-bgl-zoom', 'sn-bgl-zoom', bgLayer.zoom, 20, 200);
  applySheetBgLayer();
}

function setBgLayerOpacity(val) {
  bgLayer.opacity = Math.max(0, Math.min(100, parseInt(val) || 100));
  _syncSlider('sl-bgl-op', 'sn-bgl-op', bgLayer.opacity, 0, 100);
  applySheetBgLayer();
}

function setBgLayerGridSize(val) {
  bgLayer.gridSize = Math.max(8, Math.min(80, parseInt(val) || 20));
  _syncSlider('sl-bgl-gs', 'sn-bgl-gs', bgLayer.gridSize, 8, 80);
  applySheetBgLayer();
}

function setBgLayerGridAngle(val) {
  bgLayer.gridAngle = val;
  applySheetBgLayer();
  syncBgLayerPanel();
}

function setBgLayerGridColor(val) {
  bgLayer.gridColor = val;
  var gc = document.getElementById('bgl-grid-color-swatch');
  var gh = document.getElementById('bgl-grid-color-hex');
  if (gc) gc.style.background = val;
  if (gh) gh.textContent = val.toUpperCase();
  applySheetBgLayer();
}
