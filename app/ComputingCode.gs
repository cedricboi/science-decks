/* ================================================================== */
/* Computing: the Spreadsheet Coaches, students' files and their PINs   */
/* ================================================================== */
//
// Release 28. Kept apart from Science on purpose:
//   - Computing students are listed in their own tab of the Teacher Hub sheet, "Computing students"
//     (Class, Reg No, Name, Code). Science classes, homework, the tracker and points never see them.
//   - Each computing student has their own PIN and security question (the same rules as learnwithmrcedric), kept as
//     salted hashes in this script's properties under a namespace of their own, so a student who is in a science class
//     and a computing class has two separate sign-ins.
//   - Every file a Coach checks is saved in Drive: Worksheet Hub > Computing > class > sub-chapter > student code, and
//     named with the code, never the name. Every try is kept. The "Computing files" tab of the Hub sheet lists them.
//   - The Coaches (one HTML file per sub-chapter) and their Excel task files stay private: they sit in the teacher's
//     Drive, in Worksheet Hub > Computing > Coaches and task files. computing.json on the lesson site only lists their
//     names. Students download a Coach from the Computing page, open it on their laptop and sign in once inside it.
//     The teacher opens each Coach to a class in the Teacher Hub's Computing tab.
//
// One web address, as before:
//   /exec?computing        the students' computing page
//   doPost { api: 'cmp' }  the Coaches: sign in, save a checked file, list files

var CMP_ROSTER_TAB = 'Computing students';
var CMP_LOG_TAB = 'Computing files';
var CMP_LOG_COLS = ['Saved at', 'Class', 'Code', 'Coach', 'Part', 'Part name', 'Try', 'Score', 'Out of', 'File name', 'File ID', 'Upload ID'];
var CMP_FOLDER = 'Computing';
var CMP_MAX_BYTES = 8 * 1024 * 1024;     // an Excel file from a Coach task is far smaller than this
var CMP_ASSETS = 'Coaches and task files';
var CMP_CATALOG_RAW = 'https://raw.githubusercontent.com/cedricboi/science-decks/main/computing.json';

/* ---------- the class list ---------- */

function cmpSs_() { hubSheet_(TABS.students.name); return HUB_SS_; }
function cmpTab_(name, headers) {
  var ss = cmpSs_(), sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold').setBackground('#e8f3ec');
    sh.setFrozenRows(1);
  }
  return sh;
}
function cmpRosterSheet_() { return cmpTab_(CMP_ROSTER_TAB, ['Class', 'Reg No', 'Name', 'Code']); }
function cmpNormClass_(c) { return String(c || '').trim().toUpperCase().replace(/\s+/g, ''); }

/* { CLASS: [{ name, reg, code }] }, cached two minutes. Codes (C001, C002 ...) are filled in by themselves and never
   given twice. */
function cmpRoster_() {
  var cache = CacheService.getScriptCache(), hit = cache.get('cmp_roster');
  if (hit) { try { return JSON.parse(hit); } catch (err) { /* read again */ } }
  var sh = cmpRosterSheet_(), last = sh.getLastRow(), out = {};
  if (last >= 2) {
    var rows = sh.getRange(2, 1, last - 1, 4).getValues(), wrote = false, props = PropertiesService.getScriptProperties();
    var top = Number(props.getProperty('CMP_CODE_N') || 0), used = {};
    rows.forEach(function (r) { var c = String(r[3] || '').trim().toUpperCase(); if (/^C\d+$/.test(c)) { used[c] = (used[c] || 0) + 1; top = Math.max(top, Number(c.slice(1))); } });
    rows.forEach(function (r) {
      var cls = cmpNormClass_(r[0]), name = String(r[2] || '').replace(/\s+/g, ' ').trim();
      if (!cls || !name) return;
      var code = String(r[3] || '').trim().toUpperCase();
      if (!/^C\d+$/.test(code) || used[code] > 1) {
        if (used[code] > 1) used[code]--;
        top++; code = 'C' + (top < 1000 ? ('00' + top).slice(-3) : String(top));
        r[3] = code; used[code] = 1; wrote = true;
      }
      (out[cls] = out[cls] || []).push({ name: name, reg: String(r[1] == null ? '' : r[1]).trim(), code: code });
    });
    if (wrote) {
      withLock_(function () { sh.getRange(2, 4, rows.length, 1).setValues(rows.map(function (r) { return [r[3]]; })); props.setProperty('CMP_CODE_N', String(top)); }, 10000);
    }
    Object.keys(out).forEach(function (c) {
      out[c].sort(function (a, b) { var x = Number(a.reg), y = Number(b.reg); return (a.reg && b.reg && !isNaN(x) && !isNaN(y) && x !== y) ? x - y : a.name.localeCompare(b.name); });
    });
  }
  cachePut_('cmp_roster', JSON.stringify(out), 120);
  return out;
}
function cmpClasses_() { return Object.keys(cmpRoster_()).sort(); }
function cmpFind_(cls, name) {
  var list = cmpRoster_()[cmpNormClass_(cls)] || [];
  for (var i = 0; i < list.length; i++) if (list[i].name === name) return list[i];
  return null;
}
/* The name as typed, matched like learnwithmrcedric's (capitals, spaces and word order do not matter; two words of a
   long name are enough when they fit one student only). The class list never leaves the server. */
function cmpTyped_(cls, typed) {
  var key = cmpNormClass_(cls), tw = nameWords_(typed);
  if (!cmpRoster_()[key] || !tw.length || String(typed).length > 120) return null;
  var tj = tw.join(''), ts = tw.slice().sort().join(' '), exact = [], part = [];
  cmpRoster_()[key].forEach(function (s) {
    var w = nameWords_(s.name);
    if (w.slice().sort().join(' ') === ts || w.join('') === tj) exact.push(s);
    else if (tw.length >= 2 && tw.every(function (x) { return w.indexOf(x) >= 0; })) part.push(s);
  });
  var hit = exact.length === 1 ? exact[0] : !exact.length && part.length === 1 ? part[0] : null;
  // cls carries the CMP: namespace, so the account and the tries never meet a science sign-in.
  return hit ? { cls: 'CMP:' + key, plain: key, name: hit.name, reg: hit.reg, code: hit.code } : null;
}

/* ---------- PINs and tickets ---------- */

function cmpIssue_(who, v) {
  var p = b64u_(Utilities.newBlob(JSON.stringify({ k: 'cmp', c: who.plain, n: who.name, v: v || 0, t: Date.now() })).getBytes());
  return 'ct1.' + p + '.' + stSign_('cmp|' + p);
}
/* The student a computing ticket belongs to, or null (signed out, PIN reset, too old, or no longer on the list). */
function cmpCheck_(ct) {
  var m = /^ct1\.([A-Za-z0-9_-]{8,600})\.([A-Za-z0-9_-]{32})$/.exec(String(ct || ''));
  if (!m || stSign_('cmp|' + m[1]) !== m[2]) return null;
  var x = null;
  try { x = JSON.parse(unb64u_(m[1])); } catch (err) { return null; }
  if (!x || x.k !== 'cmp' || !x.c || !x.n || !(Date.now() - x.t < ST_DAYS * 86400000)) return null;
  var id = acctId_('CMP:' + x.c, x.n), cache = CacheService.getScriptCache(), ver = cache.get('sv_' + id);
  if (ver === null || ver === undefined) { var a = acctGet_(id); ver = a ? String(a.v || 0) : '-'; cachePut_('sv_' + id, ver, 21600); }
  if (String(ver) !== String(x.v || 0)) return null;
  var s = cmpFind_(x.c, x.n);
  if (!s) return null;
  return { cls: cmpNormClass_(x.c), name: s.name, code: s.code, id: id };
}
function cmpWho_(ct) {
  var who = cmpCheck_(ct);
  if (!who) throw new Error('SIGNED_OUT: Sign in again with your PIN.');
  return who;
}
function cmpOut_(who, v) { return { ok: true, ct: cmpIssue_(who, v), cls: who.plain, name: who.name }; }
var CMP_NOMATCH_PIN = 'That name and PIN do not match. Type your name as it is on the class list. First time here? Choose Set up my PIN.';

function apiCmpInfo() { return { classes: cmpClasses_(), questions: ST_QUESTIONS }; }
function apiCmpSignIn(cls, typed, pin) {
  var who = cmpTyped_(cls, typed), ncls = 'CMP:' + cmpNormClass_(cls);
  var left = stTryAny_('stf_', who, ncls, typed);
  var id = who ? acctId_(who.cls, who.name) : '', a = who ? acctGet_(id) : null;
  if (!who || !a || !a.ph || stHash_(a.s, String(pin == null ? '' : pin).trim()) !== a.ph) throw new Error(stNoMatch_('stf_', left, CMP_NOMATCH_PIN));
  stClear_('stf_', id);
  return cmpOut_(who, a.v);
}
/* The first time: the name and the register number, then a PIN and a security question. */
function apiCmpSetup(cls, typed, reg, pin, q, answer) {
  pin = stPinOk_(pin);
  q = Math.round(Number(q));
  if (!(q >= 0 && q < ST_QUESTIONS.length)) throw new Error('Choose a question.');
  var ans = stAnswer_(answer);
  if (ans.length < 2) throw new Error('Type an answer to your question that you will remember.');
  if (!nameWords_(typed).length) throw new Error('Type your name.');
  if (!cmpRoster_()[cmpNormClass_(cls)]) throw new Error('Choose your class.');
  var who = cmpTyped_(cls, typed), regTyped = String(reg == null ? '' : reg).trim().replace(/^0+(?=\d)/, '');
  if (!regTyped) throw new Error('Type your register number. No register number? Ask your teacher.');
  var left = stTryAny_('srf_', who, 'CMP:' + cmpNormClass_(cls), typed);
  if (!who || !who.reg || regTyped !== String(who.reg).trim().replace(/^0+(?=\d)/, '')) {
    throw new Error(left > 0 ? 'That name and register number do not match the class list. ' + left + (left === 1 ? ' try' : ' tries') + ' left.' : 'That name and register number do not match. Ask your teacher to reset your PIN.');
  }
  var id = acctId_(who.cls, who.name);
  return withLock_(function () {
    var a = acctGet_(id);
    if (a && a.ph) throw new Error('You already have a PIN. Go back and sign in, or use Forgot my PIN.');
    var s = Utilities.getUuid().replace(/-/g, ''), v = (a ? Number(a.v) || 0 : 0) + 1;
    acctPut_(id, { c: who.cls, n: who.name, s: s, ph: stHash_(s, pin), q: q, ah: stHash_(s, 'a|' + ans), v: v, at: Date.now() });
    stClear_('srf_', id); stClear_('stf_', id); stClear_('saf_', id);
    return cmpOut_(who, v);
  }, 10000);
}
function apiCmpForgot(cls, typed, q, answer, pin) {
  pin = stPinOk_(pin);
  var who = cmpTyped_(cls, typed);
  var left = stTryAny_('saf_', who, 'CMP:' + cmpNormClass_(cls), typed);
  var id = who ? acctId_(who.cls, who.name) : '', a = who ? acctGet_(id) : null;
  if (!who || !a || !a.ph || Number(q) !== Number(a.q) || stHash_(a.s, 'a|' + stAnswer_(answer)) !== a.ah) throw new Error(stNoMatch_('saf_', left, 'That name, question and answer do not match.'));
  return withLock_(function () {
    var b = acctGet_(id) || a;
    b.ph = stHash_(b.s, pin); b.v = (Number(b.v) || 0) + 1; b.at = Date.now();
    acctPut_(id, b);
    stClear_('saf_', id); stClear_('stf_', id);
    return cmpOut_(who, b.v);
  }, 10000);
}
function apiCmpMe(ct) { var w = cmpCheck_(ct); return w ? { ok: true, cls: w.cls, name: w.name } : { ok: false }; }
/* Sign out on this laptop only ends the ticket kept there; Sign out everywhere (and a new PIN) ends every ticket. */
function apiCmpSignOutAll(ct) {
  var w = cmpWho_(ct);
  return withLock_(function () { var a = acctGet_(w.id) || {}; a.v = (Number(a.v) || 0) + 1; acctPut_(w.id, a); return { ok: true }; }, 10000);
}

/* ---------- the Coaches on the lesson site ---------- */

/* computing.json: { coaches: [{ id: '8.4', title, chapter, file, parts: [[id, name]], files: [paths] }] }, ten minutes. */
function cmpCatalog_() {
  var cache = CacheService.getScriptCache(), hit = cache.get('cmp_cat');
  if (hit) { try { return JSON.parse(hit); } catch (err) { /* read again */ } }
  var cat = { coaches: [] };
  try {
    var res = UrlFetchApp.fetch(CMP_CATALOG_RAW, { muteHttpExceptions: true });
    if (res.getResponseCode() === 200) {
      var r = JSON.parse(res.getContentText('UTF-8'));
      cat.coaches = (Array.isArray(r.coaches) ? r.coaches : []).filter(function (c) { return c && /^[\w.-]{1,12}$/.test(String(c.id || '')); }).slice(0, 80).map(function (c) {
        return { id: String(c.id), title: String(c.title || '').slice(0, 80), chapter: String(c.chapter || '').slice(0, 80), file: String(c.file || '').split('/').pop().slice(0, 120),
          parts: (Array.isArray(c.parts) ? c.parts : []).slice(0, 20).map(function (p) { return [String(p[0]).slice(0, 12), String(p[1] || p[0]).slice(0, 40)]; }),
          files: (Array.isArray(c.files) ? c.files : []).slice(0, 30).map(function (f) { return String(f).split('/').pop().slice(0, 120); }) };
      });
      cachePut_('cmp_cat', JSON.stringify(cat), 600);
      cachePut_('cmp_cat_last', JSON.stringify(cat), 21600);
    } else throw new Error('no catalogue');
  } catch (err) {
    var last = cache.get('cmp_cat_last');
    if (last) { try { cat = JSON.parse(last); } catch (e2) { /* empty */ } }
  }
  return cat;
}
function cmpCoach_(id) { return cmpCatalog_().coaches.filter(function (c) { return c.id === id; })[0] || null; }
function cmpOpenFor_(cls) {
  try { return JSON.parse(PropertiesService.getScriptProperties().getProperty('cmp_open_' + cmpNormClass_(cls)) || '[]'); } catch (err) { return []; }
}

/* ---------- the Coaches and task files, in Drive ---------- */

function cmpAssetFolder_() { return childFolder_(childFolder_(folder_('ROOT'), CMP_FOLDER), CMP_ASSETS); }
/* { file name: file id } of the files in that folder, kept ten minutes. */
function cmpAssets_(fresh) {
  var cache = CacheService.getScriptCache(), hit = fresh ? null : cache.get('cmp_assets');
  if (hit) { try { return JSON.parse(hit); } catch (err) { /* read again */ } }
  var out = {}, it = cmpAssetFolder_().getFiles();
  while (it.hasNext()) { var f = it.next(); if (!f.isTrashed || !f.isTrashed()) out[f.getName()] = f.getId(); }
  cachePut_('cmp_assets', JSON.stringify(out), 600);
  return out;
}
/* A Coach or one of its task files, for a student whose class has that Coach open. */
function apiCmpAsset(ct, coachId, name) {
  var who = cmpWho_(ct), c = cmpCoach_(String(coachId || ''));
  if (!c || cmpOpenFor_(who.cls).indexOf(c.id) < 0) throw new Error('This Coach is not open to your class.');
  name = String(name || '');
  if (name !== c.file && c.files.indexOf(name) < 0) throw new Error('That file is not part of this Coach.');
  var id = cmpAssets_()[name] || cmpAssets_(true)[name];
  if (!id) throw new Error(name + ' is not in Mr Cedric\'s folder yet. Tell your teacher.');
  var b = DriveApp.getFileById(id).getBlob();
  return { ok: true, name: name, type: /\.html?$/i.test(name) ? 'text/html' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', data: Utilities.base64Encode(b.getBytes()) };
}

/* ---------- saving a checked file ---------- */

function cmpLogSheet_() { return cmpTab_(CMP_LOG_TAB, CMP_LOG_COLS); }
/* Every saved file, as objects. */
function cmpLog_() {
  var sh = cmpLogSheet_(), last = sh.getLastRow();
  if (last < 2) return [];
  return sh.getRange(2, 1, last - 1, CMP_LOG_COLS.length).getValues().map(function (r) {
    return { t: r[0] ? new Date(r[0]).getTime() : 0, cls: cmpNormClass_(r[1]), code: String(r[2]), coach: String(r[3]), part: String(r[4]), partName: String(r[5]),
      n: Number(r[6]) || 1, score: r[7] === '' ? null : Number(r[7]), of: r[8] === '' ? null : Number(r[8]), file: String(r[9]), id: String(r[10]), uid: String(r[11]) };
  });
}
function cmpFolderFor_(who, coachId) {
  var root = childFolder_(folder_('ROOT'), CMP_FOLDER), c = cmpCoach_(coachId);
  var sub = hubClean_(coachId + (c && c.title ? ' ' + c.title : ''));
  return childFolder_(childFolder_(childFolder_(root, who.cls), sub), who.code);
}
function cmpStamp_(t) { return Utilities.formatDate(new Date(t), Session.getScriptTimeZone() || 'Asia/Singapore', 'yyyy-MM-dd HHmm'); }

/* d: { ct, coach, part, partName, fileStem, data (base64 of the .xlsx), score, of, uid } */
function cmpSave_(d) {
  var who = cmpWho_(d.ct);
  var coach = String(d.coach || ''), part = String(d.part || '').toLowerCase();
  if (!/^[\w.-]{1,12}$/.test(coach)) throw new Error('This Coach is not known.');
  if (!/^[a-z0-9]{1,12}$/.test(part)) throw new Error('This part of the Coach is not known.');
  var bytes = null;
  try { bytes = Utilities.base64Decode(String(d.data || '')); } catch (err) { bytes = null; }
  if (!bytes || bytes.length < 22 || bytes.length > CMP_MAX_BYTES) throw new Error('This file could not be saved. Save it in Excel again, then drop it in again.');
  if (!(bytes[0] === 0x50 && bytes[1] === 0x4B)) throw new Error('This is not an Excel workbook (.xlsx).');
  var score = d.score == null || d.score === '' || isNaN(Number(d.score)) ? '' : Math.max(0, Math.round(Number(d.score)));
  var of = d.of == null || d.of === '' || isNaN(Number(d.of)) ? '' : Math.max(0, Math.round(Number(d.of)));
  var uid = String(d.uid || '').replace(/[^\w-]/g, '').slice(0, 40);
  var partName = hubClean_(String(d.partName || part.toUpperCase())).slice(0, 40);
  var stem = hubClean_(String(d.fileStem || 'File')).replace(/\s+/g, '_').slice(0, 30) || 'File';
  return withLock_(function () {
    var log = cmpLog_();
    if (uid) { var dup = log.filter(function (x) { return x.uid === uid; })[0]; if (dup) return { ok: true, n: dup.n, again: true, t: dup.t }; }
    var n = log.filter(function (x) { return x.cls === who.cls && x.code === who.code && x.coach === coach && x.part === part; }).length + 1;
    var now = Date.now();
    var name = who.code + ' ' + coach + ' ' + partName + ' ' + stem + ' try ' + n + (score !== '' && of !== '' ? ' (' + score + ' of ' + of + ')' : '') + ' ' + cmpStamp_(now) + '.xlsx';
    var blob = Utilities.newBlob(bytes, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', name);
    var file = cmpFolderFor_(who, coach).createFile(blob);
    cmpLogSheet_().appendRow([new Date(now), who.cls, who.code, coach, part, partName, n, score, of, name, file.getId(), uid]);
    return { ok: true, n: n, t: now };
  }, 20000);
}
/* The student's own files, newest first: [{ coach, part, partName, n, score, of, t, id }]. */
function cmpFilesOf_(who) {
  return cmpLog_().filter(function (x) { return x.cls === who.cls && x.code === who.code; })
    .sort(function (a, b) { return b.t - a.t; })
    .map(function (x) { return { coach: x.coach, part: x.part, partName: x.partName, n: x.n, score: x.score, of: x.of, t: x.t, id: x.id }; });
}
/* One of the student's own files, as base64 (to download again). */
function cmpFileOf_(who, id) {
  id = String(id || '');
  var row = cmpLog_().filter(function (x) { return x.id === id && x.cls === who.cls && x.code === who.code; })[0];
  if (!row) throw new Error('That file is not one of yours.');
  var name = row.coach + ' ' + row.partName + ' try ' + row.n + '.xlsx';
  return { ok: true, name: name.replace(/[\\\/:*?"<>|]+/g, ' '), data: Utilities.base64Encode(DriveApp.getFileById(id).getBlob().getBytes()) };
}

/* ---------- the student's page ---------- */

function cmpPage_() {
  return HtmlService.createHtmlOutput(pageAssembled_('Computing'))
    .setTitle('Computing · learnwithmrcedric')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, viewport-fit=cover')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
/* What the student sees: the Coaches open to their class, with their own files. */
function apiCmpHome(ct) {
  var who = cmpWho_(ct), open = cmpOpenFor_(who.cls), cat = cmpCatalog_();
  var files = cmpFilesOf_(who);
  return {
    ok: true, cls: who.cls, name: who.name, app: selfUrl_(),
    coaches: cat.coaches.filter(function (c) { return open.indexOf(c.id) >= 0; }),
    files: files
  };
}
function apiCmpFile(ct, id) { return cmpFileOf_(cmpWho_(ct), id); }

/* The Coaches' calls (from the lesson site, or a Coach opened from the laptop): { api: 'cmp', op, ... }. */
function cmpPost_(d) {
  try {
    if (d.op === 'info') return { ok: true, classes: cmpClasses_() };
    if (d.op === 'signin') return apiCmpSignIn(d.cls, d.name, d.pin);
    if (d.op === 'me') return apiCmpMe(d.ct);
    if (d.op === 'save') return cmpSave_(d);
    if (d.op === 'files') return { ok: true, files: cmpFilesOf_(cmpWho_(d.ct)) };
  } catch (err) {
    return { ok: false, error: String(err && err.message || err) };
  }
  return { ok: false, error: 'Unknown request.' };
}

/* ---------- the Teacher Hub's Computing tab ---------- */

function api_t_cmp(token) {
  teacher_(token);
  CacheService.getScriptCache().remove('cmp_roster');   // the teacher may have just pasted a class list
  var roster = cmpRoster_(), opened = {};
  Object.keys(roster).forEach(function (c) { opened[c] = cmpOpenFor_(c); });
  var url = '';
  try { url = cmpSs_().getUrl() + '#gid=' + cmpRosterSheet_().getSheetId(); } catch (err) { url = ''; }
  return { classes: Object.keys(roster).sort().map(function (c) { return { cls: c, n: roster[c].length }; }), open: opened,
    coaches: cmpCatalog_().coaches, rosterUrl: url, studentUrl: selfUrl_() ? selfUrl_() + '?computing' : '', assets: cmpAssetState_() };
}
function api_t_cmpOpen(token, cls, coachId, on) {
  teacher_(token);
  cls = cmpNormClass_(cls); coachId = String(coachId || '');
  if (!cmpRoster_()[cls]) throw new Error('That class is not in the Computing students tab.');
  if (!/^[\w.-]{1,12}$/.test(coachId)) throw new Error('Choose a Coach.');
  return withLock_(function () {
    var list = cmpOpenFor_(cls).filter(function (x) { return x !== coachId; });
    if (on) list.push(coachId);
    PropertiesService.getScriptProperties().setProperty('cmp_open_' + cls, JSON.stringify(list.slice(-80)));
    return list;
  }, 10000);
}
/* A class's grid: each student, and for each Coach part their newest try (score, when, Drive link) and how many tries. */
function api_t_cmpClass(token, cls) {
  teacher_(token);
  cls = cmpNormClass_(cls);
  var list = cmpRoster_()[cls] || [], props = PropertiesService.getScriptProperties(), by = {};
  cmpLog_().forEach(function (x) {
    if (x.cls !== cls) return;
    var k = x.code + '|' + x.coach + '|' + x.part, o = by[k];
    if (!o) o = by[k] = { tries: 0, best: null, last: null };
    o.tries++;
    if (!o.last || x.t > o.last.t) o.last = { t: x.t, score: x.score, of: x.of, url: 'https://drive.google.com/file/d/' + x.id + '/view' };
    if (x.score != null && x.of != null && (!o.best || x.score / Math.max(1, x.of) > o.best.score / Math.max(1, o.best.of))) o.best = { score: x.score, of: x.of };
  });
  var folder = '';
  try { folder = childFolder_(childFolder_(folder_('ROOT'), CMP_FOLDER), cls).getUrl(); } catch (err) { folder = ''; }
  return {
    cls: cls, folder: folder, open: cmpOpenFor_(cls),
    students: list.map(function (s) {
      var a = null; try { a = JSON.parse(props.getProperty('acct_' + acctId_('CMP:' + cls, s.name)) || 'null'); } catch (err) { a = null; }
      return { name: s.name, reg: s.reg, code: s.code, pin: !!(a && a.ph) };
    }),
    cells: by
  };
}
/* Sign a computing student out everywhere (kind 'out'), or reset their PIN so they set it up again (kind 'pin'). */
function api_t_cmpReset(token, cls, name, kind) {
  teacher_(token);
  var s = cmpFind_(cls, name);
  if (!s) throw new Error('That student is not in the Computing students tab.');
  var id = acctId_('CMP:' + cmpNormClass_(cls), s.name);
  return withLock_(function () {
    var a = acctGet_(id) || { c: 'CMP:' + cmpNormClass_(cls), n: s.name, v: 0 };
    a.v = (Number(a.v) || 0) + 1;
    if (kind === 'pin') { delete a.ph; delete a.ah; delete a.q; delete a.s; delete a.at; }
    acctPut_(id, a);
    ['stf_', 'saf_', 'srf_'].forEach(function (k) { stClear_(k, id); });
    return { ok: true };
  }, 10000);
}
/* Which Coaches and task files are in the Drive folder, and which are still missing. */
function cmpAssetState_() {
  try {
    var have = cmpAssets_(true), missing = [], n = 0;
    cmpCatalog_().coaches.forEach(function (c) { [c.file].concat(c.files).forEach(function (f) { n++; if (!have[f]) missing.push(f); }); });
    return { url: cmpAssetFolder_().getUrl(), total: n, missing: missing };
  } catch (err) { return { url: '', total: 0, missing: [], error: String(err && err.message || err) }; }
}
/* Makes the two tabs (if they are not there yet) and gives each student a code. */
function api_t_cmpSetup(token) {
  teacher_(token);
  cmpRosterSheet_(); cmpLogSheet_();
  CacheService.getScriptCache().remove('cmp_roster');
  return api_t_cmp(token);
}
