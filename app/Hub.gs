/**
 * Worksheet Hub (pilot)
 * Students write on a worksheet PDF in Safari on their iPad and hand it in.
 * Everything is stored in the teacher's own Google Drive.
 *
 * This script lives inside a Google Sheet. Use the "Worksheet Hub" menu in that Sheet.
 */

var TZ = 'Asia/Singapore';

// Shown on the students' sign-in page. Change these to suit your class.
var APP_TITLE = 'Science homework';
var APP_SCHOOL = 'Assumption English School';

// Your class website, shown as a link in the Teacher Hub. Leave '' to hide it.
var SITE_URL = 'https://sites.google.com/moe.edu.sg/learnwithmrcedric';
// Live Board (learnwithmrcedric for students, the teacher page for you). Same link as in your slides. If you ever
// make a new Live Board deployment, put its link in Script Properties as LIVEBOARD_URL instead of editing this.
var LIVEBOARD_URL = 'https://script.google.com/macros/s/AKfycbx-MTv5lHHVpwgMB0dz1Zo-8iwln05emI8GGv_LJIBAjCEG4po_3ZY050uXdZYgINOYjA/exec';
// The lesson site (GitHub Pages) whose lessons.json lists every lesson. The Teach tab opens its slides.
// A Script Property LESSON_SITE overrides it.
var LESSON_SITE = 'https://cedricboi.github.io/science-decks/';
function lessonSiteUrl_() {
  var u = '';
  try { u = PropertiesService.getScriptProperties().getProperty('LESSON_SITE') || ''; } catch (e) { u = ''; }
  u = /^https:\/\//.test(u) ? u : LESSON_SITE;
  return /\/$/.test(u) ? u : u + '/';
}
function liveBoardUrl_() { return selfUrl_(); }   // one app: Live Board is this web address

var TABS = {
  students: {
    name: 'Students',
    headers: ['Class', 'Reg No (optional)', 'Name']
  },
  assignments: {
    name: 'Assignments',
    headers: ['ID', 'Title', 'Classes (blank = all)', 'Worksheet PDF link', 'Open', 'Show marked work', 'Due (optional)', 'Check', 'Class report', 'Answer key', 'Show answers', 'Corrections closed', 'Marked solution', 'Close at due time', 'Corrections days', 'Answers after corrections', 'Marking released at', 'Chapter']
  },
  submissions: {
    name: 'Submissions',
    headers: ['Handed in at', 'Assignment ID', 'Title', 'Class', 'Reg No', 'Name', 'Pages written on', 'Pen strokes', 'File', 'Marked file', 'Score', 'Comment', 'First handed in', 'Corrections handed in', 'Corrections file', 'Marking checked', 'Mostly blank', 'Handed in by']
  }
};

var FOLDERS = {
  ROOT: 'Worksheet Hub',
  SUB: 'Submissions',
  MARKED: 'Marked work (put marked PDFs here)',
  ZIPS: 'Zips',
  WORKS: 'Worksheets',
  DRAFTS: 'Drafts (do not edit)',
  CORR: 'Corrections',
  LIB: 'Worksheet library',
  NOTES: 'Student folders and notes (do not edit)'
};

/* ------------------------------------------------------------------ */
/* Menu                                                                */
/* ------------------------------------------------------------------ */

function hubOnOpen_() {
  SpreadsheetApp.getUi().createMenu('Worksheet Hub')
    .addItem('Open the Teacher Hub', 'showTeacherHub')
    .addItem('Set teacher passcode', 'setTeacherPasscode')
    .addItem('Set the web app link', 'setWebAppLink')
    .addSeparator()
    .addItem('1. Set up (run once)', 'setupHub')
    .addItem('2. Check student list', 'checkStudents')
    .addItem('3. Check assignments', 'checkAssignments')
    .addSeparator()
    .addItem('Make zip of submissions...', 'makeZip')
    .addItem('Check marked work...', 'checkMarked')
    .addSeparator()
    .addItem('Update homework tracker', 'buildTracker')
    .addItem('Update the tracker every hour (turn on or off)', 'toggleHourlyTracker')
    .addSeparator()
    .addItem('Open the Worksheet Hub folder', 'showFolder')
    .addToUi();
}

function setupHub() {
  needOwner_('setupHub');
  var props = PropertiesService.getScriptProperties(), hid = hubSheetId_();
  var ss = hid ? SpreadsheetApp.openById(hid) : SpreadsheetApp.create('learnwithmrcedric homework');
  var asg = ss.getSheetByName(TABS.assignments.name);
  if (!hubReady_() && asg && asg.getLastRow() > 1) throw new Error('This Teacher Hub sheet already has worksheets. Move the old Hub\'s settings in first (setupMyScience).');
  props.setProperty('SS_ID', ss.getId());
  props.setProperty('HUB_READY', '1');
  HUB_SS_ = ss;
  try { setSetting_('Class list sheet ID', ss.getId()); } catch (e) { /* no Live Board Settings tab yet */ }

  Object.keys(TABS).forEach(function (k) {
    var t = TABS[k];
    var sh = ss.getSheetByName(t.name) || ss.insertSheet(t.name);
    if (sh.getLastRow() === 0) {
      sh.getRange(1, 1, 1, t.headers.length).setValues([t.headers])
        .setFontWeight('bold').setBackground('#e8eef7');
      sh.setFrozenRows(1);
    }
  });

  var first = ss.getSheetByName('Sheet1');
  if (first && first.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(first);

  var st = ss.getSheetByName(TABS.students.name);
  st.getRange('A:C').setNumberFormat('@');
  if (st.getLastRow() === 1) st.appendRow(['TEST', '99', 'Test Student']);
  st.setColumnWidth(3, 220);

  var as = ss.getSheetByName(TABS.assignments.name);
  if (!as.getRange('E2').getDataValidation()) as.getRange('E2:F200').insertCheckboxes();
  if (!as.getRange('K2').getDataValidation()) as.getRange('K2:K200').insertCheckboxes();
  if (!as.getRange('L2').getDataValidation()) as.getRange('L2:L200').insertCheckboxes();
  if (!as.getRange('N2').getDataValidation()) as.getRange('N2:N200').insertCheckboxes();
  if (!as.getRange('P2').getDataValidation()) as.getRange('P2:P200').insertCheckboxes();
  as.setColumnWidth(2, 220);
  as.setColumnWidth(4, 320);
  as.setColumnWidth(8, 260);

  ensureSubmissionCols_();
  ensureAssignmentCols_();

  var root = folder_('ROOT');
  folder_('SUB'); folder_('MARKED'); folder_('ZIPS'); folder_('DRAFTS'); folder_('WORKS'); folder_('CORR');

  SpreadsheetApp.getUi().alert(
    'Worksheet Hub is set up.\n\n' +
    'Folder in your Drive: ' + root.getUrl() + '\n\n' +
    'Next:\n' +
    '1. Paste your students into the Students tab (Class, Reg No, Name).\n' +
    '2. Run "Check student list".\n' +
    '3. Add a worksheet in the Assignments tab and run "Check assignments".\n' +
    '4. Deploy the web app (see the setup steps).');
}

function showFolder() {
  var url = folder_('ROOT').getUrl();
  showLinkDialog_('Worksheet Hub folder', '<p><a href="' + url + '" target="_blank">Open the Worksheet Hub folder</a></p>');
}

/* ------------------------------------------------------------------ */
/* Student list                                                        */
/* ------------------------------------------------------------------ */

function hubCheckStudents() {
  var list = getStudents_();
  var perClass = {}, seen = {}, dupes = [];
  list.forEach(function (s) {
    perClass[s.cls] = (perClass[s.cls] || 0) + 1;
    var k = studentKey_(s);
    if (seen[k]) dupes.push(s.cls + ' ' + s.name);
    seen[k] = true;
  });
  var sh = hubSheet_(TABS.students.name);
  var last = sh.getLastRow();
  var incomplete = 0;
  if (last >= 2) {
    sh.getRange(2, 1, last - 1, 3).getValues().forEach(function (r) {
      var c = String(r[0]).trim(), n = String(r[2]).trim();
      if ((c || n) && !(c && n)) incomplete++;
    });
  }
  var html = '<p><b>Students per class</b><br>' +
    Object.keys(perClass).sort().map(function (c) { return esc_(c) + ': ' + perClass[c]; }).join('<br>') + '</p>' +
    (dupes.length ? '<p><b>Same name twice in one class</b> (add something to tell them apart, such as an initial):<br>' +
      dupes.map(esc_).join('<br>') + '</p>' : '<p>No repeated names.</p>') +
    (incomplete ? '<p><b>' + rwN_(incomplete, 'row', 'rows') + '</b> ' + (incomplete === 1 ? 'has' : 'have') + ' a class or a name missing. Students in those rows cannot sign in.</p>' : '');
  showLinkDialog_('Student list', html);
}

/* ------------------------------------------------------------------ */
/* Assignments                                                         */
/* ------------------------------------------------------------------ */

function checkAssignments() {
  var sh = hubSheet_(TABS.assignments.name);
  var last = sh.getLastRow();
  if (last < 2) { SpreadsheetApp.getUi().alert('The Assignments tab is empty.'); return; }
  var rows = sh.getRange(2, 1, last - 1, 8).getValues();
  var maxNum = 0;
  rows.forEach(function (r) {
    var m = String(r[0]).match(/^WS(\d+)$/i);
    if (m) maxNum = Math.max(maxNum, Number(m[1]));
  });
  var ok = 0, bad = 0, props = PropertiesService.getScriptProperties();
  maxNum = Math.max(maxNum, Number(props.getProperty('WS_LAST_N')) || 0);   // numbers are never used twice (release 24)
  rows.forEach(function (r) {
    if (!String(r[1]).trim()) return;
    if (!String(r[0]).trim()) { maxNum++; r[0] = 'WS' + (maxNum < 10 ? '0' : '') + maxNum; props.setProperty('WS_LAST_N', String(maxNum)); }
    var id = fileIdFromLink_(r[3]);
    if (!id) { r[7] = 'No PDF link'; bad++; return; }
    try {
      var f = DriveApp.getFileById(id);
      if (f.getMimeType() !== 'application/pdf') { r[7] = 'This file is not a PDF'; bad++; return; }
      var mb = f.getSize() / 1048576;
      r[7] = 'OK (' + mb.toFixed(1) + ' MB)' + (mb > 15 ? ' - large file, may load slowly' : '');
      ok++;
    } catch (e) {
      r[7] = 'Cannot open this file'; bad++;
    }
  });
  sh.getRange(2, 1, rows.length, 8).setValues(rows);
  SpreadsheetApp.getUi().alert(rwN_(ok, 'assignment', 'assignments') + ' OK, ' + bad + ' with a problem. See the Check column.');
}

function fileIdFromLink_(link) {
  var s = String(link || '').trim();
  if (!s) return '';
  var m = s.match(/\/d\/([-\w]{20,})/) || s.match(/[?&]id=([-\w]{20,})/) || s.match(/^([-\w]{20,})$/);
  return m ? m[1] : '';
}

function getAssignments_() {
  var sh = hubSheet_(TABS.assignments.name);
  var last = sh.getLastRow();
  if (last < 2) return [];
  var width = Math.max(7, Math.min(18, sh.getLastColumn ? sh.getLastColumn() : 18));
  var now = new Date(), DAY = 86400000, autos = wsAuto_(), pract = practiceIds_();
  return sh.getRange(2, 1, last - 1, width).getValues().map(function (r, i) {
    var au = autos[String(r[0]).trim()] || {};
    var due = r[6], dueAt = null, allDay = false;
    if (due instanceof Date) {
      dueAt = new Date(due.getTime());
      // A date with no time means the end of that day (Singapore time).
      allDay = Utilities.formatDate(dueAt, TZ, 'HH:mm') === '00:00';
      if (allDay) dueAt = new Date(dueAt.getTime() + 86399000);
      due = Utilities.formatDate(dueAt, TZ, allDay ? 'EEE d MMM' : 'EEE d MMM, h:mm a');
    }
    // The schedule set for this worksheet. It works out open, corrections and answers from the time,
    // so nothing depends on a timer having run.
    // Handing in drafts at the due time also closes the worksheet then.
    var autoClose = r[13] === true || !!(au.handIn && dueAt);
    var corrDays = Number(r[14]) > 0 ? Number(r[14]) : 0;
    var answersAfter = r[15] === true;
    var releasedAt = r[16] instanceof Date ? r[16] : null;
    var answerLink = String(r[9] || '');
    var corrClosed = r[11] === true || !!(corrDays && releasedAt && r[5] === true && now.getTime() > releasedAt.getTime() + corrDays * DAY);
    return {
      reportLink: String(r[8] || ''),
      answerLink: answerLink,
      showAnswers: r[10] === true || !!(answersAfter && answerLink && r[5] === true && corrClosed),
      correctionsClosed: corrClosed,
      solutionLink: String(r[12] || ''),
      autoClose: autoClose, corrDays: corrDays, answersAfter: answersAfter, releasedAt: releasedAt,
      closesAt: autoClose && dueAt ? dueAt : null,
      autoHandIn: !!au.handIn, autoMark: !!au.mark,
      dueAt: dueAt, allDay: allDay,
      row: i + 2,
      id: String(r[0]).trim(),
      title: String(r[1]).trim(),
      chapter: String(r[17] == null ? '' : r[17]).trim(),
      practice: !!pract[String(r[0]).trim()],
      classes: String(r[2]).split(',').map(function (c) { return hubNormClass_(c); }).filter(String),
      fileId: fileIdFromLink_(r[3]),
      open: r[4] === true && !(autoClose && dueAt && now > dueAt),
      showMarked: r[5] === true,
      due: String(due || '')
    };
  }).filter(function (a) { return a.id && a.title; });
}

function findAssignment_(id) {
  var list = getAssignments_();
  for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
  return null;
}

function canSee_(a, s) {
  return s.cls === 'TEST' || a.classes.length === 0 || a.classes.indexOf(s.cls) >= 0;
}

/* ------------------------------------------------------------------ */
/* Web app                                                             */
/* ------------------------------------------------------------------ */

// Pulls one file into a page, so the Teacher Hub and the student page share Styles.html. From the same place as the
// page itself: the lesson site, or the copy pasted here.
function include_(name) { return pageHtml_(name); }

function hubDoGet_(e) {
  if (e && e.parameter && e.parameter.teacher !== undefined) {
    pagesLoad_(['HubTeacher', 'Styles', 'Ink']);
    return HtmlService.createHtmlOutput(pageAssembled_('HubTeacher'))
      .setTitle('Teacher Hub')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }
  pagesLoad_(['Homework', 'Styles', 'Ink']);
  return HtmlService.createHtmlOutput(pageAssembled_('Homework'))
    .setTitle('Worksheets')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function api_roster() {
  var names = {};
  getStudents_().forEach(function (s) { (names[s.cls] = names[s.cls] || []).push(s.name); });
  return { classes: Object.keys(names).sort(), names: names, title: APP_TITLE, school: APP_SCHOOL, myScience: liveBoardUrl_() };
}

function issueStudent_(s, secs) {
  var token = Utilities.getUuid();
  CacheService.getScriptCache().put('stok_' + token, JSON.stringify({ cls: s.cls, name: s.name }), secs || 21600);
  return { token: token, name: s.name, cls: s.cls, reg: s.reg };
}
/* Students sign in once, in learnwithmrcedric (Live Board), with their own PIN. Their homework opens there, on the
   Homework tab, and this page is signed in with learnwithmrcedric's sign-in, which Live Board checks. There is no
   choosing a name here any more. */
function api_login(cls, name) {
  throw new Error('Open learnwithmrcedric and sign in with your PIN. Your homework is on its Homework tab.');
}
function api_ticketLogin(st) {
  st = String(st || '');
  if (!/^st1\.[A-Za-z0-9_.-]+$/.test(st) || st.length > 900) throw new Error('SIGNED_OUT');
  var cache = CacheService.getScriptCache();
  var key = 'stk_' + Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, st)).slice(0, 40);
  var hit = cache.get(key), who = hit ? parseJson_(hit) : null;
  if (!who) {
    var r = lbAsk_('student', { st: st });
    if (r.signedOut || !r.name) throw new Error('SIGNED_OUT');
    who = { cls: r.cls, name: r.name };
    try { cache.put(key, JSON.stringify(who), 60); } catch (e) { /* asked again next time */ }
  }
  var s = hubFindStudent_(hubNormClass_(who.cls), who.name);
  if (!s) throw new Error('SIGNED_OUT');
  // Short: when it runs out the page renews it with learnwithmrcedric's sign-in, so a student the teacher signs out is out soon.
  return issueStudent_(s, 1800);
}

// Every worksheet this student has ever been given, newest first.
// Status: new, started, submitted (waiting for marking), marked, missed (closed, not handed in).
function api_list(token) {
  var s = who_(token);
  CH_MEMO_ = {};
  var subs = submissionIndex_();
  var out = [];
  var rules = rwRules_(), icons = wsIcons_();
  getAssignments_().forEach(function (a) {
    if (!a.fileId || !canSee_(a, s)) return;
    var sub = subs[a.id + '|' + studentKey_(s)];
    var released = !!(sub && a.showMarked && (sub.marked || sub.score || sub.comment));
    var status, draftTs = null;
    if (released) status = 'marked';
    else if (sub) status = 'submitted';
    else if (!a.open) status = 'missed';
    else {
      var df = findDraft_(a, s);
      status = df ? 'started' : 'new';
      if (df) { try { draftTs = df.getLastUpdated().getTime(); } catch (e) { draftTs = null; } }
    }
    out.push({
      id: a.id, title: a.title, due: a.due, open: a.open, status: status,
      dueTs: a.dueAt ? a.dueAt.getTime() : null, dueAllDay: a.allDay,
      submittedAt: sub ? sub.at : '',
      score: released ? sub.score : '',
      comment: released ? sub.comment : '',
      hasMarkedFile: released && !!sub.marked,
      hasAnswers: answersVisible_(a, sub),
      corr: corrState_(a, sub),
      corrAt: sub ? sub.corrAt : '',
      corrOpen: !a.correctionsClosed,
      corrStarted: corrState_(a, sub) === 'todo' ? !!findDraft_(a, s, 'corr') : false,
      pts: released ? rwSubEvents_(a, sub, rules).reduce(function (t, e) { return t + e.points; }, 0) : null,
      icon: icons[a.id] || '',
      late: !!(sub && a.dueAt && sub.first instanceof Date && sub.first > a.dueAt),
      handedTs: sub && sub.first instanceof Date ? sub.first.getTime() : null,
      auto: !!(sub && sub.auto), autoHandIn: !!(a.autoHandIn && a.dueAt), practice: !!a.practice,
      chapter: (function () { var ci = chapterInfo_(chapterOfWs_(a)); return ci ? { key: ci.key, name: chapterShort_(ci), subject: ci.subjectName, color: ci.color } : null; })(),
      v: a.fileId, draftTs: draftTs
    });
  });
  return out.reverse();
}

// haveVer: the version of the worksheet PDF the iPad already keeps. When it is still current the PDF is
// not sent again, so the worksheet opens at once from the iPad.
function api_open(token, id, haveVer) {
  var s = who_(token);
  var a = findAssignment_(id);
  if (!a || !canSee_(a, s)) throw new Error('This worksheet was not found.');
  if (!a.open) throw new Error('This worksheet is closed.');
  var file = DriveApp.getFileById(a.fileId), ver = pdfVer_(file);
  var draftFile = findDraft_(a, s);
  var sub = submissionIndex_()[a.id + '|' + studentKey_(s)];
  return {
    id: a.id, title: a.title, due: a.due, ver: ver,
    pdf: haveVer && haveVer === ver ? null : Utilities.base64Encode(file.getBlob().getBytes()),
    draft: draftFile ? draftFile.getBlob().getDataAsString() : null,
    submittedAt: sub ? sub.at : '',
    dueTs: a.dueAt ? a.dueAt.getTime() : null, autoHandIn: !!(a.autoHandIn && a.dueAt),
    extras: studentExtras_(a, s)
  };
}

// The worksheet file and when it last changed, so an iPad can tell whether its saved copy is still current.
function pdfVer_(file) {
  var t = 0;
  try { t = file.getLastUpdated().getTime(); } catch (e) { t = 0; }
  return file.getId() + '@' + t;
}

// One worksheet PDF on its own, so the iPad can keep a copy of each open worksheet before it is needed.
function api_pdf(token, id) {
  var s = who_(token);
  var a = findAssignment_(id);
  if (!a || !canSee_(a, s) || !a.open) throw new Error('This worksheet was not found.');
  var file = DriveApp.getFileById(a.fileId);
  return { id: a.id, ver: pdfVer_(file), pdf: Utilities.base64Encode(file.getBlob().getBytes()) };
}

function api_saveDraft(token, id, json) {
  var s = who_(token);
  var a = findAssignment_(id);
  if (!a || !canSee_(a, s)) throw new Error('This worksheet was not found.');
  if (!a.open) throw new Error('This worksheet is closed.');
  saveDraft_(a, s, json);
  return Utilities.formatDate(new Date(), TZ, 'h:mm a');
}

function api_submit(token, id, pdfBase64, json, stats) {
  var s = who_(token);
  var a = findAssignment_(id);
  if (!a || !canSee_(a, s)) throw new Error('This worksheet was not found.');
  if (!a.open) throw new Error('This worksheet is closed. Tell your teacher.');
  stats = stats || {};

  saveDraft_(a, s, json);

  var name = submissionName_(a, s);
  var folder = childFolder_(folder_('SUB'), folderName_(a));
  var old = folder.getFilesByName(name);
  while (old.hasNext()) old.next().setTrashed(true);
  var blob = Utilities.newBlob(Utilities.base64Decode(pdfBase64), 'application/pdf', name);
  var file = folder.createFile(blob);

  var at = Utilities.formatDate(new Date(), TZ, 'd MMM yyyy, h:mm a');
  var lock = hubLock_();
  lock.waitLock(30000);
  try {
    var sh = hubSheet_(TABS.submissions.name);
    ensureSubmissionCols_();
    // A new hand-in replaces any earlier marking, so the marked file, score and comment are cleared.
    var row = [at, a.id, a.title, s.cls, s.reg, s.name, stats.pagesWritten || 0, stats.strokes || 0, file.getUrl(), '', '', ''];
    var existing = submissionIndex_()[a.id + '|' + studentKey_(s)];
    // Handing in again updates the row but keeps the first hand-in time, which decides on time or late.
    if (existing) {
      sh.getRange(existing.row, 1, 1, row.length).setValues([row]);
      if (existing.corrAt || existing.corrFile) sh.getRange(existing.row, 14, 1, 2).setValues([['', '']]);
      if (existing.checked) sh.getRange(existing.row, 16).setValue('');
      if (existing.blank) sh.getRange(existing.row, 17).setValue('');
      if (existing.auto) sh.getRange(existing.row, 18).setValue('');
      // The marks were placed on the old hand-in, so they are dropped with it.
      var oldReview = draftFile_(reviewName_(a, s));
      if (oldReview) oldReview.setTrashed(true);
    }
    else sh.appendRow(row.concat([new Date()]));
  } finally {
    lock.releaseLock();
  }
  return at;
}

function api_marked(token, id) {
  var s = who_(token);
  var a = findAssignment_(id);
  if (!a || !canSee_(a, s) || !a.showMarked) throw new Error('Marked work is not ready yet.');
  var sub = submissionIndex_()[a.id + '|' + studentKey_(s)];
  if (!sub) throw new Error('Marked work is not ready yet.');
  var f = null;
  var id = fileIdFromLink_(sub.marked);
  if (id) { try { f = DriveApp.getFileById(id); if (f.isTrashed()) f = null; } catch (e) { f = null; } }
  if (!f) f = findMarkedFile_(a, s);
  if (!f) throw new Error('Marked work is not ready yet.');
  return { title: a.title, pdf: Utilities.base64Encode(f.getBlob().getBytes()) };
}

// The answer key, read-only, once the teacher has released it.
function api_answers(token, id) {
  var s = who_(token);
  var a = findAssignment_(id);
  if (!a || !canSee_(a, s)) throw new Error('This worksheet was not found.');
  var sub = submissionIndex_()[a.id + '|' + studentKey_(s)];
  if (!answersVisible_(a, sub)) throw new Error('The answers are not out yet.');
  var fid = fileIdFromLink_(a.answerLink), f = null;
  try { f = DriveApp.getFileById(fid); if (f.isTrashed()) f = null; } catch (e) { f = null; }
  if (!f) throw new Error('The answers are not out yet.');
  return { title: a.title, pdf: Utilities.base64Encode(f.getBlob().getBytes()) };
}

/* ------------------------------------------------------------------ */
/* Teacher tools: zip and marked work                                  */
/* ------------------------------------------------------------------ */

// Zips every handed-in PDF for one worksheet. Returns null when nothing has been handed in.
// The marking pack: every hand-in (or only those not marked yet), plus the blank worksheet, the teacher's
// marked solution and _info.json, so Claude needs nothing else. Extra files start with _ so they are
// never mistaken for a student's work.
function zipFor_(a, onlyNew) {
  var markedIds = {};
  if (onlyNew) {
    listSubmissions_(a).forEach(function (x) { if (x.marked) markedIds[x.fileId] = true; });
  }
  var folder = childFolder_(folder_('SUB'), folderName_(a));
  var blobs = [];
  var it = folder.getFiles();
  while (it.hasNext()) {
    var f = it.next();
    if (!f.isTrashed() && f.getMimeType() === 'application/pdf' && !markedIds[f.getId()]) blobs.push(f.getBlob());
  }
  childFolder_(folder_('MARKED'), folderName_(a));
  if (!blobs.length) return null;
  var count = blobs.length;
  var extra = packExtras_(a);
  var zipName = folderName_(a) + ' - ' + count + (onlyNew ? ' new' : '') + ' submissions.zip';
  return { file: folder_('ZIPS').createFile(Utilities.zip(blobs.concat(extra), zipName)), count: count, name: zipName };
}

function packExtras_(a) {
  var out = [];
  var w = driveFile_(a.fileId);
  if (w) out.push(w.getBlob().setName('_worksheet.pdf'));
  var sol = driveFile_(fileIdFromLink_(a.solutionLink));
  if (sol) out.push(sol.getBlob().setName('_marked solution.pdf'));
  out.push(Utilities.newBlob(JSON.stringify(packInfo_(a), null, 1), 'application/json', '_info.json'));
  return out;
}

function packInfo_(a) {
  return { id: a.id, title: a.title, classes: a.classes, due: a.due, hasSolution: !!a.solutionLink,
    students: studentsFor_(a).map(function (s) { return { cls: s.cls, reg: s.reg, name: s.name }; }) };
}

function driveFile_(id) {
  if (!id) return null;
  try { var f = DriveApp.getFileById(id); return f.isTrashed() ? null : f; } catch (e) { return null; }
}

// Every hand-in for one worksheet, from the Submissions tab.
function listSubmissions_(a) {
  var sh = hubSheet_(TABS.submissions.name), last = sh.getLastRow(), out = [];
  if (last < 2) return out;
  var width = Math.max(10, Math.min(17, sh.getLastColumn ? sh.getLastColumn() : 17));
  sh.getRange(2, 1, last - 1, width).getValues().forEach(function (r, i) {
    if (String(r[1]) !== a.id) return;
    var fid = fileIdFromLink_(r[8]);
    if (!fid) return;
    out.push({ row: i + 2, fileId: fid, cls: hubNormClass_(r[3]), reg: String(r[4] || ''), name: String(r[5]), handedAt: String(r[0]),
      pages: Number(r[6]) || 0, strokes: Number(r[7]) || 0, marked: !!String(r[9] || ''), score: scoreText_(r[10]),
      checked: !!String(r[15] || ''), blank: isYes_(r[16]) });
  });
  return out;
}

function makeZip() {
  var a = askAssignment_('Make zip of submissions');
  if (!a) return;
  var z = zipFor_(a);
  if (!z) { SpreadsheetApp.getUi().alert('No one has handed in ' + a.id + ' yet.'); return; }
  var zip = z.file, blobs = { length: z.count };

  var subs = submissionIndex_();
  var missing = getStudents_().filter(function (s) {
    return s.cls !== 'TEST' && canSee_(a, s) && !subs[a.id + '|' + studentKey_(s)];
  }).map(function (s) { return label_(s); });

  var html = '<p><b>' + blobs.length + '</b> ' + (blobs.length === 1 ? 'worksheet' : 'worksheets') + ' in the zip.</p>' +
    '<p><a href="' + zip.getUrl() + '" target="_blank">Open the zip in Drive</a> and download it.</p>' +
    '<p>' + (missing.length ? '<b>Not handed in (' + missing.length + '):</b><br>' + missing.map(esc_).join('<br>') : 'Everyone has handed in.') + '</p>';
  showLinkDialog_(a.id + ' zip', html);
}

function checkMarked() {
  var a = askAssignment_('Check marked work');
  if (!a) return;
  ensureSubmissionCols_();
  var folder = childFolder_(folder_('MARKED'), folderName_(a));
  var files = {};
  var it = folder.getFiles();
  while (it.hasNext()) { var f = it.next(); if (!f.isTrashed()) files[f.getName()] = f; }

  var sh = hubSheet_(TABS.submissions.name);
  var subs = submissionIndex_();
  var matched = 0, waiting = [];
  getStudents_().forEach(function (s) {
    var sub = subs[a.id + '|' + studentKey_(s)];
    if (!sub) return;
    var f = files[submissionName_(a, s)] || matchByPrefix_(files, a, s);
    if (f) { sh.getRange(sub.row, 10).setValue(f.getUrl()); matched++; }
    else { sh.getRange(sub.row, 10).setValue(''); waiting.push(label_(s)); }
  });

  var html = '<p><b>' + matched + '</b> marked ' + (matched === 1 ? 'file' : 'files') + ' matched to students.</p>' +
    (waiting.length ? '<p><b>No marked file yet for:</b><br>' + waiting.map(esc_).join('<br>') + '</p>' : '') +
    '<p>Marked files go in: <a href="' + folder.getUrl() + '" target="_blank">' + esc_(folder.getName()) + '</a><br>' +
    'Keep the file names exactly as they were in the zip.</p>' +
    '<p>You can also type a <b>Score</b> (for example 7/10) and a short <b>Comment</b> for each student in the Submissions tab. Both are optional.</p>' +
    '<p>When you are ready, tick <b>Show marked work</b> for ' + esc_(a.id) + ' in the Assignments tab. Students will see it straight away.</p>';
  showLinkDialog_(a.id + ' marked work', html);
}

function askAssignment_(title) {
  var ui = SpreadsheetApp.getUi();
  var res = ui.prompt(title, 'Type the assignment ID (for example WS01):', ui.ButtonSet.OK_CANCEL);
  if (res.getSelectedButton() !== ui.Button.OK) return null;
  var a = findAssignment_(res.getResponseText().trim().toUpperCase());
  if (!a) { ui.alert('No assignment with that ID. Run "Check assignments" to give each one an ID.'); return null; }
  return a;
}

/* ------------------------------------------------------------------ */
/* Students, submissions, drafts                                       */
/* ------------------------------------------------------------------ */

function getStudents_() {
  var sh = hubSheet_(TABS.students.name);
  var last = sh.getLastRow();
  if (last < 2) return [];
  var list = sh.getRange(2, 1, last - 1, 3).getValues().map(function (r, i) {
    return { cls: hubNormClass_(r[0]), reg: normReg_(r[1]), name: String(r[2]).replace(/\s+/g, ' ').trim(), row: i };
  }).filter(function (s) { return s.cls && s.name; });
  list.sort(function (a, b) {
    var ra = a.reg ? Number(a.reg) : 1e9, rb = b.reg ? Number(b.reg) : 1e9;
    return ra - rb || a.row - b.row;
  });
  return list;
}

function hubFindStudent_(cls, name) {
  var n = hubNormName_(name);
  var list = getStudents_();
  for (var i = 0; i < list.length; i++) if (list[i].cls === cls && hubNormName_(list[i].name) === n) return list[i];
  return null;
}

function studentKey_(s) { return s.cls + '|' + hubNormName_(s.name); }

function label_(s) { return s.cls + ' ' + (s.reg ? s.reg + ' ' : '') + s.name; }

function who_(token) {
  var v = CacheService.getScriptCache().get('stok_' + token);
  if (!v) throw new Error('SESSION_EXPIRED');
  var k = JSON.parse(v);
  var s = hubFindStudent_(k.cls, k.name);
  if (!s) throw new Error('SESSION_EXPIRED');
  return s;
}

function submissionIndex_() {
  var sh = hubSheet_(TABS.submissions.name);
  var last = sh.getLastRow();
  var idx = {};
  if (last < 2) return idx;
  var width = Math.max(10, Math.min(18, sh.getLastColumn ? sh.getLastColumn() : 18));
  sh.getRange(2, 1, last - 1, width).getValues().forEach(function (r, i) {
    var auto = String(r[17] || '') === 'Auto';
    idx[String(r[1]) + '|' + hubNormClass_(r[3]) + '|' + hubNormName_(r[5])] = {
      auto: auto, pending: auto && !String(r[8] || ''),
      row: i + 2, at: String(r[0]), marked: String(r[9] || ''),
      score: scoreText_(r[10]), comment: String(r[11] == null ? '' : r[11]).trim(),
      first: firstTime_(r[12], r[0]),
      corrAt: r[13] instanceof Date ? Utilities.formatDate(r[13], TZ, 'd MMM yyyy, h:mm a') : String(r[13] || ''),
      corrFile: String(r[14] || ''),
      file: String(r[8] || ''),
      checked: r[15] instanceof Date ? Utilities.formatDate(r[15], TZ, 'd MMM, h:mm a') : String(r[15] || ''),
      blank: isYes_(r[16])
    };
  });
  return idx;
}

// Adds the Class report, Answer key and Show answers columns to an Assignments tab made by an earlier version.
function ensureAssignmentCols_() {
  var sh = hubSheet_(TABS.assignments.name);
  var h = TABS.assignments.headers;
  var cur = sh.getRange(1, 1, 1, h.length).getValues()[0];
  for (var c = 8; c < h.length; c++) {
    if (String(cur[c]).trim() !== h[c]) sh.getRange(1, c + 1).setValue(h[c]).setFontWeight('bold').setBackground('#e8eef7');
  }
  if (!sh.getRange('K2').getDataValidation()) sh.getRange('K2:K200').insertCheckboxes();
  if (!sh.getRange('L2').getDataValidation()) sh.getRange('L2:L200').insertCheckboxes();
  if (!sh.getRange('N2').getDataValidation()) sh.getRange('N2:N200').insertCheckboxes();
  if (!sh.getRange('P2').getDataValidation()) sh.getRange('P2:P200').insertCheckboxes();
  sh.getRange('Q:Q').setNumberFormat('d mmm yyyy, h:mm am/pm');
}

// A student sees the answer key once the teacher releases it and the student has handed in,
// or once the worksheet is closed. So a student who has not handed in cannot copy from it.
function answersVisible_(a, sub) {
  return !!(a.showAnswers && a.answerLink && (sub || !a.open));
}

// Adds the Score and Comment columns to a Submissions tab made by an earlier version.
function ensureSubmissionCols_() {
  var sh = hubSheet_(TABS.submissions.name);
  var h = TABS.submissions.headers;
  var cur = sh.getRange(1, 1, 1, h.length).getValues()[0];
  for (var c = 10; c < h.length; c++) {
    if (String(cur[c]).trim() !== h[c]) sh.getRange(1, c + 1).setValue(h[c]).setFontWeight('bold').setBackground('#e8eef7');
  }
  // Plain text, so that a score such as 7/10 is not turned into a date.
  sh.getRange('K:K').setNumberFormat('@');
  sh.getRange('M:M').setNumberFormat('d mmm yyyy, h:mm am/pm');
  sh.getRange('N:N').setNumberFormat('d mmm yyyy, h:mm am/pm');
  sh.getRange('P:P').setNumberFormat('d mmm yyyy, h:mm am/pm');
}

// When the student first handed in. Older rows have no First handed in value, so the Handed in text is read instead.
function firstTime_(v, fallback) {
  if (v instanceof Date) return v;
  if (fallback instanceof Date) return fallback;
  try { return Utilities.parseDate(String(fallback), TZ, 'd MMM yyyy, h:mm a'); } catch (e) { return null; }
}

function scoreText_(v) {
  if (v === null || v === undefined || v === '') return '';
  if (v instanceof Date) return v.getDate() + '/' + (v.getMonth() + 1);   // 7/10 typed before the column was plain text
  return String(v).trim();
}

function submissionName_(a, s) {
  return hubClean_(fileStem_(s) + '_' + a.id) + '.pdf';
}

function fileStem_(s) {
  return s.cls + '_' + (s.reg ? pad2_(s.reg) + '_' : '') + s.name;
}

function findMarkedFile_(a, s) {
  var folder = childFolder_(folder_('MARKED'), folderName_(a));
  var it = folder.getFilesByName(submissionName_(a, s));
  while (it.hasNext()) { var f = it.next(); if (!f.isTrashed()) return f; }
  var files = {};
  var all = folder.getFiles();
  while (all.hasNext()) { var g = all.next(); if (!g.isTrashed()) files[g.getName()] = g; }
  return matchByPrefix_(files, a, s);
}

function matchByPrefix_(files, a, s) {
  var prefix = hubClean_(fileStem_(s) + '_').toLowerCase();
  var names = Object.keys(files);
  for (var i = 0; i < names.length; i++) {
    if (names[i].toLowerCase().indexOf(prefix) === 0 && /\.pdf$/i.test(names[i])) return files[names[i]];
  }
  return null;
}

// kind 'corr' is the draft of the student's corrections, kept apart from the worksheet draft.
function draftName_(a, s, kind) { return hubClean_(a.id + '_' + s.cls + '_' + hubNormName_(s.name) + (kind === 'corr' ? '_corrections' : '')) + '.json'; }

function findDraft_(a, s, kind) {
  var it = folder_('DRAFTS').getFilesByName(draftName_(a, s, kind));
  while (it.hasNext()) { var f = it.next(); if (!f.isTrashed()) return f; }
  return null;
}

function saveDraft_(a, s, json, kind) {
  if (typeof json !== 'string' || !json) return;
  var f = findDraft_(a, s, kind);
  if (f) f.setContent(json);
  else folder_('DRAFTS').createFile(draftName_(a, s, kind), json, 'application/json');
}

/* ---------- Corrections ---------- */

// "7/10" -> true when the student already has every mark, so there is nothing to correct.
function fullMarks_(score) {
  var m = String(score || '').match(/^\s*(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)\s*$/);
  return !!(m && Number(m[2]) > 0 && Number(m[1]) >= Number(m[2]));
}

// Where a student stands with corrections for one worksheet.
// '' (marking not released or no marked copy), 'notNeeded', 'done', 'todo' (open) or 'missed' (closed, never done).
function corrState_(a, sub) {
  if (!sub || !a.showMarked || !(sub.marked || sub.score || sub.comment)) return '';
  if (!sub.marked) return '';
  if (sub.corrAt) return 'done';
  if (fullMarks_(sub.score)) return 'notNeeded';
  return a.correctionsClosed ? 'missed' : 'todo';
}

function corrName_(a, s) { return hubClean_(fileStem_(s) + '_' + a.id + '_corrections') + '.pdf'; }

function corrContext_(token, id) {
  var s = who_(token);
  var a = findAssignment_(id);
  if (!a || !canSee_(a, s)) throw new Error('This worksheet was not found.');
  var sub = submissionIndex_()[a.id + '|' + studentKey_(s)];
  if (!sub || !a.showMarked || !sub.marked) throw new Error('Your marked work is not back yet.');
  if (a.correctionsClosed) throw new Error('Corrections for this worksheet are closed.');
  return { s: s, a: a, sub: sub };
}

// Opens the student's marked copy to write corrections on, with any corrections draft.
function api_openCorrection(token, id) {
  var c = corrContext_(token, id);
  var f = null, fid = fileIdFromLink_(c.sub.marked);
  if (fid) { try { f = DriveApp.getFileById(fid); if (f.isTrashed()) f = null; } catch (e) { f = null; } }
  if (!f) f = findMarkedFile_(c.a, c.s);
  if (!f) throw new Error('Your marked work is not back yet.');
  var d = findDraft_(c.a, c.s, 'corr');
  return {
    id: c.a.id, title: c.a.title, pdf: Utilities.base64Encode(f.getBlob().getBytes()),
    draft: d ? d.getBlob().getDataAsString() : null, submittedAt: c.sub.corrAt || '',
    extras: studentExtras_(c.a, c.s)
  };
}

function api_saveCorrectionDraft(token, id, json) {
  var c = corrContext_(token, id);
  saveDraft_(c.a, c.s, json, 'corr');
  return Utilities.formatDate(new Date(), TZ, 'h:mm a');
}

// The corrected copy: the marked PDF with the student's green corrections on it.
function api_submitCorrection(token, id, pdfBase64, json) {
  var c = corrContext_(token, id);
  saveDraft_(c.a, c.s, json, 'corr');
  var name = corrName_(c.a, c.s);
  var folder = childFolder_(folder_('CORR'), folderName_(c.a));
  var old = folder.getFilesByName(name);
  while (old.hasNext()) old.next().setTrashed(true);
  var file = folder.createFile(Utilities.newBlob(Utilities.base64Decode(pdfBase64), 'application/pdf', name));
  var lock = hubLock_();
  lock.waitLock(30000);
  try {
    ensureSubmissionCols_();
    var now = new Date();
    hubSheet_(TABS.submissions.name).getRange(c.sub.row, 14, 1, 2).setValues([[now, file.getUrl()]]);
    return Utilities.formatDate(now, TZ, 'd MMM yyyy, h:mm a');
  } finally {
    lock.releaseLock();
  }
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

var HUB_SS_ = null;   // opened once per run
function hubSheet_(name) {
  needHub_();
  if (!HUB_SS_) {
    var id = hubSheetId_();
    if (!id) throw new Error('The Teacher Hub sheet is not linked. In the Live Board sheet, Settings tab, put its ID in Class list sheet ID.');
    HUB_SS_ = SpreadsheetApp.openById(id);
  }
  var ss = HUB_SS_;
  var sh = ss.getSheetByName(name);
  if (!sh) throw new Error('The "' + name + '" tab is missing. Run Worksheet Hub > Set up.');
  return sh;
}

function folder_(key) {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty('F_' + key);
  if (id) {
    try {
      var f = DriveApp.getFolderById(id);
      if (!f.isTrashed()) return f;
    } catch (e) { /* recreate below */ }
  }
  needHub_();   // never a new Drive folder before the Hub's settings (with its folders) have been moved here
  var folder = key === 'ROOT'
    ? DriveApp.getRootFolder().createFolder(FOLDERS.ROOT)
    : childFolder_(folder_('ROOT'), FOLDERS[key]);
  props.setProperty('F_' + key, folder.getId());
  return folder;
}

function childFolder_(parent, name) {
  var it = parent.getFoldersByName(name);
  while (it.hasNext()) { var f = it.next(); if (!f.isTrashed()) return f; }
  return parent.createFolder(name);
}

function folderName_(a) { return hubClean_(a.id + ' ' + a.title); }

function hubNormClass_(c) { return String(c || '').trim().toUpperCase().replace(/\s+/g, ''); }

function normReg_(r) {
  var n = parseInt(String(r || '').trim(), 10);
  return isNaN(n) ? '' : String(n);
}

function hubNormName_(n) { return String(n || '').replace(/\s+/g, ' ').trim().toLowerCase(); }

function pad2_(r) { return r.length < 2 ? '0' + r : r; }

function hubClean_(s) {
  return String(s).replace(/[\\\/:*?"<>|#%]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function esc_(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function showLinkDialog_(title, html) {
  var out = HtmlService.createHtmlOutput(
    '<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.5">' + html + '</div>')
    .setWidth(460).setHeight(360);
  SpreadsheetApp.getUi().showModalDialog(out, title);
}

/* ------------------------------------------------------------------ */
/* Homework tracker: one tab per class                                 */
/* ------------------------------------------------------------------ */

var TRACK = {
  onTime:  { bg: '#D9F0E1', fg: '#17693A' },
  late:    { bg: '#FFE9B3', fg: '#7A4B00' },
  missing: { bg: '#F9D5D2', fg: '#A11A12' },
  notDue:  { bg: '#F1F3F6', fg: '#8A93A3' },
  head:    { bg: '#1F3A93', fg: '#FFFFFF' },
  due:     { bg: '#E7ECF8', fg: '#1F3A93' },
  flagRed: { bg: '#F9D5D2', fg: '#A11A12' },
  flagAmb: { bg: '#FFE9B3', fg: '#7A4B00' },
  plain:   { bg: '#FFFFFF', fg: '#1B2433' }
};

// What a student has done for one worksheet.
// kind: onTime, late, missing (due or closed, not handed in), notDue (still open, not handed in)
function trackCell_(a, sub, now) {
  var isDue = !a.open || (a.dueAt && now > a.dueAt);
  if (sub) {
    var first = sub.first;
    var late = !!(a.dueAt && first && first > a.dueAt);
    var text = late ? 'Late ' + lateBy_(first - a.dueAt) : '✓';
    if (sub.score) text += ' ' + sub.score;
    return { kind: late ? 'late' : 'onTime', text: text, counted: isDue,
      note: 'Handed in ' + (first ? Utilities.formatDate(first, TZ, 'd MMM, h:mm a') : sub.at) };
  }
  if (isDue) return { kind: 'missing', text: '✗', counted: true, note: '' };
  return { kind: 'notDue', text: '', counted: false, note: '' };
}

function lateBy_(ms) {
  var h = ms / 3600000;
  if (h < 24) return Math.max(1, Math.round(h)) + 'h';
  return Math.round(h / 24) + 'd';
}

// A parent is messaged only after this many problem worksheets since the last message to them.
// A problem is a worksheet that is missing, late, or under 50% once the marking is given back.
var PARENT_AFTER = 3;

function problemOf_(a, sub, c) {
  if (!c.counted) return '';
  if (c.kind === 'missing') return 'missing';
  if (c.kind === 'late') return 'late';
  if (sub && a.showMarked) { var p = rwPct_(sub.score); if (p !== null && p < 50) return 'low'; }
  return '';
}
var PROBLEM_WORDS = { missing: 'not handed in', late: 'handed in late', low: 'under 50%' };

// Who needs a follow-up: anyone with a problem worksheet since their parent was last messaged.
// Three or more of them, and it is time to message the parent.
function followUp_(t, probs) {
  probs = probs || [];
  var n = probs.length;
  if (n >= PARENT_AFTER) return { text: 'Message parent (' + n + ')', level: 'red', parent: true };
  if (!n) return { text: '', level: '' };
  var c = { missing: 0, late: 0, low: 0 }, parts = [];
  probs.forEach(function (p) { c[p.why]++; });
  if (c.missing) parts.push('Missing ' + c.missing);
  if (c.late) parts.push('Late ' + c.late);
  if (c.low) parts.push('Under 50% ' + c.low);
  return { text: parts.join(', '), level: 'amb' };
}

// The parents the teacher has messaged: { 'cls|name': [minutes since 1970, the time before that] }.
function parentMsgs_() { return parseJson_(PropertiesService.getScriptProperties().getProperty('PARENT_MSG')) || {}; }
function parentSince_(parents, st) { var v = parents[st.cls + '|' + hubNormName_(st.name)]; return v ? v[0] * 60000 : 0; }

// The numbers behind one class's tracker. Used by the Sheet tracker and the Teacher Hub.
function trackerModel_(students, list, subs, now, parents) {
  parents = parents || {};
  var colDone = list.map(function () { return 0; }), colOnTime = list.map(function () { return 0; });
  var flagged = [], classDue = 0, classOnTime = 0, rows = [];
  students.forEach(function (st) {
    var t = { onTime: 0, late: 0, missing: 0, due: 0 }, cells = [], probs = [], since = parentSince_(parents, st);
    list.forEach(function (a, j) {
      var sub = subs[a.id + '|' + studentKey_(st)];
      var c = trackCell_(a, sub, now);
      cells.push(c);
      if (c.kind === 'onTime' || c.kind === 'late') { colDone[j]++; if (c.kind === 'onTime') colOnTime[j]++; }
      if (c.counted) {
        t.due++;
        if (c.kind === 'onTime') t.onTime++; else if (c.kind === 'late') t.late++; else t.missing++;
      }
      var why = problemOf_(a, sub, c);
      // A worksheet with no due date that closed with nothing handed in has no time, so it counts only
      // until the parent is first messaged.
      var when = a.dueAt ? a.dueAt.getTime() : sub && sub.first ? sub.first.getTime() : 0;
      if (why && (!since || when > since)) probs.push({ id: a.id, title: a.title, why: why, score: why === 'low' ? sub.score : '', text: a.title + ': ' + PROBLEM_WORDS[why] + (why === 'low' ? ' (' + sub.score + ')' : '') });
    });
    var f = followUp_(t, probs);
    if (f.level) flagged.push({ name: st.name, cls: st.cls, text: f.text, level: f.level, parent: !!f.parent, problems: probs,
      parentSent: since ? Utilities.formatDate(new Date(since), TZ, 'd MMM') : '' });
    classDue += t.due; classOnTime += t.onTime;
    rows.push({ st: st, cells: cells, t: t, rate: t.due ? t.onTime / t.due : '', follow: f });
  });
  return { rows: rows, colDone: colDone, colOnTime: colOnTime, flagged: flagged, classDue: classDue, classOnTime: classOnTime };
}

function studentsByClass_() {
  var byClass = {};
  getStudents_().forEach(function (st) {
    if (st.cls === 'TEST') return;
    (byClass[st.cls] = byClass[st.cls] || []).push(st);
  });
  return byClass;
}

function assignsForClass_(assigns, cls) {
  return assigns.filter(function (a) { return a.classes.length === 0 || a.classes.indexOf(cls) >= 0; });
}

function buildTracker() {
  ensureSubmissionCols_();
  var now = new Date();
  var assigns = getAssignments_().filter(function (a) { return a.fileId && !a.practice; });
  var subs = submissionIndex_();
  var byClass = {};
  getStudents_().forEach(function (st) {
    if (st.cls === 'TEST') return;
    (byClass[st.cls] = byClass[st.cls] || []).push(st);
  });
  var classes = Object.keys(byClass).sort();
  var ss = hubSheet_(TABS.students.name).getParent();
  var report = [], parents = parentMsgs_();

  classes.forEach(function (cls) {
    var students = byClass[cls];
    var list = assigns.filter(function (a) { return a.classes.length === 0 || a.classes.indexOf(cls) >= 0; });
    var name = 'Tracker ' + cls;
    var sh = ss.getSheetByName(name) || ss.insertSheet(name);
    sh.clear();
    if (sh.setHiddenGridlines) sh.setHiddenGridlines(true);
    if (sh.setTabColor) sh.setTabColor('#1F3A93');

    var nA = list.length;
    var width = 2 + nA + 5;           // Reg, Name, worksheets, On time, Late, Missing, On-time rate, Follow up
    var HEAD = 5;                     // header row number
    var rows = [], bgs = [], fgs = [], bold = [], notes = [];
    function addRow(vals, bg, fg, b, n) {
      while (vals.length < width) vals.push('');
      rows.push(vals);
      bgs.push(bg || vals.map(function () { return TRACK.plain.bg; }));
      fgs.push(fg || vals.map(function () { return TRACK.plain.fg; }));
      bold.push(vals.map(function () { return b ? 'bold' : 'normal'; }));
      notes.push(n || vals.map(function () { return ''; }));
    }
    function fill(color) { var a = []; for (var i = 0; i < width; i++) a.push(color); return a; }

    // Rows 1 to 4: title, summary, key, gap
    addRow(['Homework tracker: ' + cls], null, null, true);
    addRow(['']);
    var key = ['', 'Key'], kbg = fill(TRACK.plain.bg), kfg = fill(TRACK.plain.fg);
    var keys = [['✓  On time', TRACK.onTime], ['Late', TRACK.late], ['✗  Missing', TRACK.missing], ['Not due yet', TRACK.notDue]];
    keys.forEach(function (k, i) { key[2 + i] = k[0]; kbg[2 + i] = k[1].bg; kfg[2 + i] = k[1].fg; });
    addRow(key, kbg, kfg);
    addRow(['']);

    // Row 5: headers. Row 6: due dates.
    var h = ['Reg', 'Name'], d = ['', 'Due'];
    list.forEach(function (a) {
      h.push(a.id + '\n' + a.title);
      d.push(a.dueAt ? Utilities.formatDate(a.dueAt, TZ, a.allDay ? 'EEE d MMM' : 'EEE d MMM, h:mm a') : (a.open ? 'No due date' : 'Closed'));
    });
    h = h.concat(['On time', 'Late', 'Missing', 'On-time rate', 'Follow up']);
    d = d.concat(['', '', '', '', '']);
    addRow(h, fill(TRACK.head.bg), fill(TRACK.head.fg), true);
    addRow(d, fill(TRACK.due.bg), fill(TRACK.due.fg), false);

    // One row per student
    var model = trackerModel_(students, list, subs, now, parents);
    var colDone = model.colDone, colOnTime = model.colOnTime, flagged = model.flagged;
    var classDue = model.classDue, classOnTime = model.classOnTime;
    model.rows.forEach(function (m) {
      var st = m.st, t = m.t, f = m.follow;
      var vals = [st.reg, st.name], bg = [TRACK.plain.bg, TRACK.plain.bg], fg = [TRACK.plain.fg, TRACK.plain.fg];
      var nt = ['', ''];
      m.cells.forEach(function (c) { vals.push(c.text); bg.push(TRACK[c.kind].bg); fg.push(TRACK[c.kind].fg); nt.push(c.note); });
      vals = vals.concat([t.onTime, t.late, t.missing, m.rate, f.text]);
      bg = bg.concat([TRACK.plain.bg, TRACK.plain.bg, TRACK.plain.bg, TRACK.plain.bg,
        f.level === 'red' ? TRACK.flagRed.bg : f.level === 'amb' ? TRACK.flagAmb.bg : TRACK.plain.bg]);
      var grey = TRACK.notDue.fg;
      fg = fg.concat([t.onTime ? TRACK.onTime.fg : grey, t.late ? TRACK.late.fg : grey, t.missing ? TRACK.missing.fg : grey, TRACK.plain.fg,
        f.level === 'red' ? TRACK.flagRed.fg : f.level === 'amb' ? TRACK.flagAmb.fg : TRACK.plain.fg]);
      nt = nt.concat(['', '', '', '', '']);
      if (f.level) {
        var lv = f.level === 'red' ? TRACK.flagRed : TRACK.flagAmb;
        bg[1] = lv.bg; fg[1] = lv.fg;
      }
      addRow(vals, bg, fg, false, nt);
    });

    // Totals under the list
    addRow(['']);
    var tot = ['', 'Handed in'], tot2 = ['', 'On time'];
    list.forEach(function (a, j) { tot.push(colDone[j] + ' / ' + students.length); tot2.push(colOnTime[j] + ' / ' + students.length); });
    addRow(tot, fill('#F4F6FA'), null, true);
    addRow(tot2, fill('#F4F6FA'), null, true);

    // Summary line in row 2
    var reds = flagged.filter(function (x) { return x.level === 'red'; }).length;
    var summary = 'Updated ' + Utilities.formatDate(now, TZ, 'd MMM yyyy, h:mm a') + '.  ' +
      (classDue ? 'Class on-time rate ' + Math.round(100 * classOnTime / classDue) + '%.  ' : 'Nothing is due yet.  ') +
      (flagged.length ? rwN_(flagged.length, 'student', 'students') + ' to follow up, ' + reds + ' urgent.' : 'No one to follow up.');
    rows[1][0] = summary;

    var nR = rows.length;
    var all = sh.getRange(1, 1, nR, width);
    all.setValues(rows).setBackgrounds(bgs).setFontColors(fgs).setFontWeights(bold).setNotes(notes)
      .setFontFamily('Arial').setFontSize(10).setVerticalAlignment('middle');
    sh.getRange(1, 1).setFontSize(16);
    sh.getRange(2, 1).setFontColor('#5B6577');
    sh.getRange(HEAD, 1, 2, width).setWrap(true).setHorizontalAlignment('center');
    sh.getRange(HEAD + 1, 1, nR - HEAD, width).setHorizontalAlignment('center');
    sh.getRange(HEAD, 2, nR - HEAD + 1, 1).setHorizontalAlignment('left');
    sh.getRange(3, 3, 1, 4).setHorizontalAlignment('center');
    if (students.length) {
      sh.getRange(HEAD + 2, 3 + nA + 3, students.length, 1).setNumberFormat('0%');
      sh.getRange(HEAD + 2, 1, students.length, width)
        .setBorder(null, null, null, null, false, true, '#E3E8F0', SpreadsheetApp.BorderStyle.SOLID);
    }
    sh.setFrozenRows(HEAD + 1);
    sh.setFrozenColumns(2);
    sh.setRowHeight(HEAD, 54);
    sh.setRowHeight(HEAD + 1, 34);
    sh.setColumnWidth(1, 44);
    sh.setColumnWidth(2, 200);
    for (var c = 0; c < nA; c++) sh.setColumnWidth(3 + c, 96);
    sh.setColumnWidths(3 + nA, 3, 64);
    sh.setColumnWidth(3 + nA + 3, 92);
    sh.setColumnWidth(3 + nA + 4, 120);

    report.push(cls + ': ' + students.length + ' students, ' + nA + ' worksheet(s), ' + flagged.length + ' to follow up');
  });

  try {
    ss.toast(report.join('\n') || 'No classes found in the Students tab.', 'Homework tracker updated', 8);
  } catch (e) { /* running on a timer */ }
  return report;
}

function toggleHourlyTracker() {
  var ui = SpreadsheetApp.getUi();
  var mine = ScriptApp.getProjectTriggers().filter(function (t) { return t.getHandlerFunction() === 'buildTracker'; });
  if (mine.length) {
    mine.forEach(function (t) { ScriptApp.deleteTrigger(t); });
    ui.alert('The tracker no longer updates by itself. Use Worksheet Hub > Update homework tracker when you need it.');
  } else {
    ScriptApp.newTrigger('buildTracker').timeBased().everyHours(1).create();
    buildTracker();
    ui.alert('The tracker now updates by itself every hour. Run this menu item again to turn it off.');
  }
}

/* ------------------------------------------------------------------ */
/* Teacher Hub                                                         */
/* The same web link with ?teacher at the end. Only the teacher can    */
/* use it: either signed in with the Google account that owns this     */
/* script, or with the teacher passcode.                               */
/* ------------------------------------------------------------------ */

var T_SESSION_SECONDS = 21600;   // 6 hours

// The web app link. The link pasted with "Set the web app link" is used first, because the link Google
// reports from inside the Sheet is often the /dev test link, which only opens for the owner's default
// Google account and otherwise shows "Sorry, unable to open the file at this time".
function webAppUrl_() {
  var saved = PropertiesService.getScriptProperties().getProperty('WEBAPP_URL');
  if (saved) return saved;
  try { return hubPlainExecUrl_(ScriptApp.getService().getUrl() || ''); } catch (e) { return ''; }
}

// https://script.google.com/a/macros/moe.edu.sg/s/ID/exec -> https://script.google.com/macros/s/ID/exec
// The plain form does not depend on which Google account the browser is signed in to.
function hubPlainExecUrl_(u) {
  var m = String(u || '').trim().match(/^https:\/\/script\.google\.com\/(?:a\/macros\/[^\/]+|macros)(?:\/u\/\d+)?\/s\/([-\w]+)\/(exec|dev)/);
  if (!m) return '';
  return 'https://script.google.com/macros/s/' + m[1] + '/' + m[2];
}

function hubUrl_() {
  var u = webAppUrl_();
  return u ? u + '?teacher' : '';
}

function hubSetWebAppLink() {
  var ui = SpreadsheetApp.getUi();
  var res = ui.prompt('Set the web app link',
    'In the script editor, click Deploy > Manage deployments and copy the Web app URL (it ends in /exec). Paste it here.',
    ui.ButtonSet.OK_CANCEL);
  if (res.getSelectedButton() !== ui.Button.OK) return;
  var u = hubPlainExecUrl_(res.getResponseText());
  if (!u || !/\/exec$/.test(u)) {
    ui.alert('That is not a web app link ending in /exec. Nothing was changed. Copy the Web app URL from Deploy > Manage deployments (not the /dev test link).');
    return;
  }
  PropertiesService.getScriptProperties().setProperty('WEBAPP_URL', u);
  ui.alert('Saved.\n\nStudent link:\n' + u + '\n\nTeacher Hub:\n' + u + '?teacher');
}

function showTeacherHub() {
  var url = hubUrl_();
  var isDev = /\/dev\?teacher$/.test(url);
  if (isDev) url = '';
  var hasPass = true;   // the teacher PIN (Live Board's Settings tab)
  var html = url
    ? '<p><a href="' + url + '" target="_blank"><b>Open the Teacher Hub</b></a></p><p>Bookmark this link. Students use the same link without <b>?teacher</b> at the end.</p>'
    : '<p>' + (isDev ? 'Google only gave the test link for this script, which may not open. ' : 'Deploy the web app first (Deploy &gt; New deployment). ') +
      'Then choose <b>Worksheet Hub &gt; Set the web app link</b> and paste the Web app URL from Deploy &gt; Manage deployments (it ends in /exec).</p>';
  if (!hasPass) html += '<p>Set a teacher passcode too (Worksheet Hub &gt; Set teacher passcode), so that you can open the Hub on any device.</p>';
  if (url) html += '<p style="color:#5b6577">If Google says "Sorry, unable to open the file at this time", your browser is signed in to more than one Google account. Open the link in a private (Incognito) window and sign in with the passcode.</p>';
  showLinkDialog_('Teacher Hub', html);
}

function setTeacherPasscode() {
  var ui = SpreadsheetApp.getUi();
  var res = ui.prompt('Set teacher passcode', 'Type a passcode of at least 6 characters. Students must not know it.', ui.ButtonSet.OK_CANCEL);
  if (res.getSelectedButton() !== ui.Button.OK) return;
  var pass = res.getResponseText().trim();
  if (pass.length < 6) { ui.alert('The passcode must be at least 6 characters. Nothing was changed.'); return; }
  var props = PropertiesService.getScriptProperties();
  var salt = Utilities.getUuid();
  props.setProperty('T_SALT', salt);
  props.setProperty('T_PASS', hubHash_(pass, salt));
  ui.alert('Teacher passcode saved. Anyone signed in to the Teacher Hub with the old passcode is signed out within 6 hours.');
}

function hubHash_(text, salt) {
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, salt + '|' + text, Utilities.Charset.UTF_8);
  return bytes.map(function (b) { var h = (b & 255).toString(16); return h.length < 2 ? '0' + h : h; }).join('');
}

function tIssue_() {
  var token = Utilities.getUuid();
  CacheService.getScriptCache().put('ttok_' + token, '1', T_SESSION_SECONDS);
  return token;
}

function teacher_(token) {
  if (!token || !CacheService.getScriptCache().get('ttok_' + token)) throw new Error('TEACHER_SIGNED_OUT');
}

// Signs the teacher in straight away when they are signed in to Google with the account that owns this script.
function api_t_auto() {
  var me = '', owner = '';
  try { me = Session.getActiveUser().getEmail(); owner = Session.getEffectiveUser().getEmail(); } catch (e) { /* not available */ }
  var hasPass = true;   // the teacher PIN (Live Board's Settings tab)
  if (me && owner && me.toLowerCase() === owner.toLowerCase()) return { token: tIssue_(), hasPass: hasPass };
  return { token: null, hasPass: hasPass };
}

// The setup guide (the Guide file), for the Teacher Hub's sign-in page. It holds nothing private, so it is
// shown before signing in, to help a teacher who is new to the Hub.
function api_guide() {
  try { return pageHtml_('Guide'); }
  catch (e) { return ''; }      // the Guide file has not been added to the project yet
}

// One teacher PIN for everything: the Teacher Hub signs in with Live Board's teacher PIN (Settings tab).
function api_t_login(pass) {
  checkPin_(String(pass == null ? '' : pass));
  return { token: tIssue_() };
}

function api_unlockStudent(pass) {
  checkPin_(String(pass == null ? '' : pass));
  return true;
}

function api_t_logout(token) { CacheService.getScriptCache().remove('ttok_' + token); return true; }

/* ---------- Dashboard ---------- */

// Students who should do this worksheet (never the TEST student).
function studentsFor_(a) {
  return getStudents_().filter(function (s) { return s.cls !== 'TEST' && (a.classes.length === 0 || a.classes.indexOf(s.cls) >= 0); });
}

function fileUrl_(id) { return id ? 'https://drive.google.com/file/d/' + id + '/view' : ''; }
function downloadUrl_(id) { return 'https://drive.google.com/uc?export=download&id=' + id; }

function summarise_(a, subs, now, help) {
  var students = studentsFor_(a);
  var isDue = !a.open || !!(a.dueAt && now > a.dueAt);
  var perClass = {}, order = [];
  var out = { handed: 0, late: 0, markedFiles: 0, scored: 0, total: students.length, corrDone: 0, corrDue: 0 };
  var corrOwed = [];
  students.forEach(function (s) {
    if (!perClass[s.cls]) { perClass[s.cls] = { cls: s.cls, total: 0, handed: 0, late: 0, notHanded: [] }; order.push(s.cls); }
    var pc = perClass[s.cls], sub = subs[a.id + '|' + studentKey_(s)];
    pc.total++;
    if (sub) {
      pc.handed++; out.handed++;
      if (sub.auto) { out.auto = (out.auto || 0) + 1; if (sub.pending) out.pending = (out.pending || 0) + 1; }
      if (a.dueAt && sub.first && sub.first > a.dueAt) { pc.late++; out.late++; }
      if (sub.marked) out.markedFiles++;
      if (sub.checked) out.checked = (out.checked || 0) + 1;
      if (sub.score || sub.comment) out.scored++;
      var cs = corrState_(a, sub);
      if (cs === 'done') { out.corrDone++; out.corrDue++; }
      else if (cs === 'todo' || cs === 'missed') { out.corrDue++; corrOwed.push(s.cls + ' ' + s.name); }
    } else pc.notHanded.push(s.name);
  });
  return {
    id: a.id, title: a.title, chapter: chapterOfWs_(a), chapterSet: a.chapter, practice: !!a.practice, classes: a.classes, classText: a.classes.length ? a.classes.join(', ') : 'All classes',
    due: a.due, dueTs: a.dueAt ? a.dueAt.getTime() : null, open: a.open, showMarked: a.showMarked, isDue: isDue,
    fileUrl: fileUrl_(a.fileId), reportUrl: a.reportLink,
    answerUrl: a.answerLink, hasAnswerKey: !!a.answerLink, showAnswers: a.showAnswers && !!a.answerLink,
    correctionsOpen: !a.correctionsClosed, corrDone: out.corrDone, corrDue: out.corrDue, corrOwed: corrOwed,
    solutionUrl: a.solutionLink, hasSolution: !!a.solutionLink, inLibrary: !!libLinksCached_()[a.id],
    autoClose: a.autoClose, corrDays: a.corrDays, answersAfter: a.answersAfter,
    autoHandIn: !!a.autoHandIn, autoMark: !!a.autoMark, auto: out.auto || 0, pending: out.pending || 0,
    job: getJob_(a.id), icon: wsIcons_()[a.id] || '',
    stuck: help && help[a.id] ? help[a.id] : null,
    total: out.total, handed: out.handed, late: out.late, markedFiles: out.markedFiles, scored: out.scored, checked: out.checked || 0,
    perClass: order.map(function (c) { return perClass[c]; })
  };
}

// Picture chosen by the teacher for each worksheet card (blank = picked from the title).
var WS_ICON_KEYS = ['lens', 'mirror', 'prism', 'bulb', 'ruler', 'thermo', 'circuit', 'magnet', 'force', 'cell', 'atom', 'beaker', 'bolt', 'wave', 'flask'];
function wsIcons_() { return parseJson_(PropertiesService.getScriptProperties().getProperty('WS_ICONS')) || {}; }

// Items in Needs you that the teacher has put away until tomorrow: { key: 'yyyyMMdd' }.
function snoozed_(now) {
  var all = parseJson_(PropertiesService.getScriptProperties().getProperty('SNOOZE')) || {}, today = Utilities.formatDate(now, TZ, 'yyyyMMdd'), out = {};
  Object.keys(all).forEach(function (k) { if (all[k] === today) out[k] = true; });
  return out;
}
function api_t_snooze(token, key, on) {
  teacher_(token);
  key = String(key || '').slice(0, 80);
  if (!key) throw new Error('Nothing to put away.');
  var props = PropertiesService.getScriptProperties();
  var all = parseJson_(props.getProperty('SNOOZE')) || {}, today = Utilities.formatDate(new Date(), TZ, 'yyyyMMdd'), keep = {};
  Object.keys(all).forEach(function (k) { if (all[k] === today) keep[k] = today; });   // old days are dropped
  if (on) keep[key] = today; else delete keep[key];
  props.setProperty('SNOOZE', JSON.stringify(keep));
  return true;
}

function attention_(list, now, followCount, redCount, extra) {
  var items = (extra || []).slice(), DAY = 86400000;
  list.forEach(function (w) {
    var left = w.total - w.handed, j = w.job;
    if (w.open && w.dueTs && w.dueTs > now.getTime() && w.dueTs - now.getTime() < 2 * DAY && left > 0) {
      var today = Utilities.formatDate(new Date(w.dueTs), TZ, 'yyyyMMdd') === Utilities.formatDate(now, TZ, 'yyyyMMdd');
      items.push({ level: 'info', id: w.id, action: 'open', kind: 'due', left: left, today: today, text: w.title + ' is due ' + (today ? 'today' : w.due) + '. ' + left + ' of ' + w.total + ' have not handed in.' });
    }
    if (w.open && w.dueTs && w.dueTs <= now.getTime()) {
      items.push({ level: 'warn', id: w.id, action: 'open', kind: 'overdue', left: left, text: w.title + ' was due ' + w.due + ' and is still open. ' + (left ? left + ' not handed in.' : 'Everyone has handed in.') });
    }
    var busyJob = j && /^(queued|queued_rest|marking|marking_sample|queued_solution|drafting_solution)$/.test(j.status);
    if (j && j.status === 'solution_ready' && !w.hasSolution) items.push({ level: 'todo', id: w.id, action: 'solution', kind: 'solution', text: 'Claude has drafted the marked solution for ' + w.title + '. Check it and save it, so Claude can mark against it.' });
    if (w.autoMark && !w.hasSolution && !(j && /solution/.test(j.status)) && w.dueTs && w.dueTs - now.getTime() < 2 * DAY) {
      items.push({ level: w.dueTs <= now.getTime() ? 'warn' : 'info', id: w.id, action: 'open', kind: 'nosolution', text: 'Claude will mark ' + w.title + ' when it closes, but there is no marked solution yet. Upload yours or let Claude draft one.' });
    }
    if (w.isDue && w.handed > 0 && w.markedFiles === 0 && w.scored === 0 && !w.showMarked && !busyJob && !(j && /^(sample_ready|solution_ready)$/.test(j.status))) {
      items.push({ level: 'todo', id: w.id, action: 'zip', kind: 'mark', text: w.title + ' is ready to mark. ' + w.handed + ' handed in.' });
    }
    if ((w.markedFiles > 0 || w.scored > 0) && !w.showMarked && !busyJob && !(j && j.status === 'sample_ready')) {
      items.push({ level: 'todo', id: w.id, action: 'release', kind: 'release', text: w.title + ' has marking uploaded that students cannot see yet.' });
    }
    if (j && j.status === 'sample_ready') items.push({ level: 'todo', id: w.id, action: 'sample', kind: 'mark', text: 'Claude has marked one sample of ' + w.title + '. Check it, then let Claude mark the rest.' });
    if (j && j.status === 'error') items.push({ level: 'warn', id: w.id, action: 'open', kind: 'error', text: 'Claude could not finish ' + (j.phase === 'solution' ? 'the marked solution for ' : 'marking ') + w.title + '. ' + (j.message || '') });
    if (w.showMarked && w.correctionsOpen && w.corrDue > 0) {
      items.push({ level: 'info', id: w.id, action: 'open', kind: 'corr', text: w.title + ': ' + w.corrDone + ' of ' + w.corrDue + ' corrections handed in.' });
    }
    if (w.open && w.stuck && w.stuck.top && w.stuck.top.n >= STUCK_MIN) {
      items.push({ level: 'info', id: w.id, action: 'help', kind: 'stuck', count: w.stuck.top.n, q: w.stuck.top.q,
        text: rwN_(w.stuck.top.n, 'student is', 'students are') + ' stuck on ' + w.stuck.top.q + ' in ' + w.title + '.' });
    }
    if (w.hasAnswerKey && !w.showAnswers && w.showMarked) {
      items.push({ level: 'info', id: w.id, action: 'answers', kind: 'release', text: 'The answer key for ' + w.title + ' is ready. Students cannot see it until you release it.' });
    }
  });
  // redCount: students with 3 or more problem worksheets since their parent was last messaged.
  if (redCount) items.push({ level: 'warn', action: 'tracker', kind: 'parent', count: redCount,
    text: rwN_(redCount, 'student has', 'students have') + ' ' + PARENT_AFTER + ' or more worksheets missing, late or under 50%. Message ' + (redCount === 1 ? 'their parent.' : 'their parents.') });
  if (followCount > redCount) items.push({ level: 'info', action: 'tracker', kind: 'follow', count: followCount - redCount, red: 0,
    text: rwN_(followCount - redCount, 'student', 'students') + ' to keep an eye on: 1 or 2 worksheets missing, late or under 50%.' });
  markInfo_(items);
  var off = snoozed_(now);
  items.forEach(function (it) { it.key = ((it.kind || it.action) + '|' + (it.id || it.gkey || (it.k ? it.k + '|' + it.cls : it.cls) || '')).slice(0, 80); if (off[it.key]) it.snoozed = true; });
  return items;
}

function api_t_dashboard(token) {
  teacher_(token);
  CH_MEMO_ = {};
  // Anything due to happen at a due time that has passed is done now, in case the timer has not run yet.
  try { if (Object.keys(wsAuto_()).length) hubTickDue_(); } catch (e) { /* the timer will try again */ }
  // Let in requests and the homework set by itself come from Live Board (one request, kept 20 seconds).
  var live = null;
  try { live = liveNeeds_(); } catch (e) { live = null; }
  var now = new Date();
  var subs = submissionIndex_();
  var assigns = getAssignments_().filter(function (a) { return a.fileId; });
  var help = stuckIndex_();
  var list = assigns.map(function (a) { return summarise_(a, subs, now, help); }).reverse();

  var byClass = studentsByClass_(), follow = [], parents = parentMsgs_();
  Object.keys(byClass).sort().forEach(function (cls) {
    follow = follow.concat(trackerModel_(byClass[cls], assignsForClass_(assigns.filter(function (a) { return !a.practice; }), cls), subs, now, parents).flagged);
  });
  var seen = followSeen_(now);
  follow = follow.filter(function (f) { return !seen[f.cls + '|' + hubNormName_(f.name)]; });
  var red = follow.filter(function (f) { return f.parent; }).length;

  var ss = hubSheet_(TABS.students.name).getParent();
  return {
    title: APP_TITLE, school: APP_SCHOOL,
    classes: Object.keys(byClass).sort(),
    links: { student: (hubUrl_() || '').replace(/\?teacher$/, ''), site: SITE_URL, sheet: ss.getUrl ? ss.getUrl() : '', folder: folder_('ROOT').getUrl(), liveboard: liveBoardUrl_() + '?view=teacher', lessons: lessonSiteUrl_() },
    worksheets: list,
    chapters: (function () { try { var c = api_t_chapters(token); return { list: c.chapters, given: c.given, topical: topicalAll_() }; } catch (e) { return { list: [], given: {}, topical: {} }; } })(),
    attention: attention_(list.filter(function (w) { return !w.practice; }), now, follow.length, red, extraNeeds_(now, live)),
    claude: { connected: !!(PropertiesService.getScriptProperties().getProperty('CLAUDE_FIRE_URL') && PropertiesService.getScriptProperties().getProperty('CLAUDE_FIRE_TOKEN')) },
    updated: Utilities.formatDate(now, TZ, 'h:mm a')
  };
}

/* ---------- Live Board from the Teacher Hub: Teach next, and signing in to Live Board ----------
   The Hub asks Live Board for a sign-in (a key that lasts 12 hours), so the slides, Progress, Classes and phone
   pairing open from here with no PIN. The Hub proves itself with its sheet ID, which Live Board keeps as its class
   list (Live Board sheet, Settings: Class list sheet ID). The answer also says, for each class, the lesson running
   now, the part taught last and the part to teach next. */
function lbKey_() { return hubSheetId_(); }
function lbAsk_(op, extra) {
  var body = { api: 'hub', key: lbKey_(), op: op || '' };
  Object.keys(extra || {}).forEach(function (k) { body[k] = extra[k]; });
  var out = hubRequest_(body);
  if (!out) throw new Error('Live Board did not answer as expected.');
  if (out.ok === false) {
    if (/Wrong key/.test(out.error || '')) throw new Error('Live Board does not know the Teacher Hub sheet. In the Live Board sheet, Settings tab, Class list sheet ID must be the Hub sheet\'s ID: ' + lbKey_());
    throw new Error(out.error || 'Live Board said no.');
  }
  return out;
}
function api_t_teachnext(token, fresh) {
  teacher_(token);
  var cache = CacheService.getScriptCache();
  if (!fresh) {
    var hit = cache.get('lb_teachnext');
    if (hit) { try { return JSON.parse(hit); } catch (e) { /* ask again */ } }
  }
  var r = lbAsk_('teachnext');
  var out = { token: r.token, until: r.until, build: r.build || '', site: r.site || lessonSiteUrl_(), lb: liveBoardUrl_(),
    classes: r.classes || [], parts: r.parts || {}, alloc: r.alloc || {}, taught: r.taught || {}, at: Date.now() };
  try { cache.put('lb_teachnext', JSON.stringify(out), 45); } catch (e) { /* too big to keep: ask each time */ }
  return out;
}
/* Open a lesson to a class for revision (or close it). Students in the class see it in learnwithmrcedric and can go
   through it after school; nothing they do outside the class's lesson is saved. Kept by Live Board. */
function api_t_alloc(token, cls, deckId, on) {
  teacher_(token);
  var r = lbAsk_('alloc', { cls: String(cls || ''), deckId: String(deckId || ''), on: !!on });
  CacheService.getScriptCache().remove('lb_teachnext');
  return r.alloc || {};
}

/* Avatars and the night market are closed to a class while its Science lesson is running, unless the teacher
   opens them on the phone. Live Board knows; the answer is kept for 30 seconds. If Live Board cannot be reached,
   they stay open. */
function funState_(s) {
  var cache = CacheService.getScriptCache(), k = 'fun_' + s.cls, hit = cache.get(k);
  if (hit) { var x = parseJson_(hit); if (x) return x; }
  var out = { open: true, live: false };
  try { var r = lbAsk_('classstate', { cls: s.cls }); out = { open: !r.live || !!r.fun, live: !!r.live }; } catch (e) { out = { open: true, live: false }; }
  try { cache.put(k, JSON.stringify(out), 30); } catch (e) { /* asked again next time */ }
  return out;
}
function funGuard_(s) {
  if (s.cls !== 'TEST' && !funState_(s).open) throw new Error('FUN_CLOSED: Avatars and the night market are closed during your Science lesson. They open again after the lesson.');
  return s;
}
function api_fun(token) { var s = who_(token); return s.cls === 'TEST' ? { open: true, live: false } : funState_(s); }

/* ---------- Worksheets ---------- */

function dueFrom_(date, time) {
  if (!date) return '';
  return Utilities.parseDate(date + ' ' + (time || '00:00'), TZ, 'yyyy-MM-dd HH:mm');
}

function nextId_() {
  var max = 0, props = PropertiesService.getScriptProperties();
  getAssignments_().forEach(function (a) { var m = a.id.match(/^WS(\d+)$/i); if (m) max = Math.max(max, Number(m[1])); });
  // A number once used is never used again (Undo after Deploy empties a worksheet's row).
  max = Math.max(max, Number(props.getProperty('WS_LAST_N')) || 0);
  max++;
  props.setProperty('WS_LAST_N', String(max));
  return 'WS' + (max < 10 ? '0' : '') + max;
}

function cleanClasses_(list) {
  var known = studentsByClass_();
  return (list || []).map(hubNormClass_).filter(function (c) { return c && known[c]; });
}

// The first row with no ID and no title. The checkboxes in columns E and F count as filled, so getLastRow() cannot be used.
function firstFreeRow_(sh) {
  var last = sh.getLastRow();
  if (last < 2) return 2;
  var v = sh.getRange(2, 1, last - 1, 2).getValues();
  for (var i = 0; i < v.length; i++) if (!String(v[i][0]).trim() && !String(v[i][1]).trim()) return i + 2;
  return last + 1;
}

// meta: { title, classes: [..] (empty = all), dueDate: 'yyyy-MM-dd', dueTime: 'HH:mm' or '', open: true }
// meta may also carry { autoClose, corrDays, answersAfter, autoHandIn, autoMark, draftSolution }.
// solBase64 is the teacher's marked solution (optional).
function api_t_newWorksheet(token, meta, pdfBase64, fileName, solBase64) {
  teacher_(token);
  var bytes = Utilities.base64Decode(pdfBase64 || '');
  var out = newWorksheet_(meta || {}, bytes, solBase64 ? Utilities.base64Decode(solBase64) : null);
  if (meta && meta.library && meta.library.keep) {
    try { out.library = libKeep_(findAssignment_(out.id), meta.library.topic || '').getName(); }
    catch (e) { out.warning = 'The worksheet is saved, but it could not be kept in your library: ' + String(e.message || e).replace(/^Error:\s*/, ''); }
  }
  return afterNew_(out, meta, !!solBase64);
}

// Claude drafts the marked solution straight away when asked, so it is ready to check before anyone hands in.
function afterNew_(out, meta, hasSol) {
  if (meta && meta.draftSolution && !hasSol) {
    try { fireClaude_(findAssignment_(out.id), 'solution', { note: '' }); out.drafting = true; }
    catch (e) { out.warning = 'The worksheet is saved, but Claude could not start the marked solution: ' + String(e.message || e).replace(/^Error:\s*/, ''); }
  }
  return out;
}

/* ---------- The worksheet library: a Drive folder of worksheets to set from ---------- */
//
// The library is a Drive folder: Worksheet Hub/Worksheet library, or any folder the teacher points the Hub at
// (LIB_FOLDER). Subfolders are topics, as deep as you like.
//
// Every worksheet lives in a folder of its own, which the Hub makes: drop "Refraction 2.pdf" anywhere in the
// library and Refresh moves it into "Refraction 2/" (with its marked solution, if one sits beside it). A
// worksheet's folder holds:
//   Refraction 2.pdf                    the worksheet (a PDF, Google Doc or Google Slides)
//   Refraction 2 marked solution.pdf    the teacher's marked solution, which Claude marks against
//   Refraction 2 answer key.pdf         the explained answer key Claude made (hidden from students until released)
//   Refraction 2 marking notes.json     Claude's scheme, question map and answer-key notes, so it can start from them
//                                       (dropped when the marked solution changes, because they came from the old one)
// Once a worksheet is set from the library (or kept in it when uploaded), the Hub keeps that folder up to date:
// a marked solution the teacher saves, an answer key Claude makes and Claude's notes are written into it. Set
// it again and all of them come with it. The folders are marked by their Drive description (LIB_ITEM).
// Word and PowerPoint files are listed with a note to save them as PDF first, because Apps Script cannot
// turn them into PDFs.
// library_links.json (in Drafts) remembers which worksheet came from which library folder: { wsId: folderId }.
// LIB_SRC is the older record by file ({ fileId: [worksheet ids] }), still read for "Set before".

var LIB_MAX_FILES = 3000, LIB_MAX_DEPTH = 8;
var LIB_ITEM = 'Worksheet Hub library: one worksheet and its marking. The Hub keeps the files in this folder up to date.';
var LIB_SOL_RE = /[\s_\-–(]+(marked solutions?|worked solutions?|solutions?|mark ?schemes?|answer ?keys?|answers?)\)?$/i;
var LIB_KEY_RE = /[\s_\-–(]+(answer ?keys?|answers? explained)\)?$/i;
var LIB_NOTES_RE = /[\s_\-–]+marking notes$/i;
var LIB_NOTES_KEEP = ['scheme.md', 'layout.json', 'answer_spec.json', 'decisions.md'];
var LIB_KINDS = {
  'application/pdf': 'pdf',
  'application/vnd.google-apps.document': 'gdoc',
  'application/vnd.google-apps.presentation': 'gslides',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'word',
  'application/msword': 'word',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'ppt',
  'application/vnd.ms-powerpoint': 'ppt'
};

function libFolder_() {
  var id = PropertiesService.getScriptProperties().getProperty('LIB_FOLDER');
  if (id) {
    try { var f = DriveApp.getFolderById(id); if (!f.isTrashed()) return f; } catch (e) { /* fall back to the Hub's own */ }
  }
  return folder_('LIB');
}

function libKey_(name) { return String(name).toLowerCase().replace(/[\s_\-–]+/g, ' ').trim(); }
function libBase_(name) { return String(name).replace(/\.(pdf|docx?|pptx?|json)$/i, '').trim(); }
function libIsItem_(folder) { try { return String(folder.getDescription() || '').indexOf('Worksheet Hub library') === 0; } catch (e) { return false; } }
function libOk_(kind) { return kind === 'pdf' || kind === 'gdoc' || kind === 'gslides'; }
function libDrop_() { var c = CacheService.getScriptCache(); c.remove('LIB_LIST'); c.remove('al_lib'); c.remove('al_miss'); }

// Which worksheet came from which library folder (a file in Drafts, so it never runs out of room).
function libLinks_() {
  var it = folder_('DRAFTS').getFilesByName('library_links.json');
  while (it.hasNext()) { var f = it.next(); if (!f.isTrashed()) return parseJson_(f.getBlob().getDataAsString()) || {}; }
  return {};
}
function libSaveLinks_(links) {
  var live = {};
  getAssignments_().forEach(function (a) { live[a.id] = true; });
  Object.keys(links).forEach(function (k) { if (!live[k]) delete links[k]; });   // worksheets that were deleted
  var folder = folder_('DRAFTS'), it = folder.getFilesByName('library_links.json'), text = JSON.stringify(links);
  while (it.hasNext()) { var f = it.next(); if (!f.isTrashed()) { f.setContent(text); return; } }
  folder.createFile('library_links.json', text, 'application/json');
}
var LIB_LINKS_RUN = null;          // read once per run
function libLinksCached_() { if (!LIB_LINKS_RUN) LIB_LINKS_RUN = libLinks_(); return LIB_LINKS_RUN; }
function libLink_(wsId, folderId) {
  var links = libLinks_();
  links[wsId] = folderId;
  libSaveLinks_(links);
}

// Every worksheet in the library, with what its folder holds. Kept for 10 minutes.
function api_t_library(token, refresh) {
  teacher_(token);
  var cache = CacheService.getScriptCache(), list = null;
  if (!refresh) list = parseJson_(cache.get('LIB_LIST'));
  if (!list) {
    list = libWalk_();
    try { cache.put('LIB_LIST', JSON.stringify(list), 600); } catch (e) { /* too big to keep: walk again next time */ }
  }
  // Which of them were set before, and for whom (fresh each time, it is cheap).
  var src = parseJson_(PropertiesService.getScriptProperties().getProperty('LIB_SRC')) || {}, links = libLinks_(), byId = {}, byFolder = {};
  getAssignments_().forEach(function (a) { byId[a.id] = a; });
  Object.keys(links).forEach(function (w) { (byFolder[links[w]] = byFolder[links[w]] || []).push(w); });
  list.items.forEach(function (it) {
    var ids = (it.folder && byFolder[it.folder] || []).concat(src[it.id] || []), seen = {};
    it.used = ids.filter(function (w) { if (seen[w] || !byId[w]) return false; seen[w] = true; return true; })
      .sort(function (x, y) { return Number(String(x).replace(/\D/g, '')) - Number(String(y).replace(/\D/g, '')); })
      .map(function (w) { var a = byId[w]; return { id: a.id, classes: a.classes.join(', ') || 'All classes', due: a.due || '' }; });
  });
  return list;
}

// Reads the library. Loose worksheets get a folder of their own on the way (with their marked solution).
function libWalk_() {
  var root = libFolder_(), items = [], folders = [], count = 0, truncated = false, moved = 0;
  function row(f, folderId, path, roles) {
    var kind = LIB_KINDS[f.getMimeType()];
    return { id: f.getId(), folder: folderId, name: libBase_(f.getName()), file: f.getName(), path: path, kind: kind, ok: libOk_(kind),
      size: f.getSize ? f.getSize() : 0, updated: f.getLastUpdated ? f.getLastUpdated().getTime() : 0,
      sol: roles.sol ? { id: roles.sol.getId(), name: roles.sol.getName() } : null,
      key: roles.key ? { id: roles.key.getId(), name: roles.key.getName() } : null,
      notes: !!roles.notes };
  }
  // A worksheet's own folder: its worksheet and what goes with it.
  function readItem(folder, path) {
    var r = libRoles_(folder);
    count += 4;
    if (r.sheet) items.push(row(r.sheet, folder.getId(), path, r));
  }
  (function walk(folder, path, depth) {
    if (truncated) return;
    var loose = [], sols = {}, keys = {}, it = folder.getFiles();
    while (it.hasNext()) {
      var f = it.next();
      if (f.isTrashed && f.isTrashed()) continue;
      if (++count > LIB_MAX_FILES) { truncated = true; break; }
      var kind = LIB_KINDS[f.getMimeType()];
      if (!kind) continue;
      var base = libBase_(f.getName()), mk = base.match(LIB_KEY_RE), ms = base.match(LIB_SOL_RE);
      if (mk && base.length > mk[0].length) keys[libKey_(base.slice(0, base.length - mk[0].length))] = f;
      else if (ms && base.length > ms[0].length) sols[libKey_(base.slice(0, base.length - ms[0].length))] = f;
      else loose.push(f);
    }
    // An answer key on its own is the teacher's marked solution. Beside a marked solution, it is the answer key.
    Object.keys(keys).forEach(function (k) { if (!sols[k]) { sols[k] = keys[k]; delete keys[k]; } });
    // A folder the teacher made for one worksheet, with its name and nothing else in it, is used as it is.
    var subsHere = folder.getFolders().hasNext();
    if (depth > 0 && loose.length === 1 && !subsHere && libKey_(folder.getName()) === libKey_(libBase_(loose[0].getName()))) {
      try { folder.setDescription(LIB_ITEM); } catch (e) { /* not ours to label: it is still read as one */ }
      readItem(folder, path.split(' / ').slice(0, -1).join(' / '));
      return;
    }
    loose.forEach(function (f) {
      var base = libBase_(f.getName()), k = libKey_(base);
      try {
        var dest = libNewFolder_(folder, base);
        f.moveTo(dest);
        var ext = function (x) { return (x.getName().match(/\.(pdf|docx?|pptx?)$/i) || [''])[0]; };
        if (sols[k]) { var s = sols[k]; s.moveTo(dest); s.setName(base + ' marked solution' + ext(s)); delete sols[k]; }
        if (keys[k]) { var y = keys[k]; y.moveTo(dest); y.setName(base + ' answer key' + ext(y)); delete keys[k]; }
        moved++;                         // read with the other worksheet folders below
      } catch (e) {
        // A file the teacher cannot move (in someone else's shared folder) is listed where it is.
        items.push(row(f, '', path, { sol: sols[k] && libOk_(LIB_KINDS[sols[k].getMimeType()]) ? sols[k] : null }));
        delete sols[k];
      }
    });
    // A solution with no worksheet of the same name is listed as it is, so nothing in the folder goes missing.
    Object.keys(sols).concat(Object.keys(keys)).forEach(function (k) {
      var s = sols[k] || keys[k];
      if (s) items.push(row(s, '', path, {}));
    });
    if (path) folders.push(path);
    if (depth >= LIB_MAX_DEPTH || truncated) return;
    var subs = [], fi = folder.getFolders();
    while (fi.hasNext()) { var sf = fi.next(); if (!(sf.isTrashed && sf.isTrashed())) subs.push(sf); }
    subs.sort(function (a, b) { return a.getName().localeCompare(b.getName(), undefined, { numeric: true, sensitivity: 'base' }); });
    subs.forEach(function (sf) {
      if (truncated) return;
      if (libIsItem_(sf)) readItem(sf, path);
      else walk(sf, path ? path + ' / ' + sf.getName() : sf.getName(), depth + 1);
    });
  })(root, '', 0);
  items.sort(function (a, b) {
    var pa = a.path ? a.path.split(' / ') : [], pb = b.path ? b.path.split(' / ') : [];
    for (var i = 0; i < Math.min(pa.length, pb.length); i++) {
      if (pa[i] !== pb[i]) return pa[i].localeCompare(pb[i], undefined, { numeric: true, sensitivity: 'base' });
    }
    if (pa.length !== pb.length) return pa.length - pb.length;      // a topic's own worksheets before its subtopics
    return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
  });
  return { folder: { name: root.getName(), url: root.getUrl(), own: !PropertiesService.getScriptProperties().getProperty('LIB_FOLDER') },
    items: items, folders: folders, truncated: truncated, organised: moved, at: Date.now() };
}

// A new folder for one worksheet, named after it (a number is added if the name is taken).
function libNewFolder_(parent, name) {
  var base = hubClean_(name) || 'Worksheet', n = 1, nm = base;
  while (parent.getFoldersByName(nm).hasNext()) nm = base + ' (' + (++n) + ')';
  var f = parent.createFolder(nm);
  try { f.setDescription(LIB_ITEM); } catch (e) { /* the description only labels it */ }
  return f;
}

// A topic folder inside the library, by its path ("Light / Reflection"). Missing folders are made.
function libTopic_(path) {
  var folder = libFolder_();
  String(path || '').split(' / ').map(function (s) { return s.trim(); }).filter(String).forEach(function (name) {
    var it = folder.getFoldersByName(name), next = null;
    while (it.hasNext()) { var f = it.next(); if (!f.isTrashed() && !libIsItem_(f)) { next = f; break; } }
    folder = next || folder.createFolder(hubClean_(name));
  });
  return folder;
}

// Point the Hub at another Drive folder (a link or an ID), or back at its own with ''.
function api_t_setLibrary(token, link) {
  teacher_(token);
  var props = PropertiesService.getScriptProperties(), s = String(link || '').trim();
  if (!s) props.deleteProperty('LIB_FOLDER');
  else {
    var m = s.match(/\/folders\/([-\w]{10,})/) || s.match(/[?&]id=([-\w]{10,})/) || s.match(/^([-\w]{10,})$/), f = null;
    if (m) { try { f = DriveApp.getFolderById(m[1]); } catch (e) { f = null; } }
    if (!f) throw new Error('That link did not open a Drive folder. Open the folder in Drive, copy the link from the address bar, and paste it here.');
    props.setProperty('LIB_FOLDER', f.getId());
  }
  libDrop_();
  var root = libFolder_();
  return { name: root.getName(), url: root.getUrl(), own: !s };
}

// True when the folder is the library or inside it.
function libInside_(folder) {
  var rootId = libFolder_().getId(), seen = 0, queue = [folder];
  if (folder.getId() === rootId) return true;
  while (queue.length && seen < 80) {
    var parents = queue.shift().getParents();
    while (parents.hasNext()) {
      var p = parents.next(); seen++;
      if (p.getId() === rootId) return true;
      queue.push(p);
    }
  }
  return false;
}

// A file from the library, only if it is inside the library folder.
function libFile_(fileId) {
  var f = null;
  try { f = DriveApp.getFileById(String(fileId || '')); } catch (e) { f = null; }
  if (!f || (f.isTrashed && f.isTrashed())) throw new Error('That file is no longer in the library. Tap Refresh.');
  if (!libInside_(f)) throw new Error('That file is not in the worksheet library.');
  return f;
}

function libPdfBytes_(f) {
  var kind = LIB_KINDS[f.getMimeType()];
  if (kind === 'pdf') return f.getBlob().getBytes();
  if (kind === 'gdoc' || kind === 'gslides') return f.getAs('application/pdf').getBytes();
  if (kind === 'word' || kind === 'ppt') throw new Error('"' + f.getName() + '" is a ' + (kind === 'word' ? 'Word' : 'PowerPoint') + ' file. Save it as a PDF (or open it in Drive and save it as a Google ' + (kind === 'word' ? 'Doc' : 'Slides') + ') and put that in the library instead.');
  throw new Error('"' + f.getName() + '" is not a PDF.');
}

// The worksheet's own library folder, if the file sits in one.
function libItemOf_(f) {
  var it = f.getParents();
  while (it.hasNext()) { var p = it.next(); if (!(p.isTrashed && p.isTrashed()) && libIsItem_(p)) return p; }
  return null;
}

// The files in a worksheet's library folder, by role.
function libRoles_(folder) {
  var out = { sheet: null, sol: null, key: null, notes: null }, it = folder.getFiles();
  while (it.hasNext()) {
    var f = it.next();
    if (f.isTrashed && f.isTrashed()) continue;
    var base = libBase_(f.getName()), kind = LIB_KINDS[f.getMimeType()];
    if (LIB_NOTES_RE.test(base)) { out.notes = f; continue; }
    if (!kind) continue;
    if (LIB_KEY_RE.test(base)) { if (libOk_(kind) && (!out.key || f.getLastUpdated() > out.key.getLastUpdated())) out.key = f; continue; }
    var m = base.match(LIB_SOL_RE);
    if (m && base.length > m[0].length) { if (libOk_(kind) && (!out.sol || f.getLastUpdated() > out.sol.getLastUpdated())) out.sol = f; continue; }
    if (!out.sheet) out.sheet = f;
  }
  return out;
}

// Keep the library up to date: a marked solution, an answer key or Claude's notes for a worksheet that came
// from (or was kept in) the library are written into its folder, replacing the old one. Never stops the
// thing that called it: the library is a copy.
function libStore_(wsId, role, data) {
  try {
    var fid = libLinks_()[wsId];
    if (!fid) return false;
    var folder = DriveApp.getFolderById(fid);
    if (folder.isTrashed()) return false;
    var roles = libRoles_(folder), base = roles.sheet ? libBase_(roles.sheet.getName()) : folder.getName(), name, blob;
    if (role === 'notes') {
      var st = parseJson_(data) || {}, keep = {};
      LIB_NOTES_KEEP.forEach(function (k) { if (st[k]) keep[k] = st[k]; });   // never the students' marks
      if (!Object.keys(keep).length) return false;
      name = base + ' marking notes.json';
      blob = Utilities.newBlob(JSON.stringify(keep), 'application/json', name);
    } else {
      name = base + (role === 'solution' ? ' marked solution.pdf' : ' answer key.pdf');
      blob = Utilities.newBlob(data, 'application/pdf', name);
    }
    var old = role === 'solution' ? roles.sol : role === 'answers' ? roles.key : roles.notes;
    if (old) old.setTrashed(true);
    // Claude's notes were worked out from the old marked solution, so they go with it. The next marking
    // run reads the new solution and saves fresh notes.
    if (role === 'solution' && roles.notes) roles.notes.setTrashed(true);
    folder.createFile(blob);
    libDrop_();
    return true;
  } catch (e) { return false; }
}

// The worksheet as a PDF, for the preview.
function api_t_libFile(token, fileId) {
  teacher_(token);
  var f = libFile_(fileId);
  return { name: f.getName(), b64: Utilities.base64Encode(libPdfBytes_(f)) };
}

// Set a worksheet straight from the library. meta is as for api_t_newWorksheet. solBase64, when given, is a
// marked solution uploaded instead of the library's. The library's answer key and Claude's notes come too.
function api_t_newFromLibrary(token, meta, fileId, solBase64) {
  teacher_(token);
  return newFromLibrary_(meta || {}, fileId, solBase64);
}
// Also used when a worksheet linked to a sub-chapter is set by itself.
function newFromLibrary_(meta, fileId, solBase64) {
  var f = libFile_(fileId), bytes = libPdfBytes_(f), item = libItemOf_(f), roles = item ? libRoles_(item) : {}, sol = null;
  if (!String(meta.title || '').trim()) meta.title = libBase_(f.getName());
  if (solBase64) sol = Utilities.base64Decode(solBase64);
  else if (roles.sol) sol = libPdfBytes_(roles.sol);
  else if (meta.solId) sol = libPdfBytes_(libFile_(meta.solId));
  var out = newWorksheet_(meta, bytes, sol);
  var b = findAssignment_(out.id);
  out.solution = !!sol;
  if (roles.key) {
    // The explained answer key, hidden from students until it is released.
    var key = putMarked_(b, 'Answer key.pdf', Utilities.base64Encode(libPdfBytes_(roles.key)), 'answers');
    out.answers = !!(key && key.answers);
  }
  if (roles.notes && !solBase64) {
    // Claude starts from its scheme, question map and answer-key notes from last time.
    folder_('DRAFTS').createFile(stateName_(b), roles.notes.getBlob().getDataAsString(), 'application/json');
    out.notes = true;
  }
  if (item) {
    libLink_(b.id, item.getId());
    if (solBase64) libStore_(b.id, 'solution', sol);     // a marked solution uploaded now becomes the library's
  } else libRemember_(f.getId(), b.id);
  libDrop_();
  return afterNew_(out, meta, !!sol);
}

// Keep a worksheet in the library: a folder of its own (in the topic folder chosen) with the worksheet, the
// marked solution, the answer key and Claude's notes, kept up to date from then on.
function libKeep_(a, topic) {
  var links = libLinks_();
  if (links[a.id]) { try { var ex = DriveApp.getFolderById(links[a.id]); if (!ex.isTrashed()) return ex; } catch (e) { /* make a new one */ } }
  var w = driveFile_(a.fileId);
  if (!w) throw new Error('The worksheet PDF is missing from Drive.');
  var folder = libNewFolder_(libTopic_(topic), a.title), base = hubClean_(a.title) || 'Worksheet';
  folder.createFile(Utilities.newBlob(w.getBlob().getBytes(), 'application/pdf', base + '.pdf'));
  var sol = driveFile_(fileIdFromLink_(a.solutionLink));
  if (sol) folder.createFile(Utilities.newBlob(sol.getBlob().getBytes(), 'application/pdf', base + ' marked solution.pdf'));
  var key = driveFile_(fileIdFromLink_(a.answerLink));
  if (key) folder.createFile(Utilities.newBlob(key.getBlob().getBytes(), 'application/pdf', base + ' answer key.pdf'));
  links[a.id] = folder.getId();
  libSaveLinks_(links);
  var it = folder_('DRAFTS').getFilesByName(stateName_(a));
  while (it.hasNext()) { var s = it.next(); if (!s.isTrashed()) { libStore_(a.id, 'notes', s.getBlob().getDataAsString()); break; } }
  libDrop_();
  return folder;
}

function api_t_saveToLibrary(token, id, topic) {
  teacher_(token);
  var a = findAssignment_(id);
  if (!a) throw new Error('That worksheet was not found.');
  var f = libKeep_(a, topic);
  return { name: f.getName(), url: f.getUrl() };
}

// Remember which worksheets were set from a library file that has no folder of its own (it could not be
// moved). Worksheets that were deleted are forgotten, and the oldest go first if it grows too big.
function libRemember_(fileId, wsId) {
  var props = PropertiesService.getScriptProperties(), src = parseJson_(props.getProperty('LIB_SRC')) || {}, live = {};
  getAssignments_().forEach(function (a) { live[a.id] = true; });
  live[wsId] = true;
  var out = {};
  Object.keys(src).forEach(function (k) { var v = src[k].filter(function (w) { return live[w]; }); if (v.length) out[k] = v; });
  delete out[fileId];
  out[fileId] = (src[fileId] || []).filter(function (w) { return live[w]; }).concat([wsId]);
  var keys = Object.keys(out);
  while (JSON.stringify(out).length > 8500 && keys.length > 1) delete out[keys.shift()];
  props.setProperty('LIB_SRC', JSON.stringify(out));
}

function newWorksheet_(meta, bytes, solBytes) {
  var title = String(meta && meta.title || '').trim();
  if (!title) throw new Error('Give the worksheet a title.');
  if (bytes.length < 5 || String.fromCharCode.apply(null, bytes.slice(0, 4)) !== '%PDF') throw new Error('That file is not a PDF.');
  ensureAssignmentCols_();
  var lock = hubLock_();
  lock.waitLock(30000);
  try {
    var id = nextId_();
    var file = folder_('WORKS').createFile(Utilities.newBlob(bytes, 'application/pdf', hubClean_(id + ' ' + title) + '.pdf'));
    var sh = hubSheet_(TABS.assignments.name);
    var row = firstFreeRow_(sh);
    var classes = cleanClasses_(meta.classes);
    var due = dueFrom_(meta.dueDate, meta.dueTime);
    var sol = solBytes ? saveSolution_({ id: id, title: title }, solBytes) : null;
    var corrDays = meta.corrDays === undefined ? 7 : Math.max(0, Math.round(Number(meta.corrDays) || 0));
    sh.getRange(row, 1, 1, 17).setValues([[id, title, classes.join(', '), file.getUrl(), meta.open !== false, false, due,
      'OK (' + (bytes.length / 1048576).toFixed(1) + ' MB)', '', '', false, false,
      sol ? sol.getUrl() : '', !!meta.autoClose, corrDays || '', meta.answersAfter !== false, '']]);
    sh.getRange(row, 5, 1, 2).insertCheckboxes();
    sh.getRange(row, 5, 1, 2).setValues([[meta.open !== false, false]]);
    var chap = String(meta.chapter || '');
    if (chap === '-' || (chap && chapterByKey_(chap))) sh.getRange(row, 18).setValue(chap);
    sh.getRange(row, 11, 1, 2).insertCheckboxes();
    sh.getRange(row, 11, 1, 2).setValues([[false, false]]);
    sh.getRange(row, 14).insertCheckboxes(); sh.getRange(row, 14).setValue(!!meta.autoClose);
    sh.getRange(row, 16).insertCheckboxes(); sh.getRange(row, 16).setValue(meta.answersAfter !== false);
    if (due) sh.getRange(row, 7).setNumberFormat(meta.dueTime ? 'ddd d mmm yyyy, h:mm am/pm' : 'ddd d mmm yyyy');
    if (meta.autoHandIn || meta.autoMark) setAuto_(id, { handIn: !!meta.autoHandIn, mark: !!meta.autoMark });
    setPractice_(id, !!meta.practice);
    return { id: id };
  } finally {
    lock.releaseLock();
  }
}

/* ---------- Automatic hand-in and marking at the due time ---------- */
//
// Per worksheet, in the WS_AUTO script property: { id: { handIn: true, mark: true } }.
// handIn: at the due time every saved draft that has writing on it is handed in for the student (and the
// worksheet closes). mark: when it closes, Claude starts marking its sample by itself.
// A timer (hubTick, every 15 minutes) does both. It is set up when the first worksheet asks for it.

function wsAuto_() { return parseJson_(PropertiesService.getScriptProperties().getProperty('WS_AUTO')) || {}; }

function setAuto_(id, patch) {
  var all = wsAuto_(), cur = all[id] || {};
  if (patch.handIn !== undefined) cur.handIn = !!patch.handIn;
  if (patch.mark !== undefined) cur.mark = !!patch.mark;
  if (cur.handIn || cur.mark) all[id] = cur; else delete all[id];
  PropertiesService.getScriptProperties().setProperty('WS_AUTO', JSON.stringify(all));
  ensureTick_(tickWanted_());
  return cur;
}

// The 15-minute timer, made when a worksheet needs it and removed when none does.
function ensureTick_(want) {
  try {
    var mine = ScriptApp.getProjectTriggers().filter(function (t) { return t.getHandlerFunction() === 'hubTick'; });
    if (want && !mine.length) ScriptApp.newTrigger('hubTick').timeBased().everyMinutes(15).create();
    if (!want) mine.forEach(function (t) { ScriptApp.deleteTrigger(t); });
    return true;
  } catch (e) { return false; }   // no permission yet: the Hub still does it whenever it is opened
}

// Runs every 15 minutes: homework linked to sub-chapters that were taught is set, then anything due happens.
function hubTick() {
  var done = [];
  try { done = done.concat(syncTaught_().map(function (m) { return m.id + ' set for ' + m.cls; })); } catch (e) { /* Live Board asked again next time */ }
  return done.concat(hubTickDue_());
}
// Each worksheet is done once per due time (DUE_DONE: { id: { due, handIn, mark } }), so changing the due date
// makes it happen again then. Also run whenever the Hub opens.
function hubTickDue_() {
  var lock = hubLock_();
  if (lock.tryLock && !lock.tryLock(1000)) return [];
  var done = [];
  try {
    var props = PropertiesService.getScriptProperties(), autos = wsAuto_(), now = new Date();
    var state = parseJson_(props.getProperty('DUE_DONE')) || {}, keep = {};
    var assigns = getAssignments_(), live = {};
    assigns.forEach(function (a) { live[a.id] = a; });
    assigns.forEach(function (a) {
      var o = autos[a.id];
      if (!o || !a.dueAt) return;
      var d = state[a.id] && state[a.id].due === a.dueAt.getTime() ? state[a.id] : { due: a.dueAt.getTime() };
      keep[a.id] = d;
      if (now < a.dueAt) return;
      if (o.handIn && !d.handIn) { d.handIn = autoHandIn_(a, now); done.push(a.id + ' hand-in ' + d.handIn); }
      if (o.mark && !d.mark) { d.mark = autoMark_(a, now); if (d.mark) done.push(a.id + ' mark ' + d.mark); }
    });
    // WS_AUTO is one property, so it must not grow for ever: a worksheet whose hand-in and marking are done leaves
    // it a month after its due time (its close is written into the sheet first), and so does a deleted worksheet.
    var gone = [];
    Object.keys(autos).forEach(function (id) {
      var a = live[id], o = autos[id], d = keep[id];
      if (!a) { gone.push(id); return; }
      if (!a.dueAt || now.getTime() - a.dueAt.getTime() < 30 * 86400000 || !d) return;
      if ((o.handIn && !d.handIn) || (o.mark && !d.mark)) return;
      if (o.handIn) { try { hubSheet_(TABS.assignments.name).getRange(a.row, 14).setValue(true); } catch (e) { return; } }
      gone.push(id); delete keep[id];
    });
    if (gone.length) {
      // Read again just before writing, so a switch changed in Edit a moment ago is kept.
      var fresh = wsAuto_();
      gone.forEach(function (id) { delete fresh[id]; });
      props.setProperty('WS_AUTO', JSON.stringify(fresh));
    }
    props.setProperty('DUE_DONE', JSON.stringify(keep));
  } finally {
    if (lock.releaseLock) lock.releaseLock();
  }
  return done;
}

// Every student with a saved draft who has not handed in gets it handed in, timed when the draft was last
// saved (never after the due time, so it counts as on time). The row is marked Auto. Its PDF is made from
// the draft by the Teacher Hub the next time it opens (api_t_pendingAuto), because pages can only be drawn
// in a browser. Returns how many were handed in.
function autoHandIn_(a, now) {
  ensureSubmissionCols_();
  var subs = submissionIndex_(), rows = [];
  studentsFor_(a).forEach(function (s) {
    if (subs[a.id + '|' + studentKey_(s)]) return;
    var f = findDraft_(a, s);
    if (!f) return;
    var d = parseJson_(f.getBlob().getDataAsString());
    if (!d || !d.pages) return;
    var strokes = 0, pages = 0;
    d.pages.forEach(function (l) { if (l && l.length) { strokes += l.length; pages++; } });
    if (!strokes) return;
    var t = Number(d.t) || 0;
    if (!t) { try { t = f.getLastUpdated().getTime(); } catch (e) { t = 0; } }
    var when = new Date(Math.min(t || a.dueAt.getTime(), a.dueAt.getTime()));
    rows.push([Utilities.formatDate(when, TZ, 'd MMM yyyy, h:mm a'), a.id, a.title, s.cls, s.reg, s.name, pages, strokes, '', '', '', '', when, '', '', '', '', 'Auto']);
  });
  if (rows.length) {
    var sh = hubSheet_(TABS.submissions.name), at = sh.getLastRow() + 1;
    sh.getRange(at, 1, rows.length, 18).setValues(rows);
  }
  return String(rows.length);
}

// Starts Claude's sample once the worksheet has closed. Returns '' to try again at the next tick, or why it
// stopped: 'fired', 'busy' (the teacher already started), 'none' (no hand-ins), 'off' (Claude not connected),
// 'late' (still waiting after 7 days), 'error'.
function autoMark_(a, now) {
  var p = PropertiesService.getScriptProperties();
  if (!(p.getProperty('CLAUDE_FIRE_URL') && p.getProperty('CLAUDE_FIRE_TOKEN'))) return 'off';
  var j = getJob_(a.id);
  if (j && /^(queued|queued_rest|marking|marking_sample|sample_ready|done)$/.test(j.status)) return 'busy';
  if (j && /^(queued_solution|drafting_solution)$/.test(j.status)) return '';
  var waited = now.getTime() - a.dueAt.getTime(), DAY = 86400000;
  if (!a.solutionLink) a.solutionLink = libSolutionPull_(a);   // another class's copy may have had it approved
  if (!a.solutionLink) return waited > 7 * DAY ? 'late' : '';          // waits for the marked solution to be approved
  var pending = pendingFor_(a).length;
  if (pending && waited < DAY) return '';                             // the Hub has not made every automatic hand-in yet
  if (!listSubmissions_(a).length) return pending ? '' : 'none';
  var sure = false;
  try { sure = trackRecord_(a.id); } catch (e) { sure = false; }
  try { fireClaude_(a, sure ? 'all' : 'sample', { note: '', onlyNew: false, auto: true }); return 'fired'; }
  catch (e) {
    setJob_(a.id, { status: 'error', message: 'Claude could not start marking at the due time. ' + String(e.message || e).replace(/^Error:\s*/, '') });
    return 'error';
  }
}

// Automatic hand-ins whose PDF has not been made yet.
function pendingFor_(a) {
  var subs = submissionIndex_(), out = [];
  studentsFor_(a).forEach(function (s) { var x = subs[a.id + '|' + studentKey_(s)]; if (x && x.pending) out.push(s); });
  return out;
}

// For the Hub: every automatic hand-in still waiting for its PDF.
function api_t_pendingAuto(token) {
  teacher_(token);
  var subs = submissionIndex_(), out = [];
  var keys = Object.keys(subs).filter(function (k) { return subs[k].pending; });
  if (!keys.length) return out;
  var byId = {};
  getAssignments_().forEach(function (a) { byId[a.id] = a; });
  getStudents_().forEach(function (s) {
    Object.keys(byId).forEach(function (id) {
      var x = subs[id + '|' + studentKey_(s)];
      if (x && x.pending) out.push({ id: id, title: byId[id].title, cls: s.cls, name: s.name, reg: s.reg });
    });
  });
  return out;
}

// The worksheet (when asked for) and the student's draft, so the Hub can draw the hand-in.
function api_t_autoDraft(token, id, cls, name, withPdf) {
  teacher_(token);
  var a = findAssignment_(id), s = hubFindStudent_(hubNormClass_(cls), name);
  if (!a || !s) throw new Error('That hand-in was not found.');
  var f = findDraft_(a, s), w = withPdf ? driveFile_(a.fileId) : null;
  return { id: a.id, cls: s.cls, name: s.name, reg: s.reg, draft: f ? f.getBlob().getDataAsString() : null,
    pdf: w ? Utilities.base64Encode(w.getBlob().getBytes()) : null };
}

// The PDF the Hub drew for an automatic hand-in. Only fills a row that is still waiting for one.
function api_t_autoPut(token, id, cls, name, pdfBase64) {
  teacher_(token);
  var a = findAssignment_(id), s = hubFindStudent_(hubNormClass_(cls), name);
  if (!a || !s) throw new Error('That hand-in was not found.');
  var sub = submissionIndex_()[a.id + '|' + studentKey_(s)];
  if (!sub || !sub.pending) return { ok: true, skipped: true };
  var bytes = Utilities.base64Decode(pdfBase64 || '');
  if (bytes.length < 5 || String.fromCharCode.apply(null, bytes.slice(0, 4)) !== '%PDF') throw new Error('That file is not a PDF.');
  var name2 = submissionName_(a, s), folder = childFolder_(folder_('SUB'), folderName_(a));
  var old = folder.getFilesByName(name2);
  while (old.hasNext()) old.next().setTrashed(true);
  var file = folder.createFile(Utilities.newBlob(bytes, 'application/pdf', name2));
  hubSheet_(TABS.submissions.name).getRange(sub.row, 9).setValue(file.getUrl());
  return { ok: true };
}

// patch: any of { open, showMarked, showAnswers, correctionsOpen, title, classes, dueDate, dueTime, clearDue,
//                  autoClose, corrDays, answersAfter }
// Switching something by hand turns off the automatic rule for it, so the teacher's choice sticks.
function api_t_update(token, id, patch) {
  teacher_(token);
  var a = findAssignment_(id);
  if (!a) throw new Error('That worksheet was not found.');
  var sh = hubSheet_(TABS.assignments.name);
  if (patch.title !== undefined) {
    var t = String(patch.title).trim();
    if (!t) throw new Error('The title cannot be empty.');
    sh.getRange(a.row, 2).setValue(t);
  }
  if (patch.classes !== undefined) sh.getRange(a.row, 3).setValue(cleanClasses_(patch.classes).join(', '));
  ensureAssignmentCols_();
  if (patch.chapter !== undefined) {
    var ck = String(patch.chapter || '');
    if (ck && ck !== '-' && !chapterByKey_(ck)) throw new Error('That chapter is not on the lesson site.');
    sh.getRange(a.row, 18).setValue(ck);
  }
  if (patch.open !== undefined) {
    sh.getRange(a.row, 5).setValue(!!patch.open);
    if (patch.open && a.autoClose && patch.autoClose === undefined) sh.getRange(a.row, 14).setValue(false);
    // Opening it again after the due time also stops the automatic hand-in, which would close it again.
    if (patch.open && a.autoHandIn && a.dueAt && new Date() > a.dueAt && patch.autoHandIn === undefined) setAuto_(a.id, { handIn: false });
  }
  if (patch.showMarked !== undefined) {
    sh.getRange(a.row, 6).setValue(!!patch.showMarked);
    if (patch.showMarked && !a.releasedAt) sh.getRange(a.row, 17).setValue(new Date());
    if (patch.showMarked) { try { libMarkedDone_(a.id); } catch (e) { /* only for marking without a sample next time */ } }
  }
  if (patch.correctionsOpen !== undefined) {
    sh.getRange(a.row, 12).setValue(!patch.correctionsOpen);
    if (patch.correctionsOpen && a.corrDays && patch.corrDays === undefined) sh.getRange(a.row, 15).setValue('');
  }
  if (patch.autoClose !== undefined) sh.getRange(a.row, 14).setValue(!!patch.autoClose);
  if (patch.autoHandIn !== undefined || patch.autoMark !== undefined) {
    setAuto_(a.id, { handIn: patch.autoHandIn, mark: patch.autoMark });
    // Handing in at the due time closes the worksheet then too.
    if (patch.autoHandIn) sh.getRange(a.row, 14).setValue(true);
  }
  if (patch.corrDays !== undefined) sh.getRange(a.row, 15).setValue(Math.max(0, Math.round(Number(patch.corrDays) || 0)) || '');
  if (patch.answersAfter !== undefined) sh.getRange(a.row, 16).setValue(!!patch.answersAfter);
  if (patch.showAnswers !== undefined) {
    if (patch.showAnswers && !a.answerLink) throw new Error('There is no answer key for this worksheet yet. Upload the return file with the answer key in it first.');
    sh.getRange(a.row, 11).setValue(!!patch.showAnswers);
    if (!patch.showAnswers && a.answersAfter && patch.answersAfter === undefined) sh.getRange(a.row, 16).setValue(false);
  }
  if (patch.icon !== undefined) {
    var ic = String(patch.icon || '');
    if (ic && WS_ICON_KEYS.indexOf(ic) < 0) throw new Error('That picture is not in the list.');
    var icons = wsIcons_(); if (ic) icons[a.id] = ic; else delete icons[a.id];
    PropertiesService.getScriptProperties().setProperty('WS_ICONS', JSON.stringify(icons));
  }
  if (patch.clearDue) sh.getRange(a.row, 7).setValue('');
  else if (patch.dueDate) {
    sh.getRange(a.row, 7).setValue(dueFrom_(patch.dueDate, patch.dueTime))
      .setNumberFormat(patch.dueTime ? 'ddd d mmm yyyy, h:mm am/pm' : 'ddd d mmm yyyy');
  }
  return true;
}

// Copies a worksheet for other classes or for next year, with its marked solution (and Claude's draft of it),
// answer key, picture and helpers (hints, formula card, notes, tools). Nothing students did is copied.
// meta: { title, open, autoClose, corrDays, answersAfter, autoHandIn, autoMark }
// copies: [{ classes: [..], dueDate: 'yyyy-MM-dd', dueTime: 'HH:mm' }], one new worksheet each.
function api_t_copyWorksheet(token, id, meta, copies) {
  teacher_(token);
  var a = findAssignment_(id);
  if (!a) throw new Error('That worksheet was not found.');
  var w = driveFile_(a.fileId);
  if (!w) throw new Error('The worksheet PDF is missing from Drive.');
  meta = meta || {};
  copies = (copies || []).filter(function (c) { return c && c.classes && c.classes.length; });
  if (!copies.length) throw new Error('Choose at least one class.');
  if (copies.length > 12) throw new Error('Make at most 12 copies at a time.');
  var bytes = w.getBlob().getBytes();
  var solF = driveFile_(fileIdFromLink_(a.solutionLink)), solBytes = solF ? solF.getBlob().getBytes() : null;
  var x = wsExtras_(a.id), icon = wsIcons_()[a.id] || '', solReview = readDraftFile_(solName_(a));
  var notesF = x.notes ? driveFile_(x.notes) : null, notesBytes = notesF ? notesF.getBlob().getBytes() : null;
  var made = [], links = libLinks_(), libFrom = links[a.id] || '', libLinked = false, notes = null;
  // Claude's notes for this worksheet (its scheme and question map), without the students' marks.
  var st = folder_('DRAFTS').getFilesByName(stateName_(a));
  while (st.hasNext()) {
    var sf = st.next();
    if (sf.isTrashed()) continue;
    var all = parseJson_(sf.getBlob().getDataAsString()) || {}, keep = {};
    LIB_NOTES_KEEP.forEach(function (k) { if (all[k]) keep[k] = all[k]; });
    if (Object.keys(keep).length) notes = JSON.stringify(keep);
    break;
  }
  copies.forEach(function (c) {
    var r = newWorksheet_({ title: meta.title || a.title, classes: c.classes, dueDate: c.dueDate || '', dueTime: c.dueTime || '',
      open: meta.open !== false, autoClose: meta.autoClose !== undefined ? !!meta.autoClose : a.autoClose,
      corrDays: meta.corrDays !== undefined ? meta.corrDays : a.corrDays, answersAfter: meta.answersAfter !== undefined ? meta.answersAfter !== false : a.answersAfter,
      autoHandIn: meta.autoHandIn !== undefined ? !!meta.autoHandIn : a.autoHandIn, autoMark: meta.autoMark !== undefined ? !!meta.autoMark : a.autoMark,
      chapter: meta.chapter !== undefined ? meta.chapter : a.chapter === '-' ? '-' : chapterOfWs_(a) }, bytes, solBytes);
    var b = findAssignment_(r.id);
    if (a.answerLink) hubSheet_(TABS.assignments.name).getRange(b.row, 10).setValue(a.answerLink);
    var y = JSON.parse(JSON.stringify(x));
    if (notesBytes) y.notes = folder_('WORKS').createFile(Utilities.newBlob(notesBytes, 'application/pdf', hubClean_(b.id + ' ' + b.title + ' - notes') + '.pdf')).getId();
    else { y.notes = ''; y.notesName = ''; }
    saveExtras_(b.id, y);
    if (icon) { var icons = wsIcons_(); icons[b.id] = icon; PropertiesService.getScriptProperties().setProperty('WS_ICONS', JSON.stringify(icons)); }
    if (solReview) writeDraftFile_(solName_(b), solReview);
    if (libFrom) { links[b.id] = libFrom; libLinked = true; }
    if (notes) folder_('DRAFTS').createFile(stateName_(b), notes, 'application/json');
    made.push({ id: b.id, title: b.title, classes: b.classes, due: b.due });
  });
  if (libLinked) libSaveLinks_(links);
  return { made: made };
}

function api_t_zip(token, id, onlyNew) {
  teacher_(token);
  var a = findAssignment_(id);
  if (!a) throw new Error('That worksheet was not found.');
  var z = zipFor_(a, !!onlyNew);
  if (!z) throw new Error(onlyNew ? 'Every hand-in has been marked already.' : 'No one has handed in this worksheet yet.');
  return { url: downloadUrl_(z.file.getId()), driveUrl: z.file.getUrl(), count: z.count, name: z.name };
}

// Every corrected copy handed in for one worksheet, in one zip.
function api_t_zipCorrections(token, id) {
  teacher_(token);
  var a = findAssignment_(id);
  if (!a) throw new Error('That worksheet was not found.');
  var folder = childFolder_(folder_('CORR'), folderName_(a));
  var blobs = [], it = folder.getFiles();
  while (it.hasNext()) { var f = it.next(); if (!f.isTrashed() && f.getMimeType() === 'application/pdf') blobs.push(f.getBlob()); }
  if (!blobs.length) throw new Error('No corrections have been handed in for this worksheet yet.');
  var name = folderName_(a) + ' - ' + blobs.length + ' corrections.zip';
  var z = folder_('ZIPS').createFile(Utilities.zip(blobs, name));
  return { url: downloadUrl_(z.getId()), driveUrl: z.getUrl(), count: blobs.length, name: name };
}

/* ---------- Marks: one row per student ---------- */

function api_t_marks(token, id) {
  teacher_(token);
  var a = findAssignment_(id);
  if (!a) throw new Error('That worksheet was not found.');
  var subs = submissionIndex_(), now = new Date();
  var fileCol = {};
  var sh = hubSheet_(TABS.submissions.name), last = sh.getLastRow();
  if (last >= 2) sh.getRange(2, 9, last - 1, 1).getValues().forEach(function (r, i) { fileCol[i + 2] = String(r[0] || ''); });
  var rows = studentsFor_(a).map(function (s) {
    var sub = subs[a.id + '|' + studentKey_(s)];
    var c = trackCell_(a, sub, now);
    return {
      cls: s.cls, reg: s.reg, name: s.name, kind: c.kind,
      status: c.kind === 'onTime' ? 'On time' : c.kind === 'late' ? c.text.split(' ').slice(0, 2).join(' ') : c.kind === 'missing' ? 'Missing' : 'Not yet',
      handedAt: sub ? sub.at : '', fileUrl: sub ? fileCol[sub.row] || '' : '', markedUrl: sub ? sub.marked : '',
      score: sub ? sub.score : '', comment: sub ? sub.comment : '',
      corr: corrState_(a, sub), corrAt: sub ? sub.corrAt : '', corrUrl: sub ? sub.corrFile : '',
      checked: sub ? sub.checked : '', blank: sub ? sub.blank : false,
      auto: !!(sub && sub.auto), pending: !!(sub && sub.pending)
    };
  });
  return { worksheet: summarise_(a, subs, now), rows: rows };
}

// rows: [{ cls, name, score, comment }]. Only students who have handed in can be given marks.
function api_t_saveMarks(token, id, rows) {
  teacher_(token);
  var a = findAssignment_(id);
  if (!a) throw new Error('That worksheet was not found.');
  ensureSubmissionCols_();
  var subs = submissionIndex_(), sh = hubSheet_(TABS.submissions.name), saved = 0, skipped = [];
  (rows || []).forEach(function (r) {
    var sub = subs[a.id + '|' + hubNormClass_(r.cls) + '|' + hubNormName_(r.name)];
    if (!sub) { skipped.push(r.name); return; }
    sh.getRange(sub.row, 11, 1, 2).setValues([[String(r.score || '').trim(), String(r.comment || '').trim()]]);
    if (r.blank !== undefined) sh.getRange(sub.row, 17).setValue(r.blank ? 'Yes' : '');
    saved++;
  });
  return { saved: saved, skipped: skipped };
}

/* ---------- One-file return ---------- */

// Finds the student a marked file belongs to, from its file name.
function studentForFile_(a, fileName, students) {
  var n = String(fileName).split('/').pop();
  var exact = hubClean_(n).toLowerCase();
  for (var i = 0; i < students.length; i++) if (submissionName_(a, students[i]).toLowerCase() === exact) return students[i];
  var best = null, bestLen = 0;
  students.forEach(function (s) {
    var p = hubClean_(fileStem_(s) + '_').toLowerCase();
    if (exact.indexOf(p) === 0 && p.length > bestLen) { best = s; bestLen = p.length; }
  });
  return best;
}

function isReportName_(name) { return /class[\s_-]*report/i.test(String(name).split('/').pop()); }
function isAnswerKeyName_(name) { return /answer[\s_-]*(key|scheme)|answers[\s_-]*explained/i.test(String(name).split('/').pop()); }

// Saves one PDF from the return file. A PDF named "Class report" becomes the class report and a PDF
// named "Answer key" becomes the answer key, which students cannot see until it is released.
// kind 'answers' saves any PDF as the answer key (the Upload answer key button).
function api_t_putMarked(token, id, fileName, pdfBase64, kind) {
  teacher_(token);
  var a = findAssignment_(id);
  if (!a) throw new Error('That worksheet was not found.');
  return putMarked_(a, fileName, pdfBase64, kind);
}

function putMarked_(a, fileName, pdfBase64, kind) {
  var base = String(fileName).split('/').pop();
  var asKey = kind === 'answers' || isAnswerKeyName_(base);
  if (asKey) base = 'Answer key - ' + hubClean_(a.title) + '.pdf';
  var folder = childFolder_(folder_('MARKED'), folderName_(a));
  var old = folder.getFilesByName(base);
  while (old.hasNext()) old.next().setTrashed(true);
  var file = folder.createFile(Utilities.newBlob(Utilities.base64Decode(pdfBase64), 'application/pdf', base));
  if (asKey) {
    ensureAssignmentCols_();
    hubSheet_(TABS.assignments.name).getRange(a.row, 10).setValue(file.getUrl());
    libStore_(a.id, 'answers', Utilities.base64Decode(pdfBase64));   // and the newest answer key
    return { answers: true, url: file.getUrl(), released: a.showAnswers };
  }
  if (isReportName_(base)) {
    ensureAssignmentCols_();
    hubSheet_(TABS.assignments.name).getRange(a.row, 9).setValue(file.getUrl());
    return { report: true, url: file.getUrl() };
  }
  var s = studentForFile_(a, base, studentsFor_(a));
  if (!s) return { matched: '', reason: 'No student in ' + (a.classes.join(', ') || 'your classes') + ' matches this file name.' };
  var sub = submissionIndex_()[a.id + '|' + studentKey_(s)];
  if (!sub) return { matched: label_(s), reason: label_(s) + ' has not handed in this worksheet, so the file was kept but not linked.' };
  hubSheet_(TABS.submissions.name).getRange(sub.row, 10).setValue(file.getUrl());
  return { matched: label_(s), ok: true };
}

// rows from scores.csv: [{ file, cls, name, score, comment }]. Matches by file name first, then by class and name.
function api_t_applyScores(token, id, rows) {
  teacher_(token);
  var a = findAssignment_(id);
  if (!a) throw new Error('That worksheet was not found.');
  return applyScores_(a, rows);
}

// keepChecked: rows for work the teacher has already checked are left as they are (Claude's uploads).
function applyScores_(a, rows, keepChecked) {
  ensureSubmissionCols_();
  var students = studentsFor_(a), subs = submissionIndex_(), sh = hubSheet_(TABS.submissions.name);
  return (rows || []).map(function (r) {
    var s = r.file ? studentForFile_(a, r.file, students) : null;
    if (!s && r.name) {
      var n = hubNormName_(r.name), c = hubNormClass_(r.cls);
      s = students.filter(function (x) { return hubNormName_(x.name) === n && (!c || x.cls === c); })[0] || null;
    }
    if (!s) return { ok: false, who: r.name || r.file, reason: 'No matching student.' };
    var sub = subs[a.id + '|' + studentKey_(s)];
    if (!sub) return { ok: false, who: label_(s), reason: 'Has not handed in this worksheet.' };
    if (keepChecked && sub.checked) return { ok: true, kept: true, who: label_(s), score: sub.score };
    sh.getRange(sub.row, 11, 1, 2).setValues([[String(r.score || '').trim(), String(r.comment || '').trim()]]);
    if (r.blank !== undefined) sh.getRange(sub.row, 17).setValue(r.blank ? 'Yes' : '');
    return { ok: true, who: label_(s), score: String(r.score || '').trim() };
  });
}

/* ---------- Tracker for the Hub ---------- */

function api_t_tracker(token) {
  teacher_(token);
  var now = new Date(), subs = submissionIndex_(), icons = wsIcons_(), seen = followSeen_(now), today = Utilities.formatDate(now, TZ, 'yyyyMMdd'), sheetAt = sheetTrackerAt_();
  var parents = parentMsgs_();
  var assigns = getAssignments_().filter(function (a) { return a.fileId && !a.practice; });
  var byClass = studentsByClass_();
  return Object.keys(byClass).sort().map(function (cls) {
    var list = assignsForClass_(assigns, cls);
    var m = trackerModel_(byClass[cls], list, subs, now, parents);
    return {
      cls: cls,
      worksheets: list.map(function (a) { return { id: a.id, title: a.title, due: a.due || (a.open ? 'No due date' : 'Closed'), dueTs: a.dueAt ? a.dueAt.getTime() : null, isDue: !a.open || !!(a.dueAt && now > a.dueAt), icon: icons[a.id] || '' }; }),
      rows: m.rows.map(function (r) {
        return { reg: r.st.reg, name: r.st.name, cells: r.cells.map(function (c) { return { kind: c.kind, text: c.text, note: c.note }; }),
          onTime: r.t.onTime, late: r.t.late, missing: r.t.missing, rate: r.rate === '' ? null : r.rate, follow: r.follow };
      }),
      handed: m.colDone, onTime: m.colOnTime,
      rate: m.classDue ? m.classOnTime / m.classDue : null,
      sheetAt: sheetAt,
      flagged: m.flagged.map(function (f) { var k = f.cls + '|' + hubNormName_(f.name); f.seen = seen[k] ? dayLabel_(seen[k]) : ''; f.seenToday = seen[k] === today; return f; })
    };
  });
}

function api_t_updateSheetTracker(token) {
  teacher_(token);
  var out = buildTracker();
  PropertiesService.getScriptProperties().setProperty('SHEET_TRACKER_AT', String(Date.now()));
  return out;
}

// When the Tracker tabs in the Sheet were last rebuilt, as "3:40 PM" (today) or "1 Oct".
function sheetTrackerAt_() {
  var t = Number(PropertiesService.getScriptProperties().getProperty('SHEET_TRACKER_AT')) || 0;
  if (!t) return '';
  var d = new Date(t), now = new Date();
  return Utilities.formatDate(d, TZ, Utilities.formatDate(d, TZ, 'yyyyMMdd') === Utilities.formatDate(now, TZ, 'yyyyMMdd') ? 'h:mm a' : 'd MMM');
}

// Students the teacher has marked as seen on the tracker: { 'cls|name': 'yyyyMMdd' }. A student stays
// seen for 7 days, then shows again if they still need a follow-up.
function dayLabel_(ymd) {
  var m = String(ymd).match(/^(\d{4})(\d{2})(\d{2})$/);
  return m ? Utilities.formatDate(new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], 4)), TZ, 'd MMM') : '';
}
function followSeen_(now) {
  var all = parseJson_(PropertiesService.getScriptProperties().getProperty('FOLLOW_SEEN')) || {}, out = {};
  var cut = Utilities.formatDate(new Date(now.getTime() - 6 * 86400000), TZ, 'yyyyMMdd');
  Object.keys(all).forEach(function (k) { if (all[k] >= cut) out[k] = all[k]; });
  return out;
}
function api_t_followSeen(token, cls, name, on) {
  teacher_(token);
  var s = hubFindStudent_(hubNormClass_(cls), name);
  if (!s) throw new Error('That student was not found.');
  var props = PropertiesService.getScriptProperties(), keep = followSeen_(new Date()), k = s.cls + '|' + hubNormName_(s.name);
  if (on) keep[k] = Utilities.formatDate(new Date(), TZ, 'yyyyMMdd'); else delete keep[k];
  props.setProperty('FOLLOW_SEEN', JSON.stringify(keep));
  return true;
}

// "Parent messaged": the count of problem worksheets starts again from now. Taking it back (on false)
// returns to the time before, so a mistaken tap loses nothing.
function api_t_parentSent(token, cls, name, on) {
  teacher_(token);
  var s = hubFindStudent_(hubNormClass_(cls), name);
  if (!s) throw new Error('That student was not found.');
  var props = PropertiesService.getScriptProperties(), all = parentMsgs_(), k = s.cls + '|' + hubNormName_(s.name), cur = all[k];
  var nowMin = Math.round(Date.now() / 60000), yearAgo = nowMin - 366 * 1440;
  if (on) all[k] = [nowMin, cur ? cur[0] : 0];
  else if (cur && cur[1]) all[k] = [cur[1], 0];
  else delete all[k];
  Object.keys(all).forEach(function (x) { if (all[x][0] < yearAgo) delete all[x]; });   // a year on, an old message no longer matters
  props.setProperty('PARENT_MSG', JSON.stringify(all));
  return { sent: !!on, at: on ? Utilities.formatDate(new Date(), TZ, 'd MMM') : '' };
}

// One student's whole record for the side panel in the tracker: every worksheet with the hand-in,
// score and comment, and their points.
function api_t_student(token, cls, name) {
  teacher_(token);
  var s = hubFindStudent_(hubNormClass_(cls), name);
  if (!s) throw new Error('That student was not found.');
  var now = new Date(), subs = submissionIndex_(), rules = rwRules_();
  var assigns = getAssignments_().filter(function (a) { return a.fileId && !a.practice && canSee_(a, s); });
  var record = assigns.map(function (a) {
    var sub = subs[a.id + '|' + studentKey_(s)], c = trackCell_(a, sub, now);
    return { id: a.id, title: a.title, due: a.due, kind: c.kind, note: c.note,
      score: sub ? sub.score : '', comment: sub ? sub.comment : '', blank: !!(sub && sub.blank),
      fileUrl: sub && sub.file ? sub.file : '', markedUrl: sub && sub.marked ? sub.marked : '',
      released: !!(sub && a.showMarked), corrAt: sub ? sub.corrAt : '' };
  }).reverse();
  var L = rwLedger_(s, getAssignments_(), subs, rwLog_(), rules, rwItems_(rules));
  var seen = followSeen_(now)[s.cls + '|' + hubNormName_(s.name)] || '';
  var pm = trackerModel_([s], assigns, subs, now, parentMsgs_()).flagged[0] || { parent: false, problems: [], text: '' };
  var since = parentSince_(parentMsgs_(), s);
  return { cls: s.cls, reg: s.reg, name: s.name, record: record,
    parent: { due: !!pm.parent, problems: pm.problems || [], text: pm.text || '', sent: since ? Utilities.formatDate(new Date(since), TZ, 'd MMM') : '', after: PARENT_AFTER },
    points: L.points, tokens: L.tokens, earned: L.earned, lost: L.lost, items: L.owned.length, stickers: L.stickers.length,
    history: L.events.slice().reverse().slice(0, 12).map(function (e) {
      return { when: e.t && e.t.getTime() > 0 ? Utilities.formatDate(e.t, TZ, 'd MMM') : '', text: e.text, points: e.points || 0, tokens: e.tokens || 0 };
    }),
    seen: seen ? dayLabel_(seen) : '' };
}

// "See it as a student": a short code the student page swaps for a Test Student session.
function api_t_previewCode(token) {
  teacher_(token);
  var t = getStudents_().filter(function (x) { return x.cls === 'TEST'; })[0];
  if (!t) throw new Error('Add a student in class TEST (for example Test Student) to the Students tab first.');
  var code = Utilities.getUuid().replace(/-/g, '').slice(0, 16);
  CacheService.getScriptCache().put('pv_' + code, JSON.stringify({ cls: t.cls, name: t.name }), 120);
  return { code: code, url: (hubUrl_() || '').replace(/\?teacher$/, '') };
}
function api_previewLogin(code) {
  var c = CacheService.getScriptCache(), v = c.get('pv_' + String(code || ''));
  if (!v) throw new Error('This preview has run out. Open it again from the Teacher Hub.');
  c.remove('pv_' + code);
  var k = JSON.parse(v), s = hubFindStudent_(hubNormClass_(k.cls), k.name);
  if (!s) throw new Error('Test Student is not on the Students tab.');
  return issueStudent_(s);
}

/* ------------------------------------------------------------------ */
/* Marking by Claude                                                   */
/* ------------------------------------------------------------------ */
//
// Mark with Claude in the Teacher Hub starts a Claude routine through its API trigger. The routine
// comes back to this web app through doPost with a private key, downloads the hand-ins, marks them,
// and puts the marked files, scores and answer key straight into the Hub. Nothing is released to
// students until the teacher releases it.

var ROUTINE_BETA = 'experimental-cc-routine-2026-04-01';

function claudeKey_() {
  var props = PropertiesService.getScriptProperties();
  var k = props.getProperty('CLAUDE_KEY');
  if (!k) { k = (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, ''); props.setProperty('CLAUDE_KEY', k); }
  return k;
}

function getJob_(id) {
  var v = PropertiesService.getScriptProperties().getProperty('JOB_' + id);
  if (!v) return null;
  try { return JSON.parse(v); } catch (e) { return null; }
}

function setJob_(id, patch) {
  var cur = getJob_(id) || {};
  Object.keys(patch).forEach(function (k) { cur[k] = patch[k]; });
  cur.updated = Utilities.formatDate(new Date(), TZ, 'd MMM, h:mm a');
  PropertiesService.getScriptProperties().setProperty('JOB_' + id, JSON.stringify(cur));
  return cur;
}

function saveSolution_(a, b64) {
  var bytes = typeof b64 === 'string' || !b64 ? Utilities.base64Decode(b64 || '') : b64;
  if (bytes.length < 5 || String.fromCharCode.apply(null, bytes.slice(0, 4)) !== '%PDF') throw new Error('The marked solution is not a PDF.');
  var name = hubClean_(a.id + ' ' + a.title + ' - marked solution') + '.pdf';
  var folder = folder_('WORKS');
  var old = folder.getFilesByName(name);
  while (old.hasNext()) old.next().setTrashed(true);
  var file = folder.createFile(Utilities.newBlob(bytes, 'application/pdf', name));
  libStore_(a.id, 'solution', bytes);          // the library keeps the newest marked solution
  return file;
}

// The teacher's own marked solution, which Claude marks against.
function api_t_uploadSolution(token, id, b64) {
  teacher_(token);
  var a = findAssignment_(id);
  if (!a) throw new Error('That worksheet was not found.');
  ensureAssignmentCols_();
  var f = saveSolution_(a, b64);
  hubSheet_(TABS.assignments.name).getRange(a.row, 13).setValue(f.getUrl());
  solutionDone_(a);
  return { url: f.getUrl() };
}

/* ---------- Claude drafts the marked solution ---------- */
//
// Claude writes the answers and the B1/M1/A1 marks on the blank worksheet as marks the teacher can change
// (solution_<id>.json in Drafts). The teacher checks them in the checking screen and saves, which makes the
// marked solution PDF that Claude then marks against. Nothing is marked until the teacher has saved it.

function solName_(a) { return hubClean_('solution_' + a.id) + '.json'; }

// Once the teacher has a marked solution, a finished drafting job is cleared so marking can start.
function solutionDone_(a) {
  var j = getJob_(a.id);
  if (j && /^(solution_ready|queued_solution|drafting_solution)$/.test(j.status)) PropertiesService.getScriptProperties().deleteProperty('JOB_' + a.id);
  if (j && j.status === 'error' && j.phase === 'solution') PropertiesService.getScriptProperties().deleteProperty('JOB_' + a.id);
}

function api_t_draftSolution(token, id, note) {
  teacher_(token);
  var a = findAssignment_(id);
  if (!a) throw new Error('That worksheet was not found.');
  var j = getJob_(id);
  if (j && /^(queued|queued_rest|marking|marking_sample|queued_solution|drafting_solution)$/.test(j.status)) throw new Error('Claude is already working on this worksheet.');
  return fireClaude_(a, 'solution', { note: note });
}

// The checking screen in solution mode: the blank worksheet with Claude's answers as marks.
function api_t_solution(token, id) {
  teacher_(token);
  var a = findAssignment_(id);
  if (!a) throw new Error('That worksheet was not found.');
  var w = driveFile_(a.fileId);
  if (!w) throw new Error('The worksheet PDF is missing from Drive.');
  var review = parseJson_(readDraftFile_(solName_(a)));
  if (!review) throw new Error('Claude has not drafted a marked solution for this worksheet yet.');
  return { id: a.id, title: a.title, cls: '', name: 'Marked solution', reg: '', solution: true,
    fileName: w.getName(), b64: Utilities.base64Encode(w.getBlob().getBytes()),
    review: review, layout: null, score: '', comment: '', markedUrl: a.solutionLink, checked: review.savedAt || '', released: false };
}

// The teacher has checked Claude's draft: the PDF becomes the marked solution.
function api_t_saveSolution(token, id, pdfBase64, review) {
  teacher_(token);
  var a = findAssignment_(id);
  if (!a) throw new Error('That worksheet was not found.');
  ensureAssignmentCols_();
  var f = saveSolution_(a, pdfBase64);
  hubSheet_(TABS.assignments.name).getRange(a.row, 13).setValue(f.getUrl());
  review = review || {};
  review.savedAt = Utilities.formatDate(new Date(), TZ, 'd MMM yyyy, h:mm a');
  writeDraftFile_(solName_(a), JSON.stringify(review));
  solutionDone_(a);
  return { url: f.getUrl(), savedAt: review.savedAt };
}

function api_t_claude(token) {
  teacher_(token);
  var p = PropertiesService.getScriptProperties();
  return { connected: !!(p.getProperty('CLAUDE_FIRE_URL') && p.getProperty('CLAUDE_FIRE_TOKEN')), hasLink: !!webAppUrl_() && !/\/dev$/.test(webAppUrl_()) };
}

// The URL and token from the routine's API trigger (claude.ai/code/routines).
function api_t_setClaude(token, fireUrl, fireToken) {
  teacher_(token);
  var f = parseFire_(fireUrl, fireToken), u = f.url, t = f.token;
  if (!u) throw new Error('No routine link was found in what you pasted (' + (String(fireUrl || '').trim().slice(0, 60) || 'empty') + '). Copy the URL from the API trigger box of the Worksheet Hub marking routine. It starts with https://api.anthropic.com/v1/claude_code/routines/ and ends with /fire. Pasting the whole sample curl command also works.');
  if (!t) throw new Error('No token was found. In the same API trigger box, press Generate token and paste the token that starts with sk-ant-.');
  var p = PropertiesService.getScriptProperties();
  p.setProperty('CLAUDE_FIRE_URL', u);
  p.setProperty('CLAUDE_FIRE_TOKEN', t);
  claudeKey_();
  return true;
}

// Finds the routine link and the token in whatever was pasted: the bare URL, the URL with spaces, quotes or a
// slash at the end, the routine's page address, the whole sample curl command, or the two boxes swapped.
function parseFire_(fireUrl, fireToken) {
  var raw = String(fireUrl || '') + ' ' + String(fireToken || '');
  var m = raw.match(/https:\/\/api\.anthropic\.com\/v1\/claude_code\/routines\/([A-Za-z0-9_-]+)\/fire/);
  var id = m ? m[1] : (raw.match(/\btrig_[A-Za-z0-9]{6,}/) || [])[0];
  var tok = (raw.match(/sk-ant-[A-Za-z0-9_-]{20,}/) || [])[0];
  if (!tok) {
    var b = raw.match(/Bearer\s+([A-Za-z0-9._-]{20,})/i);
    if (b) tok = b[1];
    else {
      var t = String(fireToken || '').trim().replace(/^["']+|["']+$/g, '');
      if (t.length >= 20 && !/\s|https?:/i.test(t)) tok = t;
    }
  }
  return { url: id ? 'https://api.anthropic.com/v1/claude_code/routines/' + id + '/fire' : '', token: tok || '' };
}

function fireClaude_(a, phase, opts) {
  var p = PropertiesService.getScriptProperties();
  var url = p.getProperty('CLAUDE_FIRE_URL'), tok = p.getProperty('CLAUDE_FIRE_TOKEN');
  if (!url || !tok) throw new Error('Claude marking is not connected yet. Open Claude marking at the top of the Hub.');
  var hub = webAppUrl_();
  if (!hub || /\/dev$/.test(hub)) throw new Error('Set the web app link first (Worksheet Hub > Set the web app link in the Sheet).');
  var job = { hub: hub, key: claudeKey_(), id: a.id, title: a.title, phase: phase,
    note: String(opts.note || '').slice(0, 2000), onlyNew: !!opts.onlyNew };
  var text = 'Worksheet Hub marking job. ' + JSON.stringify(job);
  var res = UrlFetchApp.fetch(url, {
    method: 'post', contentType: 'application/json', muteHttpExceptions: true,
    headers: { 'Authorization': 'Bearer ' + tok, 'anthropic-beta': ROUTINE_BETA, 'anthropic-version': '2023-06-01' },
    payload: JSON.stringify({ text: text })
  });
  var code = res.getResponseCode(), body = {};
  try { body = JSON.parse(res.getContentText()); } catch (e) { body = {}; }
  if (code < 200 || code >= 300) {
    var why = body.error && body.error.message ? body.error.message : 'error ' + code;
    throw new Error('Claude could not be started (' + why + '). Check the routine token in Claude marking.');
  }
  return setJob_(a.id, { status: phase === 'rest' ? 'queued_rest' : phase === 'solution' ? 'queued_solution' : 'queued', phase: phase, message: '',
    sessionUrl: body.claude_code_session_url || '', note: job.note, onlyNew: job.onlyNew, auto: !!opts.auto,
    started: Utilities.formatDate(new Date(), TZ, 'd MMM, h:mm a') });
}

// opts: { sample: true (check one first) or false, onlyNew, note }
function api_t_markWithClaude(token, id, opts) {
  teacher_(token);
  opts = opts || {};
  var a = findAssignment_(id);
  if (!a) throw new Error('That worksheet was not found.');
  if (!a.solutionLink) throw new Error('Upload your marked solution first. Claude marks against it.');
  var subs = listSubmissions_(a);
  if (!subs.length) throw new Error('No one has handed in this worksheet yet.');
  if (opts.onlyNew && !subs.some(function (x) { return !x.marked; })) throw new Error('Every hand-in has been marked already.');
  var j = getJob_(id);
  if (j && /^(queued_solution|drafting_solution)$/.test(j.status) && !opts.force) throw new Error('Claude is still drafting the marked solution for this worksheet.');
  if (j && /^(queued|queued_rest|marking|marking_sample)$/.test(j.status) && !opts.force) throw new Error('Claude is already marking this worksheet.');
  var pend = pendingFor_(a).length;
  if (pend) throw new Error(rwN_(pend, 'automatic hand-in is', 'automatic hand-ins are') + ' still being made into PDFs. Keep the Hub open for a minute and try again.');
  return fireClaude_(a, opts.sample === false ? 'all' : 'sample', opts);
}

// After the sample: mark the rest, or mark the sample again with the teacher's note.
function api_t_claudeNext(token, id, action, note) {
  teacher_(token);
  var a = findAssignment_(id);
  if (!a) throw new Error('That worksheet was not found.');
  var j = getJob_(id);
  if (!j || j.status !== 'sample_ready') throw new Error('There is no sample waiting for you on this worksheet.');
  var pend = pendingFor_(a).length;
  if (pend && action !== 'redo') throw new Error(rwN_(pend, 'automatic hand-in is', 'automatic hand-ins are') + ' still being made into PDFs. Keep the Hub open for a minute and try again.');
  return fireClaude_(a, action === 'redo' ? 'sample' : 'rest', { note: note, onlyNew: j.onlyNew });
}

function api_t_clearJob(token, id) {
  teacher_(token);
  PropertiesService.getScriptProperties().deleteProperty('JOB_' + id);
  return true;
}

/* ---------- The marking link Claude uses (doPost) ---------- */

function hubDoPost_(e) {
  var out;
  try {
    var req = JSON.parse(e && e.postData ? e.postData.contents : '{}');
    out = req && req.api === 'lb_class' ? lbClass_(req) : claudeApi_(req);
  } catch (err) {
    out = { ok: false, error: String(err && err.message || err) };
  }
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}

/* ------------------------------------------------------------------ */
/* Live Board link                                                     */
/* ------------------------------------------------------------------ */
// Live Board's private call (Live Board > 5 links the two). For one class it gives each student's
// points, tokens, latest points and homework, so the Live Board student home and class view can show them.
// The key is this sheet's ID: only the teacher's Live Board sheet holds it, and students never see it.
function lbClass_(req) {
  var props = PropertiesService.getScriptProperties();
  var ssId = hubSheetId_();
  if (!req.key || String(req.key) !== ssId) throw new Error('Wrong key.');
  var cls = hubNormClass_(req.cls);
  var studs = getStudents_().filter(function (s) { return s.cls === cls; });
  var rules = rwRules_(), log = rwLog_(), assigns = getAssignments_(), subs = submissionIndex_(), items = rwItems_(rules);
  var probe = { cls: cls, name: '' };
  CH_MEMO_ = {};
  var work = assigns.filter(function (a) { return a.fileId && canSee_(a, probe); });
  var keepW = {};
  work.filter(function (a) { return !a.practice; }).slice(-60).concat(work.filter(function (a) { return a.practice; }).slice(-30)).forEach(function (a) { keepW[a.id] = 1; });
  work = work.filter(function (a) { return keepW[a.id]; });
  var now = Date.now();
  return {
    ok: true, cls: cls, at: now,
    work: work.map(function (a) {
      return { id: a.id, title: a.title, due: a.due, dueTs: a.dueAt ? a.dueAt.getTime() : null, open: a.open, chapter: chapterOfWs_(a), practice: !!a.practice };
    }),
    students: studs.map(function (s) {
      var L = rwLedger_(s, assigns, subs, log, rules, items);
      var hw = '', sc = {}, late = [];
      work.forEach(function (a, i) {
        var sub = subs[a.id + '|' + studentKey_(s)];
        var released = !!(sub && a.showMarked && (sub.marked || sub.score || sub.comment));
        hw += released ? 'm' : sub ? 's' : a.open ? 't' : 'x';
        if (released && sub.score) sc[i] = sub.score;
        if (sub && a.dueAt && sub.first instanceof Date && sub.first > a.dueAt) late.push(i);
      });
      var recent = L.events.filter(function (e) { return e.points && !e.floor; }).slice(-4).reverse().map(function (e) {
        return { when: e.t && e.t.getTime() > 0 ? Utilities.formatDate(e.t, TZ, 'd MMM') : '', text: e.text, points: e.points };
      });
      return { name: s.name, reg: s.reg, points: L.points, tokens: L.tokens, earned: L.earned, hw: hw, sc: sc, late: late, recent: recent };
    })
  };
}

function stateName_(a) { return hubClean_('claude-state_' + a.id) + '.json'; }

function claudeApi_(req) {
  var key = PropertiesService.getScriptProperties().getProperty('CLAUDE_KEY');
  if (!key || !req || String(req.key || '') !== key) throw new Error('Wrong key.');
  if (req.action === 'ping') return { ok: true, title: APP_TITLE };
  var a = findAssignment_(String(req.id || ''));
  if (!a) throw new Error('No worksheet ' + req.id + '.');
  var subs = listSubmissions_(a);
  if (req.action === 'job') {
    var w = driveFile_(a.fileId), sol = driveFile_(fileIdFromLink_(a.solutionLink));
    return { ok: true, job: getJob_(a.id), worksheet: { id: a.id, title: a.title, classes: a.classes, due: a.due,
      file: w ? { fileId: w.getId(), name: '_worksheet.pdf' } : null,
      solution: sol ? { fileId: sol.getId(), name: '_marked solution.pdf' } : null },
      students: packInfo_(a).students,
      submissions: subs.map(function (x) {
        var f = driveFile_(x.fileId);
        return { fileId: x.fileId, name: f ? f.getName() : '', cls: x.cls, reg: x.reg, student: x.name, handedAt: x.handedAt,
          pages: x.pages, strokes: x.strokes, blank: x.strokes === 0, marked: x.marked, score: x.score };
      }) };
  }
  if (req.action === 'file') {
    var ok = subs.some(function (x) { return x.fileId === req.fileId; }) || req.fileId === a.fileId || req.fileId === fileIdFromLink_(a.solutionLink);
    if (!ok) throw new Error('That file is not part of this worksheet.');
    var f = driveFile_(req.fileId);
    if (!f) throw new Error('File not found.');
    return { ok: true, name: f.getName(), b64: Utilities.base64Encode(f.getBlob().getBytes()) };
  }
  if (req.action === 'put') {
    if (req.kind !== 'answers') {
      var cs = checkedSub_(a, String(req.name || ''));
      if (cs) return { ok: true, result: { ok: true, kept: true, matched: cs } };
    }
    var r = putMarked_(a, String(req.name || ''), String(req.b64 || ''), req.kind === 'answers' ? 'answers' : '');
    return { ok: true, result: r };
  }
  if (req.action === 'scores') return { ok: true, result: applyScores_(a, req.rows || [], true) };
  if (req.action === 'checked') {
    // The scripts the teacher has checked in the Hub, with their marks, so Claude can follow the teacher's changes.
    var studs = studentsFor_(a), outc = [];
    subs.forEach(function (x) {
      if (!x.checked) return;
      var who = studs.filter(function (s) { return s.cls === x.cls && hubNormName_(s.name) === hubNormName_(x.name); })[0];
      var f = driveFile_(x.fileId);
      if (!who || !f) return;
      outc.push({ name: f.getName(), student: who.name, score: x.score, review: parseJson_(readDraftFile_(reviewName_(a, who))) });
    });
    return { ok: true, checked: outc };
  }
  if (req.action === 'review_put') {
    // The marks as data, so the teacher can check them and erase or change any of them in the Hub.
    if (req.layout) { writeDraftFile_(layoutName_(a), String(req.layout)); return { ok: true, result: { ok: true } }; }
    // Claude's draft of the marked solution: answers and marks as data on the blank worksheet.
    if (req.solution) { writeDraftFile_(solName_(a), String(req.review || '')); return { ok: true, result: { ok: true, solution: true } }; }
    var st = studentForFile_(a, String(req.name || ''), studentsFor_(a));
    if (!st) return { ok: true, result: { ok: false, reason: 'No student matches this file name.' } };
    var sb = submissionIndex_()[a.id + '|' + studentKey_(st)];
    if (sb && sb.checked) return { ok: true, result: { ok: true, kept: true } };
    writeDraftFile_(reviewName_(a, st), String(req.review || ''));
    return { ok: true, result: { ok: true } };
  }
  if (req.action === 'status') {
    var allowed = /^(marking_sample|sample_ready|marking|done|error|drafting_solution|solution_ready)$/;
    if (!allowed.test(String(req.status))) throw new Error('Unknown status.');
    // A script property holds at most 9 kB, so the message and the checks list are kept short.
    var checks = (req.checks || []).map(function (c) { return String(c).slice(0, 240); });
    if (checks.length > 20) checks = checks.slice(0, 19).concat(['And ' + (checks.length - 19) + ' more. Claude listed them all at the end of its session.']);
    return { ok: true, job: setJob_(a.id, { status: String(req.status), message: String(req.message || '').slice(0, 1500),
      sampleFile: String(req.sampleFile || ''), checks: checks }) };
  }
  if (req.action === 'state_get' || req.action === 'state_put') {
    var folder = folder_('DRAFTS'), name = stateName_(a), it = folder.getFilesByName(name), cur = null;
    while (it.hasNext()) { var g = it.next(); if (!g.isTrashed()) { cur = g; break; } }
    if (req.action === 'state_get') return { ok: true, state: cur ? cur.getBlob().getDataAsString() : null };
    var text = String(req.state || '');
    if (cur) cur.setContent(text); else folder.createFile(name, text, 'application/json');
    libStore_(a.id, 'notes', text);              // Claude's scheme and notes, without the students' marks
    return { ok: true };
  }
  throw new Error('Unknown action.');
}


/* ------------------------------------------------------------------ */
/* Checking and hand marking in the Hub                                */
/* ------------------------------------------------------------------ */
//
// The teacher opens any hand-in in the Hub, sees Claude's ticks and crosses as marks that can be erased,
// moved or added to, changes any mark, and saves. The Hub builds the marked PDF on the device and sends
// it here with the marks as data, so the script can be opened and changed again later.

function reviewName_(a, s) { return hubClean_('review_' + a.id + '_' + s.cls + '_' + s.name) + '.json'; }
function layoutName_(a) { return hubClean_('layout_' + a.id) + '.json'; }

function draftFile_(name) {
  var it = folder_('DRAFTS').getFilesByName(name);
  while (it.hasNext()) { var f = it.next(); if (!f.isTrashed()) return f; }
  return null;
}

function readDraftFile_(name) {
  var f = draftFile_(name);
  return f ? f.getBlob().getDataAsString() : null;
}

function writeDraftFile_(name, text) {
  var f = draftFile_(name);
  if (f) f.setContent(text); else folder_('DRAFTS').createFile(name, text, 'application/json');
}

function parseJson_(t) { try { return t ? JSON.parse(t) : null; } catch (e) { return null; } }

// The student a file name belongs to, if the teacher has already checked their marking.
function checkedSub_(a, fileName) {
  var st = studentForFile_(a, fileName, studentsFor_(a));
  if (!st) return '';
  var sub = submissionIndex_()[a.id + '|' + studentKey_(st)];
  return sub && sub.checked ? label_(st) : '';
}

function reviewTarget_(id, cls, name) {
  var a = findAssignment_(id);
  if (!a) throw new Error('That worksheet was not found.');
  var s = hubFindStudent_(hubNormClass_(cls), name);
  if (!s) throw new Error('That student was not found.');
  var sub = submissionIndex_()[a.id + '|' + studentKey_(s)];
  if (!sub) throw new Error(label_(s) + ' has not handed in this worksheet.');
  if (sub.pending) throw new Error('The automatic hand-in for ' + label_(s) + ' is still being made into a PDF. Try again in a minute.');
  var f = driveFile_(fileIdFromLink_(sub.file));
  if (!f) throw new Error('The hand-in file for ' + label_(s) + ' is missing from Drive.');
  return { a: a, s: s, sub: sub, file: f };
}

// Everything the checking screen needs for one student: their hand-in, and the marks as data.
function api_t_review(token, id, cls, name) {
  teacher_(token);
  var t = reviewTarget_(id, cls, name);
  return {
    id: t.a.id, title: t.a.title, cls: t.s.cls, name: t.s.name, reg: t.s.reg,
    fileName: t.file.getName(), b64: Utilities.base64Encode(t.file.getBlob().getBytes()),
    review: parseJson_(readDraftFile_(reviewName_(t.a, t.s))),
    layout: parseJson_(readDraftFile_(layoutName_(t.a))),
    score: t.sub.score, comment: t.sub.comment, markedUrl: t.sub.marked, checked: t.sub.checked,
    released: !!t.a.showMarked
  };
}

// review: { score, comment, items, objects, ... } as built by the Hub.
function api_t_saveReview(token, id, cls, name, pdfBase64, review) {
  teacher_(token);
  var t = reviewTarget_(id, cls, name);
  review = review || {};
  var r = putMarked_(t.a, t.file.getName(), pdfBase64, '');
  if (!r.ok) throw new Error(r.reason || 'The marked file could not be linked.');
  ensureSubmissionCols_();
  var now = new Date();
  var sh = hubSheet_(TABS.submissions.name);
  sh.getRange(t.sub.row, 11, 1, 2).setValues([[String(review.score || '').trim(), String(review.comment || '').trim()]]);
  sh.getRange(t.sub.row, 16).setValue(now);
  review.savedAt = Utilities.formatDate(now, TZ, 'd MMM yyyy, h:mm a');
  writeDraftFile_(reviewName_(t.a, t.s), JSON.stringify(review));
  var sub = submissionIndex_()[t.a.id + '|' + studentKey_(t.s)];
  return { markedUrl: sub.marked, score: sub.score, checked: sub.checked };
}

// Takes back "checked", so Claude may mark this student again.
function api_t_uncheck(token, id, cls, name) {
  teacher_(token);
  var t = reviewTarget_(id, cls, name);
  hubSheet_(TABS.submissions.name).getRange(t.sub.row, 16).setValue('');
  return true;
}

/* ------------------------------------------------------------------ */
/* Points, the avatar shop and the night market                        */
/* ------------------------------------------------------------------ */
//
// Students earn points for each worksheet once the marking is given back. Points are worked out
// afresh from the Submissions tab every time, so changing a score or a due date changes the points.
// Points buy clothes and accessories for the student's avatar, or are changed into tokens, which buy
// real prizes at the night market at the end of term. The balance never goes below zero.
// Everything a student spends is written to the "Rewards log" tab.

var RW_TABS = {
  log: { name: 'Rewards log', headers: ['Time', 'Class', 'Reg No', 'Name', 'What', 'Item', 'Points', 'Tokens', 'Ticket', 'Collected', 'Note'] },
  avatars: { name: 'Avatars', headers: ['Class', 'Reg No', 'Name', 'Outfit', 'Updated', 'Theme'] },
  market: { name: 'Night market', headers: ['ID', 'Prize', 'Picture', 'Tokens', 'How many (blank = no limit)', 'On sale'] }
};

// How many points each thing is worth. The teacher changes these in the Hub (Rewards).
var RW_RULES = { onTime: 10, late: 10, top: 30, mid: 20, low: 10, blank: 20, topPct: 85, midPct: 70, lowPct: 50, perToken: 20, priceScale: 1, from: '', board: 'class',
  daily: 2, dailyFun: 1, questOnTime: 20, questQuiz: 10 };
// What students spend points or tokens on. Everything else in the Rewards log (Teacher, Daily) is earned.
var RW_SPEND = { Shop: 1, Tokens: 1, Market: 1, Sticker: 1, Theme: 1, Hint: 1 };
// Colour themes for the homework page: [id, name, price in points]. Sky is free.
var RW_THEMES = [['sky', 'Sky', 0], ['ocean', 'Ocean', 60], ['forest', 'Rainforest', 80], ['sunset', 'Sunset', 80], ['candy', 'Candy floss', 100],
  ['lava', 'Lava', 120], ['galaxy', 'Galaxy', 150], ['aurora', 'Aurora', 200], ['gold', 'Gold', 300]];

// The shop: [id, name, what it is, rarity, price in points]. Free things everyone has.
var RW_ITEMS = [
  ['hair_short', 'Short', 'hair', 'free', 0], ['hair_spiky', 'Spiky', 'hair', 'free', 0], ['hair_bob', 'Bob', 'hair', 'free', 0],
  ['hair_long', 'Long', 'hair', 'free', 0], ['hair_ponytail', 'Ponytail', 'hair', 'free', 0], ['hair_buns', 'Space buns', 'hair', 'free', 0],
  ['hair_afro', 'Afro', 'hair', 'free', 0], ['hair_buzz', 'Buzz cut', 'hair', 'free', 0], ['hair_swoop', 'Swoop', 'hair', 'free', 0], ['hair_none', 'No hair', 'hair', 'free', 0],
  ['face_smile', 'Smile', 'face', 'free', 0], ['face_grin', 'Grin', 'face', 'free', 0], ['face_calm', 'Happy', 'face', 'free', 0],
  ['top_tee', 'Plain tee', 'top', 'free', 0], ['bot_pants', 'Plain trousers', 'bottom', 'free', 0],
  ['shoe_white', 'White trainers', 'shoes', 'free', 0], ['shoe_black', 'Black trainers', 'shoes', 'free', 0],
  ['face_wink', 'Wink', 'face', 'common', 30], ['face_freckles', 'Freckles', 'face', 'common', 30], ['face_sleepy', 'Sleepy', 'face', 'common', 40],
  ['face_tongue', 'Cheeky', 'face', 'common', 40], ['face_shocked', 'Shocked', 'face', 'common', 40], ['face_determined', 'Determined', 'face', 'rare', 70],
  ['face_cool', 'Cool', 'face', 'rare', 80], ['face_hearts', 'Heart eyes', 'face', 'rare', 90], ['face_stars', 'Star eyes', 'face', 'epic', 150], ['face_robot', 'Robot', 'face', 'epic', 180],
  ['hat_cap', 'Baseball cap', 'hat', 'common', 40], ['hat_backcap', 'Backwards cap', 'hat', 'common', 40], ['hat_beanie', 'Beanie', 'hat', 'common', 50],
  ['hat_bucket', 'Bucket hat', 'hat', 'common', 50], ['hat_party', 'Party hat', 'hat', 'common', 50], ['hat_straw', 'Straw hat', 'hat', 'common', 50],
  ['hat_cat', 'Cat ears', 'hat', 'rare', 80], ['hat_bunny', 'Bunny ears', 'hat', 'rare', 80], ['hat_headphones', 'Headphones', 'hat', 'rare', 90],
  ['hat_chef', 'Chef hat', 'hat', 'rare', 90], ['hat_grad', 'Graduation cap', 'hat', 'rare', 100], ['hat_cone', 'Traffic cone', 'hat', 'rare', 100],
  ['hat_flowers', 'Flower crown', 'hat', 'rare', 110], ['hat_cowboy', 'Cowboy hat', 'hat', 'rare', 110], ['hat_top', 'Top hat', 'hat', 'epic', 150],
  ['hat_pirate', 'Pirate hat', 'hat', 'epic', 160], ['hat_witch', 'Wizard hat', 'hat', 'epic', 170], ['hat_viking', 'Viking helmet', 'hat', 'epic', 180],
  ['hat_propeller', 'Propeller cap', 'hat', 'epic', 200], ['hat_durian', 'Durian helmet', 'hat', 'epic', 220], ['hat_halo', 'Halo', 'hat', 'legendary', 300],
  ['hat_crown', 'Crown', 'hat', 'legendary', 350], ['hat_astro', 'Space helmet', 'hat', 'legendary', 380], ['hat_atom', 'Atom orbit', 'hat', 'legendary', 400],
  ['eye_round', 'Round glasses', 'eyes', 'common', 40], ['eye_shades', 'Sunglasses', 'eyes', 'common', 50], ['eye_moustache', 'Moustache', 'eyes', 'common', 50],
  ['eye_patch', 'Eye patch', 'eyes', 'common', 50], ['eye_3d', '3D glasses', 'eyes', 'rare', 80], ['eye_goggles', 'Lab goggles', 'eyes', 'rare', 90],
  ['eye_star', 'Star glasses', 'eyes', 'epic', 150], ['eye_visor', 'Robot visor', 'eyes', 'epic', 200],
  ['top_striped', 'Striped tee', 'top', 'common', 40], ['top_hoodie', 'Hoodie', 'top', 'common', 60], ['top_denim', 'Denim jacket', 'top', 'rare', 90],
  ['top_jersey', 'Sports jersey', 'top', 'rare', 90], ['top_hawaii', 'Flower shirt', 'top', 'rare', 100], ['top_tiedye', 'Tie-dye tee', 'top', 'rare', 110],
  ['top_labcoat', 'Lab coat', 'top', 'rare', 120], ['top_varsity', 'Varsity jacket', 'top', 'epic', 150], ['top_galaxy', 'Galaxy tee', 'top', 'epic', 180],
  ['top_tux', 'Tuxedo', 'top', 'epic', 200], ['top_gold', 'Gold element tee', 'top', 'epic', 220], ['top_space', 'Space suit', 'top', 'legendary', 320],
  ['bot_shorts', 'Shorts', 'bottom', 'common', 30], ['bot_jeans', 'Jeans', 'bottom', 'common', 40], ['bot_track', 'Track pants', 'bottom', 'common', 50],
  ['bot_cargo', 'Cargo pants', 'bottom', 'common', 50], ['bot_plaid', 'Tartan trousers', 'bottom', 'rare', 90], ['bot_camo', 'Camo trousers', 'bottom', 'rare', 90],
  ['bot_galaxy', 'Galaxy leggings', 'bottom', 'epic', 160], ['bot_space', 'Space suit trousers', 'bottom', 'epic', 180],
  ['shoe_slippers', 'Flip-flops', 'shoes', 'common', 30], ['shoe_boots', 'Boots', 'shoes', 'common', 50], ['shoe_rain', 'Rain boots', 'shoes', 'common', 50],
  ['shoe_hightop', 'High-tops', 'shoes', 'rare', 90], ['shoe_light', 'Light-up trainers', 'shoes', 'epic', 180], ['shoe_gold', 'Gold trainers', 'shoes', 'legendary', 300],
  ['back_pack', 'Backpack', 'back', 'common', 60], ['back_guitar', 'Guitar', 'back', 'rare', 110], ['back_shell', 'Turtle shell', 'back', 'rare', 110],
  ['back_cape', 'Hero cape', 'back', 'rare', 120], ['back_butterfly', 'Butterfly wings', 'back', 'epic', 180], ['back_angel', 'Angel wings', 'back', 'epic', 220],
  ['back_jet', 'Jetpack', 'back', 'legendary', 320], ['back_dragon', 'Dragon wings', 'back', 'legendary', 400],
  ['hand_icecream', 'Ice cream', 'hand', 'common', 40], ['hand_balloon', 'Heart balloon', 'hand', 'common', 50], ['hand_magnifier', 'Magnifying glass', 'hand', 'common', 60],
  ['hand_umbrella', 'Umbrella', 'hand', 'rare', 80], ['hand_foam', 'Foam finger', 'hand', 'rare', 80], ['hand_flask', 'Bubbling flask', 'hand', 'epic', 150],
  ['hand_wand', 'Magic wand', 'hand', 'epic', 170], ['hand_sword', 'Plasma sword', 'hand', 'legendary', 300],
  ['pet_duck', 'Duck', 'pet', 'rare', 120], ['pet_cat', 'Cat', 'pet', 'rare', 140], ['pet_dog', 'Puppy', 'pet', 'rare', 140], ['pet_penguin', 'Penguin', 'pet', 'epic', 180],
  ['pet_axolotl', 'Axolotl', 'pet', 'epic', 200], ['pet_robot', 'Robot buddy', 'pet', 'epic', 220], ['pet_planet', 'Pocket planet', 'pet', 'legendary', 350],
  ['pet_dragon', 'Baby dragon', 'pet', 'legendary', 450]
];
var RW_OUTFIT_KEYS = { skin: 'c', hair: 'hair', hairColor: 'c', face: 'face', top: 'top', topColor: 'c', bottom: 'bottom', bottomColor: 'c', shoes: 'shoes', hat: 'hat', eyes: 'eyes', back: 'back', hand: 'hand', pet: 'pet' };
var RW_DEFAULT_PRIZES = [
  ['P1', 'Chupa Chups', 'lollipop', 2, 40], ['P2', 'Gummy bears', 'gummies', 3, 20], ['P3', 'Sticker sheet', 'stickers', 3, 20], ['P4', 'Popcorn', 'popcorn', 4, 15],
  ['P5', 'Keychain', 'keychain', 5, 10], ['P6', 'Mystery box', 'mystery', 6, 10], ['P7', 'Plush bear', 'plushie', 8, 5], ['P8', 'Chagee milk tea', 'milktea', 15, 5]
];
// Stickers students show in a speech bubble at the night market: [id, words on it, price in tokens].
var RW_STICKERS = [
  ['st_lol', 'LOL', 1], ['st_cry', 'Waaah', 1], ['st_wow', 'Wah!', 1], ['st_love', 'Love it', 1], ['st_angry', 'Grrr', 1],
  ['st_sleep', 'Zzz', 1], ['st_think', 'Hmm...', 1], ['st_cool', 'GG', 2], ['st_thumbs', 'Nice!', 2], ['st_party', 'Yay!', 2],
  ['st_fire', 'On fire!', 2], ['st_brain', 'Big brain', 2], ['st_eureka', 'Eureka!', 2], ['st_cat', 'Meow?', 2], ['st_ghost', 'Boo!', 2],
  ['st_alamak', 'Alamak!', 2], ['st_durian', 'Durian?', 3], ['st_milktea', 'Shiok!', 3], ['st_dance', 'Dance!', 3], ['st_champ', 'Champion', 3]
];
var RW_ARTS = ['lollipop', 'milktea', 'gummies', 'stickers', 'keychain', 'popcorn', 'eraser', 'pen', 'chocolate', 'mystery', 'ticket', 'candyfloss', 'icecream', 'plushie', 'chips', 'drink', 'cookie'];

function rwN_(n, one, many) { return n + ' ' + (n === 1 ? one : many); }
function isYes_(v) { return v === true || /^(yes|y|true|1|x|✓)$/i.test(String(v == null ? '' : v).trim()); }

function rwRules_() {
  var r = {}, k, saved = parseJson_(PropertiesService.getScriptProperties().getProperty('RW_RULES')) || {};
  for (k in RW_RULES) r[k] = saved[k] !== undefined ? saved[k] : RW_RULES[k];
  r.questFrom = rwQuestFrom_();
  return r;
}
// Weekly quests count from the week they first appeared, so older weeks do not suddenly give points.
function rwQuestFrom_() {
  var props = PropertiesService.getScriptProperties(), q = props.getProperty('QUEST_FROM');
  if (!q) { q = weekOf_(new Date()); props.setProperty('QUEST_FROM', q); }
  return q;
}
// The market opens when the teacher turns it on, or by itself at the time set for the countdown.
function rwMarketState_() {
  var m = parseJson_(PropertiesService.getScriptProperties().getProperty('RW_MARKET')) || {};
  var at = Number(m.opensAt) || null;
  return { open: !!m.open || !!(at && Date.now() >= at), note: String(m.note || ''), opensAt: at };
}
function rwPrice_(price, rules) {
  var k = Number(rules.priceScale) > 0 ? Number(rules.priceScale) : 1;
  return price ? Math.max(5, Math.round(price * k / 5) * 5) : 0;
}
function rwItems_(rules) {
  return RW_ITEMS.map(function (x) { return { id: x[0], name: x[1], slot: x[2], tier: x[3], price: rwPrice_(x[4], rules) }; });
}

// Makes the three reward tabs the first time they are needed.
function rwSheet_(key) {
  var t = RW_TABS[key];
  var ss = hubSheet_(TABS.students.name).getParent();
  var sh = ss.getSheetByName(t.name);
  if (!sh) {
    sh = ss.insertSheet(t.name);
    sh.getRange(1, 1, 1, t.headers.length).setValues([t.headers]).setFontWeight('bold').setBackground('#e8eef7');
    sh.setFrozenRows(1);
    if (key === 'market') {
      sh.getRange(2, 1, RW_DEFAULT_PRIZES.length, 6).setValues(RW_DEFAULT_PRIZES.map(function (p) { return p.concat([true]); }));
      sh.setColumnWidth(2, 200);
    }
    if (key === 'log') { sh.getRange('A:A').setNumberFormat('d mmm yyyy, h:mm am/pm'); sh.getRange('J:J').setNumberFormat('d mmm yyyy, h:mm am/pm'); sh.getRange('B:C').setNumberFormat('@'); }
    if (key === 'avatars') sh.getRange('A:C').setNumberFormat('@');
  }
  return sh;
}
function rwRows_(key) {
  var sh = rwSheet_(key), last = sh.getLastRow(), n = RW_TABS[key].headers.length;
  return last < 2 ? [] : sh.getRange(2, 1, last - 1, n).getValues();
}
function rwLog_() {
  return rwRows_('log').map(function (r, i) {
    return { row: i + 2, time: r[0] instanceof Date ? r[0] : new Date(r[0] || 0), cls: hubNormClass_(r[1]), reg: String(r[2] || ''), name: String(r[3] || ''),
      what: String(r[4] || ''), item: String(r[5] || ''), points: Number(r[6]) || 0, tokens: Number(r[7]) || 0,
      code: String(r[8] || ''), done: r[9] instanceof Date ? r[9] : (String(r[9] || '') ? new Date() : null), note: String(r[10] || '') };
  }).filter(function (e) { return e.cls && e.name; });
}
function rwPrizes_(log) {
  var sold = {};
  (log || []).forEach(function (e) { if (e.what === 'Market') sold[e.item] = (sold[e.item] || 0) + 1; });
  return rwRows_('market').map(function (r, i) {
    var id = String(r[0] || '').trim(), stock = String(r[4]).trim() === '' ? null : Math.max(0, Math.round(Number(r[4]) || 0));
    return { row: i + 2, id: id, name: String(r[1] || '').trim(), art: RW_ARTS.indexOf(String(r[2]).trim()) >= 0 ? String(r[2]).trim() : 'mystery',
      tokens: Math.max(1, Math.round(Number(r[3]) || 1)), stock: stock, sold: sold[id] || 0,
      left: stock === null ? null : Math.max(0, stock - (sold[id] || 0)), onSale: r[5] === true || isYes_(r[5]) };
  }).filter(function (p) { return p.id && p.name; });
}

function rwPct_(score) {
  var s = String(score || '').trim(), m = s.match(/^(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/);
  if (m && Number(m[2]) > 0) return Number(m[1]) / Number(m[2]) * 100;
  m = s.match(/^(\d+(?:\.\d+)?)\s*%$/);
  return m ? Number(m[1]) : null;
}

// The points one hand-in gives: on time or late when it is handed in, then the score and blank
// paper once the marking is given back.
function rwSubEvents_(a, sub, rules) {
  var out = [];
  if (!sub) return out;
  var first = sub.first instanceof Date ? sub.first : null;
  if (rules.from) { var from = Utilities.parseDate(String(rules.from), TZ, 'yyyy-MM-dd'); if (first && first < from) return out; }
  var at = first || new Date(0);
  var late = !!(a.dueAt && first && first > a.dueAt);
  var name = a.title;
  if (late) out.push({ t: at, text: name + ': handed in late', points: -Number(rules.late) });
  else out.push({ t: at, text: name + ': handed in on time', points: Number(rules.onTime), onTime: !!first });
  var released = !!(a.showMarked && (sub.marked || sub.score || sub.comment));
  if (!released) return out;
  var rel = a.releasedAt instanceof Date && a.releasedAt > at ? a.releasedAt : new Date(at.getTime() + 1000);
  if (sub.blank) out.push({ t: rel, text: name + ': more than half left blank', points: -Number(rules.blank) });
  var pct = rwPct_(sub.score);
  if (pct !== null) {
    var p = pct >= rules.topPct ? rules.top : pct >= rules.midPct ? rules.mid : pct >= rules.lowPct ? rules.low : 0;
    if (p) out.push({ t: rel, text: name + ': scored ' + Math.round(pct) + '%', points: Number(p) });
  }
  return out;
}

// Everything that happened to one student's points and tokens, oldest first, with the balance.
function rwLedger_(s, assigns, subs, log, rules, items) {
  var ev = [];
  assigns.forEach(function (a) {
    if (!a.fileId || !canSee_(a, s)) return;
    rwSubEvents_(a, subs[a.id + '|' + studentKey_(s)], rules).forEach(function (e) { ev.push(e); });
  });
  var names = {};
  items.forEach(function (it) { names[it.id] = it.name; });
  RW_STICKERS.forEach(function (x) { names[x[0]] = x[1]; });
  var owned = [], orders = [], stickers = [], themes = [], rights = [], qDays = {}, daily = [];
  var onTimes = ev.filter(function (e) { return e.onTime; }).map(function (e) { return e.t; });
  log.forEach(function (e) {
    if (e.cls !== s.cls || hubNormName_(e.name) !== hubNormName_(s.name)) return;
    if (e.what === 'Daily') {
      var d = e.item.split(':'), right = e.note === 'right';
      daily.push({ key: d[0], day: d[1], choice: d[2] || '', right: right });
      if (right) rights.push(e.time);
      if (d[0] === 'q') qDays[d[1]] = true;
      if (e.points) ev.push({ t: e.time, text: d[0] === 'r' ? 'Revision rush: ' + (Number(d[2]) || 0) + ' right' : (RW_DAILY_NAMES[d[0]] || 'Daily puzzle') + ': right', points: e.points, tokens: 0, spend: false });
      return;
    }
    var text = e.what === 'Shop' ? 'Bought ' + (names[e.item] || e.note || e.item)
      : e.what === 'Tokens' ? 'Changed points into ' + e.tokens + (e.tokens === 1 ? ' token' : ' tokens')
      : e.what === 'Market' ? 'Night market: ' + (e.note || e.item)
      : e.what === 'Sticker' ? 'Bought the "' + (names[e.item] || e.note || e.item) + '" sticker'
      : e.what === 'Theme' ? 'Unlocked the ' + (e.note || e.item) + ' colour theme'
      : e.what === 'Hint' ? 'Used a hint' + (e.note ? ': ' + e.note : '')
      : (e.note || 'From your teacher');
    ev.push({ t: e.time, text: text, points: e.points, tokens: e.tokens, spend: !!RW_SPEND[e.what] });
    if (e.what === 'Shop') owned.push(e.item);
    if (e.what === 'Theme' && themes.indexOf(e.item) < 0) themes.push(e.item);
    if (e.what === 'Sticker' && stickers.indexOf(e.item) < 0) stickers.push(e.item);
    if (e.what === 'Market') orders.push({ row: e.row, code: e.code, prize: e.note || e.item, id: e.item, when: Utilities.formatDate(e.time, TZ, 'd MMM'), done: !!e.done });
  });
  // Weekly quests: done once in a week (Monday to Sunday), the moment the last one needed happens.
  var quests = 0;
  rwQuestList_(rules).forEach(function (q) {
    var byWeek = {};
    (q.id === 'onTime' ? onTimes : rights).forEach(function (t) { var w = weekOf_(t); if (!rules.questFrom || w >= rules.questFrom) (byWeek[w] = byWeek[w] || []).push(t); });
    Object.keys(byWeek).forEach(function (w) {
      var list = byWeek[w].sort(function (x, y) { return x - y; });
      if (list.length >= q.goal && q.points > 0) { ev.push({ t: list[q.goal - 1], text: 'Weekly quest done: ' + q.done, points: q.points, tokens: 0, spend: false }); quests++; }
    });
  });
  ev.sort(function (x, y) { return x.t - y.t; });
  // Points never go below zero. Things that happen at the same moment (the score and the blank paper for one
  // worksheet) count together, so the order they are listed in does not change the balance.
  var p = 0, t = 0, earned = 0, lost = 0, out = [];
  for (var i = 0; i < ev.length; ) {
    var j = i, net = 0;
    while (j < ev.length && ev[j].t - ev[i].t === 0) { net += ev[j].points || 0; t = Math.max(0, t + (ev[j].tokens || 0)); out.push(ev[j]); j++; }
    for (var k = i; k < j; k++) { var e = ev[k]; if (!e.spend && e.points > 0) earned += e.points; }
    var before = p;
    p = Math.max(0, p + net);
    if (before + net < 0) {
      lost += before;
      out.push({ t: ev[i].t, text: 'Your points stayed at 0. They never go below zero.', points: 0, tokens: 0, floor: -(before + net) });
    } else for (var q = i; q < j; q++) if (!ev[q].spend && ev[q].points < 0) lost -= ev[q].points;
    i = j;
  }
  return { points: p, tokens: t, earned: earned, lost: lost, events: out, owned: owned, orders: orders, stickers: stickers,
    themes: themes, onTimes: onTimes, rights: rights, qDays: qDays, daily: daily, quests: quests };
}

function rwStudentOutfits_() {
  var out = {};
  rwRows_('avatars').forEach(function (r, i) {
    // A row made only to keep a colour theme has no outfit yet.
    out[hubNormClass_(r[0]) + '|' + hubNormName_(r[2])] = { row: i + 2, outfit: String(r[3] || '').trim() ? parseJson_(String(r[3])) || {} : null, theme: String(r[5] || '') };
  });
  return out;
}

function rwState_(s) {
  var rules = rwRules_(), items = rwItems_(rules), log = rwLog_();
  var L = rwLedger_(s, getAssignments_(), submissionIndex_(), log, rules, items);
  var av = rwStudentOutfits_()[studentKey_(s)];
  return {
    points: L.points, tokens: L.tokens, earned: L.earned,
    owned: L.owned, outfit: av ? av.outfit : null, items: items,
    stickers: L.stickers, stickerShop: RW_STICKERS.map(function (x) { return { id: x[0], name: x[1], tokens: x[2] }; }),
    rules: { onTime: rules.onTime, late: rules.late, top: rules.top, mid: rules.mid, low: rules.low, blank: rules.blank,
      topPct: rules.topPct, midPct: rules.midPct, lowPct: rules.lowPct, perToken: rules.perToken },
    history: L.events.slice().reverse().slice(0, 80).map(function (e) {
      return { when: e.t && e.t.getTime() > 0 ? Utilities.formatDate(e.t, TZ, 'd MMM') : '', text: e.text, points: e.points || 0, tokens: e.tokens || 0 };
    }),
    orders: L.orders
  };
}

/* ---------- student calls ---------- */

function api_rw_ui() { return pageHtml_('Rewards'); }

function api_rw_state(token) { return rwState_(funGuard_(who_(token))); }

// The points button on the homework page.
function api_rw_summary(token) {
  var s = who_(token), rules = rwRules_(), log = rwLog_(), assigns = getAssignments_(), subs = submissionIndex_(), items = rwItems_(rules);
  var L = rwLedger_(s, assigns, subs, log, rules, items);
  var av = rwStudentOutfits_()[studentKey_(s)], m = rwMarketState_();
  return { points: L.points, tokens: L.tokens, outfit: av ? av.outfit : null, from: rules.from || '', stickers: L.stickers,
    theme: av && av.theme ? av.theme : 'sky', themes: rwThemes_(rules, L), quests: rwQuestsNow_(L, rules),
    goal: rwGoalFor_(s.cls, function () { return { assigns: assigns, subs: subs, log: log, rules: rules, items: items }; }),
    market: { open: m.open, opensAt: m.opensAt },
    stats: { earned: L.earned, items: L.owned.length, stickers: L.stickers.length, quests: L.quests,
      dailyRight: L.rights.length, dailyStreak: rwDailyStreak_(L.qDays, new Date()), onTime: L.onTimes.length } };
}

function api_rw_buy(token, id) {
  var s = funGuard_(who_(token));
  var lock = hubLock_();
  lock.waitLock(30000);
  try {
    var st = rwState_(s), it = null;
    st.items.forEach(function (x) { if (x.id === id) it = x; });
    if (!it) throw new Error('That item is not in the shop.');
    if (!it.price || st.owned.indexOf(id) >= 0) throw new Error('You already have ' + it.name + '.');
    if (st.points < it.price) throw new Error('You need ' + rwN_(it.price - st.points, 'more point', 'more points') + ' for ' + it.name + '.');
    rwSheet_('log').appendRow([new Date(), s.cls, s.reg, s.name, 'Shop', it.id, -it.price, 0, '', '', it.name]);
  } finally { lock.releaseLock(); }
  return rwState_(s);
}

function api_rw_exchange(token, n) {
  var s = funGuard_(who_(token));
  n = Math.round(Number(n) || 0);
  if (n < 1 || n > 1000) throw new Error('Choose how many tokens.');
  var lock = hubLock_();
  lock.waitLock(30000);
  try {
    var st = rwState_(s), cost = n * st.rules.perToken;
    if (st.points < cost) throw new Error('You need ' + rwN_(cost, 'point', 'points') + ' for ' + rwN_(n, 'token', 'tokens') + '. You have ' + rwN_(st.points, 'point', 'points') + '.');
    rwSheet_('log').appendRow([new Date(), s.cls, s.reg, s.name, 'Tokens', '', -cost, n, '', '', '']);
  } finally { lock.releaseLock(); }
  return rwState_(s);
}

// Buys a sticker with tokens. Stickers are shown at the night market, so they cost tokens, not points.
function api_rw_sticker(token, id) {
  var s = funGuard_(who_(token)), x = null;
  RW_STICKERS.forEach(function (r) { if (r[0] === id) x = r; });
  if (!x) throw new Error('That sticker is not on sale.');
  var lock = hubLock_();
  lock.waitLock(30000);
  try {
    var st = rwState_(s);
    if (st.stickers.indexOf(id) >= 0) throw new Error('You already have the "' + x[1] + '" sticker.');
    if (st.tokens < x[2]) throw new Error('You need ' + rwN_(x[2] - st.tokens, 'more token', 'more tokens') + ' for the "' + x[1] + '" sticker.');
    rwSheet_('log').appendRow([new Date(), s.cls, s.reg, s.name, 'Sticker', id, 0, -x[2], '', '', x[1]]);
  } finally { lock.releaseLock(); }
  return rwState_(s);
}

// Saves what the avatar is wearing. Anything the student does not own is taken off.
function api_rw_wear(token, json) {
  var s = funGuard_(who_(token)), o = parseJson_(String(json || '')) || {};
  var rules = rwRules_(), items = rwItems_(rules), L = rwLedger_(s, [], {}, rwLog_(), rules, items);
  var own = {}, slotOf = {};
  items.forEach(function (it) { slotOf[it.id] = it.slot; if (!it.price) own[it.id] = true; });
  L.owned.forEach(function (id) { own[id] = true; });
  var clean = {};
  Object.keys(RW_OUTFIT_KEYS).forEach(function (k) {
    var v = String(o[k] == null ? '' : o[k]);
    if (RW_OUTFIT_KEYS[k] === 'c') { if (/^#[0-9A-F]{6}$/i.test(v)) clean[k] = v.toUpperCase(); }
    else if (v === '' || (own[v] && slotOf[v] === RW_OUTFIT_KEYS[k])) clean[k] = v;
  });
  var text = JSON.stringify(clean);
  var lock = hubLock_();
  lock.waitLock(30000);
  try {
    var av = rwStudentOutfits_()[studentKey_(s)], sh = rwSheet_('avatars');
    if (av) sh.getRange(av.row, 1, 1, 5).setValues([[s.cls, s.reg, s.name, text, new Date()]]);
    else sh.appendRow([s.cls, s.reg, s.name, text, new Date()]);
  } finally { lock.releaseLock(); }
  return true;
}

function rwMarketFor_(s, log, orders) {
  var m = rwMarketState_();
  return { open: m.open, note: m.note,
    prizes: rwPrizes_(log).filter(function (p) { return p.onSale; }).map(function (p) { return { id: p.id, name: p.name, art: p.art, tokens: p.tokens, left: p.left }; }),
    orders: orders.slice().reverse() };
}

function api_rw_market(token) {
  var s = funGuard_(who_(token));
  var st = rwState_(s), log = rwLog_();
  var mk = rwMarketFor_(s, log, st.orders);
  var outfits = rwStudentOutfits_(), mates = [], stick = {};
  log.forEach(function (e) { if (e.what === 'Sticker') { var k = e.cls + '|' + hubNormName_(e.name); (stick[k] = stick[k] || []).push(e.item); } });
  getStudents_().forEach(function (x) {
    if (x.cls !== s.cls || hubNormName_(x.name) === hubNormName_(s.name)) return;
    var av = outfits[studentKey_(x)];
    if (av && av.outfit) mates.push({ name: x.name, outfit: av.outfit, stickers: stick[x.cls + '|' + hubNormName_(x.name)] || [] });
  });
  mk.classmates = mates.sort(function () { return Math.random() - 0.5; }).slice(0, 12);
  mk.state = st;
  mk.leaderboard = rwLeaderboard_(s, log);
  return mk;
}

function api_rw_order(token, prizeId) {
  var s = funGuard_(who_(token)), code = '', prize = null;
  var lock = hubLock_();
  lock.waitLock(30000);
  try {
    if (!rwMarketState_().open) throw new Error('The night market is not open yet.');
    var log = rwLog_();
    rwPrizes_(log).forEach(function (p) { if (p.id === prizeId && p.onSale) prize = p; });
    if (!prize) throw new Error('That prize is not on sale.');
    if (prize.left === 0) throw new Error(prize.name + ' has sold out.');
    var st = rwState_(s);
    if (st.tokens < prize.tokens) throw new Error('You need ' + rwN_(prize.tokens - st.tokens, 'more token', 'more tokens') + ' for ' + prize.name + '.');
    var used = {};
    log.forEach(function (e) { if (e.code) used[e.code] = true; });
    var abc = 'ACDEFHJKMNPRTUVWXY34679';
    do { code = ''; for (var i = 0; i < 4; i++) code += abc.charAt(Math.floor(Math.random() * abc.length)); } while (used[code]);
    rwSheet_('log').appendRow([new Date(), s.cls, s.reg, s.name, 'Market', prize.id, 0, -prize.tokens, code, '', prize.name]);
  } finally { lock.releaseLock(); }
  var st2 = rwState_(s);
  return { state: st2, order: { code: code, prize: prize.name }, market: rwMarketFor_(s, rwLog_(), st2.orders) };
}

// The leaderboard in the middle of the night market: points earned from homework and from the teacher,
// less points taken away. Spending does not lower anyone's place. Only the top ten are shown by name.
function rwLeaderboard_(s, log) {
  var rules = rwRules_();
  if (rules.board === 'off') return { scope: 'off', rows: [], me: null };
  var items = rwItems_(rules), assigns = getAssignments_(), subs = submissionIndex_();
  var list = getStudents_().filter(function (x) { return x.cls !== 'TEST' && (rules.board === 'all' || x.cls === s.cls); }).map(function (x) {
    var L = rwLedger_(x, assigns, subs, log, rules, items);
    return { name: x.name, cls: x.cls, points: Math.max(0, L.earned - L.lost), me: studentKey_(x) === studentKey_(s) };
  });
  list.sort(function (a, b) { return b.points - a.points || a.name.localeCompare(b.name); });
  var rank = 0, last = null;
  list.forEach(function (x, i) { if (x.points !== last) { rank = i + 1; last = x.points; } x.rank = rank; });
  var mine = list.filter(function (x) { return x.me; })[0] || null;
  return { scope: rules.board, cls: s.cls, count: list.length,
    rows: list.slice(0, 10).map(function (x) { return { rank: x.rank, name: x.name, cls: x.cls, points: x.points, me: x.me }; }),
    me: mine ? { rank: mine.rank, points: mine.points } : null };
}

/* ---------- teacher calls ---------- */

// Quick bonus buttons in the Rewards tab: [{ label, points }].
var RW_BONUS = [{ label: 'Helpful', points: 5 }, { label: 'Lab helper', points: 10 }];
function rwBonus_() {
  var b = parseJson_(PropertiesService.getScriptProperties().getProperty('RW_BONUS'));
  return Array.isArray(b) ? b : RW_BONUS;
}
function api_t_rwBonus(token, list) {
  teacher_(token);
  var clean = (list || []).map(function (b) { return { label: String(b.label || '').trim().slice(0, 24), points: Math.round(Number(b.points) || 0) }; })
    .filter(function (b) { return b.label && b.points; }).slice(0, 6);
  PropertiesService.getScriptProperties().setProperty('RW_BONUS', JSON.stringify(clean));
  return clean;
}
// The Monday that starts the week of a date, as yyyy-MM-dd.
function weekOf_(d) {
  var back = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(Utilities.formatDate(d, TZ, 'EEE'));
  return Utilities.formatDate(new Date(d.getTime() - Math.max(0, back) * 86400000), TZ, 'yyyy-MM-dd');
}

function api_t_rewards(token) {
  teacher_(token);
  var rules = rwRules_(), items = rwItems_(rules), log = rwLog_(), assigns = getAssignments_(), subs = submissionIndex_();
  var byKey = {}, weeks = {}, goals = rwGoals_(), goalHave = {};
  var students = getStudents_().map(function (s) {
    var L = rwLedger_(s, assigns, subs, log, rules, items);
    byKey[studentKey_(s)] = s;
    var g = goals[s.cls];
    if (g && s.cls !== 'TEST') goalHave[s.cls] = (goalHave[s.cls] || 0) + rwGoalPoints_(L, g);
    // points earned and spent, week by week, for the class chart
    if (s.cls !== 'TEST') L.events.forEach(function (e) {
      if (!(e.t instanceof Date) || !(e.t.getTime() > 0) || !e.points) return;
      var w = weekOf_(e.t), c = (weeks[s.cls] = weeks[s.cls] || {}), x = (c[w] = c[w] || { week: w, earned: 0, spent: 0, lost: 0 });
      if (e.spend) x.spent -= e.points; else if (e.points > 0) x.earned += e.points; else x.lost -= e.points;
    });
    return { cls: s.cls, reg: s.reg, name: s.name, points: L.points, tokens: L.tokens, earned: L.earned, lost: L.lost, items: L.owned.length,
      board: Math.max(0, L.earned - L.lost), stickers: L.stickers.length };
  });
  var sold = {};
  log.forEach(function (e) { if (e.what === 'Sticker') sold[e.item] = (sold[e.item] || 0) + 1; });
  var stickers = RW_STICKERS.map(function (x) { return { id: x[0], name: x[1], tokens: x[2], sold: sold[x[0]] || 0 }; })
    .sort(function (a, b) { return b.sold - a.sold || a.tokens - b.tokens; });
  var orders = log.filter(function (e) { return e.what === 'Market'; }).map(function (e) {
    return { row: e.row, when: Utilities.formatDate(e.time, TZ, 'd MMM, h:mm a'), cls: e.cls, name: e.name, prize: e.note || e.item, code: e.code, tokens: -e.tokens,
      done: e.done ? Utilities.formatDate(e.done, TZ, 'd MMM') : '' };
  }).reverse();
  var m = rwMarketState_();
  var byWeek = {};
  Object.keys(weeks).forEach(function (c) { byWeek[c] = Object.keys(weeks[c]).sort().map(function (w) { return weeks[c][w]; }); });
  return { rules: rules, market: m, prizes: rwPrizes_(log), arts: RW_ARTS, students: students, orders: orders,
    classes: Object.keys(studentsByClass_()).sort(), sheet: hubSheet_(TABS.students.name).getParent().getUrl(),
    weeks: byWeek, stickers: stickers, bonus: rwBonus_(),
    goals: Object.keys(goals).sort().map(function (c) { var g = goals[c]; return { cls: c, text: g.text, target: g.target, have: goalHave[c] || 0, since: Utilities.formatDate(new Date(g.from), TZ, 'd MMM') }; }),
    themes: RW_THEMES.map(function (x) { return { id: x[0], name: x[1], price: rwPrice_(x[2], rules) }; }) };
}

function api_t_rwRules(token, patch) {
  teacher_(token);
  var r = rwRules_();
  Object.keys(RW_RULES).forEach(function (k) {
    if (patch[k] === undefined) return;
    if (k === 'from') { var f = String(patch.from || '').trim(); if (f && !/^\d{4}-\d{2}-\d{2}$/.test(f)) throw new Error('The start date is not a date.'); r.from = f; return; }
    if (k === 'board') { if (['class', 'all', 'off'].indexOf(patch.board) < 0) throw new Error('Choose who the leaderboard shows.'); r.board = patch.board; return; }
    var v = Number(patch[k]);
    if (!(v >= 0) || v > 100000) throw new Error('Use numbers from 0 upwards.');
    r[k] = k === 'priceScale' ? Math.round(v * 100) / 100 : Math.round(v);
  });
  if (!(r.perToken >= 1)) throw new Error('A token must cost at least 1 point.');
  if (!(r.priceScale > 0)) r.priceScale = 1;
  if (!(r.topPct > r.midPct && r.midPct > r.lowPct)) throw new Error('The score bands must go down: the top band above the middle one, and the middle one above the lowest.');
  delete r.questFrom;
  PropertiesService.getScriptProperties().setProperty('RW_RULES', JSON.stringify(r));
  return r;
}

function api_t_rwMarket(token, patch) {
  teacher_(token);
  var m = parseJson_(PropertiesService.getScriptProperties().getProperty('RW_MARKET')) || {};
  m = { open: !!m.open, note: String(m.note || ''), opensAt: Number(m.opensAt) || null };
  if (patch.open !== undefined) {
    m.open = !!patch.open;
    // Closing the market by hand also stops the countdown from opening it again.
    if (!m.open && m.opensAt && m.opensAt <= Date.now()) m.opensAt = null;
  }
  if (patch.note !== undefined) m.note = String(patch.note || '').slice(0, 60);
  if (patch.opensAt !== undefined) {
    var v = String(patch.opensAt || '').trim();
    if (!v) m.opensAt = null;
    else {
      if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(v)) throw new Error('Choose a day and a time for the market to open.');
      var d = Utilities.parseDate(v, TZ, 'yyyy-MM-dd HH:mm');
      if (d.getTime() <= Date.now()) throw new Error('Choose a time that has not passed yet.');
      m.opensAt = d.getTime();
    }
  }
  PropertiesService.getScriptProperties().setProperty('RW_MARKET', JSON.stringify(m));
  return rwMarketState_();
}

// prizes: [{ id (blank for a new one), name, art, tokens, stock ('' = no limit), onSale }]
function api_t_rwPrizes(token, prizes) {
  teacher_(token);
  var lock = hubLock_();
  lock.waitLock(30000);
  try {
    var sh = rwSheet_('market'), max = 0;
    rwPrizes_([]).forEach(function (p) { var m = p.id.match(/^P(\d+)$/); if (m) max = Math.max(max, Number(m[1])); });
    var rows = (prizes || []).filter(function (p) { return String(p.name || '').trim(); }).map(function (p) {
      var id = String(p.id || '').trim() || ('P' + (++max));
      var stock = String(p.stock == null ? '' : p.stock).trim();
      return [id, String(p.name).trim().slice(0, 40), RW_ARTS.indexOf(p.art) >= 0 ? p.art : 'mystery', Math.max(1, Math.round(Number(p.tokens) || 1)),
        stock === '' ? '' : Math.max(0, Math.round(Number(stock) || 0)), p.onSale !== false];
    });
    var last = sh.getLastRow();
    if (last >= 2) sh.getRange(2, 1, last - 1, 6).clearContent();
    if (rows.length) sh.getRange(2, 1, rows.length, 6).setValues(rows);
  } finally { lock.releaseLock(); }
  return rwPrizes_(rwLog_());
}

// Gives (or takes away, with a negative number) points by hand, with a note the student sees.
function api_t_rwGive(token, cls, name, points, note) {
  teacher_(token);
  var s = hubFindStudent_(hubNormClass_(cls), name);
  if (!s) throw new Error('That student was not found.');
  var p = Math.round(Number(points) || 0);
  if (!p) throw new Error('Type a number of points.');
  var text = String(note || '').trim().slice(0, 80) || (p > 0 ? 'Bonus from your teacher' : 'Taken away by your teacher');
  rwSheet_('log').appendRow([new Date(), s.cls, s.reg, s.name, 'Teacher', '', p, 0, '', '', text]);
  return true;
}

function api_t_rwCollected(token, row, done) {
  teacher_(token);
  var sh = rwSheet_('log'), r = Math.round(Number(row));
  if (!(r >= 2) || String(sh.getRange(r, 5).getValue()) !== 'Market') throw new Error('That ticket was not found.');
  sh.getRange(r, 10).setValue(done ? new Date() : '');
  return true;
}

/* ------------------------------------------------------------------ */
/* Daily science, weekly quests, class goals and colour themes         */
/* ------------------------------------------------------------------ */
//
// The homework page shows three small daily puzzles: a question of the day, myth or fact, and a zoom
// puzzle (a science picture that starts very close up). They come from the "Daily science" tab, which
// is filled with examples the first time. The teacher can add rows, change them or untick On.
// A right question of the day gives 2 points; a right myth or fact or zoom puzzle gives 1.

var RW_DAILY_NAMES = { q: 'Question of the day', m: 'Myth or fact', z: 'Zoom puzzle', r: 'Revision rush' };
var DAILY_TAB = { name: 'Daily science', headers: ['On', 'Type', 'Chapter', 'Question or statement', 'A', 'B', 'C', 'D', 'Answer', 'Why', 'Picture'] };
var DAILY_KIND = { 'question': 'q', 'question of the day': 'q', 'myth or fact': 'm', 'myth': 'm', 'zoom': 'z', 'zoom puzzle': 'z' };
// Pictures the zoom puzzle can draw (the Picture column).
var DAILY_PICTURES = ['beaker', 'conical_flask', 'measuring_cylinder', 'bunsen', 'thermometer', 'magnet', 'prism', 'convex_lens',
  'petri_dish', 'funnel', 'tripod', 'evaporating_dish', 'dropper', 'dry_cell', 'bulb'];

// [type, chapter, question, options with the right one first, why, picture]. The options are mixed up
// when the tab is made. Myth or fact rows give the answer ('Myth' or 'Fact') instead of options.
var DAILY_SEED = [
  ['Question', 'Light', 'A ray of light hits a plane mirror. The angle of incidence is 30°. What is the angle of reflection?', ['30°', '60°', '90°', '120°'], 'The angle of reflection always equals the angle of incidence. Both are measured from the normal.'],
  ['Question', 'Light', 'A ray of light goes from air into a glass block at an angle. Which way does it bend?', ['Towards the normal', 'Away from the normal', 'Along the surface of the block', 'Back the way it came'], 'Light slows down in glass, so it bends towards the normal as it enters.'],
  ['Question', 'Light', 'A straight pencil in a glass of water looks bent. What causes this?', ['Refraction of light at the water surface', 'Reflection of light off the water surface', 'The water bending the pencil', 'The glass magnifying the pencil'], 'Light from the pencil bends as it leaves the water, so the part under water seems to be in a different place.'],
  ['Question', 'Light', 'Your friend stands 2 m in front of a plane mirror. How far is your friend from their image?', ['4 m', '2 m', '1 m', '0 m'], 'The image is as far behind the mirror as the object is in front: 2 m + 2 m = 4 m.'],
  ['Question', 'Cells', 'Which part is found in a plant cell but not in an animal cell?', ['Cell wall', 'Cell membrane', 'Nucleus', 'Cytoplasm'], 'Plant cells have a cell wall (and chloroplasts and a large vacuole). Animal cells do not.'],
  ['Question', 'Cells', 'Which part of a cell controls what the cell does?', ['Nucleus', 'Cell membrane', 'Cytoplasm', 'Vacuole'], 'The nucleus holds the genetic material that controls the cell.'],
  ['Question', 'Cells', 'Where in a plant cell does photosynthesis take place?', ['Chloroplast', 'Nucleus', 'Vacuole', 'Cell wall'], 'Chloroplasts contain chlorophyll, which absorbs light energy for photosynthesis.'],
  ['Question', 'Electricity', 'Which material is a good conductor of electricity?', ['Copper', 'Rubber', 'Plastic', 'Glass'], 'Metals such as copper let electric charge flow through them easily.'],
  ['Question', 'Electricity', 'Two bulbs are connected in series. One bulb blows. What happens to the other bulb?', ['It goes out', 'It gets brighter', 'It gets dimmer', 'It stays the same'], 'A series circuit is one loop. A break anywhere stops the current everywhere.'],
  ['Question', 'Electricity', 'What does an ammeter measure?', ['Electric current', 'Potential difference', 'Resistance', 'Energy'], 'An ammeter measures current in amperes (A). It is connected in series.'],
  ['Question', 'Electricity', 'More cells are added in series to a circuit with one bulb. What happens to the current?', ['It increases', 'It decreases', 'It stays the same', 'It drops to zero'], 'More cells in series give a bigger push (voltage), so more current flows.'],
  ['Question', 'Matter', 'In which state are particles close together but able to slide past one another?', ['Liquid', 'Solid', 'Gas', 'All three states'], 'In a liquid the particles touch but can move past each other, so a liquid flows.'],
  ['Question', 'Matter', 'A gas cools and turns into a liquid. What is this change called?', ['Condensation', 'Evaporation', 'Melting', 'Freezing'], 'Condensation is gas turning into liquid, like water drops forming on a cold can.'],
  ['Question', 'Matter', 'Which of these is an element?', ['Oxygen', 'Water', 'Salt', 'Air'], 'Oxygen is made of one kind of atom. Water and salt are compounds, and air is a mixture.'],
  ['Question', 'Matter', 'Which of these is a chemical change?', ['Burning paper', 'Melting ice', 'Dissolving sugar', 'Cutting paper'], 'Burning makes new substances (ash, carbon dioxide and water) and cannot be undone.'],
  ['Question', 'Heat', 'Why is the handle of a cooking pot often made of plastic?', ['Plastic is a poor conductor of heat', 'Plastic is a good conductor of heat', 'Plastic is a good conductor of electricity', 'Plastic reflects heat well'], 'A poor conductor (an insulator) slows the flow of heat to your hand.'],
  ['Question', 'Heat', 'How does heat from the Sun reach the Earth?', ['Radiation', 'Conduction', 'Convection', 'Evaporation'], 'Space is almost empty, so heat cannot be conducted or convected. It travels as radiation.'],
  ['Question', 'Heat', 'Why are small gaps left between sections of railway track?', ['To let the rails expand on hot days', 'To let rainwater drain away', 'To make the trains quieter', 'To use less metal'], 'Metal expands when it heats up. Without gaps the rails would push on each other and bend.'],
  ['Question', 'Mixtures', 'Which method gets the salt back from salt solution?', ['Evaporation', 'Filtration', 'Using a magnet', 'Chromatography'], 'Heating the solution evaporates the water and leaves the salt behind.'],
  ['Question', 'Mixtures', 'Which method separates the different dyes in black ink?', ['Chromatography', 'Filtration', 'Evaporation', 'Sieving'], 'In chromatography each dye travels up the paper at its own speed, so the dyes spread apart.'],
  ['Question', 'Mixtures', 'Which method separates sand from water?', ['Filtration', 'Chromatography', 'Using a magnet', 'Condensation'], 'The sand is too big to pass through the filter paper, but the water passes through.'],
  ['Question', 'Acids and alkalis', 'What colour does blue litmus paper turn in an acid?', ['Red', 'Green', 'Purple', 'Yellow'], 'Acids turn blue litmus red. Alkalis turn red litmus blue.'],
  ['Question', 'Acids and alkalis', 'A solution has a pH of 3. What kind of solution is it?', ['Acidic', 'Neutral', 'Alkaline'], 'A pH below 7 is acidic, 7 is neutral and above 7 is alkaline.'],
  ['Question', 'Forces', 'What is the unit of force?', ['Newton (N)', 'Joule (J)', 'Watt (W)', 'Pascal (Pa)'], 'Force is measured in newtons.'],
  ['Question', 'Forces', 'A book slides across a table and slows down. Which force slows it down?', ['Friction', 'Gravity', 'Magnetic force', 'Upthrust'], 'Friction acts between the book and the table, against the motion.'],
  ['Question', 'Forces', 'Two north poles of magnets are brought close together. What happens?', ['They push each other away', 'They pull towards each other', 'Nothing happens', 'They both become south poles'], 'Like poles repel. Unlike poles attract.'],
  ['Question', 'Energy', 'What energy change happens in a lit bulb?', ['Electrical to light and thermal', 'Light to electrical', 'Chemical to kinetic', 'Thermal to electrical'], 'A bulb changes electrical energy into light energy, and some into thermal energy (it gets warm).'],
  ['Question', 'Density', 'A block has a mass of 40 g and a volume of 20 cm³. What is its density?', ['2 g/cm³', '0.5 g/cm³', '20 g/cm³', '800 g/cm³'], 'Density = mass ÷ volume = 40 g ÷ 20 cm³ = 2 g/cm³.'],
  ['Question', 'Sound', 'Which of these can sound not travel through?', ['A vacuum', 'Water', 'Steel', 'Air'], 'Sound needs particles to pass the vibration along. A vacuum has none.'],
  ['Question', 'Ecosystems', 'In a food chain, what do the arrows show?', ['The flow of energy', 'The size of each organism', 'The number of each organism', 'Where each organism lives'], 'Each arrow points from the organism eaten to the one that eats it: the way energy moves.'],
  ['Question', 'Ecosystems', 'What are organisms that make their own food called?', ['Producers', 'Consumers', 'Decomposers', 'Predators'], 'Green plants are producers: they make food by photosynthesis.'],
  ['Question', 'Plants', 'Which gas do plants take in for photosynthesis?', ['Carbon dioxide', 'Oxygen', 'Nitrogen', 'Hydrogen'], 'Carbon dioxide + water, with light energy, make glucose and oxygen.'],
  ['Question', 'Human body', 'Where is most digested food absorbed into the blood?', ['Small intestine', 'Large intestine', 'Stomach', 'Gullet'], 'The small intestine is long and has villi, which give a large surface for absorption.'],
  ['Question', 'Human body', 'Which organ pumps blood around the body?', ['Heart', 'Lungs', 'Liver', 'Kidney'], 'The heart is a muscular pump.'],
  ['Question', 'Diffusion', 'A drop of ink spreads out through still water. What is this called?', ['Diffusion', 'Evaporation', 'Condensation', 'Filtration'], 'Particles move from where there are more of them to where there are fewer.'],
  ['Myth or fact', 'Forces', 'Heavier objects always fall faster than lighter ones.', 'Myth', 'Without air resistance, all objects fall with the same acceleration. A feather falls slowly because air pushes back on it.'],
  ['Myth or fact', 'Human body', 'The blood in your veins is blue.', 'Myth', 'Blood is always red. Blood low in oxygen is darker red. Veins only look blue through your skin.'],
  ['Myth or fact', 'Electricity', 'Lightning never strikes the same place twice.', 'Myth', 'Tall buildings and towers are struck many times a year.'],
  ['Myth or fact', 'Human body', 'We only use 10% of our brains.', 'Myth', 'Brain scans show activity in almost every part of the brain.'],
  ['Myth or fact', 'Light', 'Bats are blind.', 'Myth', 'Bats can see. Many kinds also use echoes of sound to find their way in the dark.'],
  ['Myth or fact', 'Sound', 'Sound travels faster in air than in water.', 'Myth', 'Sound travels about four times faster in water, because the particles are closer together.'],
  ['Myth or fact', 'Heat', 'A metal spoon feels colder than a wooden spoon because the metal is at a lower temperature.', 'Myth', 'Both are at room temperature. Metal conducts heat away from your hand faster, so it feels colder.'],
  ['Myth or fact', 'Plants', 'Plants get their food from the soil.', 'Myth', 'Plants make their own food by photosynthesis. The soil gives them water and mineral salts.'],
  ['Myth or fact', 'Light', 'The Moon makes its own light.', 'Myth', 'The Moon reflects light from the Sun.'],
  ['Myth or fact', 'Electricity', 'A bulb uses up electric current, so there is less current after it.', 'Myth', 'In a series circuit the current is the same all the way round. The bulb changes electrical energy, not current.'],
  ['Myth or fact', 'Matter', 'Water only evaporates when it boils.', 'Myth', 'Evaporation happens at any temperature, from the surface. That is how puddles dry up.'],
  ['Myth or fact', 'Cells', 'Every cell in the human body has a nucleus.', 'Myth', 'Red blood cells have no nucleus, which leaves more room to carry oxygen.'],
  ['Myth or fact', 'Light', 'Light from the Sun takes about 8 minutes to reach the Earth.', 'Fact', 'Light travels about 300 000 km every second, and the Sun is about 150 million km away.'],
  ['Myth or fact', 'Matter', 'Water expands when it freezes.', 'Fact', 'Ice takes up more space than the same water, which is why ice floats.'],
  ['Myth or fact', 'Light', 'A rainbow is white light split into colours by raindrops.', 'Fact', 'Each colour refracts by a slightly different amount in the drops, so the colours spread out.'],
  ['Myth or fact', 'Sound', 'Sound cannot travel through outer space.', 'Fact', 'Space is almost a vacuum, and sound needs particles to travel through.'],
  ['Myth or fact', 'Plants', 'Plants give out carbon dioxide at night.', 'Fact', 'Plants respire all the time. In the dark there is no photosynthesis to take the carbon dioxide in.'],
  ['Myth or fact', 'Matter', 'Diamond and pencil lead (graphite) are both made of carbon.', 'Fact', 'They are the same element with the atoms arranged differently.'],
  ['Myth or fact', 'Magnets', 'A magnet attracts a steel paper clip but not an aluminium can.', 'Fact', 'Iron, steel, nickel and cobalt are magnetic. Aluminium is not.'],
  ['Myth or fact', 'Matter', 'Air has mass.', 'Fact', 'Air is made of particles, and particles have mass. A pumped-up ball is slightly heavier than a flat one.'],
  ['Myth or fact', 'Heat', 'Sweating cools you down.', 'Fact', 'Sweat takes in heat from your skin as it evaporates.'],
  ['Myth or fact', 'Light', 'Your image in a plane mirror is laterally inverted (left and right are swapped).', 'Fact', 'Raise your right hand and your image raises what looks like its left hand.'],
  ['Zoom', 'Apparatus', 'What is this?', ['Beaker', 'Conical flask', 'Measuring cylinder', 'Boiling tube'], 'A beaker holds and heats liquids. The spout makes pouring easy.', 'beaker'],
  ['Zoom', 'Apparatus', 'What is this?', ['Conical flask', 'Beaker', 'Round-bottomed flask', 'Test tube'], 'The narrow neck of a conical flask lets you swirl liquids without spilling.', 'conical_flask'],
  ['Zoom', 'Apparatus', 'What is this?', ['Measuring cylinder', 'Test tube', 'Burette', 'Beaker'], 'A measuring cylinder measures volume. Read the bottom of the meniscus at eye level.', 'measuring_cylinder'],
  ['Zoom', 'Apparatus', 'What is this?', ['Bunsen burner', 'Spirit lamp', 'Tripod stand', 'Retort stand'], 'Open the air hole of a Bunsen burner for a hot blue flame.', 'bunsen'],
  ['Zoom', 'Apparatus', 'What is this?', ['Thermometer', 'Glass rod', 'Dropper', 'Test tube'], 'A thermometer measures temperature in degrees Celsius (°C).', 'thermometer'],
  ['Zoom', 'Magnets', 'What is this?', ['Bar magnet', 'Dry cell', 'Compass', 'Iron nail'], 'A bar magnet has a north pole and a south pole at its ends.', 'magnet'],
  ['Zoom', 'Light', 'What is this?', ['Glass prism', 'Glass block', 'Convex lens', 'Plane mirror'], 'A prism splits white light into the colours of the spectrum.', 'prism'],
  ['Zoom', 'Light', 'What is this?', ['Convex lens', 'Concave lens', 'Glass block', 'Plane mirror'], 'A convex lens is thicker in the middle and brings light rays together.', 'convex_lens'],
  ['Zoom', 'Apparatus', 'What is this?', ['Petri dish', 'Evaporating dish', 'Watch glass', 'Beaker'], 'Petri dishes are used to grow bacteria and fungi on agar.', 'petri_dish'],
  ['Zoom', 'Apparatus', 'What is this?', ['Filter funnel', 'Dropper', 'Conical flask', 'Test tube'], 'A filter funnel holds filter paper to separate a solid from a liquid.', 'funnel'],
  ['Zoom', 'Apparatus', 'What is this?', ['Tripod stand', 'Retort stand', 'Wire gauze', 'Bunsen burner'], 'A tripod holds a beaker or dish above a Bunsen burner.', 'tripod'],
  ['Zoom', 'Apparatus', 'What is this?', ['Evaporating dish', 'Petri dish', 'Crucible', 'Beaker'], 'An evaporating dish is heated to boil off water and leave a solid behind.', 'evaporating_dish'],
  ['Zoom', 'Apparatus', 'What is this?', ['Dropper', 'Test tube', 'Glass rod', 'Thermometer'], 'A dropper adds a liquid a few drops at a time.', 'dropper'],
  ['Zoom', 'Electricity', 'What is this?', ['Dry cell', 'Bar magnet', 'Light bulb', 'Switch'], 'A dry cell pushes electric current round a circuit. The end with the bump is positive.', 'dry_cell'],
  ['Zoom', 'Electricity', 'What is this?', ['Light bulb', 'Dry cell', 'Fuse', 'Switch'], 'The thin filament in a bulb glows when current flows through it.', 'bulb']
];

function dailySheet_() {
  var ss = hubSheet_(TABS.students.name).getParent(), sh = ss.getSheetByName(DAILY_TAB.name);
  if (sh) return sh;
  sh = ss.insertSheet(DAILY_TAB.name);
  var h = DAILY_TAB.headers;
  sh.getRange(1, 1, 1, h.length).setValues([h]).setFontWeight('bold').setBackground('#e8eef7');
  sh.setFrozenRows(1);
  var rows = DAILY_SEED.map(function (d, i) {
    if (d[0] === 'Myth or fact') return [true, d[0], d[1], d[2], 'Myth', 'Fact', '', '', d[3], d[4], ''];
    var o = d[3], k = (i * 3 + 1) % o.length, mixed = o.slice(k).concat(o.slice(0, k));
    while (mixed.length < 4) mixed.push('');
    return [true, d[0], d[1], d[2]].concat(mixed).concat(['ABCD'.charAt((o.length - k) % o.length), d[4], d[5] || '']);
  });
  sh.getRange(2, 1, rows.length, h.length).setValues(rows);
  sh.getRange(2, 1, rows.length, 1).insertCheckboxes();
  sh.setColumnWidth(4, 360);
  sh.setColumnWidth(10, 320);
  return sh;
}

// Rows that are On and make sense: { key, chapter, text, options, answer (0-based), why, picture }.
function dailyItems_() {
  var sh = dailySheet_(), last = sh.getLastRow();
  if (last < 2) return [];
  return sh.getRange(2, 1, last - 1, DAILY_TAB.headers.length).getValues().map(function (r) {
    var key = DAILY_KIND[String(r[1]).trim().toLowerCase()], text = String(r[3] || '').trim();
    if (!(r[0] === true || isYes_(r[0])) || !key || !text) return null;
    var options = key === 'm' ? ['Myth', 'Fact'] : [r[4], r[5], r[6], r[7]].map(function (x) { return String(x == null ? '' : x).trim(); }).filter(function (x) { return x; });
    var ans = String(r[8] || '').trim(), i = /^[A-D]$/i.test(ans) && key !== 'm' ? 'ABCD'.indexOf(ans.toUpperCase()) : options.map(function (o) { return o.toLowerCase(); }).indexOf(ans.toLowerCase());
    if (options.length < 2 || i < 0 || i >= options.length) return null;
    var pic = String(r[10] || '').trim().toLowerCase().replace(/\s+/g, '_');
    if (key === 'z' && DAILY_PICTURES.indexOf(pic) < 0) return null;
    return { key: key, chapter: String(r[2] || '').trim(), text: text, options: options, answer: i, why: String(r[9] || '').trim(), picture: key === 'z' ? pic : '' };
  }).filter(function (x) { return x; });
}

// Today's puzzle of each kind. The list is worked through in order, one row a day, then starts again.
function dailyToday_(now) {
  var day = Math.floor((now.getTime() + 8 * 3600000) / 86400000), by = { q: [], m: [], z: [] }, out = {};
  dailyItems_().forEach(function (x) { by[x.key].push(x); });
  Object.keys(by).forEach(function (k) { if (by[k].length) out[k] = by[k][day % by[k].length]; });
  return out;
}

function dailyMine_(s, log, day) {
  var mine = {};
  log.forEach(function (e) {
    if (e.what !== 'Daily' || e.cls !== s.cls || hubNormName_(e.name) !== hubNormName_(s.name)) return;
    var d = e.item.split(':');
    if (d[1] === day) mine[d[0]] = { choice: 'ABCD'.indexOf(d[2] || ''), right: e.note === 'right', points: e.points };
  });
  return mine;
}

// Days in a row the student answered the question of the day. Missing a Saturday or Sunday does not
// break the streak, and today does not count against it until the day is over.
function rwDailyStreak_(qDays, now) {
  var keys = Object.keys(qDays).sort();
  if (!keys.length) return 0;
  var n = 0, t = now.getTime();
  for (var i = 0; i < 400; i++, t -= 86400000) {
    var d = new Date(t), k = Utilities.formatDate(d, TZ, 'yyyy-MM-dd');
    if (k < keys[0]) break;
    if (qDays[k]) { n++; continue; }
    var dow = Utilities.formatDate(d, TZ, 'EEE');
    if (i > 0 && dow !== 'Sat' && dow !== 'Sun') break;
  }
  return n;
}

function api_daily(token) {
  var s = who_(token), now = new Date(), day = Utilities.formatDate(now, TZ, 'yyyy-MM-dd'), rules = rwRules_();
  var today = dailyToday_(now), log = rwLog_(), mine = dailyMine_(s, log, day), qDays = {};
  log.forEach(function (e) {
    if (e.what === 'Daily' && e.cls === s.cls && hubNormName_(e.name) === hubNormName_(s.name) && e.item.charAt(0) === 'q') qDays[e.item.split(':')[1]] = true;
  });
  return {
    day: day, streak: rwDailyStreak_(qDays, now), rush: (function () { try { return rushState_(s, log); } catch (e) { return null; } })(),
    items: ['q', 'm', 'z'].filter(function (k) { return today[k]; }).map(function (k) {
      var x = today[k], m = mine[k];
      return { key: k, name: RW_DAILY_NAMES[k], chapter: x.chapter, text: x.text, options: x.options, picture: x.picture,
        points: k === 'q' ? Number(rules.daily) : Number(rules.dailyFun), done: !!m,
        choice: m ? m.choice : null, right: m ? m.right : null, answer: m ? x.answer : null, why: m ? x.why : '' };
    })
  };
}

function api_daily_answer(token, key, choice) {
  var s = who_(token), now = new Date(), day = Utilities.formatDate(now, TZ, 'yyyy-MM-dd'), rules = rwRules_();
  var x = dailyToday_(now)[key];
  if (!x) throw new Error('There is no puzzle like that today.');
  var c = Math.round(Number(choice));
  if (!(c >= 0 && c < x.options.length)) throw new Error('Choose one of the answers.');
  var right = c === x.answer, pts = right ? Number(key === 'q' ? rules.daily : rules.dailyFun) || 0 : 0;
  var lock = hubLock_();
  lock.waitLock(30000);
  try {
    if (dailyMine_(s, rwLog_(), day)[key]) throw new Error('You have already answered today\'s ' + RW_DAILY_NAMES[key].toLowerCase() + '. Come back tomorrow.');
    rwSheet_('log').appendRow([now, s.cls, s.reg, s.name, 'Daily', key + ':' + day + ':' + 'ABCD'.charAt(c), pts, 0, '', '', right ? 'right' : 'wrong']);
  } finally { lock.releaseLock(); }
  var d = api_daily(token);
  return { right: right, answer: x.answer, why: x.why, points: pts, streak: d.streak, daily: d };
}

// Weekly quests. A quest with 0 points is switched off.
function rwQuestList_(rules) {
  return [
    { id: 'onTime', text: 'Hand in 2 worksheets on time', done: '2 worksheets handed in on time', goal: 2, points: Number(rules.questOnTime) || 0 },
    { id: 'quiz', text: 'Get 3 daily puzzles right', done: '3 daily puzzles right', goal: 3, points: Number(rules.questQuiz) || 0 }
  ].filter(function (q) { return q.points > 0; });
}
function rwQuestsNow_(L, rules) {
  var now = new Date(), w = weekOf_(now), end = new Date(Utilities.parseDate(w, TZ, 'yyyy-MM-dd').getTime() + 7 * 86400000);
  return rwQuestList_(rules).map(function (q) {
    var have = (q.id === 'onTime' ? L.onTimes : L.rights).filter(function (t) { return weekOf_(t) === w; }).length;
    return { id: q.id, text: q.text, goal: q.goal, have: Math.min(have, q.goal), points: q.points, done: have >= q.goal, ends: end.getTime() };
  });
}

// Class goals: { cls: { text, target, from (ms) } }. Points every student in the class earns from
// homework, puzzles, quests and the teacher since the goal was set all count. Spending does not.
function rwGoals_() { return parseJson_(PropertiesService.getScriptProperties().getProperty('RW_GOALS')) || {}; }
function rwGoalPoints_(L, g) {
  var n = 0;
  L.events.forEach(function (e) { if (!e.spend && e.points > 0 && e.t instanceof Date && e.t.getTime() >= g.from) n += e.points; });
  return n;
}
function rwGoalFor_(cls, data) {
  var g = rwGoals_()[cls];
  if (!g) return null;
  var cache = CacheService.getScriptCache(), key = 'goal_' + cls + '_' + g.from + '_' + g.target, have = cache.get(key);
  if (have === null || have === undefined) {
    var d = data(), n = 0;
    getStudents_().forEach(function (x) { if (x.cls === cls) n += rwGoalPoints_(rwLedger_(x, d.assigns, d.subs, d.log, d.rules, d.items), g); });
    have = String(n);
    cache.put(key, have, 600);
  }
  return { text: g.text, target: g.target, have: Number(have) };
}
function api_t_rwGoal(token, cls, goal) {
  teacher_(token);
  cls = hubNormClass_(cls);
  if (!studentsByClass_()[cls]) throw new Error('That class was not found.');
  var all = rwGoals_(), old = all[cls];
  if (!goal || !String(goal.text || '').trim()) delete all[cls];
  else {
    var target = Math.round(Number(goal.target) || 0);
    if (!(target >= 50 && target <= 1000000)) throw new Error('Set a goal of at least 50 points.');
    all[cls] = { text: String(goal.text).trim().slice(0, 60), target: target, from: old && !goal.restart ? old.from : Date.now() };
  }
  PropertiesService.getScriptProperties().setProperty('RW_GOALS', JSON.stringify(all));
  return all[cls] || null;
}

function rwThemes_(rules, L) {
  return RW_THEMES.map(function (x) { var p = rwPrice_(x[2], rules); return { id: x[0], name: x[1], price: p, owned: !p || L.themes.indexOf(x[0]) >= 0 }; });
}

// Unlocks a colour theme (once) and wears it.
function api_rw_theme(token, id) {
  var s = who_(token), x = null;
  RW_THEMES.forEach(function (t) { if (t[0] === id) x = t; });
  if (!x) throw new Error('That colour theme was not found.');
  var lock = hubLock_();
  lock.waitLock(30000);
  try {
    var rules = rwRules_(), L = rwLedger_(s, getAssignments_(), submissionIndex_(), rwLog_(), rules, rwItems_(rules)), price = rwPrice_(x[2], rules);
    if (price && L.themes.indexOf(id) < 0) {
      if (L.points < price) throw new Error('You need ' + rwN_(price - L.points, 'more point', 'more points') + ' for the ' + x[1] + ' theme.');
      rwSheet_('log').appendRow([new Date(), s.cls, s.reg, s.name, 'Theme', id, -price, 0, '', '', x[1]]);
    }
    var sh = rwSheet_('avatars'), av = rwStudentOutfits_()[studentKey_(s)];
    if (String(sh.getRange(1, 6).getValue()) !== 'Theme') sh.getRange(1, 6).setValue('Theme').setFontWeight('bold').setBackground('#e8eef7');
    if (av) sh.getRange(av.row, 6).setValue(id);
    else sh.appendRow([s.cls, s.reg, s.name, '', new Date(), id]);
  } finally { lock.releaseLock(); }
  return api_rw_summary(token);
}

/* ------------------------------------------------------------------ */
/* Homework helpers: formula card, hints, notes, help flags, nudge     */
/* ------------------------------------------------------------------ */
//
// Each worksheet can have a formula card, hints for single questions, and a notes or slides PDF to
// read beside the worksheet. The teacher also chooses which tools students get. Students can flag
// a question they are stuck on and say how sure they are; the Hub shows this per question.
// Everything is kept in the "Help flags" tab.

var WSX_TOOLS = { calc: true, graph: true, stamps: true, read: true, hints: true, notes: true, nudge: false };
var HELP_TAB = { name: 'Help flags', headers: ['Time', 'Worksheet ID', 'Class', 'Reg No', 'Name', 'Kind', 'Question', 'Page', 'Value', 'Note'] };
var CONF_NAMES = ['', 'Not sure', 'Getting there', 'Got it'];

function wsExtras_(id) {
  var x = parseJson_(PropertiesService.getScriptProperties().getProperty('WSX_' + id)) || {}, tools = {};
  Object.keys(WSX_TOOLS).forEach(function (k) { tools[k] = x.tools && x.tools[k] !== undefined ? !!x.tools[k] : WSX_TOOLS[k]; });
  return { formula: String(x.formula || ''), hints: Array.isArray(x.hints) ? x.hints : [], hintCost: Math.max(0, Math.round(Number(x.hintCost) || 0)),
    notes: String(x.notes || ''), notesName: String(x.notesName || ''), tools: tools };
}
function saveExtras_(id, x) {
  PropertiesService.getScriptProperties().setProperty('WSX_' + id, JSON.stringify({ formula: x.formula, hints: x.hints, hintCost: x.hintCost, notes: x.notes, notesName: x.notesName, tools: x.tools }));
}

function api_t_extras(token, id) {
  teacher_(token);
  var a = findAssignment_(id);
  if (!a) throw new Error('That worksheet was not found.');
  var x = wsExtras_(a.id);
  x.notesUrl = x.notes ? fileUrl_(x.notes) : '';
  x.nudge = nudgeState_();
  return x;
}

// patch: { formula, hints: [{ id, q, text }], hintCost, tools: { calc, graph, ... } }
function api_t_setExtras(token, id, patch) {
  teacher_(token);
  var a = findAssignment_(id);
  if (!a) throw new Error('That worksheet was not found.');
  var x = wsExtras_(a.id);
  patch = patch || {};
  if (patch.formula !== undefined) x.formula = String(patch.formula || '').replace(/\r/g, '').trim().slice(0, 1200);
  if (patch.hints !== undefined) {
    var max = 0;
    (patch.hints || []).forEach(function (h) { var m = String(h.id || '').match(/^h(\d+)$/); if (m) max = Math.max(max, Number(m[1])); });
    x.hints.forEach(function (h) { var m = String(h.id || '').match(/^h(\d+)$/); if (m) max = Math.max(max, Number(m[1])); });
    x.hints = (patch.hints || []).filter(function (h) { return String(h.text || '').trim(); }).slice(0, 10).map(function (h) {
      return { id: /^h\d+$/.test(String(h.id || '')) ? String(h.id) : 'h' + (++max), q: String(h.q || '').trim().slice(0, 12), text: String(h.text || '').trim().slice(0, 300) };
    });
  }
  if (patch.hintCost !== undefined) {
    var c = Math.round(Number(patch.hintCost) || 0);
    if (!(c >= 0 && c <= 100)) throw new Error('A hint can cost from 0 to 100 points.');
    x.hintCost = c;
  }
  if (patch.tools) Object.keys(WSX_TOOLS).forEach(function (k) { if (patch.tools[k] !== undefined) x.tools[k] = !!patch.tools[k]; });
  saveExtras_(a.id, x);
  return api_t_extras(token, id);
}

// The notes or slides PDF shown beside the worksheet. An empty b64 removes it.
function api_t_wsNotes(token, id, b64, fileName) {
  teacher_(token);
  var a = findAssignment_(id);
  if (!a) throw new Error('That worksheet was not found.');
  var x = wsExtras_(a.id), folder = folder_('WORKS'), name = hubClean_(a.id + ' ' + a.title + ' - notes') + '.pdf';
  var old = folder.getFilesByName(name);
  while (old.hasNext()) old.next().setTrashed(true);
  if (!b64) { x.notes = ''; x.notesName = ''; }
  else {
    var bytes = Utilities.base64Decode(b64);
    if (bytes.length < 5 || String.fromCharCode.apply(null, bytes.slice(0, 4)) !== '%PDF') throw new Error('The notes must be a PDF. In PowerPoint or Google Slides, save or download the slides as a PDF first.');
    x.notes = folder.createFile(Utilities.newBlob(bytes, 'application/pdf', name)).getId();
    x.notesName = String(fileName || 'Notes').replace(/\.pdf$/i, '').slice(0, 80);
  }
  saveExtras_(a.id, x);
  return api_t_extras(token, id);
}

function helpSheet_() {
  var ss = hubSheet_(TABS.students.name).getParent(), sh = ss.getSheetByName(HELP_TAB.name);
  if (!sh) {
    sh = ss.insertSheet(HELP_TAB.name);
    sh.getRange(1, 1, 1, HELP_TAB.headers.length).setValues([HELP_TAB.headers]).setFontWeight('bold').setBackground('#e8eef7');
    sh.setFrozenRows(1);
    sh.getRange('A:A').setNumberFormat('d mmm yyyy, h:mm am/pm');
    sh.getRange('B:D').setNumberFormat('@');
    sh.getRange('G:G').setNumberFormat('@');
    sh.setColumnWidth(10, 360);
  }
  return sh;
}
function helpRows_(id) {
  var sh = helpSheet_(), last = sh.getLastRow();
  if (last < 2) return [];
  return sh.getRange(2, 1, last - 1, HELP_TAB.headers.length).getValues().map(function (r, i) {
    return { row: i + 2, time: r[0] instanceof Date ? r[0] : new Date(r[0] || 0), id: String(r[1] || ''), cls: hubNormClass_(r[2]), reg: String(r[3] || ''),
      name: String(r[4] || ''), kind: String(r[5] || ''), q: String(r[6] || ''), page: Number(r[7]) || 0, value: String(r[8] == null ? '' : r[8]), note: String(r[9] || '') };
  }).filter(function (h) { return h.cls && h.name && (!id || h.id === id); });
}
function mineOf_(rows, s) { return rows.filter(function (h) { return h.cls === s.cls && hubNormName_(h.name) === hubNormName_(s.name); }); }

// What the student sees in the editor. Hint texts are only sent once the student has opened them.
function studentExtras_(a, s) {
  var x = wsExtras_(a.id), mine = mineOf_(helpRows_(a.id), s), used = {}, stuck = [], conf = {};
  mine.forEach(function (h) {
    if (h.kind === 'Hint') used[h.value] = true;
    if (h.kind === 'Stuck' && h.value === 'Yes') stuck.push(h.q);
    if (h.kind === 'Confidence' && Number(h.value) > 0) conf[h.q] = Number(h.value);
  });
  var nudge = nudgeState_();
  return {
    formula: x.formula,
    hints: x.tools.hints ? x.hints.map(function (h) { return { id: h.id, q: h.q, used: !!used[h.id], text: used[h.id] ? h.text : '' }; }) : [],
    hintCost: x.hintCost, tools: x.tools, notes: !!(x.tools.notes && x.notes), notesName: x.notesName,
    nudge: !!(x.tools.nudge && nudge.on), stuck: stuck, conf: conf
  };
}

function studentWs_(token, id) {
  var s = who_(token), a = findAssignment_(id);
  if (!a || !canSee_(a, s)) throw new Error('This worksheet was not found.');
  return { s: s, a: a };
}

// kind: 'stuck' (value true or false) or 'conf' (value 1 not sure, 2 getting there, 3 got it, 0 to clear).
function api_flag(token, id, kind, q, value, page) {
  var c = studentWs_(token, id), s = c.s, a = c.a;
  q = String(q || '').trim().slice(0, 12);
  if (!q) throw new Error('Choose a question first.');
  var K = kind === 'stuck' ? 'Stuck' : kind === 'conf' ? 'Confidence' : '';
  if (!K) throw new Error('Unknown flag.');
  var val = '';
  if (K === 'Stuck') val = value ? 'Yes' : '';
  else { var v = Math.round(Number(value) || 0); if (!(v >= 0 && v <= 3)) throw new Error('Unknown flag.'); val = v || ''; }
  var lock = hubLock_();
  lock.waitLock(30000);
  try {
    var sh = helpSheet_(), old = mineOf_(helpRows_(a.id), s).filter(function (h) { return h.kind === K && h.q.toLowerCase() === q.toLowerCase(); })[0];
    var row = [new Date(), a.id, s.cls, s.reg, s.name, K, q, Math.round(Number(page) || 0) || '', val, K === 'Confidence' && val ? CONF_NAMES[val] : ''];
    if (old) sh.getRange(old.row, 1, 1, row.length).setValues([row]);
    else if (val !== '') sh.appendRow(row);
  } finally { lock.releaseLock(); }
  var ex = studentExtras_(a, s);
  return { stuck: ex.stuck, conf: ex.conf };
}

// Opens one hint. If the teacher set a cost, it is paid the first time only.
function api_hint(token, id, hintId) {
  var c = studentWs_(token, id), s = c.s, a = c.a, x = wsExtras_(a.id), h = null;
  x.hints.forEach(function (y) { if (y.id === hintId) h = y; });
  if (!h || !x.tools.hints) throw new Error('That hint was not found.');
  var lock = hubLock_(), cost = 0;
  lock.waitLock(30000);
  try {
    var used = mineOf_(helpRows_(a.id), s).some(function (r) { return r.kind === 'Hint' && r.value === h.id; });
    if (!used) {
      if (x.hintCost > 0) {
        var rules = rwRules_(), L = rwLedger_(s, getAssignments_(), submissionIndex_(), rwLog_(), rules, rwItems_(rules));
        if (L.points < x.hintCost) throw new Error('This hint costs ' + rwN_(x.hintCost, 'point', 'points') + '. You have ' + rwN_(L.points, 'point', 'points') + '.');
        rwSheet_('log').appendRow([new Date(), s.cls, s.reg, s.name, 'Hint', a.id + ':' + h.id, -x.hintCost, 0, '', '', a.title + (h.q ? ' ' + h.q : '')]);
        cost = x.hintCost;
      }
      helpSheet_().appendRow([new Date(), a.id, s.cls, s.reg, s.name, 'Hint', h.q, '', h.id, cost ? 'Paid ' + rwN_(cost, 'point', 'points') : '']);
    }
  } finally { lock.releaseLock(); }
  return { id: h.id, q: h.q, text: h.text, cost: cost };
}

function api_notes(token, id) {
  var c = studentWs_(token, id), x = wsExtras_(c.a.id), f = null;
  if (x.notes && x.tools.notes) { try { f = DriveApp.getFileById(x.notes); if (f.isTrashed()) f = null; } catch (e) { f = null; } }
  if (!f) throw new Error('Your teacher has not added notes for this worksheet.');
  return { name: x.notesName || 'Notes', pdf: Utilities.base64Encode(f.getBlob().getBytes()) };
}

// Sorts question labels the way they are numbered: Q2 before Q10, 3a before 3b.
function qOrder_(a, b) {
  var na = Number((String(a).match(/\d+/) || [1e9])[0]), nb = Number((String(b).match(/\d+/) || [1e9])[0]);
  return na - nb || String(a).localeCompare(String(b));
}

// For the Hub: who is stuck where, how sure the class feels about each question, and hint use.
function api_t_help(token, id) {
  teacher_(token);
  var a = findAssignment_(id);
  if (!a) throw new Error('That worksheet was not found.');
  var rows = helpRows_(a.id), stuck = {}, conf = {}, hints = {}, nudges = [], x = wsExtras_(a.id);
  var when = function (t) { return Utilities.formatDate(t, TZ, 'd MMM, h:mm a'); };
  rows.forEach(function (h) {
    var who = { cls: h.cls, name: h.name, when: when(h.time), page: h.page || null };
    if (h.kind === 'Stuck' && h.value === 'Yes') (stuck[h.q] = stuck[h.q] || []).push(who);
    if (h.kind === 'Confidence' && Number(h.value) > 0) {
      var c = (conf[h.q] = conf[h.q] || { q: h.q, counts: [0, 0, 0], names: [[], [], []] }), v = Number(h.value) - 1;
      c.counts[v]++; c.names[v].push(h.name);
    }
    if (h.kind === 'Hint') { var k = h.value; (hints[k] = hints[k] || { id: k, q: h.q, n: 0, names: [] }).n++; hints[k].names.push(h.name); }
    if (h.kind === 'Nudge') nudges.push({ cls: h.cls, name: h.name, q: h.q, when: when(h.time), text: h.note });
  });
  var hintList = x.hints.map(function (y) { var u = hints[y.id]; return { id: y.id, q: y.q, text: y.text, n: u ? u.n : 0, names: u ? u.names : [] }; });
  return {
    stuck: Object.keys(stuck).sort(qOrder_).map(function (q) { return { q: q, n: stuck[q].length, names: stuck[q] }; }),
    conf: Object.keys(conf).sort(qOrder_).map(function (q) { return conf[q]; }),
    hints: hintList, hintCost: x.hintCost, nudges: nudges.reverse().slice(0, 30)
  };
}

// For the dashboard: { worksheetId: { n: students stuck, top: { q, n } } }, not counting the TEST class.
function stuckIndex_() {
  var by = {};
  helpRows_().forEach(function (h) {
    if (h.kind !== 'Stuck' || h.value !== 'Yes' || h.cls === 'TEST') return;
    var w = (by[h.id] = by[h.id] || { who: {}, q: {} });
    w.who[h.cls + '|' + hubNormName_(h.name)] = true;
    w.q[h.q] = (w.q[h.q] || 0) + 1;
  });
  var out = {};
  Object.keys(by).forEach(function (id) {
    var w = by[id], top = null;
    Object.keys(w.q).sort(qOrder_).forEach(function (q) { if (!top || w.q[q] > top.n) top = { q: q, n: w.q[q] }; });
    out[id] = { n: Object.keys(w.who).length, top: top };
  });
  return out;
}

/* ---------- Ask Claude for a nudge (off unless the teacher turns it on) ---------- */
//
// Sends only a picture of the part of the page the student chose, never their name, to Claude
// through the Anthropic API with the school's own API key. Claude is told to ask a guiding question
// and never to give the answer. Check the school's rules on AI tools and student data first.

var NUDGE_MODEL = 'claude-haiku-4-5-20251001';
var NUDGE_PER_DAY = 6;
var NUDGE_SYSTEM = [
  'You are a patient science tutor helping a lower secondary student in Singapore with homework.',
  'The student is stuck and has sent a picture of one question and their working so far.',
  'Help them think. Never do the work for them.',
  'Never give the final answer, a number that answers the question, the right option letter, or a finished sentence they could copy.',
  'Reply with ONE short nudge of at most 3 sentences and 60 words: a guiding question, a reminder of the idea or formula that applies, or the part of their working to check again.',
  'Use simple, friendly English. If their working so far is right, say so and ask what the next step is.',
  'If the picture is not a school science question, say you can only help with the worksheet.',
  'Do not ask for or mention personal details.'
].join(' ');

function nudgeState_() {
  var p = PropertiesService.getScriptProperties(), key = p.getProperty('NUDGE_KEY') || '';
  return { on: p.getProperty('NUDGE_ON') === 'yes' && !!key, hasKey: !!key, ends: key ? key.slice(-4) : '' };
}
function api_t_nudge(token) { teacher_(token); return nudgeState_(); }
function api_t_setNudge(token, patch) {
  teacher_(token);
  var p = PropertiesService.getScriptProperties();
  patch = patch || {};
  if (patch.key !== undefined) {
    var k = String(patch.key || '').trim();
    if (k && !/^sk-ant-[A-Za-z0-9_\-]{20,}$/.test(k)) throw new Error('That does not look like a Claude API key. It starts with sk-ant- and comes from console.anthropic.com (API keys).');
    if (k) p.setProperty('NUDGE_KEY', k); else { p.deleteProperty('NUDGE_KEY'); p.setProperty('NUDGE_ON', 'no'); }
  }
  if (patch.on !== undefined) {
    if (patch.on && !p.getProperty('NUDGE_KEY')) throw new Error('Paste the school\'s Claude API key first.');
    p.setProperty('NUDGE_ON', patch.on ? 'yes' : 'no');
  }
  return nudgeState_();
}

// img: a JPEG of the part of the page the student is stuck on, as base64.
function api_nudge(token, id, q, img) {
  var c = studentWs_(token, id), s = c.s, a = c.a, x = wsExtras_(a.id), st = nudgeState_();
  if (!st.on || !x.tools.nudge) throw new Error('Ask Claude is not turned on for this worksheet.');
  img = String(img || '');
  if (!img || img.length > 1500000 || !/^[A-Za-z0-9+\/=]+$/.test(img)) throw new Error('That picture is too big. Zoom in on one question and try again.');
  q = String(q || '').trim().slice(0, 12);
  var cache = CacheService.getScriptCache(), ck = 'ndg_' + a.id + '_' + studentKey_(s) + '_' + Utilities.formatDate(new Date(), TZ, 'yyyyMMdd');
  var used = Number(cache.get(ck)) || 0;
  if (used >= NUDGE_PER_DAY) throw new Error('You have used all ' + NUDGE_PER_DAY + ' nudges for this worksheet today. Try a hint, or ask your teacher tomorrow.');
  var res = UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', {
    method: 'post', contentType: 'application/json', muteHttpExceptions: true,
    headers: { 'x-api-key': PropertiesService.getScriptProperties().getProperty('NUDGE_KEY'), 'anthropic-version': '2023-06-01' },
    payload: JSON.stringify({ model: NUDGE_MODEL, max_tokens: 250, system: NUDGE_SYSTEM, messages: [{ role: 'user', content: [
      { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: img } },
      { type: 'text', text: 'I am stuck on ' + (q ? 'question ' + q : 'this question') + '. Please give me one nudge, not the answer.' }
    ] }] })
  });
  var code = res.getResponseCode(), body = parseJson_(res.getContentText()) || {};
  if (code !== 200) throw new Error(code === 401 || code === 403 ? 'Ask Claude is not set up properly. Tell your teacher.' : code === 429 || code === 529 ? 'Claude is busy. Try again in a minute.' : 'Claude could not answer just now. Try again later.');
  var text = (body.content || []).filter(function (b) { return b.type === 'text'; }).map(function (b) { return b.text; }).join('\n').trim().slice(0, 800);
  if (!text) throw new Error('Claude could not answer just now. Try again later.');
  cache.put(ck, String(used + 1), 21600);
  helpSheet_().appendRow([new Date(), a.id, s.cls, s.reg, s.name, 'Nudge', q, '', '', text]);
  return { text: text, left: NUDGE_PER_DAY - used - 1 };
}


/* ------------------------------------------------------------------ */
/* My folders and notes (students)                                     */
/* ------------------------------------------------------------------ */
// Each student can sort their homework into folders, give a worksheet their own name and colour, and
// keep up to NOTE_MAX notes of their own to write on. The worksheet itself never changes: the teacher
// always sees the real title. The teacher can read every note (Tracker > a student > Notes).
// One small file per student holds the folders, names and colours; each note's writing is its own file.
var NOTE_MAX = 3, NOTE_PAGES = 20, FOLDER_MAX = 20;
var ORG_COLOURS = ['blue', 'green', 'pink', 'amber', 'purple', 'red', 'teal', 'grey'];
var NOTE_PAPERS = ['blank', 'lined', 'grid', 'graph'];

function orgName_(s) { return 'org_' + hubClean_(s.cls + '_' + hubNormName_(s.name)) + '.json'; }
function noteName_(s, id) { return 'note_' + hubClean_(s.cls + '_' + hubNormName_(s.name) + '_' + id) + '.json'; }
function notesFile_(name) {
  var it = folder_('NOTES').getFilesByName(name);
  while (it.hasNext()) { var f = it.next(); if (!f.isTrashed()) return f; }
  return null;
}
function readOrg_(s) {
  var f = notesFile_(orgName_(s)), o = null;
  if (f) { try { o = JSON.parse(f.getBlob().getDataAsString()); } catch (e) { o = null; } }
  o = o || {};
  return { v: 1, folders: Array.isArray(o.folders) ? o.folders : [], items: o.items && typeof o.items === 'object' && !Array.isArray(o.items) ? o.items : {},
    notes: Array.isArray(o.notes) ? o.notes : [] };
}
function writeOrg_(s, o) {
  var text = JSON.stringify(o), f = notesFile_(orgName_(s));
  if (f) f.setContent(text); else folder_('NOTES').createFile(orgName_(s), text, 'application/json');
}
function orgText_(v, max) { return String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max); }
function orgColour_(c) { return ORG_COLOURS.indexOf(c) >= 0 ? c : ''; }
function orgId_() { return 'f' + Utilities.getUuid().replace(/-/g, '').slice(0, 11); }
function orgLock_(fn) {
  var lock = hubLock_();
  lock.waitLock(15000);
  try { return fn(); } finally { lock.releaseLock(); }
}

// The student's folders, names, colours and notes.
function api_org(token) {
  var s = who_(token);
  return readOrg_(s);
}

// Saves the folders and the names, colours and folders of worksheets and notes. Notes are made and
// deleted only by api_note_new and api_note_delete, so this cannot add or remove one.
function api_org_save(token, json) {
  var s = who_(token);
  var inp = typeof json === 'string' ? JSON.parse(json) : (json || {});
  return orgLock_(function () {
    var cur = readOrg_(s), out = { v: 1, folders: [], items: {}, notes: [] }, ids = {};
    (Array.isArray(inp.folders) ? inp.folders : []).slice(0, FOLDER_MAX).forEach(function (f) {
      var name = orgText_(f && f.name, 40);
      if (!name) return;
      var id = /^f[a-z0-9]{6,15}$/.test(String(f.id)) && !ids[f.id] ? String(f.id) : orgId_();
      ids[id] = true;
      out.folders.push({ id: id, name: name, color: orgColour_(f.color) || 'blue' });
    });
    var n = 0, items = inp.items && typeof inp.items === 'object' ? inp.items : {};
    Object.keys(items).forEach(function (k) {
      if (n >= 400 || !/^[A-Za-z0-9_\-]{1,40}$/.test(k)) return;
      var it = items[k] || {}, e = {};
      if (it.f && ids[it.f]) e.f = it.f;
      var nm = orgText_(it.n, 60); if (nm) e.n = nm;
      var c = orgColour_(it.c); if (c) e.c = c;
      if (e.f || e.n || e.c) { out.items[k] = e; n++; }
    });
    var byId = {};
    (Array.isArray(inp.notes) ? inp.notes : []).forEach(function (x) { if (x && x.id) byId[x.id] = x; });
    cur.notes.forEach(function (note) {
      var x = byId[note.id];
      if (x) {
        var t = orgText_(x.title, 60); if (t) note.title = t;
        note.f = x.f && ids[x.f] ? x.f : '';
        note.c = orgColour_(x.c);
      } else if (note.f && !ids[note.f]) note.f = '';
      out.notes.push(note);
    });
    writeOrg_(s, out);
    return out;
  });
}

function api_note_new(token, title, paper, folderId) {
  var s = who_(token);
  return orgLock_(function () {
    var org = readOrg_(s);
    if (org.notes.length >= NOTE_MAX) throw new Error('You already have ' + NOTE_MAX + ' notes. Delete one to make a new one.');
    var now = Date.now();
    var note = { id: 'n' + Utilities.getUuid().replace(/-/g, '').slice(0, 11), title: orgText_(title, 60) || 'My note',
      paper: NOTE_PAPERS.indexOf(paper) >= 0 ? paper : 'lined', f: org.folders.some(function (f) { return f.id === folderId; }) ? folderId : '',
      c: '', created: now, updated: now, pages: 1 };
    folder_('NOTES').createFile(noteName_(s, note.id), JSON.stringify({ v: 1, t: now, extra: 0, pages: [[]] }), 'application/json');
    org.notes.push(note);
    writeOrg_(s, org);
    return { org: org, note: note };
  });
}

function noteOf_(org, id) {
  for (var i = 0; i < org.notes.length; i++) if (org.notes[i].id === id) return org.notes[i];
  throw new Error('That note was not found. It may have been deleted.');
}

function api_note_open(token, id) {
  var s = who_(token), note = noteOf_(readOrg_(s), String(id));
  var f = notesFile_(noteName_(s, note.id));
  return { note: note, draft: f ? f.getBlob().getDataAsString() : null };
}

function api_note_save(token, id, json) {
  var s = who_(token);
  if (typeof json !== 'string' || !json) throw new Error('Nothing to save.');
  if (json.length > 4000000) throw new Error('This note is too big to save. Start a new note for more writing.');
  var d = JSON.parse(json), pages = Array.isArray(d.pages) ? d.pages.length : 1;
  if (pages > NOTE_PAGES) throw new Error('A note can have up to ' + NOTE_PAGES + ' pages.');
  return orgLock_(function () {
    var org = readOrg_(s), note = noteOf_(org, String(id));
    var f = notesFile_(noteName_(s, note.id));
    if (f) f.setContent(json); else folder_('NOTES').createFile(noteName_(s, note.id), json, 'application/json');
    note.updated = Date.now(); note.pages = Math.max(1, pages);
    writeOrg_(s, org);
    return Utilities.formatDate(new Date(), TZ, 'h:mm a');
  });
}

function api_note_delete(token, id) {
  var s = who_(token);
  return orgLock_(function () {
    var org = readOrg_(s), note = noteOf_(org, String(id));
    var f = notesFile_(noteName_(s, note.id));
    if (f) f.setTrashed(true);
    org.notes = org.notes.filter(function (x) { return x.id !== note.id; });
    writeOrg_(s, org);
    return org;
  });
}

// The teacher reads a student's notes.
function api_t_notes(token, cls, name) {
  teacher_(token);
  var s = hubFindStudent_(hubNormClass_(cls), name);
  if (!s) throw new Error('That student was not found.');
  var org = readOrg_(s), fname = {};
  org.folders.forEach(function (f) { fname[f.id] = f.name; });
  return org.notes.map(function (n) {
    return { id: n.id, title: n.title, paper: n.paper, pages: n.pages || 1, folder: fname[n.f] || '',
      updated: n.updated ? Utilities.formatDate(new Date(n.updated), TZ, 'd MMM, h:mm a') : '' };
  });
}

function api_t_note(token, cls, name, id) {
  teacher_(token);
  var s = hubFindStudent_(hubNormClass_(cls), name);
  if (!s) throw new Error('That student was not found.');
  var note = noteOf_(readOrg_(s), String(id));
  var f = notesFile_(noteName_(s, note.id));
  return { note: note, draft: f ? f.getBlob().getDataAsString() : null, label: Ink_label_(s) };
}
function Ink_label_(s) { return s.cls + '  ' + (s.reg ? (String(s.reg).length < 2 ? '0' : '') + s.reg + '  ' : '') + s.name; }

/* ------------------------------------------------------------------ */
/* Homework linked to sub-chapters, Needs you from Live Board, the week */
/* ------------------------------------------------------------------ */
//
// A worksheet from the library can be linked to a sub-chapter of a lesson (Lessons, Homework). When Live Board
// says a class has been taught that sub-chapter (the presenter stepped through to its end), the Hub sets the
// worksheet for that class by itself, due at the start of the class's next lesson, and it runs hands-off: work
// hands itself in at the due time and Claude marks it (when connected). Script properties:
//   WSL|<lesson id>|<part>          { file, name, t, num, at }   the link
//   WSD|<lesson id>|<part>|<CLASS>  { id, at } | { wait, after } | { err, at, n } | { seen }   what happened for a class
// <part> is the textbook number ('3.2') when the sub-chapter has one, '#2' for the third part when it has none,
// and '#all' for a lesson with no parts. Only lessons taught after the link was made count (at), and each class
// gets each link's worksheet once.

var STUCK_MIN = 3;                 // Needs you shows a stuck question once this many students are stuck on it
var LINK_PREFIX = 'WSL|', DONE_PREFIX = 'WSD|';
var LINK_SYNC_SECS = 600;          // ask Live Board what was taught at most every 10 minutes
var LINK_TRIES = 3;                // a worksheet that could not be set is tried again, 3 times in all

function linkKey_(deck, part) { return String(deck || '').slice(0, 120) + '|' + String(part == null ? '' : part).slice(0, 20); }
// Every link, with what happened for each class (from one read of the properties).
function wsLinksAll_() {
  var all = PropertiesService.getScriptProperties().getProperties(), out = {}, done = {};
  Object.keys(all).forEach(function (k) {
    if (k.indexOf(LINK_PREFIX) === 0) { var v = parseJson_(all[k]); if (v && v.file) out[k.slice(LINK_PREFIX.length)] = v; }
    else if (k.indexOf(DONE_PREFIX) === 0) { var r = k.slice(DONE_PREFIX.length), i = r.lastIndexOf('|'); (done[r.slice(0, i)] = done[r.slice(0, i)] || {})[r.slice(i + 1)] = parseJson_(all[k]) || {}; }
  });
  Object.keys(out).forEach(function (k) { out[k].done = done[k] || {}; });
  return out;
}
function doneKey_(k, cls) { return DONE_PREFIX + k + '|' + cls; }
function clearDone_(k, keepSet) {
  var props = PropertiesService.getScriptProperties(), all = props.getProperties();
  Object.keys(all).forEach(function (p) {
    if (p.indexOf(DONE_PREFIX + k + '|') !== 0) return;
    var d = parseJson_(all[p]) || {};
    if (keepSet && d.id) return;
    props.deleteProperty(p);
  });
}
function claudeOn_() {
  var p = PropertiesService.getScriptProperties();
  return !!(p.getProperty('CLAUDE_FIRE_URL') && p.getProperty('CLAUDE_FIRE_TOKEN'));
}
// The 15-minute timer is wanted while a worksheet hands in or marks by itself, or a sub-chapter has homework linked.
function tickWanted_() { return Object.keys(wsAuto_()).length > 0 || Object.keys(wsLinksAll_()).length > 0 || autoLinkOn_(); }
// Live Board writes class names without spaces, dashes or dots ("2-A" is "2A"): the Hub's own name for it.
function lbClassKey_(c) { return String(c || '').toUpperCase().replace(/[\s\-_.]+/g, ''); }
function hubClassFor_(lbCls, byClass) {
  var k = lbClassKey_(lbCls), hit = '';
  Object.keys(byClass || studentsByClass_()).forEach(function (c) { if (lbClassKey_(c) === k) hit = c; });
  return hit;
}

// Every link, by lesson: { deckId: { part: { name, t, num, at, file, done: { CLASS: 'WS12' } } } }.
function api_t_links(token) {
  teacher_(token);
  var all = wsLinksAll_(), ready = readyAll_(), out = {};
  Object.keys(all).forEach(function (k) {
    var i = k.lastIndexOf('|'), deck = k.slice(0, i), part = k.slice(i + 1);
    (out[deck] = out[deck] || {})[part] = linkView_(all[k], k, ready);
  });
  return out;
}
// One link as the Hub shows it: the worksheet, the classes it is deployed to (their worksheet ids), and the classes
// that have been taught the part since (ready to deploy, with their next lesson).
function linkView_(L, k, ready) {
  var done = {};
  Object.keys(L.done || {}).forEach(function (c) { var d = L.done[c]; if (d && d.id) done[c] = d.id; });
  return { file: L.file, name: L.name, t: L.t || '', num: L.num || '', at: L.at || 0, done: done, auto: !!L.auto, ready: readyFor_(k, ready) };
}
// Link a library worksheet to a sub-chapter (fileId '' removes the link). back: hours to look back, so a class
// that has just finished the sub-chapter gets it too (0 = only lessons from now on).
function api_t_setLink(token, deck, part, fileId, t, num, back) {
  teacher_(token);
  deck = String(deck || '').slice(0, 120); part = String(part == null ? '' : part).slice(0, 20);
  if (!deck || !part) throw new Error('No sub-chapter was chosen.');
  var props = PropertiesService.getScriptProperties(), k = linkKey_(deck, part), key = LINK_PREFIX + k;
  // "No homework": kept, so the worksheet with this sub-chapter's number is not linked by itself.
  if (fileId === 'none') {
    props.setProperty(key, JSON.stringify({ file: 'none', name: 'No homework', t: String(t || '').slice(0, 80), num: String(num || '').slice(0, 12), at: Date.now() }));
    clearDone_(k, true);
    return { file: 'none', name: 'No homework', t: String(t || ''), num: String(num || ''), at: Date.now(), done: {} };
  }
  if (!fileId) {
    props.deleteProperty(key);
    clearDone_(k, true);      // classes that had it keep it (so a worksheet linked again by its number is not set twice)
    ensureTick_(tickWanted_());
    return null;
  }
  var f = libFile_(fileId);
  if (!libOk_(LIB_KINDS[f.getMimeType()])) libPdfBytes_(f);   // says why (a Word or PowerPoint file)
  var old = parseJson_(props.getProperty(key)) || {}, same = old.file === f.getId();
  var since = Date.now() - Math.max(0, Math.min(72, Number(back) || 0)) * 3600000;
  var v = { file: f.getId(), name: libBase_(f.getName()).slice(0, 80), t: String(t || '').slice(0, 80), num: String(num || '').slice(0, 12),
    at: same && old.at ? Math.min(old.at, since) : since };
  props.setProperty(key, JSON.stringify(v));
  clearDone_(k, same);   // the same worksheet again: classes that had it keep it, and anything that failed is tried again
  ensureTick_(true);
  CacheService.getScriptCache().remove('link_sync');   // look at once
  var done = {}, dn = same ? ((wsLinksAll_()[k] || {}).done || {}) : {};
  Object.keys(dn).forEach(function (c) { if (dn[c].id) done[c] = dn[c].id; });
  return { file: v.file, name: v.name, t: v.t, num: v.num, at: v.at, done: done };
}
// A worksheet that could not be set by itself: the teacher has seen why.
function api_t_linkSeen(token, k, cls) {
  teacher_(token);
  var props = PropertiesService.getScriptProperties(), dk = doneKey_(String(k || ''), String(cls || '')), d = parseJson_(props.getProperty(dk));
  if (d && d.err) props.setProperty(dk, JSON.stringify({ seen: true }));
  return true;
}

function linkSince_(links) {
  var keys = Object.keys(links), at = Date.now(), al = autoLinkSince_();
  if (al) at = Math.min(at, al);
  keys.forEach(function (k) { at = Math.min(at, links[k].at || at); });
  return Math.max(at, Date.now() - 14 * 86400000);
}
// Whether a class is finished with a link: set, put away, being set right now, or failed 3 times.
function linkDone_(d) {
  if (!d) return false;
  if (d.wait) return Date.now() - d.wait < 3600000;                       // a claim older than an hour failed
  if (d.err) return (d.n || 1) >= LINK_TRIES || Date.now() - (d.at || 0) < 30 * 60000;
  if (d.id) return Date.now() - (d.at || 0) < 200 * 86400000;            // next year's class of the same name gets it again
  return true;
}
function wsNum_(id) { var m = /^WS(\d+)$/i.exec(String(id || '')); return m ? Number(m[1]) : 0; }
// Notes the sub-chapters Live Board says were taught, for each class, as ready to deploy (nothing is set by itself).
// starts: [{ cls, deck, parts: [{ i, num, t }], at, next }].
function setFromTaught_(links, starts) {
  try { links = autoLinks_(links, starts); } catch (e) { /* linked by hand only, this time */ }
  var todo = [], known = studentsByClass_();
  (starts || []).forEach(function (s) {
    var cls = hubClassFor_(s.cls, known);
    if (!cls) return;                                    // not a class on the Students tab (or TEST): nothing is set
    (s.parts || []).forEach(function (p) {
      var keys = p.num ? [linkKey_(s.deck, p.num)] : [linkKey_(s.deck, Number(p.i) < 0 ? '#all' : '#' + p.i)];
      keys.forEach(function (k) {
        var L = links[k];
        if (!L || L.file === 'none') return;             // No homework for this sub-chapter
        if (!p.num && L.t && p.t && L.t !== p.t) return;   // linked by its place, but the lesson's parts have changed since
        if (!(Number(s.at) >= (L.at || 0)) || linkDone_((L.done || {})[cls])) return;
        var had = todo.filter(function (x) { return x.k === k && x.cls === cls; })[0];
        if (had) had.next = Math.max(had.next, Number(s.next) || 0);   // taught again: due at the lesson after the latest
        else todo.push({ k: k, cls: cls, next: Number(s.next) || 0, t: p.t || L.t || '', L: L, deck: s.deck });
      });
    });
  });
  if (!todo.length) return [];
  // Release 22: homework waits in the chapter's package until the teacher deploys it. What was taught is kept, so the
  // package shows the part as ready, due at the class's next lesson.
  noteReady_(todo);
  return [];
}
// From the timer: what was taught since the oldest link, at most every 10 minutes.
function syncTaught_(force) {
  var links = wsLinksAll_();
  if (!Object.keys(links).length && !autoLinkOn_()) return [];
  var cache = CacheService.getScriptCache();
  if (!force && cache.get('link_sync')) return [];
  cache.put('link_sync', '1', LINK_SYNC_SECS);
  var r = lbAsk_('taught', { since: linkSince_(links) });
  return setFromTaught_(links, r.starts || []);
}
// For the dashboard: Let in requests from Live Board, and (every 10 minutes) what was taught, in one request.
function liveNeeds_() {
  var cache = CacheService.getScriptCache(), links = wsLinksAll_(), sync = (Object.keys(links).length > 0 || autoLinkOn_()) && !cache.get('link_sync');
  if (!sync) { var hit = parseJson_(cache.get('lb_needs')); if (hit) return hit; }
  var extra = {};
  if (sync) { extra.since = linkSince_(links); cache.put('link_sync', '1', LINK_SYNC_SECS); }
  var r = lbAsk_('needs', extra), out = { help: r.help || [], old: !r.help };
  try { cache.put('lb_needs', JSON.stringify(out), 20); } catch (e) { /* asked again next time */ }
  if (sync && r.starts) setFromTaught_(links, r.starts);
  return out;
}

// A worksheet set from the library without a marked solution (another class's copy was set first): when the
// library has one by now (the teacher approved it on that copy), it is used, so Claude can mark this one too.
function libSolutionPull_(a) {
  var cache = CacheService.getScriptCache(), miss = 'lsp_' + a.id;
  if (cache.get(miss)) return '';                       // looked a moment ago: Drive is asked at most every 10 minutes
  try {
    var fid = libLinksCached_()[a.id];
    if (!fid) return '';
    var folder = DriveApp.getFolderById(fid);
    if (folder.isTrashed()) return '';
    var roles = libRoles_(folder);
    if (!roles.sol) { cache.put(miss, '1', 600); return ''; }
    var name = hubClean_(a.id + ' ' + a.title + ' - marked solution') + '.pdf';
    var file = folder_('WORKS').createFile(Utilities.newBlob(libPdfBytes_(roles.sol), 'application/pdf', name));
    ensureAssignmentCols_();
    hubSheet_(TABS.assignments.name).getRange(a.row, 13).setValue(file.getUrl());
    return file.getUrl();
  } catch (e) { return ''; }
}

// Needs you items that are not about one worksheet: prizes to hand out, students asking to be let in, and the
// homework the Hub set by itself (or could not set).
function extraNeeds_(now, live) {
  var items = [];
  try {
    var byCls = {};
    rwLog_().forEach(function (e) {
      if (e.what !== 'Market' || e.done || e.cls === 'TEST') return;
      (byCls[e.cls] = byCls[e.cls] || []).push({ row: e.row, name: e.name, prize: e.note || e.item, code: e.code, when: Utilities.formatDate(e.time, TZ, 'd MMM') });
    });
    Object.keys(byCls).sort().forEach(function (c) {
      var n = byCls[c].length;
      items.push({ level: 'info', action: 'prizes', kind: 'prizes', cls: c, classes: [c], count: n, list: byCls[c], text: rwN_(n, 'prize', 'prizes') + ' to hand out in ' + c + '.' });
    });
  } catch (e) { /* no night market yet */ }
  var known = studentsByClass_();
  ((live && live.help) || []).forEach(function (h) {
    items.push({ level: 'warn', action: 'letin', kind: 'letin', cls: h.cls, classes: [hubClassFor_(h.cls, known) || h.cls], name: h.name, gkey: h.key, twice: !!h.twice, at: h.at,
      text: h.name + ' (' + h.cls + ') is asking you to let them in to set up their PIN' + (h.twice ? '. Two iPads are asking for this name.' : '.') });
  });
  var links = wsLinksAll_(), titles = {};
  getAssignments_().forEach(function (a) { titles[a.id] = a; });
  Object.keys(links).forEach(function (k) {
    var L = links[k];
    Object.keys(L.done || {}).forEach(function (c) {
      var d = L.done[c];
      if (d.id && d.by !== 't' && titles[d.id] && now.getTime() - (d.at || 0) < 86400000) {
        items.push({ level: 'info', action: 'open', kind: 'autoset', id: d.id, classes: [c], part: L.t || '',
          text: titles[d.id].title + ' was set for ' + c + ' by itself (' + (L.t || 'sub-chapter taught') + '), due ' + titles[d.id].due + '.' });
      } else if (d.err && (d.n || 1) >= LINK_TRIES) {
        items.push({ level: 'warn', action: 'linkerr', kind: 'linkerr', k: k, cls: c, classes: [c], name: L.name, part: L.t || '',
          text: L.name + ' could not be set for ' + c + ' by itself: ' + d.err });
      }
    });
  });
  return items;
}

function api_t_letin(token, cls, gkey, yes) {
  teacher_(token);
  var r = lbAsk_('letin', { cls: String(cls || ''), gkey: String(gkey || ''), yes: !!yes });
  CacheService.getScriptCache().remove('lb_needs');
  return { ok: r.ok !== false };
}

/* ---------- This week: one page on how each class is doing ----------
   For each class: last week's homework (handed in out of how many, and who is missing what), what is due this
   week, students who have not set up their PIN yet, and chapter checks under the pass mark (from Live Board).
   The Hub shows it on Home the first time it opens each week, and any time from the menu. */
function summary_() {
  var now = new Date(), WEEK = 7 * 86400000, t = now.getTime();
  var subs = submissionIndex_(), assigns = getAssignments_().filter(function (a) { return a.fileId && !a.practice; }), byClass = studentsByClass_();
  var lb = null;
  try { lb = lbAsk_('summary').classes || null; } catch (e) { lb = null; }
  var classes = Object.keys(byClass).sort().map(function (cls) {
    var mine = assignsForClass_(assigns, cls), kids = byClass[cls];
    var last = mine.filter(function (a) { return a.dueAt && a.dueAt.getTime() <= t && a.dueAt.getTime() > t - WEEK; });
    var next = mine.filter(function (a) { return a.dueAt && a.dueAt.getTime() > t && a.dueAt.getTime() <= t + WEEK; });
    var missing = {};
    var lastOut = last.map(function (a) {
      var handed = 0;
      kids.forEach(function (s) { if (subs[a.id + '|' + studentKey_(s)]) handed++; else (missing[s.name] = missing[s.name] || []).push(a.title); });
      return { id: a.id, title: a.title, handed: handed, total: kids.length };
    });
    var L = (lb || []).filter(function (x) { return x.cls === cls; })[0] || null;
    return { cls: cls, size: kids.length, last: lastOut, next: next.map(function (a) { return { id: a.id, title: a.title, due: a.due }; }),
      missing: Object.keys(missing).sort().map(function (n) { return { name: n, ws: missing[n] }; }),
      noPin: L ? L.noPin || [] : null, below: L ? L.below || [] : null };
  });
  var mon = new Date(t - ((Number(Utilities.formatDate(now, TZ, 'u')) || 1) - 1) * 86400000);
  return { week: Utilities.formatDate(mon, TZ, 'yyyy-MM-dd'), label: 'Week of ' + Utilities.formatDate(mon, TZ, 'd MMMM'), lb: !!lb, classes: classes };
}
function summaryHtml_(s) {
  var e = esc_, h = '';
  s.classes.forEach(function (c) {
    h += '<section class="wk-c"><h3>' + e(c.cls) + ' <small>' + c.size + ' students</small></h3>';
    if (c.last.length) h += '<p class="wk-l">Last week</p><ul>' + c.last.map(function (w) {
      return '<li><b>' + e(w.title) + '</b> ' + w.handed + ' of ' + w.total + ' handed in</li>'; }).join('') + '</ul>';
    if (c.missing.length) h += '<p class="wk-l">Not handed in</p><p class="wk-n">' + c.missing.map(function (m) {
      return e(m.name) + (m.ws.length > 1 ? ' (' + m.ws.length + ')' : ''); }).join(', ') + '</p>';
    if (c.next.length) h += '<p class="wk-l">Due this week</p><ul>' + c.next.map(function (w) { return '<li>' + e(w.title) + ' <small>' + e(w.due) + '</small></li>'; }).join('') + '</ul>';
    if (c.below && c.below.length) {
      var decks = {}, order = [];
      c.below.forEach(function (b) { if (!decks[b.deck]) { decks[b.deck] = []; order.push(b.deck); } decks[b.deck].push(b); });
      h += '<p class="wk-l">Chapter checks under the pass mark</p>' + order.map(function (d) {
        return '<p class="wk-n"><small>' + e(d) + '</small><br>' + decks[d].map(function (b) { return e(b.name) + ' ' + b.pct + '%'; }).join(', ') + '</p>'; }).join('');
    }
    if (c.noPin && c.noPin.length) h += '<p class="wk-l">No PIN yet</p><p class="wk-n">' + c.noPin.map(e).join(', ') + '</p>';
    var more = weekClassHtml_(c);
    h += more;
    if (!more && !c.last.length && !c.next.length && !c.missing.length && !(c.below && c.below.length) && !(c.noPin && c.noPin.length)) h += '<p class="wk-n">Nothing to report.</p>';
    h += '</section>';
  });
  return h || '<p class="wk-n">No classes yet.</p>';
}
function api_t_summary(token) {
  teacher_(token);
  var s = summary_();
  try { weekExtras_(s); } catch (e) { /* the week without the extras */ }
  return { week: s.week, label: s.label, lb: s.lb, html: summaryHtml_(s) + weekExtrasHtml_(s), classes: s.classes, unused: s.unused || null };
}

/* ------------------------------------------------------------------ */
/* Release 22: homework is deployed by the teacher                     */
/* ------------------------------------------------------------------ */
// The parts taught to each class, not deployed yet: { 'deck|part|CLASS': { at, next } } (one property).
var READY_KEY = 'HW_READY';
function readyAll_() { return parseJson_(PropertiesService.getScriptProperties().getProperty(READY_KEY)) || {}; }
function readyFor_(k, all) {
  var out = {};
  all = all || readyAll_();
  Object.keys(all).forEach(function (id) {
    var i = id.lastIndexOf('|');
    if (id.slice(0, i) === k) out[id.slice(i + 1)] = { at: all[id].at || 0, next: all[id].next || 0 };
  });
  return out;
}
function noteReady_(todo) {
  var lock = hubLock_();
  if (lock.tryLock && !lock.tryLock(5000)) return;
  try {
    var props = PropertiesService.getScriptProperties(), all = parseJson_(props.getProperty(READY_KEY)) || {}, changed = false, now = Date.now();
    todo.forEach(function (x) {
      var id = x.k + '|' + x.cls, old = all[id], next = Number(x.next) || 0;
      if (old && (old.next || 0) >= next) return;
      all[id] = { at: now, next: next };
      changed = true;
    });
    // Kept 60 days (and not once deployed); the oldest go first if it grows too big.
    var links = null;
    try { links = wsLinksAll_(); } catch (e) { links = null; }
    Object.keys(all).forEach(function (id) {
      var i = id.lastIndexOf('|'), L = links ? links[id.slice(0, i)] : null, d = L && L.done ? L.done[id.slice(i + 1)] : null;
      if (now - (all[id].at || 0) > 60 * 86400000 || (d && d.id)) { delete all[id]; changed = true; }
    });
    if (!changed) return;
    var keys = Object.keys(all).sort(function (a, b) { return (all[a].at || 0) - (all[b].at || 0); });
    while (JSON.stringify(all).length > 8000 && keys.length) delete all[keys.shift()];
    props.setProperty(READY_KEY, JSON.stringify(all));
  } finally { if (lock.releaseLock) lock.releaseLock(); }
}
// A part deployed to a class is not waiting any more.
function readyDrop_(k, cls) {
  var lock = hubLock_();
  if (lock.tryLock && !lock.tryLock(5000)) return;
  try {
    var props = PropertiesService.getScriptProperties(), all = parseJson_(props.getProperty(READY_KEY)) || {};
    if (!all[k + '|' + cls]) return;
    delete all[k + '|' + cls];
    props.setProperty(READY_KEY, JSON.stringify(all));
  } finally { if (lock.releaseLock) lock.releaseLock(); }
}
// Deploy a part's homework to a class (from the chapter's package in Lessons). meta: the due date and time and how it
// runs, as for any worksheet; t and num name the part. file: the library worksheet with the part's number, when no
// link was made by hand (it is kept as the part's link). Deploying twice gives the worksheet already deployed.
function api_t_deployPart(token, deck, part, cls, meta, file) {
  teacher_(token);
  meta = meta || {};
  deck = String(deck || '').slice(0, 120); part = String(part == null ? '' : part).slice(0, 20);
  if (!deck || !part) throw new Error('No part of a lesson was chosen.');
  var hubCls = hubClassFor_(cls) || String(cls || '').trim().slice(0, 40);
  if (!hubCls) throw new Error('Choose a class.');
  if (meta.autoHandIn && !meta.dueDate) throw new Error('Choose a due date, so the saved work can be handed in then.');
  var props = PropertiesService.getScriptProperties(), k = linkKey_(deck, part), L = parseJson_(props.getProperty(LINK_PREFIX + k));
  if (L && L.file === 'none') throw new Error('This part is set to No homework. Press Homework beside the lesson to link a worksheet.');
  if (!L || !L.file) {
    if (!file) throw new Error('No worksheet is linked to this part. Press Homework beside the lesson to link one.');
    var f = libFile_(String(file));
    L = { file: f.getId(), name: libBase_(f.getName()).slice(0, 80), t: String(meta.t || '').slice(0, 80), num: String(meta.num || '').slice(0, 12), at: autoLinkSince_() || Date.now(), auto: true };
    props.setProperty(LINK_PREFIX + k, JSON.stringify(L));
    ensureTick_(true);
  }
  var dk = doneKey_(k, hubCls), lock = hubLock_(), d = null;
  lock.waitLock(20000);
  try {
    d = parseJson_(props.getProperty(dk));
    if (d && d.wait && Date.now() - d.wait < 180000) throw new Error('It is being deployed already. Give it a moment.');
    if (!(d && d.id && findAssignment_(d.id))) { d = null; props.setProperty(dk, JSON.stringify({ wait: Date.now() })); }
  } finally { lock.releaseLock(); }
  var id = d ? d.id : '';
  if (!id) {
    try {
      var all = wsLinksAll_(), others = (all[k] || {}).done || {};
      // Claude drafts a marked solution once, for the first class to get it; the others take the saved one.
      var first = !Object.keys(others).some(function (c) { return c !== hubCls && others[c] && others[c].id; });
      var on = claudeOn_(), mark = !!meta.autoMark && on;
      var out = newFromLibrary_({ classes: [hubCls], dueDate: String(meta.dueDate || ''), dueTime: String(meta.dueTime || ''), open: true,
        autoHandIn: !!meta.autoHandIn, autoClose: !!(meta.autoClose || meta.autoHandIn), autoMark: mark, corrDays: Math.max(0, Math.min(60, Number(meta.corrDays) || 0)),
        answersAfter: !!meta.answersAfter, draftSolution: mark && first, chapter: (chapterOfDeck_(deck) || {}).key || '' }, L.file);
      id = out.id;
      props.setProperty(dk, JSON.stringify({ id: id, at: Date.now(), by: 't' }));   // deployed by the teacher (not "set by itself")
      readyDrop_(k, hubCls);
    } catch (e) {
      props.deleteProperty(dk);
      throw e;
    }
  }
  var L2 = wsLinksAll_()[k] || L;
  return { id: id, cls: hubCls, already: !!d, link: linkView_(L2, k) };
}


/* ---------- Release 24: Undo, straight after Deploy ----------
   The Undo on the note after Deploy. Only for a worksheet made in the last 15 minutes that nobody has handed in:
   its row in Assignments is emptied (the Hub skips empty rows, and worksheet numbers are never used twice), its
   files go to the bin, and the part shows as not deployed again (and taught and ready, if it was).
   back: { deck, part, cls, ready: { at, next } } for a part's homework; nothing for a topical worksheet. */
function api_t_undeploy(token, id, back) {
  teacher_(token);
  id = String(id || '').trim();
  var a = findAssignment_(id);
  if (!a) return { gone: true };
  var f = driveFile_(a.fileId);
  if (!f || !f.getDateCreated || Date.now() - f.getDateCreated().getTime() > 15 * 60000) throw new Error('That was deployed too long ago to undo here. Open the worksheet to close it or change it.');
  var props = PropertiesService.getScriptProperties(), lock = hubLock_(), keep = {};
  lock.waitLock(20000);
  try {
    var b = findAssignment_(id);
    if (!b) return { gone: true };
    var subs = submissionIndex_(), pre = b.id + '|';
    if (Object.keys(subs).some(function (k) { return k.indexOf(pre) === 0; })) throw new Error('Someone has handed it in already, so it stays. Open the worksheet to close it.');
    // files another worksheet also points at are not put in the bin
    getAssignments_().forEach(function (o) { if (o.id !== id) [o.fileId, fileIdFromLink_(o.solutionLink), fileIdFromLink_(o.answerLink)].forEach(function (x) { if (x) keep[x] = 1; }); });
    var sh = hubSheet_(TABS.assignments.name), width = Math.max(18, sh.getLastColumn ? sh.getLastColumn() : 18), blank = [];
    for (var i = 0; i < width; i++) blank.push('');
    var rg = sh.getRange(b.row, 1, 1, width);
    if (rg.clearDataValidations) rg.clearDataValidations();
    rg.setValues([blank]);
    // Its part is not deployed to the class any more.
    var all = props.getProperties();
    Object.keys(all).forEach(function (k) {
      if (k.indexOf(DONE_PREFIX) !== 0) return;
      var d = parseJson_(all[k]);
      if (d && d.id === id) props.deleteProperty(k);
    });
  } finally { lock.releaseLock(); }
  if (back && back.deck && back.cls && back.ready) {
    try { noteReady_([{ k: linkKey_(back.deck, back.part), cls: hubClassFor_(back.cls) || String(back.cls), next: Number(back.ready.next) || 0 }]); } catch (e) { /* it shows as not taught */ }
  }
  // Its files, and what was kept for it.
  [a.fileId, fileIdFromLink_(a.solutionLink), fileIdFromLink_(a.answerLink)].forEach(function (fid) {
    var x = fid && !keep[fid] ? driveFile_(fid) : null;
    if (x) { try { x.setTrashed(true); } catch (e) { /* left in Drive */ } }
  });
  [stateName_(a), solName_(a)].forEach(function (nm) {
    try { var st = folder_('DRAFTS').getFilesByName(nm); while (st.hasNext()) st.next().setTrashed(true); } catch (e) { /* none */ }
  });
  try { props.deleteProperty('WSX_' + id); } catch (e) { /* none */ }
  try { setAuto_(id, { handIn: false, mark: false }); } catch (e) { /* none */ }
  try { setPractice_(id, false); } catch (e) { /* none */ }
  try { props.deleteProperty('JOB_' + id); } catch (e) { /* none */ }
  try { var ic = wsIcons_(); if (ic[id]) { delete ic[id]; props.setProperty('WS_ICONS', JSON.stringify(ic)); } } catch (e) { /* none */ }
  try { var ll = libLinks_(); if (ll[id]) { delete ll[id]; libSaveLinks_(ll); } } catch (e) { /* none */ }
  try {
    var src = parseJson_(props.getProperty('LIB_SRC')) || {}, changed = false;
    Object.keys(src).forEach(function (k) {
      var v = (src[k] || []).filter(function (w) { return w !== id; });
      if (v.length !== (src[k] || []).length) { changed = true; if (v.length) src[k] = v; else delete src[k]; }
    });
    if (changed) props.setProperty('LIB_SRC', JSON.stringify(src));
  } catch (e) { /* none */ }
  try { libDrop_(); } catch (e) { /* none */ }
  return { ok: true };
}
