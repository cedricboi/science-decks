/* ================================================================== */
/* My Science: Live Board and the Teacher Hub in one app               */
/* ================================================================== */
//
// This project holds three code files: Code (Live Board: My Science, the slides, the phone and the boards),
// Hub (the Teacher Hub: homework, marking, the tracker and points) and App (this file: the one web address,
// the move from two apps to one, the setup check and updates). The two sheets stay as they were: this script
// belongs to the Live Board sheet, and opens the Teacher Hub sheet by its ID (Settings: Class list sheet ID).
//
// One web address for everything:
//   /exec                 My Science (students)
//   /exec?view=teacher    Live Board's teacher page (the phone, boards and the projector)
//   /exec?teacher         the Teacher Hub
//   /exec?embed=ms        homework, inside My Science (also ?hw, and ?preview=CODE for See it as a student)
//   /exec?projector       the projector screen on the laptop (lessons chosen on the phone)

var APP_BUILD = '2026-10-07-one';

function doGet(e) {
  var p = (e && e.parameter) || {};
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
  SpreadsheetApp.getUi().createMenu('My Science')
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
/* Run by the owner of My Science (from the script editor, or the owner signed in to Google): setup and updates. */
function isOwner_() {
  var me = '', owner = '';
  try { me = Session.getActiveUser().getEmail() || ''; owner = Session.getEffectiveUser().getEmail() || ''; } catch (err) { return false; }
  return !!me && me.toLowerCase() === owner.toLowerCase();
}
function needOwner_(what) {
  if (!isOwner_()) throw new Error('OWNER_ONLY: ' + (what || 'This') + ' works only for the owner of My Science: run it from the script editor, or open the Teacher Hub signed in to Google with the account that owns it.');
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
  if (!hubReady_()) throw new Error('HUB_NOT_MOVED: The Teacher Hub has not been moved into My Science yet. In the script editor, run setupMyScience (see the code page).');
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
/* Links this app to itself: homework in My Science, the Teacher Hub's links and Claude's marking all use this web
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
    out.push('My Science (students): ' + url);
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
      if (!p.num) return;
      var k = linkKey_(s.deck, p.num);
      if (!links[k] && !want[k]) want[k] = { deck: s.deck, num: p.num, t: p.t || '' };
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
  var subs = submissionIndex_(), assigns = getAssignments_().filter(function (a) { return a.fileId; }), byClass = studentsByClass_();
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
  if (c.autoset && c.autoset.length) h += '<p class="wk-l">Set by itself</p><ul>' + c.autoset.map(function (x) { return '<li>' + e(x.title) + (x.part ? ' <small>' + e(x.part) + '</small>' : '') + (x.due ? ' <small>due ' + e(x.due) + '</small>' : '') + '</li>'; }).join('') + '</ul>';
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

/* ---------- Setup check: everything My Science needs, with a fix for each ---------- */
//
// Each check: { id, level: 'ok' | 'warn' | 'bad' | 'info', title, detail, fix: { act, label } | null, link }
// The Teacher Hub shows them (menu: Setup check) with their Fix buttons; the sheet's menu shows the same list.
function setupChecks_() {
  var out = [], props = PropertiesService.getScriptProperties();
  var add = function (id, level, title, detail, fix, link) { out.push({ id: id, level: level, title: title, detail: detail || '', fix: fix || null, link: link || '' }); };
  // The web address
  var url = selfUrl_();
  if (!url) add('url', 'bad', 'The web address is not known', 'Deploy the web app, then in the sheet: My Science > Change the web app link.');
  else if (/\/dev$/.test(url)) add('url', 'bad', 'The web address is the test link (/dev)', 'Use the /exec link: My Science > Change the web app link.');
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
  // Classes: Live Board's class list and the Hub's Students tab
  try {
    var lb = Object.keys(readRoster_()).filter(function (c) { return c !== 'TEST'; }), hubCls = hubReady_() ? Object.keys(studentsByClass_()) : [];
    var key = function (c) { return String(c).toUpperCase().replace(/[\s\-_.]+/g, ''); }, hk = hubCls.map(key);
    var missing = lb.filter(function (c) { return hk.indexOf(key(c)) < 0; });
    if (!lb.length) add('classes', 'bad', 'No classes yet', 'Add students to the Students tab of the Live Board sheet.');
    else if (hubReady_() && missing.length) add('classes', 'warn', 'Some classes are not in the Teacher Hub', missing.join(', ') + ' are on Live Board\'s class list but not on the Hub\'s Students tab, so no homework is set for them.');
    else add('classes', 'ok', 'Classes', lb.join(', '));
  } catch (e) { add('classes', 'warn', 'The class lists could not be read', String(e.message || e)); }
  // Timers
  try {
    var trig = ScriptApp.getProjectTriggers().map(function (t) { return t.getHandlerFunction(); });
    var want = false;
    try { want = hubReady_() && tickWanted_(); } catch (e) { want = false; }
    var tickOn = trig.some(function (h) { return /tick/i.test(h); });
    if (want && !tickOn) add('timers', 'bad', 'The 15-minute timer is off', 'Homework hands itself in, Claude marks and sub-chapter homework is set only while it runs.', { act: 'timers', label: 'Turn it on' });
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
    } else add('autolink', 'info', 'Worksheets link themselves: off', 'Name library worksheets with the sub-chapter number ("3.2 Heat capacity.pdf") and they are set by themselves once taught.', { act: 'autolink_on', label: 'Switch on' });
  }
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
    if (up && up.newer) list.unshift({ id: 'update', level: 'warn', title: 'An update is ready: ' + up.latest, detail: (up.notes || []).join(' · ') + (up.owner ? '' : ' (Only the owner of My Science can update: open the Teacher Hub signed in to Google with that account.)'), fix: up.owner ? { act: 'update', label: 'Update' } : null, link: '' });
    else if (up && up.latest) list.push({ id: 'update', level: 'ok', title: 'Up to date', detail: 'Build ' + APP_BUILD + '.', fix: null, link: '' });
    else if (up && up.error) list.push({ id: 'update', level: 'info', title: 'Updates could not be checked', detail: up.error, fix: null, link: '' });
    if (up && up.state && up.state.prev && up.state.prev.version) list.push({ id: 'undo', level: 'info', title: 'Last update: ' + (up.state.prev.toBuild || ''), detail: 'Undo puts My Science back on ' + (up.state.prev.build || 'the version before') + '.', fix: { act: 'undo', label: 'Undo the update' }, link: '' });
  }
  return { checks: list, build: APP_BUILD, update: up };
}
function api_t_setupFix(token, act) {
  teacher_(token);
  var props = PropertiesService.getScriptProperties();
  if (act === 'timers') { ensureTick_(true); return { ok: true, done: 'Timer on' }; }
  if (act === 'autolink_on') { props.setProperty('AUTO_LINK', 'on'); if (!props.getProperty('AUTO_LINK_AT')) props.setProperty('AUTO_LINK_AT', String(Date.now())); ensureTick_(tickWanted_()); return { ok: true, done: 'Worksheets link themselves from now on' }; }
  if (act === 'autolink_off') { props.setProperty('AUTO_LINK', 'off'); return { ok: true, done: 'Switched off' }; }
  if (act === 'unpair') { var n = unpairAll_(); return { ok: true, done: n + ' unpaired. Pair your phone and the projector again.' }; }
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
  var rows = url ? [['Teacher Hub (bookmark this)', url + '?teacher'], ['My Science, for students', url], ['Live Board teacher page', url + '?view=teacher'], ['Projector screen (on the laptop)', projectorUrl_() + '#app=' + encodeURIComponent(url)]] : [];
  var html = '<div style="font:14px Arial,sans-serif;line-height:1.5">' + (rows.length ? rows.map(function (r) {
    return '<p style="margin:0 0 10px"><b>' + esc_(r[0]) + '</b><br><a href="' + esc_(r[1]) + '" target="_blank">' + esc_(r[1]) + '</a></p>';
  }).join('') : '<p>The web address is not known yet. Deploy, then My Science > Change the web app link.</p>') + '</div>';
  SpreadsheetApp.getUi().showModalDialog(HtmlService.createHtmlOutput(html).setWidth(560).setHeight(320), 'My links');
}

/* ---------- one-click updates ---------- */
//
// New versions of My Science are put in the app folder of the lesson repository (cedricboi/science-decks):
// release.json (the release number, what is new, the commit holding the files, and each file's SHA-256) and the
// files themselves. Update (Teacher Hub > Setup check and updates, the owner only) reads them at that commit,
// checks each file against its SHA-256, writes them into this script with the Apps Script API (files the release
// does not list are kept), saves a new version and puts the web address on it. Undo puts back the code and the web
// address of the version before. Students' and the teacher's data are not touched. It needs the Apps Script API
// switched on once, for the owner's account: https://script.google.com/home/usersettings
var APP_SEQ = 18;   // the release number (newer releases have bigger numbers)
var UPDATE_REPO = 'cedricboi/science-decks', UPDATE_BRANCH = 'main', UPDATE_DIR = 'app/', UPDATE_SETTINGS = 'https://script.google.com/home/usersettings';
function updRaw_(ref, path) {
  var res = UrlFetchApp.fetch('https://raw.githubusercontent.com/' + UPDATE_REPO + '/' + encodeURIComponent(ref) + '/' + UPDATE_DIR + path, { muteHttpExceptions: true });
  var code = res.getResponseCode();
  if (code === 404) throw new Error('UPDATE_NONE: There is no ' + path + ' in the app folder of ' + UPDATE_REPO + ' yet.');
  if (code !== 200) throw new Error('GitHub did not give ' + path + ' (error ' + code + '). Try again in a minute.');
  return res.getContentText('UTF-8');
}
function updSha_(text) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, text, Utilities.Charset.UTF_8)
    .map(function (b) { return ('0' + (b & 255).toString(16)).slice(-2); }).join('');
}
function updRelease_(fresh) {
  var cache = CacheService.getScriptCache();
  if (!fresh) { var hit = parseJson_(cache.get('upd_rel')); if (hit) return hit; }
  var rel = JSON.parse(updRaw_(UPDATE_BRANCH, 'release.json'));
  if (!rel || !rel.build || !Array.isArray(rel.files) || !rel.files.length) throw new Error('The release on GitHub is not complete.');
  try { cache.put('upd_rel', JSON.stringify(rel), 3600); } catch (e) { /* asked again next time */ }
  return rel;
}
function updNewer_(rel) { return rel && (Number(rel.seq) ? Number(rel.seq) > APP_SEQ : String(rel.build) > String(APP_BUILD)); }
/* The Apps Script API, as the owner of this script. */
function updApi_(method, path, body) {
  var opt = { method: method, muteHttpExceptions: true, headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() }, contentType: 'application/json' };
  if (body) opt.payload = JSON.stringify(body);
  var res = UrlFetchApp.fetch('https://script.googleapis.com/v1/projects/' + ScriptApp.getScriptId() + path, opt);
  var code = res.getResponseCode(), out = {};
  try { out = JSON.parse(res.getContentText() || '{}'); } catch (e) { out = {}; }
  if (code >= 200 && code < 300) return out;
  var why = out.error && out.error.message ? out.error.message : 'error ' + code;
  if (/usersettings|has not enabled|not been used|disabled/i.test(why)) throw new Error('UPDATE_API_OFF: Updates need the Apps Script API switched on for your Google account. Open ' + UPDATE_SETTINGS + ', switch on Google Apps Script API, then press Update again.');
  if (code === 403) throw new Error('UPDATE_SCOPE: Google says this script may not change itself yet (' + why + '). In the script editor, run setupMyScience once to give it permission, then press Update again.');
  throw new Error('The Apps Script API said: ' + why);
}
/* The permissions this script has now (from Google's token check). */
function updGranted_() {
  try {
    var res = UrlFetchApp.fetch('https://oauth2.googleapis.com/tokeninfo?access_token=' + encodeURIComponent(ScriptApp.getOAuthToken()), { muteHttpExceptions: true });
    var j = JSON.parse(res.getContentText() || '{}');
    return String(j.scope || '').split(/\s+/).filter(String);
  } catch (e) { return null; }
}
function updDeploymentId_() {
  var m = /^https:\/\/script\.google\.com\/(?:a\/macros\/[^\/]+|a\/[^\/]+\/macros|macros)(?:\/u\/\d+)?\/s\/([-\w]+)\/exec/.exec(selfUrl_() || '');
  return m ? m[1] : '';
}
function updState_() {
  var p = PropertiesService.getScriptProperties();
  return { prev: parseJson_(p.getProperty('UPDATE_PREV')), last: parseJson_(p.getProperty('UPDATE_LAST')) };
}
function updBusy_(on) {
  var cache = CacheService.getScriptCache();
  if (on) { if (cache.get('upd_busy')) throw new Error('An update is already running.'); cache.put('upd_busy', '1', 300); }
  else cache.remove('upd_busy');
}
function api_t_updateCheck(token, fresh) {
  teacher_(token);
  var out = { current: APP_BUILD, seq: APP_SEQ, latest: '', newer: false, notes: [], title: '', can: !!updDeploymentId_(), owner: isOwner_(), state: updState_() };
  try {
    var rel = updRelease_(!!fresh);
    out.latest = rel.build; out.newer = updNewer_(rel); out.notes = (rel.notes || []).slice(0, 12); out.title = rel.title || '';
  } catch (e) { out.error = String(e.message || e).replace(/^UPDATE_NONE: /, ''); }
  return out;
}
function api_t_updateRun(token) {
  teacher_(token);
  needOwner_('Update');
  updBusy_(true);
  try { return updateRun_(); } finally { updBusy_(false); }
}
function updateRun_() {
  var dep = updDeploymentId_();
  if (!dep) throw new Error('The web address is not known, so the update cannot be put live. Set it with My Science > Change the web app link in the sheet.');
  var rel = updRelease_(true), ref = rel.ref || UPDATE_BRANCH;
  // 1. The files, from GitHub, at the release's own commit, each checked against its SHA-256.
  var files = rel.files.map(function (f) {
    if (!/^(SERVER_JS|HTML|JSON)$/.test(f.type) || !/^[\w.-]+$/.test(f.name || '') || !/^[\w.-]+$/.test(f.path || '')) throw new Error('The release lists a file it cannot use: ' + f.name);
    var src = updRaw_(ref, f.path);
    if (f.sha256 && updSha_(src) !== String(f.sha256).toLowerCase()) throw new Error('GitHub is still putting the new files out (' + f.path + ' is not the one the release lists). Try again in a few minutes.');
    return { name: f.name, type: f.type, source: src };
  });
  // 2. This script's files now: those the release does not list are kept.
  var cur = updApi_('get', '/content');
  var keep = (cur.files || []).filter(function (f) { return !files.some(function (n) { return n.name === f.name && n.type === f.type; }); })
    .map(function (f) { return { name: f.name, type: f.type, source: f.source }; });
  var props = PropertiesService.getScriptProperties();
  // 3. New permissions: only the manifest goes in now (the old code keeps running), until the owner has allowed them.
  var man = files.filter(function (f) { return f.name === 'appsscript'; })[0], need = [];
  if (man) {
    var want = (parseJson_(man.source) || {}).oauthScopes || [], have = updGranted_();
    if (have) need = want.filter(function (s) { return have.indexOf(s) < 0; });
  }
  if (need.length) {
    var oldFiles = (cur.files || []).filter(function (f) { return f.name !== 'appsscript'; }).map(function (f) { return { name: f.name, type: f.type, source: f.source }; });
    updApi_('put', '/content', { scriptId: ScriptApp.getScriptId(), files: oldFiles.concat([man]) });
    props.setProperty('UPDATE_LAST', JSON.stringify({ build: rel.build, at: Date.now(), live: false, need: need }));
    return { ok: true, live: false, build: rel.build, need: need,
      message: 'This update needs a permission My Science did not have before. In the Live Board sheet\'s script, run setupMyScience once (Google asks you to allow it), then press Update again.' };
  }
  updApi_('put', '/content', { scriptId: ScriptApp.getScriptId(), files: files.concat(keep) });
  // 4. A new version, and the web address on it.
  var v = updApi_('post', '/versions', { description: 'My Science ' + rel.build });
  var d = updApi_('get', '/deployments/' + dep), prevV = d.deploymentConfig && d.deploymentConfig.versionNumber;
  updApi_('put', '/deployments/' + dep, { deploymentConfig: { scriptId: ScriptApp.getScriptId(), versionNumber: v.versionNumber, manifestFileName: 'appsscript', description: 'My Science ' + rel.build } });
  if (prevV) props.setProperty('UPDATE_PREV', JSON.stringify({ version: prevV, build: APP_BUILD, at: Date.now(), to: v.versionNumber, toBuild: rel.build }));
  props.setProperty('UPDATE_LAST', JSON.stringify({ build: rel.build, at: Date.now(), live: true, version: v.versionNumber }));
  CacheService.getScriptCache().remove('upd_rel');
  return { ok: true, live: true, build: rel.build, version: v.versionNumber, undo: !!prevV };
}
/* Undo: the code and the web address go back to the version before the last update (the timers run the saved
   code, so both go back). */
function api_t_updateUndo(token) {
  teacher_(token);
  needOwner_('Undo');
  var dep = updDeploymentId_(), props = PropertiesService.getScriptProperties(), prev = parseJson_(props.getProperty('UPDATE_PREV'));
  if (!dep || !prev || !prev.version) throw new Error('There is no update to undo.');
  updBusy_(true);
  try {
    var old = updApi_('get', '/content?versionNumber=' + encodeURIComponent(prev.version));
    if (old.files && old.files.length) updApi_('put', '/content', { scriptId: ScriptApp.getScriptId(), files: old.files.map(function (f) { return { name: f.name, type: f.type, source: f.source }; }) });
    updApi_('put', '/deployments/' + dep, { deploymentConfig: { scriptId: ScriptApp.getScriptId(), versionNumber: prev.version, manifestFileName: 'appsscript', description: 'My Science ' + (prev.build || '') + ' (undo)' } });
  } finally { updBusy_(false); }
  props.deleteProperty('UPDATE_PREV');
  props.setProperty('UPDATE_LAST', JSON.stringify({ build: prev.build || '', at: Date.now(), live: true, version: prev.version, undone: true }));
  return { ok: true, build: prev.build || '', version: prev.version };
}

