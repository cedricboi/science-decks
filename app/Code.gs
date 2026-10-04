/**
 * LIVE BOARD
 * A Padlet-style response board for live lessons.
 * Runs from a Google Sheet in your own Drive. Students post from the
 * student link (embedded on your Google Site). You show the board on the
 * projector from the teacher link (the same link with ?view=teacher).
 *
 * Tabs: Settings, Students, Boards, Posts, Decks, Deck questions, Chapter checks, Progress, Deck slides. Photos and
 * sketches are saved as image files in a Drive folder that only you can open.
 *
 * Lesson decks (the HTML slide decks) send each answer a student submits to
 * this web app's /exec link. Each deck question becomes its own board.
 */

var TAB = { settings: 'Settings', students: 'Students', boards: 'Boards', posts: 'Posts',
  decks: 'Decks', deckq: 'Deck questions', checks: 'Chapter checks', progress: 'Progress' };

var BOARD_COLS = ['ID', 'Title', 'Prompt', 'Classes', 'Layout', 'Columns', 'State',
  'Hide until reveal', 'Revealed', 'Approve first', 'Students see board',
  'Allow images', 'Posts per student', 'Wallpaper', 'Created', 'Updated'];

var POST_COLS = ['ID', 'Board ID', 'Time', 'Class', 'Reg No', 'Name', 'Column',
  'Text', 'Image File ID', 'Status', 'Starred', 'Pinned', 'Correct'];

var DECK_EXTRA = ['Deck ID', 'Task ID', 'Kind', 'Correct answer', 'Model answer', 'Unit',
  'Slide no', 'Slide title', 'Order'];
var DECKQ_COLS = BOARD_COLS.concat(DECK_EXTRA);
var DECK_COLS = ['Deck ID', 'Title', 'Course', 'Questions', 'Connected', 'Link for students',
  'Chapter check questions', 'Questions for class'];
var CHECK_COLS = ['Deck ID', 'Deck', 'Class', 'Reg No', 'Name', 'First try %', 'First try score',
  'Best %', 'Tries', 'Last try', 'Points given', 'Points given at', 'Note'];
// The chapter check reward. The teacher changes these in the Settings tab.
var CHECK_SETTINGS = [['Chapter check pass mark (%)', 80], ['Chapter check points', 30],
  ['Chapter check counts', 'First try'], ['Star points', 5]];
// How far each student has got in each deck. Seen and Answered list the slide and question IDs.
// Wrong first try: questions whose first answer was wrong. Put right: of those, the ones answered right
// later (in the deck, or in Practise). Students see them as My mistakes.
var PROG_COLS = ['Deck ID', 'Class', 'Name', 'Slides seen', 'Slides', 'Questions answered', 'Questions',
  'Last active', 'Seen', 'Answered', 'Read', 'Wrong first try', 'Put right'];
var HUB_LOG = 'Rewards log';
var HUB_LOG_COLS = ['Time', 'Class', 'Reg No', 'Name', 'What', 'Item', 'Points', 'Tokens', 'Ticket', 'Collected', 'Note'];

var MAX_TEXT = 1000;
var MAX_IMAGE_CHARS = 2500000; // about 1.8 MB of JPEG or PNG

/* ------------------------------------------------------------------ */
/* Web app entry                                                       */
/* ------------------------------------------------------------------ */

/* Which code this is. Change it with every update, so the Teacher page can tell whether the
   link your slides and your phone use is running this same code (see apiLinkCheck). */
var BUILD = '2026-10-09-chapters';
var BRIDGE_LATEST = 11;   // slides with an older bridge reload themselves once a newer copy is on the site

function lbDoGet_(e) {
  if (e && e.parameter && e.parameter.api === 'build') {
    return ContentService.createTextOutput(JSON.stringify({ app: 'liveboard', build: BUILD }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  var view = (e && e.parameter && e.parameter.view) || '';
  var page = view === 'teacher' ? 'Teacher' : 'Student';
  // The page comes from the lesson site when it can (it updates itself), or else the copy pasted here.
  return (typeof pageHtml_ === 'function' ? HtmlService.createHtmlOutput(pageHtml_(page)) : HtmlService.createHtmlOutputFromFile(page))
    .setTitle(page === 'Teacher' ? 'Live Board (teacher)' : 'learnwithmrcedric')
    .addMetaTag('viewport', page === 'Teacher' ? 'width=device-width, initial-scale=1, viewport-fit=cover'
      : 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/* ------------------------------------------------------------------ */
/* Sheet menu and setup                                                */
/* ------------------------------------------------------------------ */

function lbOnOpen_() {
  SpreadsheetApp.getUi().createMenu('Live Board')
    .addItem('1. Set up this sheet', 'setupSheet')
    .addItem('2. Check student list', 'checkStudents')
    .addItem('3. Show my links', 'showLinks')
    .addItem('4. Change the web app link', 'setWebAppLink')
    .addSeparator()
    .addItem('5. Use the Worksheet Hub class list', 'useHubClassList')
    .addItem('6. Set the Worksheet Hub link for students', 'setHubLink')
    .addItem('7. Give chapter check points now', 'givePendingPoints')
    .addItem('8. Check the link to the Worksheet Hub', 'checkHubLink')
    .addToUi();
}

function setupSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  var st = ss.getSheetByName(TAB.settings) || ss.insertSheet(TAB.settings);
  if (st.getLastRow() < 1) {
    st.getRange(1, 1, 3, 2).setValues([
      ['Setting', 'Value'],
      ['Teacher PIN', String(Math.floor(100000 + Math.random() * 900000))],
      ['Photo folder ID', '']
    ]);
    st.getRange('A1:B1').setFontWeight('bold');
    st.setColumnWidth(1, 160); st.setColumnWidth(2, 320);
  }
  getPhotoFolder_();

  var sd = ss.getSheetByName(TAB.students) || ss.insertSheet(TAB.students);
  if (sd.getLastRow() < 1) {
    sd.getRange(1, 1, 2, 3).setValues([['Class', 'Reg No', 'Name'], ['TEST', 99, 'Test Student']]);
    sd.getRange('A1:C1').setFontWeight('bold');
    sd.setFrozenRows(1);
  }

  var bd = ss.getSheetByName(TAB.boards) || ss.insertSheet(TAB.boards);
  if (bd.getLastRow() < 1) {
    bd.getRange(1, 1, 1, BOARD_COLS.length).setValues([BOARD_COLS]).setFontWeight('bold');
    bd.setFrozenRows(1);
  }

  var ps = ss.getSheetByName(TAB.posts) || ss.insertSheet(TAB.posts);
  ps.getRange(1, 1, 1, POST_COLS.length).setValues([POST_COLS]).setFontWeight('bold');
  ps.setFrozenRows(1);

  CacheService.getScriptCache().remove('tabs_v5');
  ensureDeckTabs_();

  var s1 = ss.getSheetByName('Sheet1');
  if (s1 && s1.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(s1);

  SpreadsheetApp.getUi().alert('Live Board is set up.\n\nYour teacher PIN is in the Settings tab: ' +
    getSetting_('Teacher PIN') + '\n\nNext, paste your class lists into the Students tab.');
}

/* Changes typed into the sheet take effect straight away. */
function onEdit(e) {
  try {
    var name = e.range.getSheet().getName();
    var cache = CacheService.getScriptCache();
    if (name === TAB.students) cache.remove('roster');
    if (name === TAB.settings) cache.remove('pin');
    if (name === TAB.boards) cache.remove('boards');
    if (name === TAB.deckq) { cache.remove('deckboards'); readDecks_().forEach(function (d) { cache.remove('db_' + String(d.id).slice(0, 120)); }); }
  } catch (err) { /* ignore */ }
}

function checkStudents() {
  CacheService.getScriptCache().remove('roster');
  var roster = readRoster_();
  var lines = [];
  var problems = [];
  Object.keys(roster).sort().forEach(function (cls) {
    lines.push(cls + ': ' + roster[cls].length + ' students');
    var seen = {};
    roster[cls].forEach(function (s) {
      var k = s.name.toLowerCase();
      if (seen[k]) problems.push(cls + ' has two students named "' + s.name + '".');
      seen[k] = true;
    });
  });
  var src = getSetting_('Class list sheet ID') ? 'Class list: the Students tab of your Worksheet Hub sheet.\n\n' : 'Class list: the Students tab of this sheet.\n\n';
  var msg = src + (lines.length ? lines.join('\n') : 'The Students tab has no students yet.');
  if (problems.length) msg += '\n\nFix these so students can tell themselves apart:\n' + problems.join('\n');
  SpreadsheetApp.getUi().alert(msg);
}

/* The sheet menu shows exactly the link from Deploy > Manage deployments.
   Google's own guess at the link from inside the sheet (ScriptApp.getService().getUrl())
   can point at a different deployment ID, which opens as
   "Sorry, unable to open the file at this time", so it is never used. */
function savedExecUrl_() {
  return plainExecUrl_(PropertiesService.getScriptProperties().getProperty('WEBAPP_URL') || '');
}
/* The plain form of the link, https://script.google.com/macros/s/ID/exec. The form copied from
   Deploy on a school account (/a/macros/moe.edu.sg/s/ID/exec) makes Google ask for that school
   account first, so a phone or an iPad would have to sign in. The plain form opens for anyone. */
function plainExecUrl_(u) {
  var m = String(u || '').match(/^https:\/\/script\.google\.com\/(?:a\/[^\/]+\/macros|a\/macros\/[^\/]+|macros)(?:\/u\/\d+)?\/s\/([-\w]+)\/exec/);
  return m ? 'https://script.google.com/macros/s/' + m[1] + '/exec' : String(u || '');
}

function cleanExecUrl_(u) {
  var m = String(u || '').trim().match(/^(https:\/\/script\.google\.com\/[^?#\s]*\/s\/[-\w]+\/exec)\b/);
  return m ? m[1] : '';
}

function lbShowLinks_() {
  var url = savedExecUrl_();
  if (!url) { setWebAppLink(); return; }
  SpreadsheetApp.getUi().alert('Student link (embed this on your Google Site):\n' + url +
    '\n\nTeacher link (open this on the projector):\n' + url + '?view=teacher');
}

function setWebAppLink() {
  var ui = SpreadsheetApp.getUi();
  var res = ui.prompt('Set the web app link',
    'In Apps Script, click Deploy > Manage deployments and copy the Web app URL (it ends in /exec). Paste it here.',
    ui.ButtonSet.OK_CANCEL);
  if (res.getSelectedButton() !== ui.Button.OK) return;
  var u = cleanExecUrl_(res.getResponseText());
  if (!u) {
    ui.alert('That is not a web app link ending in /exec. Nothing was changed.\n\n' +
      'Copy the Web app URL from Deploy > Manage deployments, not the /dev test link.');
    return;
  }
  PropertiesService.getScriptProperties().setProperty('WEBAPP_URL', u);
  ui.alert('Saved. These are the links from now on.\n\nStudent link:\n' + u + '\n\nTeacher link:\n' + u + '?view=teacher');
}

function ensureDeckTabs_() {
  var cache = CacheService.getScriptCache();
  if (cache.get('tabs_v5')) return;
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var dk = ss.getSheetByName(TAB.decks);
  if (!dk) {
    dk = ss.insertSheet(TAB.decks);
    dk.setFrozenRows(1);
  }
  if (String(dk.getRange(1, DECK_COLS.length).getValue()) !== DECK_COLS[DECK_COLS.length - 1]) {
    dk.getRange(1, 1, 1, DECK_COLS.length).setValues([DECK_COLS]).setFontWeight('bold');
  }
  var ck = ss.getSheetByName(TAB.checks);
  if (!ck) {
    ck = ss.insertSheet(TAB.checks);
    ck.getRange(1, 1, 1, CHECK_COLS.length).setValues([CHECK_COLS]).setFontWeight('bold');
    ck.setFrozenRows(1);
  }
  var st = sheet_(TAB.settings);
  var have = {};
  st.getDataRange().getValues().forEach(function (r) { have[String(r[0]).trim()] = true; });
  CHECK_SETTINGS.forEach(function (x) { if (!have[x[0]]) st.appendRow(x); });
  var pg = ss.getSheetByName(TAB.progress);
  if (!pg) {
    pg = ss.insertSheet(TAB.progress);
    pg.getRange(1, 1, 1, PROG_COLS.length).setValues([PROG_COLS]).setFontWeight('bold');
    pg.setFrozenRows(1);
  }
  var dq = ss.getSheetByName(TAB.deckq);
  if (!dq) {
    dq = ss.insertSheet(TAB.deckq);
    dq.getRange(1, 1, 1, DECKQ_COLS.length).setValues([DECKQ_COLS]).setFontWeight('bold');
    dq.setFrozenRows(1);
  }
  // Plain text, so Sheets never turns an answer such as 1/2 into a date or an ID into a number.
  if (!PropertiesService.getScriptProperties().getProperty('TEXT_COLS_V5')) {
    var ps = ss.getSheetByName(TAB.posts);
    if (ps) { ps.getRange('A:B').setNumberFormat('@'); ps.getRange('G:H').setNumberFormat('@'); }
    ck.getRange('G:G').setNumberFormat('@');
    dq.getRange('T:T').setNumberFormat('@');
    PropertiesService.getScriptProperties().setProperty('TEXT_COLS_V5', '1');
  }
  cache.put('tabs_v5', '1', 21600);
}

function useHubClassList() {
  var ui = SpreadsheetApp.getUi();
  var res = ui.prompt('Use the Worksheet Hub class list',
    'Open your Worksheet Hub sheet and copy its address from the browser (it has /spreadsheets/d/ in it). Paste it here.\n\n' +
    'Leave it empty and press OK to go back to this sheet\'s own Students tab.', ui.ButtonSet.OK_CANCEL);
  if (res.getSelectedButton() !== ui.Button.OK) return;
  var text = res.getResponseText().trim();
  if (!text) {
    setSetting_('Class list sheet ID', '');
    CacheService.getScriptCache().remove('roster');
    ui.alert('Live Board now uses the Students tab in this sheet.');
    return;
  }
  var m = text.match(/\/spreadsheets\/d\/([-\w]{20,})/) || text.match(/^([-\w]{20,})$/);
  if (!m) { ui.alert('That is not a Google Sheets address. Nothing was changed.'); return; }
  try {
    var sh = SpreadsheetApp.openById(m[1]).getSheetByName('Students');
    if (!sh) { ui.alert('That sheet has no Students tab. Nothing was changed.'); return; }
  } catch (err) {
    ui.alert('That sheet could not be opened: ' + err.message + '\nNothing was changed.');
    return;
  }
  setSetting_('Class list sheet ID', m[1]);
  CacheService.getScriptCache().remove('roster');
  checkStudents();
}

function setHubLink() {
  var ui = SpreadsheetApp.getUi();
  var res = ui.prompt('Worksheet Hub link for students',
    'Paste the Worksheet Hub student link (the web app link ending in /exec). Students see it as Worksheets on the Live Board home page. Leave it empty to hide it.',
    ui.ButtonSet.OK_CANCEL);
  if (res.getSelectedButton() !== ui.Button.OK) return;
  var text = res.getResponseText().trim();
  if (text && !/^https:\/\/script\.google\.com\/.+\/exec\b/.test(text)) {
    ui.alert('That is not a web app link ending in /exec. Nothing was changed.');
    return;
  }
  setSetting_('Worksheet Hub link', text.replace(/[?#].*$/, ''));
  ui.alert(text ? 'Saved. Students see Worksheets on the Live Board home page.' : 'Worksheets is hidden from the Live Board home page.');
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function sheet_(name) {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
  if (!sh) throw new Error('The "' + name + '" tab is missing. Run Live Board > 1. Set up this sheet.');
  return sh;
}

function getSetting_(key) {
  var rows = sheet_(TAB.settings).getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) if (String(rows[i][0]).trim() === key) return String(rows[i][1]).trim();
  return '';
}

function setSetting_(key, value) {
  var sh = sheet_(TAB.settings);
  var rows = sh.getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][0]).trim() === key) { sh.getRange(i + 1, 2).setValue(value); return; }
  }
  sh.appendRow([key, value]);
}

function getPhotoFolder_() {
  var id = getSetting_('Photo folder ID');
  if (id) {
    try { return DriveApp.getFolderById(id); } catch (err) { /* make a new one */ }
  }
  var f = DriveApp.createFolder('Live Board photos');
  setSetting_('Photo folder ID', f.getId());
  return f;
}

/* IDs start with a letter, so Sheets never reads one as a number (such as 1234e567...). */
function uuid_() { return 'p' + Utilities.getUuid().replace(/-/g, '').slice(0, 15); }

function bool_(v) { return v === true || String(v).toUpperCase() === 'TRUE'; }

function checkPin_(pin) {
  var cache = CacheService.getScriptCache();
  var given = String(pin == null ? '' : pin).trim();
  if (/^tk_[a-f0-9]{24,}$/.test(given)) {
    if (tokenOk_(given)) return;
    throw new Error('This sign-in from the Teacher Hub has run out. Open it again from the Hub.');
  }
  if (/^dv_[a-f0-9]{24,}$/.test(given)) {
    if (devOk_(given)) return;
    throw new Error('This phone or laptop is not paired any more (the teacher PIN was changed, or it was unpaired). Sign in again.');
  }
  var real = cache.get('pin');
  if (!real) {
    real = getSetting_('Teacher PIN');
    if (real) cache.put('pin', real, 120);
  }
  var fails = Number(cache.get('pin_fails') || 0);
  if (fails >= 20) throw new Error('Wrong PIN. Too many wrong PINs: wait 15 minutes.');
  if (!real || String(pin).trim() !== real) { cache.put('pin_fails', String(fails + 1), 900); throw new Error('Wrong PIN.'); }
}

function bump_(boardId) {
  var p = PropertiesService.getScriptProperties();
  var v = Number(p.getProperty('v_' + boardId) || 0) + 1;
  p.setProperty('v_' + boardId, String(v));
  return v;
}

function version_(boardId) {
  return Number(PropertiesService.getScriptProperties().getProperty('v_' + boardId) || 0);
}

function withLock_(fn, ms) {
  var lock = LockService.getScriptLock();
  lock.waitLock(ms || 20000);
  try { return fn(); } finally { lock.releaseLock(); }
}

function clean_(s, max) {
  return String(s == null ? '' : s).replace(/\r\n/g, '\n').slice(0, max || 200).trim();
}

/* Roster: { CLASS: [{name, reg}] } sorted by reg then name */
/* The class list is the Students tab of the Worksheet Hub sheet when one is set
   (Live Board > 5), otherwise this sheet's own Students tab. */
function rosterSheet_() {
  var id = '';
  try { id = typeof hubSheetId_ === 'function' ? hubSheetId_() : ''; } catch (err) { id = ''; }
  if (!id) id = getSetting_('Class list sheet ID');
  if (id) {
    var sh = SpreadsheetApp.openById(id).getSheetByName('Students');
    if (!sh) throw new Error('The Worksheet Hub sheet has no Students tab.');
    return sh;
  }
  return sheet_(TAB.students);
}

function readRoster_() {
  var cache = CacheService.getScriptCache();
  var hit = cache.get('roster');
  if (hit) return JSON.parse(hit);
  var sh = rosterSheet_(), rows = sh.getDataRange().getValues();
  var col = rosterCols_(rows);
  var ci = col.ci, ni = col.ni, ri = col.ri;
  var out = {};
  for (var i = col.start; i < rows.length; i++) {
    var cls = String(rows[i][ci]).trim().toUpperCase();
    var name = String(rows[i][ni]).trim();
    if (!cls || !name) continue;
    (out[cls] = out[cls] || []).push({ name: name, reg: ri >= 0 ? String(rows[i][ri]).trim() : '' });
  }
  Object.keys(out).forEach(function (c) {
    out[c].sort(function (a, b) {
      var x = Number(a.reg), y = Number(b.reg);
      if (a.reg && b.reg && !isNaN(x) && !isNaN(y) && x !== y) return x - y;
      return a.name.localeCompare(b.name);
    });
  });
  if (!Object.keys(out).length && col.plain) {
    var where = '';
    try { where = ' of the "' + sh.getParent().getName() + '" sheet'; } catch (err) { where = ''; }
    throw new Error('The class list is empty: the Students tab' + where + ' has no students. Put Class in column A, Reg No in B and Name in C, from row 2.');
  }
  cachePut_('roster', JSON.stringify(out), 120);
  return out;
}
/* Which columns hold the class, name and register number: the first of the top five rows that has a Class column
   and a Name column ("Student name", "Reg No (optional)", "Index no." and the like count), or else the Teacher Hub's
   own layout, A Class, B Reg No, C Name, from row 2, as the Hub itself reads it. */
function rosterCols_(rows) {
  for (var r = 0; r < Math.min(5, rows.length); r++) {
    var ci = -1, ni = -1, ri = -1;
    rows[r].forEach(function (h, i) {
      h = String(h).trim().toLowerCase();
      if (ci < 0 && /^(class|form)\b/.test(h)) ci = i;
      else if (ni < 0 && /\bname\b/.test(h)) ni = i;
      else if (ri < 0 && /^(reg|index|register|no\b|no\.)/.test(h)) ri = i;
    });
    if (ci >= 0 && ni >= 0) return { start: r + 1, ci: ci, ni: ni, ri: ri };
  }
  return { start: 1, ci: 0, ri: 1, ni: 2, plain: true };
}

function findStudent_(cls, name) {
  var list = readRoster_()[String(cls).trim().toUpperCase()] || [];
  for (var i = 0; i < list.length; i++) if (list[i].name === name) return list[i];
  return null;
}

/* ---------------- Boards ---------------- */

function rowToBoard_(r) {
  return {
    id: String(r[0]), title: String(r[1]), prompt: String(r[2]),
    classes: String(r[3]).split(',').map(function (s) { return s.trim().toUpperCase(); }).filter(String),
    layout: String(r[4] || 'wall'),
    columns: String(r[5] || '').split('|').map(function (s) { return s.trim(); }).filter(String),
    state: String(r[6] || 'open'),
    hideUntilReveal: bool_(r[7]), revealed: bool_(r[8]), approveFirst: bool_(r[9]),
    studentsSee: bool_(r[10]), allowImages: bool_(r[11]),
    postsPerStudent: Number(r[12]) || 0,
    wallpaper: String(r[13] || 'graph'),
    created: r[14] ? new Date(r[14]).getTime() : 0,
    updated: r[15] ? new Date(r[15]).getTime() : 0
  };
}

function boardToRow_(b) {
  return [b.id, b.title, b.prompt, b.classes.join(', '), b.layout, b.columns.join(' | '), b.state,
    b.hideUntilReveal, b.revealed, b.approveFirst, b.studentsSee, b.allowImages,
    b.postsPerStudent, b.wallpaper, new Date(b.created || Date.now()), new Date()];
}

function cachePut_(key, value, secs) {
  try { CacheService.getScriptCache().put(key, value, secs); } catch (err) { /* too big to cache */ }
}

function readBoards_() {
  var cache = CacheService.getScriptCache();
  var hit = cache.get('boards');
  if (hit) return JSON.parse(hit);
  var rows = sheet_(TAB.boards).getDataRange().getValues();
  var out = [];
  for (var i = 1; i < rows.length; i++) if (rows[i][0]) out.push(rowToBoard_(rows[i]));
  cachePut_('boards', JSON.stringify(out), 600);
  return out;
}

/* Deck question boards. The Columns cell holds the answer options as JSON. */
function rowToDeckBoard_(r) {
  var b = rowToBoard_(r);
  try { b.columns = JSON.parse(String(r[5] || '[]')); } catch (err) { b.columns = []; }
  b.deckId = String(r[16]); b.taskId = String(r[17]); b.kind = String(r[18] || 'written');
  b.correct = String(r[19] || ''); b.model = String(r[20] || ''); b.unit = String(r[21] || '');
  b.slideNo = Number(r[22]) || 0; b.slideTitle = String(r[23] || ''); b.order = Number(r[24]) || 0;
  return b;
}

function deckBoardToRow_(b) {
  var row = boardToRow_(b);
  row[5] = JSON.stringify(b.columns || []);
  return row.concat([b.deckId, b.taskId, b.kind, b.correct, b.model, b.unit, b.slideNo, b.slideTitle, b.order]);
}

function readDeckBoards_() {
  var cache = CacheService.getScriptCache();
  var hit = cache.get('deckboards');
  if (hit) return JSON.parse(hit);
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(TAB.deckq);
  var out = [];
  if (sh && sh.getLastRow() > 1) {
    var rows = sh.getRange(2, 1, sh.getLastRow() - 1, DECKQ_COLS.length).getValues();
    for (var i = 0; i < rows.length; i++) if (rows[i][0]) out.push(rowToDeckBoard_(rows[i]));
  }
  cachePut_('deckboards', JSON.stringify(out), 600);
  return out;
}

/* One deck's question boards, kept per deck (all decks together are too big to cache). */
function readDeckBoardsFor_(deckId) {
  var key = 'db_' + String(deckId).slice(0, 120);
  var hit = getBig_(key);
  if (hit) return JSON.parse(hit);
  var out = readDeckBoards_().filter(function (b) { return b.deckId === deckId; });
  putBig_(key, JSON.stringify(out), 600);
  return out;
}

/* CacheService keeps at most 100 KB under one key, so a bigger value is kept in pieces. */
function putBig_(key, text, secs) {
  var cache = CacheService.getScriptCache(), size = 90000, parts = {}, n = Math.ceil(text.length / size) || 1;
  for (var i = 0; i < n; i++) parts[key + '#' + i] = text.slice(i * size, (i + 1) * size);
  parts[key] = 'parts:' + n;
  try { cache.putAll(parts, secs); } catch (err) { /* reads go to the sheet instead */ }
}
function getBig_(key) {
  var cache = CacheService.getScriptCache(), head = cache.get(key);
  if (!head) return null;
  var n = Number(String(head).replace('parts:', '')) || 0, keys = [];
  for (var i = 0; i < n; i++) keys.push(key + '#' + i);
  var got = cache.getAll(keys), out = '';
  for (var j = 0; j < n; j++) { if (got[keys[j]] == null) return null; out += got[keys[j]]; }
  return out;
}
function forgetDeckBoards_(deckId) {
  var cache = CacheService.getScriptCache();
  cache.remove('deckboards');
  if (deckId) cache.remove('db_' + String(deckId).slice(0, 120));
}

function isDeckBoardId_(id) { return String(id).indexOf('D:') === 0; }

function deckBoardId_(deckId, taskId) { return 'D:' + deckId + ':' + taskId; }

function getBoard_(id) {
  var all = readBoards_();
  if (isDeckBoardId_(id)) {
    all = [];
    readDecks_().forEach(function (d) { if (String(id).indexOf('D:' + d.id + ':') === 0) all = all.concat(readDeckBoardsFor_(d.id)); });
    if (!all.length) all = readDeckBoards_();
  }
  for (var i = 0; i < all.length; i++) if (all[i].id === id) return all[i];
  throw new Error('That board no longer exists.');
}

function writeBoard_(b) {
  var deck = !!b.deckId;
  var sh = deck ? sheet_(TAB.deckq) : sheet_(TAB.boards);
  var ids = sh.getLastRow() > 1 ? sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues() : [];
  var row = deck ? deckBoardToRow_(b) : boardToRow_(b);
  var forget = function () { if (deck) forgetDeckBoards_(b.deckId); else CacheService.getScriptCache().remove('boards'); };
  for (var i = 0; i < ids.length; i++) {
    if (String(ids[i][0]) === b.id) {
      sh.getRange(i + 2, 1, 1, row.length).setValues([row]);
      forget();
      return;
    }
  }
  sh.appendRow(row);
  forget();
}

function boardHasClass_(b, cls) {
  cls = String(cls).trim().toUpperCase();
  return cls === 'TEST' || b.classes.indexOf('ALL') >= 0 || b.classes.indexOf(cls) >= 0;
}

/* ---------------- Posts ---------------- */

function rowToPost_(r) {
  return {
    id: String(r[0]), boardId: String(r[1]),
    time: r[2] ? new Date(r[2]).getTime() : 0,
    cls: String(r[3]), reg: String(r[4]), name: String(r[5]),
    column: String(r[6] || ''), text: String(r[7] || ''),
    image: r[8] ? true : false,
    status: String(r[9] || 'shown'),
    starred: bool_(r[10]), pinned: bool_(r[11]),
    correct: r[12] === '' || r[12] == null ? null : bool_(r[12])
  };
}

/* Returns [{post, row}] for one board. Row is the sheet row number. */
function readPosts_(boardId) {
  var got = postRows_('ph_' + boardId, function (r) { return String(r[1]) === boardId && r[0]; });
  var out = [];
  for (var i = 0; i < got.rows.length; i++) {
    var r = got.rows[i];
    if (String(r[1]) === boardId && r[0]) out.push({ post: rowToPost_(r), row: got.start + i, raw: r });
  }
  return out;
}

/* The Posts tab only grows at the bottom, so a board's answers all sit at or below its first one.
   Live Board remembers where each board's first answer is (and that answer's ID), and reads from
   there down instead of the whole tab, which grows all year. Returns { rows, start }: the rows from
   the first match to the end of the tab, and the sheet row of rows[0]. Callers still filter rows.
   If that first answer has moved up (rows deleted above it) or was deleted, the remembered place
   is not trusted and the whole tab is read once to find it again. */
function postRows_(hintKey, test) {
  var sh = sheet_(TAB.posts), last = sh.getLastRow();
  if (last < 2) return { rows: [], start: 2 };
  var props = PropertiesService.getScriptProperties(), cache = CacheService.getScriptCache();
  var h = null;
  try { h = JSON.parse(props.getProperty(hintKey) || 'null'); } catch (err) { h = null; }
  if (h && h.row && h.id) {
    var from = Math.max(2, h.row - 200);   // room for a few rows deleted above it
    if (from <= last) {
      var vals = sh.getRange(from, 1, last - from + 1, POST_COLS.length).getValues();
      for (var j = 0; j < vals.length; j++) {
        if (String(vals[j][0]) === h.id) {
          if (from + j !== h.row) props.setProperty(hintKey, JSON.stringify({ row: from + j, id: h.id }));
          return { rows: vals.slice(j), start: from + j };
        }
      }
    }
  } else {
    // A board with no answers yet: they can only appear below the row that was last when it was checked.
    var empty = Number(cache.get(hintKey) || 0);
    if (empty >= 2) {
      var from2 = Math.max(2, empty - 200);
      if (from2 > last) return { rows: [], start: last + 1 };
      var v2 = sh.getRange(from2, 1, last - from2 + 1, POST_COLS.length).getValues();
      for (var k = 0; k < v2.length; k++) {
        if (test(v2[k])) {
          props.setProperty(hintKey, JSON.stringify({ row: from2 + k, id: String(v2[k][0]) }));
          cache.remove(hintKey);
          return { rows: v2.slice(k), start: from2 + k };
        }
      }
      return { rows: [], start: last + 1 };
    }
  }
  var all = sh.getRange(2, 1, last - 1, POST_COLS.length).getValues();
  for (var i = 0; i < all.length; i++) {
    if (test(all[i])) {
      props.setProperty(hintKey, JSON.stringify({ row: i + 2, id: String(all[i][0]) }));
      return { rows: all.slice(i), start: i + 2 };
    }
  }
  props.deleteProperty(hintKey);
  cachePut_(hintKey, String(last + 1), 300);   // short, in case rows are deleted by hand in the meantime
  return { rows: [], start: last + 1 };
}

function findPost_(postId) {
  var sh = sheet_(TAB.posts);
  var n = sh.getLastRow() - 1;
  if (n < 1) return null;
  var ids = sh.getRange(2, 1, n, 1).getValues();
  for (var i = 0; i < ids.length; i++) {
    if (String(ids[i][0]) === postId) {
      var raw = sh.getRange(i + 2, 1, 1, POST_COLS.length).getValues()[0];
      return { post: rowToPost_(raw), row: i + 2, raw: raw };
    }
  }
  return null;
}

/* What a student is allowed to see of a post: never other students' names. */
function publicPost_(p, showNames) {
  return {
    id: p.id, column: p.column, text: p.text, image: p.image, time: p.time,
    starred: p.starred, pinned: p.pinned,
    name: showNames ? p.name : ''
  };
}

/* ------------------------------------------------------------------ */
/* Student calls                                                       */
/* ------------------------------------------------------------------ */

function apiRoster() {
  var r = readRoster_();
  return Object.keys(r).sort().map(function (c) {
    return { cls: c, names: r[c].map(function (s) { return s.name; }) };
  });
}

function studentBoards_(cls, name) {
  if (!findStudent_(cls, name)) throw new Error('Your name is not on the class list. Ask your teacher.');
  return readBoards_().filter(function (b) {
    return (b.state === 'open' || b.state === 'locked') && boardHasClass_(b, cls);
  }).sort(function (a, b) { return b.updated - a.updated; }).map(function (b) {
    return { id: b.id, title: b.title, state: b.state, wallpaper: b.wallpaper };
  });
}

function apiStudentBoard(boardId, st, sinceVersion) {
  var me0 = stWho_(st), cls = me0.cls, name = me0.name;
  if (!findStudent_(cls, name)) throw new Error('Your name is not on the class list. Ask your teacher.');
  var b = getBoard_(boardId);
  if (!boardHasClass_(b, cls) || (b.state !== 'open' && b.state !== 'locked')) {
    return { gone: true };
  }
  var v = version_(boardId);
  if (sinceVersion && Number(sinceVersion) === v) return { same: true, version: v };

  var mine = [], others = [];
  var canSeeOthers = b.studentsSee && (!b.hideUntilReveal || b.revealed);
  readPosts_(boardId).forEach(function (x) {
    var p = x.post;
    if (p.cls.toUpperCase() === String(cls).toUpperCase() && p.name === name) {
      mine.push({ id: p.id, column: p.column, text: p.text, image: p.image, time: p.time, status: p.status });
    } else if (canSeeOthers && p.status === 'shown') {
      others.push(publicPost_(p, false));
    }
  });
  return {
    version: v,
    board: {
      id: b.id, title: b.title, prompt: b.prompt, layout: b.layout, columns: b.columns,
      state: b.state, allowImages: b.allowImages, postsPerStudent: b.postsPerStudent,
      wallpaper: b.wallpaper, studentsSee: canSeeOthers,
      waitingForReveal: b.studentsSee && b.hideUntilReveal && !b.revealed
    },
    mine: mine,
    others: others
  };
}

/**
 * data: { text, column, image: 'data:image/jpeg;base64,...' or '' }
 */
function apiSubmitPost(boardId, st, data) {
  var me0 = stWho_(st), cls = me0.cls, name = me0.name;
  var student = findStudent_(cls, name);
  if (!student) throw new Error('Your name is not on the class list. Ask your teacher.');
  data = data || {};
  var text = clean_(data.text, MAX_TEXT);
  var image = String(data.image || '');
  if (!text && !image) throw new Error('Write something or add a picture first.');
  if (image && image.length > MAX_IMAGE_CHARS) throw new Error('That picture is too big. Try again with a smaller one.');

  var b = getBoard_(boardId);
  if (!boardHasClass_(b, cls)) throw new Error('This board is not for your class.');
  if (b.state !== 'open') throw new Error('Your teacher has locked this board. No new posts can be added.');
  if (image && !b.allowImages) throw new Error('Pictures are turned off for this board.');
  var column = clean_(data.column, 80);
  if (b.layout === 'columns' && b.columns.length) {
    if (b.columns.indexOf(column) < 0) throw new Error('Choose a column first.');
  } else {
    column = '';
  }

  // Save the image outside the lock: it is the slow part.
  var fileId = '';
  if (image) {
    var m = image.match(/^data:(image\/(?:jpeg|png));base64,(.+)$/);
    if (!m) throw new Error('That picture could not be read. Try again.');
    var ext = m[1] === 'image/png' ? 'png' : 'jpg';
    var blob = Utilities.newBlob(Utilities.base64Decode(m[2]), m[1],
      String(cls).toUpperCase() + '_' + name + '_' + Date.now() + '.' + ext);
    fileId = getPhotoFolder_().createFile(blob).getId();
  }

  try {
    return savePost_(b, boardId, cls, name, student, column, text, fileId);
  } catch (err) {
    trashImage_(fileId);
    throw err;
  }
}

function savePost_(b, boardId, cls, name, student, column, text, fileId) {
  return withLock_(function () {
    if (b.postsPerStudent > 0) {
      var count = readPosts_(boardId).filter(function (x) {
        return x.post.cls.toUpperCase() === String(cls).toUpperCase() && x.post.name === name;
      }).length;
      if (count >= b.postsPerStudent) {
        throw new Error(b.postsPerStudent === 1 ? 'You have already posted. Delete your post first if you want to change it.'
          : 'You have already posted ' + count + ' times on this board.');
      }
    }
    var id = uuid_();
    var status = b.approveFirst ? 'pending' : 'shown';
    sheet_(TAB.posts).appendRow([id, boardId, new Date(), String(cls).toUpperCase(), student.reg, name,
      column, text, fileId, status, false, false]);
    bump_(boardId);
    return { id: id, status: status };
  });
}

function apiDeleteOwnPost(postId, st) {
  var me0 = stWho_(st), cls = me0.cls, name = me0.name;
  return withLock_(function () {
    var x = findPost_(postId);
    if (!x) return true;
    if (x.post.cls.toUpperCase() !== String(cls).toUpperCase() || x.post.name !== name) {
      throw new Error('You can only delete your own posts.');
    }
    var b = getBoard_(x.post.boardId);
    if (b.state !== 'open') throw new Error('The board is locked, so posts cannot be changed now.');
    trashImage_(x.raw[8]);
    sheet_(TAB.posts).deleteRow(x.row);
    bump_(x.post.boardId);
    return true;
  });
}

/* Image for a post. Students may load their own images and, when the
   board lets them see the board, images of shown posts. */
function apiImage(postId, auth) {
  auth = auth || {};
  var x = findPost_(postId);
  if (!x || !x.raw[8]) return '';
  if (auth.pin) {
    checkPin_(auth.pin);
  } else {
    var me0 = stWho_(auth.st);
    auth = { cls: me0.cls, name: me0.name };
    var mine = x.post.cls.toUpperCase() === String(auth.cls || '').toUpperCase() && x.post.name === auth.name;
    if (!mine) {
      var b = getBoard_(x.post.boardId);
      var ok = findStudent_(auth.cls, auth.name) && boardHasClass_(b, auth.cls) && b.studentsSee &&
        (!b.hideUntilReveal || b.revealed) && x.post.status === 'shown';
      if (!ok) throw new Error('Not allowed.');
    }
  }
  var file = DriveApp.getFileById(String(x.raw[8]));
  var blob = file.getBlob();
  return 'data:' + blob.getContentType() + ';base64,' + Utilities.base64Encode(blob.getBytes());
}

function trashImage_(fileId) {
  if (!fileId) return;
  try { DriveApp.getFileById(String(fileId)).setTrashed(true); } catch (err) { /* already gone */ }
}

/* ------------------------------------------------------------------ */
/* Teacher calls (all need the PIN)                                    */
/* ------------------------------------------------------------------ */

function apiTeacherHome(pin) {
  checkPin_(pin);
  var counts = {};
  var sh = sheet_(TAB.posts);
  var n = sh.getLastRow() - 1;
  if (n > 0) sh.getRange(2, 2, n, 1).getValues().forEach(function (r) {
    counts[r[0]] = (counts[r[0]] || 0) + 1;
  });
  var boards = readBoards_().filter(function (b) { return b.state !== 'archived'; })
    .sort(function (a, b) { return b.updated - a.updated; })
    .map(function (b) { b.postCount = counts[b.id] || 0; return b; });
  var decks = readDecks_().map(function (d) {
    var prefix = 'D:' + d.id + ':', n = 0;
    Object.keys(counts).forEach(function (k) { if (k.indexOf(prefix) === 0) n += counts[k]; });
    d.answerCount = n;
    return d;
  });
  return { boards: boards, decks: decks, classes: Object.keys(readRoster_()).sort(), endpoint: savedExecUrl_(),
    hubLink: (getSetting_('Worksheet Hub link') || selfUrl_()), ask: currentAsk_() };
}

function apiSaveBoard(pin, input) {
  checkPin_(pin);
  return withLock_(function () {
    var b = input.id ? getBoard_(input.id) : { id: uuid_(), created: Date.now(), state: 'open', revealed: false };
    var title = clean_(input.title, 120);
    if (!title) throw new Error('Give the board a title.');
    b.title = title;
    b.prompt = clean_(input.prompt, 600);
    b.classes = (input.classes || []).map(function (c) { return String(c).trim().toUpperCase(); }).filter(String);
    if (!b.classes.length) throw new Error('Choose at least one class.');
    b.layout = ['wall', 'columns', 'stream'].indexOf(input.layout) >= 0 ? input.layout : 'wall';
    if (!b.deckId) {   // a deck question keeps the answer options from its deck
      b.columns = (input.columns || []).map(function (c) { return clean_(c, 60); }).filter(String).slice(0, 8);
      if (b.layout === 'columns' && b.columns.length < 2) throw new Error('A column board needs at least two columns.');
    }
    b.hideUntilReveal = !!input.hideUntilReveal;
    if (!b.hideUntilReveal) b.revealed = false;
    b.approveFirst = !!input.approveFirst;
    b.studentsSee = !!input.studentsSee;
    b.allowImages = !!input.allowImages;
    b.postsPerStudent = Math.max(0, Math.min(20, Number(input.postsPerStudent) || 0));
    b.wallpaper = clean_(input.wallpaper, 20) || 'graph';
    writeBoard_(b);
    bump_(b.id);
    return getBoard_(b.id);
  });
}

function apiCopyBoard(pin, boardId, classes) {
  checkPin_(pin);
  var src = getBoard_(boardId);
  var copy = JSON.parse(JSON.stringify(src));
  copy.id = '';
  copy.classes = classes && classes.length ? classes : src.classes;
  return apiSaveBoard(pin, copy);
}

/* field: state | revealed */
function apiSetBoard(pin, boardId, field, value) {
  checkPin_(pin);
  return withLock_(function () {
    var b = getBoard_(boardId);
    if (field === 'state') {
      if (['open', 'locked', 'closed', 'archived'].indexOf(value) < 0) throw new Error('Unknown state.');
      b.state = value;
    } else if (field === 'revealed') {
      b.revealed = !!value;
    } else {
      throw new Error('Unknown setting.');
    }
    writeBoard_(b);
    bump_(boardId);
    return getBoard_(boardId);
  });
}

function apiTeacherBoard(pin, boardId, sinceVersion) {
  checkPin_(pin);
  var v = version_(boardId);
  var ask = currentAsk_();
  if (sinceVersion && Number(sinceVersion) === v) return { same: true, version: v, ask: ask };
  var b = getBoard_(boardId);
  var roster = readRoster_();
  var expected = [];
  var classes = b.classes.indexOf('ALL') >= 0 ? Object.keys(roster) : b.classes;
  classes.forEach(function (c) {
    (roster[c] || []).forEach(function (s) { expected.push({ cls: c, name: s.name, reg: s.reg }); });
  });
  var posts = readPosts_(boardId).map(function (x) { return x.post; });
  if (b.deckId) posts = latestPerStudent_(posts);
  return {
    version: v,
    board: b,
    posts: posts,
    expected: expected,
    ask: ask
  };
}

/* A deck answer can be submitted again after a retry. Only each student's latest one is shown. */
function latestPerStudent_(posts) {
  var best = {};
  posts.forEach(function (p) {
    var k = p.cls + '|' + p.name.toLowerCase();
    if (!best[k] || p.time >= best[k].time) best[k] = p;
  });
  return Object.keys(best).map(function (k) { return best[k]; });
}

/* changes: { status, starred, pinned, column } */
function apiUpdatePost(pin, postId, changes) {
  checkPin_(pin);
  return withLock_(function () {
    var x = findPost_(postId);
    if (!x) throw new Error('That post was deleted.');
    var row = x.raw.slice();
    if (changes.status !== undefined) {
      if (['shown', 'pending', 'hidden'].indexOf(changes.status) < 0) throw new Error('Unknown status.');
      row[9] = changes.status;
    }
    var starChange = changes.starred !== undefined && !!changes.starred !== x.post.starred;
    if (changes.starred !== undefined) row[10] = !!changes.starred;
    if (changes.pinned !== undefined) row[11] = !!changes.pinned;
    if (changes.column !== undefined) row[6] = clean_(changes.column, 80);
    sheet_(TAB.posts).getRange(x.row, 1, 1, POST_COLS.length).setValues([row]);
    bump_(x.post.boardId);
    var out = rowToPost_(row);
    if (starChange) out.starPoints = starPoints_(x.post, !!changes.starred);
    return out;
  });
}

function apiApproveAll(pin, boardId) {
  checkPin_(pin);
  return withLock_(function () {
    var sh = sheet_(TAB.posts);
    readPosts_(boardId).forEach(function (x) {
      if (x.post.status === 'pending') sh.getRange(x.row, 10).setValue('shown');
    });
    bump_(boardId);
    return true;
  });
}

function apiDeletePost(pin, postId) {
  checkPin_(pin);
  return withLock_(function () {
    var x = findPost_(postId);
    if (!x) return true;
    trashImage_(x.raw[8]);
    sheet_(TAB.posts).deleteRow(x.row);
    bump_(x.post.boardId);
    return true;
  });
}

function apiClearBoard(pin, boardId) {
  checkPin_(pin);
  return withLock_(function () {
    var sh = sheet_(TAB.posts);
    var list = readPosts_(boardId);
    for (var i = list.length - 1; i >= 0; i--) {
      trashImage_(list[i].raw[8]);
      sh.deleteRow(list[i].row);
    }
    var b = getBoard_(boardId);
    b.revealed = false;
    writeBoard_(b);
    bump_(boardId);
    return true;
  });
}

/* ------------------------------------------------------------------ */
/* Lesson decks                                                        */
/* ------------------------------------------------------------------ */

/* The decks send answers here (the web app's /exec link).
   Version 2 decks (the Chapter 1 v12 house architecture) send a batch:
     { version: 2, course, topicId, recordId, profile: { name, className },
       currentSlide, visits, events: [{ id, task, slide, at, answer, action, valid, correct }] }
   and expect { ok, course, topicId, recordId, acceptedIds, receivedAt } back.
   Older decks with <body data-collect-url> send one answer:
     { name, cls, deck, qid, question, answer } */
function lbDoPost_(e) {
  var out;
  try {
    var d = JSON.parse(e.postData.contents);
    if (d && d.api === 'roster') out = { ok: true, classes: apiRoster() };
    else if (d && d.api === 'unlock') out = { ok: apiUnlock(d.pin) };
    else if (d && d.api === 'live') out = liveCheck_(d);
    else if (d && d.api === 'away') out = awayNote_(d);
    else if (d && d.api === 'present') { checkPin_(d.pin); out = presentInfo_(d); }
    else if (d && d.api === 'start') { checkPin_(d.pin); out = presentStart_(d); }
    else if (d && d.api === 'end') { checkPin_(d.pin); apiEndLesson(d.pin, clean_(d.topicId, 120), String(d.cls || '').toUpperCase()); out = { ok: true }; }
    else if (d && d.api === 'lead') out = presenterLead_(d);
    else if (d && d.api === 'control') { checkPin_(d.pin); out = { ok: true, ctl: apiSetControlNoPin_(clean_(d.topicId, 120), d.cls, d.set || {}) }; }
    else if (d && d.api === 'review') out = review_(d);
    else if (d && d.api === 'results') out = slideResults_(d);
    else if (d && d.api === 'gatehelp') out = gateHelp_(d);
    else if (d && d.api === 'st') out = stRequest_(d);
    else if (d && d.api === 'mine') { var tkm = stCheck_(d.st); out = { ok: true, done: tkm ? studentDone_(clean_(d.topicId, 120), tkm.cls, tkm.name) : [] }; }
    else if (d && Number(d.version) === 2 && Array.isArray(d.events)) out = receiveDeckBatch_(d);
    else if (d && (d.qid || d.question) && d.answer != null) out = receiveSingle_(d);
    else out = { ok: false, error: 'Unknown request.' };
  } catch (err) {
    out = { ok: false, error: String(err && err.message || err) };
  }
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}

function normClass_(c) { return String(c || '').toUpperCase().replace(/[\s\-_.]+/g, '').slice(0, 20); }
function normName_(n) { return String(n || '').toLowerCase().replace(/\s+/g, ' ').trim(); }

/* Match what the student typed in the deck to the Students tab. */
function matchStudent_(className, name) {
  var cls = normClass_(className);
  var typed = clean_(String(name || '').replace(/\s+/g, ' '), 80);
  var roster = readRoster_();
  Object.keys(roster).forEach(function (k) { if (normClass_(k) === cls) cls = k; });
  var list = roster[cls] || [];
  var n = normName_(typed);
  for (var i = 0; i < list.length; i++) {
    if (normName_(list[i].name) === n) return { cls: cls, name: list[i].name, reg: list[i].reg, matched: true };
  }
  return { cls: cls || '?', name: typed || 'No name', reg: '', matched: false };
}

function deckStub_(deckId, taskId, title, kind) {
  return {
    id: deckBoardId_(deckId, taskId), title: clean_(title || taskId, 300), prompt: '', classes: ['ALL'],
    layout: 'wall', columns: [], state: 'open', hideUntilReveal: true, revealed: false,
    approveFirst: false, studentsSee: false, allowImages: false, postsPerStudent: 0,
    wallpaper: 'graph', created: Date.now(), updated: Date.now(),
    deckId: deckId, taskId: taskId, kind: kind || 'written', correct: '', model: '', unit: '',
    slideNo: 0, slideTitle: '', order: 9999
  };
}

function postRowFromDeck_(board, who, answer, at, correct) {
  var text = clean_(answer, MAX_TEXT);
  var column = '';
  if (board.kind === 'choice' && board.columns.indexOf(text) >= 0) column = text;
  if (board.kind === 'number' && board.unit && text && text.toLowerCase().indexOf(board.unit.toLowerCase()) < 0) {
    text = text + ' ' + board.unit;
  }
  var t = Date.parse(at);
  return [uuid_(), board.id, isNaN(t) ? new Date() : new Date(t), who.cls, who.reg, who.name, column, text, '',
    board.approveFirst ? 'pending' : 'shown', false, false,
    correct === true ? true : correct === false ? false : ''];
}

function receiveDeckBatch_(d) {
  var deckId = clean_(d.topicId, 120);
  if (!deckId) throw new Error('No topicId.');
  ensureDeckTabs_();
  var tk = stCheck_((d.liveBoard || {}).st);
  // Not signed in (or signed out by the teacher): the deck is still registered below, but nothing is saved.
  var who = tk ? matchStudent_(tk.cls, tk.name) : { cls: '', name: '', reg: '', matched: false };
  var lessonCtl = tk ? getCtl_(deckId, who.cls) : ctlDefault_();
  var counts = !!tk && inLessonWindow_(lessonCtl, Date.now());
  // Revision (outside the class's lesson): the deck keeps nothing, and nothing is saved here either.
  var answers = !tk ? [] : d.events.filter(function (ev) {
    return ev && ev.action === 'submit' && ev.valid !== false && String(ev.answer == null ? '' : ev.answer).trim() &&
      inLessonWindow_(lessonCtl, Date.parse(ev.at));
  });
  // Decks with the Live Board bridge describe their own questions, so they need no connect step.
  var lb = d.liveBoard || {};
  var all = Array.isArray(lb.allQuestions) ? lb.allQuestions : null;
  var needRegister = false;
  if (all && all.length) {
    var known0 = findDeck_(deckId);
    needRegister = !known0 || known0.questions !== all.length || known0.title === deckId ||
      (Array.isArray(lb.chapterCheck) && lb.chapterCheck.length > 0 && !known0.check.length);
  }
  if (needRegister) {
    withLock_(function () {
      // When a whole class opens a new deck at once, the first one in registers it and the rest see that.
      var k = findDeck_(deckId);
      var still = !k || k.questions !== all.length || k.title === deckId ||
        (Array.isArray(lb.chapterCheck) && lb.chapterCheck.length > 0 && !k.check.length);
      if (still) registerDeck_(deckId, lb.deckTitle, d.course, all, Array.isArray(lb.chapterCheck) ? lb.chapterCheck : null);
    });
  }
  if (lb.deckUrl && /^https:\/\//.test(lb.deckUrl) && String(lb.deckUrl).indexOf(lessonSite_()) === 0) rememberDeckLink_(deckId, clean_(lb.deckUrl, 400));
  if (!needRegister && Array.isArray(lb.chapterCheck) && lb.chapterCheck.length) rememberCheck_(deckId, lb.chapterCheck);
  if (!tk) {
    return { ok: true, course: d.course, topicId: d.topicId, recordId: d.recordId, acceptedIds: [],
      receivedAt: new Date().toISOString(), liveBoard: { signedOut: true } };
  }
  var cache = CacheService.getScriptCache();
  var evKey = function (ev) { return 'ev_' + String(d.recordId || '').slice(0, 50) + '_' + String(ev.id || '').slice(0, 60); };
  var checkRes = null, award = null;
  var visits = who.matched && counts && Array.isArray(d.visits) && d.visits.length;
  var fresh = [];
  if (answers.length) {
    // A deck that gave up waiting sends the same answers again: skip the ones already saved, and claim the
    // rest straight away, so a resend that arrives while this one is still saving does not save them twice.
    var withId = answers.filter(function (ev) { return ev.id; });
    var done = withId.length ? cache.getAll(withId.map(evKey)) : {};
    fresh = answers.filter(function (ev) { return !ev.id || !done[evKey(ev)]; });
    var claim = {};
    fresh.forEach(function (ev) { if (ev.id) claim[evKey(ev)] = '1'; });
    try { if (Object.keys(claim).length) cache.putAll(claim, 21600); } catch (err) { /* only used to skip resent answers */ }
    var touched = {};
    try {
      var known = {};
      if (fresh.length) readDeckBoardsFor_(deckId).forEach(function (b) { known[b.id] = b; });
      var missing = fresh.some(function (ev) { var t = clean_(ev.task, 120); return t && !known[deckBoardId_(deckId, t)]; });
      if (missing) {
        // A question the deck did not describe (decks with the bridge describe them all): its board is
        // made once, inside the lock, so two students answering it at the same moment do not make two.
        withLock_(function () {
          known = {};
          readDeckBoardsFor_(deckId).forEach(function (b) { known[b.id] = b; });
          var newBoards = [];
          fresh.forEach(function (ev) {
            var taskId = clean_(ev.task, 120);
            if (!taskId) return;
            var id = deckBoardId_(deckId, taskId);
            if (known[id]) return;
            var info = (lb.questions || {})[taskId] || {};
            var stub = deckStub_(deckId, taskId, info.question || taskId, info.kind || 'written');
            if (info.question) {
              stub.kind = ['choice', 'number', 'written'].indexOf(info.kind) >= 0 ? info.kind : 'written';
              stub.columns = (info.options || []).map(function (o) { return clean_(o, 200); }).filter(String).slice(0, 12);
              stub.correct = clean_(info.correct, 300); stub.model = clean_(info.model, 1200); stub.unit = clean_(info.unit, 20);
              stub.slideNo = Number(info.slideNo) || 0; stub.slideTitle = clean_(info.slideTitle, 200);
              stub.order = info.order == null ? 9999 : Number(info.order);
            }
            known[id] = stub; newBoards.push(stub);
          });
          saveDeckRows_(deckId, d.course, newBoards, [], lb.deckTitle);
        }, 15000);
      }
      var rows = [];
      fresh.forEach(function (ev) {
        var taskId = clean_(ev.task, 120);
        if (!taskId) return;
        var id = deckBoardId_(deckId, taskId);
        rows.push(postRowFromDeck_(known[id], who, ev.answer, ev.at, ev.correct));
        touched[id] = true;
      });
      appendPosts_(rows);
      if (fresh.length) {
        var sc = scoreChapterCheck_(deckId, who, fresh);
        if (sc) { checkRes = sc.result; award = sc.award; }
      }
    } catch (err) {
      // Not saved (or not scored): let the deck send these again.
      try { cache.removeAll(Object.keys(claim)); } catch (e2) { /* the claims run out in 6 hours */ }
      throw err;
    }
    Object.keys(touched).forEach(bump_);
    if (counts && lessonCtl.lesson && lessonCtl.hold && !lessonCtl.keep) { try { autoReleaseAnswered_(deckId, who.cls, Object.keys(touched)); } catch (err) { /* shown when the teacher moves on */ } }
  }
  if (who.matched && (fresh.length || visits)) {
    try { updateProgress_(deckId, who, d, fresh, lb); } catch (err) {
      // Pages seen catch up with the next batch; first tries are worked out again from the Posts tab.
      try { if (fresh.length) refillMistakes_(deckId, who.cls); } catch (e2) { /* nothing more to do */ }
    }
  }
  if (award) checkRes = finishAward_(award, checkRes);
  return {
    ok: true, course: d.course, topicId: d.topicId, recordId: d.recordId,
    acceptedIds: d.events.map(function (ev) { return ev && ev.id; }),
    receivedAt: new Date().toISOString(),
    liveBoard: checkRes ? { check: checkRes, revision: !counts } : { revision: !counts }
  };
}

function receiveSingle_(d) {
  return { ok: false, error: 'This lesson is out of date. Open it again from learnwithmrcedric.' };
}
function receiveSingleOld_(d) {
  var deckId = clean_(d.deck || 'deck', 120);
  var taskId = clean_(d.qid || d.question, 120);
  ensureDeckTabs_();
  var who = matchStudent_(d.cls, d.name);
  withLock_(function () {
    var id = deckBoardId_(deckId, taskId);
    var board = null;
    readDeckBoardsFor_(deckId).forEach(function (b) { if (b.id === id) board = b; });
    var newBoards = [];
    if (!board) { board = deckStub_(deckId, taskId, d.question || taskId, 'written'); newBoards.push(board); }
    saveDeckRows_(deckId, '', newBoards, [postRowFromDeck_(board, who, d.answer, '', null)]);
    bump_(id);
  });
  return { ok: true };
}

/* Writes rows under the last one, adding rows to the tab first when it is full
   (a new tab has 1000 rows, and setValues does not add any). */
function writeBelow_(sh, rows, width) {
  if (!rows.length) return;
  var start = sh.getLastRow() + 1, extra = start + rows.length - 1 - sh.getMaxRows();
  if (extra > 0) sh.insertRowsAfter(sh.getMaxRows(), extra);
  sh.getRange(start, 1, rows.length, width).setValues(rows);
}
function ensureRows_(sh, lastRow) {
  if (lastRow > sh.getMaxRows()) sh.insertRowsAfter(sh.getMaxRows(), lastRow - sh.getMaxRows());
}

function saveDeckRows_(deckId, course, newBoards, rows, deckTitle) {
  if (newBoards.length) {
    var dq = sheet_(TAB.deckq);
    writeBelow_(dq, newBoards.map(deckBoardToRow_), DECKQ_COLS.length);
    forgetDeckBoards_(deckId);
    if (!findDeck_(deckId)) {
      sheet_(TAB.decks).appendRow([deckId, clean_(deckTitle || deckId, 200), clean_(course, 80), 0, '', '', '', '']);
      CacheService.getScriptCache().remove('decks');
    }
  }
  appendPosts_(rows);
}

/* Adds answers at the bottom of the Posts tab. appendRow is safe when many students save at the same
   moment, so answers need no lock. Every write to Posts adds rows this way, never at a row worked out
   beforehand, so nothing can be written over. */
function appendPosts_(rows) {
  if (!rows || !rows.length) return;
  liveTally_(rows);
  var sh = sheet_(TAB.posts);
  rows.forEach(function (r) { sh.appendRow(r); });
}

/* ------------------------------------------------------------------ */
/* Live tally: answers counted the moment they arrive                   */
/* ------------------------------------------------------------------ */
/* Each deck answer also goes into the cache as one small entry per student and question (their first
   try), and a change stamp for the deck and class is moved on. The phone waits on that stamp
   (apiPhoneWait) and counts a slide's answers from these entries, so it never has to read the whole
   Posts tab while a lesson is running. The Posts tab stays the record: a slide's entries are rebuilt
   from it when they are missing, and again every 10 minutes in case the cache dropped any. */
function hash_(s) {
  s = String(s);
  var h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (var i = 0; i < s.length; i++) {
    var ch = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761); h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (h2 >>> 0).toString(36) + (h1 >>> 0).toString(36);
}
function tallyKey_(boardId, cls, name) { return 'ta_' + hash_(boardId + '|' + normClass_(cls) + '|' + normName_(name)); }
function tallyReadyKey_(boardId, cls) { return 'tr_' + hash_(boardId + '|' + normClass_(cls)); }
function liveVerKey_(deckId, cls) { return 'tv_' + hash_(deckId + '|' + normClass_(cls)); }
function tallyEntry_(r) {
  var t = r[2] ? new Date(r[2]).getTime() : Date.now();
  return JSON.stringify({ t: t || Date.now(), x: String(r[7] == null ? '' : r[7]).slice(0, 200), ok: r[12] === '' || r[12] == null ? null : bool_(r[12]) });
}
function liveTally_(rows) {
  try {
    var cache = CacheService.getScriptCache(), want = {}, put = {}, stamp = Date.now() + '.' + Math.floor(Math.random() * 1e6);
    rows.forEach(function (r) {
      var bid = String(r[1] || '');
      if (bid.indexOf('D:') !== 0) return;
      var k = tallyKey_(bid, r[3], r[5]);
      if (!want[k]) want[k] = tallyEntry_(r);
      put[liveVerKey_(bid.slice(2, bid.indexOf(':', 2)), r[3])] = stamp;
    });
    var keys = Object.keys(want);
    if (!keys.length) return;
    var have = cache.getAll(keys);
    keys.forEach(function (k) { if (have[k] == null) put[k] = want[k]; });   // keep the first try
    cache.putAll(put, 21600);
  } catch (err) {
    /* the phone falls back to reading the Posts tab */
  }
}
/* A slide's answers from the cache, or null when they have to be read from the Posts tab. */
function slideTallyFast_(qs, cls, roster) {
  var cache = CacheService.getScriptCache();
  var ready = cache.getAll(qs.map(function (b) { return tallyReadyKey_(b.id, cls); }));
  if (qs.some(function (b) { return !ready[tallyReadyKey_(b.id, cls)]; })) return null;
  var keys = [], map = {};
  qs.forEach(function (b) {
    roster.forEach(function (s) { var k = tallyKey_(b.id, cls, s.name); keys.push(k); map[k] = [b.id, normName_(s.name)]; });
  });
  var got = keys.length ? cache.getAll(keys) : {}, byQ = {};
  qs.forEach(function (b) { byQ[b.id] = { first: {}, any: {} }; });
  Object.keys(got).forEach(function (k) {
    var m = map[k], e = null;
    try { e = JSON.parse(got[k]); } catch (err) { e = null; }
    if (!m || !e) return;
    byQ[m[0]].any[m[1]] = true;
    byQ[m[0]].first[m[1]] = { t: e.t, text: e.x, ok: e.ok };
  });
  return byQ;
}
/* After reading a slide from the Posts tab, keep it in the cache so the next look is quick. */
function primeTally_(qs, cls, byQ) {
  try {
    var put = {};
    qs.forEach(function (b) {
      var q = byQ[b.id];
      Object.keys(q.first).forEach(function (k) {
        var f = q.first[k];
        put[tallyKey_(b.id, cls, k)] = JSON.stringify({ t: f.t, x: String(f.text).slice(0, 200), ok: f.ok });
      });
    });
    CacheService.getScriptCache().putAll(put, 21600);
    var ready = {};
    qs.forEach(function (b) { ready[tallyReadyKey_(b.id, cls)] = '1'; });
    CacheService.getScriptCache().putAll(ready, 600);
  } catch (err) {
    /* read from the tab again next time */
  }
}

/* The phone's update call. It waits (up to maxMs, at most 25 seconds) until something it shows has
   changed: a new answer in this lesson and class, a change to Pause, Follow or the other controls, or the
   slide you are on. Then it answers at once with the controls, your slide and that slide's answers.
   With maxMs 0 it only says whether anything changed. */
function apiPhoneWait(pin, deckId, cls, n, sig, maxMs) {
  checkPin_(pin);
  deckId = clean_(deckId, 120);
  var cache = CacheService.getScriptCache();
  var keys = [liveVerKey_(deckId, cls), ctlKey_(deckId, cls), leadKey_(deckId, cls)];
  var end = Date.now() + Math.max(0, Math.min(Number(maxMs) || 0, 25000)), cur = '';
  while (true) {
    var got = cache.getAll(keys), ld = liveLead_(got[keys[2]]);
    cur = [got[keys[0]] || '-', hash_(got[keys[1]] || ''), ld ? ld.n : 0].join('|');
    if (cur !== sig || Date.now() >= end) break;
    Utilities.sleep(350);
  }
  if (cur === sig) return { sig: cur, changed: false };
  var c = getCtl_(deckId, cls), lead = liveLead_(cache.get(keys[2]));
  var at = Math.round(Number(n) || 0) || (lead ? lead.n : 0), show = questionSlideFor_(deckId, at);
  var slide = show ? apiSlideNow(pin, deckId, cls, show) : null;
  if (slide) slide.at = at;
  return { sig: cur, changed: true, ctl: c, lead: lead, slide: slide };
}

/* The slide whose questions the phone shows: the last slide with questions at or before slide n, so the
   answers stay in view while the teacher explains on the slides after a question. */
function questionSlideFor_(deckId, n) {
  n = Math.round(Number(n) || 0);
  if (!n) return 0;
  var best = 0;
  readDeckBoardsFor_(deckId).forEach(function (b) { if (b.slideNo && b.slideNo <= n && b.slideNo > best) best = b.slideNo; });
  return best || n;
}

/* The phone's On task card, from the iPads' check-ins only (no sheet is read), so it can ask every few
   seconds. Each student is one of: with you (in the lesson, at most one slide behind your slide), behind,
   off the slides (left for another app or tab, locked the screen, or stopped checking in), not in (no
   check-in in the last 30 minutes) or absent. Names that need you, most urgent first: off the slides,
   wrong several times, stuck on a slide, behind, two iPads on one name, an old copy of the lesson. */
function apiPhoneRoom(pin, deckId, cls) {
  checkPin_(pin);
  deckId = clean_(deckId, 120);
  var roster = readRoster_()[cls] || [], cache = CacheService.getScriptCache();
  var keys = roster.map(function (s) { return pulseStudentKey_(deckId, cls, s.name); });
  var lk = leadKey_(deckId, cls), ck = ctlKey_(deckId, cls);
  var got = cache.getAll(keys.concat([lk, ck]));
  var lead = liveLead_(got[lk]), c = getCtl_(deckId, cls, got[ck], got[lk] || null);
  // In a lesson the iPads check every 3 seconds, so 15 seconds of silence means the iPad has gone.
  var gone = c.pause || c.follow || c.hold || lead ? 15000 : 40000, now = Date.now();
  var set = lessonSettings_(), wrong = {}, titles = null;
  try { wrong = wrongTries_(deckId, cls); } catch (err) { wrong = {}; }
  var absent = readAbsent_(cls);
  var mins = function (ms) { var m = Math.floor(ms / 60000); return m < 1 ? 'just now' : m + ' min'; };
  var out = { now: now, lead: lead ? lead.n : 0, follow: !!c.follow, total: 0, withYou: 0, behind: 0, off: 0,
    notIn: [], absent: [], flags: [], slides: {} };
  roster.forEach(function (s, i) {
    var k = normName_(s.name);
    if (absent.indexOf(k) >= 0) { out.absent.push(s.name); return; }
    out.total++;
    var x = null;
    try { x = got[keys[i]] ? JSON.parse(got[keys[i]]) : null; } catch (err) { x = null; }
    if (!x || now - x.at > 30 * 60000) { out.notIn.push(s.name); return; }
    var here = Number(x.slide) || 0;
    if (x.away || now - x.at > gone) {
      out.off++;
      out.flags.push({ name: s.name, k: 'off', slide: here,
        t: x.away ? 'Left the slides · ' + mins(now - (x.awayAt || now)) : 'Screen off or closed · ' + mins(now - x.at) });
      return;
    }
    if (here) out.slides[here] = (out.slides[here] || 0) + 1;
    if (lead && here && here < lead.n - 1) {
      out.behind++;
      out.flags.push({ name: s.name, k: 'behind', slide: here, t: 'On slide ' + here + ' · you are on ' + lead.n });
    } else out.withYou++;
    var w = wrong[k] || {};
    Object.keys(w).forEach(function (t) {
      if (w[t] < set.wrongTries) return;
      if (!titles) { titles = {}; readDeckBoardsFor_(deckId).forEach(function (b) { titles[b.taskId] = b.title; }); }
      out.flags.push({ name: s.name, k: 'wrong', slide: here, t: 'Wrong ' + w[t] + ' times · ' + String(titles[t] || t).slice(0, 48) });
    });
    if ((x.on || 0) >= set.stuckMins * 60) out.flags.push({ name: s.name, k: 'stuck', slide: here, t: 'Slide ' + here + ' for ' + Math.floor(x.on / 60) + ' min' });
  });
  // Each student's iPad (for Reset this iPad on the phone), and students waiting to be let in.
  out.devs = {};
  roster.forEach(function (s, i) { var x = null; try { x = got[keys[i]] ? JSON.parse(got[keys[i]]) : null; } catch (err) { x = null; } if (x && x.dev) out.devs[s.name] = x.dev; });
  out.help = gateHelpAll_();
  try { out.newPins = newPins_(cls); } catch (err) { out.newPins = []; }
  out.names = roster.map(function (s) { return s.name; });
  var order = { off: 0, wrong: 1, stuck: 2, behind: 3, two: 4, old: 5 };
  out.flags.sort(function (a, b) { return order[a.k] - order[b.k]; });
  // The slide most of the class is on (for the questions, when you are not presenting).
  var top = 0;
  Object.keys(out.slides).forEach(function (n) { if (!top || out.slides[n] > out.slides[top]) top = Number(n); });
  out.top = top;
  delete out.slides;
  return out;
}

function readDecks_() {
  var cache = CacheService.getScriptCache();
  var hit = cache.get('decks');
  if (hit) return JSON.parse(hit);
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(TAB.decks);
  var out = [];
  if (sh && sh.getLastRow() > 1) {
    sh.getRange(2, 1, sh.getLastRow() - 1, DECK_COLS.length).getValues().forEach(function (r) {
      if (r[0]) out.push({ id: String(r[0]), title: String(r[1] || r[0]), course: String(r[2] || ''),
        questions: Number(r[3]) || 0, connected: r[4] ? new Date(r[4]).getTime() : 0, link: String(r[5] || ''),
        check: idList_(r[6]), picks: idList_(r[7]) });
    });
  }
  cachePut_('decks', JSON.stringify(out), 600);
  return out;
}

function idList_(v) { return String(v || '').split(',').map(function (x) { return x.trim(); }).filter(String); }

/* Row number (2 and up) of a deck in the Decks tab, or -1. */
function deckRow_(deckId) {
  var sh = sheet_(TAB.decks);
  var ids = sh.getLastRow() > 1 ? sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues() : [];
  for (var i = 0; i < ids.length; i++) if (String(ids[i][0]) === deckId) return i + 2;
  return -1;
}

function findDeck_(deckId) {
  var list = readDecks_();
  for (var i = 0; i < list.length; i++) if (list[i].id === deckId) return list[i];
  return null;
}

/* Called by the teacher page after it reads a deck file.
   deck: { id, title, course, tasks: [{ id, question, kind, options, correct, model, unit, slideNo, slideTitle }] } */
function apiRegisterDeck(pin, deck) {
  checkPin_(pin);
  var endpoint = savedExecUrl_();
  if (!endpoint) throw new Error('Set the web app link first. In the sheet, click Live Board > 4. Change the web app link.');
  var deckId = clean_(deck && deck.id, 120);
  if (!deckId) throw new Error('This deck has no topic ID, so it cannot be connected.');
  ensureDeckTabs_();
  return withLock_(function () {
    var count = registerDeck_(deckId, deck.title, deck.course, deck.tasks || [], Array.isArray(deck.check) ? deck.check : null);
    if (Array.isArray(deck.slides) && deck.slides.length) saveDeckSlides_(deckId, { slides: deck.slides, dom: deck.dom, domT: deck.domT, lessons: deck.lessons }, 'file');
    if (/^https:\/\//.test(String(deck.link || ''))) writeDeckLink_(deckId, clean_(deck.link, 500));
    return { endpoint: endpoint, questions: count, classes: Object.keys(readRoster_()).sort() };
  });
}

/* Writes a deck's questions into the Deck questions tab, keeping any settings
   already chosen for them, and records the deck in the Decks tab. Call inside the lock. */
function registerDeck_(deckId, title, course, taskList, checkIds) {
    var tasks = (taskList || []).slice(0, 600);
    var dq = sheet_(TAB.deckq);
    var n = dq.getLastRow() - 1;
    var rows = n > 0 ? dq.getRange(2, 1, n, DECKQ_COLS.length).getValues() : [];
    var at = {};
    rows.forEach(function (r, i) { at[String(r[0])] = i; });
    tasks.forEach(function (t, i) {
      var taskId = clean_(t.id, 120);
      if (!taskId) return;
      var id = deckBoardId_(deckId, taskId);
      var b = at[id] !== undefined ? rowToDeckBoard_(rows[at[id]]) : deckStub_(deckId, taskId, '', t.kind);
      b.title = clean_(t.question || taskId, 300);
      b.kind = ['choice', 'number', 'written'].indexOf(t.kind) >= 0 ? t.kind : 'written';
      b.columns = (t.options || []).map(function (o) { return clean_(o, 200); }).filter(String).slice(0, 12);
      b.correct = clean_(t.correct, 300);
      b.model = clean_(t.model, 1200);
      b.unit = clean_(t.unit, 20);
      b.slideNo = Number(t.slideNo) || 0;
      b.slideTitle = clean_(t.slideTitle, 200);
      b.order = i;
      var row = deckBoardToRow_(b);
      if (at[id] !== undefined) rows[at[id]] = row; else { at[id] = rows.length; rows.push(row); }
    });
    if (rows.length) { ensureRows_(dq, rows.length + 1); dq.getRange(2, 1, rows.length, DECKQ_COLS.length).setValues(rows); }
    forgetDeckBoards_(deckId);

    var dk = sheet_(TAB.decks);
    if (!dk.getRange(1, 6).getValue()) dk.getRange(1, 6).setValue('Link for students').setFontWeight('bold');
    var old = findDeck_(deckId);
    var known = {};
    tasks.forEach(function (t) { known[clean_(t.id, 120)] = true; });
    var check = (checkIds || (old && old.check) || []).map(function (x) { return clean_(x, 120); }).filter(function (x) { return known[x]; });
    var picks = (old ? old.picks : []).filter(function (x) { return known[x]; });
    var drow = [deckId, clean_(title, 200) || deckId, clean_(course, 80), tasks.length, new Date(), old ? old.link : '',
      check.join(', '), picks.join(', ')];
    var ids = dk.getLastRow() > 1 ? dk.getRange(2, 1, dk.getLastRow() - 1, 1).getValues() : [];
    var found = -1;
    ids.forEach(function (r, i) { if (String(r[0]) === deckId) found = i; });
    if (found >= 0) dk.getRange(found + 2, 1, 1, DECK_COLS.length).setValues([drow]); else dk.appendRow(drow);
    CacheService.getScriptCache().remove('decks');
    bump_('deck_' + deckId);
    return tasks.length;
}

function apiDeckEndpoint(pin) {
  checkPin_(pin);
  return { endpoint: savedExecUrl_(), classes: Object.keys(readRoster_()).sort() };
}

/* Questions of one deck, in deck order, with how many students in each class answered. */
function apiDeckView(pin, deckId) {
  checkPin_(pin);
  var deck = findDeck_(deckId) || { id: deckId, title: deckId };
  var prefix = 'D:' + deckId + ':';
  var qs = readDeckBoardsFor_(deckId).slice()
    .sort(function (a, b) { return (a.slideNo || 9999) - (b.slideNo || 9999) || a.order - b.order || a.title.localeCompare(b.title); });
  var answered = {};   // boardId -> { cls: {name:true} }
  var firsts = {};     // boardId|cls|name -> the student's first answer { t, text, correct }
  var seenClasses = {};
  var deckRows = postRows_('pd_' + deckId, function (r) { return r[0] && String(r[1]).indexOf(prefix) === 0; }).rows;
  if (deckRows.length) {
    deckRows.map(function (r) { return r.slice(1, 13); }).forEach(function (r) {
      var id = String(r[0]);
      if (id.indexOf(prefix) !== 0) return;
      var cls = String(r[2]);
      seenClasses[cls] = true;
      var a = answered[id] = answered[id] || {};
      (a[cls] = a[cls] || {})[normName_(r[4])] = true;
      var t = r[1] ? new Date(r[1]).getTime() : 0, k = id + '|' + cls + '|' + normName_(r[4]);
      if (!firsts[k] || t < firsts[k].t) firsts[k] = { t: t, text: String(r[6] || ''), correct: r[11] === '' || r[11] == null ? null : bool_(r[11]) };
    });
  }
  // First-try results per question and class, for the re-teach list.
  var stats = {};
  Object.keys(firsts).forEach(function (k) {
    var f = firsts[k];
    if (f.correct === null) return;
    var parts = k.split('|'), id = parts[0], cls = parts[1];
    var st = (stats[id] = stats[id] || {})[cls] = (stats[id] || {})[cls] || { n: 0, right: 0, wrong: {} };
    st.n++;
    if (f.correct) st.right++; else { var w = f.text.slice(0, 120); st.wrong[w] = (st.wrong[w] || 0) + 1; }
  });
  var roster = readRoster_();
  var classes = Object.keys(roster).filter(function (c) { return c !== 'TEST'; });
  Object.keys(seenClasses).forEach(function (c) { if (classes.indexOf(c) < 0) classes.push(c); });
  classes.sort();
  var sizes = {}, names = {};
  classes.forEach(function (c) {
    sizes[c] = (roster[c] || []).length;
    names[c] = (roster[c] || []).map(function (x) { return x.name; });
  });
  var rules = checkRules_();
  var checks = readChecks_().filter(function (c) { return c.deckId === deckId; }).map(function (c) {
    return { cls: c.cls, name: c.name, first: c.first, firstScore: c.firstScore, best: c.best, tries: c.tries,
      points: c.points, note: c.note, passed: qualifies_(c, rules) };
  });
  return {
    deck: deck,
    classes: classes,
    sizes: sizes,
    names: names,
    check: { rules: rules, marked: deck.check ? checkMarked_(deck).length : 0, results: checks },
    questions: qs.map(function (b) {
      var counts = {};
      var a = answered[b.id] || {};
      Object.keys(a).forEach(function (c) { counts[c] = Object.keys(a[c]).length; });
      var fs = {};
      Object.keys(stats[b.id] || {}).forEach(function (c) {
        var st = stats[b.id][c];
        var wrong = Object.keys(st.wrong).map(function (w) { return [w, st.wrong[w]]; }).sort(function (x, y) { return y[1] - x[1]; }).slice(0, 2);
        fs[c] = { n: st.n, right: st.right, wrong: wrong };
      });
      return { id: b.id, taskId: b.taskId, title: b.title, kind: b.kind, slideNo: b.slideNo, slideTitle: b.slideTitle, counts: counts, model: b.model || '',
        first: fs, correct: b.correct, options: b.kind === 'choice' ? b.columns : [] };
    })
  };
}

/* Saves a connected copy of a deck to Drive, for when the browser cannot download it. */
function apiSaveDeckCopy(pin, fileName, html) {
  checkPin_(pin);
  var id = getSetting_('Deck folder ID');
  var folder = null;
  if (id) { try { folder = DriveApp.getFolderById(id); } catch (err) { folder = null; } }
  if (!folder) { folder = DriveApp.createFolder('Live Board decks'); setSetting_('Deck folder ID', folder.getId()); }
  var name = clean_(fileName, 150) || 'Connected deck.html';
  var file = folder.createFile(Utilities.newBlob(html, 'text/html', name));
  return { url: file.getUrl(), name: name };
}

/* ------------------------------------------------------------------ */
/* Linking: the student home, deck links and the name lock            */
/* ------------------------------------------------------------------ */

/* The first deck link a deck reports (its GitHub Pages address) is kept, so the
   student home can list it under Lessons. A link typed into the Decks tab wins. */
function rememberDeckLink_(deckId, url) {
  var d = findDeck_(deckId);
  if (!d || d.link) return;
  withLock_(function () {
    var sh = sheet_(TAB.decks);
    var ids = sh.getLastRow() > 1 ? sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues() : [];
    for (var i = 0; i < ids.length; i++) {
      if (String(ids[i][0]) === deckId) {
        var cell = sh.getRange(i + 2, 6);
        if (!cell.getValue()) cell.setValue(url);
        break;
      }
    }
    CacheService.getScriptCache().remove('decks');
  });
}

/* The link a lesson was put online at (Lessons > Add or update a lesson). Call inside the lock. */
function writeDeckLink_(deckId, url) {
  var sh = sheet_(TAB.decks);
  var ids = sh.getLastRow() > 1 ? sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues() : [];
  for (var i = 0; i < ids.length; i++) {
    if (String(ids[i][0]) === deckId) { sh.getRange(i + 2, 6).setValue(url); break; }
  }
  CacheService.getScriptCache().remove('decks');
}

/* ------------------------------------------------------------------ */
/* The lesson site (GitHub Pages) and its list of lessons              */
/* ------------------------------------------------------------------ */
/* lessons.json on the lesson site lists every lesson: subject tabs, chapters, numbers and titles. The
   site's index page, learnwithmrcedric and the Lessons tab all read it. Lessons > Add or update a lesson puts a
   deck online and updates the list in one step, straight from the teacher's browser to GitHub, using a
   GitHub key saved once in Script Properties. */
var DEFAULT_REPO = 'cedricboi/science-decks';
function ghConf_() {
  var p = PropertiesService.getScriptProperties();
  return { repo: p.getProperty('GH_REPO') || '', token: p.getProperty('GH_TOKEN') || '', branch: p.getProperty('GH_BRANCH') || 'main' };
}
function siteFor_(repo) {
  var m = String(repo || DEFAULT_REPO).match(/^([^\/]+)\/(.+)$/);
  if (!m) return '';
  var owner = m[1].toLowerCase(), name = m[2];
  return name.toLowerCase() === owner + '.github.io' ? 'https://' + owner + '.github.io/' : 'https://' + owner + '.github.io/' + name + '/';
}
function lessonSite_() { return siteFor_(ghConf_().repo || DEFAULT_REPO); }
function ghFetch_(path, token) {
  return UrlFetchApp.fetch('https://api.github.com' + path, {
    muteHttpExceptions: true,
    headers: { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' }
  });
}
/* Saves the GitHub key after checking it can see the repository. */
function apiGithubSave(pin, repo, token) {
  checkPin_(pin);
  repo = String(repo || '').trim().replace(/^https:\/\/github\.com\//, '').replace(/\.git$/, '').replace(/\/+$/, '');
  token = String(token || '').trim();
  if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) throw new Error('Type the repository as name/repository, for example cedricboi/science-decks.');
  if (token.length < 20) throw new Error('That does not look like a GitHub key. Copy the whole key, it starts with github_pat_.');
  var res = ghFetch_('/repos/' + repo, token), code = res.getResponseCode();
  if (code === 401) throw new Error('GitHub did not accept that key. Make a new one and paste the whole key.');
  if (code === 404 || code === 403) throw new Error('That key cannot see ' + repo + '. When making the key, choose Only select repositories and pick ' + repo.split('/')[1] + '.');
  if (code !== 200) throw new Error('GitHub answered ' + code + '. Try again in a minute.');
  var info = JSON.parse(res.getContentText());
  var p = PropertiesService.getScriptProperties();
  p.setProperty('GH_REPO', info.full_name || repo);
  p.setProperty('GH_TOKEN', token);
  p.setProperty('GH_BRANCH', info.default_branch || 'main');
  CacheService.getScriptCache().remove('catalog');
  return { ok: true, repo: info.full_name || repo, site: siteFor_(info.full_name || repo) };
}
/* The key goes to the teacher page only, after the PIN, so the browser can send the deck to GitHub itself
   (a deck is too big to pass through Apps Script). */
function apiGithubGet(pin) {
  checkPin_(pin);
  var g = ghConf_();
  return { repo: g.repo, token: g.token, branch: g.branch, site: siteFor_(g.repo || DEFAULT_REPO), liveboard: savedExecUrl_() };
}
function apiGithubForget(pin) {
  checkPin_(pin);
  var p = PropertiesService.getScriptProperties();
  p.deleteProperty('GH_TOKEN');
  return { ok: true };
}
/* The list of lessons, read from the lesson site and kept for 5 minutes. */
function catalog_() {
  var cache = CacheService.getScriptCache(), hit = cache.get('catalog');
  if (hit) { try { return JSON.parse(hit); } catch (err) { /* read again */ } }
  var site = lessonSite_(), cat = null;
  if (!site) return null;
  try {
    var res = UrlFetchApp.fetch(site + 'lessons.json?t=' + Date.now(), { muteHttpExceptions: true, followRedirects: true });
    if (res.getResponseCode() === 200) cat = JSON.parse(res.getContentText());
  } catch (err) {
    cat = null;
  }
  if (cat && Array.isArray(cat.subjects)) { cat.site = site; cachePut_('catalog', JSON.stringify(cat), 300); return cat; }
  return null;
}
function apiCatalog(pin) {
  checkPin_(pin);
  var g = ghConf_();
  return { catalog: catalog_(), site: lessonSite_(), github: { repo: g.repo || DEFAULT_REPO, connected: !!(g.repo && g.token) } };
}
/* After a lesson is put online the new list is used at once (GitHub takes about a minute to show it). */
function apiCatalogSet(pin, cat) {
  checkPin_(pin);
  if (!cat || !Array.isArray(cat.subjects)) throw new Error('Not a list of lessons.');
  cat.site = lessonSite_();
  cachePut_('catalog', JSON.stringify(cat), 600);
  return { ok: true };
}
/* learnwithmrcedric: every lesson on the site by subject and chapter. Lessons connected to Live Board carry this
   student's progress; older decks are plain links. */
function studentCatalog_(lessons) {
  var cat = catalog_();
  if (!cat) return null;
  var byId = {}, byLink = {};
  lessons.forEach(function (l) { byId[l.id] = l; if (l.url) byLink[String(l.url).replace(/[?#].*$/, '')] = l; });
  return { site: cat.site, subjects: (cat.subjects || []).map(function (s) {
    return { id: s.id, name: s.name, color: s.color, groups: (s.groups || []).map(function (g) {
      return { name: g.name, items: (g.items || []).map(function (it) {
        var url = cat.site + it.file, mine = (it.topicId && byId[it.topicId]) || byLink[url] || null;
        return { file: it.file, num: it.num, title: it.title, kind: it.kind || 'deck', url: url, id: mine ? mine.id : (it.topicId || ''), live: !!(mine || it.live), open: !!mine };
      }).filter(function (it) { return it.open || it.kind === 'tool'; }) };
    }).filter(function (g) { return g.items.length; }) };
  }).filter(function (s) { return s.groups.length; }) };
}
/* The lesson this student's class is having now (a lesson started on Live), if any. */
function runningLessonFor_(cls) {
  return runningFor_([cls])[cls] || null;
}
/* The phone: the lessons running now, newest first, so it opens on the one just started. */
function apiRunningLessons(pin) {
  checkPin_(pin);
  var classes = Object.keys(readRoster_()), run = runningFor_(classes);
  return Object.keys(run).map(function (c) { var r = run[c]; return { cls: c, deckId: r.id, title: r.title, lesson: r.lesson, at: r.at }; })
    .sort(function (a, b) { return b.at - a.at; });
}

/* ------------------------------------------------------------------ */
/* The Teacher Hub: signs in slides, Progress and Classes, Teach next */
/* ------------------------------------------------------------------ */
/* The Teacher Hub (signed in with the teacher's Google account) asks Live Board for a sign-in, so the slides,
   Progress, Classes and phone pairing open from the Hub without the PIN. The Hub proves itself with its own
   sheet ID, which Live Board already holds as its class list (Settings: Class list sheet ID), the same key
   Live Board uses when it asks the Hub for points. A sign-in lasts 12 hours. */
var TOKEN_HOURS = 12;
/* A short mark of the teacher PIN, kept with each sign-in: changing the PIN ends every sign-in at once. */
function pinMark_() {
  var cache = CacheService.getScriptCache(), real = cache.get('pin');
  if (!real) { real = getSetting_('Teacher PIN'); if (real) cache.put('pin', real, 120); }
  var s = 'pm|' + String(real || ''), h = 5381;
  for (var i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return 'p' + (h >>> 0).toString(16);
}
function tokenOk_(tk) {
  var cache = CacheService.getScriptCache(), mark = pinMark_();
  var seen = cache.get('tok_' + tk);
  if (seen) return seen === mark;
  var list = [];
  try { list = JSON.parse(PropertiesService.getScriptProperties().getProperty('tok_list') || '[]'); } catch (err) { list = []; }
  var hit = list.filter(function (t) { return t.tk === tk && t.until > Date.now(); })[0];
  if (hit && hit.p === mark) { cachePut_('tok_' + tk, mark, Math.min(21600, Math.floor((hit.until - Date.now()) / 1000))); return true; }
  return false;
}
/* The current sign-in, or a new one when it has less than 6 hours left. */
function hubToken_() {
  var props = PropertiesService.getScriptProperties(), list = [];
  try { list = JSON.parse(props.getProperty('tok_list') || '[]'); } catch (err) { list = []; }
  var now = Date.now(), mark = pinMark_();
  list = list.filter(function (t) { return t.until > now && t.p === mark; });
  var cur = list[list.length - 1];
  if (!cur || cur.until - now < 6 * 3600000) {
    cur = { tk: 'tk_' + Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '').slice(0, 8), until: now + TOKEN_HOURS * 3600000, p: mark };
    list.push(cur);
    list = list.slice(-6);
    props.setProperty('tok_list', JSON.stringify(list));
  }
  cachePut_('tok_' + cur.tk, mark, 21600);
  return cur;
}
function hubRequest_(d) {
  var id = getSetting_('Class list sheet ID');
  if (!id || String(d.key || '') !== String(id)) return { ok: false, error: 'Wrong key.' };
  // The homework space opens inside learnwithmrcedric with the student's sign-in, and the Hub checks it here.
  if (d.op === 'student') {
    var who = stCheck_(d.st);
    return who ? { ok: true, cls: who.cls, name: who.name } : { ok: true, signedOut: true };
  }
  if (d.op === 'classstate') { var cs = classState_(d.cls); cs.ok = true; return cs; }
  if (d.op === 'alloc') { setAllocOff_(d.cls, clean_(d.deckId, 120), !d.on); return { ok: true, alloc: setAlloc_(d.cls, d.deckId, !!d.on) }; }
  if (d.op === 'taught') return { ok: true, starts: taughtSince_(d.since), now: Date.now() };
  if (d.op === 'letin') return hubLetIn_(d);
  if (d.op === 'needs') return { ok: true, help: gateHelpAll_(), starts: d.since ? taughtSince_(d.since) : null };
  if (d.op === 'summary') return { ok: true, classes: hubSummary_() };
  var t = hubToken_();
  var out = { ok: true, token: t.tk, until: t.until, build: BUILD, site: lessonSite_() };
  if (d.op === 'teachnext') {
    var known = allDeckParts_();
    out.classes = teachNext_(known);
    out.parts = known;   // every lesson's parts, for the part picker on the Hub's Teach tab
    out.alloc = allocAll_();   // the lessons open to each class for revision
  }
  return out;
}

/* Every lesson's parts, from the Deck slides tab in one read: { deckId: { lessons: [{ t, from, to }], slides: n } }. */
function allDeckParts_(withDom) {
  var out = {}, sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SLIDE_TAB);
  if (sh && sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, 2).getValues().forEach(function (r) {
    try { var pg = JSON.parse(String(r[1])); out[String(r[0])] = { lessons: pg.lessons || [], slides: (pg.dom || []).length }; if (withDom) out[String(r[0])].dom = pg.dom || []; } catch (err) { /* skip */ }
  });
  return out;
}

/* Which lessons are running now, for each class: one read of the cache for every lesson and class. */
function runningFor_(classes) {
  var decks = readDecks_(), keys = [], cache = CacheService.getScriptCache(), props = null, out = {};
  classes.forEach(function (c) { decks.forEach(function (d) { keys.push(ctlKey_(d.id, c)); }); });
  var got = keys.length ? cache.getAll(keys) : {}, missed = {};
  classes.forEach(function (c) {
    decks.forEach(function (d) {
      var k = ctlKey_(d.id, c), raw = got[k];
      if (raw === undefined || raw === null) { props = props || PropertiesService.getScriptProperties().getProperties(); raw = props[k] || ''; missed[k] = raw || '{}'; }
      var ctl = parseCtl_(raw);
      if (!ctl.lesson) return;
      if (!out[c] || ctl.lesson.at > out[c].at) out[c] = { id: d.id, title: d.title, url: d.link, lesson: ctl.lesson.t, from: ctl.from || 0, to: ctl.to || 0, at: ctl.lesson.at || 0 };
    });
  });
  // What was read from the properties goes back in the cache, so the next check (every 12 seconds from learnwithmrcedric) reads none.
  if (props) { try { cache.putAll(missed, 21600); } catch (err) { /* read again next time */ } }
  // A lesson whose projector slides have gone ends by itself (one more cache read, for the lessons running now).
  var live = Object.keys(out);
  if (live.length) {
    var lk = cache.getAll(live.map(function (c) { return leadKey_(out[c].id, c); }));
    live.forEach(function (c) {
      var r = out[c], k = ctlKey_(r.id, c), ctl = parseCtl_(got[k] !== undefined && got[k] !== null ? got[k] : missed[k]);
      var alive = lastAlive_(r.id, c, ctl, lk[leadKey_(r.id, c)] || null);
      if (ctl.lesson && idleOver_(ctl, alive)) { endIdle_(r.id, c, ctl, alive); delete out[c]; }
    });
  }
  return out;
}

/* What each class did last (kept when a lesson starts, and the furthest slide the presenter reached). */
function lastTaughtKey_(cls) { return 'lt_' + normClass_(cls); }
function lastTaught_(cls) {
  try { return JSON.parse(PropertiesService.getScriptProperties().getProperty(lastTaughtKey_(cls)) || 'null'); } catch (err) { return null; }
}
function noteTaught_(deckId, cls, from, to, title) {
  PropertiesService.getScriptProperties().setProperty(lastTaughtKey_(cls),
    JSON.stringify({ deckId: deckId, t: clean_(title, 80), from: from || 0, to: to || 0, n: from || 1, at: Date.now() }));
}
function noteReached_(deckId, cls, n) {
  var cache = CacheService.getScriptCache(), k = 'ltw_' + normClass_(cls);
  if (cache.get(k)) return;
  cachePut_(k, '1', 60);
  var lt = lastTaught_(cls);
  if (!lt || lt.deckId !== deckId || n <= (lt.n || 0)) return;
  lt.n = n;
  PropertiesService.getScriptProperties().setProperty(lastTaughtKey_(cls), JSON.stringify(lt));
}

/* Teach next: for each class, the lesson running now, or the next part to teach. The next part is the module after
   the one taught last; after the last module (or a whole lesson taught to its end) it is the next lesson on the
   lesson site, in the same subject. */
function teachNextRaw_(known) {
  known = known || allDeckParts_();
  var memo = {};
  var classes = Object.keys(readRoster_()).filter(function (c) { return c !== 'TEST'; }).sort();
  var run = runningFor_(classes), decks = {}, cat = null;
  readDecks_().forEach(function (d) { decks[d.id] = d; });
  try { cat = catalog_(); } catch (err) { cat = null; }
  var order = [];   // every lesson on the site, in order, with its subject
  if (cat) (cat.subjects || []).forEach(function (sub) {
    (sub.groups || []).forEach(function (g) {
      (g.items || []).forEach(function (it) {
        if ((it.kind || 'deck') === 'deck' && it.topicId) order.push({ id: it.topicId, title: it.title, num: it.num, subject: sub.id, subjectName: sub.name, color: sub.color, url: cat.site + it.file, chapter: g.name });
      });
    });
  });
  var info = function (id) {
    var o = order.filter(function (x) { return x.id === id; })[0], d = decks[id];
    return { id: id, title: (o && o.title) || (d && d.title) || id, num: o ? o.num : '', subject: o ? o.subjectName : '', color: o ? o.color : '',
      chapter: o ? o.chapter : '', url: (o && o.url) || (d && d.link) || '' };
  };
  var parts = function (id) {
    if (memo[id]) return memo[id];
    if (known[id]) return (memo[id] = known[id]);
    var rec = null;
    try { rec = deckSlides_(id, 0); } catch (err) { rec = null; }
    return (memo[id] = { lessons: rec && rec.lessons ? rec.lessons : [], slides: rec && rec.dom ? rec.dom.length : 0 });
  };
  return classes.map(function (cls) {
    var out = { cls: cls, running: null, last: null, next: null };
    var r = run[cls];
    if (r) out.running = { deck: info(r.id), lesson: r.lesson, from: r.from, to: r.to, at: r.at };
    var lt = lastTaught_(cls);
    if (!lt || !lt.deckId) return out;
    var p = parts(lt.deckId), idx = -1;
    p.lessons.forEach(function (l, i) { if (l.from === lt.from && l.to === lt.to) idx = i; });
    out.last = { deck: info(lt.deckId), part: idx, t: lt.t, at: lt.at, reached: lt.n || 0 };
    if (idx >= 0 && idx + 1 < p.lessons.length) {
      var l = p.lessons[idx + 1];
      out.next = { deck: info(lt.deckId), part: idx + 1, t: l.t, from: l.from, to: l.to };
      return out;
    }
    if (idx < 0 && p.slides && (lt.n || 0) < p.slides - 2) {   // a whole lesson, not finished yet: carry on
      out.next = { deck: info(lt.deckId), part: -1, t: 'Carry on from slide ' + Math.max(1, lt.n || 1), from: 0, to: 0, carry: lt.n || 1 };
      return out;
    }
    var here = -1;
    order.forEach(function (x, i) { if (x.id === lt.deckId) here = i; });
    var nx = here >= 0 ? order.slice(here + 1).filter(function (x) { return x.subject === order[here].subject; })[0] : null;
    if (nx) {
      var np = parts(nx.id), first = np.lessons[0];
      out.next = { deck: info(nx.id), part: first ? 0 : -1, t: first ? first.t : 'The whole lesson', from: first ? first.from : 0, to: first ? first.to : 0 };
    }
    return out;
  });
}

/* Checks the teacher PIN for changing a locked name on an iPad. After ten wrong
   tries in ten minutes it refuses everything for the rest of those ten minutes. */
/* A short check value made from the register number, so the deck can confirm a name without the number
   itself being sent to every iPad. The bridge in the deck makes the same value. */
function regHash_(cls, name, reg) {
  var s = String(cls).toUpperCase().trim() + '|' + String(name).toLowerCase().replace(/\s+/g, ' ').trim() + '|' + String(reg).trim().replace(/^0+(?=\d)/, '');
  var h = 5381;
  for (var i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}
function apiUnlock(pin) {
  var cache = CacheService.getScriptCache(), fails = Number(cache.get('pin_fails_u') || 0);
  if (fails >= 20) return false;
  var real = cache.get('pin');
  if (!real) { real = getSetting_('Teacher PIN'); if (real) cache.put('pin', real, 120); }
  var ok = !!real && String(pin == null ? '' : pin).trim() === String(real);
  if (!ok) cache.put('pin_fails_u', String(fails + 1), 900);
  return ok;
}

/* Everything the student home page shows after sign-in. */
function apiStudentHome(st) {
  var me0 = stWho_(st), cls = me0.cls, name = me0.name;
  var boards = studentBoards_(cls, name), open = allocFor_(cls);
  var lessons = readDecks_().filter(function (d) { return /^https:\/\//.test(d.link) && open.indexOf(d.id) >= 0; })
    .sort(function (a, b) { return a.title.localeCompare(b.title, undefined, { numeric: true }); })
    .map(function (d) { return { title: d.title, url: d.link }; });
  var a = currentAsk_();
  var ask = a && /^https:\/\//.test(a.link || '') ? { question: a.question, deckTitle: a.deckTitle, url: a.link, taskId: a.taskId, at: a.at } : null;
  var now = null;
  try { now = runningLessonFor_(String(cls).toUpperCase()); } catch (err) { now = null; }
  return { boards: boards, lessons: lessons, hub: (getSetting_('Worksheet Hub link') || selfUrl_()), ask: ask, now: now, cls: cls, name: name };
}

/* ------------------------------------------------------------------ */
/* Chapter checks: automatic Worksheet Hub points                      */
/* ------------------------------------------------------------------ */
/* A deck's chapter check is the set of questions in its manifest's quizTasks.
   Students mark the whole set at once, so the deck sends all of them together.
   Each complete set is one try. The first try (or the best, if the Settings tab
   says so) at or above the pass mark gives Worksheet Hub points, once per deck. */

function settingsMap_() {
  var out = {};
  sheet_(TAB.settings).getDataRange().getValues().forEach(function (r) { out[String(r[0]).trim()] = String(r[1]).trim(); });
  return out;
}

function checkRules_(map) {
  map = map || settingsMap_();
  var pass = Number(String(map['Chapter check pass mark (%)'] || '').replace('%', ''));
  var pts = Number(map['Chapter check points']);
  var mode = String(map['Chapter check counts'] || 'First try').toLowerCase();
  return {
    pass: isNaN(pass) || pass <= 0 ? 80 : Math.min(100, pass),
    points: isNaN(pts) ? 30 : Math.round(pts),
    best: /best|any/.test(mode)
  };
}

function rememberCheck_(deckId, ids) {
  var d = findDeck_(deckId);
  if (!d || d.check.length) return;
  withLock_(function () {
    var r = deckRow_(deckId);
    if (r < 0) return;
    sheet_(TAB.decks).getRange(r, 7).setValue(ids.map(function (x) { return clean_(x, 120); }).join(', '));
    CacheService.getScriptCache().remove('decks');
  });
}

function rowToCheck_(r, i) {
  return { row: i + 2, deckId: String(r[0]), deck: String(r[1]), cls: String(r[2]), reg: String(r[3]), name: String(r[4]),
    first: r[5] === '' || r[5] == null ? null : Number(r[5]), firstScore: String(r[6] || ''),
    best: r[7] === '' || r[7] == null ? null : Number(r[7]), tries: Number(r[8]) || 0,
    last: r[9] ? new Date(r[9]).getTime() : 0, points: r[10] === '' || r[10] == null ? null : Number(r[10]),
    givenAt: r[11] ? new Date(r[11]).getTime() : 0, note: String(r[12] || '') };
}
function checkToRow_(c) {
  return [c.deckId, c.deck, c.cls, c.reg, c.name, c.first == null ? '' : c.first, c.firstScore,
    c.best == null ? '' : c.best, c.tries, c.last ? new Date(c.last) : '', c.points == null ? '' : c.points,
    c.givenAt ? new Date(c.givenAt) : '', c.note];
}
function readChecks_() {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(TAB.checks);
  if (!sh || sh.getLastRow() < 2) return [];
  return sh.getRange(2, 1, sh.getLastRow() - 1, CHECK_COLS.length).getValues()
    .map(rowToCheck_).filter(function (c) { return c.deckId; });
}
function writeCheck_(c) {
  CacheService.getScriptCache().remove('checks_' + normClass_(c.cls));
  var sh = sheet_(TAB.checks);
  if (!c.row && c.saved) c.row = checkRow_(sh, c);
  if (c.row) sh.getRange(c.row, 1, 1, CHECK_COLS.length).setValues([checkToRow_(c)]);
  else { sh.appendRow(checkToRow_(c)); c.saved = true; }
}
/* The row of a chapter check result added earlier in this run. Other students may have added rows
   at the same moment, so the row is looked up rather than assumed to be the last one. */
function checkRow_(sh, c) {
  var n = sh.getLastRow() - 1;
  if (n < 1) return 0;
  var keys = sh.getRange(2, 1, n, 5).getValues();
  for (var i = keys.length - 1; i >= 0; i--) {
    if (String(keys[i][0]) === c.deckId && normClass_(keys[i][2]) === normClass_(c.cls) && normName_(keys[i][4]) === normName_(c.name)) return i + 2;
  }
  return 0;
}

/* The marked questions of a deck's chapter check (written answers are not marked). */
function checkMarked_(deck) {
  var kind = {};
  readDeckBoardsFor_(deck.id).forEach(function (b) { kind[b.taskId] = b.kind; });
  return deck.check.filter(function (id) { return kind[id] && kind[id] !== 'written'; });
}

/* Splits chapter check answers into tries: one try is a full set sent within a few seconds. */
function checkTries_(events, marked) {
  var list = events.slice().sort(function (a, b) { return (Date.parse(a.at) || 0) - (Date.parse(b.at) || 0); });
  var groups = [], g = null;
  list.forEach(function (ev) {
    var t = Date.parse(ev.at) || Date.now();
    if (!g || t - g.end > 20000 || !!ev.assisted !== g.assisted || (ev.task in g.got)) { g = { start: t, end: t, assisted: !!ev.assisted, got: {} }; groups.push(g); }
    g.end = t;
    g.got[ev.task] = ev.correct;
  });
  return groups.filter(function (x) { return marked.every(function (id) { return id in x.got; }); }).map(function (x) {
    var score = marked.filter(function (id) { return x.got[id] === true; }).length;
    return { at: x.end, assisted: x.assisted, score: score, out: marked.length, pct: Math.round(100 * score / marked.length) };
  });
}

function scoreChapterCheck_(deckId, who, answers) {
  var deck = findDeck_(deckId);
  if (!deck || !deck.check.length) return;
  var inCheck = {};
  deck.check.forEach(function (id) { inCheck[id] = true; });
  var ev = answers.filter(function (e) { return inCheck[clean_(e.task, 120)]; });
  if (!ev.length) return;
  var marked = checkMarked_(deck);
  if (!marked.length) return;
  var tries = checkTries_(ev, marked);
  if (!tries.length) return;
  var rules = checkRules_();
  var result = null, award = null;
  (function () {
    var c = null;
    readChecks_().forEach(function (x) {
      if (x.deckId === deckId && normClass_(x.cls) === normClass_(who.cls) && normName_(x.name) === normName_(who.name)) c = x;
    });
    var changed = false, latest = null;
    tries.forEach(function (t) {
      if (c && c.last && Math.floor(t.at / 1000) <= Math.floor(c.last / 1000)) return;   // this try was counted already
      latest = t;
      if (!c) {
        c = { row: 0, deckId: deckId, deck: deck.title, cls: who.cls, reg: who.reg, name: who.name,
          first: t.assisted ? null : t.pct, firstScore: t.assisted ? '' : t.score + ' / ' + t.out,
          best: t.pct, tries: 0, last: 0, points: null, givenAt: 0, note: '' };
        if (t.assisted) c.note = 'The first try was made before this deck was connected.';
      }
      c.tries += 1;
      c.best = Math.max(c.best == null ? 0 : c.best, t.pct);
      c.last = t.at;
      changed = true;
    });
    if (!changed) return;
    var had = c.points != null;
    var due = !had && decideAward_(c, rules, who.matched);
    writeCheck_(c);
    if (due) award = { c: c, rules: rules };
    result = { pct: latest.pct, score: latest.score, out: latest.out, firstTry: c.tries === 1 && c.first != null,
      first: c.first, best: c.best, points: due ? c.points : 0, hadPoints: had, passMark: rules.pass,
      bestCounts: rules.best, worth: rules.points, note: due || had ? '' : c.note };
  })();
  return result ? { result: result, award: award } : null;
}

/* Decides whether a chapter check earns points now, and marks them as given (the caller writes the row,
   then adds the line to the Hub after the lock with finishAward_). */
function decideAward_(c, rules, onList) {
  if (!qualifies_(c, rules)) return false;
  if (!onList) { c.note = 'Not on the class list, so no points were given.'; return false; }
  if (!rules.points) { c.note = 'Chapter check points is 0 in the Settings tab.'; return false; }
  c.points = rules.points; c.givenAt = Date.now(); c.note = '';
  return true;
}

/* Adds the points to the Hub. If that fails, the row goes back to "not given" with the reason,
   so Live Board > 7 can give them later. */
function finishAward_(award, result) {
  var res;
  try { res = giveHubPoints_(award.c, award.rules); } catch (err) { res = { ok: false, note: 'Not given yet: ' + err.message }; }
  if (res.ok) return result;
  withLock_(function () {
    var c = award.c;
    c.points = null; c.givenAt = 0; c.note = res.note;
    writeCheck_(c);
  });
  if (result) { result.points = 0; result.note = res.note; }
  return result;
}

function qualifies_(c, rules) {
  var pct = rules.best ? c.best : c.first;
  return pct != null && pct >= rules.pass;
}

/* Gives the points if the try qualifies. Changes c; the caller writes it. */
function tryAward_(c, rules, onList) {
  if (!decideAward_(c, rules, onList)) return false;
  var res;
  try { res = giveHubPoints_(c, rules); } catch (err) { res = { ok: false, note: 'Not given yet: ' + err.message }; }
  if (res.ok) return true;
  c.points = null; c.givenAt = 0; c.note = res.note;
  return false;
}

/* Adds one line to the Worksheet Hub's Rewards log. The Hub counts it as earned points
   and shows the student the note. */
function giveHubPoints_(c, rules) {
  var title = shortTitle_(c.deck);
  var pct = rules.best ? c.best : c.first;
  return hubLog_(c, 'check:' + c.deckId, rules.points, title + ': chapter check ' + pct + '%');
}

function shortTitle_(t) { t = String(t || ''); return t.length > 48 ? t.slice(0, 46).replace(/\s+\S*$/, '') + '…' : t; }

/* Adds one line to the Worksheet Hub's Rewards log. who: { cls, reg, name }. */
var HUB_LOG_SH_ = null;   // the Hub's Rewards log, opened once per run
function hubLog_(who, item, points, note, what) {
  var sh = HUB_LOG_SH_;
  if (!sh) {
    var id = getSetting_('Class list sheet ID');
    if (!id) return { ok: false, note: 'Not given yet: Live Board is not linked to the Worksheet Hub (Live Board > 5), then use Live Board > 7.' };
    var ss;
    try { ss = SpreadsheetApp.openById(id); } catch (err) { return { ok: false, note: 'Not given yet: the Worksheet Hub sheet could not be opened.' }; }
    sh = ss.getSheetByName(HUB_LOG);
    if (!sh) {
      // The same layout the Hub makes for itself
      sh = ss.insertSheet(HUB_LOG);
      sh.getRange(1, 1, 1, HUB_LOG_COLS.length).setValues([HUB_LOG_COLS]).setFontWeight('bold');
      sh.setFrozenRows(1);
      sh.getRange('A:A').setNumberFormat('d mmm yyyy, h:mm am/pm'); sh.getRange('J:J').setNumberFormat('d mmm yyyy, h:mm am/pm');
      sh.getRange('B:C').setNumberFormat('@');
    }
    HUB_LOG_SH_ = sh;
  }
  sh.appendRow([new Date(), who.cls, who.reg, who.name, what || 'Lesson', item, points, 0, '', '', note]);
  CacheService.getScriptCache().remove('hub_' + normClass_(who.cls));
  return { ok: true };
}

/* Menu 7: gives points that could not be given before (for example, before the Hub was
   linked, or after the pass mark was changed). Each student still gets them only once per deck. */
/* Menu 8: asks the Hub for the first class's figures, so Google asks for permission to contact the Hub
   (needed once) and the teacher can see the link works. */
function checkHubLink() {
  var ui = SpreadsheetApp.getUi(), map = settingsMap_();
  if (!map['Class list sheet ID']) { ui.alert('First use Live Board > 5. Use the Worksheet Hub class list.'); return; }
  if (!(map['Worksheet Hub link'] || selfUrl_())) { ui.alert('First use Live Board > 6. Set the Worksheet Hub link for students.'); return; }
  var classes = Object.keys(readRoster_()).filter(function (c) { return c !== 'TEST'; }).sort();
  if (!classes.length) { ui.alert('The Hub Students tab has no classes yet.'); return; }
  var h = hubClass_(classes[0], true, map);
  if (h.error) { ui.alert('The link to the Worksheet Hub is not working yet.\n\n' + h.error); return; }
  var pts = h.students.reduce(function (a, s) { return a + s.points; }, 0);
  ui.alert('The link to the Worksheet Hub works.\n\n' + classes[0] + ': ' + h.students.length + ' students, ' + h.work.length +
    ' worksheets, ' + pts + ' points between them.\n\nStudents now see their points and homework on the Live Board home page, and you see them under Classes.');
}

function givePendingPoints() {
  var rules = checkRules_();
  var roster = readRoster_();
  var given = 0, waiting = 0, note = '', due = [];
  withLock_(function () {
    readChecks_().forEach(function (c) {
      if (c.points != null || !qualifies_(c, rules)) return;
      var on = false;
      Object.keys(roster).forEach(function (k) {
        if (normClass_(k) === normClass_(c.cls)) on = on || roster[k].some(function (s) { return normName_(s.name) === normName_(c.name); });
      });
      if (decideAward_(c, rules, on)) due.push(c); else { waiting++; note = c.note; }
      writeCheck_(c);
    });
  });
  due.forEach(function (c) {
    var r = finishAward_({ c: c, rules: rules }, { points: c.points });
    if (r.points) given++; else { waiting++; note = r.note; }
  });
  SpreadsheetApp.getUi().alert(given + (given === 1 ? ' student was' : ' students were') + ' given chapter check points.' +
    (waiting ? '\n\n' + waiting + ' still waiting. ' + note : ''));
}

/* ------------------------------------------------------------------ */
/* Questions for class and Ask now                                     */
/* ------------------------------------------------------------------ */

function apiSetDeckPicks(pin, deckId, ids) {
  checkPin_(pin);
  return withLock_(function () {
    var r = deckRow_(deckId);
    if (r < 0) throw new Error('That deck was not found.');
    var list = (ids || []).map(function (x) { return clean_(x, 120); }).filter(String).slice(0, 200);
    sheet_(TAB.decks).getRange(r, 8).setValue(list.join(', '));
    CacheService.getScriptCache().remove('decks');
    return list;
  });
}

var ASK_MINUTES = 60;
function currentAsk_() {
  var cache = CacheService.getScriptCache();
  var raw = cache.get('live_ask');
  if (raw === null) {
    raw = PropertiesService.getScriptProperties().getProperty('LIVE_ASK') || 'none';
    cachePut_('live_ask', raw, 21600);
  }
  if (raw === 'none') return null;
  var a = JSON.parse(raw);
  return a.until > Date.now() ? a : null;
}

/* Puts one deck question in front of every iPad that has the deck open (or stops, with boardId ''). */
function apiAskLive(pin, boardId, opts) {
  checkPin_(pin);
  var a = null;
  if (boardId) {
    var b = getBoard_(boardId);
    if (!b.deckId) throw new Error('Only deck questions can be asked this way.');
    var d = findDeck_(b.deckId) || { title: b.deckId, link: '', check: [] };
    if ((d.check || []).indexOf(b.taskId) >= 0) throw new Error('Chapter check questions are answered in the chapter check itself, so they cannot be asked on their own.');
    // A fresh ask starts face down, so the class answers before seeing what others chose.
    if (b.revealed) withLock_(function () { b.revealed = false; writeBoard_(b); bump_(b.id); });
    a = { boardId: b.id, deckId: b.deckId, taskId: b.taskId, question: b.title, deckTitle: d.title, link: d.link,
      at: Date.now(), until: Date.now() + ASK_MINUTES * 60000 };
    var secs = opts && Number(opts.secs) || 0;
    if (secs > 0) { a.secs = Math.min(600, Math.round(secs)); a.ends = a.at + a.secs * 1000 + 10000; }   // 10 seconds for the iPads to see it
    if (opts && opts.quiet) a.quiet = true;
  }
  var raw = a ? JSON.stringify(a) : 'none';
  PropertiesService.getScriptProperties().setProperty('LIVE_ASK', raw);
  cachePut_('live_ask', raw, 21600);
  return a;
}

/* ------------------------------------------------------------------ */
/* Stars give points                                                   */
/* ------------------------------------------------------------------ */
/* Starring a student's card on the projector gives them Worksheet Hub points (Settings: Star points).
   Taking the star off takes them back. */
function starPoints_(post, on) {
  var props = PropertiesService.getScriptProperties(), key = 'star_' + post.id;
  var pts = Math.round(Number(getSetting_('Star points')));
  if (!on) pts = Number(props.getProperty(key) || 0);   // take back only what this star gave
  if (isNaN(pts) || pts <= 0) return { points: 0 };
  var s = null;
  (readRoster_()[post.cls] || []).forEach(function (x) { if (normName_(x.name) === normName_(post.name)) s = x; });
  if (!s) return { points: 0, note: 'not on the class list' };
  var b = null;
  try { b = getBoard_(post.boardId); } catch (err) { b = null; }
  var title = shortTitle_(b ? b.title : 'Live Board');
  var res;
  try {
    res = hubLog_({ cls: post.cls, reg: s.reg, name: s.name }, 'star:' + post.id, on ? pts : -pts,
      on ? 'Starred on Live Board: ' + title : 'Star taken off: ' + title);
  } catch (err) { res = { ok: false, note: err.message }; }
  if (!res.ok) return { points: 0, note: res.note };
  if (on) props.setProperty(key, String(pts)); else props.deleteProperty(key);
  return { points: on ? pts : -pts };
}

/* ------------------------------------------------------------------ */
/* Reading the Worksheet Hub                                           */
/* ------------------------------------------------------------------ */
/* One class's points, tokens and homework, from the Hub's private Live Board call. Kept for 3 minutes,
   so a whole class opening the home page asks the Hub once. Returns null when the Hub is not linked. */
function hubClass_(cls, fresh, map) {
  map = map || settingsMap_();
  var id = map['Class list sheet ID'] || '', link = (map['Worksheet Hub link'] || selfUrl_()) || '';
  if (!id || !link) return null;
  var key = 'hub_' + normClass_(cls);
  var cache = CacheService.getScriptCache();
  if (!fresh) {
    var hit = getBig_(key);
    if (hit) return JSON.parse(hit);
    var bad = cache.get(key + '_err');
    if (bad) return { error: bad };
  }
  // When a whole class opens the home page at once, one request asks the Hub and the rest wait for it.
  if (!fresh && cache.get(key + '_busy')) {
    for (var w = 0; w < 12; w++) {
      Utilities.sleep(500);
      var h2 = getBig_(key);
      if (h2) return JSON.parse(h2);
    }
    return { error: 'The Worksheet Hub is busy. Your points and homework will show in a minute.' };
  }
  cachePut_(key + '_busy', '1', 25);
  var msg = '';
  try {
    var j = lbClass_({ api: 'lb_class', key: id, cls: cls });
    if (j && j.ok) { putBig_(key, JSON.stringify(j), 120); cache.remove(key + '_busy'); return j; }
    msg = 'The Teacher Hub did not answer as expected.';
  } catch (err) {
    msg = /HUB_NOT_MOVED/.test(err.message) ? 'Homework and points are being moved into learnwithmrcedric. They will be back soon.' : 'The Teacher Hub could not be read: ' + err.message;
  }
  cache.remove(key + '_busy');
  cachePut_(key + '_err', msg, 60);
  return { error: msg };
}

/* One student's row from the Hub data, with homework turned into a list. */
function hubStudent_(h, name) {
  if (!h || h.error) return h ? { error: h.error } : null;
  var me = null;
  h.students.forEach(function (s) { if (normName_(s.name) === normName_(name)) me = s; });
  if (!me) return { error: 'Your name is not in the Worksheet Hub class list.' };
  var now = Date.now();
  var hw = h.work.map(function (w, i) {
    var c = me.hw.charAt(i);
    var status = c === 'm' ? 'marked' : c === 's' ? 'submitted' : c === 'x' ? 'missed' : (w.dueTs && w.dueTs < now ? 'overdue' : 'todo');
    return { title: w.title, due: w.due, dueTs: w.dueTs, status: status, score: me.sc[i] || '', late: me.late.indexOf(i) >= 0 };
  });
  return { points: me.points, tokens: me.tokens, earned: me.earned, recent: me.recent, homework: hw };
}

/* ------------------------------------------------------------------ */
/* Progress through the decks                                          */
/* ------------------------------------------------------------------ */

function rowToProg_(r, i) {
  return { row: i + 2, deckId: String(r[0]), cls: String(r[1]), name: String(r[2]), seenN: Number(r[3]) || 0, slides: Number(r[4]) || 0,
    answeredN: Number(r[5]) || 0, questions: Number(r[6]) || 0, last: r[7] ? new Date(r[7]).getTime() : 0,
    seen: idList_(r[8]), answered: idList_(r[9]), read: idList_(r[10]), wrong: idList_(r[11]), fixed: idList_(r[12]) };
}

/* A student's row in the Progress tab for one deck: { at, cur } (at is 0 when there is none yet). The row found
   last time is checked before it is used, in case rows were moved or deleted by hand. */
function progRowFor_(sh, deckId, who, after) {
  var mine = function (r) { return String(r[0]) === deckId && normClass_(r[1]) === normClass_(who.cls) && normName_(r[2]) === normName_(who.name); };
  var cache = CacheService.getScriptCache();
  var rowKey = 'pg_' + (deckId + '|' + normClass_(who.cls) + '|' + normName_(who.name)).slice(0, 200);
  var at = 0, cur = null, hint = Number(cache.get(rowKey) || 0);
  if (hint >= 2) {
    try { cur = sh.getRange(hint, 1, 1, PROG_COLS.length).getValues()[0]; } catch (err) { cur = null; }
    if (cur && mine(cur)) at = hint; else cur = null;
  }
  var scanned = 0;
  if (!at) {
    // after: an earlier scan found no row up to that row, so only rows added since are read.
    var last = sh.getLastRow(), from = Math.max(2, (after || 1) + 1);
    if (last >= from) {
      var keys = sh.getRange(from, 1, last - from + 1, 3).getValues();
      for (var i = 0; i < keys.length; i++) if (mine(keys[i])) { at = i + from; break; }
    }
    if (at) cur = sh.getRange(at, 1, 1, PROG_COLS.length).getValues()[0];
    scanned = last;
  }
  if (at) cachePut_(rowKey, String(at), 21600);
  return { at: at, cur: cur, scanned: scanned };
}
/* Progress tabs made before the Read, Wrong first try and Put right columns get their headings. */
function progHeads_(sh) {
  var cache = CacheService.getScriptCache();
  if (cache.get('pg_heads13')) return;
  var head = sh.getRange(1, 11, 1, 3).getValues()[0];
  ['Read', 'Wrong first try', 'Put right'].forEach(function (h, i) {
    if (!head[i]) sh.getRange(1, 11 + i).setValue(h).setFontWeight('bold');
  });
  cachePut_('pg_heads13', '1', 21600);
}
function toFix_(wrongCell, fixedCell) {
  var f = {};
  idList_(fixedCell).forEach(function (x) { f[x] = true; });
  return idList_(wrongCell).filter(function (x) { return !f[x]; }).length;
}

/* Merges what one batch shows about a student into their Progress row. Called inside the batch lock. */
function updateProgress_(deckId, who, d, answers, lb) {
  var visits = Array.isArray(d.visits) ? d.visits.map(function (x) { return clean_(x, 80); }).filter(String) : [];
  var done = answers.map(function (ev) { return clean_(ev.task, 120); }).filter(String);
  var readNow = lb && Array.isArray(lb.read) ? lb.read.map(function (x) { return clean_(x, 80); }).filter(String) : [];
  if (!visits.length && !done.length && !readNow.length) return;
  var deck = findDeck_(deckId);
  var sh = sheet_(TAB.progress), kind = {};
  if (answers.length) readDeckBoardsFor_(deckId).forEach(function (b) { kind[b.taskId] = b.kind; });
  var ordered = answers.map(function (ev, i) { return { ev: ev, i: i, t: Date.parse(ev.at) || 0 }; })
    .sort(function (a, b) { return (a.t - b.t) || (a.i - b.i); }).map(function (x) { return x.ev; });
  // Finding the row can read the whole tab, so it is done first; then the row is read again, merged and
  // written under the lock, so two requests for one student (two iPads, or an answer sent again while the
  // first is still saving) cannot overwrite each other.
  var f0 = progRowFor_(sh, deckId, who);
  withLock_(function () {
    var f = progRowFor_(sh, deckId, who, f0.at ? 0 : f0.scanned);
    mergeProgress_(sh, f, deckId, who, deck, lb, visits, done, readNow, ordered, kind);
  }, 10000);
}
function mergeProgress_(sh, f, deckId, who, deck, lb, visits, done, readNow, answers, kind) {
  var at = f.at, cur = f.cur;
  var p = at ? rowToProg_(cur, at - 2)
    : { row: 0, deckId: deckId, cls: who.cls, name: who.name, seen: [], answered: [], read: [], wrong: [], fixed: [], slides: 0, questions: 0 };
  // My mistakes: a question's first answer decides whether it is a mistake; a right answer later puts it right.
  var had = {}, wrong = {}, fixed = {};
  p.answered.forEach(function (x) { had[x] = true; });
  p.wrong.forEach(function (x) { wrong[x] = true; });
  p.fixed.forEach(function (x) { fixed[x] = true; });
  answers.forEach(function (ev) {
    var t = clean_(ev.task, 120);
    if (!t) return;
    var c = ev.correct === true ? true : ev.correct === false ? false : null;
    if (kind[t] === 'written') c = null;   // written answers are not marked by the deck
    if (!had[t]) { had[t] = true; if (c === false) wrong[t] = true; }
    else if (c === true && wrong[t]) fixed[t] = true;
  });
  p.wrong = Object.keys(wrong); p.fixed = Object.keys(fixed);
  var seen = {}, ans = {}, rd = {};
  p.seen.concat(visits).forEach(function (x) { seen[x] = true; });
  p.answered.concat(done).forEach(function (x) { ans[x] = true; });
  (p.read || []).concat(readNow).forEach(function (x) { rd[x] = true; });
  p.seen = Object.keys(seen); p.answered = Object.keys(ans); p.read = Object.keys(rd);
  var total = Number(lb && lb.slideCount) || 0;
  p.slides = Math.max(total, p.slides || 0, p.seen.length);
  p.questions = (deck && deck.questions) || p.questions || 0;
  var row = [deckId, who.cls, who.name, p.seen.length, p.slides, p.answered.length, p.questions, new Date(),
    p.seen.join(','), p.answered.join(','), p.read.join(','), p.wrong.join(','), p.fixed.join(',')];
  progHeads_(sh);
  if (at) sh.getRange(at, 1, 1, PROG_COLS.length).setValues([row]); else sh.appendRow(row);
}
/* A batch whose Progress update failed: its first tries are worked out again from the Posts tab the next time
   the deck asks for the list. */
function refillMistakes_(deckId, cls) {
  var k = 'mkf_' + hash_(deckId + '|' + normClass_(cls));
  PropertiesService.getScriptProperties().deleteProperty(k);
  CacheService.getScriptCache().remove(k);
}

/* One class's progress without the ID lists, kept for a minute (each class in its own cache entry). */
function readProgress_(cls) {
  var cache = CacheService.getScriptCache(), want = normClass_(cls);
  var hit = getBig_('prog_' + want);
  if (hit) return JSON.parse(hit);
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(TAB.progress);
  var groups = {};
  if (sh && sh.getLastRow() > 1) {
    var n = sh.getLastRow() - 1, mk = sh.getRange(2, 12, n, 2).getValues();
    sh.getRange(2, 1, n, 8).getValues().forEach(function (r, i) {
      if (!r[0]) return;
      (groups[normClass_(r[1])] = groups[normClass_(r[1])] || []).push([String(r[0]), String(r[1]), String(r[2]), Number(r[3]) || 0,
        Number(r[4]) || 0, Number(r[5]) || 0, Number(r[6]) || 0, r[7] ? new Date(r[7]).getTime() : 0, toFix_(mk[i][0], mk[i][1])]);
    });
  }
  Object.keys(groups).forEach(function (k) { putBig_('prog_' + k, JSON.stringify(groups[k]), 60); });
  if (!groups[want]) putBig_('prog_' + want, '[]', 60);
  return groups[want] || [];   // [deckId, cls, name, seen, slides, answered, questions, last, still to fix]
}

/* One class's chapter check rows, kept for a minute. */
function readChecksFor_(cls) {
  var cache = CacheService.getScriptCache(), want = normClass_(cls);
  var hit = getBig_('checks_' + want);
  if (hit) return JSON.parse(hit);
  var groups = {};
  readChecks_().forEach(function (c) { (groups[normClass_(c.cls)] = groups[normClass_(c.cls)] || []).push(c); });
  Object.keys(groups).forEach(function (k) { putBig_('checks_' + k, JSON.stringify(groups[k]), 60); });
  if (!groups[want]) putBig_('checks_' + want, '[]', 60);
  return groups[want] || [];
}

/* ------------------------------------------------------------------ */
/* Live pulse: where everyone is in a deck right now                   */
/* ------------------------------------------------------------------ */
/* Each iPad with a deck open says which slide it is on when it checks for Ask now (every 10 seconds).
   Kept only in the cache, one entry per deck and class. */
function pulseKey_(deckId, cls) { return 'pulse_' + String(deckId).slice(0, 80) + '_' + normClass_(cls); }

/* One cache entry per student, so iPads checking in at the same moment never overwrite each other. */
function pulseStudentKey_(deckId, cls, name) { return pulseKey_(deckId, cls) + '|' + normName_(name).slice(0, 60); }

/* Seen keeps every slide the iPad has reported, so the Progress page turns a page green as soon as it is
   opened, before the deck next sends answers. Kept for 6 hours. */
function heartbeat_(deckId, who, slide, total, extra, old) {
  if (!who || !who.cls || !who.name || !deckId) return;
  var key = pulseStudentKey_(deckId, who.cls, who.name), n = Math.round(Number(slide) || 0);
  if (old === undefined) { try { old = JSON.parse(CacheService.getScriptCache().get(key) || 'null'); } catch (err) { old = null; } }
  var seen = old && typeof old.seen === 'string' ? old.seen : '';
  if (n > 0 && n <= 400 && (',' + seen + ',').indexOf(',' + n + ',') < 0) seen = seen ? seen + ',' + n : String(n);
  var x = extra || {}, now = Date.now();
  // Slides read long enough (version 7 decks), kept like seen.
  var rd = old && typeof old.rd === 'string' ? old.rd : '';
  String(x.rd || '').split(',').forEach(function (k) {
    k = String(Math.round(Number(k) || 0));
    if (k !== '0' && Number(k) <= 400 && (',' + rd + ',').indexOf(',' + k + ',') < 0) rd = rd ? rd + ',' + k : k;
  });
  // Which iPads have used this name in the last 10 minutes.
  var devs = {};
  if (old && old.devs) Object.keys(old.devs).forEach(function (dv) { if (now - old.devs[dv] < 600000) devs[dv] = old.devs[dv]; });
  var dev = clean_(x.dev, 40);
  if (dev) devs[dev] = now;
  cachePut_(key, JSON.stringify({ name: clean_(who.name, 80), slide: n, total: Number(total) || 0, at: now, seen: seen,
    rd: rd, v: Number(x.v) || 0, on: Math.round(Number(x.on) || 0), pend: Math.round(Number(x.pend) || 0), dev: dev, devs: devs,
    sid: clean_(x.sid, 80) }), 21600);
}

/* ---------------- lesson control ---------------- */
/* What the teacher has set for one lesson and class: Follow me, Pause, Stop at (to), the chapter check,
   Hold answers (and the questions released), whole-class slides and videos on the board. Kept in the
   script properties (and the cache), so it lasts until the teacher changes it. The slide the presenter
   is on (the lead) changes often, so it is kept in the cache only. */
var CTL_FIELDS = { follow: 'b', pause: 'b', msg: 's', from: 'n', to: 'n', check: 's', hold: 'b', relAll: 'b', vid: 'b', hooks: 'b', fun: 'b', keep: 'b' };
function ctlKey_(deckId, cls) { return 'ctl_' + String(deckId).slice(0, 80) + '_' + normClass_(cls); }
function leadKey_(deckId, cls) { return 'lead_' + String(deckId).slice(0, 80) + '_' + normClass_(cls); }
function ctlDefault_() { return { follow: false, pause: false, msg: '', from: 0, to: 0, check: 'closed', hold: false, rel: [], relAll: false, vid: false, hooks: true, pauseAt: 0, fun: false, keep: false }; }
function parseCtl_(raw) {
  var c = ctlDefault_();
  if (raw) { try { var x = JSON.parse(raw); Object.keys(x).forEach(function (k) { c[k] = x[k]; }); } catch (err) { /* defaults */ } }
  // A pause ends by itself after 15 minutes, in case it is left on.
  if (c.pause && c.pauseAt && Date.now() - c.pauseAt > 15 * 60000) c.pause = false;
  // A lesson left running ends by itself after 3 hours, so students can finish at home.
  if (c.lesson && Date.now() - (c.lesson.at || 0) > 3 * 3600000) { c.last = { at: c.lesson.at || 0, end: (c.lesson.at || 0) + 3 * 3600000 }; c.lesson = null; c.follow = false; c.pause = false; c.hold = false; c.to = 0; c.from = 0; }
  return c;
}
function getCtl_(deckId, cls, cached, leadRaw) {
  var key = ctlKey_(deckId, cls);
  var raw = cached !== undefined ? cached : CacheService.getScriptCache().get(key);
  if (raw === null || raw === undefined) {
    raw = PropertiesService.getScriptProperties().getProperty(key) || '';
    cachePut_(key, raw || '{}', 21600);
  }
  return checkIdle_(deckId, cls, parseCtl_(raw), leadRaw);
}
function liveLead_(raw) {
  var l = null;
  try { l = raw ? JSON.parse(raw) : null; } catch (err) { l = null; }
  return l && Date.now() - (l.alive || l.at) < 3 * 60000 ? l : null;   // the presenter checks in every 12 seconds
}
function apiSetControlNoPin_(deckId, cls, set) {
  if (!deckId || !cls) throw new Error('Choose a class and a lesson first.');
  var c = getCtl_(deckId, cls);
  Object.keys(set || {}).forEach(function (k) {
    var v = set[k];
    if (k === 'rel') { if (v && c.rel.indexOf(String(v)) < 0) c.rel.push(clean_(v, 120)); return; }
    if (k === 'unrel') { c.rel = c.rel.filter(function (x) { return x !== String(v); }); return; }
    var t = CTL_FIELDS[k];
    if (!t) return;
    c[k] = t === 'b' ? !!v : t === 'n' ? Math.max(0, Math.round(Number(v) || 0)) : clean_(v, 200);
    if (k === 'pause' && v) c.pauseAt = Date.now();
    if (k === 'hold' && v) { c.rel = []; c.relAll = false; }
  });
  if (c.check !== 'open') c.check = 'closed';
  c.rel = c.rel.slice(-200);
  var raw = JSON.stringify(c);
  PropertiesService.getScriptProperties().setProperty(ctlKey_(deckId, cls), raw);
  cachePut_(ctlKey_(deckId, cls), raw, 21600);
  return c;
}
function apiSetControl(pin, deckId, cls, set) {
  checkPin_(pin);
  return apiGetControl(pin, deckId, cls, apiSetControlNoPin_(deckId, cls, set));
}
function apiGetControl(pin, deckId, cls, c) {
  checkPin_(pin);
  c = c || getCtl_(deckId, cls);
  var lead = liveLead_(CacheService.getScriptCache().get(leadKey_(deckId, cls)));
  // Every slide in the order students see them, for Stop at and Today.
  var rec = null;
  try { rec = deckSlides_(deckId, 0); } catch (err) { rec = null; }
  var pages = rec && rec.dom ? rec.dom.map(function (id, i) { return { n: i + 1, t: (rec.domT && rec.domT[i]) || id }; }) : [];
  var deck = findDeck_(deckId);
  var ask = currentAsk_();
  return { ctl: c, lead: lead, settings: lessonSettings_(), pages: pages, lessons: rec && rec.lessons ? rec.lessons : [], link: deck ? deck.link || '' : '',
    ask: ask ? { boardId: ask.boardId, deckId: ask.deckId, taskId: ask.taskId, question: ask.question, at: ask.at, ends: ask.ends || 0, quiet: !!ask.quiet } : null };
}
/* The control an iPad needs, with the presenter's slide while the presenter is there. */
function ctlForIpad_(c, leadRaw) {
  var lead = liveLead_(leadRaw);
  return { follow: c.follow, pause: c.pause, msg: c.msg, to: c.to, check: c.check, hold: c.hold, rel: c.rel, relAll: c.relAll,
    vid: c.vid, hooks: c.hooks, lead: lead ? { id: lead.id, n: lead.n, at: lead.at } : null };
}
/* The presenter (the deck opened with #present) says which slide it is on. */
function presenterLead_(d) {
  checkPin_(d.pin);
  var deckId = clean_(d.topicId, 120), cls = String(d.cls || '').toUpperCase();
  if (!deckId || !cls) return { ok: false, error: 'No lesson or class.' };
  var cache = CacheService.getScriptCache(), old = liveLead_(cache.get(leadKey_(deckId, cls)));
  var id = clean_(d.slide, 80), n = Math.round(Number(d.n) || 0);
  // at changes only when the slide changes, so iPads that followed are not pulled back after looking back.
  var at = old && old.id === id ? old.at : Date.now();
  cachePut_(leadKey_(deckId, cls), JSON.stringify({ id: id, n: n, at: at, alive: Date.now() }), 21600);
  try { if (n) noteReached_(deckId, cls, n); } catch (err) { /* only for Teach next */ }
  var c = getCtl_(deckId, cls);
  // Back within an hour after the lesson ended by itself (the laptop slept, the tab was closed): it carries on.
  if (!c.lesson && c.last && c.last.idle && Date.now() - (c.last.end || 0) < 3600000 && !otherRunningSince_(cls, c.last.end || 0)) {
    c.lesson = { t: c.last.t || 'Lesson', at: c.last.at || Date.now(), end: c.last.xend || 0 }; c.from = c.last.from || 0; c.to = c.last.to || 0;
    c.hold = true; c.keep = !!c.last.keep; c.follow = !!c.last.follow; c.last = null; c.leadAt = Date.now();
    saveCtlRaw_(deckId, cls, c);
  } else if (c.lesson && (!c.leadAt || Date.now() - c.leadAt > 4 * 60000)) { c.leadAt = Date.now(); saveCtlRaw_(deckId, cls, c); }
  if (c.lesson && c.check !== 'open' && n && n === checkSlideNo_(deckId)) {
    c.check = 'open';
    saveCtlRaw_(deckId, cls, c);
  }
  // Stepping on (a slide or two, from where the presenter was a moment ago) shows the answers to the questions on
  // the slides stepped past, unless Keep answers hidden is on. The first slide shown and jumps release nothing.
  var stepped = !!(old && n > old.n && n - old.n <= 3 && Date.now() - (old.alive || old.at || 0) < 180000);
  if (c.lesson && stepped) { try { autoReleasePast_(deckId, cls, c, n, old.n); c = getCtl_(deckId, cls); } catch (err) { /* next slide */ } }
  // A slide the presenter stays on for 8 seconds counts as shown to the class (for the sub-chapters taught, and the
  // Hub's homework): the slide just left, or the slide still showing at a later check.
  if (c.lesson && old && Date.now() - (old.at || 0) >= VISIT_SECS * 1000 && Date.now() - (old.alive || old.at || 0) < 180000) { try { noteVisit_(deckId, cls, old.id); } catch (err) { /* next check */ } }
  var names = (readRoster_()[cls] || []).map(function (s) { return s.name; });
  var got = names.length ? cache.getAll(names.map(function (nm) { return pulseStudentKey_(deckId, cls, nm); })) : {};
  var active = 0, here = 0, behind = 0, now = Date.now();
  Object.keys(got).forEach(function (k) {
    var x = null; try { x = JSON.parse(got[k]); } catch (err) { x = null; }
    if (!x || now - x.at > 35000) return;
    active++;
    if (x.slide === n) here++; else if (x.slide < n) behind++;
  });
  return { ok: true, ctl: c, active: active, here: here, behind: behind };
}
var LSET_DEFAULT = { readSecs: 15, stuckMins: 5, wrongTries: 3 };
function lessonSettings_() {
  // Fixed: the read time, Stuck after and Wrong tries are no longer settings.
  return { readSecs: LSET_DEFAULT.readSecs, stuckMins: LSET_DEFAULT.stuckMins, wrongTries: LSET_DEFAULT.wrongTries };
}
/* The iPad says it has left the slides (another app or tab, the screen locked, the page closed), the moment
   it happens, so the phone shows "Off the slides" within seconds instead of waiting for checks to stop. Its
   next check, when it comes back, clears it. */
function awayNote_(d) {
  var tka = stCheck_(d.st);
  var deckId = clean_(d.topicId, 120), who = tka ? { cls: tka.cls, name: tka.name } : null;
  if (!deckId || !who) return { ok: false };
  var key = pulseStudentKey_(deckId, who.cls, who.name), cache = CacheService.getScriptCache(), old = null;
  try { old = JSON.parse(cache.get(key) || 'null'); } catch (err) { old = null; }
  if (!old) return { ok: true };
  if (d.away) { old.away = true; old.awayAt = Date.now(); } else { delete old.away; delete old.awayAt; }
  cachePut_(key, JSON.stringify(old), 21600);
  return { ok: true };
}

/* The iPad's 10-second check: where it is, plus what the teacher has set, in one cache read. */
function liveCheck_(d) {
  var deckId = clean_(d.topicId, 120), who = null;
  var cache = CacheService.getScriptCache(), dev = clean_(d.dev, 40);
  // The student is the one the sign-in names (not whatever name the iPad sends).
  var px = d.st ? stParse_(d.st) : null, aid = px ? acctId_(px.c, px.n) : '';
  var keys = ['lset', 'live_ask', 'alloc'];
  if (aid) keys.push('sv_' + aid);
  if (dev) keys.push('rst_' + dev);
  var got0 = cache.getAll(keys);
  if (dev && got0['rst_' + dev]) {
    cache.remove('rst_' + dev);
    return { ok: true, reset: true };
  }
  if (d.st || (d.who && d.who.name)) {
    var tk = d.st ? stCheck_(d.st, got0['sv_' + aid]) : null;
    if (!tk) return { ok: true, signedOut: true, poll: 14, readSecs: 15 };
    who = { cls: tk.cls, name: tk.name };
  }
  var cls = who ? who.cls : '';
  var got = got0;
  if (who) {
    var more = cache.getAll([ctlKey_(deckId, cls), leadKey_(deckId, cls), pulseStudentKey_(deckId, cls, who.name)]);
    Object.keys(more).forEach(function (k) { got[k] = more[k]; });
  }
  var old = null, c0 = who ? getCtl_(deckId, cls, got[ctlKey_(deckId, cls)], got[leadKey_(deckId, cls)] || null) : null;
  if (who) { try { old = JSON.parse(got[pulseStudentKey_(deckId, cls, who.name)] || 'null'); } catch (err) { old = null; } }
  // Only students in the lesson show on the teacher's phone; revision at home does not.
  try { if (who && c0.lesson) heartbeat_(deckId, who, d.slide, d.total, d, old); } catch (err) { /* not needed for the answer */ }
  var ask = null;
  if (got['live_ask'] !== undefined && got['live_ask'] !== null) {
    var raw = got['live_ask'];
    if (raw !== 'none') { try { var a0 = JSON.parse(raw); if (a0.until > Date.now()) ask = a0; } catch (err) { ask = null; } }
  } else ask = currentAsk_();
  var set = got['lset'] ? JSON.parse(got['lset']) : null;
  if (!set) { try { set = lessonSettings_(); } catch (err) { set = LSET_DEFAULT; } }
  var out = { ok: true, readSecs: set.readSecs, poll: 14,
    ask: ask && ask.deckId === deckId ? { taskId: ask.taskId, question: ask.question, at: ask.at, ends: ask.ends || 0, quiet: !!ask.quiet } : null };
  if (who) {
    var c = c0;
    out.ctl = ctlForIpad_(c, got[leadKey_(deckId, cls)]);
    if (out.ask || c.pause || (out.ctl.lead && (c.follow || c.vid))) out.poll = 6;
    var alloc = null;
    try { alloc = got['alloc'] ? JSON.parse(got['alloc']) : allocAll_(); } catch (err) { alloc = {}; }
    out.who = { cls: cls, name: who.name };
    out.bv = BRIDGE_LATEST;
    out.live = !!c.lesson;                                                       // answers count now
    out.open = out.live || (alloc[normClass_(cls)] || []).indexOf(deckId) >= 0;   // open for revision
    if (!out.live) out.ask = null;
  } else if (out.ask) out.poll = 6;
  return out;
}

function apiPulse(pin, deckId, cls) {
  checkPin_(pin);
  var roster = (readRoster_()[cls] || []).map(function (s) { return s.name; });
  var got = roster.length ? CacheService.getScriptCache().getAll(roster.map(function (n) { return pulseStudentKey_(deckId, cls, n); })) : {};
  var list = [];
  Object.keys(got).forEach(function (k) { try { list.push(JSON.parse(got[k])); } catch (err) { /* skip */ } });
  return { now: Date.now(), names: roster, students: list };
}

/* ------------------------------------------------------------------ */
/* Progress: every student's pages in one lesson, at a glance          */
/* ------------------------------------------------------------------ */
/* The same rule as the checklist on the deck's last slide: a page with questions is done when
   every question on it has been answered, and a page without questions is done when it has been
   opened. Live Board needs the deck's list of pages for this. It reads the list from the deck
   itself, at its link for students, the first time the Progress page asks for it, and keeps it in
   the Deck slides tab. A deck connected from a file (Lessons > Connect a deck, or Upload the file
   again) gives the list straight away. */
var SLIDE_TAB = 'Deck slides';
var SLIDE_COLS = ['Deck ID', 'Pages', 'Saved', 'Read from'];

/* The pages of a deck file, or null if it has no page list:
     slides: the deck's checklist, [{ id, n (the number on its box), t (title), q: [question IDs] }]
     dom: the ID of every slide in the order students page through them. Some practice slides are
          not on the checklist, so the slide number students see can differ from the box number. */
function slidesFromHtml_(text) {
  var html = String(text || '');
  var T = '<script type="__bundler/template">', a = html.indexOf(T);
  if (a >= 0) {
    var e = html.indexOf('</script>', a + T.length);
    if (e < 0) return null;
    try { html = JSON.parse(html.slice(a + T.length, e).trim()); } catch (err) { return null; }
  }
  var m = html.match(/<script[^>]*id="science-topic-manifest"[^>]*>([\s\S]*?)<\/script>/), man = null;
  try { man = m ? JSON.parse(m[1]) : null; } catch (err) { man = null; }
  if (!man || !Array.isArray(man.slides) || !man.slides.length) return null;
  var titles = {}, dom = [], domT = [], cuts = [], mods = [], re = /<section\b[^>]*\bclass="(?:[^"]*\s)?slide(?:\s[^"]*)?"[^>]*>/g, sm;
  while ((sm = re.exec(html))) {
    var idm = sm[0].match(/\bid="([^"]+)"/);
    dom.push(idm ? idm[1] : '');
    var mm = sm[0].match(/\bdata-module="([^"]*)"/);
    mods.push(mm ? mm[1].replace(/&amp;/g, '&').replace(/&middot;|&#183;/g, '·').replace(/\s+/g, ' ').trim() : '');
    if (/\bclass="[^"]*\b[\w-]*transition\b/.test(sm[0])) cuts.push(dom.length);
    var h1 = html.slice(sm.index, sm.index + 20000).match(/<h1[^>]*>([\s\S]*?)<\/h1>/);
    var t1 = h1 ? h1[1].replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim() : '';
    domT.push(t1);
    if (idm && t1) titles[idm[1]] = t1;
  }
  // A deck split into lessons: [{ title, from, to }], from and to as slide IDs or slide numbers.
  var at = function (x) { var k = dom.indexOf(String(x)); return k >= 0 ? k + 1 : Math.round(Number(x) || 0); };
  var lessons = (Array.isArray(man.lessons) ? man.lessons : []).map(function (l, i) {
    return { t: String(l.title || 'Lesson ' + (i + 1)), from: at(l.from), to: at(l.to), num: String(l.num || subNum_(l.title) || '') };
  }).filter(function (l) { return l.from > 0 && l.to >= l.from; });
  if (!lessons.length) lessons = fromModules_(mods);
  if (!lessons.length) lessons = autoModules_(cuts, dom, domT, man);
  return normDeckPages_({ dom: dom, domT: domT, lessons: lessons, slides: man.slides.map(function (s, i) {
    return { id: s.id, n: Number(s.number) || i + 1, t: titles[s.id] || s.title || '',
      q: Array.isArray(s.routes) && Array.isArray(s.routes[0]) ? s.routes[0] : [] };
  }) });
}

/* A deck that lists no lessons is split at its sub-chapter slides (the transition slides between
   sections), one module each, so Start lesson can offer them. The slides before the first section
   join the first module. Slide numbers are the ones students see. */
function autoModules_(cuts, dom, domT, man) {
  if (!cuts || cuts.length < 2) return [];
  var mt = {};
  ((man && man.slides) || []).forEach(function (s) { if (s && s.id) mt[s.id] = s.title || ''; });
  return cuts.map(function (at, i) {
    var t = String(domT[at - 1] || mt[dom[at - 1]] || 'Part ' + (i + 1)).replace(/\s+/g, ' ').trim();
    return { t: 'Module ' + (i + 1) + ' · ' + t, from: i === 0 ? 1 : at, to: i + 1 < cuts.length ? cuts[i + 1] - 1 : dom.length };
  });
}

function normDeckPages_(d) {
  var slides = normSlides_(d && d.slides);
  if (!slides) return null;
  var dom = (Array.isArray(d.dom) ? d.dom : []).slice(0, 600).map(function (x) { return clean_(x, 80); });
  var domT = (Array.isArray(d.domT) ? d.domT : []).slice(0, dom.length).map(function (x) { return clean_(x, 90); });
  var lessons = (Array.isArray(d.lessons) ? d.lessons : []).slice(0, 40).map(function (l) {
    return { t: clean_(l.t, 80), from: Math.round(Number(l.from) || 0), to: Math.round(Number(l.to) || 0), num: clean_(l.num || subNum_(l.t), 12) };
  }).filter(function (l) { return l.from > 0 && l.to >= l.from; });
  return { slides: slides, dom: dom, domT: domT, lessons: lessons };
}

function normSlides_(list) {
  if (!Array.isArray(list)) return null;
  var out = list.slice(0, 400).map(function (s, i) {
    return { id: clean_(s && s.id, 80), n: Number(s && s.n) || i + 1, t: clean_(s && s.t, 120),
      q: (Array.isArray(s && s.q) ? s.q : []).map(function (x) { return clean_(x, 120); }).filter(String).slice(0, 60) };
  }).filter(function (s) { return s.id; });
  return out.length ? out : null;
}

function slideKey_(deckId) { return 'dsl_' + String(deckId).slice(0, 100); }

/* Keeps a deck's pages in the Deck slides tab (made the first time). */
function saveDeckSlides_(deckId, pages, from) {
  pages = normDeckPages_(pages);
  if (!deckId || !pages) return null;
  var json = JSON.stringify(pages);
  if (json.length > 49000) {   // a cell holds 50,000 characters: drop the titles
    pages.slides = pages.slides.map(function (s) { return { id: s.id, n: s.n, t: '', q: s.q }; });
    pages.domT = [];
    json = JSON.stringify(pages);
    if (json.length > 49000) return null;
  }
  var ss = SpreadsheetApp.getActiveSpreadsheet(), sh = ss.getSheetByName(SLIDE_TAB);
  if (!sh) {
    sh = ss.insertSheet(SLIDE_TAB);
    sh.getRange(1, 1, 1, SLIDE_COLS.length).setValues([SLIDE_COLS]).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  var row = [deckId, json, new Date(), from || ''];
  var n = sh.getLastRow() - 1, at = -1;
  if (n > 0) sh.getRange(2, 1, n, 1).getValues().forEach(function (r, i) { if (String(r[0]) === deckId) at = i + 2; });
  if (at > 0) sh.getRange(at, 1, 1, SLIDE_COLS.length).setValues([row]); else sh.appendRow(row);
  var rec = { slides: pages.slides, dom: pages.dom, domT: pages.domT, lessons: pages.lessons, from: from || '', at: Date.now() };
  putBig_(slideKey_(deckId), JSON.stringify(rec), 600);
  return rec;
}

/* A deck's pages: from the cache, the Deck slides tab, or (at most every 10 minutes) the deck's link. */
function deckSlides_(deckId, wantCount) {
  var rec = null, hit = getBig_(slideKey_(deckId));
  if (hit) { try { rec = JSON.parse(hit); } catch (err) { rec = null; } }
  if (!rec) {
    var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SLIDE_TAB);
    if (sh && sh.getLastRow() > 1) {
      sh.getRange(2, 1, sh.getLastRow() - 1, SLIDE_COLS.length).getValues().forEach(function (r) {
        if (String(r[0]) !== deckId) return;
        try {
          var pg = JSON.parse(String(r[1]));
          rec = { slides: pg.slides, dom: pg.dom || [], domT: pg.domT || [], lessons: pg.lessons || [], from: String(r[3] || ''), at: r[2] ? new Date(r[2]).getTime() : 0 };
        } catch (err) { rec = null; }
      });
    }
    if (rec) putBig_(slideKey_(deckId), JSON.stringify(rec), 600);
  }
  // Not known yet, or the deck on the website now has a different number of pages: read it again.
  var stale = rec && rec.from !== 'file' && wantCount && rec.dom && rec.dom.length && rec.dom.length !== wantCount;
  if (!rec || stale) {
    var fresh = readSlidesFromLink_(deckId);
    if (fresh) rec = fresh;
  }
  return rec;
}

/* Checks the two links that matter in a lesson: the saved web app link (the phone QR code uses it)
   and the link inside the slides (the iPads send answers to it and get Follow me and Pause from it).
   Each is 'ok' (running this code), 'old' (a deployment still on older code), 'dead' (does not open),
   'none' (not set) or 'unknown' (could not check). */
function apiLinkCheck(pin, deckId, fresh) {
  checkPin_(pin);
  var saved = savedExecUrl_();
  var out = { build: BUILD, saved: saved, savedState: saved ? linkState_(saved, fresh) : 'none' };
  var deck = deckId ? findDeck_(deckId) : null;
  if (deck && /^https:\/\//.test(deck.link)) {
    var ep = deckEndpoint_(deck, fresh);
    if (ep) {
      out.deckTitle = deck.title; out.deckLink = ep; out.deckSame = ep === saved;
      out.deckState = out.deckSame ? out.savedState : linkState_(ep, fresh);
    }
  }
  return out;
}
function linkState_(url, fresh) {
  var cache = CacheService.getScriptCache(), key = 'lks_' + String(url).replace(/\W/g, '').slice(-120);
  var hit = fresh ? null : cache.get(key);
  if (hit) return hit;
  var st = 'unknown';
  try {
    var res = UrlFetchApp.fetch(url + '?api=build', { muteHttpExceptions: true, followRedirects: true });
    var code = res.getResponseCode(), txt = res.getContentText();
    if (code === 404 || /unable to open the file/i.test(txt)) st = 'dead';
    else if (code === 200) {
      var j = null;
      try { j = JSON.parse(txt); } catch (err) { j = null; }
      st = j && j.build === BUILD ? 'ok' : 'old';
    }
  } catch (err) {
    st = 'unknown';
  }
  cache.put(key, st, st === 'ok' ? 600 : 60);
  return st;
}
/* The web app link written inside a deck (its tracking config, which the Live Board script sends to). */
function deckEndpoint_(deck, fresh) {
  var cache = CacheService.getScriptCache(), key = 'dep_' + String(deck.id).slice(0, 100);
  var hit = fresh ? null : cache.get(key);
  if (hit) return hit === '-' ? '' : hit;
  var ep = '';
  try {
    var res = UrlFetchApp.fetch(deck.link, { muteHttpExceptions: true, followRedirects: true });
    if (res.getResponseCode() === 200) {
      var m = res.getContentText().match(/https:\/\/script\.google\.com\/[^"'\s\\]*?\/s\/[-\w]+\/exec/);
      ep = m ? plainExecUrl_(m[0]) : '';
    }
  } catch (err) {
    ep = '';
  }
  cache.put(key, ep || '-', 600);
  return ep;
}

function readSlidesFromLink_(deckId) {
  var deck = findDeck_(deckId), cache = CacheService.getScriptCache(), key = 'dslf_' + String(deckId).slice(0, 100);
  if (!deck || !/^https:\/\//.test(deck.link) || cache.get(key)) return null;
  cache.put(key, '1', 600);
  try {
    var res = UrlFetchApp.fetch(deck.link, { muteHttpExceptions: true, followRedirects: true });
    if (res.getResponseCode() !== 200) return null;
    var pages = slidesFromHtml_(res.getContentText());
    if (!pages) return null;
    return withLock_(function () { return saveDeckSlides_(deckId, pages, 'link'); }, 15000);
  } catch (err) {
    return null;
  }
}

/* Seen, Answered and Read for one deck and class, kept for 15 seconds. { name: { seen, answered, read, slides, last } } */
function readProgressIds_(deckId, cls) {
  var key = 'pgi_' + String(deckId).slice(0, 80) + '_' + normClass_(cls);
  var hit = getBig_(key);
  if (hit) return JSON.parse(hit);
  var out = {}, sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(TAB.progress);
  if (sh && sh.getLastRow() > 1) {
    sh.getRange(2, 1, sh.getLastRow() - 1, PROG_COLS.length).getValues().forEach(function (r) {
      if (String(r[0]) !== deckId || normClass_(r[1]) !== normClass_(cls)) return;
      out[normName_(r[2])] = { seen: idList_(r[8]), answered: idList_(r[9]), read: idList_(r[10]), slides: Number(r[4]) || 0,
        last: r[7] ? new Date(r[7]).getTime() : 0 };
    });
  }
  putBig_(key, JSON.stringify(out), 15);
  return out;
}

/* Wrong answers in the last 90 minutes, per student and question: { name: { taskId: count } }. Kept for 20 seconds. */
function wrongTries_(deckId, cls) {
  var key = 'wt_' + String(deckId).slice(0, 80) + '_' + normClass_(cls);
  var hit = getBig_(key);
  if (hit) return JSON.parse(hit);
  var prefix = 'D:' + deckId + ':', since = Date.now() - 90 * 60000, out = {};
  postRows_('pd_' + deckId, function (r) { return r[0] && String(r[1]).indexOf(prefix) === 0; }).rows.forEach(function (r) {
    if (String(r[1]).indexOf(prefix) !== 0 || normClass_(r[3]) !== normClass_(cls)) return;
    if (!(r[12] === false || String(r[12]).toUpperCase() === 'FALSE')) return;
    var t = r[2] ? new Date(r[2]).getTime() : 0;
    if (t < since) return;
    var k = normName_(r[5]), task = String(r[1]).slice(prefix.length);
    var m = out[k] = out[k] || {};
    m[task] = (m[task] || 0) + 1;
  });
  putBig_(key, JSON.stringify(out), 20);
  return out;
}

function today_() {
  var tz = 'Asia/Singapore';
  try { tz = Session.getScriptTimeZone() || tz; } catch (err) { /* default */ }
  return Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');
}
function absentKey_(cls) { return 'abs_' + normClass_(cls) + '_' + today_(); }
function readAbsent_(cls) { return []; }   // students not signed in during the lesson show as Not in
function apiSetAbsent(pin, cls, name, on) {
  checkPin_(pin);
  var list = readAbsent_(cls).filter(function (n) { return n !== normName_(name); });
  if (on) list.push(normName_(name));
  PropertiesService.getScriptProperties().setProperty(absentKey_(cls), JSON.stringify(list));
  return list;
}
function dueKey_(deckId, cls) { return 'due_' + String(deckId).slice(0, 80) + '_' + normClass_(cls); }
function readDue_(deckId, cls) {
  try { return JSON.parse(PropertiesService.getScriptProperties().getProperty(dueKey_(deckId, cls)) || '[]'); } catch (err) { return []; }
}
/* Finish by: these students finish slides from to to of this lesson by a date. It shows on their learnwithmrcedric. */
function apiSetDue(pin, deckId, cls, names, by, from, to) {
  checkPin_(pin);
  var who = (names || []).map(normName_).filter(String);
  var list = readDue_(deckId, cls).map(function (e) { e.names = e.names.filter(function (n) { return who.indexOf(n) < 0; }); return e; });
  var old = Date.now() - 30 * 86400000;
  list = list.filter(function (e) { return e.names.length && Date.parse(e.by) > old; });
  if (by && who.length) list.push({ names: who, by: clean_(by, 10), from: Math.round(Number(from) || 0), to: Math.round(Number(to) || 0), at: Date.now() });
  PropertiesService.getScriptProperties().setProperty(dueKey_(deckId, cls), JSON.stringify(list));
  return list;
}
/* Reset this iPad: the next time it checks in, it forgets the name and asks again. */
function apiResetDevice(pin, dev) {
  checkPin_(pin);
  if (!dev) throw new Error('That iPad is not known.');
  cachePut_('rst_' + clean_(dev, 40), '1', 21600);
  return true;
}

/* The columns for a lesson: the checklist boxes, or (all) every slide in the order students see them. */
function gridColumns_(deckId, rec, all) {
  var slides = rec && rec.slides, dom = (rec && rec.dom) || [], domT = (rec && rec.domT) || [];
  var boards = readDeckBoardsFor_(deckId);
  if (!slides) {
    // No page list yet: only the pages that have questions, from the questions Live Board knows.
    var by = {};
    boards.forEach(function (b) {
      if (!b.slideNo) return;
      var c = by[b.slideNo] = by[b.slideNo] || { id: '', n: b.slideNo, at: b.slideNo, t: b.slideTitle, q: [] };
      c.q.push(b.taskId);
    });
    return { cols: Object.keys(by).map(function (k) { return by[k]; }).sort(function (a, b) { return a.at - b.at; }), dom: [], from: 'questions' };
  }
  var domAt = {};
  dom.forEach(function (id, i) { if (id && !domAt[id]) domAt[id] = i + 1; });
  var boxes = slides.map(function (s) { return { id: s.id, n: s.n, at: dom.length ? domAt[s.id] || 0 : s.n, t: s.t, q: s.q, box: true }; });
  if (!all || !dom.length) return { cols: boxes, dom: dom, from: rec.from };
  var byId = {}, tasksAt = {};
  boxes.forEach(function (b) { byId[b.id] = b; });
  boards.forEach(function (b) { if (b.slideNo) (tasksAt[b.slideNo] = tasksAt[b.slideNo] || []).push(b.taskId); });
  var cols = dom.map(function (id, i) {
    return byId[id] || { id: id, n: 0, at: i + 1, t: domT[i] || '', q: tasksAt[i + 1] || [], box: false };
  });
  return { cols: cols, dom: dom, from: rec.from };
}

/* One student's boxes: a (questions answered) and v ('0' not opened, '1' opened, '2' read, '3' opened but
   skimmed), and how many are done. A page without questions is done when read (version 7 decks) or opened. */
/* One student's boxes: a (questions answered) and v ('0' not opened, '1' opened), and how many are done.
   A page with questions is done when every question is answered; a page without questions when it is opened. */
function studentCells_(cols, dom, p, x) {
  var seenId = {}, ans = {}, seenN = {};
  (p.seen || []).forEach(function (id) { seenId[id] = true; });
  (p.answered || []).forEach(function (id) { ans[id] = true; });
  if (x && x.seen) String(x.seen).split(',').forEach(function (n) { if (n) { seenN[n] = true; if (dom[n - 1]) seenId[dom[n - 1]] = true; } });
  if (x && x.slide) { seenN[x.slide] = true; if (dom[x.slide - 1]) seenId[dom[x.slide - 1]] = true; }
  var a = [], v = '', done = 0, doneIds = [];
  cols.forEach(function (c) {
    var k = 0;
    c.q.forEach(function (t) { if (ans[t]) k++; });
    var opened = !!(seenId[c.id] || (!dom.length && seenN[c.at]));
    a.push(k); v += opened ? '1' : '0';
    if (c.q.length ? k === c.q.length : opened) { done++; if (c.id) doneIds.push(c.id); }
  });
  return { a: a, v: v, done: done, doneIds: doneIds, timed: false };
}

/* For the bridge: the checklist boxes this student has done, from any iPad. */
function studentDone_(deckId, cls, name) {
  if (!deckId || !cls || !name) return [];
  var rec = deckSlides_(deckId, 0);
  if (!rec || !rec.slides) return [];
  var cols = gridColumns_(deckId, rec, false);
  var p = readProgressIds_(deckId, cls)[normName_(name)] || {};
  var x = null;
  try { x = JSON.parse(CacheService.getScriptCache().get(pulseStudentKey_(deckId, String(cls).toUpperCase(), name)) || 'null'); } catch (err) { x = null; }
  return studentCells_(cols.cols, cols.dom, p, x).doneIds;
}

/* Results for the projector (the slides' Results button): the questions on the presenter's slide, with no names. */
function slideResults_(d) {
  checkPin_(d.pin);
  var deckId = clean_(d.topicId, 120), cls = String(d.cls || '').toUpperCase();
  if (!deckId || !cls) return { ok: false, error: 'No lesson or class.' };
  var n = questionSlideFor_(deckId, Math.round(Number(d.n) || 0));
  var r = n ? apiSlideNow(d.pin, deckId, cls, n, !!d.texts) : { n: 0, questions: [] };
  r.questions.forEach(function (q) { delete q.missing; q.wrong = null; });
  r.ok = true;
  return r;
}

/* Let in: a student whose register number did not match asks the teacher's phone, instead of the teacher typing
   the PIN on the student's iPad. Requests last 10 minutes. */
function gateHelpKey_(cls) { return 'gh_' + normClass_(cls); }
function gateHelpList_(cls) {
  var list = [];
  try { list = JSON.parse(CacheService.getScriptCache().get(gateHelpKey_(cls)) || '[]'); } catch (err) { list = []; }
  return list.filter(function (x) { return Date.now() - x.at < 600000; });
}
/* Every class's requests, for the phone (it may be on another class). Two iPads asking for one name are marked. */
function gateHelpAll_() {
  var classes = Object.keys(readRoster_()), keys = classes.map(gateHelpKey_), got = {}, out = [];
  try { got = CacheService.getScriptCache().getAll(keys); } catch (err) { got = {}; }
  classes.forEach(function (c, i) {
    var list = [];
    try { list = JSON.parse(got[keys[i]] || '[]'); } catch (err) { list = []; }
    list.forEach(function (x) { if (Date.now() - x.at < 600000) out.push({ key: x.key, name: x.name, cls: c, at: x.at }); });
  });
  out.forEach(function (x) { x.twice = out.filter(function (y) { return y.cls === x.cls && y.name === x.name; }).length > 1; });
  return out;
}
function gateHelp_(d) {
  var cache = CacheService.getScriptCache();
  if (d.key) {   // the iPad asking whether it has been let in
    var st = cache.get('ghs_' + clean_(d.key, 40));
    return { ok: true, state: st || 'gone' };
  }
  var who = matchStudent_(d.cls, d.name);
  if (!who.matched) return { ok: false, error: 'That name is not on the class list.' };
  var key = Utilities.getUuid().replace(/-/g, '').slice(0, 20), dev = clean_(d.dev, 40);
  // Under the lock, so two students asking at the same moment are both kept. A request from another iPad for the
  // same name is kept too (the phone marks the name), so nobody can push a real request out by asking for that name.
  return withLock_(function () {
    var list = gateHelpList_(who.cls).filter(function (x) { return !(x.name === who.name && x.dev === dev); });
    if (list.length >= 30) return { ok: false, error: 'Too many students are waiting. Ask your teacher.' };
    list.push({ key: key, name: who.name, dev: dev, at: Date.now() });
    cachePut_(gateHelpKey_(who.cls), JSON.stringify(list), 600);
    cachePut_('ghs_' + key, 'wait', 600);
    cachePut_('ghn_' + key, who.cls + '|' + who.name, 600);
    return { ok: true, key: key };
  }, 10000);
}
function apiGateHelpAnswer(pin, cls, key, yes) {
  checkPin_(pin);
  key = clean_(key, 40);
  withLock_(function () {
    cachePut_('ghs_' + key, yes ? 'ok' : 'no', 600);
    var list = gateHelpList_(cls).filter(function (x) { return x.key !== key; });
    cachePut_(gateHelpKey_(cls), JSON.stringify(list), 600);
  }, 10000);
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* My mistakes and Practise (the Revise card in the deck)             */
/* ------------------------------------------------------------------ */
/* The deck asks for this student's mistakes in this deck: the questions whose first answer was wrong, and of
   those the ones put right since. d.fixed lists questions answered right first time in Practise, which puts
   them right too (Practise gives no points and sends no answers). checkTries says whether the student has
   done the chapter check, which Practise needs first. */
function review_(d) {
  var deckId = clean_(d.topicId, 120), tk = stCheck_(d.st);
  if (!deckId || !tk) return { ok: false, error: 'Sign in with your PIN first.' };
  var who = matchStudent_(tk.cls, tk.name);
  if (!who.matched) return { ok: false, error: 'That name is not on the class list.' };
  try { fillMistakes_(deckId, who.cls); } catch (err) { /* the list shows what the Progress tab has */ }
  var sh = sheet_(TAB.progress), f = progRowFor_(sh, deckId, who);
  var p = f.at ? rowToProg_(f.cur, f.at - 2) : { wrong: [], fixed: [], answered: [] };
  var add = (Array.isArray(d.fixed) && inLessonWindow_(getCtl_(deckId, who.cls), Date.now()) ? d.fixed : []).slice(0, 200).map(function (x) { return clean_(x, 120); })
    .filter(function (x) { return x && p.fixed.indexOf(x) < 0; });
  if (add.length && f.at) {
    progHeads_(sh);
    withLock_(function () {
      var g = progRowFor_(sh, deckId, who);
      if (!g.at) return;
      p = rowToProg_(g.cur, g.at - 2);
      add.forEach(function (x) { if (p.fixed.indexOf(x) < 0) p.fixed.push(x); });
      sh.getRange(g.at, 13).setValue(p.fixed.join(','));
    }, 10000);
    CacheService.getScriptCache().remove('prog_' + normClass_(who.cls));
  }
  var tries = 0;
  readChecksFor_(who.cls).forEach(function (c) { if (c.deckId === deckId && normName_(c.name) === normName_(who.name)) tries = c.tries; });
  // While the class's answers are held in a lesson, the deck keeps Revise closed (it would show them).
  var c = getCtl_(deckId, who.cls);
  return { ok: true, wrong: p.wrong, fixed: p.fixed, answered: p.answered || [], checkTries: tries, held: !!(c.hold && !c.relAll) };
}

/* Answers saved before My mistakes existed: the first time a deck's mistakes are asked for in a class, they
   are worked out once from the Posts tab (each student's first answer to each marked question) and added to
   the Progress tab. Remembered per deck and class, so it is done once. */
function fillMistakes_(deckId, cls) {
  var props = PropertiesService.getScriptProperties(), cache = CacheService.getScriptCache();
  var k = 'mkf_' + hash_(deckId + '|' + normClass_(cls));
  if (cache.get(k) || props.getProperty(k)) { cachePut_(k, '1', 21600); return false; }
  // One fill at a time: the document lock (separate from the script lock that saving answers uses). A request
  // that finds a fill running shows the list as it is; the next one has it filled.
  var dl = null;
  try { dl = LockService.getDocumentLock(); } catch (err) { dl = null; }
  if (dl) { if (!dl.tryLock(0)) return false; }
  else { if (cache.get(k + '_busy')) return false; cachePut_(k + '_busy', '1', 120); }
  try {
    if (props.getProperty(k)) { cachePut_(k, '1', 21600); return false; }   // filled while this one waited
    fillMistakesNow_(deckId, cls, k);
  } finally {
    if (dl) dl.releaseLock(); else cache.remove(k + '_busy');
  }
  return true;
}
function fillMistakesNow_(deckId, cls, k) {
  var props = PropertiesService.getScriptProperties(), cache = CacheService.getScriptCache();
  var kind = {};
  readDeckBoardsFor_(deckId).forEach(function (b) { kind[b.taskId] = b.kind; });
  var prefix = 'D:' + deckId + ':', per = {};
  postRows_('pd_' + deckId, function (r) { return r[0] && String(r[1]).indexOf(prefix) === 0; }).rows.forEach(function (r) {
    if (String(r[1]).indexOf(prefix) !== 0 || normClass_(r[3]) !== normClass_(cls)) return;
    var task = String(r[1]).slice(prefix.length);
    if (kind[task] === 'written') return;
    var v = String(r[12]).toUpperCase(), c = r[12] === true || v === 'TRUE' ? true : r[12] === false || v === 'FALSE' ? false : null;
    var m = per[normName_(r[5])] = per[normName_(r[5])] || { cls: String(r[3]), name: String(r[5]), seen: {}, wrong: {}, fixed: {} };
    if (!m.seen[task]) { m.seen[task] = true; if (c === false) m.wrong[task] = true; }
    else if (c === true && m.wrong[task]) m.fixed[task] = true;
  });
  var sh = sheet_(TAB.progress);
  if (Object.keys(per).length) progHeads_(sh);
  if (Object.keys(per).length) withLock_(function () {
    var n = sh.getLastRow() - 1;
    var keys = n > 0 ? sh.getRange(2, 1, n, 3).getValues() : [], mk = n > 0 ? sh.getRange(2, 12, n, 2).getValues() : [];
    keys.forEach(function (r, i) {
      if (String(r[0]) !== deckId || normClass_(r[1]) !== normClass_(cls)) return;
      var m = per[normName_(r[2])];
      if (!m) return;
      var w = {}, fx = {};
      idList_(mk[i][0]).concat(Object.keys(m.wrong)).forEach(function (x) { w[x] = true; });
      idList_(mk[i][1]).concat(Object.keys(m.fixed)).forEach(function (x) { fx[x] = true; });
      var cell = [Object.keys(w).join(','), Object.keys(fx).join(',')];
      if (cell[0] !== String(mk[i][0]) || cell[1] !== String(mk[i][1])) sh.getRange(i + 2, 12, 1, 2).setValues([cell]);
      m.done = true;
    });
    // Students with answers but no Progress row (their only batch failed to update it) get one.
    var deck = findDeck_(deckId);
    Object.keys(per).forEach(function (nm) {
      var m = per[nm];
      if (m.done || !Object.keys(m.wrong).length) return;
      var ans = Object.keys(m.seen);
      sh.appendRow([deckId, m.cls, m.name, 0, 0, ans.length, (deck && deck.questions) || 0, new Date(), '', ans.join(','), '',
        Object.keys(m.wrong).join(','), Object.keys(m.fixed).join(',')]);
    });
  }, 20000);
  cache.remove('prog_' + normClass_(cls));
  props.setProperty(k, String(Date.now()));
  cachePut_(k, '1', 21600);
}

/* The Progress page: one row per student, one box per page of the lesson. opts.all shows every slide. */
function apiProgressGrid(pin, deckId, cls, opts) {
  checkPin_(pin);
  deckId = clean_(deckId, 120);
  opts = opts || {};
  var roster = readRoster_()[cls] || [];
  var deck = findDeck_(deckId) || { id: deckId, title: deckId, link: '' };
  var prog = readProgressIds_(deckId, cls);
  var cache = CacheService.getScriptCache();
  var keys = roster.map(function (s) { return pulseStudentKey_(deckId, cls, s.name); });
  var got = keys.length ? cache.getAll(keys) : {};
  var now = Date.now(), want = 0;
  var pulses = roster.map(function (s, i) {
    var x = null;
    try { x = got[keys[i]] ? JSON.parse(got[keys[i]]) : null; } catch (err) { x = null; }
    if (x && x.total) want = Math.max(want, Number(x.total) || 0);
    return x;
  });
  Object.keys(prog).forEach(function (k) { want = Math.max(want, prog[k].slides || 0); });
  var rec = deckId ? deckSlides_(deckId, want) : null;
  var g = gridColumns_(deckId, rec, !!opts.all), cols = g.cols, dom = g.dom;
  // The box for a slide number: that slide's own box, or the last box before it.
  var boxFor = function (n) {
    var best = -1;
    cols.forEach(function (c, i) { if (c.at && c.at <= n && (best < 0 || c.at > cols[best].at)) best = i; });
    return best;
  };
  var set = lessonSettings_(), wrong = {};
  try { wrong = wrongTries_(deckId, cls); } catch (err) { wrong = {}; }
  var titles = {};
  readDeckBoardsFor_(deckId).forEach(function (b) { titles[b.taskId] = b.title; });
  var absent = [], due = [];
  var students = roster.map(function (s, i) {
    var k = normName_(s.name), p = prog[k] || { seen: [], answered: [], read: [], last: 0 }, x = pulses[i];
    var cells = studentCells_(cols, dom, p, x);
    var at = x ? Number(x.at) || 0 : 0, here = x ? Number(x.slide) || 0 : 0;
    var active = !!(x && now - at < 35000), quiet = !!(x && !active && now - at < 10 * 60000);
    var flags = [];
    if (x && active) {
      if ((x.on || 0) >= set.stuckMins * 60) flags.push({ k: 'stuck', t: 'On slide ' + here + ' for ' + Math.floor(x.on / 60) + ' min' });
    }
    var w = wrong[k] || {};
    Object.keys(w).forEach(function (t) { if (w[t] >= set.wrongTries) flags.push({ k: 'wrong', t: 'Wrong ' + w[t] + ' times: ' + (titles[t] || t).slice(0, 70) }); });
    if (x && x.pend > 0 && (active || quiet)) flags.push({ k: 'wait', t: x.pend + ' answer' + (x.pend > 1 ? 's' : '') + ' waiting to send' });
    var myDue = null;
    due.forEach(function (e) { if (e.names.indexOf(k) >= 0) myDue = { by: e.by, from: e.from, to: e.to }; });
    return { name: s.name, reg: s.reg, a: cells.a, v: cells.v, done: cells.done, timed: cells.timed,
      at: active || quiet ? here : 0, box: active || quiet ? boxFor(here) : -1, away: quiet, quietMin: quiet ? Math.floor((now - at) / 60000) : 0,
      seenToday: !!x, dev: x ? x.dev || '' : '', flags: flags, absent: absent.indexOf(k) >= 0, due: myDue,
      last: Math.max(p.last || 0, at) };
  });
  var c = getCtl_(deckId, cls);
  return { now: now, deck: { id: deck.id, title: deck.title, link: deck.link || '' }, cls: cls, from: g.from, all: !!opts.all,
    slides: cols.map(function (s) { return { n: s.n, at: s.at, t: s.t, q: s.q.length, first: s.q[0] || '', box: s.box !== false }; }),
    hasPractice: !!(dom.length && rec && rec.slides && dom.length > rec.slides.length),
    domCount: dom.length, ctl: c, lead: liveLead_(cache.get(leadKey_(deckId, cls))), settings: set, students: students,
    help: gateHelpList_(cls).map(function (x) { return { key: x.key, name: x.name, at: x.at }; }) };
}

/* ------------------------------------------------------------------ */
/* The student home: lessons, homework and points                      */
/* ------------------------------------------------------------------ */

function dueFor_(deckId, cls, name) {
  var mine = null;
  readDue_(deckId, cls).forEach(function (e) { if (e.names.indexOf(normName_(name)) >= 0) mine = { by: e.by, from: e.from, to: e.to }; });
  return mine;
}
function apiStudentOverview(st) {
  var me0 = stWho_(st), cls = me0.cls, name = me0.name;
  var me = findStudent_(cls, name);
  if (!me) throw new Error('Your name is not on the class list. Ask your teacher.');
  var map = settingsMap_();
  var mine = {};
  readProgress_(cls).forEach(function (r) {
    if (normName_(r[2]) === normName_(name)) mine[r[0]] = r;
  });
  var checks = {};
  readChecksFor_(cls).forEach(function (c) {
    if (normName_(c.name) === normName_(name)) checks[c.deckId] = c;
  });
  var rules = checkRules_(map);
  var open = allocFor_(cls), nowRun = null;
  try { nowRun = runningLessonFor_(cls); } catch (err) { nowRun = null; }
  var decks = readDecks_().filter(function (d) { return /^https:\/\//.test(d.link) && (open.indexOf(d.id) >= 0 || (nowRun && nowRun.id === d.id)); });
  // A lesson whose answers are held now shows no count of mistakes: it would tell right from wrong.
  var ctlRaw = {};
  try { ctlRaw = CacheService.getScriptCache().getAll(decks.map(function (d) { return ctlKey_(d.id, cls); })); } catch (err) { ctlRaw = {}; }
  var held = function (d) { var c = getCtl_(d.id, cls, ctlRaw[ctlKey_(d.id, cls)]); return !!(c.hold && !c.relAll); };
  var lessons = decks.map(function (d) {
    var p = mine[d.id], c = checks[d.id];
    return {
      id: d.id, title: d.title, url: d.link, checkFirst: d.check[0] || '', open: open.indexOf(d.id) >= 0,
      seen: p ? p[3] : 0, slides: p ? p[4] : 0, answered: p ? p[5] : 0, questions: p ? (p[6] || d.questions) : d.questions,
      last: p ? p[7] : 0,
      fix: p && p[8] && !held(d) ? p[8] : 0,
      due: dueFor_(d.id, cls, name),
      check: d.check.length ? { first: c ? c.first : null, best: c ? c.best : null, tries: c ? c.tries : 0, points: c ? c.points : null } : null
    };
  }).sort(function (a, b) { return (b.last - a.last) || a.title.localeCompare(b.title, undefined, { numeric: true }); });
  var hub = (map['Worksheet Hub link'] || selfUrl_()) ? hubStudent_(hubClass_(cls, false, map), name) : null;
  var catalog = null, now = nowRun;
  try { catalog = studentCatalog_(lessons.filter(function (l) { return l.open; })); } catch (err) { catalog = null; }
  return { lessons: lessons, catalog: catalog, now: now, hub: hub, hubLink: (map['Worksheet Hub link'] || selfUrl_()) || '',
    rule: { pass: rules.pass, points: rules.points, best: rules.best } };
}

/* ------------------------------------------------------------------ */
/* The teacher's class view                                            */
/* ------------------------------------------------------------------ */

function apiClassView(pin, cls, fresh) {
  checkPin_(pin);
  var roster = readRoster_()[cls] || [];
  var decks = readDecks_().slice().sort(function (a, b) { return a.title.localeCompare(b.title, undefined, { numeric: true }); });
  var prog = {}, checks = {}, posts = {};
  readProgress_(cls).forEach(function (r) {
    prog[normName_(r[2]) + '|' + r[0]] = { seen: r[3], slides: r[4], answered: r[5], questions: r[6], last: r[7] };
  });
  readChecks_().forEach(function (c) {
    if (normClass_(c.cls) !== normClass_(cls)) return;
    checks[normName_(c.name) + '|' + c.deckId] = { first: c.first, best: c.best, tries: c.tries, points: c.points };
  });
  // Live Board posts (not deck answers) in the last 30 days, and stars
  var sh = sheet_(TAB.posts), n = sh.getLastRow() - 1, since = Date.now() - 30 * 86400000;
  if (n > 0) sh.getRange(2, 2, n, 10).getValues().forEach(function (r) {
    if (isDeckBoardId_(r[0]) || normClass_(r[2]) !== normClass_(cls)) return;
    var t = r[1] ? new Date(r[1]).getTime() : 0;
    var k = normName_(r[4]);
    var x = posts[k] = posts[k] || { posts: 0, stars: 0 };
    if (t >= since) x.posts++;
    if (bool_(r[9])) x.stars++;
  });
  var hub = hubClass_(cls, !!fresh);
  var hubBy = {};
  if (hub && !hub.error) hub.students.forEach(function (s) { hubBy[normName_(s.name)] = s; });
  var rules = checkRules_();
  return {
    cls: cls,
    rules: { pass: rules.pass, points: rules.points, best: rules.best },
    decks: decks.map(function (d) { return { id: d.id, title: d.title, questions: d.questions, check: d.check.length }; }),
    work: hub && !hub.error ? hub.work : [],
    hubError: hub ? hub.error || '' : 'not linked',
    hubAt: hub && hub.at ? hub.at : 0,
    students: roster.map(function (s) {
      var k = normName_(s.name), h = hubBy[k];
      return {
        name: s.name, reg: s.reg,
        hub: h ? { points: h.points, tokens: h.tokens, hw: h.hw, sc: h.sc, late: h.late, recent: h.recent } : null,
        decks: decks.map(function (d) { return { p: prog[k + '|' + d.id] || null, c: checks[k + '|' + d.id] || null }; }),
        board: posts[k] || { posts: 0, stars: 0 }
      };
    })
  };
}

/* Points given by hand from the teacher page (Classes > a student). They go to the Hub like the Hub's own. */
function apiGivePoints(pin, cls, name, points, note) {
  checkPin_(pin);
  var p = Math.round(Number(points) || 0);
  if (!p) throw new Error('Type a number of points.');
  var s = null;
  (readRoster_()[cls] || []).forEach(function (x) { if (normName_(x.name) === normName_(name)) s = x; });
  if (!s) throw new Error('That student is not on the class list.');
  var text = clean_(note, 80) || (p > 0 ? 'Bonus from your teacher' : 'Taken away by your teacher');
  var res = hubLog_({ cls: cls, reg: s.reg, name: s.name }, '', p, text, 'Teacher');
  if (!res.ok) throw new Error(res.note.replace(/^Not given yet: /, ''));
  return { points: p };
}

/* ---------------- a lesson: start, end, and the phone ---------------- */
/* Start lesson sets everything at once: today's slides, the class follows the presenter view, answers
   held until released, hooks together, videos on the board, no pause. The chapter check opens by itself
   when the presenter view reaches it. End lesson takes it all off, so students can finish at home. */
function apiStartLesson(pin, deckId, cls, from, to, title) {
  checkPin_(pin);
  endOtherLessons_(deckId, cls);
  try { endOtherClasses_(cls); } catch (err) { /* they end by themselves */ }
  try { noteStart_(deckId, cls, Math.round(Number(from) || 0), Math.round(Number(to) || 0)); } catch (err) { /* only for the timetable */ }
  var c = apiSetControlNoPin_(deckId, cls, { from: from, to: to, follow: true, hold: true, hooks: true, vid: true, pause: false, fun: false, keep: false });
  c.lesson = { t: clean_(title, 80), at: Date.now(), end: lessonEndFor_(cls, Date.now()) };
  c.leadAt = Date.now();
  saveCtlRaw_(deckId, cls, c);
  try { autoAlloc_(deckId, cls); } catch (err) { /* opened for revision next time */ }
  try { noteTaught_(deckId, cls, Math.round(Number(from) || 0), Math.round(Number(to) || 0), title); } catch (err) { /* only for Teach next */ }
  return apiGetControl(pin, deckId, cls, c);
}
/* A class has one lesson at a time: starting one ends any other lesson still running for that class, so
   learnwithmrcedric shows the right lesson in class now. */
function endOtherLessons_(deckId, cls) {
  readDecks_().forEach(function (d) {
    if (d.id === deckId) return;
    var c = getCtl_(d.id, cls);
    if (!c.lesson) return;
    c = apiSetControlNoPin_(d.id, cls, { follow: false, pause: false, hold: false, to: 0, from: 0 });
    noteLessonEnd_(c);
    c.lesson = null;
    saveCtlRaw_(d.id, cls, c);
  });
}
/* For the slides in presenter mode: the classes, the parts of this lesson, and which classes are in this
   lesson now. */
function presentInfo_(d) {
  var deckId = clean_(d.topicId, 120);
  var classes = Object.keys(readRoster_()).sort();
  var rec = null;
  try { rec = deckSlides_(deckId, 0); } catch (err) { rec = null; }
  var running = {};
  classes.forEach(function (cls) { var c = getCtl_(deckId, cls); if (c.lesson) running[cls] = { t: c.lesson.t, at: c.lesson.at }; });
  return { ok: true, classes: classes, lessons: rec && rec.lessons ? rec.lessons : [], running: running };
}
/* The teacher chose a class on the slides: start the lesson for it, or carry on with the one running
   (started in the last 3 hours), so a reload or Live Board's Start lesson is not undone. */
function presentStart_(d) {
  var deckId = clean_(d.topicId, 120), cls = String(d.cls || '').toUpperCase();
  if (!deckId || !cls || !readRoster_()[cls]) return { ok: false, error: 'That class is not on the class list.' };
  var c = getCtl_(deckId, cls), from = Math.round(Number(d.from) || 0), to = Math.round(Number(d.to) || 0);
  // force: the part was chosen in the Teacher Hub, so a different part still running is replaced.
  if (c.lesson && Date.now() - (c.lesson.at || 0) < 3 * 3600000 && (!d.force || ((c.from || 0) === from && (c.to || 0) === to))) { checkPin_(d.pin); return { ok: true, ctl: c, kept: true }; }
  apiStartLesson(d.pin, deckId, cls, from, to, clean_(d.title || 'The whole lesson', 80));
  return { ok: true, ctl: getCtl_(deckId, cls) };
}
function apiEndLesson(pin, deckId, cls) {
  checkPin_(pin);
  var c = apiSetControlNoPin_(deckId, cls, { follow: false, pause: false, hold: false, to: 0, from: 0 });
  try { if (c.lesson) noteLessonLength_(cls, c.lesson.at || 0, Date.now()); } catch (err) { /* only for the timetable */ }
  noteLessonEnd_(c);
  c.lesson = null;
  saveCtlRaw_(deckId, cls, c);
  try { projectorEnded_(deckId, String(cls || '').toUpperCase()); } catch (err) { /* the projector stays on the slides */ }
  return apiGetControl(pin, deckId, cls, c);
}
function saveCtlRaw_(deckId, cls, c) {
  var raw = JSON.stringify(c);
  PropertiesService.getScriptProperties().setProperty(ctlKey_(deckId, cls), raw);
  cachePut_(ctlKey_(deckId, cls), raw, 21600);
}
/* The slide the chapter check is on (its first question's slide), or 0. */
function checkSlideNo_(deckId) {
  var d = findDeck_(deckId);
  if (!d || !d.check || !d.check.length) return 0;
  var n = 0;
  readDeckBoardsFor_(deckId).forEach(function (b) { if (b.taskId === d.check[0]) n = b.slideNo || 0; });
  return n;
}

/* Signing in a phone with no typing: the laptop shows a QR code with a one-time key, the phone scans
   it, the laptop asks "A phone wants to sign in. Allow?", and only then does the phone get in. */
function apiPhoneStart(pin) {
  checkPin_(pin);
  var k = Utilities.getUuid().replace(/-/g, '').slice(0, 24);
  cachePut_('ph_' + k, JSON.stringify({ state: 'wait', at: Date.now() }), 600);
  return { k: k };
}
function phoneRec_(k) {
  var raw = CacheService.getScriptCache().get('ph_' + String(k || '').slice(0, 40));
  return raw ? JSON.parse(raw) : null;
}
function apiPhoneState(pin, k) {
  checkPin_(pin);
  var r = phoneRec_(k);
  return r ? { state: r.state, device: r.device || '' } : { state: 'gone' };
}
function apiPhoneAllow(pin, k, allow) {
  checkPin_(pin);
  var r = phoneRec_(k);
  if (!r) throw new Error('That code has run out. Press Phone again.');
  r.state = allow ? 'ok' : 'no';
  cachePut_('ph_' + k, JSON.stringify(r), 300);
  return { state: r.state };
}
/* Called by the phone (no PIN yet). The first phone to scan the code holds it. */
function apiPhoneJoin(k, device) {
  var r = phoneRec_(k);
  if (!r) return { state: 'gone' };
  if (r.state === 'wait') { r.state = 'asked'; r.device = clean_(device, 40); cachePut_('ph_' + k, JSON.stringify(r), 300); }
  if (r.state === 'ok') {
    CacheService.getScriptCache().remove('ph_' + k);
    return { state: 'ok', pin: devIssue_('phone', r.device || 'Phone') };   // a key for a year, not the PIN itself
  }
  return { state: r.state };
}

/* The phone during a lesson: the questions on one slide (normally the presenter's), with who has not
   answered them, in one call. */
function apiSlideNow(pin, deckId, cls, n, withTexts) {
  checkPin_(pin);
  n = Math.round(Number(n) || 0);
  var qs = readDeckBoardsFor_(deckId).filter(function (b) { return b.slideNo === n; })
    .sort(function (a, b) { return a.order - b.order; });
  var roster = readRoster_()[cls] || [];
  var prefix = 'D:' + deckId + ':';
  var byQ = qs.length ? slideTallyFast_(qs, cls, roster) : {};
  var fromTab = !byQ;
  if (fromTab) { byQ = {}; qs.forEach(function (b) { byQ[b.id] = { first: {}, any: {} }; }); }
  if (qs.length && fromTab) {
    postRows_('pd_' + deckId, function (r) { return r[0] && String(r[1]).indexOf(prefix) === 0; }).rows.forEach(function (r) {
      var q = byQ[String(r[1])];
      if (!q || normClass_(r[3]) !== normClass_(cls)) return;
      var k = normName_(r[5]), t = r[2] ? new Date(r[2]).getTime() : 0;
      q.any[k] = true;
      if (!q.first[k] || t < q.first[k].t) q.first[k] = { t: t, text: String(r[7] || ''), ok: r[12] === '' || r[12] == null ? null : bool_(r[12]) };
    });
    primeTally_(qs, cls, byQ);
  }
  var c = getCtl_(deckId, cls);
  return { n: n, held: c.hold && !c.relAll, questions: qs.map(function (b) {
    var q = byQ[b.id], firsts = Object.keys(q.first).map(function (k) { return q.first[k]; });
    var marked = firsts.filter(function (f) { return f.ok !== null; }), right = marked.filter(function (f) { return f.ok; }).length;
    var wrong = {};
    marked.forEach(function (f) { if (!f.ok) { var w = f.text.slice(0, 60); wrong[w] = (wrong[w] || 0) + 1; } });
    var top = Object.keys(wrong).sort(function (a, b2) { return wrong[b2] - wrong[a]; })[0];
    // For a choice question, how the first tries spread over the options (the phone draws these as bars).
    var choices = null;
    if (b.kind === 'choice' && b.columns && b.columns.length) {
      var cnt = {};
      firsts.forEach(function (f) { cnt[f.text] = (cnt[f.text] || 0) + 1; });
      choices = b.columns.map(function (o) { return { t: String(o), n: cnt[String(o)] || 0, ok: !!b.correct && String(o) === b.correct }; });
    }
    // For Show answers on the projector: what the class wrote (first tries, in the order they came, no names).
    var texts = null;
    if (withTexts && b.kind !== 'choice') {
      texts = firsts.slice().sort(function (x, y) { return (x.t || 0) - (y.t || 0); })
        .map(function (f) { return { x: String(f.text || '').slice(0, 300), ok: f.ok }; }).filter(function (f) { return f.x.trim(); }).slice(0, 150);
    }
    return { id: b.id, taskId: b.taskId, title: b.title, kind: b.kind, answered: Object.keys(q.any).length, size: roster.length,
      firsts: firsts.length, right: right, choices: choices, texts: texts,
      pct: marked.length ? Math.round(100 * right / marked.length) : null, wrong: top ? [top, wrong[top]] : null,
      released: c.relAll || c.rel.indexOf(b.taskId) >= 0,
      missing: roster.filter(function (s) { return !q.any[normName_(s.name)]; }).map(function (s) { return s.name; }) };
  }) };
}

/* ------------------------------------------------------------------ */
/* Student sign-in: a PIN each, a security question, the name locked   */
/* ------------------------------------------------------------------ */
/* Each student has a 4-digit PIN they choose, and a security question they choose from the list below with
   their own answer. The first time, they prove who they are with their register number (or their teacher lets
   them in from the phone), then set the PIN and the question. After that they sign in with the PIN, and Forgot
   my PIN asks the question and sets a new PIN. Only a salted hash of the PIN and of the answer is kept, in this
   script's properties (never on a sheet). A sign-in is a signed ticket kept on the iPad (learnwithmrcedric and the
   slides); it names the student and lasts 200 days. The teacher can sign a student out everywhere (Sign out on
   the phone or in Classes), or reset their PIN so they set it up again. Changing the PIN signs them out
   everywhere else too. */
var ST_QUESTIONS = [
  'What is the name of your first pet?',
  'What is your favourite food?',
  'What is your favourite animal?',
  'What is the name of your primary school?',
  'What is your favourite book or film?',
  'Who is your favourite singer or band?',
  'What is your favourite sport or game?',
  'What is your favourite place to visit?'
];
var ST_DAYS = 200;
var ST_PIN_TRIES = 5, ST_PIN_WAIT = 15;       // wrong PINs, then minutes to wait
var ST_ANS_TRIES = 3, ST_ANS_WAIT = 60;       // wrong answers to the question, then minutes to wait
var ST_REG_TRIES = 3, ST_REG_WAIT = 60;       // wrong register numbers at the first sign-in, then the teacher lets them in

function acctId_(cls, name) { return hash_(normClass_(cls) + '|' + normName_(name)); }
function acctGet_(id) {
  try { return JSON.parse(PropertiesService.getScriptProperties().getProperty('acct_' + id) || 'null'); } catch (err) { return null; }
}
function acctPut_(id, a) {
  PropertiesService.getScriptProperties().setProperty('acct_' + id, JSON.stringify(a));
  cachePut_('sv_' + id, String(a.v || 0), 21600);
}
/* The student on the class list, or an error. */
function rosterStudent_(cls, name) {
  var who = matchStudent_(cls, name);
  if (!who.matched) throw new Error('That name is not on the class list. Choose your class and your name again.');
  return who;
}
function stSecret_() {
  var props = PropertiesService.getScriptProperties(), s = props.getProperty('st_secret');
  if (!s) { s = Utilities.getUuid() + Utilities.getUuid(); props.setProperty('st_secret', s); }
  return s;
}
function b64u_(x) { return Utilities.base64EncodeWebSafe(x).replace(/=+$/, ''); }
function unb64u_(s) { s = String(s); while (s.length % 4) s += '='; return Utilities.newBlob(Utilities.base64DecodeWebSafe(s)).getDataAsString(); }
function stSign_(p) { return b64u_(Utilities.computeHmacSha256Signature(p, stSecret_())).slice(0, 32); }
function stIssue_(who, v) {
  var p = b64u_(Utilities.newBlob(JSON.stringify({ c: who.cls, n: who.name, v: v || 0, t: Date.now() })).getBytes());
  return 'st1.' + p + '.' + stSign_(p);
}
function stParse_(st) {
  var m = /^st1\.([A-Za-z0-9_-]{8,600})\.([A-Za-z0-9_-]{32})$/.exec(String(st || ''));
  if (!m || stSign_(m[1]) !== m[2]) return null;
  var x = null;
  try { x = JSON.parse(unb64u_(m[1])); } catch (err) { return null; }
  if (!x || !x.c || !x.n || !(Date.now() - x.t < ST_DAYS * 86400000)) return null;
  return x;
}
/* The student a ticket belongs to, or null when it is not valid any more (signed out, PIN reset or changed,
   too old, or the name has left the class list). ver: the account's version, when the caller already has it. */
function stCheck_(st, ver) {
  var x = stParse_(st);
  if (!x) return null;
  var id = acctId_(x.c, x.n);
  if (ver === undefined || ver === null) {
    ver = CacheService.getScriptCache().get('sv_' + id);
    if (ver === null || ver === undefined) { var a = acctGet_(id); ver = a ? String(a.v || 0) : '-'; cachePut_('sv_' + id, ver, 21600); }
  }
  if (String(ver) !== String(x.v || 0)) return null;
  if (!findStudent_(String(x.c).toUpperCase(), x.n)) return null;
  return { cls: String(x.c).toUpperCase(), name: x.n, id: id };
}
/* For the student pages: the student, or an error the page recognises (it shows the sign-in again). */
function stWho_(st) {
  var who = stCheck_(st);
  if (!who) throw new Error('SIGNED_OUT: Sign in again with your PIN.');
  return who;
}
function stHash_(salt, text) {
  var h = salt + '|' + text;
  for (var i = 0; i < 120; i++) h = b64u_(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, salt + '|' + h + '|' + text, Utilities.Charset.UTF_8));
  return h;
}
function stAnswer_(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9À-￿]+/g, ''); }
function stPinOk_(pin) {
  pin = String(pin == null ? '' : pin).trim();
  if (!/^\d{4}$/.test(pin)) throw new Error('Your PIN is 4 numbers.');
  if (/^(\d)\1{3}$/.test(pin) || pin === '1234' || pin === '4321' || pin === '0123' || pin === '9876') throw new Error('That PIN is too easy to guess. Choose another one.');
  return pin;
}
/* Wrong tries are counted in the script's properties, under the lock, and each try is counted before the PIN or
   answer is checked, so tries made at the same moment are all counted. After max tries in a window the student waits;
   after hard tries in all, only the teacher clears it (Sign out or Reset PIN). Three wrong register numbers send the
   student to the teacher for good (Let in, or Reset PIN). A right PIN or answer clears that count. */
var ST_LIMITS = { stf_: { max: ST_PIN_TRIES, mins: ST_PIN_WAIT, hard: 15 }, saf_: { max: ST_ANS_TRIES, mins: ST_ANS_WAIT, hard: 6 }, srf_: { max: ST_REG_TRIES, mins: 0, hard: ST_REG_TRIES } };
function stFails_(kind, id) {
  var f = null;
  try { f = JSON.parse(PropertiesService.getScriptProperties().getProperty(kind + id) || 'null'); } catch (err) { f = null; }
  return f || { n: 0, w: 0, t: 0 };
}
function stBlocked_(kind, id) {
  var L = ST_LIMITS[kind], f = stFails_(kind, id);
  if (f.t >= L.hard) return 'teacher';
  if (L.mins && f.n >= L.max && Date.now() - f.w < L.mins * 60000) return 'wait';
  return '';
}
function stTeacherMsg_(kind) { return kind === 'srf_' ? 'Ask your teacher to let you in.' : 'Too many wrong tries. Ask your teacher to reset your PIN.'; }
function stWaitMsg_(mins) { return 'Too many wrong tries. Wait ' + mins + ' minutes, or ask your teacher.'; }
/* Counts one try now. Returns how many are left after it (0: the next one is refused), or refuses this one. */
function stTry_(kind, id) {
  var L = ST_LIMITS[kind];
  return withLock_(function () {
    var f = stFails_(kind, id), now = Date.now();
    if (f.t >= L.hard) throw new Error(stTeacherMsg_(kind));
    if (!f.w || (L.mins && now - f.w >= L.mins * 60000)) { f.n = 0; f.w = now; }
    if (L.mins && f.n >= L.max) throw new Error(stWaitMsg_(L.mins));
    f.n++; f.t++;
    PropertiesService.getScriptProperties().setProperty(kind + id, JSON.stringify(f));
    return Math.max(0, Math.min(L.mins ? L.max - f.n : L.hard - f.t, L.hard - f.t));
  }, 10000);
}
function stMissMsg_(kind, left, what) {
  if (left > 0) return what + ' ' + left + (left === 1 ? ' try' : ' tries') + ' left.';
  return stBlocked_(kind, arguments[3]) === 'teacher' ? stTeacherMsg_(kind) : stWaitMsg_(ST_LIMITS[kind].mins);
}
function stClear_(kind, id) { PropertiesService.getScriptProperties().deleteProperty(kind + id); }

/* Step 1 of signing in: what this student needs (sign in with the PIN, or set it up the first time). */
function apiStStart(cls, name) {
  var who = rosterStudent_(cls, name), id = acctId_(who.cls, who.name), a = acctGet_(id);
  var set = !!(a && a.ph);
  return { ok: true, cls: who.cls, name: who.name, set: set, question: set ? ST_QUESTIONS[a.q] || '' : '',
    reg: !!who.reg && !stBlocked_('srf_', id), questions: ST_QUESTIONS, inLesson: classLive_(who.cls) && !stBlocked_('srf_', id),
    locked: set && !!stBlocked_('stf_', id) };
}
function apiStLogin(cls, name, pin) {
  var who = rosterStudent_(cls, name), id = acctId_(who.cls, who.name), a = acctGet_(id);
  if (!a || !a.ph) throw new Error('You have not set your PIN yet. Go back and choose your name again.');
  var left = stTry_('stf_', id);
  if (stHash_(a.s, String(pin == null ? '' : pin).trim()) !== a.ph) throw new Error(stMissMsg_('stf_', left, 'That PIN is not right.', id));
  stClear_('stf_', id);
  return { ok: true, st: stIssue_(who, a.v), cls: who.cls, name: who.name };
}
/* The first time: the register number (or the teacher's Let in, key), then the PIN and the question. */
function apiStSetup(cls, name, proof, pin, q, answer) {
  var who = rosterStudent_(cls, name), id = acctId_(who.cls, who.name);
  pin = stPinOk_(pin);
  q = Math.round(Number(q));
  if (!(q >= 0 && q < ST_QUESTIONS.length)) throw new Error('Choose a question.');
  var ans = stAnswer_(answer);
  if (ans.length < 2) throw new Error('Type an answer to your question that you will remember.');
  proof = proof || {};
  var cache = CacheService.getScriptCache();
  var a0 = acctGet_(id);
  if (a0 && a0.ph) throw new Error(who.name + ' already has a PIN. Go back and sign in, or use Forgot my PIN.');
  if (proof.key) {
    var key = clean_(proof.key, 40);
    var n = cache.get('ghn_' + key);
    if (cache.get('ghs_' + key) !== 'ok' || n !== who.cls + '|' + who.name) throw new Error('Your teacher has not let you in yet.');
    cache.remove('ghs_' + key);
  } else if (!String(proof.reg == null ? '' : proof.reg).trim() && classLive_(who.cls) && !stBlocked_('srf_', id)) {
    // In the class's own lesson the teacher is in the room, so no register number is needed. The phone shows
    // who set up a PIN this way.
    noteNewPin_(who.cls, who.name);
  } else {
    if (!who.reg) throw new Error('Your register number is not on the class list. Ask your teacher to let you in.');
    if (!String(proof.reg == null ? '' : proof.reg).trim()) throw new Error('Type your register number.');
    var left = stTry_('srf_', id);
    var typed = String(proof.reg == null ? '' : proof.reg).trim().replace(/^0+(?=\d)/, '');
    if (!typed || typed !== String(who.reg).trim().replace(/^0+(?=\d)/, '')) {
      throw new Error(left > 0 ? 'That register number does not match ' + who.name + '. ' + left + (left === 1 ? ' try' : ' tries') + ' left.' : 'That register number does not match. Ask your teacher to let you in.');
    }
  }
  return withLock_(function () {
    var a = acctGet_(id);
    if (a && a.ph) throw new Error(who.name + ' already has a PIN. Go back and sign in, or use Forgot my PIN.');
    var s = Utilities.getUuid().replace(/-/g, '');
    var v = (a ? Number(a.v) || 0 : 0) + 1;
    acctPut_(id, { c: who.cls, n: who.name, s: s, ph: stHash_(s, pin), q: q, ah: stHash_(s, 'a|' + ans), v: v, at: Date.now() });
    stClear_('srf_', id); stClear_('stf_', id); stClear_('saf_', id);
    return { ok: true, st: stIssue_(who, v), cls: who.cls, name: who.name };
  }, 10000);
}
/* Forgot my PIN: the answer to their question, then a new PIN. Every other sign-in of theirs ends. */
function apiStForgot(cls, name, answer, pin) {
  var who = rosterStudent_(cls, name), id = acctId_(who.cls, who.name);
  pin = stPinOk_(pin);
  var a = acctGet_(id);
  if (!a || !a.ph) throw new Error('You have not set your PIN yet. Go back and choose your name again.');
  var left = stTry_('saf_', id);
  if (stHash_(a.s, 'a|' + stAnswer_(answer)) !== a.ah) throw new Error(stMissMsg_('saf_', left, 'That is not the answer you chose.', id));
  return withLock_(function () {
    var b = acctGet_(id) || a;
    b.ph = stHash_(b.s, pin); b.v = (Number(b.v) || 0) + 1; b.at = Date.now();
    acctPut_(id, b);
    stClear_('saf_', id); stClear_('stf_', id);
    return { ok: true, st: stIssue_(who, b.v), cls: who.cls, name: who.name };
  }, 10000);
}
/* Is this sign-in still good? (learnwithmrcedric and the slides check when they open.) */
function apiStMe(st) {
  var who = stCheck_(st);
  return who ? { ok: true, cls: who.cls, name: who.name } : { ok: false };
}
/* The teacher: sign a student out on every iPad (kind 'out'), or reset their PIN and question too (kind 'pin'). */
function apiStReset(pin, cls, name, kind) {
  checkPin_(pin);
  var who = rosterStudent_(cls, name), id = acctId_(who.cls, who.name);
  return withLock_(function () {
    var a = acctGet_(id) || { c: who.cls, n: who.name, v: 0 };
    a.v = (Number(a.v) || 0) + 1;
    if (kind === 'pin') { delete a.ph; delete a.ah; delete a.q; delete a.s; delete a.at; }
    acctPut_(id, a);
    ['stf_', 'saf_', 'srf_'].forEach(function (k) { stClear_(k, id); });
    return { ok: true, set: !!a.ph };
  }, 10000);
}
/* Who in a class has set up a PIN, for Classes. */
function apiStStatus(pin, cls) {
  checkPin_(pin);
  var roster = readRoster_()[String(cls || '').toUpperCase()] || [], props = PropertiesService.getScriptProperties();
  var out = {};
  roster.forEach(function (s) {
    var a = null; try { a = JSON.parse(props.getProperty('acct_' + acctId_(cls, s.name)) || 'null'); } catch (err) { a = null; }
    out[s.name] = { set: !!(a && a.ph), at: a && a.at || 0 };
  });
  return out;
}
/* The student pages' calls through doPost (the slides): { api: 'st', op, ... }. */
function stRequest_(d) {
  try {
    if (d.op === 'start') return apiStStart(d.cls, d.name);
    if (d.op === 'login') return apiStLogin(d.cls, d.name, d.pin);
    if (d.op === 'setup') return apiStSetup(d.cls, d.name, { reg: d.reg, key: d.key }, d.pin, d.q, d.answer);
    if (d.op === 'forgot') return apiStForgot(d.cls, d.name, d.answer, d.pin);
    if (d.op === 'me') return apiStMe(d.st);
  } catch (err) {
    return { ok: false, error: String(err && err.message || err) };
  }
  return { ok: false, error: 'Unknown request.' };
}

/* ------------------------------------------------------------------ */
/* Revision: the lessons each class may open after school              */
/* ------------------------------------------------------------------ */
/* The teacher opens lessons to a class for revision (the Teacher Hub's Teach tab). Students in that class see
   them in learnwithmrcedric and can go through them any time, but outside the class's lesson nothing they do is saved
   and nothing counts: answers and pages count only while the teacher is teaching that lesson to their class. */
function allocAll_() {
  var cache = CacheService.getScriptCache(), hit = cache.get('alloc');
  if (hit) { try { return JSON.parse(hit); } catch (err) { /* read again */ } }
  var props = PropertiesService.getScriptProperties(), a = {};
  Object.keys(readRoster_()).forEach(function (c) {
    var k = normClass_(c), v = null;
    try { v = JSON.parse(props.getProperty('alloc_' + k) || 'null'); } catch (err) { v = null; }
    if (v && v.length) a[k] = v;
  });
  cachePut_('alloc', JSON.stringify(a), 21600);
  return a;
}
function allocFor_(cls) { return allocAll_()[normClass_(cls)] || []; }
/* One property for each class, so a long list for one class cannot fill the others. */
function setAlloc_(cls, deckId, on) {
  cls = normClass_(cls); deckId = clean_(deckId, 120);
  if (!cls || !deckId) throw new Error('Choose a class and a lesson.');
  return withLock_(function () {
    var props = PropertiesService.getScriptProperties(), list = [];
    try { list = JSON.parse(props.getProperty('alloc_' + cls) || '[]'); } catch (err) { list = []; }
    list = list.filter(function (x) { return x !== deckId; });
    if (on) list.push(deckId);
    if (list.length) props.setProperty('alloc_' + cls, JSON.stringify(list.slice(-150))); else props.deleteProperty('alloc_' + cls);
    CacheService.getScriptCache().remove('alloc');
    return allocAll_();
  }, 10000);
}
function apiSetAlloc(pin, cls, deckId, on) { checkPin_(pin); return setAlloc_(cls, deckId, !!on); }

/* Does a student's work at time t count? Only during the lesson the teacher is teaching their class (with a few
   minutes either side, for answers sent just before Start or just after End). */
var LATE_MINS = 60;
function inLessonWindow_(c, t) {
  if (isNaN(t)) t = Date.now();
  if (c.lesson) return true;   // the lesson is on: everything counts (an iPad's clock may be wrong)
  var L = c.last, slack = 5 * 60000;
  // After End: for an hour (by Live Board's clock), answers made in the lesson that arrive late (a dropped connection).
  return !!(L && Date.now() - (L.end || 0) < LATE_MINS * 60000 && t >= (L.at || 0) - slack && t <= (L.end || 0) + 2 * 60000);
}
/* Keeps when the lesson ran, so answers that arrive a little late (a slow connection) still count. */
function noteLessonEnd_(c) {
  if (c && c.lesson) c.last = { at: c.lesson.at || 0, end: Date.now() };
}

/* Avatars and the night market (in the homework space) are closed to a class while its lesson is running,
   unless the teacher turns them on (on the phone). The Teacher Hub asks this. */
function classState_(cls) {
  cls = String(cls || '').toUpperCase();
  var run = null;
  try { run = runningLessonFor_(cls); } catch (err) { run = null; }
  if (!run) return { live: false, fun: true };
  var c = getCtl_(run.id, cls);
  return { live: true, fun: !!c.fun, title: run.title, lesson: run.lesson };
}

/* learnwithmrcedric asks the teacher's phone to let a student in (no register number, or too many wrong ones). */
function apiGateHelp(cls, name, dev) { return gateHelp_({ cls: cls, name: name, dev: dev }); }
function apiGateHelpState(key) { return gateHelp_({ key: key }); }

/* ------------------------------------------------------------------ */
/* Sub-chapters, the class timetable, and what runs by itself           */
/* ------------------------------------------------------------------ */
/* A deck's parts are its sub-chapters. A part named with the textbook's number ("1.2 · SI units") carries that
   number, so the Teacher Hub can link a worksheet to it. */
function subNum_(label) {
  var m = /^\s*(\d+\.\d+[a-z]?)\b/i.exec(String(label || ''));
  return m ? m[1] : '';
}
/* The parts from the slides' own module labels (data-module), when the deck lists no lessons. */
function fromModules_(mods) {
  var runs = [];
  mods.forEach(function (label, i) {
    var last = runs[runs.length - 1];
    if (!label) { if (last) last.to = i + 1; return; }
    if (last && last.label === label) { last.to = i + 1; return; }
    runs.push({ label: label, from: runs.length ? i + 1 : 1, to: i + 1 });
  });
  if (runs.length < 2) return [];
  return runs.map(function (r) {
    var two = /^\s*0*(\d{1,2})\s*·\s*(.+)$/.exec(r.label);
    var t = subNum_(r.label) ? r.label.replace(/\s+/g, ' ').trim() : two ? 'Module ' + Number(two[1]) + ' · ' + two[2].trim() : r.label;
    return { t: t, from: r.from, to: r.to, num: subNum_(r.label) };
  });
}

/* The class timetable, learnt from when lessons start: each class's lesson times in a week. A time counts once
   lessons have started near it (within 15 minutes) twice in four weeks, so a one-off (a make-up lesson, a look at
   the slides in the evening) is not a lesson time. The next lesson is the next of those times at least 3 hours
   away; with no timetable yet, the same time a week after the lesson taught. */
var SLOT_KEEP = 40, SLOT_NEAR_MINS = 15;
function tzOffset_() {
  var z = Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'Asia/Singapore', 'Z');
  var m = /^([+-])(\d\d)(\d\d)$/.exec(z || '');
  return m ? (m[1] === '-' ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3])) * 60000 : 8 * 3600000;
}
function slotsFor_(cls) {
  try { return JSON.parse(PropertiesService.getScriptProperties().getProperty('slots_' + normClass_(cls)) || '[]'); } catch (err) { return []; }
}
function noteStart_(deckId, cls, from, to) {
  var props = PropertiesService.getScriptProperties(), now = Date.now();
  var s = slotsFor_(cls).filter(function (t) { return now - t > 3 * 3600000; });   // one entry per lesson
  s.push(now);
  props.setProperty('slots_' + normClass_(cls), JSON.stringify(s.slice(-SLOT_KEEP)));
}
function lessonTimes_(cls, after) {
  var off = tzOffset_(), DAY = 86400000, pts = [];
  slotsFor_(cls).forEach(function (t) {
    if (after - t >= 28 * DAY || t > after) return;
    var d = new Date(t + off);
    pts.push({ wd: d.getUTCDay(), min: d.getUTCHours() * 60 + d.getUTCMinutes() });
  });
  pts.sort(function (a, b) { return a.wd - b.wd || a.min - b.min; });
  var keys = [], run = [];
  var flush = function () { if (run.length >= 2) keys.push(run[0].wd * 1440 + Math.round(run[0].min / 5) * 5); run = []; };
  pts.forEach(function (p) {
    if (run.length && (p.wd !== run[0].wd || p.min - run[run.length - 1].min > SLOT_NEAR_MINS)) flush();
    run.push(p);
  });
  flush();
  return keys;   // weekday * 1440 + minutes, at the earliest start of each group (to 5 minutes)
}
function nextLesson_(cls, after, taughtAt) {
  var off = tzOffset_(), DAY = 86400000, keys = lessonTimes_(cls, after);
  var aL = after + off, dayStart = Math.floor(aL / DAY) * DAY, aWd = new Date(aL).getUTCDay(), best = 0;
  keys.forEach(function (k) {
    var wd = Math.floor(k / 1440), min = k % 1440;
    var at = dayStart + ((wd - aWd + 7) % 7) * DAY + min * 60000;
    while (at <= aL + 3 * 3600000) at += 7 * DAY;
    if (!best || at < best) best = at;
  });
  if (best) return best - off;
  // No timetable yet: a week after the start of the lesson it was taught in (not the minute it was finished).
  var start = Number(taughtAt) || after;
  slotsFor_(cls).forEach(function (s) { if (s <= taughtAt && taughtAt - s < 3 * 3600000 && s < start) start = s; });
  var at2 = start + 7 * DAY;
  while (at2 <= after + 3 * 3600000) at2 += 7 * DAY;
  return at2;
}

/* What each class has been taught: each slide the presenter stayed on for 8 seconds or more in the class's lesson,
   with when it was last shown (to the minute), kept for 150 days. Slides are known by a short code made from the
   slide's id, so a lesson updated with slides added or taken out keeps what was shown. One script property per
   class and lesson:   vis_<CLASS>|<lesson id>   { b: first minute, v: "code.minutes-after-b (base 36),..." }
   A sub-chapter is taught once about 70% of its slides have been shown, including its last slide (or the one
   before it, for a sub-chapter of four slides or more) shown after at least half of those, over one lesson or
   several. So a deck that reopens on a slide far ahead, or a quick page through the slide list, teaches nothing. */
var VISIT_SECS = 8, VISIT_KEEP_DAYS = 150, VISIT_SHARE = 0.7;
function visKey_(cls, deckId) { return 'vis_' + normClass_(cls) + '|' + String(deckId).slice(0, 120); }
function slideCode_(id) {
  var h = 2166136261, s = String(id || '');
  for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return (h % 60466176).toString(36);   // at most 5 characters
}
function visRead_(raw) {
  var o = {}, j = null;
  try { j = raw ? JSON.parse(raw) : null; } catch (err) { j = null; }
  if (!j) return o;
  var b = Number(j.b) || 0;
  String(j.v || '').split(',').forEach(function (p) { var q = p.split('.'); if (q.length === 2 && q[0]) o[q[0]] = b + parseInt(q[1], 36); });
  return o;
}
function visWrite_(o) {
  var keys = Object.keys(o), b = 0;
  keys.forEach(function (k) { if (!b || o[k] < b) b = o[k]; });
  return JSON.stringify({ b: b, v: keys.map(function (k) { return k + '.' + (o[k] - b).toString(36); }).join(',') });
}
function noteVisit_(deckId, cls, slideId) {
  if (!slideId) return;
  var code = slideCode_(slideId), key = visKey_(cls, deckId), cache = CacheService.getScriptCache(), now = Math.floor(Date.now() / 60000);
  var hit = cache.get(key);
  if (hit !== null && hit !== undefined) { var seen = visRead_(hit)[code]; if (seen && now - seen < 60) return; }   // shown in the last hour
  withLock_(function () {
    var props = PropertiesService.getScriptProperties(), cur = visRead_(props.getProperty(key));
    if (!cur[code] || now - cur[code] >= 60) {
      var keep = now - VISIT_KEEP_DAYS * 1440;
      Object.keys(cur).forEach(function (k) { if (cur[k] < keep) delete cur[k]; });
      cur[code] = now;
      props.setProperty(key, visWrite_(cur));
    }
    cachePut_(key, visWrite_(cur), 21600);
  }, 10000);
}
// When a part became taught (ms), or 0. codes: the part's slide codes in order.
function partTaughtAt_(vis, codes) {
  var n = codes.length, need = Math.max(1, Math.round(n * VISIT_SHARE)), list = [];
  if (!n) return 0;
  codes.forEach(function (c, i) { if (vis[c]) list.push({ i: i, t: vis[c] }); });
  if (list.length < need) return 0;
  list.sort(function (a, b) { return a.t - b.t || a.i - b.i; });
  var count = 0, end = false;
  for (var k = 0; k < list.length; k++) {
    // the last slide (or the one before) counts once at least half the slides needed were shown before it
    if ((list[k].i === n - 1 || (n >= 4 && list[k].i === n - 2)) && (n <= 2 || count >= Math.ceil(need / 2))) end = true;
    count++;
    if (count >= need && end) return list[k].t * 60000 + 59999;   // by the end of that minute
  }
  return 0;
}
/* The Hub asks which sub-chapters have become taught since a time: one entry per class and sub-chapter, with when
   it became taught and the class's next lesson from now. */
function taughtSince_(since) {
  var all = PropertiesService.getScriptProperties().getProperties(), parts = allDeckParts_(true), out = [], now = Date.now();
  since = Number(since) || 0;
  Object.keys(all).forEach(function (k) {
    if (k.indexOf('vis_') !== 0) return;
    var rest = k.slice(4), bar = rest.indexOf('|');
    if (bar < 0) return;
    var cls = rest.slice(0, bar), deck = rest.slice(bar + 1), vis = visRead_(all[k]);
    var p = parts[deck] || { lessons: [], slides: 0, dom: [] }, ls = p.lessons || [], dom = p.dom || [];
    var codes = function (from, to) { return dom.slice(Math.max(0, from - 1), Math.max(0, to)).map(slideCode_); };
    var add = function (i, l, at) {
      if (at > since) out.push({ cls: cls, deck: deck, parts: [{ i: i, num: String(l.num || ''), t: String(l.t || '') }], at: at, next: nextLesson_(cls, Math.max(at, now), at) });
    };
    ls.forEach(function (l, i) { add(i, l, partTaughtAt_(vis, codes(l.from, l.to))); });
    if (!ls.length && dom.length) add(-1, {}, partTaughtAt_(vis, codes(1, dom.length)));
  });
  out.sort(function (a, b) { return a.at - b.at; });
  return out;
}

/* Lessons open for revision by themselves once taught to a class. A lesson the teacher closes stays closed. */
function allocOff_(cls) {
  try { return JSON.parse(PropertiesService.getScriptProperties().getProperty('alloc_off_' + normClass_(cls)) || '[]'); } catch (err) { return []; }
}
function setAllocOff_(cls, deckId, off) {
  var list = allocOff_(cls).filter(function (x) { return x !== deckId; });
  if (off) list.push(deckId);
  PropertiesService.getScriptProperties().setProperty('alloc_off_' + normClass_(cls), JSON.stringify(list.slice(-150)));
}
function autoAlloc_(deckId, cls) {
  if (allocOff_(cls).indexOf(deckId) >= 0 || allocFor_(cls).indexOf(deckId) >= 0) return;
  setAlloc_(cls, deckId, true);
}

/* A lesson ends by itself 10 minutes after the slides on the projector stop checking in (closed, or the
   laptop asleep). If the same slides come back within an hour, the lesson carries on. */
var IDLE_END_MINS = 10;
function lastAlive_(deckId, cls, c, leadRaw) {
  var alive = (c.lesson && c.lesson.at) || 0;
  if (c.leadAt) alive = Math.max(alive, c.leadAt);
  var raw = leadRaw !== undefined ? leadRaw : CacheService.getScriptCache().get(leadKey_(deckId, cls));
  try { var l = raw ? JSON.parse(raw) : null; if (l) alive = Math.max(alive, l.alive || l.at || 0); } catch (err) { /* none */ }
  return alive;
}
function endIdle_(deckId, cls, c, alive) {
  try { noteLessonLength_(cls, c.lesson.at || 0, alive); } catch (err) { /* only for the timetable */ }
  c.last = { at: c.lesson.at || 0, end: alive, idle: true, t: c.lesson.t, from: c.from || 0, to: c.to || 0, follow: !!c.follow, keep: !!c.keep, xend: c.lesson.end || 0 };
  c.lesson = null; c.follow = false; c.pause = false; c.hold = false; c.to = 0; c.from = 0;
  try { saveCtlRaw_(deckId, cls, c); } catch (err) { /* read again next time */ }
  return c;
}
function checkIdle_(deckId, cls, c, leadRaw) {
  if (!c || !c.lesson) return c;
  var alive = lastAlive_(deckId, cls, c, leadRaw);
  return idleOver_(c, alive) ? endIdle_(deckId, cls, c, alive) : c;
}

/* Answers show by themselves: when the presenter moves past a question's slide, or when everyone in the lesson
   has answered it. "Keep answers hidden" (on the phone) turns this off for the lesson. */
function releaseIds_(deckId, cls, ids) {
  if (!ids.length) return;
  withLock_(function () {
    var c = getCtl_(deckId, cls), add = ids.filter(function (t) { return c.rel.indexOf(t) < 0; });
    if (!add.length || !c.hold) return;
    c.rel = c.rel.concat(add).slice(-200);
    saveCtlRaw_(deckId, cls, c);
  }, 10000);
}
function autoReleasePast_(deckId, cls, c, n, prev) {
  if (!c.lesson || !c.hold || c.keep || !n || !prev || n <= prev) return;
  var ids = [];
  readDeckBoardsFor_(deckId).forEach(function (b) { if (b.taskId && b.slideNo && b.slideNo >= prev && b.slideNo < n && c.rel.indexOf(b.taskId) < 0) ids.push(b.taskId); });
  releaseIds_(deckId, cls, ids);
}
function autoReleaseAnswered_(deckId, cls, boardIds) {
  var c = getCtl_(deckId, cls);
  if (!c.lesson || !c.hold || c.keep || !boardIds.length) return;
  var names = (readRoster_()[cls] || []).map(function (s) { return s.name; }), cache = CacheService.getScriptCache(), now = Date.now();
  var pulses = names.length ? cache.getAll(names.map(function (nm) { return pulseStudentKey_(deckId, cls, nm); })) : {};
  var here = names.filter(function (nm) {
    var x = null; try { x = JSON.parse(pulses[pulseStudentKey_(deckId, cls, nm)] || 'null'); } catch (err) { x = null; }
    return x && now - x.at < 60000 && !x.away;
  });
  if (here.length < 2) return;
  var boards = {}, ids = [];
  readDeckBoardsFor_(deckId).forEach(function (b) { boards[b.id] = b; });
  boardIds.forEach(function (id) {
    var b = boards[id];
    if (!b || !b.taskId || c.rel.indexOf(b.taskId) >= 0) return;
    var got = cache.getAll(here.map(function (nm) { return tallyKey_(id, cls, nm); }));
    if (Object.keys(got).length >= here.length) ids.push(b.taskId);
  });
  releaseIds_(deckId, cls, ids);
}

/* For the Teacher Hub: Let in from its Needs you list, and the Monday summary. */
function hubLetIn_(d) {
  var cls = String(d.cls || '').toUpperCase(), key = clean_(d.gkey, 40);
  if (!key) return { ok: false, error: 'No request.' };
  withLock_(function () {
    cachePut_('ghs_' + key, d.yes ? 'ok' : 'no', 600);
    cachePut_(gateHelpKey_(cls), JSON.stringify(gateHelpList_(cls).filter(function (x) { return x.key !== key; })), 600);
  }, 10000);
  return { ok: true };
}
function hubSummary_() {
  var roster = readRoster_(), props = PropertiesService.getScriptProperties(), rules = checkRules_(), weekAgo = Date.now() - 7 * 86400000;
  var titles = {};
  readDecks_().forEach(function (d) { titles[d.id] = d.title; });
  return Object.keys(roster).sort().filter(function (c) { return c !== 'TEST'; }).map(function (cls) {
    var noPin = roster[cls].filter(function (s) {
      var a = null; try { a = JSON.parse(props.getProperty('acct_' + acctId_(cls, s.name)) || 'null'); } catch (err) { a = null; }
      return !(a && a.ph);
    }).map(function (s) { return s.name; });
    var below = [];
    try {
      readChecksFor_(cls).forEach(function (c) {
        var pct = rules.best ? c.best : c.first;
        if (c.tries && c.last > weekAgo && pct != null && pct < rules.pass) below.push({ name: c.name, deck: titles[c.deckId] || c.deck, pct: pct });
      });
    } catch (err) { below = []; }
    return { cls: cls, noPin: noPin, below: below };
  });
}

/* A first PIN set up in the class's lesson with no register number is noted for two hours, so the phone can show
   who did it (a wrong one is undone with Reset PIN). */
function noteNewPin_(cls, name) {
  var k = 'np_' + normClass_(cls), list = [];
  try { list = JSON.parse(CacheService.getScriptCache().get(k) || '[]'); } catch (err) { list = []; }
  list = list.filter(function (x) { return Date.now() - x.at < 7200000 && x.n !== name; });
  list.push({ n: name, at: Date.now() });
  cachePut_(k, JSON.stringify(list.slice(-60)), 7200);
}
function newPins_(cls) {
  var list = [];
  try { list = JSON.parse(CacheService.getScriptCache().get('np_' + normClass_(cls)) || '[]'); } catch (err) { list = []; }
  return list.filter(function (x) { return Date.now() - x.at < 7200000; }).map(function (x) { return x.n; });
}

function classLive_(cls) { try { return !!runningLessonFor_(String(cls || '').toUpperCase()); } catch (err) { return false; } }
