/* panel-block-txt.js — 리팩토링 2단계 7번째 조각: 텍스트 서식 플로팅 툴바 + 텍스트 편집 커밋 (두 군데로 나뉜 블록을 합침, app/public/legacy/main.js에서 추출, 로직 변경 없음) */
/* ══════════════════════════════════════════
   텍스트 서식 플로팅 툴바 제어
══════════════════════════════════════════ */
function showTxtFormatBar(blk) {
  var bar = document.getElementById('txt-format-bar');
  if (!bar) return;
  /* 툴바 버튼 클릭 시 contenteditable 포커스/Selection 보존
     mousedown에서 preventDefault → 포커스 빼앗김 차단 */
  if (!bar._mousedownBound) {
    bar.addEventListener('mousedown', function(e) {
      /* mousedown 시점의 Selection Range를 항상 저장 */
      var sel = window.getSelection();
      savedTfbRange = (sel && sel.rangeCount > 0) ? sel.getRangeAt(0).cloneRange() : null;
      /* color input / number input / select는 포커스 이동이 필요하므로 preventDefault 하지 않음 */
      if (e.target.type === 'color' || e.target.type === 'number' ||
          e.target.tagName === 'SELECT') return;
      e.preventDefault();
    });
    bar._mousedownBound = true;
  }
  /* 폰트 — 커스텀 드롭다운 동기화 */
  var fontVal = blk.fontFamily || 'Pretendard';
  var fnm = document.getElementById('tfb-font-name');
  if (fnm) { fnm.textContent = fontVal; fnm.style.fontFamily = "'" + fontVal + "'"; }
  document.querySelectorAll('.tfb-font-item').forEach(function(b) {
    b.classList.toggle('on', b.dataset.font === fontVal);
  });
  /* 크기 — 스크럽 위젯 동기화 */
  var defSz = blk.type === 'title' ? 15 : 12;
  var curSz = blk.fontSize || defSz;
  var sv = document.getElementById('tfb-scrub-val');
  if (sv) sv.textContent = curSz;
  _tfbUpdatePresetName(curSz);
  _tfbInitScrub();
  /* 정렬 active */
  ['left','center','right'].forEach(function(a) {
    var btn = document.getElementById('tfb-align-' + a);
    if (btn) btn.classList.toggle('active', (blk.textAlign || 'left') === a);
  });
  /* B/I/U — 블록 기본값 표시 (인라인 서식은 선택 범위 기반이므로 항상 off) */
  ['bold','italic','underline'].forEach(function(k) {
    var btn = document.getElementById('tfb-' + k);
    if (btn) btn.classList.remove('active');
  });
  /* 목록 타일 active (문단▾ 팝오버) */
  var lm = blk.listMode || 'none';
  ['none','bullet-circle','bullet-check','bullet-tri','bullet-arrow','bullet-diamond','numbered'].forEach(function(m) {
    var tbtn = document.getElementById('tfb-lm-' + m);
    if (tbtn) tbtn.classList.toggle('on', m === lm);
  });
  /* 색상 언더라인 */
  var colUl = document.getElementById('tfb-color-underline');
  if (colUl) colUl.style.background = blk.fontColor || '#212121';
  bar.classList.add('show');
}

function hideTxtFormatBar() {
  var bar = document.getElementById('txt-format-bar');
  if (bar) bar.classList.remove('show');
}

/* ── tfb 적용 함수 ── */
/* ── innerHTML → spans[] 파싱 공용 함수 ────────────────────────────
   texEl(contenteditable)의 현재 DOM을 읽어 spans[] 배열로 반환.
   commitTextEdit와 applyFormatToRange 양쪽에서 재사용.
──────────────────────────────────────────────────────────────────── */
function _parseSpansFromEl(texEl) {
  var spans = [];
  (function walk(node, fmt) {
    if (node.nodeType === 3) {
      if (node.textContent) {
        var sp = { text: node.textContent };
        if (fmt.b)  sp.bold      = true;
        if (fmt.i)  sp.italic    = true;
        if (fmt.u)  sp.underline = true;
        if (fmt.c)  sp.color     = fmt.c;
        if (fmt.g)  sp.bg        = fmt.g;
        if (fmt.fs) sp.fontSize  = fmt.fs;
        spans.push(sp);
      }
      return;
    }
    if (node.nodeType !== 1) return;
    var tag = node.tagName.toUpperCase();
    var f2  = { b: fmt.b, i: fmt.i, u: fmt.u, c: fmt.c, g: fmt.g, fs: fmt.fs };
    if (tag === 'B' || tag === 'STRONG') f2.b = true;
    if (tag === 'I' || tag === 'EM')     f2.i = true;
    if (tag === 'U')                     f2.u = true;
    var st = node.style;
    if (st) {
      if (st.fontWeight === 'bold' || parseInt(st.fontWeight) >= 700) f2.b = true;
      if (st.fontStyle === 'italic')                                   f2.i = true;
      if (st.textDecoration && st.textDecoration.indexOf('underline') !== -1) f2.u = true;
      if (st.color && st.color !== 'inherit') {
        var cm = st.color.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/);
        f2.c = cm ? '#' + [cm[1],cm[2],cm[3]].map(function(n){ return ('0'+parseInt(n).toString(16)).slice(-2); }).join('') : st.color;
      }
      if (st.backgroundColor && st.backgroundColor !== 'inherit' && st.backgroundColor !== 'transparent') {
        var bm = st.backgroundColor.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/);
        f2.g = bm ? '#' + [bm[1],bm[2],bm[3]].map(function(n){ return ('0'+parseInt(n).toString(16)).slice(-2); }).join('') : st.backgroundColor;
      }
      if (st.fontSize) {
        var fsVal = parseInt(st.fontSize);
        if (fsVal) f2.fs = fsVal;
      }
    }
    if (tag === 'BR') { spans.push({ text: '\n' }); return; }
    if ((tag === 'DIV' || tag === 'P') && spans.length) {
      var _last = spans[spans.length - 1];
      if (!_last || _last.text[_last.text.length - 1] !== '\n') spans.push({ text: '\n' });
    }
    for (var ci = 0; ci < node.childNodes.length; ci++) walk(node.childNodes[ci], f2);
  })(texEl, { b:false, i:false, u:false, c:null, g:null, fs:null });

  /* 빈 span 제거 + 인접 동일 서식 병합 */
  spans = spans.filter(function(s){ return s.text !== ''; });
  var merged = [];
  spans.forEach(function(s) {
    var p = merged[merged.length - 1];
    if (p && p.bold===s.bold && p.italic===s.italic && p.underline===s.underline &&
        p.color===s.color && p.bg===s.bg && p.fontSize===s.fontSize) {
      p.text += s.text;
    } else {
      var ns = { text: s.text };
      if (s.bold)      ns.bold      = true;
      if (s.italic)    ns.italic    = true;
      if (s.underline) ns.underline = true;
      if (s.color)     ns.color     = s.color;
      if (s.bg)        ns.bg        = s.bg;
      if (s.fontSize)  ns.fontSize  = s.fontSize;
      merged.push(ns);
    }
  });
  return merged.length ? merged : [{ text: '' }];
}

/* ── 선택 범위 → spans[] 문자 offset 계산 ──────────────────────────
   texEl(contenteditable) 안의 텍스트 노드를 순서대로 순회하며
   savedTfbRange의 start/end가 전체 평문 기준 몇 번째 글자인지 반환.
   반환값: { start: Number, end: Number } 또는 null(실패 시)
──────────────────────────────────────────────────────────────────── */
function _getRangeOffsets(texEl, range) {
  var start = null, end = null, pos = 0;
  /* 요소 노드(nodeType===1)가 container일 때 childOffset 기준 절대 pos 계산.
     walk 루프 중 현재 pos를 넘겨받아 해당 요소의 시작 pos + 자식 k개까지 누산. */
  function _elOffsetAt(elNode, childOffset, elStartPos) {
    var acc = elStartPos;
    for (var k = 0; k < childOffset && k < elNode.childNodes.length; k++) {
      var ch = elNode.childNodes[k];
      if (ch.nodeType === 3) acc += ch.textContent.length;
      else if (ch.nodeType === 1 && ch.tagName === 'BR') acc += 1;
      else acc += ch.textContent.length; /* 중첩 span 등 — textContent 합산 */
    }
    return acc;
  }

  /* walk는 texEl을 루트로 DFS하며 pos를 실시간 누산.
     각 노드 방문 시점의 pos가 곧 그 노드의 시작 절대 offset. */
  (function walk(node) {
    if (start !== null && end !== null) return;
    if (node.nodeType === 3) { /* 텍스트 노드 */
      var len = node.textContent.length;
      if (start === null && node === range.startContainer) {
        start = pos + range.startOffset;
      }
      if (end === null && node === range.endContainer) {
        end = pos + range.endOffset;
      }
      pos += len;
    } else if (node.nodeType === 1 && node.tagName === 'BR') {
      /* \n → <br> 변환된 줄바꿈 — 1글자로 카운트 */
      if (start === null && node === range.startContainer) start = pos;
      if (end   === null && node === range.endContainer)   end   = pos + 1;
      pos += 1;
    } else {
      /* 요소 노드 — 이 노드가 container인 경우 현재 pos 기준으로 계산 */
      var nodeStartPos = pos;
      if (start === null && node === range.startContainer) {
        start = _elOffsetAt(node, range.startOffset, nodeStartPos);
      }
      if (end === null && node === range.endContainer) {
        end = _elOffsetAt(node, range.endOffset, nodeStartPos);
      }
      for (var i = 0; i < node.childNodes.length; i++) walk(node.childNodes[i]);
    }
  })(texEl);
  if (start === null || end === null) return null;
  if (start > end) { var tmp = start; start = end; end = tmp; }
  return { start: start, end: end };
}

/* ── spans[] 직접 수정으로 선택 범위에 서식 적용 ───────────────────
   prop: 'fontSize' | 'bold' | 'italic' | 'underline' | 'color' | 'bg'
   val : 적용할 값 (bold/italic/underline은 true/false toggle)
──────────────────────────────────────────────────────────────────── */
function applyFormatToRange(prop, val) {
  if (!editingKey) return;
  var blk = getBlkByKey(editingKey);
  var blkEl = document.querySelector('.blk[data-key="' + editingKey + '"]');
  var texEl = blkEl ? blkEl.querySelector('.blk-text-area') : null;
  if (!blk || !texEl || !savedTfbRange || savedTfbRange.collapsed) {
    return;
  }

  /* 항상 현재 DOM에서 spans 재동기화 — 편집 중 타이핑으로 blk.spans가 stale해지는 경우 처리 */
  blk.spans = _parseSpansFromEl(texEl);
  blk.text  = blk.spans.map(function(s){ return s.text; }).join('');

  /* 선택 범위를 spans[] 문자 offset으로 변환 */
  var offsets = _getRangeOffsets(texEl, savedTfbRange);
  if (!offsets) { return; }
  var selStart = offsets.start, selEnd = offsets.end;
  if (selStart === selEnd) { return; }

  /* spans[]를 선택 범위 기준으로 분할 후 서식 적용 */
  var newSpans = [];
  var cur = 0;
  (blk.spans || [{ text: blk.text || '' }]).forEach(function(sp) {
    var len = sp.text.length;
    var spStart = cur, spEnd = cur + len;
    cur += len;

    /* 이 span이 선택 범위와 겹치지 않으면 그대로 */
    if (spEnd <= selStart || spStart >= selEnd) {
      newSpans.push(sp);
      return;
    }

    /* 선택 범위 앞부분 (서식 없는 원본) */
    if (spStart < selStart) {
      newSpans.push(_cloneSpan(sp, sp.text.slice(0, selStart - spStart)));
    }

    /* 선택 범위 안 (서식 적용) */
    var midText = sp.text.slice(
      Math.max(0, selStart - spStart),
      Math.min(len, selEnd - spStart)
    );
    var midSpan = _cloneSpan(sp, midText);
    if (prop === 'fontSize') {
      midSpan.fontSize = val;
    } else if (prop === 'bold' || prop === 'italic' || prop === 'underline') {
      midSpan[prop] = val;
    } else if (prop === 'color') {
      if (val === null) { delete midSpan.color; } else { midSpan.color = val; }
    } else if (prop === 'bg') {
      if (val === null) { delete midSpan.bg; } else { midSpan.bg = val; }
    }
    newSpans.push(midSpan);

    /* 선택 범위 뒷부분 (서식 없는 원본) */
    if (spEnd > selEnd) {
      newSpans.push(_cloneSpan(sp, sp.text.slice(selEnd - spStart)));
    }
  });

  /* 인접한 동일 서식 병합 */
  var merged = [];
  newSpans.forEach(function(s) {
    var p = merged[merged.length - 1];
    if (p && p.bold === s.bold && p.italic === s.italic &&
        p.underline === s.underline && p.color === s.color &&
        p.bg === s.bg && p.fontSize === s.fontSize) {
      p.text += s.text;
    } else {
      merged.push(s);
    }
  });
  blk.spans = merged.length ? merged : [{ text: '' }];
  blk.text  = blk.spans.map(function(s){ return s.text; }).join('');

  /* spans[] → innerHTML 재구성 */
  var hasFmt = blk.spans.some(function(s){
    return s.bold || s.italic || s.underline || s.color || s.bg || s.fontSize;
  });
  if (hasFmt) {
    texEl.innerHTML = blk.spans.map(function(s) {
      var t = s.text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br>');
      if (!s.bold && !s.italic && !s.underline && !s.color && !s.bg && !s.fontSize) return t;
      var style = '';
      if (s.bold)      style += 'font-weight:700;';
      if (s.italic)    style += 'font-style:italic;';
      if (s.underline) style += 'text-decoration:underline;';
      if (s.color)     style += 'color:' + s.color + ';';
      if (s.bg)        style += 'background:' + s.bg + ';';
      if (s.fontSize)  style += 'font-size:' + s.fontSize + 'px;';
      return '<span style="' + style + '">' + t + '</span>';
    }).join('');
  } else {
    texEl.textContent = blk.text;
  }

  /* innerHTML 재구성 후 selStart~selEnd 기준으로 새 DOM에 Selection 재설정
     (기존 Range는 이미 무효화된 노드를 가리키므로 반드시 새로 탐색해야 함) */
  try {
    var newSel = window.getSelection();
    var startNode = null, startOff = 0, endNode = null, endOff = 0;
    var charPos2 = 0;
    (function findNodes(node) {
      if (startNode && endNode) return;
      if (node.nodeType === 3) {
        var len = node.textContent.length;
        if (!startNode && charPos2 + len >= selStart) {
          startNode = node;
          startOff  = selStart - charPos2;
        }
        if (!endNode && charPos2 + len >= selEnd) {
          endNode = node;
          endOff  = selEnd - charPos2;
        }
        charPos2 += len;
      } else if (node.nodeType === 1 && node.tagName === 'BR') {
        /* \n → <br> 변환된 줄바꿈 — 1글자로 카운트 */
        charPos2 += 1;
      } else {
        for (var ci2 = 0; ci2 < node.childNodes.length; ci2++) findNodes(node.childNodes[ci2]);
      }
    })(texEl);

    if (startNode && endNode) {
      var restoredRange = document.createRange();
      restoredRange.setStart(startNode, startOff);
      restoredRange.setEnd(endNode, endOff);
      newSel.removeAllRanges();
      newSel.addRange(restoredRange);
      /* 새 DOM 기준 Range를 stickyRange에 갱신 — 연속 클릭 시 정확한 범위 유지 */
      _tfbStickyRange = restoredRange.cloneRange();
      savedTfbRange   = restoredRange.cloneRange();
    }
  } catch(e) { /* selection 복원 실패 시 무시 */ }

  /* 높이 보정 */
  var _editKey = editingKey;
  var _blk = blk;
  requestAnimationFrame(function() {
    var el2 = document.querySelector('.blk[data-key="' + _editKey + '"]');
    if (el2 && _blk) {
      var minH = getTextMinH(el2);
      if (minH > _blk.h) { _blk.h = minH; el2.style.height = minH + 'px'; }
    }
  });
}

/* span 객체 복제 (text만 교체) */
function _cloneSpan(sp, text) {
  var ns = { text: text };
  if (sp.bold)      ns.bold      = true;
  if (sp.italic)    ns.italic    = true;
  if (sp.underline) ns.underline = true;
  if (sp.color)     ns.color     = sp.color;
  if (sp.bg)        ns.bg        = sp.bg;
  if (sp.fontSize)  ns.fontSize  = sp.fontSize;
  return ns;
}

/* 스크럽 위젯 하단의 "텍스트 종류" 라벨 동기화 */
function _tfbUpdatePresetName(sz) {
  sz = parseInt(sz) || 13;
  var presets = { 18: '제목', 13: '본문', 10: '캡션' };
  var nm = document.getElementById('tfb-preset-name');
  if (nm) nm.textContent = presets[sz] || '맞춤';
  document.querySelectorAll('.tfb-preset-item').forEach(function(b) {
    b.classList.toggle('on', parseInt(b.dataset.sz) === sz);
  });
}

/* 스크럽 드래그 이벤트 (최초 1회 바인딩) */
function _tfbInitScrub() {
  var scrub = document.getElementById('tfb-scrub-btn');
  if (!scrub || scrub._scrubBound) return;
  scrub._scrubBound = true;
  scrub.addEventListener('pointerdown', function(e) {
    tfbSaveStickyRange();
    _tfbScrubStartX = e.clientX;
    var sv = document.getElementById('tfb-scrub-val');
    _tfbScrubStartSize = parseInt((sv && sv.textContent) || '13') || 13;
    try { scrub.setPointerCapture(e.pointerId); } catch(_) {}
  });
  scrub.addEventListener('pointermove', function(e) {
    if (!scrub.hasPointerCapture(e.pointerId)) return;
    var delta = Math.round((e.clientX - _tfbScrubStartX) / 4);
    var next = Math.min(72, Math.max(8, _tfbScrubStartSize + delta));
    var sv = document.getElementById('tfb-scrub-val');
    if (sv) sv.textContent = next;
    _tfbUpdatePresetName(next);
    tfbApply('fontSize', next);
  });
}

/* 글꼴 선택 (커스텀 드롭다운에서 호출) */
function tfbSelectFont(font) {
  _tfbClosePops();
  var fnm = document.getElementById('tfb-font-name');
  if (fnm) { fnm.textContent = font; fnm.style.fontFamily = "'" + font + "'"; }
  document.querySelectorAll('.tfb-font-item').forEach(function(b) {
    b.classList.toggle('on', b.dataset.font === font);
  });
  tfbApply('fontFamily', font);
}

function tfbApply(prop, val) {
  if (!selKey) return;
  if (prop === 'fontSize') val = Math.min(72, Math.max(8, parseInt(val) || 12));

  /* 편집 중 + 사용자가 더블클릭으로 명시적 진입한 경우만 → spans[] 부분 적용 경로 */
  if (isEditing && editingKey && _userEnteredEdit) {
    var formatProps = ['fontSize', 'bold', 'italic', 'underline', 'color', 'bg', 'fontColor'];
    if (formatProps.indexOf(prop) !== -1) {
      /* stickyRange(포커스 진입 시 저장) 우선, 없으면 savedTfbRange(mousedown 시 저장) 사용 */
      var activeRange = _tfbStickyRange || savedTfbRange;
      if (activeRange && !activeRange.collapsed) {
        /* 선택 범위 있음 → 부분 적용 */
        savedTfbRange = activeRange;
        var _prop = prop === 'fontColor' ? 'color' : prop;
        applyFormatToRange(_prop, val);
        /* applyFormatToRange 내부에서 savedTfbRange + _tfbStickyRange 갱신됨 — 복구하지 않음 */
        if (prop === 'fontSize') {
          var _sv = document.getElementById('tfb-scrub-val');
          if (_sv) _sv.textContent = val;
          _tfbUpdatePresetName(val);
        }
        return;
      }
      /* 선택 범위 없음(collapsed) → 블록 전체 변경 fallback */
    }
  }

  /* 그 외 — 블록 전체 속성 변경 */
  syncTextStyle(prop, val);
  /* 툴바 UI 갱신 */
  var blk = getSelBlk();
  if (blk) showTxtFormatBar(blk);
}

function tfbApplyPreset(val) {
  if (!val) return;
  var sz = parseInt(val);
  var sv = document.getElementById('tfb-scrub-val');
  if (sv) sv.textContent = sz;
  _tfbUpdatePresetName(sz);
  tfbApply('fontSize', sz);
  _tfbClosePops(); /* 팝오버 닫기 */
}

/* fontSize input에 포커스가 들어오는 순간 현재 Selection을 고정 저장
   (input에 포커스 이동 후에는 contenteditable Selection이 소멸하므로 미리 스냅샷) */
function tfbSaveStickyRange() {
  var sel = window.getSelection();
  _tfbStickyRange = (sel && sel.rangeCount > 0) ? sel.getRangeAt(0).cloneRange() : null;
}

function tfbStepSize(delta) {
  tfbSaveStickyRange();
  var sv = document.getElementById('tfb-scrub-val');
  var cur = parseInt((sv && sv.textContent) || '13') || 13;
  var next = Math.min(72, Math.max(8, cur + delta));
  if (sv) sv.textContent = next;
  _tfbUpdatePresetName(next);
  tfbApply('fontSize', next);
}

function tfbToggle(type) {
  var cmdMap = { bold: 'bold', italic: 'italic', underline: 'underline' };
  if (!cmdMap[type]) return;

  /* ── 클릭(선택) 상태: 블록 전체 spans에 토글 적용 ── */
  if (!isEditing || !_userEnteredEdit) {
    var blk = getSelBlk();
    if (!blk) return;
    var spans = blk.spans || [{ text: blk.text || '' }];
    var allOn = spans.every(function(s) { return !!s[type]; });
    var newVal = !allOn;
    blk.spans = spans.map(function(s) {
      var ns = Object.assign({}, s);
      delete ns.fontSize; /* fontSize는 blk.fontSize로만 관리 */
      if (newVal) { ns[type] = true; }
      else { delete ns[type]; }
      return ns;
    });
    render();
    var btn = document.getElementById('tfb-' + type);
    if (btn) btn.classList.toggle('active', newVal);
    return;
  }

  /* ── 편집(더블클릭) 상태: 선택 범위에 execCommand 적용 ── */
  var texEl = null;
  if (editingKey) {
    var blkEl = document.querySelector('.blk[data-key="' + editingKey + '"]');
    texEl = blkEl ? blkEl.querySelector('.blk-text-area') : null;
  }
  if (texEl) texEl.focus();
  if (savedTfbRange) {
    var sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(savedTfbRange);
  }
  document.execCommand(cmdMap[type], false, null);
  var btn2 = document.getElementById('tfb-' + type);
  if (btn2) btn2.classList.toggle('active', document.queryCommandState(cmdMap[type]));
}

/* 효과▾ · 문단▾ 팝오버 토글 */
function _tfbClosePops() {
  ['tfb-fx-pop','tfb-para-pop','tfb-font-pop','tfb-preset-pop'].forEach(function(id) {
    var el = document.getElementById(id); if (el) el.classList.remove('open');
  });
  ['tfb-fx-btn','tfb-para-btn','tfb-font-btn','tfb-preset-btn'].forEach(function(id) {
    var el = document.getElementById(id); if (el) el.classList.remove('active');
  });
}

function tfbOpenPop(id) {
  var popIds = ['tfb-fx-pop','tfb-para-pop','tfb-font-pop','tfb-preset-pop'];
  var btnIds = { 'tfb-fx-pop':'tfb-fx-btn', 'tfb-para-pop':'tfb-para-btn', 'tfb-font-pop':'tfb-font-btn', 'tfb-preset-pop':'tfb-preset-btn' };
  var target = document.getElementById(id);
  var isOpen = target && target.classList.contains('open');
  /* 모두 닫기 + 버튼 inactive */
  popIds.forEach(function(pid) {
    var el = document.getElementById(pid); if (el) el.classList.remove('open');
    var btn = document.getElementById(btnIds[pid]); if (btn) btn.classList.remove('active');
  });
  if (isOpen || !target) return;
  /* 위치 계산: 버튼 기준 하단 */
  var btn = document.getElementById(btnIds[id]);
  if (btn) {
    var r = btn.getBoundingClientRect();
    target.style.top  = (r.bottom + 4) + 'px';
    target.style.left = r.left + 'px';
    btn.classList.add('active');
  }
  target.classList.add('open');
  /* 팝오버 외부 클릭 시 닫기 */
  setTimeout(function() {
    function _closeHandler(e) {
      if (!e.target.closest('.tfb-pop-wrap') && !e.target.closest('.tfb-popover')) {
        popIds.forEach(function(pid) {
          var el = document.getElementById(pid); if (el) el.classList.remove('open');
          var b = document.getElementById(btnIds[pid]); if (b) b.classList.remove('active');
        });
        document.removeEventListener('click', _closeHandler);
      }
    }
    document.addEventListener('click', _closeHandler);
  }, 0);
}

function tfbOpenColor(kind) {
  /* Selection 저장 */
  var sel = window.getSelection();
  savedTfbRange = (sel && sel.rangeCount > 0) ? sel.getRangeAt(0).cloneRange() : null;
  _tfbStickyRange = savedTfbRange ? savedTfbRange.cloneRange() : null;

  var popup = document.getElementById('tfb-color-popup');
  if (!popup) return;

  /* 이미 같은 팝업이 열려 있으면 닫기 */
  if (popup.classList.contains('open') && _tfbColorKind === kind) {
    popup.classList.remove('open');
    return;
  }

  _tfbColorKind = kind;

  /* reset tile 업데이트 */
  var resetTile  = document.getElementById('tfb-popup-reset');
  var resetLabel = document.getElementById('tfb-popup-reset-label');
  if (kind === 'color') {
    var blk = getSelBlk();
    var fc = (blk && blk.fontColor) || globalVals.fontColor || '#212121';
    if (resetTile) {
      resetTile.style.background = fc;
      resetTile.style.borderColor = fc;
      resetTile.style.color = _tfbIsLight(fc) ? '#333' : '#fff';
    }
    if (resetLabel) resetLabel.textContent = '기본색';
  } else {
    if (resetTile) {
      resetTile.style.background = '';
      resetTile.style.borderColor = '#D0D0D0';
      resetTile.style.color = '#555';
    }
    if (resetLabel) resetLabel.textContent = '없음';
  }

  /* position: fixed 좌표 계산 — overflow:hidden 영향 우회 */
  var group = document.getElementById('tfb-color-group');
  if (group) {
    var rect = group.getBoundingClientRect();
    popup.style.top  = (rect.bottom + 4) + 'px';
    popup.style.left = rect.left + 'px';
  }

  popup.classList.add('open');

  /* 팝업 외부 클릭 시 닫기 — 이전 핸들러 제거 후 재등록 (중복 방지) */
  if (_tfbClosePopupHandler) {
    document.removeEventListener('click', _tfbClosePopupHandler);
    _tfbClosePopupHandler = null;
  }
  setTimeout(function() {
    _tfbClosePopupHandler = function(e) {
      var pp = document.getElementById('tfb-color-popup');
      var pg = document.getElementById('tfb-color-group');
      var inside = (pp && pp.contains(e.target)) || (pg && pg.contains(e.target));
      if (!inside) { if (pp) pp.classList.remove('open'); }
      document.removeEventListener('click', _tfbClosePopupHandler);
      _tfbClosePopupHandler = null;
    };
    document.addEventListener('click', _tfbClosePopupHandler);
  }, 0);
}

/* 색상 팝업 — 직접 선택(color picker 열기) */
function tfbPickColor() {
  var popup = document.getElementById('tfb-color-popup');
  if (popup) popup.classList.remove('open');
  var inputId = _tfbColorKind === 'color' ? 'tfb-color-input' : 'tfb-bg-input';
  var inp = document.getElementById(inputId);
  if (inp) inp.click();
}

/* 색상 팝업 — 초기화 타일 클릭 */
function tfbResetColor() {
  var popup = document.getElementById('tfb-color-popup');
  if (popup) popup.classList.remove('open');
  tfbApplyColor(_tfbColorKind, null);
}

/* 밝은 색 판별 헬퍼 */
function _tfbIsLight(hex) {
  var c = (hex || '#ffffff').replace('#', '');
  if (c.length === 3) c = c[0]+c[0]+c[1]+c[1]+c[2]+c[2];
  var r = parseInt(c.substr(0,2),16), g = parseInt(c.substr(2,2),16), b = parseInt(c.substr(4,2),16);
  return (r*299 + g*587 + b*114) / 1000 > 128;
}

function tfbApplyColor(kind, val) {
  /* 편집 중인 contenteditable에 포커스 복원 */
  var texEl = null;
  if (editingKey) {
    var blkEl = document.querySelector('.blk[data-key="' + editingKey + '"]');
    texEl = blkEl ? blkEl.querySelector('.blk-text-area') : null;
  }
  /* ── 클릭(선택) 상태: 블록 전체 spans에 색상 적용 ── */
  if (!isEditing || !_userEnteredEdit || !texEl) {
    var blkC = getSelBlk();
    if (blkC) {
      var spansC = blkC.spans || [{ text: blkC.text || '' }];
      var prop0 = kind === 'color' ? 'color' : 'bg';
      blkC.spans = spansC.map(function(s) {
        var ns = Object.assign({}, s);
        delete ns.fontSize; /* fontSize는 blk.fontSize로만 관리 */
        if (val === null) { delete ns[prop0]; } else { ns[prop0] = val; }
        return ns;
      });
      /* fontColor도 동기화 (글자색인 경우, 리셋 시에는 유지) */
      if (kind === 'color' && val !== null) blkC.fontColor = val;
      render();
    }
    /* 툴바 언더라인 색상 갱신 */
    if (kind === 'color') {
      var ulC = document.getElementById('tfb-color-underline');
      if (ulC) ulC.style.background = val === null ? (globalVals.fontColor || '#212121') : val;
    } else {
      var bgUlC = document.getElementById('tfb-bg-swatch');
      if (bgUlC) bgUlC.style.background = val === null ? '#E0E0E0' : val;
      var bgHxC = document.getElementById('tfb-bg-hexedit');
      if (bgHxC) bgHxC.value = val === null ? '' : val;
    }
    return;
  }

  /* ── 편집(더블클릭) 상태: 선택 범위에 부분 적용 ── */
  var activeRange = _tfbStickyRange || savedTfbRange;
  if (activeRange && !activeRange.collapsed) {
    var _savedBackup = savedTfbRange;
    savedTfbRange = activeRange;
    var prop = kind === 'color' ? 'color' : 'bg';
    applyFormatToRange(prop, val);
    savedTfbRange = _savedBackup;
    if (kind === 'color' && val !== null) {
      var blkCR = getSelBlk();
      if (blkCR) blkCR.fontColor = val;
    }
  } else {
    /* 선택 범위 없음(커서만 있음) — 기존 텍스트는 그대로 두고, 이후 입력될 글자에만
       적용되도록 execCommand 사용(bold/italic/underline의 tfbToggle과 동일 패턴).
       구글독스처럼 "커서 위치 기준으로 색 이어받기"가 브라우저 기본 동작으로 살아남음
       (0620.txt A-2: 이전엔 블록 전체를 재색칠해서 기존 텍스트 색까지 덮어쓰던 버그) */
    if (texEl) texEl.focus();
    if (activeRange) {
      var selCF = window.getSelection();
      selCF.removeAllRanges();
      selCF.addRange(activeRange);
    }
    document.execCommand('styleWithCSS', false, true);
    if (kind === 'color') {
      document.execCommand('foreColor', false, val || (globalVals.fontColor || '#212121'));
      var blkCF = getSelBlk();
      if (blkCF && val !== null) blkCF.fontColor = val;
    } else {
      document.execCommand('hiliteColor', false, val || 'transparent');
    }
  }

  /* 툴바 언더라인 색상 갱신 */
  if (kind === 'color') {
    var ul = document.getElementById('tfb-color-underline');
    if (ul) ul.style.background = val === null ? (globalVals.fontColor || '#212121') : val;
  } else {
    var bgUl = document.getElementById('tfb-bg-swatch');
    if (bgUl) bgUl.style.background = val === null ? '#E0E0E0' : val;
    var bgHx = document.getElementById('tfb-bg-hexedit');
    if (bgHx) bgHx.value = val === null ? '' : val;
  }
}

/* 목록 형식 순환 (없음 → • → ✔ → ‣ → ➤ → ❖ → 1. → 없음) */
function tfbCycleList() {
  if (!selKey) return;
  var blk = getSelBlk();
  if (!blk) return;
  var modes = ['none','bullet-circle','bullet-check','bullet-tri','bullet-arrow','bullet-diamond','numbered'];
  var cur = blk.listMode || 'none';
  var next = modes[(modes.indexOf(cur) + 1) % modes.length];
  tfbApply('listMode', next);
}

/* 블록 서식 초기화 */
function tfbReset() {
  if (!selKey) return;
  var blk = getSelBlk();
  if (!blk) return;
  blk.fontSize   = blk.type === 'title' ? 15 : 12;
  blk.textAlign  = 'left';
  blk.fontFamily = globalVals.font || 'Pretendard';
  blk.fontColor  = globalVals.fontColor || '#212121';
  blk.listMode   = 'none';
  /* contenteditable의 execCommand 서식도 초기화 */
  var blkEl = document.querySelector('.blk[data-key="' + selKey + '"]');
  var texEl = blkEl ? blkEl.querySelector('.blk-text-area') : null;
  if (texEl) applyTextStyleToEl(texEl, blk);
  showTxtFormatBar(blk);
  render();
}


/* 텍스트 편집 종료 + 데이터 저장 */
function commitTextEdit() {
  if (!isEditing) return;
  if (editingKey === 'header') { commitHeaderEdit(); return; }
  saveHistory();
  var blk   = getBlkByKey(editingKey);
  var blkEl = editingKey ? document.querySelector('.blk[data-key="' + editingKey + '"]') : null;
  var texEl = blkEl ? blkEl.querySelector('.blk-text-area') : null;
  if (texEl && blk) {
    var lm = blk.listMode || 'none';

    /* ── innerHTML → spans[] 파싱 (공용 함수 재사용) ── */
    blk.spans = _parseSpansFromEl(texEl);

    /* listMode 기호 제거 후 blk.text 갱신 (하위 호환) */
    var plainText = blk.spans.map(function(s){ return s.text; }).join('');
    blk.text = stripListPrefix(plainText, lm);
    if (lm !== 'none') blk.spans = [{ text: blk.text }]; /* listMode 시 서식 단순화 */

    /* ── 편집 종료 ── */
    texEl.setAttribute('contenteditable', 'false');

    /* ── 보기 모드 복원: spans → HTML ── */
    var hasFormat = blk.spans.some(function(s){ return s.bold||s.italic||s.underline||s.color||s.bg||s.fontSize; });
    if (lm !== 'none') {
      /* 목록형: textContent로 기호 포함 표시 */
      var lines = blk.text.split('\n');
      texEl.textContent = lines.map(function(line, idx){ return getListPrefix(lm, idx) + line; }).join('\n');
    } else if (!hasFormat) {
      texEl.textContent = blk.text;
    } else {
      /* 서식 있음: span 태그 HTML */
      texEl.innerHTML = blk.spans.map(function(s) {
        var t = s.text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br>');
        if (!s.bold && !s.italic && !s.underline && !s.color && !s.bg && !s.fontSize) return t;
        var style = '';
        if (s.bold)      style += 'font-weight:700;';
        if (s.italic)    style += 'font-style:italic;';
        if (s.underline) style += 'text-decoration:underline;';
        if (s.color)     style += 'color:' + s.color + ';';
        if (s.bg)        style += 'background:' + s.bg + ';';
        if (s.fontSize)  style += 'font-size:' + s.fontSize + 'px;';
        return '<span style="' + style + '">' + t + '</span>';
      }).join('');
    }
  }
  isEditing  = false;
  _userEnteredEdit = false; /* 편집 종료 시 명시적 진입 플래그도 초기화 */
  editingKey = null;
  _tfbStickyRange = null;
  if (blkEl) blkEl.classList.remove('editing');
}

/* 줄 단위로 목록 기호 제거 → 순수 텍스트 반환 */
function stripListPrefix(text, listMode) {
  if (!listMode || listMode === 'none') return text;
  var prefixMap = {
    'bullet-circle':  '• ',
    'bullet-check':   '✔ ',
    'bullet-tri':     '‣ ',
    'bullet-arrow':   '➤ ',
    'bullet-diamond': '❖ '
  };
  var prefix = prefixMap[listMode];
  if (!prefix && listMode !== 'numbered') return text;
  var lines = text.split('\n');
  return lines.map(function(line, idx) {
    if (listMode === 'numbered') {
      /* "1. " "2. " 등 제거 */
      return line.replace(/^\d+\.\s/, '');
    }
    return line.startsWith(prefix) ? line.slice(prefix.length) : line;
  }).join('\n');
}
