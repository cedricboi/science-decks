/* ================================================================== */
/* learnwithmrcedric: Live Board and the Teacher Hub in one app        */
/* ================================================================== */
//
// This project holds three code files: Code (Live Board: learnwithmrcedric, the slides, the phone and the boards),
// Hub (the Teacher Hub: homework, marking, the tracker and points) and App (this file: the one web address,
// the move from two apps to one, the setup check and updates). The two sheets stay as they were: this script
// belongs to the Live Board sheet, and opens the Teacher Hub sheet by its ID (Settings: Class list sheet ID).
//
// One web address for everything:
//   /exec                 learnwithmrcedric (students)
//   /exec?view=teacher    Live Board's teacher page (the phone, boards and the projector)
//   /exec?teacher         the Teacher Hub
//   /exec?embed=ms        homework, inside learnwithmrcedric (also ?hw, and ?preview=CODE for See it as a student)
//   /exec?projector       the projector screen on the laptop (lessons chosen on the phone)

var APP_BUILD = '2026-10-16-privacy';

function doGet(e) {
  var p = (e && e.parameter) || {};
  PAGE_MEMO_ = {}; CH_MEMO_ = {};
  if (p.api === 'build') {
    return ContentService.createTextOutput(JSON.stringify({ app: 'liveboard', build: BUILD, one: APP_BUILD }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  if (p.view === 'teacher') return lbDoGet_(e);
  if (p.projector !== undefined) return projectorPage_(e);
  if (p.teacher !== undefined) return hubDoGet_(e);
  if (p.embed === 'ms' || p.hw !== undefined || p.preview !== undefined) return hubDoGet_(e);
  return lbDoGet_(e);
}

function doPost(e) {
  var d = null;
  try { d = JSON.parse(e && e.postData ? e.postData.contents : '{}'); } catch (err) { d = null; }
  // Claude's marking (it signs its requests with the Hub's Claude key). Live Board and the Teacher Hub call each
  // other directly now, so their old links ('hub', 'lb_class') are not answered from outside any more.
  if (d && d.api === 'lb_class') return appJson_({ ok: false, error: 'Unknown request.' });
  if (d && !d.api && d.action && d.key && d.version == null) return hubDoPost_(e);
  // The projector screen (a page on the lesson site), and the slides on the projector checking in.
  if (d && /^pj(pair|teach|parts)?$/.test(String(d.api || ''))) return appJson_(appSafe_(function () { return projectorPost_(d); }));
  if (d && d.api === 'lead' && d.pj) {
    return appJson_(appSafe_(function () {
      var o = presenterLead_(d);
      if (o && o.ok !== false) { try { var go = projectorGo_(d); if (go) o.go = go; } catch (err) { /* stays on these slides */ } }
      return o;
    }));
  }
  return lbDoPost_(e);
}
function appSafe_(fn) { try { return fn(); } catch (err) { return { ok: false, error: String(err && err.message || err) }; } }
function appJson_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

/* The sheet's menu: Live Board's and the Teacher Hub's together. */
function onOpen() {
  SpreadsheetApp.getUi().createMenu('learnwithmrcedric')
    .addItem('Setup check', 'menuSetupCheck')
    .addItem('Show my links', 'showLinks')
    .addSeparator()
    .addItem('Set up this sheet (Live Board)', 'setupSheet')
    .addItem('Check the class list', 'checkStudents')
    .addItem('Change the web app link', 'setWebAppLink')
    .addSeparator()
    .addItem('Teacher Hub: check worksheets', 'checkAssignments')
    .addItem('Teacher Hub: update the tracker now', 'buildTracker')
    .addItem('Teacher Hub: update the tracker every hour (on or off)', 'toggleHourlyTracker')
    .addItem('Teacher Hub: open its Drive folder', 'showFolder')
    .addToUi();
}

/* ---------- where things are ---------- */
function selfUrl_() {
  var u = '';
  try { u = PropertiesService.getScriptProperties().getProperty('WEBAPP_URL') || ''; } catch (err) { u = ''; }
  if (u) return plainExecUrl_(u);
  try { return hubPlainExecUrl_(ScriptApp.getService().getUrl() || ''); } catch (err) { return ''; }
}
/* Run by the owner of learnwithmrcedric (from the script editor, or the owner signed in to Google): setup and updates. */
function isOwner_() {
  var me = '', owner = '';
  try { me = Session.getActiveUser().getEmail() || ''; owner = Session.getEffectiveUser().getEmail() || ''; } catch (err) { return false; }
  return !!me && me.toLowerCase() === owner.toLowerCase();
}
function needOwner_(what) {
  if (!isOwner_()) throw new Error('OWNER_ONLY: ' + (what || 'This') + ' works only for the owner of learnwithmrcedric: run it from the script editor, or open the Teacher Hub signed in to Google with the account that owns it.');
}
/* The Teacher Hub's own lock (the Live Board sheet's document lock), so its long jobs (handing in, marking, the
   tracker) never hold up Live Board's script lock, which students' answers and sign-ins wait on for at most 20
   seconds. The script lock where there is no document lock. */
function hubLock_() {
  var l = null;
  try { l = LockService.getDocumentLock(); } catch (err) { l = null; }
  return l || LockService.getScriptLock();
}
/* The Teacher Hub sheet: Settings, Class list sheet ID (kept in SS_ID as well, as the Hub always has). */
function hubSheetId_() {
  var props = PropertiesService.getScriptProperties(), id = props.getProperty('SS_ID') || '';
  if (id) return id;
  try { id = getSetting_('Class list sheet ID'); } catch (err) { id = ''; }
  return id;
}
/* The Teacher Hub works once its settings have been moved here (or it has been set up here). Before that, nothing
   it does may make new Drive folders or write to the sheet. */
function hubReady_() { return PropertiesService.getScriptProperties().getProperty('HUB_READY') === '1'; }
function needHub_() {
  if (!hubReady_()) throw new Error('HUB_NOT_MOVED: The Teacher Hub has not been moved into learnwithmrcedric yet. In the script editor, run setupMyScience (see the code page).');
}

/* ---------- the move from two apps to one ---------- */
//
// 1. In the OLD Teacher Hub's script, the teacher runs moveToMyScience (the Move file on the code page). It copies
//    the Hub's settings (script properties) into a hidden tab, "Moved settings", of the Hub sheet, and stops the
//    old Hub's timers.
// 2. Here, setupMyScience (run once from the script editor) brings them in, deletes that tab (it holds keys),
//    links everything to this app's web address, and starts the timers the Hub needs.
var MOVE_TAB = 'Moved settings';
var MOVE_SKIP = { WEBAPP_URL: 1, LIVEBOARD_URL: 1, T_PASS: 1, T_SALT: 1, SS_ID: 1, HUB_READY: 1 };
function moveHubSettingsIn_() {
  var id = hubSheetId_();
  if (!id) return { ok: false, why: 'The Teacher Hub sheet is not known. In the Live Board sheet, Settings tab, put the Hub sheet\'s ID in Class list sheet ID.' };
  var ss;
  try { ss = SpreadsheetApp.openById(id); } catch (err) { return { ok: false, why: 'The Teacher Hub sheet could not be opened (' + err.message + ').' }; }
  var sh = ss.getSheetByName(MOVE_TAB);
  if (!sh) return { ok: false, none: true, why: 'There is no "' + MOVE_TAB + '" tab in the Teacher Hub sheet yet. Run moveToMyScience in the old Hub\'s script first.' };
  var rows = sh.getDataRange().getValues(), set = {}, triggers = [], n = 0;
  rows.slice(1).forEach(function (r) {
    var k = String(r[0] || ''), v = String(r[1] == null ? '' : r[1]);
    if (!k) return;
    if (k === '__triggers') { try { triggers = JSON.parse(v); } catch (err) { triggers = []; } return; }
    if (k.indexOf('__') === 0 || MOVE_SKIP[k]) return;
    set[k] = v; n++;
  });
  var props = PropertiesService.getScriptProperties();
  props.setProperties(set);
  props.setProperty('SS_ID', id);
  props.setProperty('HUB_READY', '1');
  if (!props.getProperty('AUTO_LINK_AT')) props.setProperty('AUTO_LINK_AT', String(Date.now()));
  if (triggers.indexOf('buildTracker') >= 0) {
    try { if (!ScriptApp.getProjectTriggers().some(function (t) { return t.getHandlerFunction() === 'buildTracker'; })) ScriptApp.newTrigger('buildTracker').timeBased().everyHours(1).create(); } catch (err) { /* turned on again from the menu */ }
  }
  ss.deleteSheet(sh);      // it holds the Claude and Anthropic keys
  return { ok: true, moved: n, triggers: triggers };
}
/* Links this app to itself: homework in learnwithmrcedric, the Teacher Hub's links and Claude's marking all use this web
   address now. */
function linkSelf_() {
  var url = selfUrl_();
  if (!url) return '';
  try { if (getSetting_('Worksheet Hub link') !== url) setSetting_('Worksheet Hub link', url); } catch (err) { /* no Settings tab yet */ }
  return url;
}

/* Run once from the script editor after pasting the new code (it also asks Google for the permissions). */
function setupMyScience() {
  needOwner_('setupMyScience');
  var out = [];
  var url = linkSelf_();
  out.push(url ? 'Web address: ' + url : 'The web address is not known yet: deploy, then run Live Board > Change the web app link.');
  if (!hubSheetId_()) out.push('The Teacher Hub sheet is not linked: Live Board sheet, Settings tab, Class list sheet ID.');
  if (!hubReady_()) {
    var m = moveHubSettingsIn_();
    out.push(m.ok ? 'Moved ' + m.moved + ' Teacher Hub settings in, and deleted the Moved settings tab.' : m.why);
  } else {
    out.push('The Teacher Hub settings are already here.');
    var pp = PropertiesService.getScriptProperties();
    if (!pp.getProperty('AUTO_LINK_AT')) pp.setProperty('AUTO_LINK_AT', String(Date.now()));
  }
  try { ensureTick_(tickWanted_()); out.push('Timers checked.'); } catch (err) { out.push('Timers: ' + err.message); }
  if (url) {
    out.push('Teacher Hub: ' + url + '?teacher');
    out.push('learnwithmrcedric (students): ' + url);
    out.push('Projector screen (laptop): ' + url + '?projector');
  }
  out.push('Now deploy a new version: Deploy > Manage deployments, the pencil, Version: New version, Deploy.');
  var text = out.join('\n');
  console.log(text);
  return text;
}

/* ---------- moving between classrooms with the laptop ---------- */
//
// The teacher carries the laptop from class to class. So:
//  - starting a lesson for one class ends any lesson still running for another class (the laptop has moved on);
//  - a lesson on the class's timetable lasts its timetabled time: the laptop asleep or the slides closed for a
//    while (a practical, a walk round the room) does not end it before the lesson's usual end, 5 minutes early;
//    a lesson that is not on the timetable still ends 10 minutes after the slides stop checking in;
//  - Teach next (on the Hub and the phone) puts the class being taught now first.
// The timetable is learnt from when lessons start (lessonTimes_). How long each lesson usually lasts is learnt
// from when lessons end (End pressed, the slides closed, or the next class's lesson started), per weekly slot:
//   lens_<CLASS>   [{ k: weekday * 1440 + minutes (the slot's start), m: minutes, at }]   (the last 24)
var LESSON_DEFAULT_MINS = 55, LESSON_MAX_MINS = 180, LESSON_MIN_MINS = 20, LENS_KEEP = 24;
function lessonLens_(cls) {
  try { return JSON.parse(PropertiesService.getScriptProperties().getProperty('lens_' + normClass_(cls)) || '[]'); } catch (err) { return []; }
}
/* How long a weekly slot's lesson lasts: the longest of its last three lessons (a lesson ended early, or a laptop
   closed before the end, does not shorten it), 55 minutes until one has been seen. */
function slotLen_(lens, key) {
  var wd = Math.floor(key / 1440), m = key % 1440;
  var got = lens.filter(function (x) { return Math.floor(x.k / 1440) === wd && Math.abs(x.k % 1440 - m) <= 30; }).slice(-3).map(function (x) { return x.m; });
  return got.length ? Math.min(LESSON_MAX_MINS, Math.max.apply(null, got)) : LESSON_DEFAULT_MINS;
}
/* The class's timetabled lesson at time t: { start, end, key }, or null. A lesson started up to 15 minutes before
   the slot counts as that slot. */
function slotAt_(cls, t, lens) {
  var off = tzOffset_(), DAY = 86400000, tl = t + off, dayStart = Math.floor(tl / DAY) * DAY, wd = new Date(tl).getUTCDay(), best = null;
  lens = lens || lessonLens_(cls);
  lessonTimes_(cls, t).forEach(function (k) {
    if (Math.floor(k / 1440) !== wd) return;
    var s = dayStart + (k % 1440) * 60000 - off, len = slotLen_(lens, k) * 60000;
    if (t >= s - SLOT_NEAR_MINS * 60000 && t <= s + len && (!best || s > best.start)) best = { start: s, end: s + len, key: k };
  });
  return best;
}
/* When a lesson starting now should end by itself at the earliest (0: not on the timetable). */
function lessonEndFor_(cls, at) {
  var s = null;
  try { s = slotAt_(cls, at); } catch (err) { s = null; }
  return s ? s.end : 0;
}
/* Learns how long a slot's lesson lasts, from a lesson that started at `at` and ran until `end`. */
function noteLessonLength_(cls, at, end) {
  if (!at || !end || end <= at || String(cls).toUpperCase() === 'TEST') return;
  var lens = lessonLens_(cls), s = slotAt_(cls, at, lens);
  if (!s) return;
  var m = Math.round((end - s.start) / 60000);
  if (m < LESSON_MIN_MINS) return;                 // a look at the slides, not a lesson
  lens.push({ k: s.key, m: Math.min(LESSON_MAX_MINS, m), at: Date.now() });
  PropertiesService.getScriptProperties().setProperty('lens_' + normClass_(cls), JSON.stringify(lens.slice(-LENS_KEEP)));
}
/* Whether a lesson whose slides were last seen at `alive` has ended by itself. */
function idleOver_(c, alive) {
  var now = Date.now();
  if (now - alive <= IDLE_END_MINS * 60000) return false;
  var L = (c && c.lesson) || {};
  if (now - (L.at || 0) > LESSON_MAX_MINS * 60000) return true;
  return !L.end || now >= L.end - 5 * 60000;
}
/* The laptop has moved on: a lesson started for one class ends the lessons still running for the other classes.
   (The TEST class neither ends nor is kept running by this.) */
function endOtherClasses_(cls) {
  cls = String(cls || '').toUpperCase();
  if (!cls || cls === 'TEST') return [];
  var others = Object.keys(readRoster_()).filter(function (c) { return c !== cls; });
  if (!others.length) return [];
  var run = runningFor_(others), ended = [];
  Object.keys(run).forEach(function (c) {
    var r = run[c], ctl = getCtl_(r.id, c);
    if (!ctl.lesson) return;
    // How long it ran: to its last slide change (a laptop opened in the next room checks in, but turns no slides).
    try { noteLessonLength_(c, ctl.lesson.at || 0, Math.min(Date.now(), lastTurn_(r.id, c, ctl))); } catch (err) { /* only for the timetable */ }
    ctl = apiSetControlNoPin_(r.id, c, { follow: false, pause: false, hold: false, to: 0, from: 0 });
    noteLessonEnd_(ctl);
    ctl.lesson = null;
    saveCtlRaw_(r.id, c, ctl);
    ended.push(c);
  });
  return ended;
}
function lastTurn_(deckId, cls, c) {
  var at = (c.lesson && c.lesson.at) || 0;
  try { var l = JSON.parse(CacheService.getScriptCache().get(leadKey_(deckId, cls)) || 'null'); if (l && l.at) at = Math.max(at, l.at); } catch (err) { /* none */ }
  return at || lastAlive_(deckId, cls, c);
}
/* Another class's lesson started after time t (the laptop has moved on since): an old lesson's slides waking up
   on the laptop do not bring that lesson back. */
function otherRunningSince_(cls, t) {
  var others = Object.keys(readRoster_()).filter(function (c) { return c !== String(cls).toUpperCase() && c !== 'TEST'; });
  if (!others.length) return false;
  var run = runningFor_(others);
  return Object.keys(run).some(function (c) { return (run[c].at || 0) > t; });
}
/* The next start of one of the class's timetabled lessons after t (0 if it has no timetable yet). */
function nextSlotStart_(cls, t) {
  var off = tzOffset_(), DAY = 86400000, tl = t + off, dayStart = Math.floor(tl / DAY) * DAY, wd = new Date(tl).getUTCDay(), best = 0;
  lessonTimes_(cls, t).forEach(function (k) {
    var at = dayStart + ((Math.floor(k / 1440) - wd + 7) % 7) * DAY + (k % 1440) * 60000 - off;
    if (at <= t) at += 7 * DAY;
    if (!best || at < best) best = at;
  });
  return best;
}
/* Teach next with the class being taught now first: a lesson running, then the class whose timetabled lesson is
   on now, then the classes in the order their next lessons come. Each card says when (now, or the next lesson). */
function teachNext_(known) {
  var list = teachNextRaw_(known), now = Date.now();
  list.forEach(function (o) {
    var s = null;
    try { s = slotAt_(o.cls, now); } catch (err) { s = null; }
    o.onNow = !!(o.running || s);
    if (s) o.slot = { start: s.start, end: s.end };
    try { o.nextAt = nextSlotStart_(o.cls, now); } catch (err) { o.nextAt = 0; }
  });
  var rank = function (o) { return o.running ? 0 : o.slot ? 1 : o.nextAt ? 2 : 3; };
  list.sort(function (a, b) {
    return rank(a) - rank(b) || (a.running && b.running ? (b.running.at || 0) - (a.running.at || 0) : 0) ||
      (rank(a) === 2 ? a.nextAt - b.nextAt : 0) || (a.cls < b.cls ? -1 : a.cls > b.cls ? 1 : 0);
  });
  return list;
}

/* ---------- one teacher PIN, and devices paired for a year ---------- */
//
// The teacher PIN (Live Board sheet, Settings tab) signs in everything: the Teacher Hub, Live Board, the phone
// and the projector screen. A phone or laptop that has been paired keeps a device key (dv_...) instead of the
// PIN itself, for a year. Changing the PIN ends every device key at once; Setup check can also unpair them all.
//   dv_list   [{ tk, kind: 'phone' | 'laptop' | 'projector' | 'hub', name, at, until, p: mark of the PIN }]
var DEVICE_DAYS = 365, DEVICE_KEEP = 40;
function devList_() {
  try { return JSON.parse(PropertiesService.getScriptProperties().getProperty('dv_list') || '[]'); } catch (err) { return []; }
}
function devIssue_(kind, name) {
  var now = Date.now(), mark = pinMark_();
  var list = devList_().filter(function (d) { return d.until > now && d.p === mark; });
  var tk = 'dv_' + Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '').slice(0, 8);
  list.push({ tk: tk, kind: String(kind || 'device').slice(0, 12), name: clean_(name || '', 40), at: now, until: now + DEVICE_DAYS * 86400000, p: mark });
  PropertiesService.getScriptProperties().setProperty('dv_list', JSON.stringify(list.slice(-DEVICE_KEEP)));
  cachePut_('dvk_' + tk, mark, 21600);
  return tk;
}
function devOk_(tk) {
  var cache = CacheService.getScriptCache(), mark = pinMark_(), seen = cache.get('dvk_' + tk);
  if (seen) return seen === mark;
  var hit = devList_().filter(function (d) { return d.tk === tk && d.until > Date.now(); })[0];
  if (hit && hit.p === mark) { cachePut_('dvk_' + tk, mark, 21600); return true; }
  return false;
}
/* Called with the PIN just typed (or a Teacher Hub sign-in): a device key for this phone or laptop. */
function apiPairDevice(pin, kind, name) {
  checkPin_(pin);
  var k = /^(phone|laptop|projector|hub)$/.test(String(kind)) ? String(kind) : 'laptop';
  return devIssue_(k, name);
}
function unpairAll_() {
  var list = devList_(), cache = CacheService.getScriptCache();
  list.forEach(function (d) { try { cache.remove('dvk_' + d.tk); } catch (err) { /* gone */ } });
  PropertiesService.getScriptProperties().deleteProperty('dv_list');
  return list.length;
}
function devSummary_() {
  var now = Date.now(), mark = pinMark_(), out = {};
  devList_().forEach(function (d) { if (d.until > now && d.p === mark) out[d.kind] = (out[d.kind] || 0) + 1; });
  return out;
}

/* ---------- the phone runs the lesson: the projector screen ---------- */
//
// The laptop on the projector shows the Projector screen (projector.html on the lesson site, paired once). It
// waits, showing the class on now and what comes next. On the phone, Teach next has a Teach button for each
// class: the projector opens those slides, signed in, for that class and part, and the lesson starts by itself.
// End on the phone brings the projector back to waiting. The laptop can also start a lesson itself, from the
// waiting screen.
// One command at a time, newest wins:   pj_cmd { seq, act: 'teach' | 'wait', deck, cls, part, at, url, title }
// The projector says where it is:       pj_alive { at, where: 'wait' | 'deck', deck, cls, seq }
var PJ_TEACH_FRESH_MINS = 15, PJ_FIRST_FRESH_SECS = 120, PJ_ONLINE_SECS = 30;
function pjGet_() {
  var raw = CacheService.getScriptCache().get('pj_cmd');
  if (raw === null || raw === undefined) raw = PropertiesService.getScriptProperties().getProperty('PJ_CMD') || '';
  try { return raw ? JSON.parse(raw) : null; } catch (err) { return null; }
}
function pjPut_(cmd) {
  var raw = JSON.stringify(cmd);
  PropertiesService.getScriptProperties().setProperty('PJ_CMD', raw);
  cachePut_('pj_cmd', raw, 21600);
  return cmd;
}
function pjSeq_() { var old = pjGet_(); return Math.max(Date.now(), old && old.seq ? old.seq + 1 : 0); }
function pjAlive_() {
  try { return JSON.parse(CacheService.getScriptCache().get('pj_alive') || 'null'); } catch (err) { return null; }
}
function pjNote_(o) { o.at = Date.now(); cachePut_('pj_alive', JSON.stringify(o), 600); }
function projectorUrl_() { return lessonSite_() + 'projector.html'; }
/* The slides of a lesson, from the Decks tab or the lesson site. */
function deckUrlFor_(deckId) {
  var d = findDeck_(deckId);
  if (d && d.link) return d.link;
  var url = '';
  try {
    var cat = catalog_();
    (cat.subjects || []).forEach(function (s) { (s.groups || []).forEach(function (g) { (g.items || []).forEach(function (it) { if (!url && it.topicId === deckId) url = cat.site + it.file; }); }); });
  } catch (err) { url = ''; }
  return url;
}
/* Sends a lesson to the projector: the slides open there for the class, at the part chosen ('all' for the whole
   lesson; at: a slide to carry on from). */
function pjTeach_(deckId, cls, part, at, by) {
  deckId = clean_(deckId, 120); cls = String(cls || '').toUpperCase();
  if (!deckId || !readRoster_()[cls]) throw new Error('Choose a class and a lesson.');
  var base = deckUrlFor_(deckId);
  if (!base) throw new Error('That lesson is not on the lesson site.');
  // 'keep': the lesson running for the class carries on (no part, so nothing is restarted).
  var p = part === 'keep' ? '' : part === 'all' || part === -1 || part === '-1' || part == null || part === '' ? 'all' : String(Math.max(0, Math.round(Number(part) || 0)));
  var seq = pjSeq_(), d = findDeck_(deckId);
  var url = base.replace(/#.*$/, '') + '#present&cls=' + encodeURIComponent(cls) + (p ? '&part=' + p : '') + (Number(at) > 1 ? '&at=' + Math.round(Number(at)) : '') +
    '&tk=' + hubToken_().tk + '&pj=' + seq;
  return pjPut_({ seq: seq, act: 'teach', deck: deckId, cls: cls, part: p, at: Date.now(), url: url, title: d ? d.title : deckId, by: by || 'phone' });
}
function pjOnline_() {
  var a = pjAlive_();
  return a && Date.now() - a.at < PJ_ONLINE_SECS * 1000 ? a : null;
}
/* The phone: Teach on the projector. */
function apiProjectorTeach(pin, deckId, cls, part, at) {
  checkPin_(pin);
  var cmd = pjTeach_(deckId, cls, part, at, 'phone'), on = pjOnline_();
  return { ok: true, seq: cmd.seq, online: !!on, url: cmd.url, title: cmd.title, projector: projectorUrl_() };
}
/* The phone: take the slides off the projector (back to waiting) without ending the lesson. */
function apiProjectorWait(pin) {
  checkPin_(pin);
  pjPut_({ seq: pjSeq_(), act: 'wait', at: Date.now() });
  return { ok: true };
}
/* A lesson ended on the phone (or on the slides) while the projector shows it: the projector goes back to waiting. */
function projectorEnded_(deckId, cls) {
  var a = pjAlive_();
  if (!a || a.where !== 'deck' || a.deck !== deckId || a.cls !== String(cls || '').toUpperCase() || Date.now() - a.at > 120000) return false;
  pjPut_({ seq: pjSeq_(), act: 'wait', at: Date.now(), deck: deckId, cls: a.cls });
  return true;
}
/* Teach next for the waiting screen and the phone, kept 30 seconds: each class with what comes next. */
function pjList_() {
  var cache = CacheService.getScriptCache(), hit = cache.get('pj_list');
  if (hit) { try { return JSON.parse(hit); } catch (err) { /* make again */ } }
  var known = allDeckParts_(), list = teachNext_(known), parts = {};
  var out = list.map(function (o) {
    var nx = o.next, run = o.running;
    [nx && nx.deck && nx.deck.id, run && run.deck && run.deck.id, o.last && o.last.deck && o.last.deck.id].forEach(function (id) {
      if (id && !parts[id] && known[id]) parts[id] = (known[id].lessons || []).map(function (l) { return { t: l.t, from: l.from, to: l.to }; });
    });
    return { cls: o.cls, onNow: !!o.onNow, slot: o.slot || null, nextAt: o.nextAt || 0,
      running: run ? { id: run.deck.id, title: run.deck.title, lesson: run.lesson, at: run.at } : null,
      last: o.last ? { id: o.last.deck.id, title: o.last.deck.title, t: o.last.t, part: o.last.part } : null,
      next: nx ? { id: nx.deck.id, title: nx.deck.title, subject: nx.deck.subject, color: nx.deck.color, part: nx.part, t: nx.t, carry: nx.carry || 0 } : null };
  });
  var res = { classes: out, parts: parts, at: Date.now() };
  try { cachePut_('pj_list', JSON.stringify(res), 30); } catch (err) { /* too big to keep */ }
  return res;
}
/* Every lesson, for choosing another one: [{ id, title }] (the Decks tab). */
function pjDecks_() { return readDecks_().map(function (d) { return { id: d.id, title: d.title }; }); }

/* The projector screen's requests (it is a page on the lesson site, so it posts to this web address). */
function projectorPost_(d) {
  if (d.api === 'pjpair') {
    // Opened from the Teacher Hub with its sign-in (tk_...), or with the teacher PIN typed on the laptop.
    checkPin_(d.pin);
    return { ok: true, tk: devIssue_('projector', d.name || 'Projector screen'), until: Date.now() + DEVICE_DAYS * 86400000 };
  }
  checkPin_(d.tk);
  if (d.api === 'pjteach') {
    var cmd = pjTeach_(d.deck, d.cls, d.part, d.at, 'projector');
    return { ok: true, seq: cmd.seq, cmd: cmd };
  }
  if (d.api === 'pjparts') {
    var known = allDeckParts_(), id = clean_(d.deck, 120);
    return { ok: true, deck: id, parts: known[id] ? known[id].lessons || [] : [] };
  }
  // api 'pj': the waiting screen's check, every few seconds.
  var now = Date.now(), cur = pjGet_(), seq = Number(d.seq);
  if (!(seq >= -1)) seq = -1;
  pjNote_({ where: 'wait', seq: seq });
  var out = { ok: true, now: now };
  if (cur && cur.seq) {
    var fresh = cur.act === 'teach' && now - (cur.at || 0) < (seq < 0 ? PJ_FIRST_FRESH_SECS * 1000 : PJ_TEACH_FRESH_MINS * 60000);
    if (seq < 0 || cur.seq > seq) { out.seq = cur.seq; if (fresh) out.cmd = cur; }
  }
  if (d.list) { out.list = pjList_(); if (d.decks) out.decks = pjDecks_(); }
  return out;
}
/* The slides on the projector check in (each lead, with pj: the command they were opened for). When a newer command
   has come (another lesson, or back to waiting), the answer says where to go. */
function projectorGo_(d) {
  var pj = Number(d.pj) || 0, deckId = clean_(d.topicId, 120), cls = String(d.cls || '').toUpperCase(), cur = pjGet_();
  pjNote_({ where: 'deck', deck: deckId, cls: cls, seq: pj });
  if (!cur || !(cur.seq > pj)) return '';
  if (cur.act === 'teach') return Date.now() - (cur.at || 0) < PJ_TEACH_FRESH_MINS * 60000 ? cur.url || '' : '';
  // A lesson ended for these slides (End on the phone) sends them back; one ended for another class (Change class
  // on these slides) does not.
  if (cur.deck && (cur.deck !== deckId || cur.cls !== cls)) return '';
  return projectorUrl_();
}
/* /exec?projector: the projector screen is a page on the lesson site; this opens it with this web address. */
function projectorPage_(e) {
  var to = projectorUrl_() + '#app=' + encodeURIComponent(selfUrl_());
  var html = '<div style="font:16px system-ui,-apple-system,Segoe UI,Arial,sans-serif;min-height:90vh;display:grid;place-items:center;text-align:center;color:#13233a">' +
    '<div><h1 style="font-size:28px;margin:0 0 8px">Projector screen</h1><p style="margin:0 0 20px">It opens on the lesson site. Bookmark it on the laptop you take to class.</p>' +
    '<a href="' + esc_(to) + '" target="_top" style="display:inline-block;background:#FFD84D;color:#13233a;padding:14px 22px;border-radius:12px;font-weight:700;text-decoration:none">Open the projector screen</a></div></div>';
  return HtmlService.createHtmlOutput(html).setTitle('Projector screen').addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/* ---------- the phone: Teach next and Needs you, with one-tap actions ---------- */
//
// When no lesson is running, the phone shows Teach next (the class on now first, with Teach on the projector) and
// the Teacher Hub's Needs you: only what needs doing, each with its button (Release marking, Let in, Given, ...).
// Anything that needs the bigger screen (checking a sample, a marked solution) says so and opens the Hub.
function phoneHubTk_() {
  var cache = CacheService.getScriptCache(), tk = cache.get('ph_hubtk');
  if (tk && cache.get('ttok_' + tk)) return tk;
  tk = tIssue_();
  cache.put('ph_hubtk', tk, 21600);
  return tk;
}
function apiPhoneHome(pin) {
  checkPin_(pin);
  var out = { ok: true, projector: null, pjUrl: projectorUrl_(), tn: null, needs: null, hub: '' };
  var a = pjOnline_();
  if (a) out.projector = { where: a.where, deck: a.deck || '', cls: a.cls || '' };
  try { out.tn = pjList_(); } catch (err) { out.tnErr = String(err.message || err); }
  try { out.decks = phoneDecks_(); } catch (err) { out.decks = []; }
  try { out.needs = phoneNeeds_(); } catch (err) { out.needsErr = /HUB_NOT_MOVED/.test(err.message) ? '' : String(err.message || err); }
  try { out.hub = selfUrl_() ? selfUrl_() + '?teacher' : ''; } catch (err) { out.hub = ''; }
  return out;
}
function phoneNeeds_(fresh) {
  if (!hubReady_()) return null;
  var cache = CacheService.getScriptCache();
  if (!fresh) { var hit = cache.get('ph_needs'); if (hit) { try { return JSON.parse(hit); } catch (err) { /* make again */ } } }
  var d = api_t_dashboard(phoneHubTk_()), byId = {}, claude = !!(d.claude && d.claude.connected);
  (d.worksheets || []).forEach(function (w) { byId[w.id] = w; });
  var items = (d.attention || []).filter(function (n) { return !n.info && !n.snoozed; }).map(function (n) { return phoneItem_(n, byId[n.id] || null, claude); });
  try { cachePut_('ph_needs', JSON.stringify(items), 60); } catch (err) { /* asked again next time */ }
  return items;
}
function phoneItem_(n, w, claude) {
  var t = w ? w.title : '', it = { key: n.key, kind: n.kind || n.action, title: t || n.text, sub: '', acts: [], id: n.id || '', level: n.level };
  var act = function (a, label, extra) { var x = { a: a, label: label }; Object.keys(extra || {}).forEach(function (k) { x[k] = extra[k]; }); it.acts.push(x); };
  switch (n.action) {
    case 'letin':
      it.title = n.name + ' · ' + n.cls; it.sub = 'wants to set up their PIN' + (n.twice ? ' (two iPads are asking)' : '');
      it.cls = n.cls; it.gkey = n.gkey; act('letin', 'Let in'); act('letno', 'No'); break;
    case 'release': it.sub = 'marking ready to release'; act('release', 'Release marking'); break;
    case 'answers': it.sub = 'answer key ready to release'; act('answers', 'Release answers'); break;
    case 'prizes':
      it.title = n.count + (n.count === 1 ? ' prize' : ' prizes') + ' to hand out'; it.sub = n.cls;
      it.list = (n.list || []).map(function (p) { return { row: p.row, name: p.name, prize: p.prize, code: p.code }; }); break;
    case 'zip':
      it.sub = (w ? w.handed : 0) + ' handed in · ready to mark';
      if (claude && w && w.hasSolution) act('mark', 'Mark with Claude'); else it.big = true;
      break;
    case 'sample': it.sub = 'Claude marked one sample: check it on the Hub, or let Claude mark the rest'; act('rest', 'Mark the rest'); it.big = true; break;
    case 'linkerr': it.title = n.name; it.sub = 'not set for ' + n.cls + ': ' + String(n.text || '').replace(/^.*by itself: /, ''); it.k = n.k; it.cls = n.cls; act('linkseen', 'OK'); break;
    case 'tracker': it.title = n.count + (n.count === 1 ? ' parent' : ' parents') + ' to message'; it.sub = '3 or more worksheets missing, late or under 50%'; it.big = true; break;
    case 'help': it.sub = (n.count || 0) + ' stuck on ' + (n.q || 'a question'); it.big = true; break;
    case 'solution': it.sub = 'Claude\'s marked solution to check'; it.big = true; break;
    default:
      if (n.kind === 'overdue') { it.sub = (n.left ? n.left + ' not handed in · ' : 'everyone has handed in · ') + 'still open'; act('close', 'Close hand-in'); }
      else if (n.kind === 'nosolution') { it.sub = 'no marked solution yet'; it.big = true; }
      else if (n.kind === 'error') { it.sub = 'Claude could not finish'; it.big = true; }
      else { it.sub = n.text; it.big = true; }
  }
  return it;
}
/* One tap on the phone. o carries what the item needs (id, cls, gkey, row, k, key). */
function apiPhoneNeedAct(pin, a, o) {
  checkPin_(pin);
  needHub_();
  o = o || {};
  var tk = phoneHubTk_(), done = 'Done';
  if (a === 'letin' || a === 'letno') { api_t_letin(tk, o.cls, o.gkey, a === 'letin'); done = a === 'letin' ? 'Let in' : 'Not let in'; }
  else if (a === 'release') { api_t_update(tk, o.id, { showMarked: true }); done = 'Marking released'; }
  else if (a === 'answers') { api_t_update(tk, o.id, { showAnswers: true }); done = 'Answers released'; }
  else if (a === 'close') { api_t_update(tk, o.id, { open: false }); done = 'Hand-in closed'; }
  else if (a === 'given') { api_t_rwCollected(tk, o.row, true); done = 'Given'; }
  else if (a === 'mark') {
    var sure = false;
    try { sure = trackRecord_(o.id); } catch (err) { sure = false; }
    api_t_markWithClaude(tk, o.id, { sample: !sure, onlyNew: false, note: '' });
    done = sure ? 'Claude is marking them all' : 'Claude is marking a sample first';
  }
  else if (a === 'rest') { api_t_claudeNext(tk, o.id, 'rest', ''); done = 'Claude is marking the rest'; }
  else if (a === 'linkseen') { api_t_linkSeen(tk, o.k, o.cls); }
  else if (a === 'later') { api_t_snooze(tk, o.key, true); done = 'Put away until tomorrow'; }
  else throw new Error('Unknown action.');
  CacheService.getScriptCache().remove('ph_needs');
  return { ok: true, done: done };
}
/* Every lesson with its parts, for choosing another lesson on the phone. */
function phoneDecks_() {
  var parts = allDeckParts_();
  return readDecks_().map(function (d) { return { id: d.id, title: d.title, parts: ((parts[d.id] || {}).lessons || []).map(function (l) { return { t: l.t }; }) }; });
}

/* ---------- worksheets link themselves, by their number ---------- */
//
// A worksheet in the library whose name (or whose folder's name) starts with a sub-chapter's number ("3.2 Heat
// capacity.pdf", or "3.2 Heat capacity / Worksheet.pdf") is that sub-chapter's homework, with no linking to do.
// When two subjects both have a 3.2, the folder names decide (a "Physics" folder for a Physics lesson). When two
// worksheets still match, neither is used: link one in Homework. A link made by hand always wins, and "No
// homework" (kept as file 'none') stops a match. Only lessons taught after this was switched on count
// (AUTO_LINK_AT); Setup check can switch it off (AUTO_LINK = 'off').
var AUTO_STOP = { the: 1, and: 1, for: 1, with: 1, worksheet: 1, worksheets: 1, chapter: 1, lesson: 1, part: 1, module: 1, notes: 1, pdf: 1, sec: 1, secondary: 1 };
function autoLinkSince_() {
  var p = PropertiesService.getScriptProperties();
  if (p.getProperty('AUTO_LINK') === 'off') return 0;
  return Number(p.getProperty('AUTO_LINK_AT')) || 0;
}
function autoLinkOn_() { return autoLinkSince_() > 0; }
function autoWords_(s) {
  var out = {};
  String(s || '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/).forEach(function (w) { if (w.length >= 3 && !AUTO_STOP[w] && !/^\d+$/.test(w)) out[w] = 1; });
  return out;
}
/* What the lesson site says about each lesson: its subject and chapter, for telling two 3.2s apart. */
function autoDeckInfo_() {
  var info = {}, subjects = [];
  try {
    var cat = catalog_();
    (cat.subjects || []).forEach(function (s) {
      subjects.push(String(s.name || '').toLowerCase());
      (s.groups || []).forEach(function (g) {
        (g.items || []).forEach(function (it) { if (it.topicId) info[it.topicId] = { subject: String(s.name || ''), words: autoWords_([s.name, g.name, it.title].join(' ')) }; });
      });
    });
  } catch (err) { /* no lesson site: numbers alone */ }
  return { decks: info, subjects: subjects.filter(String) };
}
function autoNumRe_(num) {
  return new RegExp('^(?:(?:ch(?:apter)?|ws|worksheet|sub-?chapter|section)\\.?\\s*)?0*' + String(num).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?![0-9a-z]|\\.[0-9a-z])', 'i');
}
/* The library worksheet for a sub-chapter, or null (none, or more than one). */
function autoMatch_(items, deck, num, t, dinfo) {
  if (!num) return null;
  var re = autoNumRe_(num), d = (dinfo && dinfo.decks[deck]) || null, mine = d ? d.subject.toLowerCase() : '';
  var cands = (items || []).filter(function (it) {
    if (!it.ok || !it.id) return false;
    if (LIB_SOL_RE.test(it.name) || LIB_KEY_RE.test(it.name) || LIB_NOTES_RE.test(it.name)) return false;
    var segs = String(it.path || '').split(' / ').concat([it.name]);
    if (!segs.some(function (s) { return re.test(String(s).trim()); })) return false;
    // In another subject's folder (and not in this one's): not this lesson's.
    var where = (String(it.path || '') + ' ' + it.name).toLowerCase();
    if (mine && where.indexOf(mine) < 0 && (dinfo.subjects || []).some(function (s) { return s !== mine && s && where.indexOf(s) >= 0; })) return false;
    return true;
  });
  if (cands.length <= 1) return cands[0] || null;
  var want = {};
  if (d) Object.keys(d.words).forEach(function (w) { want[w] = 1; });
  Object.keys(autoWords_(t)).forEach(function (w) { want[w] = 1; });
  var scored = cands.map(function (c) {
    var have = autoWords_(c.path + ' ' + c.name), s = 0;
    Object.keys(have).forEach(function (w) { if (want[w]) s++; });
    return { c: c, s: s * 2 + (re.test(String(c.name).trim()) ? 1 : 0) };
  }).sort(function (a, b) { return b.s - a.s; });
  return scored[0].s > scored[1].s ? scored[0].c : null;
}
/* The library's worksheets, read without moving anything (the Hub's own library page tidies loose files into
   folders; this only looks). As the Hub's library page listed them, or read here and kept 30 minutes. */
var AUTO_LIB_RUN = null;
function autoLib_() {
  if (AUTO_LIB_RUN) return AUTO_LIB_RUN;
  var cache = CacheService.getScriptCache(), list = parseJson_(cache.get('LIB_LIST')) || parseJson_(cache.get('al_lib'));
  if (!list) {
    list = autoLibWalk_();
    try { cache.put('al_lib', JSON.stringify(list), 1800); } catch (e) { /* read again next time */ }
  }
  return (AUTO_LIB_RUN = list);
}
function autoLibWalk_() {
  var items = [], count = 0;
  (function walk(folder, path, depth) {
    var it = folder.getFiles();
    while (it.hasNext() && count <= LIB_MAX_FILES) {
      var f = it.next();
      if (f.isTrashed && f.isTrashed()) continue;
      count++;
      var kind = LIB_KINDS[f.getMimeType()];
      if (!kind || !libOk_(kind)) continue;
      var base = libBase_(f.getName());
      if (LIB_SOL_RE.test(base) || LIB_KEY_RE.test(base) || LIB_NOTES_RE.test(base)) continue;
      items.push({ id: f.getId(), name: base, path: path, ok: true });
    }
    if (depth >= LIB_MAX_DEPTH || count > LIB_MAX_FILES) return;
    var fi = folder.getFolders();
    while (fi.hasNext()) {
      var sf = fi.next();
      if (sf.isTrashed && sf.isTrashed()) continue;
      walk(sf, libIsItem_(sf) ? path : (path ? path + ' / ' + sf.getName() : sf.getName()), depth + 1);
    }
  })(libFolder_(), '', 0);
  return { items: items };
}
/* Before the Hub sets homework from what was taught: sub-chapters taught (after this was switched on) with no link
   get the library worksheet with their number, as a link marked auto. */
function autoLinks_(links, starts) {
  var since = autoLinkSince_();
  if (!since) return links;
  var want = {};
  (starts || []).forEach(function (s) {
    if (!(Number(s.at) >= since)) return;
    (s.parts || []).forEach(function (p) {
      var num = p.num || (Number(p.i) < 0 ? wholeNum_(s.deck) : '');
      if (!num) return;
      var k = linkKey_(s.deck, p.num ? p.num : '#all');
      if (!links[k] && !want[k]) want[k] = { deck: s.deck, num: num, t: p.t || '' };
    });
  });
  // Sub-chapters with no numbered worksheet are not looked for again for 6 hours (or until the library changes).
  var cache = CacheService.getScriptCache(), miss = parseJson_(cache.get('al_miss')) || {}, missed = false;
  var keys = Object.keys(want).filter(function (k) { return !miss[k]; });
  if (!keys.length) return links;
  var lib = null, dinfo = autoDeckInfo_(), props = PropertiesService.getScriptProperties();
  try { lib = autoLib_(); } catch (e) { return links; }
  keys.forEach(function (k) {
    if (props.getProperty(LINK_PREFIX + k)) return;
    var w = want[k], m = autoMatch_(lib.items, w.deck, w.num, w.t, dinfo);
    if (!m) { miss[k] = 1; missed = true; return; }
    var v = { file: m.id, name: libBase_(m.name).slice(0, 80), t: String(w.t).slice(0, 80), num: String(w.num).slice(0, 12), at: since, auto: true };
    props.setProperty(LINK_PREFIX + k, JSON.stringify(v));
    v.done = {};
    links[k] = v;
  });
  if (missed) { try { cache.put('al_miss', JSON.stringify(miss), 21600); } catch (e) { /* looked for again next time */ } }
  return links;
}
/* For Homework on the Teach tab: the worksheet each numbered sub-chapter would get by its number, where no link has
   been made: { deck: { num: { file, name, path } } }. */
function api_t_autoLinks(token) {
  teacher_(token);
  if (!autoLinkOn_()) return { on: false, links: {} };
  var parts = allDeckParts_(), links = wsLinksAll_(), dinfo = autoDeckInfo_(), lib = autoLib_(), out = {};
  Object.keys(parts).forEach(function (deck) {
    (parts[deck].lessons || []).forEach(function (l) {
      var num = String(l.num || '');
      if (!num || links[linkKey_(deck, num)]) return;
      var m = autoMatch_(lib.items, deck, num, l.t, dinfo);
      if (m) (out[deck] = out[deck] || {})[num] = { file: m.id, name: libBase_(m.name), path: m.path || '' };
    });
    // a lesson that is one sub-chapter as a whole (7.1): its worksheet by that number
    var wn = (parts[deck].lessons || []).length ? '' : wholeNum_(deck);
    if (wn && !links[linkKey_(deck, '#all')]) {
      var mw = autoMatch_(lib.items, deck, wn, '', dinfo);
      if (mw) (out[deck] = out[deck] || {})[wn] = { file: mw.id, name: libBase_(mw.name), path: mw.path || '' };
    }
  });
  return { on: true, links: out };
}

/* ---------- less checking of Claude's marking ---------- */
//
// A worksheet from the library that Claude has marked before for another class, which the teacher then released,
// has a track record: Claude marks it all at once (phase 'all'), with no stop for a sample, starting from its notes
// in the library folder. The scripts Claude asks the teacher to check come first when checking.
//   LIB_DONE   { libraryFolderId: [worksheet ids marked by Claude and released] }
function libDoneAll_() { return parseJson_(PropertiesService.getScriptProperties().getProperty('LIB_DONE')) || {}; }
function libMarkedDone_(wsId) {
  var fid = libLinksCached_()[wsId], j = getJob_(wsId);
  if (!fid || !j || j.status !== 'done') return false;      // only Claude's marking counts
  var all = libDoneAll_(), list = all[fid] || [];
  if (list.indexOf(wsId) >= 0) return true;
  list.push(wsId);
  all[fid] = list.slice(-6);
  var keys = Object.keys(all);
  if (keys.length > 120) keys.slice(0, keys.length - 120).forEach(function (k) { delete all[k]; });
  PropertiesService.getScriptProperties().setProperty('LIB_DONE', JSON.stringify(all));
  return true;
}
function trackRecord_(wsId) {
  var fid = libLinksCached_()[wsId];
  if (!fid) return false;
  return (libDoneAll_()[fid] || []).some(function (w) { return w !== wsId; });
}
function api_t_trackRecord(token, id) {
  teacher_(token);
  return trackRecord_(String(id || ''));
}

/* ---------- Needs you is only what needs doing; the rest is in This week ---------- */
//
// Needs you keeps the things with something to do (release, let in, mark, check, hand out). What is only worth
// knowing moves to This week: worksheets due soon, corrections coming in, homework set by itself, and students to
// keep an eye on. Home shows This week as a card, every day.
var WEEK_KINDS = { due: 1, corr: 1, autoset: 1, follow: 1 };
function markInfo_(items) {
  (items || []).forEach(function (it) { if (WEEK_KINDS[it.kind]) it.info = true; });
  return items;
}
/* This week, per class: corrections, homework set by itself in the last 7 days, students to keep an eye on; and,
   after two weeks of counting, the buttons never used. */
function weekExtras_(s) {
  var now = new Date(), t = now.getTime(), WEEK = 7 * 86400000;
  var subs = submissionIndex_(), assigns = getAssignments_().filter(function (a) { return a.fileId && !a.practice; }), byClass = studentsByClass_();
  var parents = parentMsgs_(), seen = followSeen_(now), list = assigns.map(function (a) { return summarise_(a, subs, now, null); });
  var links = wsLinksAll_(), titles = {};
  assigns.forEach(function (a) { titles[a.id] = a; });
  s.classes.forEach(function (c) {
    c.corr = list.filter(function (w) { return w.showMarked && w.correctionsOpen && w.corrDue > 0 && (w.classes.length ? w.classes.indexOf(c.cls) >= 0 : true); })
      .map(function (w) { return { title: w.title, done: w.corrDone, due: w.corrDue }; });
    c.autoset = [];
    Object.keys(links).forEach(function (k) {
      var L = links[k], d = (L.done || {})[c.cls];
      if (d && d.id && titles[d.id] && t - (d.at || 0) < WEEK) c.autoset.push({ title: titles[d.id].title, part: L.t || '', due: titles[d.id].due || '' });
    });
    c.follow = [];
    if (byClass[c.cls]) trackerModel_(byClass[c.cls], assignsForClass_(assigns, c.cls), subs, now, parents).flagged.forEach(function (f) {
      if (!f.parent && !seen[f.cls + '|' + hubNormName_(f.name)]) c.follow.push({ name: f.name, text: f.text });
    });
  });
  var unused = null;
  try { unused = usageUnused_(); } catch (e) { unused = null; }
  s.unused = unused;
  return s;
}
function weekExtrasHtml_(s) {
  var e = esc_, u = s.unused, h = '';
  if (u && Object.keys(u).length) {
    var names = { hub: 'Teacher Hub', liveboard: 'Live Board', phone: 'Phone' };
    h += '<section class="wk-c wk-unused"><h3>Buttons not used in two weeks</h3><p class="wk-n">Shown every day and never pressed. If you never need them, tell Claude which can go.</p>' +
      Object.keys(u).sort().map(function (w) { return '<p class="wk-l">' + e(names[w] || w) + '</p><p class="wk-n">' + u[w].slice(0, 40).map(e).join(', ') + (u[w].length > 40 ? ' and ' + (u[w].length - 40) + ' more' : '') + '</p>'; }).join('') + '</section>';
  }
  return h;
}
function weekClassHtml_(c) {
  var e = esc_, h = '';
  if (c.autoset && c.autoset.length) h += '<p class="wk-l">Homework set</p><ul>' + c.autoset.map(function (x) { return '<li>' + e(x.title) + (x.part ? ' <small>' + e(x.part) + '</small>' : '') + (x.due ? ' <small>due ' + e(x.due) + '</small>' : '') + '</li>'; }).join('') + '</ul>';
  if (c.corr && c.corr.length) h += '<p class="wk-l">Corrections</p><ul>' + c.corr.map(function (x) { return '<li>' + e(x.title) + ' <small>' + x.done + ' of ' + x.due + ' in</small></li>'; }).join('') + '</ul>';
  if (c.follow && c.follow.length) h += '<p class="wk-l">Keep an eye on</p><p class="wk-n">' + c.follow.map(function (f) { return e(f.name); }).join(', ') + '</p>';
  return h;
}

/* ---------- which buttons get used ---------- */
//
// For two weeks the Teacher Hub, Live Board and the phone count the buttons pressed (and note the buttons shown),
// in the Teacher Hub sheet's "Button use" tab: Button, Where, Pressed, First seen, Last pressed. After two weeks,
// This week lists the buttons shown all that time and never pressed, so the ones nobody needs can go.
var USAGE_TAB = 'Button use', USAGE_DAYS = 14, USAGE_MAX_ROWS = 600;
function usageSheet_() {
  var ss = SpreadsheetApp.openById(hubSheetId_()), sh = ss.getSheetByName(USAGE_TAB);
  if (!sh) { sh = ss.insertSheet(USAGE_TAB); sh.appendRow(['Button', 'Where', 'Pressed', 'First seen', 'Last pressed']); sh.setFrozenRows(1); }
  return sh;
}
function usageKey_(s) { return String(s || '').replace(/\d+/g, '').replace(/\s+/g, ' ').trim().slice(0, 60); }
/* b: { where: 'hub' | 'liveboard' | 'phone', pressed: { label: n }, shown: [label] } */
function usageAdd_(b) {
  if (!hubReady_() || !b) return false;
  var props = PropertiesService.getScriptProperties(), since = Number(props.getProperty('USAGE_SINCE')) || 0;
  if (!since) { since = Date.now(); props.setProperty('USAGE_SINCE', String(since)); }
  var where = String(b.where || 'hub').slice(0, 12), pressed = b.pressed || {}, shown = (b.shown || []).slice(0, 300);
  // No lock: two pages writing in the same second may lose a count, which does not matter here.
  {
    var sh = usageSheet_(), last = sh.getLastRow(), rows = last > 1 ? sh.getRange(2, 1, last - 1, 5).getValues() : [], at = {}, now = new Date(), grew = false;
    rows.forEach(function (r, i) { at[r[1] + '|' + r[0]] = i; });
    var row = function (label) {
      var k = usageKey_(label);
      if (!k) return -1;
      if (at[where + '|' + k] === undefined) { if (rows.length >= USAGE_MAX_ROWS) return -1; at[where + '|' + k] = rows.length; rows.push([k, where, 0, now, '']); grew = true; }
      return at[where + '|' + k];
    };
    shown.forEach(row);
    Object.keys(pressed).forEach(function (label) {
      var i = row(label);
      if (i < 0) return;
      rows[i][2] = (Number(rows[i][2]) || 0) + Math.max(0, Math.min(500, Math.round(Number(pressed[label]) || 0)));
      rows[i][4] = now;
    });
    if (rows.length) sh.getRange(2, 1, rows.length, 5).setValues(rows);
    return grew || Object.keys(pressed).length > 0;
  }
}
function api_t_usage(token, b) { teacher_(token); try { return usageAdd_(b); } catch (e) { return false; } }
function apiUsage(pin, b) { checkPin_(pin); try { return usageAdd_(b); } catch (e) { return false; } }
/* After two weeks: the buttons shown since the start and never pressed, by where they are. */
function usageUnused_() {
  var since = Number(PropertiesService.getScriptProperties().getProperty('USAGE_SINCE')) || 0, now = Date.now();
  if (!since || now - since < USAGE_DAYS * 86400000 || !hubReady_()) return null;
  var sh = SpreadsheetApp.openById(hubSheetId_()).getSheetByName(USAGE_TAB);
  if (!sh || sh.getLastRow() < 2) return null;
  var out = {};
  sh.getRange(2, 1, sh.getLastRow() - 1, 5).getValues().forEach(function (r) {
    var first = r[3] instanceof Date ? r[3].getTime() : 0;
    if (!(Number(r[2]) > 0) && first && now - first >= USAGE_DAYS * 86400000) (out[r[1]] = out[r[1]] || []).push(String(r[0]));
  });
  return out;
}

/* ---------- Setup check: everything learnwithmrcedric needs, with a fix for each ---------- */
//
// Each check: { id, level: 'ok' | 'warn' | 'bad' | 'info', title, detail, fix: { act, label } | null, link }
// The Teacher Hub shows them (menu: Setup check) with their Fix buttons; the sheet's menu shows the same list.
function setupChecks_() {
  var out = [], props = PropertiesService.getScriptProperties();
  var add = function (id, level, title, detail, fix, link) { out.push({ id: id, level: level, title: title, detail: detail || '', fix: fix || null, link: link || '' }); };
  // The web address
  var url = selfUrl_();
  if (!url) add('url', 'bad', 'The web address is not known', 'Deploy the web app, then in the sheet: learnwithmrcedric > Change the web app link.');
  else if (/\/dev$/.test(url)) add('url', 'bad', 'The web address is the test link (/dev)', 'Use the /exec link: learnwithmrcedric > Change the web app link.');
  else add('url', 'ok', 'Web address', url);
  // The Teacher Hub's settings, sheet and folders
  var hid = hubSheetId_();
  if (!hubReady_()) add('hub', 'bad', 'The Teacher Hub has not been moved in yet', 'In the script editor, run setupMyScience (see the code page).');
  else if (!hid) add('hub', 'bad', 'The Teacher Hub sheet is not linked', 'Live Board sheet, Settings tab: put the Hub sheet\'s ID in Class list sheet ID.');
  else {
    var hubOk = true;
    try { hubSheet_(TABS.students.name); } catch (e) { hubOk = false; add('hub', 'bad', 'The Teacher Hub sheet could not be opened', String(e.message || e)); }
    if (hubOk) add('hub', 'ok', 'Teacher Hub', 'Moved in, with its sheet and folders.');
  }
  // The teacher PIN
  var pin = '';
  try { pin = String(getSetting_('Teacher PIN') || ''); } catch (e) { pin = ''; }
  if (!pin) add('pin', 'bad', 'There is no teacher PIN', 'Live Board sheet, Settings tab: type one next to Teacher PIN.');
  else if (/^(1234|0000|1111|123456)$/.test(pin)) add('pin', 'warn', 'The teacher PIN is easy to guess', 'Change it in the Live Board sheet, Settings tab. Your phone and projector will need pairing again.');
  else add('pin', 'ok', 'Teacher PIN', 'One PIN for the Teacher Hub, Live Board, your phone and the projector.');
  // Release 26: the Google lock
  if (glockOn_()) add('glock', 'ok', 'The Teacher Hub needs your Google account', 'The teacher PIN alone opens nothing that shows students\' names: the Teacher Hub opens only when you are signed in to Google with the account that owns learnwithmrcedric, and phones and laptops are paired from the Hub. Presenting from the slides and Not you? on an iPad still take the PIN.', { act: 'glock_off', label: 'Turn off' });
  else add('glock', 'info', 'The Teacher Hub opens with the PIN alone', 'Turn this on so the Teacher Hub, and Live Board\'s teacher pages, open only when you are signed in to Google with the account that owns learnwithmrcedric. Your paired phone and projector laptop keep working. Pair them first if you have not.', { act: 'glock_on', label: 'Turn on' });
  // Classes: Live Board's class list and the Hub's Students tab
  try {
    var lb = Object.keys(readRoster_()).filter(function (c) { return c !== 'TEST'; }), hubCls = hubReady_() ? Object.keys(studentsByClass_()) : [];
    var key = function (c) { return String(c).toUpperCase().replace(/[\s\-_.]+/g, ''); }, hk = hubCls.map(key);
    var missing = lb.filter(function (c) { return hk.indexOf(key(c)) < 0; });
    if (!lb.length) add('classes', 'bad', 'No classes yet', 'Add students to the Students tab of the Teacher Hub sheet (Class in column A, Reg No in B, Name in C).');
    else if (hubReady_() && missing.length) add('classes', 'warn', 'Some classes are not in the Teacher Hub', missing.join(', ') + ' are on Live Board\'s class list but not on the Hub\'s Students tab, so no homework is set for them.');
    else add('classes', 'ok', 'Classes', lb.join(', '));
  } catch (e) { add('classes', 'warn', 'The class lists could not be read', String(e.message || e)); }
  // Timers
  try {
    var trig = ScriptApp.getProjectTriggers().map(function (t) { return t.getHandlerFunction(); });
    var want = false;
    try { want = hubReady_() && tickWanted_(); } catch (e) { want = false; }
    var tickOn = trig.some(function (h) { return /tick/i.test(h); });
    if (want && !tickOn) add('timers', 'bad', 'The 15-minute timer is off', 'Homework hands itself in, Claude marks and taught sub-chapters show as ready to deploy only while it runs.', { act: 'timers', label: 'Turn it on' });
    else add('timers', 'ok', 'Timers', tickOn ? 'Running every 15 minutes.' : 'Not needed yet (nothing runs by itself).');
  } catch (e) { add('timers', 'warn', 'The timers could not be read', String(e.message || e)); }
  // Claude marking
  if (props.getProperty('CLAUDE_FIRE_URL') && props.getProperty('CLAUDE_FIRE_TOKEN')) add('claude', 'ok', 'Claude marking', 'Connected.');
  else add('claude', 'warn', 'Claude marking is not connected', 'Claude can mark homework against your marked solution.', { act: 'claude', label: 'Connect' });
  // The lesson site
  var gh = ghConf_();
  if (gh.repo && gh.token) add('site', 'ok', 'Lesson site', gh.repo + ' (Add or update a lesson works).');
  else add('site', 'warn', 'The lesson site is not connected for uploads', 'Add or update a lesson needs the GitHub repository and token (Live Board, Lessons).', null, lessonSite_());
  // Worksheets that link themselves
  if (hubReady_()) {
    if (autoLinkOn_()) {
      var n = 0;
      try { var items = (autoLib_().items || []).filter(function (it) { return it.ok && /^\s*(?:(?:ch(?:apter)?|ws|worksheet)\.?\s*)?\d+\.\d+[a-z]?(?![0-9.])/i.test(it.name + ' ' + (it.path || '').split(' / ').pop()); }); n = items.length; } catch (e) { n = -1; }
      add('autolink', 'ok', 'Worksheets link themselves by their number', n >= 0 ? n + ' numbered worksheets in your library (such as "3.2 Heat capacity.pdf").' : 'Your library could not be read.', { act: 'autolink_off', label: 'Switch off' });
    } else add('autolink', 'info', 'Worksheets link themselves: off', 'Name library worksheets with the sub-chapter number ("3.2 Heat capacity.pdf") and they link themselves to that part, ready to deploy.', { act: 'autolink_on', label: 'Switch on' });
  }
  // Release 26: Name lines on the library's worksheets (checked in the Hub: it reads the PDFs)
  if (hubReady_()) add('names', 'info', 'Name lines on worksheets', 'Check every worksheet in your library for a Name line ("Name: ____"). Whatever a student writes on one is left out of what they hand in, and the Hub offers to cover it when you upload.', { act: 'namescan', label: 'Check my worksheets' });
  // Room for settings: Google keeps at most 500 KB of them for the whole app.
  try {
    var all = props.getProperties(), size = 0;
    Object.keys(all).forEach(function (k) { size += k.length + String(all[k]).length; });
    var kb = Math.round(size / 1024);
    add('storage', kb > 440 ? 'bad' : kb > 350 ? 'warn' : 'ok', 'Room for settings', kb + ' KB of 500 KB used' + (kb > 350 ? ': old lessons\' records can be cleared (ask Claude).' : '.'));
  } catch (e) { /* not counted */ }
  // Paired phones and laptops
  var dv = devSummary_(), dvText = Object.keys(dv).map(function (k) { return dv[k] + ' ' + k + (dv[k] > 1 ? 's' : ''); }).join(', ');
  add('devices', 'info', 'Paired devices', dvText ? dvText + ', each for a year. Changing the teacher PIN unpairs them all.' : 'None yet. Pair your phone from Teach next.', dvText ? { act: 'unpair', label: 'Unpair all' } : null);
  // The projector screen
  var pa = pjAlive_();
  add('projector', pa && Date.now() - pa.at < 3600000 ? 'ok' : 'info', 'Projector screen',
    pa ? 'Last seen ' + Math.max(1, Math.round((Date.now() - pa.at) / 60000)) + ' min ago.' : 'Open it once on the laptop (Teach next > Projector screen), then choose lessons on your phone.', null, projectorUrl_());
  return out;
}
function api_t_setupCheck(token, withUpdate) {
  teacher_(token);
  var list = setupChecks_(), up = null;
  if (withUpdate) {
    try { up = api_t_updateCheck(token, false); } catch (e) { up = { error: String(e.message || e) }; }
    if (up && up.newer) list.unshift({ id: 'update', level: 'warn', title: 'Release ' + up.pasteSeq + ': paste ' + up.paste.join(', '),
      detail: ((up.notes || []).join(' · ') + ' ').trim() + ' Only these files: the pages update by themselves. Copy them from the code page into the Live Board sheet\'s script, save each, then Deploy > Manage deployments > New version.', fix: null, link: up.codePage || '' });
    else if (up && !up.error) list.push({ id: 'update', level: 'ok', title: 'Server code up to date', detail: 'Release ' + APP_SEQ + ' (' + APP_BUILD + '). Nothing to paste.', fix: null, link: '' });
    else if (up && up.error) list.push({ id: 'update', level: 'info', title: 'Updates could not be checked', detail: up.error, fix: null, link: '' });
    if (up && up.pages) {
      if (up.pages.from === 'site') list.push({ id: 'pages', level: 'ok', title: 'Pages update themselves', detail: 'From the lesson site, release ' + up.pages.seq + '. A page change reaches everyone within about 15 minutes.', fix: { act: 'pages_local', label: 'Use the pasted pages' }, link: '' });
      else list.push({ id: 'pages', level: 'info', title: 'Pages: the copy pasted into the script', detail: 'Because ' + up.pages.why + '.', fix: /switched/.test(up.pages.why) ? { act: 'pages_site', label: 'Update by themselves' } : null, link: '' });
    }
  }
  return { checks: list, build: APP_BUILD, update: up };
}
function api_t_setupFix(token, act) {
  teacher_(token);
  var props = PropertiesService.getScriptProperties();
  if (act === 'timers') { ensureTick_(true); return { ok: true, done: 'Timer on' }; }
  if (act === 'autolink_on') { props.setProperty('AUTO_LINK', 'on'); if (!props.getProperty('AUTO_LINK_AT')) props.setProperty('AUTO_LINK_AT', String(Date.now())); ensureTick_(tickWanted_()); return { ok: true, done: 'Worksheets link themselves from now on' }; }
  if (act === 'autolink_off') { props.setProperty('AUTO_LINK', 'off'); return { ok: true, done: 'Switched off' }; }
  if (act === 'pages_local') { props.setProperty('PAGES_LOCAL', '1'); return { ok: true, done: 'The pasted pages from now on' }; }
  if (act === 'pages_site') { props.deleteProperty('PAGES_LOCAL'); CacheService.getScriptCache().remove('pg_rel'); return { ok: true, done: 'Pages update themselves again' }; }
  if (act === 'unpair') { var n = unpairAll_(); return { ok: true, done: n + ' unpaired. Pair your phone and the projector again.' }; }
  if (act === 'glock_on') {
    if (!isOwner_()) throw new Error('Open the Teacher Hub signed in to Google with the account that owns learnwithmrcedric, then turn this on from there. (So you cannot lock yourself out.)');
    var at = Date.now();
    props.setProperty('GLOCK', 'on'); props.setProperty('GLOCK_AT', String(at));
    CacheService.getScriptCache().put('ttok_' + token, String(at + 1), T_SESSION_SECONDS);   // this sign-in carries on
    return { ok: true, done: 'On: the Teacher Hub needs your Google account now' };
  }
  if (act === 'glock_off') { props.deleteProperty('GLOCK'); props.deleteProperty('GLOCK_AT'); return { ok: true, done: 'Off: the PIN opens the Teacher Hub again' }; }
  throw new Error('Unknown fix.');
}
/* The sheet's menu: the same checks, in a dialog. */
function menuSetupCheck() {
  var list = setupChecks_(), mark = { ok: '✓', warn: '!', bad: '✗', info: '·' };
  var html = '<div style="font:14px Arial,sans-serif;line-height:1.45">' + list.map(function (c) {
    var col = c.level === 'ok' ? '#1C7A4C' : c.level === 'bad' ? '#C23B35' : c.level === 'warn' ? '#B07A00' : '#555';
    return '<p style="margin:0 0 10px"><b style="color:' + col + '">' + mark[c.level] + ' ' + esc_(c.title) + '</b><br>' + esc_(c.detail) + '</p>';
  }).join('') + '<p style="color:#555">Fix buttons are in the Teacher Hub: menu, Setup check.</p></div>';
  SpreadsheetApp.getUi().showModalDialog(HtmlService.createHtmlOutput(html).setWidth(520).setHeight(560), 'Setup check');
}
/* Show my links (sheet menu): the addresses of everything. */
function showLinks() {
  var url = selfUrl_();
  var rows = url ? [['Teacher Hub (bookmark this)', url + '?teacher'], ['learnwithmrcedric, for students', url], ['Live Board teacher page', url + '?view=teacher'], ['Projector screen (on the laptop)', projectorUrl_() + '#app=' + encodeURIComponent(url)]] : [];
  var html = '<div style="font:14px Arial,sans-serif;line-height:1.5">' + (rows.length ? rows.map(function (r) {
    return '<p style="margin:0 0 10px"><b>' + esc_(r[0]) + '</b><br><a href="' + esc_(r[1]) + '" target="_blank">' + esc_(r[1]) + '</a></p>';
  }).join('') : '<p>The web address is not known yet. Deploy, then learnwithmrcedric > Change the web app link.</p>') + '</div>';
  SpreadsheetApp.getUi().showModalDialog(HtmlService.createHtmlOutput(html).setWidth(560).setHeight(320), 'My links');
}

/* ---------- updates: pages by themselves, server code from the code page ---------- */
//
// New versions of learnwithmrcedric are put in the app folder of the lesson repository (cedricboi/science-decks). Its
// release.json lists the page sets (see the pages above: they reach everyone by themselves) and, for each release
// that changed server code, which of Code.gs, Hub.gs, App.gs and appsscript.json changed. Those are the only files
// ever pasted by hand (Google lets a script change its own code only through a Cloud project). Setup check and the
// Home card say which files to paste, with the code page's link; nothing else is ever pasted.
var APP_SEQ = 26;   // the release number of this server code (newer releases have bigger numbers)
/* The server files changed by releases newer than this one, and what those releases bring. */
function updServerNeeded_(rel) {
  var files = {}, notes = [], latest = 0;
  ((rel && rel.server) || []).forEach(function (s) {
    if (!s || typeof s !== 'object' || !(Number(s.seq) > APP_SEQ)) return;
    latest = Math.max(latest, Number(s.seq));
    (Array.isArray(s.files) ? s.files : []).forEach(function (f) { if (/^[\w.-]+$/.test(String(f))) files[f] = 1; });
    (Array.isArray(s.notes) ? s.notes : []).forEach(function (n) { if (notes.length < 8) notes.push(String(n)); });
  });
  return { files: Object.keys(files).sort(), notes: notes, seq: latest };
}
function api_t_updateCheck(token, fresh) {
  teacher_(token);
  if (fresh) { CacheService.getScriptCache().remove('pg_rel'); PAGE_MEMO_ = {}; }
  var st = pagesState_(), rel = st.rel || null, need = updServerNeeded_(rel);
  if (!rel) return { current: APP_BUILD, seq: APP_SEQ, error: 'The lesson site did not answer, so updates could not be checked. Try again in a few minutes.', paste: [], newer: false,
    pages: { from: st.from, seq: st.seq || 0, build: st.build || '', why: st.why || '' }, notes: [], codePage: '', owner: isOwner_() };
  return {
    current: APP_BUILD, seq: APP_SEQ, latest: rel ? rel.build : '', latestSeq: rel ? rel.seq : 0,
    pages: { from: st.from, seq: st.seq || 0, build: st.build || '', why: st.why || '' },
    paste: need.files, pasteSeq: need.seq, newer: need.files.length > 0,
    notes: need.notes.length ? need.notes : (rel ? rel.notes : []), title: rel ? rel.title : '',
    codePage: rel && /^https:\/\/claude\.ai\//.test(rel.codePage) ? rel.codePage : '', owner: isOwner_()
  };
}
// The old Update and Undo buttons (an open page from before this release may still show them).
function api_t_updateRun(token) { teacher_(token); throw new Error('Updates are pasted now: Setup check lists the files, with the code page\'s link.'); }
function api_t_updateUndo(token) { teacher_(token); throw new Error('Updates are pasted now: Setup check lists the files, with the code page\'s link.'); }

/* ---------- pages that update themselves from the lesson site ---------- */
//
// The pages (Teacher, Student, HubTeacher, Homework, Guide, Rewards, Ink, Styles) come from the newest release in the
// app folder of the lesson repository whose server code this script already has: release.json lists page sets,
// newest first, each with the commit holding it, the server release it needs (needsServer) and each file's SHA-256.
// A page is read at that commit, checked against its SHA-256, and kept in the cache (packed) for six hours, so a
// page change reaches every iPad, phone and laptop within ten minutes of being put on the lesson site, with nothing
// to paste. Anything wrong (GitHub slow or down, a check that fails, a release that needs newer server code, or the
// owner's switch, PAGES_LOCAL) means the copy pasted into this script, which always works.
var PAGES_REPO = 'cedricboi/science-decks', PAGES_RAW = 'https://raw.githubusercontent.com/';
var PAGES_REL_SECS = 600, PAGES_KEEP_SECS = 21600, PAGES_CHUNK = 90000;
var PAGE_NAMES = ['Teacher', 'Student', 'HubTeacher', 'Homework', 'Guide', 'Rewards', 'Ink', 'Styles'];
var PAGE_MEMO_ = {};   // for this request only: the page set chosen, and each page's text

/* The release list from the lesson site (only what the pages need), cached ten minutes. null: none to use.
   While one execution asks GitHub (or when GitHub does not answer), the others use the last good list, so a slow
   GitHub never holds up a page for long. */
function pagesRelease_() {
  var cache = CacheService.getScriptCache(), hit = cache.get('pg_rel');
  if (hit) return parseJson_(hit);
  var last = parseJson_(cache.get('pg_rel_last'));
  if (last && cache.get('pg_rel_busy')) return last;
  cache.put('pg_rel_busy', '1', 30);
  var rel = null;
  try {
    var res = UrlFetchApp.fetch(PAGES_RAW + PAGES_REPO + '/main/app/release.json', { muteHttpExceptions: true });
    if (res.getResponseCode() === 200) {
      var r = JSON.parse(res.getContentText('UTF-8'));
      rel = { seq: Number(r.seq) || 0, build: String(r.build || ''), pages: Array.isArray(r.pages) ? r.pages.slice(0, 8) : [],
        server: Array.isArray(r.server) ? r.server.slice(0, 40) : [], notes: Array.isArray(r.notes) ? r.notes.slice(0, 12).map(String) : [],
        title: String(r.title || ''), codePage: String(r.codePage || '') };
    }
  } catch (err) { rel = null; }
  if (rel) { cachePut_('pg_rel', JSON.stringify(rel), PAGES_REL_SECS); cachePut_('pg_rel_last', JSON.stringify(rel), PAGES_KEEP_SECS); }
  else if (last) { cachePut_('pg_rel', JSON.stringify(last), 120); rel = last; }   // GitHub did not answer: the last good list, asked again in two minutes
  else cachePut_('pg_rel', 'null', 120);
  cache.remove('pg_rel_busy');
  return rel;
}
/* The page set to use: the newest one whose server code this script has. null: the pasted pages. */
function pagesSet_() {
  if (PAGE_MEMO_.set !== undefined) return PAGE_MEMO_.set;
  var set = null;
  try {
    if (PropertiesService.getScriptProperties().getProperty('PAGES_LOCAL') !== '1') {
      var rel = pagesRelease_(), list = rel ? rel.pages : [];
      for (var i = 0; i < list.length && !set; i++) {
        var p = list[i];
        if (p && Number(p.needsServer) <= APP_SEQ && /^[0-9a-f]{40}$/.test(String(p.ref || '')) && Array.isArray(p.files)) set = p;
      }
    }
  } catch (err) { set = null; }
  PAGE_MEMO_.set = set;
  return set;
}
function pageSha_(text) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, text, Utilities.Charset.UTF_8)
    .map(function (b) { return ('0' + (b & 255).toString(16)).slice(-2); }).join('');
}
function pagePack_(text) { return Utilities.base64Encode(Utilities.gzip(Utilities.newBlob(text, 'text/plain', 'page.txt')).getBytes()); }
function pageUnpack_(packed) {
  try { return Utilities.ungzip(Utilities.newBlob(Utilities.base64Decode(packed), 'application/x-gzip', 'page.gz')).getDataAsString('UTF-8'); }
  catch (err) { return null; }
}
/* One page of the set: from the cache, or from GitHub at the set's commit (checked, then cached). null: not to be had. */
function pageRemote_(set, name) {
  var f = null;
  set.files.forEach(function (x) { if (x && x.name === name) f = x; });
  if (!f || !/^[0-9a-f]{64}$/.test(String(f.sha256 || '')) || !/^[\w.-]+$/.test(String(f.path || ''))) return null;
  var cache = CacheService.getScriptCache(), key = 'pg_' + f.sha256.slice(0, 24), n = Number(cache.get(key + '_n') || 0);
  if (n > 0) {
    var keys = [];
    for (var i = 0; i < n; i++) keys.push(key + '_' + i);
    var got = cache.getAll(keys), parts = [];
    for (var j = 0; j < n && parts; j++) { if (got[keys[j]] == null) parts = null; else parts.push(got[keys[j]]); }
    if (parts) { var hit = pageUnpack_(parts.join('')); if (hit != null) return hit; }
  }
  if (cache.get(key + '_bad')) return null;   // failed a moment ago: not asked again for ten minutes
  var res = UrlFetchApp.fetch(PAGES_RAW + PAGES_REPO + '/' + set.ref + '/app/' + f.path, { muteHttpExceptions: true });
  var text = res.getResponseCode() === 200 ? res.getContentText('UTF-8') : null;
  // the page must be exactly the one the release lists, and a page from the lesson site never runs code on the server
  if (text == null || pageSha_(text) !== f.sha256 || /<\?(?!!=\s*include_\('(?:Styles|Ink)'\);?\s*\?>)/.test(text)) { cache.put(key + '_bad', '1', 600); return null; }
  try {
    var packed = pagePack_(text), put = {}, count = Math.ceil(packed.length / PAGES_CHUNK);
    for (var k = 0; k < count; k++) put[key + '_' + k] = packed.slice(k * PAGES_CHUNK, (k + 1) * PAGES_CHUNK);
    cache.putAll(put, PAGES_KEEP_SECS);
    cache.put(key + '_n', String(count), PAGES_KEEP_SECS);   // last, so a half-written page is never read
  } catch (err) { /* read from GitHub again next time */ }
  return text;
}
/* The pages a request needs, all from the same place: every one from the lesson site, or every one pasted (a page and
   the styles it pulls in always match). */
function pagesLoad_(names) {
  var set = pagesSet_(), out = {}, ok = !!set;
  if (ok) {
    for (var i = 0; i < names.length && ok; i++) {
      var t = null;
      try { t = pageRemote_(set, names[i]); } catch (err) { t = null; }
      if (t == null) ok = false; else out[names[i]] = t;
    }
  }
  if (!ok) {
    out = {};
    names.forEach(function (n) { out[n] = HtmlService.createHtmlOutputFromFile(n).getContent(); });
    PAGE_MEMO_.from = 'pasted';
  } else PAGE_MEMO_.from = 'site';
  names.forEach(function (n) { PAGE_MEMO_[n] = out[n]; });
  return out;
}
/* A page with its includes (Styles, Ink) put in as plain text: no page is ever run as a server template. */
function pageAssembled_(name) {
  return pageHtml_(name).replace(/<\?!=\s*include_\('(Styles|Ink)'\);?\s*\?>/g, function (m, n) { return pageHtml_(n); });
}
/* One page's text (after pagesLoad_ for a page with includes, the same source as the page). */
function pageHtml_(name) {
  if (typeof PAGE_MEMO_[name] === 'string') return PAGE_MEMO_[name];
  return pagesLoad_([name])[name];
}
/* Where the pages come from now, for Setup check. */
function pagesState_() {
  var p = PropertiesService.getScriptProperties();
  var rel = pagesRelease_();
  if (p.getProperty('PAGES_LOCAL') === '1') return { from: 'pasted', why: 'switched to the pasted pages', rel: rel };
  if (!rel) return { from: 'pasted', why: 'the lesson site did not answer' };
  var set = pagesSet_();
  if (!set) return { from: 'pasted', why: rel.pages.length ? 'the newest pages need newer server code' : 'the lesson site has no pages yet', rel: rel };
  return { from: 'site', seq: Number(set.seq) || 0, build: String(set.build || ''), rel: rel };
}

/* ---------- chapter packages ---------- */
//
// A chapter is one chapter of a subject on the lesson site (lessons.json: a subject's group, such as "Chapter 3 —
// Heat"), with its lessons (slides) and the homework that goes with them. Its key is the subject's id and the
// chapter's number ("g3physics:1"), or the chapter's name when it has no number.
// Giving a class a chapter opens all of its slides to that class for revision at once; each sub-chapter's homework is
// still set by itself once that part is taught (as before). Every worksheet carries its chapter (the Assignments tab's
// Chapter column): set by itself for homework from a lesson, chosen when a worksheet is made, or worked out from what
// set it. The Teacher Hub groups worksheets by chapter, and students find each chapter's homework in a folder of its
// own.
//   CHG_<CLASS>   { chapterKey: givenAt }   the chapters given to a class
var CH_MAX_GIVEN = 60;
function chapterKey_(subjectId, groupName) {
  var m = /\bchapter\s+(\d+[a-z]?)\b/i.exec(String(groupName || ''));
  var tail = m ? m[1].toLowerCase() : String(groupName || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
  return String(subjectId || '') + ':' + tail;
}
/* Every chapter on the lesson site that has slides: [{ key, subject, subjectName, color, name, num, decks: [{id, title, num}] }]. */
function chaptersAll_() {
  if (CH_MEMO_.all) return CH_MEMO_.all;
  var out = [], cat = null;
  try { cat = catalog_(); } catch (err) { cat = null; }
  ((cat && cat.subjects) || []).forEach(function (s) {
    (s.groups || []).forEach(function (g) {
      var decks = (g.items || []).filter(function (it) { return (it.kind || 'deck') === 'deck' && it.topicId; })
        .map(function (it) { return { id: String(it.topicId), title: String(it.title || ''), num: String(it.num || ''), file: String(it.file || '') }; });
      if (!decks.length) return;
      var m = /\bchapter\s+(\d+[a-z]?)\b/i.exec(String(g.name || ''));
      out.push({ key: chapterKey_(s.id, g.name), subject: String(s.id || ''), subjectName: String(s.name || ''), color: String(s.color || ''),
        name: String(g.name || ''), num: m ? m[1] : '', decks: decks });
    });
  });
  CH_MEMO_.all = out;
  return out;
}
var CH_MEMO_ = {};
function chapterByKey_(key) { return chaptersAll_().filter(function (c) { return c.key === key; })[0] || null; }
function chapterOfDeck_(deckId) {
  return chaptersAll_().filter(function (c) { return c.decks.some(function (d) { return d.id === deckId; }); })[0] || null;
}
/* The chapter of a worksheet titled with a sub-chapter number ("3.2 Heat capacity"), when only one chapter has it. */
function chapterOfTitle_(title) {
  var m = /^\s*(?:(?:ch(?:apter)?|ws|worksheet)\.?\s*)?(\d+)\.(\d+)[a-z]?(?![0-9])/i.exec(String(title || ''));
  if (!m) return null;
  // a lesson with that number (3.2, or 3.2a), or a lesson that is the whole chapter (1, for 1.2)
  var num = m[1] + '.' + m[2], hits = chaptersAll_().filter(function (c) {
    return c.decks.some(function (d) { return d.num === num || d.num === m[1] || (d.num.indexOf(num) === 0 && /^[a-z]$/i.test(d.num.slice(num.length))); });
  });
  return hits.length === 1 ? hits[0] : null;
}
/* Worksheets set by themselves from a lesson: worksheet id -> its lesson's chapter key (from WSD|deck|part|CLASS). */
function chapterBySet_() {
  if (CH_MEMO_.bySet) return CH_MEMO_.bySet;
  var out = {}, props = allProps_();
  Object.keys(props).forEach(function (k) {
    if (k.indexOf('WSD|') !== 0) return;
    var v = parseJson_(props[k]), deck = k.split('|')[1];
    if (!v || !v.id || !deck) return;
    var ch = chapterOfDeck_(deck);
    if (ch) out[v.id] = ch.key;
  });
  CH_MEMO_.bySet = out;
  return out;
}
/* A worksheet's chapter key: the one saved with it, or worked out ('' when none). */
function chapterOfWs_(a) {
  if (a.chapter === '-') return '';                        // the teacher said: no chapter
  if (a.chapter && chapterByKey_(a.chapter)) return a.chapter;
  var set = chapterBySet_()[a.id];
  if (set) return set;
  var t = chapterOfTitle_(a.title);
  return t ? t.key : (a.chapter || '');
}
function chapterInfo_(key) {
  var c = key ? chapterByKey_(key) : null;
  return c ? { key: c.key, name: c.name, num: c.num, subject: c.subject, subjectName: c.subjectName, color: c.color } : null;
}
/* The short name students see on a worksheet and its folder: "Chapter 3 · Heat" (the subject when it helps). */
function chapterShort_(c) {
  var name = String(c.name || '').replace(/\s*[—–-]\s*/, ' · ');
  return name || c.key;
}

/* ---- giving a class a chapter ---- */
function chGiven_(cls) { return parseJson_(PropertiesService.getScriptProperties().getProperty('CHG_' + normClass_(cls))) || {}; }
function chGivenAll_() {
  var out = {};
  Object.keys(readRoster_()).forEach(function (c) { if (c !== 'TEST') { var g = chGiven_(c); if (Object.keys(g).length) out[c] = g; } });
  return out;
}
/* Opens (or closes) a set of lessons to a class for revision, in one go. */
function setAllocMany_(cls, deckIds, on) {
  return withLock_(function () { return allocManyRaw_(cls, deckIds, on); }, 10000);
}
/* The same, for a caller that holds the lock already. */
function allocManyRaw_(cls, deckIds, on) {
  cls = normClass_(cls);
  return (function () {
    var props = PropertiesService.getScriptProperties(), list = parseJson_(props.getProperty('alloc_' + cls)) || [];
    var off = allocOff_(cls);
    deckIds.forEach(function (id) {
      list = list.filter(function (x) { return x !== id; });
      off = off.filter(function (x) { return x !== id; });
      if (on) list.push(id); else off.push(id);
    });
    if (list.length) props.setProperty('alloc_' + cls, JSON.stringify(list.slice(-150))); else props.deleteProperty('alloc_' + cls);
    props.setProperty('alloc_off_' + cls, JSON.stringify(off.slice(-150)));
    CacheService.getScriptCache().remove('alloc');
    return allocAll_();
  })();
}
/* The Hub: every chapter, which classes have it, and how many worksheets each class has in it. */
function api_t_chapters(token) {
  teacher_(token);
  var given = chGivenAll_(), counts = {};
  try {
    getAssignments_().forEach(function (a) {
      var k = chapterOfWs_(a);
      if (!k) return;
      counts[k] = (counts[k] || 0) + 1;
    });
  } catch (err) { counts = {}; }
  return { chapters: chaptersAll_().map(function (c) { return { key: c.key, subject: c.subject, subjectName: c.subjectName, color: c.color, name: c.name, num: c.num, lessons: c.decks.length, worksheets: counts[c.key] || 0 }; }), given: given };
}
/* Give a chapter to a class (all its slides open for revision now; its homework comes as each part is taught), or
   take it back (its slides close; homework already set stays). */
function api_t_chapterGive(token, key, cls, on) {
  teacher_(token);
  var ch = chapterByKey_(String(key || '')), c = normClass_(cls);
  if (!ch) throw new Error('That chapter is not on the lesson site.');
  // the class as the class list writes it ("1 E4" and "1E4" are the same class)
  if (!c || !Object.keys(readRoster_()).some(function (r) { return normClass_(r) === c; })) throw new Error('Choose a class.');
  var alloc = withLock_(function () {
    var props = PropertiesService.getScriptProperties(), k = 'CHG_' + c, g = chGiven_(cls);
    if (on) g[ch.key] = Date.now(); else delete g[ch.key];
    var keys = Object.keys(g).sort(function (a, b) { return g[a] - g[b]; });
    while (keys.length > CH_MAX_GIVEN) delete g[keys.shift()];
    if (Object.keys(g).length) props.setProperty(k, JSON.stringify(g)); else props.deleteProperty(k);
    return allocManyRaw_(cls, ch.decks.map(function (d) { return d.id; }), !!on);
  }, 10000);
  try { CacheService.getScriptCache().remove('lb_teachnext'); } catch (err) { /* refreshed in a minute */ }
  return { ok: true, given: chGivenAll_(), alloc: alloc, lessons: ch.decks.length };
}
/* Set (or clear) a worksheet's chapter by hand. '-' means: not in any chapter. */
function api_t_setChapter(token, id, key) {
  teacher_(token);
  var a = findAssignment_(id);
  if (!a) throw new Error('That worksheet was not found.');
  key = String(key || '');
  if (key && key !== '-' && !chapterByKey_(key)) throw new Error('That chapter is not on the lesson site.');
  ensureAssignmentCols_();
  hubSheet_(TABS.assignments.name).getRange(a.row, 18).setValue(key);
  return { ok: true, chapter: chapterInfo_(key === '-' ? '' : key) };
}
/* A lesson that is one sub-chapter as a whole (the Lower Secondary decks: 7.1, 7.2, ...): its number, for linking its
   homework by number like the numbered parts of longer decks. '' for other lessons. */
function wholeNum_(deckId) {
  var ch = chapterOfDeck_(deckId), d = ch ? ch.decks.filter(function (x) { return x.id === deckId; })[0] : null;
  return d && /^\d+\.\d+[a-z]?$/i.test(d.num) ? d.num : '';
}

/* ---- what else is in a chapter package: topical worksheets, and practice ----
   CHT|<chapterKey>   [{ file, name, path, mode }]   the chapter's topical worksheets, from the worksheet library. mode
                      'hw': set as homework for a class when the teacher chooses (due date, handed in, marked);
                      'practice': opened to a class to practise on (no due date, nothing handed in or marked).
   WS_PRACTICE        { worksheetId: 1 }   the worksheets that are practice. They stay out of Needs you, the
                      Tracker, This week and students' To do, and live in the chapter's package. */
var CH_TOPICAL_MAX = 30;
function allProps_() {
  if (!CH_MEMO_.props) CH_MEMO_.props = PropertiesService.getScriptProperties().getProperties();
  return CH_MEMO_.props;
}
function topicalAll_() {
  var out = {}, props = allProps_();
  Object.keys(props).forEach(function (k) {
    if (k.indexOf('CHT|') !== 0) return;
    var v = parseJson_(props[k]);
    if (Array.isArray(v) && v.length) out[k.slice(4)] = v;
  });
  return out;
}
function api_t_topicalSave(token, key, list) {
  teacher_(token);
  var ch = chapterByKey_(String(key || ''));
  if (!ch) throw new Error('That chapter is not on the lesson site.');
  var seen = {}, clean = (Array.isArray(list) ? list : []).filter(function (x) {
    if (!x || !x.file || seen[x.file]) return false;
    seen[x.file] = 1; return true;
  }).slice(0, CH_TOPICAL_MAX).map(function (x) {
    return { file: String(x.file).slice(0, 100), name: String(x.name || '').slice(0, 140), path: String(x.path || '').slice(0, 200), mode: x.mode === 'practice' ? 'practice' : 'hw' };
  });
  // one script property holds at most 9 KB: long folder names go first, then the last worksheets
  if (JSON.stringify(clean).length > 8500) clean.forEach(function (x) { x.path = ''; });
  while (clean.length && JSON.stringify(clean).length > 8500) clean.pop();
  var props = PropertiesService.getScriptProperties();
  if (clean.length) props.setProperty('CHT|' + ch.key, JSON.stringify(clean)); else props.deleteProperty('CHT|' + ch.key);
  if (CH_MEMO_.props) delete CH_MEMO_.props;
  return { ok: true, key: ch.key, topical: clean };
}
function practiceIds_() { return parseJson_(PropertiesService.getScriptProperties().getProperty('WS_PRACTICE')) || {}; }
/* Written only when it changes. A new worksheet never keeps the mark of a deleted one with the same ID, and the
   list drops worksheets no longer on the sheet once it is long. */
function setPractice_(id, on) {
  var props = PropertiesService.getScriptProperties(), p = practiceIds_();
  if (!!p[id] === !!on) return;
  if (on) p[id] = 1; else delete p[id];
  if (Object.keys(p).length > 300) {
    var live = {};
    try { getAssignments_().forEach(function (a) { live[a.id] = 1; }); } catch (err) { live = null; }
    if (live) Object.keys(p).forEach(function (k) { if (!live[k] && k !== id) delete p[k]; });
  }
  if (Object.keys(p).length) props.setProperty('WS_PRACTICE', JSON.stringify(p)); else props.deleteProperty('WS_PRACTICE');
}
/* learnwithmrcedric: the chapter packages one student sees, in the lesson site's order: the chapters given to the
   class, chapters with a lesson open to them, and chapters their homework is in. */
function studentPackages_(cls, lessons, hub) {
  var want = {}, given = chGiven_(cls), site = '', open = {};
  try { site = lessonSite_(); } catch (err) { site = ''; }
  try { allocFor_(cls).forEach(function (id) { open[id] = 1; }); } catch (err) { open = {}; }
  Object.keys(given).forEach(function (k) { want[k] = 1; });
  (lessons || []).forEach(function (l) { if (l.open) { var c = chapterOfDeck_(l.id); if (c) want[c.key] = 1; } });
  ((hub && !hub.error && hub.homework) || []).forEach(function (w) { if (w.chapter) want[w.chapter] = 1; });
  return chaptersAll_().filter(function (c) { return want[c.key]; }).map(function (c) {
    return { key: c.key, name: chapterShort_(c), subject: c.subject, subjectName: c.subjectName, color: c.color, given: !!given[c.key],
      decks: c.decks.map(function (d) { return d.id; }),
      items: c.decks.map(function (d) { return { id: d.id, num: d.num, title: d.title, url: d.file ? site + d.file : '', open: !!open[d.id] }; }) };
  });
}

/* ------------------------------------------------------------------ */
/* Release 22: Revision rush, and the Arcade on learnwithmrcedric      */
/* ------------------------------------------------------------------ */
// Revision rush: 5 choice questions from the lessons open to the class (never the chapter check), in 60 seconds, once
// a day for points: 1 for each right answer (the fun puzzles' points) and 2 more for all 5. A student gets the same
// questions all day, and the clock starts at the first Start, so starting again does not give more time.
var RUSH_N = 5, RUSH_SECS = 60;
function rushSeed_(str) {
  var h = 2166136261;
  for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function rushRand_(seed) {
  var a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    var t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
// The choice questions in the lessons open to a class: [{ id, text, options, answer, why, from }].
function rushPool_(cls) {
  var out = [], seen = {};
  allocFor_(cls).forEach(function (deckId) {
    var d = null;
    try { d = findDeck_(deckId); } catch (e) { d = null; }
    var check = {};
    ((d && d.check) || []).forEach(function (id) { check[id] = 1; });
    var from = d ? String(d.title || '') : '';
    var boards = [];
    try { boards = readDeckBoardsFor_(deckId); } catch (e) { boards = []; }
    boards.forEach(function (b) {
      if (b.kind !== 'choice' || check[b.taskId]) return;
      var opts = (b.columns || []).map(function (x) { return String(x == null ? '' : x).trim(); }).filter(String);
      var c = String(b.correct || '').trim(), ans = opts.indexOf(c);
      if (ans < 0 && /^[A-F]$/i.test(c)) ans = 'ABCDEF'.indexOf(c.toUpperCase());
      var text = String(b.title || '').trim();
      if (opts.length < 2 || opts.length > 6 || ans < 0 || ans >= opts.length || !text || text.length > 240) return;
      var k = text.toLowerCase() + '|' + opts.join('|').toLowerCase();
      if (seen[k]) return;
      seen[k] = 1;
      out.push({ id: deckId + '|' + b.taskId, text: text, options: opts, answer: ans, why: String(b.model || '').slice(0, 300), from: from.slice(0, 80) });
    });
  });
  return out;
}
function rushToday_(s, log) {
  var day = Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd'), done = null, best = 0;
  (log || rwLog_()).forEach(function (e) {
    if (e.what !== 'Daily' || e.cls !== s.cls || hubNormName_(e.name) !== hubNormName_(s.name)) return;
    var d = e.item.split(':');
    if (d[0] !== 'r') return;
    var sc = Number(d[2]) || 0;
    if (sc > best) best = sc;
    if (d[1] === day) done = { score: sc, points: e.points };
  });
  return { day: day, done: !!done, score: done ? done.score : 0, points: done ? done.points : 0, best: best, n: RUSH_N, secs: RUSH_SECS };
}
function rushState_(s, log) {
  var r = rushToday_(s, log), n = 0;
  try { n = rushPool_(s.cls).length; } catch (e) { n = 0; }
  r.ready = n >= RUSH_N;
  r.each = Number(rwRules_().dailyFun) || 1;
  return r;
}
// The day's first Start for each student, kept with the cache (the cache can lose it): { day, at: { key: ms } }.
function rushStarted_(s, day, at) {
  var props = PropertiesService.getScriptProperties(), all = parseJson_(props.getProperty('RUSH_START')) || {}, k = studentKey_(s);
  if (all.day !== day) all = { day: day, at: {} };
  if (!at) return all.at[k] || 0;
  if (all.at[k]) return all.at[k];
  var lock = hubLock_();
  if (lock.tryLock && !lock.tryLock(5000)) return at;
  try {
    all = parseJson_(props.getProperty('RUSH_START')) || {};
    if (all.day !== day) all = { day: day, at: {} };
    if (!all.at[k]) { all.at[k] = at; props.setProperty('RUSH_START', JSON.stringify(all)); }
    return all.at[k];
  } finally { if (lock.releaseLock) lock.releaseLock(); }
}
function rushKey_(s, day) { return 'rush_' + Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, studentKey_(s))).slice(0, 24) + '_' + day; }
function api_rush_start(token) {
  var s = funGuard_(who_(token)), today = rushToday_(s);
  if (today.done) throw new Error('You have done today\'s Revision rush. A new one comes tomorrow.');
  var pool = rushPool_(s.cls);
  if (pool.length < RUSH_N) throw new Error('Revision rush opens when your teacher has opened lessons with more questions.');
  var rnd = rushRand_(rushSeed_(today.day + '|' + s.cls + '|' + hubNormName_(s.name)));
  var mix = function (list) { for (var i = list.length - 1; i > 0; i--) { var j = Math.floor(rnd() * (i + 1)), t = list[i]; list[i] = list[j]; list[j] = t; } return list; };
  var picked = mix(pool).slice(0, RUSH_N).map(function (q) {
    var order = mix(q.options.map(function (o, k) { return k; }));
    return { text: q.text, options: order.map(function (k) { return q.options[k]; }), answer: order.indexOf(q.answer), why: q.why, from: q.from };
  });
  var cache = CacheService.getScriptCache(), key = rushKey_(s, today.day), old = parseJson_(cache.get(key));
  var at = (old && old.at) || rushStarted_(s, today.day, 0) || 0, again = !!at;
  if (!at) at = rushStarted_(s, today.day, Date.now());
  cache.put(key, JSON.stringify({ at: at, a: picked.map(function (q) { return q.answer; }), why: picked.map(function (q) { return q.why; }) }), 21600);
  var left = Math.max(0, RUSH_SECS - Math.round((Date.now() - at) / 1000));
  return { n: RUSH_N, secs: left, again: again, qs: picked.map(function (q) { return { text: q.text, options: q.options, from: q.from }; }) };
}
function api_rush_finish(token, answers) {
  var s = who_(token), day = Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd');
  var cache = CacheService.getScriptCache(), key = rushKey_(s, day), g = parseJson_(cache.get(key));
  if (!g) throw new Error('This rush ran out. Start it again.');
  var a = Array.isArray(answers) ? answers : [], score = 0, each = Number(rwRules_().dailyFun) || 1;
  var results = g.a.map(function (right, i) {
    var c = Math.round(Number(a[i]));
    if (!(c >= 0)) c = -1;
    if (c === right) score++;
    return { right: c === right, answer: right, choice: c, why: g.why[i] || '' };
  });
  var late = Date.now() - g.at > (RUSH_SECS + 20) * 1000;
  var pts = late ? 0 : score * each + (score === RUSH_N ? 2 : 0);
  var lock = hubLock_();
  lock.waitLock(30000);
  try {
    // Once: the rush is taken from the cache here, under the lock, so two answers sent at once cannot both count.
    if (!cache.get(key)) throw new Error('This rush has been answered already.');
    if (rushToday_(s).done) throw new Error('You have done today\'s Revision rush. A new one comes tomorrow.');
    cache.remove(key);
    rwSheet_('log').appendRow([new Date(), s.cls, s.reg, s.name, 'Daily', 'r:' + day + ':' + score, pts, 0, '', '', 'rush']);
    SpreadsheetApp.flush();
  } finally { lock.releaseLock(); }
  var r = rushToday_(s);
  r.done = true; r.score = score; r.points = pts; r.best = Math.max(r.best || 0, score); r.ready = true; r.each = each;
  return { score: score, n: RUSH_N, points: pts, late: late, results: results, rush: r };
}
// For learnwithmrcedric's Lessons page: today's puzzles and Revision rush, with the student's streak. Nothing while the
// class is in its Science lesson (as Homework's Arcade).
function api_st_arcade(st) {
  var t = api_ticketLogin(st), s = who_(t.token);
  var fun = s.cls === 'TEST' ? { open: true, live: false } : funState_(s);
  if (!fun.open) return { open: false };
  var d = api_daily(t.token);
  return { open: true, day: d.day, streak: d.streak,
    items: d.items.map(function (it) { return { key: it.key, name: it.name, points: it.points, done: it.done, right: it.right }; }),
    rush: d.rush || null };
}

/* ------------------------------------------------------------------ */
/* Release 23: a worksheet uploaded straight into a chapter              */
/* ------------------------------------------------------------------ */
// From the Lesson library. The PDF goes into the worksheet library (<subject> / <chapter> / <worksheet>, with its marked
// solution beside it when given), then into the chapter's package. use: { kind: 'hw' | 'practice' } for a topical
// worksheet, or { kind: 'part', deck, part, t, num } for the homework of one part of a lesson in the chapter.
function api_t_libUpload(token, key, name, pdfB64, solB64, use) {
  teacher_(token);
  CH_MEMO_ = {};
  var ch = chapterByKey_(String(key || ''));
  if (!ch) throw new Error('That chapter is not on the lesson site.');
  use = use || {};
  var deck = String(use.deck || ''), part = String(use.part == null ? '' : use.part);
  if (use.kind === 'part' && (!part || !ch.decks.some(function (d) { return d.id === deck; }))) throw new Error('Choose a part of a lesson in this chapter.');
  var nm = hubClean_(String(name || '').replace(/\.pdf$/i, '')).slice(0, 80);
  if (!nm) throw new Error('Give the worksheet a name.');
  var isPdf = function (b) { return b && b.length > 4 && String.fromCharCode.apply(null, b.slice(0, 4)) === '%PDF'; };
  var bytes = Utilities.base64Decode(String(pdfB64 || ''));
  if (!isPdf(bytes)) throw new Error('The worksheet is not a PDF.');
  var sol = solB64 ? Utilities.base64Decode(String(solB64)) : null;
  if (sol && !isPdf(sol)) throw new Error('The marked solution is not a PDF.');
  var path = [hubClean_(ch.subjectName || ch.subject || 'Lessons'), hubClean_(chapterShort_(ch))].filter(String).join(' / ');
  var folder = libNewFolder_(libTopic_(path), nm);
  var file = folder.createFile(Utilities.newBlob(bytes, 'application/pdf', nm + '.pdf'));
  var solFile = sol ? folder.createFile(Utilities.newBlob(sol, 'application/pdf', nm + ' marked solution.pdf')) : null;
  libDrop_();
  var out = { item: { id: file.getId(), folder: folder.getId(), name: nm, file: nm + '.pdf', path: path, kind: 'pdf', ok: true, size: bytes.length, updated: Date.now(),
    sol: solFile ? { id: solFile.getId(), name: solFile.getName() } : null, key: null, notes: false, used: [] } };
  if (use.kind === 'part') {
    out.link = api_t_setLink(token, deck, part, file.getId(), String(use.t || '').slice(0, 80), String(use.num || '').slice(0, 12), 72);
    out.deck = deck; out.part = part;
  } else {
    var now = parseJson_(PropertiesService.getScriptProperties().getProperty('CHT|' + ch.key)) || [];
    out.topical = api_t_topicalSave(token, ch.key, now.concat([{ file: file.getId(), name: nm, path: '', mode: use.kind === 'practice' ? 'practice' : 'hw' }])).topical;
  }
  return out;
}

/* ---------- Release 26: the Google lock ----------
   With it on, the teacher PIN typed on its own opens nothing that shows students' names: the Teacher Hub opens only
   for the Google account that owns this script (it signs that account in by itself), and phones, laptops and the
   projector are paired from the Hub (their keys keep working). Presenting from the slides, and the teacher's
   Not you? on a student's iPad, still take the PIN: they show no names. */
function glockOn_() { return PropertiesService.getScriptProperties().getProperty('GLOCK') === 'on'; }
var GLOCK_MSG = 'The teacher PIN alone does not open this any more. Open the Teacher Hub signed in to Google with the account that owns learnwithmrcedric, or pair this phone or laptop from the Hub (Teach next > Pair my phone).';
