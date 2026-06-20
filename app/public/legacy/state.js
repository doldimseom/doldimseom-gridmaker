/* state.js — 리팩토링 2단계 1번째 조각: 전역 상태(var) 선언 모음 (app/public/legacy/main.js에서 추출, 로직 변경 없음) */
var _blkIdCounter = 0;
function _nextBlkId() { return 'b_' + (++_blkIdCounter); }
var _blkCopyClipboard = null;  /* Ctrl+C 블록 복사 클립보드 */
var _blkStyleClipboard = null; /* 블록 옵션 복사 클립보드 { radius, shadow, bgColor, stroke, opacity } */
var canvasW = 800; /* 캔버스 너비 (px). 높이는 blocks 기준 자동 계산. */
var blocks = [
  { id: _nextBlkId(), x: 12,  y: 12,  w: 260, h: 500, groupId: 'g_01', type: 'img', imgSrc: null, imgTransform: { scale:1, x:0, y:0 }, radius: null, shadow: null, opacity: null, bgColor: null },
  { id: _nextBlkId(), x: 284, y: 12,  w: 216, h: 247, groupId: 'g_01', type: 'img', imgSrc: null, imgTransform: { scale:1, x:0, y:0 }, radius: null, shadow: null, opacity: null, bgColor: null },
  { id: _nextBlkId(), x: 284, y: 271, w: 216, h: 241, groupId: 'g_01', type: 'img', imgSrc: null, imgTransform: { scale:1, x:0, y:0 }, radius: null, shadow: null, opacity: null, bgColor: null },
  { id: _nextBlkId(), x: 512, y: 12,  w: 276, h: 500, groupId: 'g_01', type: 'txt', spans: [{ text: '' }], radius: null, shadow: null, opacity: null, bgColor: null }
];
var headerPos  = null;
var headerData = {

  /* ── 타입 ───────────────────────────────────────────────────────
     'basic' | 'sns' | 'round'
     구버전 호환: applyData()에서 'text'→'basic', 'bg'→'basic' 자동 변환 */
  type: 'basic',

  /* ── 공통: 배너 높이 ─────────────────────────────────────────── */
  bannerH: 160,             /* basic 기준 높이 (sns는 snsH 사용) */

  /* ── 공통: 배경색 (전 타입 공유 — 타입 전환 시 유지) ─────────── */
  bannerBgColor: '#5B7CE6',

  /* ── 공통: 이미지 ────────────────────────────────────────────── */
  bannerImgOn: false,
  bannerImgSrc: null,
  bannerImgTransform: { scale: 1, x: 0, y: 0 },

  /* ── SNS 고유 ────────────────────────────────────────────────── */
  navH: 32,
  navBgColor: '#ffffff',
  navFontColor: '#212121',
  navText: '← BACK',
  snsH: 120,                    /* SNS 배너 높이 (구버전 bannerH 대응) */

  /* ── 라운드 고유 ─────────────────────────────────────────────── */
  roundH: 120,                  /* 배너 높이 */
  roundOverlap: 24              /* 시트 카드 겹침 수치 */
};
var selKey    = null;        /* 선택된 블록 key ("gi-ci-bi"), 헤더='header' */
var selKeys   = [];          /* 다중 선택 키 배열 (Ctrl+클릭으로 추가/제거) */
var sheetBg     = '#ffffff';  /* 시트 배경색 — collectData/applyData 저장 대상 */
var sheetRadius = 14;         /* 시트 라운딩 — collectData/applyData 저장 대상 */
var pngMargin = true;       /* PNG 여백 포함 여부 (기본 on) */
var pngBg     = '#f2f2f2';  /* PNG 여백 배경색 */
var bgLayer = {
  on:        true,          /* 배경지 항상 활성 — 마스터 토글 제거 */
  color:     '',            /* 배경색 (빈 문자열 = 없음) — 초기값 없음 */
  imgOn:     false,         /* 이미지 사용 여부 — 소스 tiles 선택 시 활성 */
  imgSrc:    null,          /* 업로드 이미지 base64 */
  imgMode:   'grid',        /* 'upload' | 'grid' */
  repeat:    'cover',       /* 'none' | 'cover' | 'tile' */
  tileAngle: 0,             /* 타일 각도: 0 | 15 | 30 | 45 */
  posX:      0,             /* X 위치 오프셋 px */
  posY:      0,             /* Y 위치 오프셋 px */
  zoom:      100,           /* 줌 % (50~200) */
  opacity:   100,           /* 이미지 투명도 (0~100) */
  gridSize:  20,            /* 모눈종이 격자 크기 px */
  gridAngle: 0,             /* 모눈종이 기울기: 0 | 15 | 30 | 45 */
  gridColor: '#D4D4D8'      /* 모눈종이 선 색상 */
};
var gaps = { pad: 12 }; /* col/blk/grp 제거 — 자유 배치 엔진에서 불필요 */
var canvasExtraBottom = 0; /* 하단 핸들로 추가한 하단 여백 (px) */
var globalVals = { radius: 16, shadow: 2, bgColor: '#ffffff', font: 'Pretendard', fontColor: '#212121', stroke: 0, tstroke: 0 };
var blkDrag     = null;
var blkResize   = null; /* { id, startX, startY, startW, startH } */
var cwDrag      = null; /* { prevX, side:'left'|'right' } */
var chDrag      = null; /* { prevY, side:'top'|'bottom' } */
var selectedGi        = null;  /* 현재 선택된 groupId 문자열 (null = 그룹 없음) */
var _grpIndividualMode = false; /* true = 그룹 내 개별 블록 선택 모드 (2번째 클릭 후) */
var snapEnabled = true;
var undoStack = [];
var redoStack = [];
var _maxUndoHistory = 30;
var _isApplyingHistory = false;
var _pendingHistorySave = false;
var _isRendering = false;
var SNAP_THRESH = 6;
var isEditing  = false;   /* 텍스트 인라인 편집 중 플래그 */
var _userEnteredEdit = false; /* 사용자가 더블클릭으로 명시적 편집 진입한 경우만 true */
var editingKey = null;    /* 편집 중인 블록 key */
var savedTfbRange  = null; /* B/I/U 적용을 위해 mousedown 시점에 저장한 Selection Range */
var _tfbStickyRange = null; /* fontSize input focus 진입 시점에 저장한 Selection Range */
var _tfbColorKind   = null; /* 현재 열린 색상 팝업의 종류 'color' | 'bg' */
var _tfbClosePopupHandler = null; /* tfbOpenColor 팝업 외부클릭 핸들러 참조 (중복 등록 방지) */
var activeImgKey    = null;  /* 이미지 편집 모드 중인 블록 key */
var activeHdrImgKind = null; /* 헤더 이미지 편집 모드 종류 'banner' | null */
var _zoomLevel = 1.0;
var _panX = 0;
var _panY = 0;
var _isPanning    = false;
var _panStartX    = 0;
var _panStartY    = 0;
var _panStartOffX = 0;
var _panStartOffY = 0;
var _spaceDown    = false;  /* Space 키 누름 여부 */
var popupTarget = null; /* { anchorEl } — 새 블록의 위치는 캔버스 하단 자동 배치 */
var _tfbScrubStartX = 0, _tfbScrubStartSize = 0;
var _ITEM_METRICS = {
  'pm-chip': { h: { rowH: 19,   rowGap: 8  }, v: { rowH: 41,   rowGap: 8  } },
  'pm-hair': { h: { rowH: 35.4, rowGap: 0  }, v: { rowH: 51.4, rowGap: 0  } },
  'pm-cap':  { h: { rowH: 17.5, rowGap: 12 }, v: { rowH: 31.5, rowGap: 12 } },
  'pm-grid': { h: { rowH: 35.5, rowGap: 7  }, v: { rowH: 51.5, rowGap: 7  } }
};
var _CC = { h: 30, padV: 8, gap: 6 };
var _ccDragId = null; /* 드래그 중인 칩 id */
var STORAGE_KEY = 'gridmaker_slots';
var _importedSlots = null;
var stickers = [];
var stickerIdCounter = 0;
var selectedStickerIds = [];
var stickerEditMode = false;
var stickerLibrary = [];
var stickerLibIdCounter = 0;
var textLibrary = [];
var textLibIdCounter = 0;
var _textStickerSize = 12;
var _ctxTargetId = null;
