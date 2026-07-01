/* guide.js — 사용 가이드 시스템 (투어·탭 힌트·? 드로어) */
/* ══════════════════════════════════════════
   GUIDE: 사용 가이드 시스템
   투어 가이드 / 탭 힌트 배너 / ? 드로어
   localStorage: gm_tour_seen, gm_visited_tabs
══════════════════════════════════════════ */

/* ── 투어 스텝 ── */
var GM_TOUR_STEPS = [
  {
    title: '블록 추가',
    desc: '우상단 + 블록 추가 버튼을 누르거나,\n캔버스 빈 곳을 우클릭하면\n텍스트·컬러칩·항목 블록을 추가할 수 있습니다.',
    target: '#btn-add-blk',
    placement: 'bottom-left'
  },
  {
    title: '블록 편집',
    desc: '블록을 클릭하면 선택, 더블 클릭하면\n텍스트 편집 모드가 됩니다.\nShift+클릭으로 여러 블록을 동시에 선택할 수 있습니다.',
    target: '.canvas-inner',
    placement: 'left'
  },
  {
    title: '스티커 & 배경지',
    desc: '스티커 탭에서 스티커를 추가하고,\n배경지 탭에서 시트 배경색·무늬를 설정할 수 있습니다.',
    target: '#nb-sticker',
    placement: 'bottom'
  },
  {
    title: '헤더 & 프리셋',
    desc: '헤더로 시트 상단에 제목 이미지를 달고,\n프리셋으로 레이아웃 템플릿을 불러올 수 있습니다.',
    target: '#nb-header',
    placement: 'bottom'
  },
  {
    title: '저장 & 슬롯',
    desc: '완성하면 우상단 PNG 저장 버튼으로\n이미지를 내보낼 수 있습니다.\n도구 탭에서 슬롯으로 작업을 저장·불러올 수도 있습니다.',
    target: '.float-save',
    placement: 'bottom-left'
  }
];

/* ── 탭 힌트 메시지 ── */
var GM_HINTS = {
  canvas:  { label: '시트',   text: '블록을 올려 캐릭터 정보를 구성합니다.' },
  sticker: { label: '스티커', text: '스티커를 자유롭게 올립니다.' },
  bg:      { label: '배경지', text: '시트 배경의 색과 무늬를 바꿉니다.' },
  header:  { label: '헤더',   text: '시트 위아래에 제목 이미지를 답니다.' },
  preset:  { label: '프리셋', text: '준비된 레이아웃을 불러옵니다.' },
  tools:   { label: '도구',   text: '저장·정렬 등 보조 도구를 모았습니다.' }
};

/* ── 단축키 그룹 ── */
var GM_SHORTCUTS = [
  { group: '편집 일반', items: [
    ['Ctrl+Z', '실행 취소'],
    ['Ctrl+Y / Ctrl+Shift+Z', '다시 실행'],
    ['Esc', '편집 종료 / 선택 해제'],
    ['Del / Backspace', '선택 블록 삭제']
  ]},
  { group: '블록 이동', items: [
    ['방향키', '선택 블록 1px 이동'],
    ['Shift + 방향키', '선택 블록 10px 이동']
  ]},
  { group: '다중 선택 & 그룹', items: [
    ['Shift + 클릭', '다중 선택 추가/제거'],
    ['Ctrl+G', '선택 블록 그룹화']
  ]},
  { group: '복사 & 붙여넣기', items: [
    ['Ctrl+C', '블록 복사'],
    ['Ctrl+V', '블록 붙여넣기']
  ]},
  { group: '텍스트 서식 (편집 중)', items: [
    ['Ctrl+B', '굵게'],
    ['Ctrl+I', '기울임꼴'],
    ['Ctrl+U', '밑줄']
  ]},
  { group: '캔버스', items: [
    ['Space + 드래그', '캔버스 이동(팬)'],
    ['Ctrl + 휠스크롤', '줌 인/아웃']
  ]},
  { group: '리사이즈 수식어 (드래그 중)', items: [
    ['Shift + 드래그', '가로세로 비율 유지'],
    ['Alt + 드래그', '한 축 잠금']
  ]}
];

/* ════════════════════════════════
   TOUR: 투어 가이드
════════════════════════════════ */
var _gmTourIdx    = 0;
var _gmTourActive = false;

function gmTourStart() {
  _gmTourIdx    = 0;
  _gmTourActive = true;
  _gmDrawerClose();
  _gmHintDismiss();
  document.getElementById('gm-tour-overlay').classList.add('active');
  document.getElementById('gm-tour-card').classList.remove('hidden');
  document.getElementById('gm-tour-done').classList.add('hidden');
  _gmTourRender(0);
}

function _gmTourGetRect(selector) {
  var parts = selector.split(',');
  for (var i = 0; i < parts.length; i++) {
    var el = document.querySelector(parts[i].trim());
    if (el && el.offsetParent !== null) {
      var r = el.getBoundingClientRect();
      return { top: r.top, left: r.left, width: r.width, height: r.height };
    }
  }
  return null;
}

function _gmTourCalcPos(rect, placement) {
  var PAD = 16, W = 264, H = 220;
  var vw = window.innerWidth, vh = window.innerHeight;
  var top, left;
  if (placement === 'bottom-left') {
    top  = rect.top + rect.height + PAD;
    left = rect.left + rect.width - W;
  } else if (placement === 'bottom') {
    top  = rect.top + rect.height + PAD;
    left = rect.left;
  } else if (placement === 'left') {
    top  = rect.top;
    left = rect.left - W - PAD;
    if (left < PAD) left = rect.left + rect.width + PAD;
  } else if (placement === 'right') {
    top  = rect.top;
    left = rect.left + rect.width + PAD;
    if (left + W > vw - PAD) left = rect.left - W - PAD;
  } else {
    top  = rect.top + rect.height + PAD;
    left = rect.left;
  }
  top  = Math.max(PAD, Math.min(top,  vh - H - PAD));
  left = Math.max(PAD, Math.min(left, vw - W - PAD));
  return { top: top, left: left };
}

function _gmTourRender(idx) {
  var step  = GM_TOUR_STEPS[idx];
  var total = GM_TOUR_STEPS.length;

  document.getElementById('gm-tour-step-num').textContent = idx + 1;
  document.getElementById('gm-tour-step-of').textContent  = '/ ' + total;
  document.getElementById('gm-tour-title').textContent    = step.title;
  document.getElementById('gm-tour-desc').textContent     = step.desc;

  var nextBtn = document.getElementById('gm-tour-btn-next');
  nextBtn.textContent = idx === total - 1 ? '완료' : '다음 →';
  document.getElementById('gm-tour-btn-prev').disabled = (idx === 0);

  var dotsEl = document.getElementById('gm-tour-dots');
  dotsEl.innerHTML = '';
  for (var i = 0; i < total; i++) {
    var d = document.createElement('div');
    d.className = 'gm-tour-dot' + (i === idx ? ' active' : '');
    dotsEl.appendChild(d);
  }

  var hl   = document.getElementById('gm-tour-highlight');
  var card = document.getElementById('gm-tour-card');
  var rect = _gmTourGetRect(step.target);

  if (rect) {
    var P = 6;
    hl.style.top    = (rect.top    - P) + 'px';
    hl.style.left   = (rect.left   - P) + 'px';
    hl.style.width  = (rect.width  + P * 2) + 'px';
    hl.style.height = (rect.height + P * 2) + 'px';
    hl.classList.remove('hidden');

    var pos = _gmTourCalcPos(rect, step.placement);
    card.style.top  = pos.top  + 'px';
    card.style.left = pos.left + 'px';

    requestAnimationFrame(function() {
      var cardH = card.offsetHeight || 220;
      var vw = window.innerWidth, vh = window.innerHeight;
      var t = Math.max(16, Math.min(parseFloat(card.style.top),  vh - cardH - 16));
      var l = Math.max(16, Math.min(parseFloat(card.style.left), vw - 264   - 16));
      card.style.top  = t + 'px';
      card.style.left = l + 'px';
    });
  } else {
    hl.classList.add('hidden');
    card.style.top  = (window.innerHeight / 2 - 110) + 'px';
    card.style.left = (window.innerWidth  / 2 - 118) + 'px';
  }
}

function _gmTourNext() {
  if (_gmTourIdx < GM_TOUR_STEPS.length - 1) {
    _gmTourIdx++;
    _gmTourRender(_gmTourIdx);
  } else {
    _gmTourShowDone();
  }
}

function _gmTourPrev() {
  if (_gmTourIdx > 0) {
    _gmTourIdx--;
    _gmTourRender(_gmTourIdx);
  }
}

function _gmTourShowDone() {
  document.getElementById('gm-tour-card').classList.add('hidden');
  document.getElementById('gm-tour-highlight').classList.add('hidden');
  document.getElementById('gm-tour-overlay').classList.add('dim');
  document.getElementById('gm-tour-done').classList.remove('hidden');
}

function _gmTourClose() {
  _gmTourActive = false;
  var ov = document.getElementById('gm-tour-overlay');
  ov.classList.remove('active', 'dim');
  document.getElementById('gm-tour-card').classList.add('hidden');
  document.getElementById('gm-tour-highlight').classList.add('hidden');
  document.getElementById('gm-tour-done').classList.add('hidden');
  try { localStorage.setItem('gm_tour_seen', '1'); } catch(e) {}
}

window.addEventListener('resize', function() {
  if (_gmTourActive && !document.getElementById('gm-tour-card').classList.contains('hidden')) {
    _gmTourRender(_gmTourIdx);
  }
});

/* ════════════════════════════════
   HINT: 탭 힌트 배너
════════════════════════════════ */
var _gmHintTimer = null;

function _gmHintIfNew(tab) {
  if (_gmTourActive) return;
  var hint = GM_HINTS[tab];
  if (!hint) return;

  var visited;
  try { visited = JSON.parse(localStorage.getItem('gm_visited_tabs') || '[]'); } catch(e) { visited = []; }
  if (visited.indexOf(tab) !== -1) return;

  visited.push(tab);
  try { localStorage.setItem('gm_visited_tabs', JSON.stringify(visited)); } catch(e) {}

  _gmDrawerClose();
  var lbl = document.getElementById('gm-hint-label');
  if (lbl) lbl.textContent = hint.label;
  document.getElementById('gm-hint-text').textContent  = hint.text;
  document.getElementById('gm-hint-banner').classList.add('show');

  if (_gmHintTimer) clearTimeout(_gmHintTimer);
  _gmHintTimer = setTimeout(_gmHintDismiss, 6000);
}

function _gmHintDismiss() {
  if (_gmHintTimer) { clearTimeout(_gmHintTimer); _gmHintTimer = null; }
  document.getElementById('gm-hint-banner').classList.remove('show');
}

/* ════════════════════════════════
   DRAWER: ? 드로어
════════════════════════════════ */
var _gmDrawerIsOpen = false;

function _gmToggleDrawer() {
  _gmDrawerIsOpen ? _gmDrawerClose() : _gmDrawerOpen();
}

function _gmDrawerOpen() {
  _gmDrawerIsOpen = true;
  _gmHintDismiss();
  document.getElementById('gm-drawer').classList.add('open');
}

function _gmDrawerClose() {
  _gmDrawerIsOpen = false;
  var el = document.getElementById('gm-drawer');
  if (el) el.classList.remove('open');
}

function _gmDrawerReplayTour() {
  _gmDrawerClose();
  setTimeout(gmTourStart, 120);
}

function _gmBuildShortcuts() {
  var container = document.getElementById('gm-sc-body');
  if (!container || container.childElementCount > 0) return;
  GM_SHORTCUTS.forEach(function(grp) {
    var g = document.createElement('div');
    g.className = 'gm-sc-group';

    var h = document.createElement('div');
    h.className = 'gm-sc-group-title';
    h.textContent = grp.group;
    g.appendChild(h);

    grp.items.forEach(function(row) {
      var r = document.createElement('div');
      r.className = 'gm-sc-row';
      var k = document.createElement('span');
      k.className = 'gm-sc-key';
      k.textContent = row[0];
      var desc = document.createElement('span');
      desc.className = 'gm-sc-desc';
      desc.textContent = row[1];
      r.appendChild(k);
      r.appendChild(desc);
      g.appendChild(r);
    });
    container.appendChild(g);
  });
}

/* ── 초기화 ── */
window.addEventListener('load', function() {
  /* switchNav 래핑 */
  if (typeof switchNav === 'function') {
    var _origSwitchNav = switchNav;
    switchNav = function(tab) {
      _origSwitchNav(tab);
      _gmHintIfNew(tab);
    };
  }

  /* 단축키 테이블 빌드 */
  _gmBuildShortcuts();

  /* 드로어 바깥 클릭 닫기 */
  document.addEventListener('mousedown', function(e) {
    if (!_gmDrawerIsOpen) return;
    var drawer = document.getElementById('gm-drawer');
    var btn    = document.getElementById('gm-help-btn');
    if (drawer && !drawer.contains(e.target) && btn && !btn.contains(e.target)) {
      _gmDrawerClose();
    }
  });

  /* 첫 방문 여부에 따라 투어 or 캔버스 힌트 */
  try {
    if (!localStorage.getItem('gm_tour_seen')) {
      setTimeout(gmTourStart, 400);
    } else {
      setTimeout(function() { _gmHintIfNew('canvas'); }, 600);
    }
  } catch(e) {
    setTimeout(function() { _gmHintIfNew('canvas'); }, 600);
  }
});
