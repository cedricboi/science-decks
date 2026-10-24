(function () {
  'use strict';
  /* Live Board bridge, version 13. Added to every deck by scripts/liveboard_connect.py.
     The deck's own code is not changed.
     1. Who are you? Students choose their class, then their name, from the class list
        (the Worksheet Hub Students tab, served by Live Board). The choice is locked on
        the iPad for every deck on the same website. Changing it needs the teacher PIN.
     2. When the deck sends answers to Live Board, this adds each question's text,
        options, answer and slide, the chapter check questions, and the deck's own
        address, so Live Board needs no connect step, can list the deck under Lessons,
        and can give Worksheet Hub points for the chapter check.
     3. Ask now: when the teacher asks one of this deck's questions from Live Board, a
        card at the top of the deck shows the question and its choices, and the student
        answers right there (it goes through the deck's own Check, so it is saved and sent
        like any other answer). "See the slide" folds the card away to show the slide. The same check, every
        10 seconds, tells Live Board which slide the student is on (the teacher's live pulse).
     4. After the chapter check is marked, it shows the student their result and any
        Worksheet Hub points it earned.
     5. Answers that did not reach Live Board (a busy moment, a dropped connection) are sent
        again by themselves after a short random wait, so they never sit on the iPad until
        the student answers something else. The 10-second check is also spread out a little,
        so a class of iPads does not ask at the same instant.
     Version 7 adds lesson control from Live Board, carried on the same check:
     6. Follow me (the iPad moves to the teacher's slide and stays at or behind it), Pause
        ("Eyes on the board"), Stop at (today's last slide), the chapter check locked until the
        teacher opens it, Hold answers (feedback and model answers hidden until released),
        whole-class slides (hooks) done together, and videos played on the board.
     7. Presenter mode: the deck opened with #present at the end of its address, after the
        teacher PIN and the class being taught (which starts the lesson for that class). No name
        is asked, nothing is saved, and the slide shown is the
        slide the class follows. Pause and Follow are on the teacher's phone.
     8. Time on each slide (a page counts as read after the teacher's read time), an ID for
        each iPad, the number of answers waiting to send, and where the student is, so Live
        Board can show read, skimmed, stuck, offline and two iPads under one name. The record
        is sent every couple of minutes as the student moves, so opened pages are kept.
     9. The screen stays awake while the lesson is open, a note says when the iPad is offline,
        the checklist on the last slide is numbered like the slides and shows work done on any
        iPad, the register number confirms the name, and the teacher can reset a name from
        Live Board. How often the iPad checks is set by Live Board (more often while the
        teacher is asking or leading).
     10. Revise: My mistakes (the questions answered wrong the first time, from any iPad, each with
        its slide, ticked off once put right) and Practise (the chapter check, or the deck's questions,
        in a new order with new numbers; no points, nothing sent). On the last slide, by the name, and
        from learnwithmrcedric (#revise). Closed while the class's answers are held.
     11. One home: the slides opened from the Teacher Hub (#present&cls=..&part=..&at=..&tk=..) are signed
        in and know the class and the part, so nothing is asked. While presenting, Results (on every slide)
        shows how the class answered the questions on the slide, with no names. A student cannot change
        their own name (the teacher resets it from the phone), and a student whose register number does not
        match asks the teacher's phone to be let in, so no PIN is typed on a student's iPad.
     12. Version 8: each student signs in with their own 4-digit PIN (set up in learnwithmrcedric, with a security question
        for a forgotten PIN), or comes already signed in from learnwithmrcedric. The sign-in goes with every answer and check,
        and Live Board takes the name from it. Once signed in, the name stays on the iPad until the teacher changes it
        (their PIN on the iPad, or Sign out on the phone). Work counts only while the teacher is teaching this lesson to
        the student's class. At other times the lesson is for revision if the teacher has opened it to the class:
        nothing the student does is kept on the iPad or counted by Live Board, and a note says so. A lesson not opened says it is not
        open yet.
     13. Version 9: when Live Board says a newer bridge is on the site, the slides reload themselves once (not while
        presenting, with answers waiting, or with a panel open), so nobody has to ask for an old copy to be reloaded.
     14. Version 10: slides opened by the projector screen (pj=... in the address, from Teach on the phone) check in
        every 5 seconds, and when Live Board says so they open the next lesson the phone chose, or go back to the
        projector screen after End. A reload keeps this; slides opened by hand never move by themselves.
     15. Version 11: on the projector, Show answers (at the bottom of a slide with a question, and in the Presenting
        line) puts the class's answers up full size: the whole question, then a bar chart of the choices, or a wall
        of the answers the class wrote (no names). It follows the slide and fills in as answers come.
     16. Version 12: no Reveal answer on the projector (Show answers does that). A student who goes past the teacher's
        slide sees "You are ahead of your teacher" on any slide: a stop with Follow on, a note at the bottom with
        Follow off. Following is quicker: the projector tells Live Board the moment its slide changes, and a student's
        iPad checks in every 3 seconds all through a lesson, and straight after the student changes slide.
     17. Version 13: no class list on the iPad. With Live Board release 26 the sign-in has the classes only: the
        student types their own name and PIN, checked together. With an older Live Board the list of names still
        works, but it is kept in memory only, and a copy kept on the iPad before is removed.
     18. Version 14: the Streak Challenge. On the chapter check slide the projector can run the check as a class game,
        one question at a time. Speed gives nothing: right answers earn points, and answers right in a row earn a streak
        bonus. Each iPad shows the student's own result and place, the projector the top 5 and the longest streaks, and
        the final score becomes Worksheet Hub points, once per deck (the solo chapter check is scored the same way).
     19. Version 15 (release 34, one canonical copy in kit/liveboard-bridge.v15.js, put into every deck by
        tools/inject-bridge.js):
        - Sign-in is a name and a password of 6 to 60 characters. A deck opened from the app (#lb=..&st=ticket) is
          signed in with the ticket and shows no box. There is no guest button while the student's class lesson is
          live (the roster reply's liveCls). "Not you? Sign out" replaces the teacher PIN on the iPad.
        - No silent loss: an answer Live Board did not list in acceptedIds or heldIds stays in the bridge's own
          outbox on the iPad and is sent again. Held answers (made just before the lesson) are sent again at Start.
        - The page never reloads itself while the class's lesson is live, or while answers are waiting to send.
        - Together moves the step as well as the slide (lead.step). Typed drafts are kept on the iPad before any
          jump, and a card holding a draft is never redrawn by a jump.
        - Quick checks open in a dock over the lower 35% of the deck. One tap answers ({api:'qa'}), the answer can
          be changed until the check closes, and the student's own result and the counts show only after it closes.
        - Presenter: the step and the slide kind go with lead. A strip with a status pill and a menu (quick check,
          Eyes on me, Together or Own pace, Show answers, End with a 4 second Undo) calls t_do through the deck
          channel ({api:'tdo'}). Keys: arrows and PgUp/PgDn move slides, B or . gives Eyes on me and blanks the
          projector, A shows answers, Q opens the quick check picker, T switches Together and Own pace, E ends with
          Undo. While a paired phone is live, the presenter long-polls for its commands ({api:'pgo'}) and draws
          Show on screen (bars or words, never names).
        - Arcade games send one score row per game instead of one row per round. */
  var cfgEl = document.getElementById('wave-tracking-config');
  if (!cfgEl || !window.fetch || window.__liveBoardBridge) return;
  window.__liveBoardBridge = true;
  var cfg;
  try { cfg = JSON.parse(cfgEl.textContent); } catch (e) { return; }
  if (!cfg.endpoint) return;

  var VERSION = 15;
  /* Older iPads (Safari before 16) have no AbortSignal.timeout, which newer decks use when they send answers;
     without it their answers would never send. */
  try {
    if (window.AbortSignal && !AbortSignal.timeout && window.AbortController) {
      AbortSignal.timeout = function (ms) { var c = new AbortController(); setTimeout(function () { c.abort(); }, ms); return c.signal; };
    }
  } catch (e) { /* nothing to add */ }
  var ID_KEY = 'liveboard.identity', ROSTER_KEY = 'liveboard.roster', DEV_KEY = 'liveboard.device';
  try { window.localStorage.removeItem(ROSTER_KEY); } catch (e) { /* none kept */ }   // version 13: never kept on the iPad
  var PRES_KEY = 'liveboard.presenter', PRES_CLS = 'liveboard.presenterClass';
  var DWELL_KEY = 'liveboard.dwell:' + (cfg.topicId || '');
  var original = window.fetch;
  function readJ(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } }
  function writeJ(k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }

  /* ---------------- in the lesson, or revision ----------------
     live: the teacher is teaching this lesson to the student's class, so the deck keeps and sends everything as usual.
     revise / closed: outside that lesson nothing the deck saves is kept on the iPad (it is held in memory until the page
     closes). wait: not known yet (just opened, or offline in class). What the deck saves is kept, with a note of what
     was there before, so nothing done in class is lost; if the lesson turns out not to be on, it is put back.
     Answers are always sent while signed in: Live Board decides what counts (only the lesson, and answers made in it
     that arrive up to an hour after End). The bridge's own notes (liveboard.*) are always kept. */
  var LIVE_KEY = 'liveboard.live:' + (cfg.topicId || ''), OLD_KEY = 'liveboard.oldlb';
  /* Live Board not updated yet (it does not know student sign-ins): the slides work as before, with no PIN and
     everything sent, until it is. */
  function oldLb() { var o = readJ(OLD_KEY); return !!(o && Date.now() - o < 86400000); }
  var presentEarly = /(?:^#|&)present(?:&|$)/.test(location.hash);
  var mode = 'wait', shadow = {}, undo = {}, LS = null, realGet = null;
  try { LS = window.localStorage; } catch (e) { LS = null; }
  (function () {
    var me = readJ(ID_KEY), lv = readJ(LIVE_KEY);
    if (presentEarly) mode = 'live';
    if (me && me.cls && !me.st && oldLb()) mode = 'live';
  })();
  if (LS && window.Storage && !presentEarly) {
    (function () {
      var sp = window.Storage.prototype, rSet = sp.setItem, rGet = sp.getItem, rDel = sp.removeItem, rClear = sp.clear;
      var deckKey = function (st, k) { return st === LS && !/^liveboard\./.test(String(k)); };
      var hold = function () { return mode === 'revise' || mode === 'closed'; };
      var note = function (k) { if (mode === 'wait' && !Object.prototype.hasOwnProperty.call(undo, k)) undo[k] = rGet.call(LS, k); };
      sp.setItem = function (k, v) { if (deckKey(this, k)) { if (hold()) { shadow[k] = String(v); return; } note(k); delete shadow[k]; } return rSet.apply(this, arguments); };
      sp.getItem = function (k) { if (this === LS && Object.prototype.hasOwnProperty.call(shadow, k)) return shadow[k]; return rGet.apply(this, arguments); };
      sp.removeItem = function (k) { if (deckKey(this, k)) { if (hold()) { shadow[k] = null; return; } note(k); delete shadow[k]; } return rDel.apply(this, arguments); };
      sp.clear = function () {
        if (this !== LS || mode === 'live') return rClear.apply(this, arguments);
        var ks = []; for (var i = 0; i < LS.length; i++) ks.push(LS.key(i));
        ks.forEach(function (k) { if (!/^liveboard\./.test(String(k))) LS.removeItem(k); });
      };
      realGet = function (k) { return rGet.call(LS, k); };
    })();
  }
  function setMode(m) {
    if (m === mode || !LS || !realGet) { mode = m; try { drawMode(); } catch (e) { /* before the page is ready */ } return; }
    var was = mode;
    if (m === 'live') {
      mode = 'live';
      var keep = shadow; shadow = {}; undo = {};
      Object.keys(keep).forEach(function (k) { try { if (keep[k] === null) LS.removeItem(k); else LS.setItem(k, keep[k]); } catch (e) { /* storage full */ } });
    } else if ((m === 'revise' || m === 'closed') && was === 'wait') {
      // Not the lesson after all: what was kept since the page opened goes back, and is held in memory instead.
      var back = undo; undo = {};
      mode = 'live';   // write straight through for the restore
      Object.keys(back).forEach(function (k) {
        shadow[k] = realGet(k);
        try { if (back[k] === null) LS.removeItem(k); else LS.setItem(k, back[k]); } catch (e) { /* storage full */ }
      });
      mode = m;
    } else mode = m;
    try { drawMode(); } catch (e) { /* before the page is ready */ }
  }
  /* learnwithmrcedric (the student page): signing in for the first time, and Forgot my PIN, are there. */
  var MS_URL = String(cfg.endpoint || '').replace(/[?#].*$/, '');
  function stNow() { var me = readJ(ID_KEY); return me && me.st ? me.st : ''; }

  /* One request to Live Board. When nothing comes back it is tried once more a moment later. A failure
     carries its kind: 'net' (no answer at all: offline, or a network that blocks Google Apps Script),
     'http' (an error page) or 'page' (a web page that is not Live Board, such as a sign-in page). */
  function api(body, again) {
    return original.call(window, cfg.endpoint, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body) })
      .then(function (r) {
        if (!r.ok) { var e1 = new Error('HTTP ' + r.status); e1.kind = 'http'; throw e1; }
        return r.text().then(function (t) {
          try { return JSON.parse(t); } catch (x) { var e2 = new Error('not Live Board'); e2.kind = 'page'; throw e2; }
        });
      }, function () {
        if (!again) return new Promise(function (ok) { setTimeout(ok, 1200); }).then(function () { return api(body, true); });
        var e3 = new Error('no answer'); e3.kind = 'net'; throw e3;
      });
  }
  /* What went wrong, in words, with a link that opens Live Board's own check page in a new tab. */
  function failNote(box, err, what) {
    box.textContent = '';
    var k = err && err.kind;
    box.appendChild(document.createTextNode(k === 'http' || k === 'page'
      ? what + ' needs Live Board, and the Live Board link in this lesson gave ' + (k === 'http' ? 'an error (' + err.message + ')' : 'a web page instead of an answer') + '. The link may be old. '
      : what + ' needs Live Board, and this device could not reach it. It may be offline, or its network may block Google Apps Script. '));
    var a = el('a', 'lbx-test', 'Test the connection'); a.href = cfg.endpoint + '?api=build'; a.target = '_blank'; a.rel = 'noopener';
    a.title = 'Opens Live Board in a new tab. It should show {"app":"liveboard", ...}. A sign-in or blocked page means this device cannot reach it.';
    box.appendChild(a);
    box.appendChild(el('span', 'lbx-testhint', 'It should open a page that starts {"app":"liveboard". A sign-in or blocked page means this device cannot reach Live Board.'));
  }
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  var DEV = readJ(DEV_KEY);
  if (!DEV) { DEV = 'd' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4); writeJ(DEV_KEY, DEV); }

  /* ---------------- questions for Live Board ---------------- */
  var list = [], order = {}, byId = {};
  try { list = JSON.parse(document.getElementById('lesson-tasks').textContent) || []; } catch (e) { list = []; }
  // Version 15: questions on slides parked out of the lesson (#l-held) are not this deck's questions.
  list = list.filter(function (t) { var e = t && t.slide ? document.getElementById(t.slide) : null; return !!t && !(e && e.closest && e.closest('#l-held')); });
  list.forEach(function (t, i) { order[t.id] = i; byId[t.id] = t; });
  var title = '', checkIds = [], summaryId = '', CHECK_ON = true;
  try {
    var man = JSON.parse(document.getElementById('science-topic-manifest').textContent) || {};
    title = man.title || '';
    summaryId = man.summaryId || '';
    checkIds = (Array.isArray(man.quizTasks) ? man.quizTasks : []).filter(function (id) { return byId[id]; });
    // Version 15: a quiz is the chapter check unless the manifest says chapterCheck: false (a lesson's exit ticket).
    CHECK_ON = man.chapterCheck !== false;
  } catch (e) { title = ''; }
  if (!title) title = document.title;
  var CHECK_NAME = CHECK_ON ? 'chapter check' : 'exit ticket';
  /* Arcade games (#lesson-game): their rounds go to Live Board as one score row per game. */
  var GAME = null;
  try {
    var gEl = document.getElementById('lesson-game'), g0 = gEl ? JSON.parse(gEl.textContent) : null;
    if (g0 && g0.id && !byId[g0.id]) GAME = { id: String(g0.id), slide: g0.slide || g0.id, title: g0.title || 'Game', win: Number(g0.win_score) || 0,
      rounds: Array.isArray(g0.rounds) ? g0.rounds.length : 0 };
  } catch (e) { GAME = null; }
  var sentKey = 'liveboard.q3:' + cfg.topicId + ':' + cfg.endpoint + ':' + list.length;
  var deckUrl = /^https:$/.test(location.protocol) ? location.origin + location.pathname : '';

  function slideOf(t) {
    var e = t.slide ? document.getElementById(t.slide) : null;
    var s = e ? (e.classList.contains('slide') ? e : e.closest('.slide')) : null;
    if (!s) { var h = document.querySelector('[data-task="' + t.id + '"]'); s = h ? h.closest('.slide') : null; }
    if (!s) return { n: 0, title: '' };
    var all = slideList();
    var h1 = s.querySelector('h1');
    return { n: all.indexOf(s) + 1, title: h1 ? h1.textContent.replace(/\s+/g, ' ').trim() : '' };
  }
  function describe(t) {
    var s = slideOf(t);
    return { id: t.id, question: t.question, kind: t.kind, options: t.options || [],
      correct: t.correct == null ? '' : String(t.correct), model: t.model || '', unit: t.unit || '',
      order: order[t.id], slideNo: s.n, slideTitle: s.title };
  }
  function sentAll() { try { return localStorage.getItem(sentKey) === '1'; } catch (e) { return false; } }

  window.fetch = function (url, opts) {
    var batch = null;
    try {
      if (String(url) === cfg.endpoint && opts && typeof opts.body === 'string') {
        var b = JSON.parse(opts.body);
        if (b && Number(b.version) === 2 && Array.isArray(b.events)) batch = b;
      }
    } catch (e) { batch = null; }
    if (batch) return sendBatch(url, opts, batch);
    return original.call(window, url, opts);
  };
  function slideKinds() { return slideList().map(function (s, i) { return { n: i + 1, id: s.id || '', kind: s.getAttribute('data-kind') || '' }; }); }
  /* Adds what Live Board needs to know about the deck to a batch of answers. */
  function enrich(b) {
    var info = {}, withAll = false;
    b.events.forEach(function (e) {
      var t = byId[e.task]; if (t && !info[t.id]) info[t.id] = describe(t);
      if (GAME && e.task === GAME.id && !info[GAME.id]) info[GAME.id] = gameInfo();
      if (e.action === 'submit') dropDrafts(e.task);
      if (mode !== 'revise' && mode !== 'closed') noteFirst(e);
      if (asking && e.task === asking.taskId && e.action === 'submit') answeredAsk();
    });
    b.liveBoard = { deckTitle: title, questions: info, deckUrl: deckUrl, chapterCheck: CHECK_ON ? checkIds : [], chapterCheckOn: CHECK_ON,
      slideCount: slideCount(), read: readIds(), dev: DEV, v: VERSION, st: stNow() };
    if (!sentAll()) { b.liveBoard.allQuestions = list.map(describe); b.liveBoard.slides = slideKinds(); withAll = true; }
    return withAll;
  }
  /* One batch to Live Board, and what came back. Every event Live Board did not list in acceptedIds stays in the
     bridge's outbox (held ones until the lesson starts), so nothing is lost even when the deck itself thinks it
     was sent. */
  function postBatch(url, opts, b, mine) {
    var withAll = false;
    try { withAll = enrich(b); opts = Object.assign({}, opts, { body: JSON.stringify(b) }); } catch (e) { /* send it as it is */ }
    return original.call(window, url, opts).then(function (r) {
      if (!r || !r.ok) return { r: r, j: null };
      return r.clone().text().then(function (t) { var j = null; try { j = JSON.parse(t); } catch (x) { j = null; } return { r: r, j: j }; }, function () { return { r: r, j: null }; });
    }).then(function (x) {
      var j = x.j;
      if (withAll && j && j.ok) { try { localStorage.setItem(sentKey, '1'); } catch (e) {} }
      if (j && j.liveBoard && j.liveBoard.check) showCheck(j.liveBoard.check);
      if (j && j.liveBoard && j.liveBoard.signedOut) { signedOutHere(); return x; }
      if (j && j.ok === true && Array.isArray(j.acceptedIds)) {
        var acc = {}, held = {};
        j.acceptedIds.forEach(function (id) { acc[id] = 1; });
        (Array.isArray(j.heldIds) ? j.heldIds : []).forEach(function (id) { held[id] = 1; });
        var meta = { course: b.course, topicId: b.topicId, recordId: b.recordId, profile: b.profile };
        b.events.forEach(function (e) {
          if (!e || !e.id) return;
          if (acc[e.id]) outboxDel(e.id); else outboxPut(meta, e, !!held[e.id]);
        });
        outboxSave();
        x.taken = true;
      }
      return x;
    });
  }
  /* The deck's own batch: the deck is told every event arrived once the bridge holds what was not saved. */
  function sendBatch(url, opts, b) {
    var ids = b.events.map(function (e) { return e && e.id; }), rows = [];
    if (GAME) {
      b.events = b.events.filter(function (e) {
        if (!isRound(e)) return true;
        var row = noteRound(e);
        if (row) { rows.push(row); outboxPut({ course: b.course, topicId: b.topicId, recordId: b.recordId, profile: b.profile }, row, false); outboxSave(); outAt = Math.max(outAt, Date.now() + 5000); }
        return false;
      });
      b.events = b.events.concat(rows);
    }
    return postBatch(url, opts, b, true).then(function (x) {
      if (!x.taken) return x.r;
      var j = Object.assign({}, x.j, { acceptedIds: ids });
      delete j.heldIds;
      try { return new Response(JSON.stringify(j), { status: 200, headers: { 'Content-Type': 'application/json' } }); } catch (e) { return x.r; }
    });
  }

  /* ---------------- the outbox: answers Live Board has not saved yet ---------------- */
  var OUT_KEY = 'liveboard.outbox:' + (cfg.topicId || ''), outbox = readJ(OUT_KEY) || {};
  if (!outbox || typeof outbox !== 'object' || Array.isArray(outbox)) outbox = {};
  var outAt = 0, outFails = 0, outBusy = false, heldTry = 0, lessonLive = false;
  function outboxPut(meta, e, held) {
    var o = outbox[e.id] || { at: Date.now() };
    o.ev = e; o.rec = meta; o.held = held; outbox[e.id] = o;
  }
  function outboxDel(id) { delete outbox[id]; }
  function outboxSave() { writeJ(OUT_KEY, Object.keys(outbox).length ? outbox : null); }
  function outboxCount() { return Object.keys(outbox).length; }
  function flushOutbox() {
    if (outBusy || !outboxCount() || !stNow() || presenting || navigator.onLine === false || document.hidden) return;
    var now = Date.now(), due = [], waitHeld = false;
    Object.keys(outbox).forEach(function (id) {
      var o = outbox[id];
      if (!o || !o.ev) { delete outbox[id]; return; }
      // Held answers go again once the lesson is on (or after 25 minutes, when Live Board keeps them as practice).
      if (o.held) { if ((lessonLive && now - heldTry > 20000) || now - (o.at || 0) > 25 * 60000) due.push(o); else waitHeld = true; return; }
      if (now >= outAt) due.push(o);
    });
    if (!due.length) return;
    var rec = due[0].rec || {};
    var evs = due.filter(function (o) { return (o.rec || {}).recordId === rec.recordId; }).slice(0, 50).map(function (o) { return o.ev; });
    if (due.some(function (o) { return o.held; })) heldTry = now;
    outBusy = true;
    var b = { version: 2, course: rec.course || cfg.course || '', topicId: rec.topicId || cfg.topicId, recordId: rec.recordId || '', profile: rec.profile || {},
      currentSlide: (currentSlide() || {}).id || '', visits: [], events: evs };
    postBatch(cfg.endpoint, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(b) }, b, false)
      .then(function (x) { outBusy = false; if (x.taken) { outFails = 0; outAt = Date.now() + 1500; } else outFail(); }, function () { outBusy = false; outFail(); });
  }
  function outFail() { outFails++; outAt = Date.now() + Math.min(30000, 4000 * Math.pow(2, outFails - 1)) * (0.75 + Math.random() * 0.5); }
  setInterval(flushOutbox, 2000);

  /* ---------------- arcade: one score row per game ---------------- */
  var GAME_KEY = 'liveboard.game:' + (cfg.topicId || '');
  function isRound(e) {
    if (!GAME || !GAME.rounds || !e || typeof e.task !== 'string') return false;
    var p = GAME.id + '-r';
    return e.task.indexOf(p) === 0 && /^\d+$/.test(e.task.slice(p.length));
  }
  function gameInfo() {
    var sl = document.getElementById(GAME.slide), s = sl ? slideOf({ id: GAME.id, slide: GAME.slide }) : { n: 0, title: '' };
    return { id: GAME.id, question: GAME.title + ': score for one game', kind: 'written', options: [], correct: '', model: '', unit: '',
      order: list.length + 1, slideNo: s.n, slideTitle: s.title };
  }
  function noteRound(e) {
    var st = readJ(GAME_KEY) || {};
    st.seen = st.seen || {};
    if (st.seen[e.id]) return null;
    st.seen[e.id] = Date.now();
    var ks = Object.keys(st.seen);
    if (ks.length > 300) ks.sort(function (a, b) { return st.seen[a] - st.seen[b]; }).slice(0, ks.length - 300).forEach(function (k) { delete st.seen[k]; });
    var n = Number(e.task.slice(GAME.id.length + 2));
    if (n === 1 || !st.run) st.run = { start: e.id, score: 0, n: 0 };
    var m = /\((\d+) points?\)/.exec(String(e.answer || ''));
    st.run.score += m ? Number(m[1]) : (e.correct === true ? 10 : 0);
    st.run.n = n;
    var row = null;
    if (n >= GAME.rounds) {
      var sc = st.run.score, won = GAME.win ? sc >= GAME.win : null;
      row = { id: 'game-' + st.run.start, task: GAME.id, slide: GAME.slide, at: e.at || new Date().toISOString(),
        answer: 'Scored ' + sc + ' points in ' + n + ' rounds.' + (won === true ? ' Cleared.' : won === false ? ' Not cleared.' : ''),
        feedback: '', action: 'submit', valid: true, correct: won, assisted: false };
      st.run = null;
    }
    writeJ(GAME_KEY, st);
    return row;
  }


  /* ---------------- who are you ---------------- */
  var css = el('style');
  css.textContent =
    '.lbx{position:fixed;inset:0;z-index:2147483000;background:rgba(10,10,14,.82);display:flex;align-items:center;justify-content:center;padding:18px;font:17px/1.45 Arial,Helvetica,sans-serif;color:#101014}' +
    '.lbx-panel{background:#fff;border:3px solid #101014;box-shadow:9px 9px 0 #e9082b;width:min(480px,100%);padding:24px 24px 20px;max-height:94vh;overflow:auto}' +
    '.lbx h2{margin:0 0 6px;font:900 28px/1.1 "Arial Black",Arial,sans-serif;text-transform:none;letter-spacing:-.5px;background:none;color:#101014;box-shadow:none;transform:none;padding:0;display:block}' +
    '.lbx p{margin:0 0 16px;font-size:16px;background:none;border:0;padding:0;color:#3a3740}' +
    '.lbx label{display:block;font-weight:700;font-size:15px;margin:0 0 14px}' +
    '.lbx select,.lbx input{display:block;width:100%;margin-top:6px;font:18px Arial,sans-serif;padding:11px 12px;border:2px solid #101014;border-radius:0;background:#fff;color:#101014;min-height:48px}' +
    '.lbx .lbx-row{display:flex;gap:10px;flex-wrap:wrap;margin-top:6px}' +
    '.lbx button{font:900 16px Arial,sans-serif!important;padding:12px 18px!important;border:2px solid #101014!important;border-radius:0!important;background:#fff!important;color:#101014!important;cursor:pointer;min-height:46px;box-shadow:none!important;transform:none!important;text-transform:none!important;font-style:normal!important}' +
    '.lbx button.lbx-go{background:#e9082b!important;color:#fff!important;box-shadow:4px 4px 0 #101014!important;flex:1}' +
    '.lbx button:hover:not(:disabled){background:#101014!important;color:#fff!important}' +
    '.lbx button:disabled{opacity:.45;cursor:default}' +
    '.lbx .lbx-msg{color:#b70020;font-weight:700;min-height:0;margin:12px 0 0}' +
    '.lbx .lbx-msg:empty{display:none}' +
    '.lbx .lbx-test,.lbx-who .lbx-test{color:inherit;text-decoration:underline;font-weight:900}' +
    '.lbx .lbx-ms{display:block;text-align:center;margin:4px 0 12px;padding:12px 16px;border:2px solid #101014;background:#e9082b;color:#fff!important;font-weight:900;text-decoration:none;box-shadow:4px 4px 0 #101014}' +
    '.lbx .lbx-links{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-top:12px;font-size:15px}' +
    '.lbx .lbx-links a,.lbx .lbx-links button{background:none!important;border:0!important;box-shadow:none!important;padding:0!important;color:#101014!important;text-decoration:underline;font:700 15px Arial,sans-serif;cursor:pointer;min-height:0}' +
    '.lbx input.lbx-pin{font:900 28px Arial,sans-serif;letter-spacing:.5em;text-align:center}' +
    '.lbrev{position:fixed;left:50%;transform:translateX(-50%);top:calc(env(safe-area-inset-top,0px) + 86px);z-index:2147482800;background:#FFE45C;color:#101014;border:2px solid #101014;box-shadow:3px 3px 0 #101014;padding:7px 14px;font:700 14px/1.3 Arial,sans-serif;max-width:min(560px,92vw);text-align:center;cursor:pointer}' +
    '.lbrev.small span{display:none}.lbrev[hidden]{display:none!important}' +
    '.lbahead{position:fixed;left:50%;transform:translateX(-50%);bottom:calc(env(safe-area-inset-bottom,0px) + 78px);z-index:2147480990;display:flex;align-items:center;gap:14px;background:#101014;color:#fff;border:2px solid #101014;box-shadow:4px 4px 0 #FFE45C;padding:9px 9px 9px 16px;font:700 16px/1.3 Arial,Helvetica,sans-serif;width:max-content;max-width:min(620px,94vw);text-align:left;animation:lbAheadIn .25s ease-out}' +
    '.lbahead b{color:#FFE45C;font-weight:900;display:block}' +
    '.lbahead span{display:block;font-weight:400;font-size:14px;color:#e6e4dd}' +
    '.lbahead button{flex:none;font:900 15px Arial,sans-serif!important;background:#FFE45C!important;color:#101014!important;border:0!important;border-radius:0!important;padding:10px 14px!important;min-height:44px;cursor:pointer;white-space:nowrap;box-shadow:none!important;transform:none!important;text-transform:none!important}' +
    '.lbahead[hidden]{display:none!important}' +
    '.lbahead .lbahead-x{background:transparent!important;color:#fff!important;font-size:22px!important;padding:6px 8px!important;min-height:44px;min-width:40px}' +
    '@keyframes lbAheadIn{from{opacity:0;transform:translate(-50%,10px)}to{opacity:1;transform:translateX(-50%)}}' +
    '@media (prefers-reduced-motion:reduce){.lbahead{animation:none}}' +
    '.lbx .lbx-testhint{display:block;margin-top:6px;font-weight:400;font-size:13px;color:#3a3740}' +
    '.lbx-who .lbx-testhint{display:none}' +
    '.lbx button.lbx-skip{border:0!important;background:none!important;color:#3a3740!important;padding:6px 0!important;margin-top:14px;font-weight:400!important;font-size:14px!important;text-decoration:underline;min-height:0}' +
    '.lbx .lbx-classes{display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:10px;margin:2px 0 4px}' +
    '.lbx button.lbx-class{display:flex;flex-direction:column;align-items:flex-start;gap:2px;padding:14px 16px!important;min-height:64px;text-align:left}' +
    '.lbx button.lbx-class b{font:900 22px/1.1 "Arial Black",Arial,sans-serif}' +
    '.lbx button.lbx-class span{font:700 12px Arial,sans-serif;color:#12804f}' +
    '.lbx button.lbx-class.last{border-color:#e9082b!important;box-shadow:4px 4px 0 #e9082b!important}' +
    '.lbx button.lbx-class:hover:not(:disabled) span{color:#9be3c0}' +
    '.lbx .lbx-wait{color:#3a3740}' +
    '.lbx .lbx-big{font:900 24px/1.25 "Arial Black",Arial,sans-serif;margin:4px 0 16px;color:#101014}' +
    '.lbx-who{margin-top:18px;color:#f3e8d4;font:15px Arial,sans-serif;display:flex;gap:12px;align-items:center;flex-wrap:wrap}' +
    '.lbx-who b{color:#fff}' +
    '.lbr{position:fixed;left:50%;top:12px;transform:translateX(-50%);z-index:2147482500;width:min(620px,calc(100% - 24px));background:#fff;border:3px solid #101014;box-shadow:7px 7px 0 #101014;padding:14px 16px;display:flex;align-items:center;gap:16px;font:16px/1.4 Arial,Helvetica,sans-serif;color:#101014;animation:lbqIn .35s ease-out}' +
    '.lbr.won{box-shadow:7px 7px 0 #e9082b}' +
    '.lbr .lbr-big{font:900 34px/1 "Arial Black",Arial,sans-serif;min-width:92px;text-align:center}' +
    '.lbr.won .lbr-big{color:#e9082b}' +
    '.lbr .lbr-tx{flex:1;display:flex;flex-direction:column;gap:3px}' +
    '.lbr .lbr-tx b{font:900 18px Arial,sans-serif}' +
    '.lbr button.lbr-x{font:900 15px Arial,sans-serif!important;padding:9px 16px!important;border:2px solid #101014!important;border-radius:0!important;background:#101014!important;color:#fff!important;cursor:pointer;box-shadow:none!important;transform:none!important;text-transform:none!important}' +
    '.lbr-burst{position:absolute;left:58px;top:50%;width:0;height:0;pointer-events:none}' +
    '.lbr-burst i{position:absolute;width:9px;height:9px;background:#e9082b;transform:rotate(var(--a)) translateY(0);animation:lbrB .9s cubic-bezier(.2,.7,.3,1) forwards}' +
    '.lbr-burst i:nth-child(3n){background:#101014}.lbr-burst i:nth-child(3n+1){background:#f5c400}' +
    '@keyframes lbrB{to{transform:rotate(var(--a)) translateY(calc(-1 * var(--d)));opacity:0}}' +
    '.lbq{position:fixed;left:50%;top:12px;transform:translateX(-50%);z-index:2147482000;width:min(720px,calc(100% - 24px));max-height:calc(100vh - 24px);overflow:auto;background:#fff;border:3px solid #101014;box-shadow:7px 7px 0 #e9082b;padding:12px 16px 14px;font:17px/1.4 Arial,Helvetica,sans-serif;color:#101014;animation:lbqIn .35s ease-out}' +
    '@keyframes lbqIn{from{opacity:0;transform:translate(-50%,-14px)}to{opacity:1;transform:translate(-50%,0)}}' +
    '.lbq .lbq-head{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:8px}' +
    '.lbq .lbq-tag{display:inline-block;background:#e9082b;color:#fff;font:900 12px Arial,sans-serif;letter-spacing:.6px;text-transform:uppercase;padding:4px 8px}' +
    '.lbq.done .lbq-tag{background:#12804f}' +
    '.lbq .lbq-q{font:900 20px/1.3 Arial,sans-serif;margin:2px 0 12px}' +
    '.lbq.folded{padding:10px 14px}.lbq.folded .lbq-q{font-size:16px;margin:0 0 8px}' +
    '.lbq .lbq-opts{display:grid;gap:8px;margin-bottom:12px}' +
    '.lbq button.lbq-opt{text-align:left;font:700 17px Arial,sans-serif!important;padding:12px 14px!important;border:2px solid #101014!important;border-radius:0!important;background:#fff!important;color:#101014!important;cursor:pointer;box-shadow:none!important;transform:none!important;text-transform:none!important;min-height:48px}' +
    '.lbq button.lbq-opt.on{background:#101014!important;color:#fff!important;box-shadow:4px 4px 0 #e9082b!important}' +
    '.lbq .lbq-entry{display:flex;align-items:center;gap:10px;margin-bottom:12px}' +
    '.lbq .lbq-entry input,.lbq .lbq-entry textarea{flex:1;font:18px Arial,sans-serif;padding:11px 12px;border:2px solid #101014;border-radius:0;min-height:48px;color:#101014;background:#fff}' +
    '.lbq .lbq-entry textarea{min-height:96px;resize:vertical}' +
    '.lbq .lbq-entry b{font:900 18px Arial,sans-serif}' +
    '.lbq .lbq-row{display:flex;gap:10px;align-items:center;flex-wrap:wrap}' +
    '.lbq button.lbq-send{font:900 16px Arial,sans-serif!important;padding:11px 20px!important;border:2px solid #101014!important;border-radius:0!important;background:#e9082b!important;color:#fff!important;cursor:pointer;min-height:46px;box-shadow:4px 4px 0 #101014!important;transform:none!important;text-transform:none!important}' +
    '.lbq button.lbq-send:disabled{opacity:.4;cursor:default}' +
    '.lbq button.lbq-link{font:700 15px Arial,sans-serif!important;padding:8px 4px!important;border:0!important;background:none!important;color:#101014!important;text-decoration:underline;cursor:pointer;box-shadow:none!important;transform:none!important;text-transform:none!important}' +
    '.lbq .lbq-msg{margin:8px 0 0;color:#b70020;font-weight:700}.lbq .lbq-msg:empty{display:none}' +
    '.lbq button.lbq-x{font:900 22px/1 Arial,sans-serif!important;padding:4px 12px!important;border:2px solid #101014!important;border-radius:0!important;background:#fff!important;color:#101014!important;cursor:pointer;box-shadow:none!important;transform:none!important;min-height:36px}' +
    '.lbs{position:fixed;inset:0;z-index:2147481000;background:rgba(245,243,238,.97);display:flex;align-items:center;justify-content:center;padding:24px;font:18px/1.45 Arial,Helvetica,sans-serif;color:#101014;text-align:center}' +
    '.lbs.pause{z-index:2147482600;background:#101014;color:#fff}' +
    '.lbs .lbs-in{max-width:560px}' +
    '.lbs h2{font:900 34px/1.1 "Arial Black",Arial,sans-serif;margin:0 0 12px;background:none;color:inherit;box-shadow:none;transform:none;padding:0;text-transform:none;display:block}' +
    '.lbs.pause h2{font-size:56px}' +
    '.lbs p{margin:0 0 20px;font-size:18px;color:inherit;background:none;border:0;padding:0}' +
    '.lbs .lbs-row{display:flex;gap:12px;justify-content:center;flex-wrap:wrap}' +
    '.lbs button{font:900 17px Arial,sans-serif!important;padding:13px 22px!important;border:2px solid #101014!important;border-radius:0!important;background:#fff!important;color:#101014!important;cursor:pointer;min-height:48px;box-shadow:4px 4px 0 #101014!important;transform:none!important;text-transform:none!important}' +
    '.lbs button.go{background:#e9082b!important;color:#fff!important}' +
    '.lbo{position:fixed;left:12px;bottom:12px;z-index:2147482400;background:#101014;color:#fff;font:700 14px/1.35 Arial,sans-serif;padding:10px 14px;max-width:min(420px,calc(100% - 24px));box-shadow:4px 4px 0 #e9082b}' +
    '.lbq .lbq-time{font:900 15px Arial,sans-serif;margin-left:auto;margin-right:8px;font-variant-numeric:tabular-nums}' +
    '.lb-vidnote{display:none;border:3px dashed #101014;padding:22px;font:900 22px/1.3 Arial,sans-serif;text-align:center;margin:10px 0;background:#fff}' +
    'body.lb-vid .lb-vidnote{display:block}' +
    'body.lb-vid figure[data-yt],body.lb-vid .c1-video,body.lb-vid iframe[src*="youtube"],body.lb-vid [data-video-board]{display:none!important}' +
    'body.lb-hold .slide:not([data-kind="assessment"]) .question .feedback,body.lb-hold .slide:not([data-kind="assessment"]) .question .model-answer,body.lb-hold .slide:not([data-kind="assessment"]) .question p.small{display:none!important}' +
    'body.lb-hold .slide:not([data-kind="assessment"]) .question:has(.feedback:not(:empty)) .actions::after{content:"Sent. Your teacher will show the answers.";display:block;font:700 15px Arial,sans-serif;margin-top:8px;color:#3a3740}' +
    '.lbpm{display:inline-flex;gap:6px;margin:6px 0 2px;vertical-align:middle}' +
    '.lbpm button{font:900 20px/1 Arial,sans-serif!important;width:44px;height:44px;min-height:44px;padding:0!important;border:2px solid #101014!important;border-radius:0!important;background:#fff!important;color:#101014!important;box-shadow:none!important;transform:none!important}' +
    '@media (pointer:coarse){.slide input[type=range]{min-height:34px}}' +
    '.lbpres{position:fixed;right:12px;bottom:76px;z-index:2147482300;background:#101014;color:#fff;font:700 14px/1.3 Arial,sans-serif;padding:10px 12px;display:flex;gap:10px;align-items:center;flex-wrap:wrap;max-width:calc(100% - 24px);box-shadow:4px 4px 0 #e9082b}' +
    '.lbpres select{font:700 14px Arial,sans-serif;padding:6px 8px;border:2px solid #fff;background:#101014;color:#fff;border-radius:0}' +
    '.lbpres button{font:900 14px Arial,sans-serif!important;padding:7px 12px!important;border:2px solid #fff!important;border-radius:0!important;background:transparent!important;color:#fff!important;cursor:pointer;box-shadow:none!important;transform:none!important;text-transform:none!important;min-height:0!important}' +
    '.lbpres button.on{background:#e9082b!important;border-color:#e9082b!important}' +
    '.lbpres .lbpres-st{font-weight:400;opacity:.85}' +
    '.lbpres.in-foot{position:static;box-shadow:none;padding:4px 8px;max-width:none;flex-wrap:nowrap;gap:8px;font-size:13px}' +
    '.lbpres.in-foot button{padding:5px 10px!important;font-size:13px!important}' +
    'body.lb-presenting #fx-rail{display:none!important}' +
    '.lbres-btn{position:fixed;left:150px;bottom:14px;z-index:2147482000;font:900 16px Arial,sans-serif;padding:10px 18px;border:2px solid #101014;border-radius:0;background:#fff;color:#101014;box-shadow:4px 4px 0 #e9082b;cursor:pointer;opacity:.9}' +
    '.lbres-btn:hover{background:#101014;color:#fff;opacity:1}' +
    '.lbres{position:fixed;inset:0;z-index:2147483100;background:rgba(10,10,14,.88);display:flex;align-items:center;justify-content:center;padding:3vh 3vw;font:20px/1.4 Arial,Helvetica,sans-serif;color:#101014}' +
    '.lbres-panel{background:#fff;border:3px solid #101014;box-shadow:10px 10px 0 #e9082b;width:min(1100px,100%);max-height:94vh;overflow:auto;padding:24px 28px}' +
    '.lbres-top{display:flex;align-items:center;gap:14px;flex-wrap:wrap;margin-bottom:14px}' +
    '.lbres-top h2{margin:0;font:900 36px/1.1 "Arial Black",Arial,sans-serif;background:none;color:#101014;box-shadow:none;transform:none;padding:0;text-transform:none;letter-spacing:-.5px}' +
    '.lbres-sub{color:#3a3740;font-size:18px;flex:1}' +
    '.lbres button{font:900 16px Arial,sans-serif!important;padding:10px 16px!important;border:2px solid #101014!important;border-radius:0!important;background:#fff!important;color:#101014!important;cursor:pointer;box-shadow:none!important;transform:none!important}' +
    '.lbres button:hover{background:#101014!important;color:#fff!important}' +
    '.lbres-body{display:grid;gap:18px}' +
    '.lbres-q{border-top:3px solid #101014;padding-top:14px}' +
    '.lbres-q h3{margin:0 0 4px;font:900 26px/1.25 Arial,sans-serif;color:#101014;background:none;text-transform:none;letter-spacing:0;padding:0;box-shadow:none}' +
    '.lbres-n{color:#3a3740;font-size:18px;margin-bottom:10px}' +
    '.lbres-bar{display:grid;grid-template-columns:minmax(0,1.3fr) minmax(0,2fr) 3.2em;gap:14px;align-items:center;margin:8px 0;font-size:22px}' +
    '.lbres-bar .l{overflow-wrap:anywhere}' +
    '.lbres-bar .t{height:34px;background:#efece6;position:relative}' +
    '.lbres-bar .t i{position:absolute;left:0;top:0;bottom:0;background:#101014;min-width:3px}' +
    '.lbres-bar b{font:900 24px Arial,sans-serif;text-align:right}' +
    '.lbres-bar.ok .l{font-weight:900;color:#0b7a45}' +
    '.lbres-bar.ok .l::before{content:"\u2713  "}' +
    '.lbres-bar.ok .t i{background:#12a05c}' +
    '.lbres-pct{font:900 30px Arial,sans-serif;color:#0b7a45}' +
    '.lbres-wait{color:#3a3740;font-size:20px;margin:6px 0}' +
    '.lbres-btn.lbb-go{left:50%;transform:translateX(-50%);bottom:16px;font-size:18px;padding:12px 22px;opacity:1}' +
    '.lbres-btn.lbb-go:hover{transform:translateX(-50%)}' +
    '.lbb-nav{white-space:nowrap;flex:none}' +
    '.lbb-nav:hover:not(:disabled){filter:brightness(1.12)}' +
    '.lbb-nav:disabled{opacity:.38!important;cursor:default!important;box-shadow:none!important;filter:none!important}' +
    '.lbres.lbb{padding:2vh 2vw;z-index:2147482900}' +
    '.lbb .lbres-panel{width:min(1500px,100%);max-height:96vh;display:flex;flex-direction:column;padding:22px 28px;background:#fffdf8;background-image:linear-gradient(rgba(16,16,20,.05) 1px,transparent 1px),linear-gradient(90deg,rgba(16,16,20,.05) 1px,transparent 1px);background-size:28px 28px}' +
    '.lbb-tabs{display:flex;gap:8px;flex-wrap:wrap}' +
    '.lbb .lbb-tabs button{font-size:15px!important;padding:6px 12px!important}' +
    '.lbb .lbb-tabs button.on{background:#101014!important;color:#fff!important}' +
    '.lbb-q{font:900 clamp(24px,3.1vw,44px)/1.2 Arial,sans-serif;color:#101014;margin:6px 0 4px;white-space:pre-wrap;overflow-wrap:anywhere}' +
    '.lbb-n{font-size:clamp(16px,1.5vw,22px);color:#3a3740;margin:0 0 14px}' +
    '.lbb-n b{color:#101014}' +
    '.lbb-body{overflow:auto;flex:1;min-height:0}' +
    '.lbb-bars{display:grid;gap:14px}' +
    '.lbb-bar{display:grid;grid-template-columns:3.2em minmax(0,1fr);gap:14px;align-items:center;font-size:clamp(18px,1.9vw,28px)}' +
    '.lbb-bar .k{font:900 1.2em Arial,sans-serif;width:2.2em;height:2.2em;display:grid;place-items:center;border:3px solid #101014;background:#fff}' +
    '.lbb-bar .w{display:grid;gap:6px;min-width:0}' +
    '.lbb-bar .l{overflow-wrap:anywhere;font-weight:700}' +
    '.lbb-bar .r{display:grid;grid-template-columns:minmax(0,1fr) 6.5em;gap:12px;align-items:center}' +
    '.lbb-bar .t{height:clamp(26px,3.4vh,44px);background:#efece6;border:2px solid #101014;position:relative}' +
    '.lbb-bar .t i{position:absolute;left:0;top:0;bottom:0;background:#101014;transition:width .5s}' +
    '.lbb-bar b{font:900 1em Arial,sans-serif;text-align:right;white-space:nowrap}' +
    '.lbb-bar b small{font-weight:700;color:#3a3740;font-size:.7em}' +
    '.lbb-bar.ok .k{background:#12a05c;color:#fff;border-color:#0b7a45}' +
    '.lbb-bar.ok .l{color:#0b7a45}' +
    '.lbb-bar.ok .t i{background:#12a05c}' +
    '.lbb-wall{columns:4 260px;column-gap:16px}' +
    '.lbb-card{break-inside:avoid;margin:0 0 16px;padding:14px 16px;border:2px solid #101014;box-shadow:5px 5px 0 #101014;font:700 clamp(17px,1.5vw,22px)/1.35 Arial,sans-serif;color:#101014;white-space:pre-wrap;overflow-wrap:anywhere;animation:lbbIn .4s ease-out both}' +
    '.lbb-card.c0{background:#fff6b8}.lbb-card.c1{background:#d9f0ff}.lbb-card.c2{background:#ffe0e6}.lbb-card.c3{background:#dff7e6}.lbb-card.c4{background:#efe4ff}.lbb-card.c5{background:#ffe8d1}' +
    '.lbb-card.ok{box-shadow:5px 5px 0 #12a05c;border-color:#0b7a45}' +
    '.lbb-card.no{opacity:.55}' +
    '@keyframes lbbIn{from{opacity:0;transform:translateY(8px) scale(.97)}to{opacity:1;transform:none}}' +
    '@media (prefers-reduced-motion:reduce){.lbb-card{animation:none}.lbb-bar .t i{transition:none}}' +
    '.lbb-empty{font-size:clamp(18px,1.8vw,26px);color:#3a3740;padding:30px 0}' +
    '.lbb-pct{font:900 clamp(22px,2.4vw,34px) Arial,sans-serif;color:#0b7a45;margin:0 0 12px}' +
    '@media (max-width:700px){.lbres-bar{grid-template-columns:1fr 3em}.lbres-bar .t{grid-column:1/-1;grid-row:2}}' +
    '.lbx-who button{font:700 13px Arial,sans-serif!important;padding:6px 12px!important;min-height:0!important;border:2px solid #fff!important;background:transparent!important;color:#fff!important;box-shadow:none!important;transform:none!important;cursor:pointer;text-transform:none!important}' +
    '.lbx-panel.lbv-wide{width:min(680px,100%);padding:20px 22px 22px}' +
    '.lbv-head,.lbp-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:4px}' +
    '.lbx .lbv-head h2{margin:0}' +
    '.lbx button.lbv-x{font:900 22px/1 Arial,sans-serif!important;padding:4px 12px!important;min-height:38px;flex:none}' +
    '.lbx .lbv-sub{margin:0 0 4px;color:#3a3740;font-size:15px}' +
    '.lbv-sec{margin-top:18px}' +
    '.lbx .lbv-sec h3{margin:0 0 6px;font:900 13px Arial,sans-serif;letter-spacing:.7px;text-transform:uppercase;color:#b70020;background:none;padding:0;box-shadow:none;transform:none;border:0}' +
    '.lbx .lbv-sec p{margin:0 0 10px}' +
    '.lbx .lbv-note{background:#fff7d6;border-left:4px solid #f5c400;padding:8px 10px;font-size:14px}' +
    '.lbx .lbv-wait{color:#5b5862}' +
    '.lbv-row{display:flex;gap:12px;align-items:center;padding:10px 0;border-top:2px solid #ebe7de}' +
    '.lbv-row .lbv-tx{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}' +
    '.lbv-where{font:700 12px Arial,sans-serif;color:#5b5862;letter-spacing:.3px}' +
    '.lbv-q{font:700 16px/1.35 Arial,sans-serif;color:#101014;overflow-wrap:anywhere}' +
    '.lbv-row.done .lbv-q{font-weight:400;color:#5b5862}' +
    '.lbx .lbv-row button{padding:8px 12px!important;min-height:40px;font-size:14px!important;flex:none}' +
    '.lbv-done{margin:4px 0 8px}' +
    '.lbv-done summary{cursor:pointer;font:700 14px Arial,sans-serif;color:#12804f;padding:6px 0}' +
    '.lbv-acts{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:12px;margin:14px 0 4px}' +
    '.lbx .lbv-first p{margin:0 0 8px}' +
    '.lbx button.lbv-big{display:flex;flex-direction:column;align-items:flex-start;justify-content:flex-start;gap:3px;width:100%;text-align:left;background:#101014!important;color:#fff!important;box-shadow:5px 5px 0 #e9082b!important}' +
    '.lbx button.lbv-big b{font:900 18px Arial,sans-serif}' +
    '.lbx button.lbv-big span{font:400 14px/1.35 Arial,sans-serif;opacity:.92}' +
    '.lbx button.lbv-big:hover:not(:disabled){background:#e9082b!important}' +
    '.lbx button.lbv-link{border:0!important;background:none!important;padding:4px 0!important;min-height:0;text-decoration:underline;font-size:14px!important}' +
    '.lbx button.lbv-link:hover:not(:disabled){background:none!important;color:#b70020!important}' +
    '.lbx .lbv-big-note{font:700 18px/1.4 Arial,sans-serif;margin:14px 0 4px;color:#101014}' +
    '.lbv-card{display:flex;gap:16px;align-items:center;flex-wrap:wrap;margin:18px 0 8px;padding:16px 18px;background:#fff;border:3px solid #101014;box-shadow:6px 6px 0 #12804f;font:16px/1.45 Arial,Helvetica,sans-serif;color:#101014;text-align:left;max-width:100%;box-sizing:border-box}' +
    '.lbv-card .lbv-tx{flex:1;min-width:200px;display:flex;flex-direction:column;gap:3px}' +
    '.lbv-card .lbv-h{font:900 20px/1.2 Arial,sans-serif;color:#101014}' +
    '.lbv-card button{font:900 16px Arial,sans-serif!important;padding:12px 24px!important;border:2px solid #101014!important;border-radius:0!important;background:#12804f!important;color:#fff!important;cursor:pointer;min-height:46px;box-shadow:4px 4px 0 #101014!important;transform:none!important;text-transform:none!important;width:auto!important}' +
    '.lbv-card button:disabled{opacity:.45;cursor:default}' +
    '.lbp-tag{background:#12804f;color:#fff;font:900 12px Arial,sans-serif;letter-spacing:.6px;text-transform:uppercase;padding:4px 8px}' +
    '.lbp-count{font:900 15px Arial,sans-serif;margin-left:auto;font-variant-numeric:tabular-nums}' +
    '.lbp-where{display:flex;gap:10px;align-items:center;flex-wrap:wrap;font:700 13px Arial,sans-serif;color:#5b5862;margin:10px 0 0}' +
    '.lbp-q{font:900 21px/1.35 Arial,sans-serif;margin:12px 0 14px;color:#101014;overflow-wrap:anywhere}' +
    '.lbp-new{display:inline-block;margin:-6px 0 12px;font:700 12px Arial,sans-serif;color:#0b5e3a;background:#ddf5ea;padding:3px 8px}' +
    '.lbp-opts{display:grid;gap:8px;margin-bottom:12px}' +
    '.lbx button.lbp-opt{text-align:left;font:700 17px/1.35 Arial,sans-serif!important;padding:12px 14px!important;min-height:50px}' +
    '.lbx button.lbp-opt:disabled{opacity:1}' +
    '.lbx button.lbp-opt:hover:not(:disabled){background:#fff!important;color:#101014!important;box-shadow:inset 0 0 0 2px #101014!important}' +
    '.lbx button.lbp-opt.ok{background:#12804f!important;color:#fff!important;border-color:#12804f!important}' +
    '.lbx button.lbp-opt.no{background:#fde8eb!important;color:#8a0018!important;border-color:#b70020!important;text-decoration:line-through}' +
    '.lbp-entry{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:12px}' +
    '.lbx .lbp-entry input{flex:1;min-width:140px;width:auto;margin:0}' +
    '.lbp-entry b{font:900 18px Arial,sans-serif}' +
    '.lbx .lbp-entry button{flex:none}' +
    '.lbx textarea.lbp-text{display:block;width:100%;min-height:110px;font:17px/1.4 Arial,sans-serif;padding:11px 12px;border:2px solid #101014;border-radius:0;margin:0 0 12px;box-sizing:border-box;resize:vertical;color:#101014;background:#fff}' +
    '.lbp-fb{font:16px/1.45 Arial,sans-serif;margin:0 0 12px;padding:8px 12px;border-left:5px solid #101014;background:#f5f3ee;color:#101014}' +
    '.lbp-fb:empty{display:none}' +
    '.lbp-fb.ok{border-left-color:#12804f;background:#effaf4}' +
    '.lbp-fb.no{border-left-color:#b70020;background:#fdf0f1}' +
    '.lbx button.lbp-next{width:100%}' +
    '.lbp-score{display:flex;align-items:baseline;gap:12px;flex-wrap:wrap;margin:10px 0 14px}' +
    '.lbp-score b{font:900 46px/1 "Arial Black",Arial,sans-serif;font-variant-numeric:tabular-nums}' +
    '.lbx .lbp-endrow{margin-top:16px}' +
    '.lbp-back{position:fixed;left:50%;bottom:16px;transform:translateX(-50%);z-index:2147482900;font:900 16px Arial,sans-serif;padding:12px 20px;border:2px solid #101014;background:#12804f;color:#fff;box-shadow:4px 4px 0 #101014;cursor:pointer}';
  document.head.appendChild(css);
  /* Version 15: the quick check dock, the presenter strip, the blank screen and the End bar. */
  var css15 = el('style');
  css15.textContent =
    '.lbdock{position:fixed;left:0;right:0;bottom:0;height:35vh;min-height:210px;z-index:2147482550;background:#fff;color:#101014;border-top:4px solid #101014;box-shadow:0 -6px 0 #e9082b;font:17px/1.4 Arial,Helvetica,sans-serif;overflow:auto;-webkit-overflow-scrolling:touch;animation:lbDockIn .3s ease-out}' +
    '@keyframes lbDockIn{from{transform:translateY(40px);opacity:0}to{transform:none;opacity:1}}' +
    '.lbdock-in{max-width:980px;margin:0 auto;padding:12px 20px 16px;display:flex;flex-direction:column;gap:10px}' +
    '.lbdock-head{display:flex;align-items:center;gap:10px}' +
    '.lbdock-tag{background:#e9082b;color:#fff;font:900 13px Arial,sans-serif;letter-spacing:.6px;text-transform:uppercase;padding:5px 10px}' +
    '.lbdock-tag.shut{background:#12804f}' +
    '.lbdock-round{font:700 14px Arial,sans-serif;color:#3a3740}' +
    '.lbdock-q{font:900 clamp(18px,2.3vw,24px)/1.3 Arial,sans-serif;overflow-wrap:anywhere}' +
    '.lbdock-opts{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px}' +
    '.lbdock button.lbdock-opt{display:flex;align-items:center;gap:12px;min-height:58px;padding:10px 16px!important;text-align:left;font:900 20px/1.25 Arial,sans-serif!important;border:3px solid #101014!important;border-radius:0!important;background:#fff!important;color:#101014!important;box-shadow:4px 4px 0 #101014!important;transform:none!important;text-transform:none!important;font-style:normal!important;cursor:pointer}' +
    '.lbdock button.lbdock-opt b{flex:none;display:grid;place-items:center;width:34px;height:34px;border:2px solid currentColor;font:900 18px Arial,sans-serif}' +
    '.lbdock button.lbdock-opt.on{background:#101014!important;color:#fff!important;box-shadow:4px 4px 0 #e9082b!important}' +
    '.lbdock button.lbdock-opt:disabled{opacity:.6;cursor:default}' +
    '.lbdock-entry{display:flex;gap:10px;align-items:center;flex-wrap:wrap}' +
    '.lbdock-entry input{flex:1;min-width:160px;font:20px Arial,sans-serif;padding:11px 12px;border:3px solid #101014;border-radius:0;min-height:52px;color:#101014;background:#fff}' +
    '.lbdock-entry b{font:900 18px Arial,sans-serif}' +
    '.lbdock button.lbdock-send{align-self:flex-start;font:900 17px Arial,sans-serif!important;padding:12px 22px!important;border:3px solid #101014!important;border-radius:0!important;background:#e9082b!important;color:#fff!important;box-shadow:4px 4px 0 #101014!important;min-height:52px;transform:none!important;text-transform:none!important;font-style:normal!important;cursor:pointer}' +
    '.lbdock-note{margin:0;font-size:15px;color:#3a3740}.lbdock-note.bad{color:#b70020;font-weight:700}' +
    '.lbdock-mine{margin:0;font:900 20px/1.3 Arial,sans-serif}.lbdock-mine.ok{color:#0b7a45}.lbdock-mine.no{color:#b70020}' +
    '.lbdock-bars{display:grid;gap:6px}' +
    '.lbdock-bar{display:grid;grid-template-columns:minmax(0,9em) minmax(0,1fr) 3em;gap:10px;align-items:center;font-size:16px}' +
    '.lbdock-bar .l{font-weight:700;overflow-wrap:anywhere}.lbdock-bar .t{height:20px;background:#efece6;border:2px solid #101014;position:relative}' +
    '.lbdock-bar .t i{position:absolute;left:0;top:0;bottom:0;background:#101014}.lbdock-bar b{text-align:right}' +
    '.lbdock-bar.ok .l{color:#0b7a45}.lbdock-bar.ok .t i{background:#12a05c}.lbdock-bar.me .l{text-decoration:underline}' +
    '@media (prefers-reduced-motion:reduce){.lbdock{animation:none}}' +
    '.lbx-who button.lbx-out{border-color:rgba(255,255,255,.55)!important}' +
    '.lbstrip{position:fixed;right:12px;bottom:76px;z-index:2147482350;display:flex;align-items:center;gap:8px;flex-wrap:wrap;justify-content:flex-end;max-width:min(560px,calc(100% - 24px));font:700 14px/1.2 Arial,Helvetica,sans-serif}' +
    '.lbstrip-pill{background:#101014;color:#fff;padding:8px 12px;border:2px solid #fff;box-shadow:3px 3px 0 #e9082b;white-space:nowrap;font-variant-numeric:tabular-nums}' +
    '.lbstrip.eyes .lbstrip-pill{background:#e9082b}' +
    '.lbstrip button.lbstrip-more{font:900 20px/1 Arial,sans-serif!important;min-width:44px;min-height:36px;padding:4px 10px!important;background:#101014!important;color:#fff!important;border:2px solid #fff!important;border-radius:0!important;box-shadow:3px 3px 0 #e9082b!important;transform:none!important;cursor:pointer}' +
    '.lbstrip-msg{flex-basis:100%;text-align:right;color:#fff;background:#101014;padding:4px 8px;font-weight:400}' +
    '.lbstrip-menu{position:absolute;right:0;bottom:calc(100% + 8px);width:300px;background:#fff;color:#101014;border:3px solid #101014;box-shadow:6px 6px 0 #e9082b;padding:6px;display:flex;flex-direction:column;gap:4px}' +
    '.lbstrip-menu>button{display:flex;justify-content:space-between;align-items:center;gap:10px;text-align:left;font:700 15px Arial,sans-serif!important;padding:9px 10px!important;border:0!important;border-radius:0!important;background:#fff!important;color:#101014!important;box-shadow:none!important;transform:none!important;text-transform:none!important;cursor:pointer;min-height:0}' +
    '.lbstrip-menu>button:hover{background:#101014!important;color:#fff!important}' +
    '.lbstrip-menu>button.end{color:#b70020!important}' +
    '.lbstrip-menu kbd{font:700 12px Arial,sans-serif;border:1px solid currentColor;padding:1px 6px}' +
    '.lbstrip-h{margin:4px 8px;font-size:14px;color:#3a3740}' +
    '.lbstrip-mark{display:flex;align-items:center;gap:6px;flex-wrap:wrap;padding:4px 8px}' +
    '.lbstrip-mark span{flex-basis:100%;font-size:13px;color:#3a3740}' +
    '.lbstrip-mark button{font:900 15px Arial,sans-serif!important;min-width:40px;padding:6px 10px!important;border:2px solid #101014!important;border-radius:0!important;background:#fff!important;color:#101014!important;box-shadow:none!important;transform:none!important;cursor:pointer;min-height:0}' +
    '.lbblank{position:fixed;inset:0;z-index:2147483300;background:#000;display:flex;align-items:flex-end;justify-content:center;padding:18px;cursor:none}' +
    '.lbblank span{color:#333;font:14px Arial,sans-serif}' +
    '.lbend{position:fixed;left:50%;transform:translateX(-50%);top:16px;z-index:2147483350;display:flex;align-items:center;gap:16px;background:#101014;color:#fff;padding:12px 14px 12px 18px;border:3px solid #fff;box-shadow:6px 6px 0 #e9082b;font:700 18px Arial,sans-serif}' +
    '.lbend button{font:900 17px Arial,sans-serif!important;padding:10px 18px!important;border:0!important;border-radius:0!important;background:#FFE45C!important;color:#101014!important;box-shadow:none!important;transform:none!important;cursor:pointer}' +
    '.lbshow{z-index:2147483150}' +
    '.lbshow-words{display:flex;flex-wrap:wrap;gap:14px 18px;align-items:center;justify-content:center;padding:10px 0}' +
    '.lbshow-word{font-weight:900;font-family:Arial,sans-serif;padding:6px 14px;border:2px solid #101014;box-shadow:4px 4px 0 #101014;line-height:1.15;overflow-wrap:anywhere}' +
    '.lbshow-word small{font-size:.5em;color:#3a3740}' +
    '.lbshow-word.c0{background:#fff6b8}.lbshow-word.c1{background:#d9f0ff}.lbshow-word.c2{background:#ffe0e6}.lbshow-word.c3{background:#dff7e6}.lbshow-word.c4{background:#efe4ff}.lbshow-word.c5{background:#ffe8d1}' +
    '.lbx .lbpick button.lbx-class span{color:#3a3740;font-weight:400}' +
    '.lbx .lbpick button.lbx-class:disabled span{display:none}';
  document.head.appendChild(css15);

  var nameBox = document.getElementById('student-name');
  var classBox = document.getElementById('student-class');
  var saveBtn = document.getElementById('save-profile');
  var changeBtn = document.getElementById('change-student');
  var identityBlock = nameBox ? nameBox.closest('details') || nameBox.closest('.rec-profile') : null;
  var deckChange = changeBtn ? changeBtn.onclick : null;
  if (!nameBox || !classBox || !saveBtn) return;   // a deck without the name box: nothing to lock

  var roster = null;
  var overlay = null;
  var whoLine = el('div', 'lbx-who');
  if (identityBlock) { identityBlock.style.display = 'none'; identityBlock.parentNode.insertBefore(whoLine, identityBlock.nextSibling); }

  // Version 15: the classes only, kept in memory, with the classes whose lesson is live now (no guest button for them).
  var liveCls = [];
  function loadRoster(fresh) {
    if (roster && !fresh) return Promise.resolve(roster);
    return api({ api: 'roster' }).then(function (r) {
      if (!r || !r.ok || !Array.isArray(r.classes)) throw new Error('bad reply');
      roster = r.classes.map(function (c) { return typeof c === 'string' ? { cls: c } : c; }).filter(function (c) { return c && c.cls; });
      liveCls = Array.isArray(r.liveCls) ? r.liveCls.map(function (c) { return String(c).toUpperCase(); }) : [];
      return roster;
    }).catch(function (err) {
      var e = new Error('no class list'); e.kind = err && err.kind; throw e;
    });
  }
  function classLive(c) { return !!c && liveCls.indexOf(String(c).toUpperCase()) >= 0; }

  function setDeckProfile(id) {
    if (nameBox.value === id.name && classBox.value === id.cls) return;
    nameBox.value = id.name; classBox.value = id.cls;
    nameBox.dispatchEvent(new Event('input', { bubbles: true }));
    classBox.dispatchEvent(new Event('input', { bubbles: true }));
    saveBtn.click();
  }
  var guest = false, guestCls = '', guestTimer = null;
  function showWho(id) {
    whoLine.innerHTML = '';
    if (id) {
      startLive();
      whoLine.appendChild(document.createTextNode('Signed in as '));
      whoLine.appendChild(el('b', '', id.name));
      whoLine.appendChild(document.createTextNode(', ' + id.cls + '.'));
      var rv = el('button', 'lbv-open', 'Revise');
      rv.type = 'button';
      rv.hidden = inLesson() || !stateKnown() || heldNow();
      rv.addEventListener('click', function (e) { if (e) e.preventDefault(); openRevise(); });
      whoLine.appendChild(rv);
      var so = el('button', 'lbx-out', 'Not you? Sign out');
      so.type = 'button';
      so.addEventListener('click', function (e) { if (e) e.preventDefault(); askSignOut(); });
      whoLine.appendChild(so);
      if (reviseWanted) { reviseWanted = false; setTimeout(openRevise, 700); }
    } else {
      whoLine.appendChild(document.createTextNode(guest ? 'You are looking at the lesson without signing in. Your answers are not saved.' : 'Your answers are not being saved yet.'));
      var go = el('button', '', 'Sign in');
      go.type = 'button';
      go.addEventListener('click', function () { openGate('', { cls: guestCls }); });
      whoLine.appendChild(go);
    }
  }

  function closeOverlay() { if (overlay) { overlay.remove(); overlay = null; } }
  function panel() {
    closeOverlay();
    overlay = el('div', 'lbx');
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    var p = el('div', 'lbx-panel');
    overlay.appendChild(p);
    document.body.appendChild(overlay);
    return p;
  }

  /* Version 15: class, name and password (6 to 60 characters), checked together by Live Board. The guest button
     shows only for a class whose lesson is not live now, so nobody in the lesson can slip past the sign-in. */
  function openGate(msgText, pre) {
    pre = pre || {};
    var p = panel();
    overlay.setAttribute('data-lbx', 'gate');
    p.appendChild(el('h2', '', 'Who are you?'));
    p.appendChild(el('p', '', 'Choose your class, type your name, then type your password.'));
    var l1 = el('label', '', 'Class'), s1 = el('select'); s1.className = 'lbx-cls'; l1.appendChild(s1); p.appendChild(l1);
    var l2 = el('label', '', 'Name'), nm = el('input', 'lbx-name');
    nm.type = 'text'; nm.autocomplete = 'name'; nm.maxLength = 80; nm.placeholder = 'Your full name, as on the class list';
    nm.setAttribute('autocapitalize', 'words'); nm.spellcheck = false;
    if (pre.name) nm.value = pre.name;
    l2.appendChild(nm); p.appendChild(l2);
    var l3 = el('label', '', 'Password'), pw = el('input', 'lbx-pin lbx-pass');
    pw.type = 'password'; pw.maxLength = 60; pw.autocomplete = 'current-password'; pw.spellcheck = false; pw.setAttribute('autocapitalize', 'none');
    l3.appendChild(pw); p.appendChild(l3);
    var row = el('div', 'lbx-row'), go = el('button', 'lbx-go', 'Sign in'); go.type = 'button'; go.disabled = true; row.appendChild(go); p.appendChild(row);
    var msg = el('p', 'lbx-msg', msgText || '');
    p.appendChild(msg);
    var more = el('a', 'lbx-ms', 'First time, or forgot your password? Open learnwithmrcedric'); more.href = MS_URL; more.target = '_blank'; more.rel = 'noopener';
    var links = el('div', 'lbx-links'); links.appendChild(more); p.appendChild(links);
    var guestBtn = el('button', 'lbx-skip lbx-guest', 'Look at the lesson without signing in'); guestBtn.type = 'button'; guestBtn.hidden = true;
    p.appendChild(guestBtn);
    // Only when the class list cannot load: look at the lesson now and sign in later.
    var skip = el('button', 'lbx-skip', 'Look at the lesson now and sign in later'); skip.type = 'button'; skip.hidden = true;
    p.appendChild(skip);
    s1.disabled = true;
    s1.appendChild(new Option('Loading the class list…', ''));
    var ready = function () {
      go.disabled = !(s1.value && nm.value.trim() && pw.value.length >= 1);
      guestBtn.hidden = !s1.value || classLive(s1.value);
    };
    var send = function () {
      if (!(s1.value && nm.value.trim() && pw.value)) return;
      if (pw.value.length < 6 || pw.value.length > 60) { msg.textContent = 'Your password has 6 to 60 characters.'; pw.focus(); return; }
      go.disabled = true; msg.textContent = '';
      api({ api: 'st', op: 'signin', cls: s1.value, name: nm.value.trim(), pin: pw.value }).then(function (x) {
        if (!x || !x.ok || !x.st) { msg.textContent = (x && x.error) || 'That did not work. Try again.'; pw.value = ''; ready(); pw.focus(); return; }
        lockIn({ cls: x.cls, name: x.name, st: x.st });
      }).catch(function (err) { ready(); failNote(msg, err, 'Signing in'); });
    };
    s1.addEventListener('change', ready);
    nm.addEventListener('input', ready);
    nm.addEventListener('keydown', function (e) { if (e.key === 'Enter') pw.focus(); });
    pw.addEventListener('input', ready);
    pw.addEventListener('keydown', function (e) { if (e.key === 'Enter') send(); });
    go.addEventListener('click', send);
    guestBtn.addEventListener('click', function () {
      if (!s1.value || classLive(s1.value)) { ready(); return; }
      guest = true; guestCls = s1.value;
      closeOverlay(); setMode('revise'); showWho(null); watchGuest();
    });
    skip.addEventListener('click', function () { closeOverlay(); showWho(null); });
    var fill = function () {
      s1.innerHTML = '';
      s1.appendChild(new Option('Choose your class', ''));
      roster.forEach(function (c) { s1.appendChild(new Option(c.cls, c.cls)); });
      s1.disabled = false;
      if (pre.cls && roster.some(function (c) { return c.cls === pre.cls; })) s1.value = pre.cls;
      ready();
      setTimeout(function () { try { (s1.value ? (nm.value ? pw : nm) : s1).focus(); } catch (e) {} }, 50);
    };
    loadRoster(true).then(fill).catch(function (err) {
      s1.innerHTML = ''; s1.appendChild(new Option('No class list', ''));
      failNote(msg, err, 'The class list');
      skip.hidden = false;
      var retry = el('button', 'lbx-go', 'Try again'); retry.type = 'button';
      retry.addEventListener('click', function () { openGate('', pre); });
      row.replaceChild(retry, go);
    });
  }
  /* A guest whose class lesson starts is asked to sign in (checked once a minute while the page is open). */
  function watchGuest() {
    clearInterval(guestTimer);
    guestTimer = setInterval(function () {
      if (!guest || document.hidden || overlay) return;
      loadRoster(true).then(function () {
        if (guest && classLive(guestCls)) openGate('Your class lesson has started. Sign in to take part.', { cls: guestCls });
      }, function () {});
    }, 60000);
  }
  /* The teacher signed this student out (Sign out or Reset password on the phone or in the Hub): the iPad is free again. */
  function signedOutHere() {
    var me = readJ(ID_KEY);
    if (!me || presenting) return;
    writeJ(ID_KEY, null);
    writeJ(LIVE_KEY, null);
    writeJ(OLD_KEY, null);
    setMode('wait');
    showWho(null);
    openGate('You have been signed out. Sign in again with your password.', { cls: me.cls, name: me.name });
  }
  /* The teacher's PIN, for the presenter on the teacher's own computer only. It is never asked on a student's iPad. */
  function askPinFor(done) {
    var p = panel();
    p.appendChild(el('h2', '', 'Teacher PIN'));
    var l = el('label', '', 'Teacher PIN'), inp = el('input'); inp.type = 'password'; inp.inputMode = 'numeric'; inp.autocomplete = 'off'; l.appendChild(inp); p.appendChild(l);
    var row = el('div', 'lbx-row'), ok = el('button', 'lbx-go', 'OK'); ok.type = 'button'; row.appendChild(ok); p.appendChild(row);
    var msg = el('p', 'lbx-msg'); p.appendChild(msg);
    ok.addEventListener('click', function () {
      if (!inp.value.trim()) return;
      ok.disabled = true;
      api({ api: 'unlock', pin: inp.value.trim() }).then(function (r) {
        if (!r || r.ok !== true) { msg.textContent = 'That PIN is not right.'; ok.disabled = false; return; }
        done(inp.value.trim());
      }).catch(function (err) { failNote(msg, err, 'The teacher PIN'); ok.disabled = false; });
    });
    inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') ok.click(); });
    setTimeout(function () { inp.focus(); }, 50);
  }

  function lockIn(id) {
    id = { cls: id.cls, name: id.name, st: id.st || '', at: new Date().toISOString() };
    guest = false; clearInterval(guestTimer);
    writeJ(ID_KEY, id);
    closeOverlay();
    start();
  }

  /* Version 15: "Not you? Sign out". The student signs out alone, after one confirm. Answers still waiting to send
     must reach the teacher first. Then the deck starts a fresh record (its own Change student). */
  function askSignOut() {
    var p = panel();
    p.appendChild(el('h2', '', 'Sign out?'));
    p.appendChild(el('p', '', 'You will need your password to sign in again.'));
    var row = el('div', 'lbx-row');
    var cancel = el('button', '', 'Cancel'); cancel.type = 'button';
    var ok = el('button', 'lbx-go', 'Sign out'); ok.type = 'button';
    row.appendChild(cancel); row.appendChild(ok); p.appendChild(row);
    var msg = el('p', 'lbx-msg'); p.appendChild(msg);
    cancel.addEventListener('click', closeOverlay);
    ok.addEventListener('click', function () {
      if (pendingCount()) {
        msg.textContent = 'This iPad still has answers that have not reached your teacher. Connect to the internet, wait a moment, then try again.';
        var S = window.ScienceSync;
        if (S && typeof S.sync === 'function') Promise.resolve().then(function () { return S.sync(); }).catch(function () {});
        outAt = 0; flushOutbox();
        return;
      }
      signOutNow(msg);
    });
  }
  function signOutNow(msg) {
    var me = readJ(ID_KEY);
    if (me && me.st) api({ api: 'st', op: 'signout', st: me.st }).catch(function () { /* the ticket runs out by itself */ });
    var keep = me;
    writeJ(ID_KEY, null); writeJ(LIVE_KEY, null); writeJ(OLD_KEY, null);
    writeJ(FIRST_KEY, null); writeJ(PFIX_KEY, null); writeJ(DWELL_KEY, null); writeJ(GAME_KEY, null);
    clearDrafts();
    if (deckChange && nameBox.value) {
      var done = deckChange.call(changeBtn);   // the deck starts a fresh record and reloads itself
      if (done === false) {
        writeJ(ID_KEY, keep);
        if (msg) msg.textContent = 'This iPad still has answers that have not reached your teacher. Connect to the internet, wait a moment, then try again.';
      }
      return;
    }
    closeOverlay(); setMode('wait'); showWho(null); openGate('You are signed out.');
  }
  if (changeBtn) {
    changeBtn.onclick = function (e) { if (e) e.preventDefault(); askSignOut(); return false; };
  }

  /* A name handed over from the Live Board home page (#lb=CLASS|Name), and the question
     the teacher is asking (&q=task id). Both are taken out of the address bar. */
  var handedId = null, handedQ = '';
  var presentMode = /(?:^#|&)present(?:&|$)/.test(location.hash);
  var reviseWanted = !presentMode && /(?:^#|&)revise(?:&|$)/.test(location.hash);
  var presentCls = (location.hash.match(/(?:^#|&)cls=([^&]+)/) || [])[1] || '';
  try { presentCls = decodeURIComponent(presentCls).toUpperCase(); } catch (e) { presentCls = ''; }
  // From the Teacher Hub: a sign-in (tk), the part to teach (a number, or all), and a slide to carry on from.
  // They are taken out of the address bar straight away, so the sign-in is not left on show.
  var presentTk = presentMode ? (location.hash.match(/(?:^#|&)tk=(tk_[a-f0-9]{24,})/) || [])[1] || '' : '';
  var presentPart = presentMode ? (location.hash.match(/(?:^#|&)part=(all|\d+)/) || [])[1] || '' : '';
  var presentAt = presentMode ? Math.round(Number((location.hash.match(/(?:^#|&)at=(\d+)/) || [])[1]) || 0) : 0;
  // From the projector screen: the command it opened these slides for. A reload of this tab keeps it.
  var presentPj = presentMode ? Math.round(Number((location.hash.match(/(?:^#|&)pj=(\d+)/) || [])[1]) || 0) : 0;
  (function () {
    if (!presentMode) return;
    try {
      if (presentPj) { sessionStorage.setItem('liveboard.pj', JSON.stringify({ pj: presentPj, path: location.pathname })); return; }
      var nav = performance.getEntriesByType ? performance.getEntriesByType('navigation')[0] : null, kept = JSON.parse(sessionStorage.getItem('liveboard.pj') || 'null');
      if (nav && nav.type === 'reload' && kept && kept.path === location.pathname) presentPj = Number(kept.pj) || 0;
      else sessionStorage.removeItem('liveboard.pj');
    } catch (e) { /* no storage: this page only */ }
  })();
  if (presentMode && /(?:^#|&)(?:tk|part|at|cls|pj)=/.test(location.hash)) { try { history.replaceState(null, '', location.pathname + location.search + '#present'); } catch (e) {} }
  (function () {
    var m = location.hash.match(/(?:^#|&)lb=([^&]+)/), q = location.hash.match(/(?:^#|&)q=([^&]+)/);
    if (q) { try { handedQ = decodeURIComponent(q[1]); } catch (e) { handedQ = ''; } }
    // Version 15: the app hands over its ticket (#lb=<Live Board link>&st=<ticket>). An older link carries
    // #lb=CLASS|Name&st=<ticket>. Either way the ticket is checked with Live Board, which names the student.
    var stm = location.hash.match(/(?:^#|&)st=([^&]+)/);
    if (m || stm) {
      var parts = []; try { parts = m ? decodeURIComponent(m[1]).split('|') : []; } catch (e) { parts = []; }
      if (parts.length === 2 && parts[0] && parts[1] && !/^https?:/i.test(parts[0])) handedId = { cls: parts[0], name: parts[1] };
      if (stm) { var stv = ''; try { stv = decodeURIComponent(stm[1]); } catch (e) { stv = ''; } if (stv) { handedId = handedId || { cls: '', name: '' }; handedId.st = stv; } }
    }
    if (m || q || reviseWanted || /(?:^#|&)st=/.test(location.hash)) { try { history.replaceState(null, '', location.pathname + location.search + (presentMode ? '#present' : '')); } catch (e) {} }
  })();
  function fromLink() { var h = handedId; handedId = null; return h; }

  /* Version 15: slides parked out of the lesson (#l-held) and slides nested in another slide are not slides. */
  function slideList() {
    return Array.prototype.slice.call(document.querySelectorAll('.slide')).filter(function (s) {
      return !(s.closest && s.closest('#l-held')) && !(s.parentElement && s.parentElement.closest && s.parentElement.closest('.slide'));
    });
  }
  function slideCount() { return slideList().length; }
  function currentSlide() {
    var all = slideList();
    for (var i = 0; i < all.length; i++) if (!all[i].hidden && all[i].offsetParent !== null) return all[i];
    for (var j = 0; j < all.length; j++) if (!all[j].hidden) return all[j];
    return null;
  }
  function slideNo(id) { var all = slideList(); for (var i = 0; i < all.length; i++) if (all[i].id === id) return i + 1; return 0; }
  function goSlide(id) {
    if (!id || !document.getElementById(id)) return;
    var sp = document.querySelector('[id$="-splash"]');
    if (sp && sp.getBoundingClientRect().width && getComputedStyle(sp).display !== 'none') { try { sp.click(); } catch (e) {} }
    var b = document.createElement('button');
    b.type = 'button'; b.hidden = true; b.setAttribute('data-go', id);
    document.body.appendChild(b); b.click(); b.remove();
  }
  function slideNow() {
    var all = slideList();
    for (var i = 0; i < all.length; i++) if (!all[i].hidden && all[i].offsetParent !== null) return i + 1;
    for (var j = 0; j < all.length; j++) if (!all[j].hidden) return j + 1;
    return 0;
  }

  /* ---------------- steps inside a slide (version 15) ----------------
     A staged card ([data-step], moved by its data-rl-go buttons), a story told in beats (.l-story .l-beat), a pager
     of questions (.question-pager) or the check's pages (.quiz-nav). Steps count from 0. */
  function getStep(sl) {
    if (!sl) return 0;
    var st = sl.querySelector('[data-step]');
    if (st) return Math.max(0, Number(st.getAttribute('data-step')) || 0);
    if (sl.classList.contains('l-story')) {
      var beats = sl.querySelectorAll('.l-beat');
      for (var i = 0; i < beats.length; i++) if (!beats[i].hidden) return i;
      return 0;
    }
    var nav = sl.querySelector('.question-pager .pager-nav') || sl.querySelector('.quiz-nav');
    if (nav) {
      var bs = nav.querySelectorAll('button');
      for (var k = 0; k < bs.length; k++) if (bs[k].classList.contains('selected')) return k;
    }
    return 0;
  }
  /* How many steps the slide has (0 when it has none), for the phone to walk them. */
  function stepCount(sl) {
    if (!sl) return 0;
    var st = sl.querySelector('[data-step]');
    if (st) { var stg = st.querySelectorAll('.rl-stages i'); if (stg.length) return stg.length; var gs = st.querySelectorAll('[data-rl-go]'); var mx = 0; Array.prototype.forEach.call(gs, function (b) { mx = Math.max(mx, Number(b.getAttribute('data-rl-go')) + 1); }); return Math.max(mx, getStep(sl) + 1); }
    if (sl.classList.contains('l-story')) return sl.querySelectorAll('.l-beat').length;
    var nav = sl.querySelector('.question-pager .pager-nav') || sl.querySelector('.quiz-nav');
    return nav ? nav.querySelectorAll('button').length : 0;
  }
  function slideTitle(sl) {
    var h = sl && sl.querySelector('h1, h2');
    return h ? h.textContent.replace(/\s+/g, ' ').trim().slice(0, 120) : '';
  }
  function setStep(sl, n) {
    n = Math.max(0, Math.round(Number(n) || 0));
    if (!sl || getStep(sl) === n) return false;
    var st = sl.querySelector('[data-step]');
    if (st) {
      var b = document.createElement('button');
      b.type = 'button'; b.hidden = true; b.setAttribute('data-rl-go', String(n));
      st.appendChild(b); b.click(); if (b.parentNode) b.remove();
      return true;
    }
    if (sl.classList.contains('l-story')) {
      var beats = sl.querySelectorAll('.l-beat'), want = Math.min(n, beats.length - 1), tries = beats.length;
      while (getStep(sl) !== want && tries-- > 0) {
        var t = document.createElement('button'); t.type = 'button'; t.hidden = true;
        t.className = getStep(sl) < want ? 'next' : 'prev';
        sl.appendChild(t); t.click(); t.remove();
      }
      return true;
    }
    var nav = sl.querySelector('.question-pager .pager-nav') || sl.querySelector('.quiz-nav');
    if (nav) { var bs = nav.querySelectorAll('button'); if (bs[n]) { bs[n].click(); return true; } }
    return false;
  }

  /* ---------------- drafts (version 15) ----------------
     What a student types in a slide is kept on the iPad as they type, so a jump by the teacher (or the deck
     drawing a card again) never loses it. A draft goes back into its box when the box shows again empty, and it
     is dropped once the answer is sent. */
  var DRAFT_KEY = 'liveboard.drafts:' + (cfg.topicId || ''), drafts = readJ(DRAFT_KEY) || {}, draftTimer = null;
  if (typeof drafts !== 'object' || Array.isArray(drafts)) drafts = {};
  function draftOf(f) {
    if (!f || !f.tagName || presenting) return null;
    var tag = f.tagName;
    if (tag !== 'TEXTAREA' && !(tag === 'INPUT' && /^(text|number|search|tel|)$/i.test(f.getAttribute('type') || ''))) return null;
    if (f.closest('.lbx, .lbq, .lbdock, .sq, .lbres, .lbpres, .lbstrip')) return null;
    var sl = f.closest('.slide');
    if (!sl || !sl.id || slideList().indexOf(sl) < 0) return null;
    var h = f.closest('[data-question]'), task = h ? h.getAttribute('data-question') : '';
    if (!task) { h = f.closest('[data-task]'); task = h ? h.getAttribute('data-task') : ''; }
    if (!task) { h = f.closest('[data-cur-task]'); task = h ? h.getAttribute('data-cur-task') : ''; }
    var field = f.getAttribute('data-stg') || f.getAttribute('data-input') || f.getAttribute('name') || '';
    if (!field) {
      var box = h || sl, all = box.querySelectorAll('textarea, input');
      field = 'f' + Array.prototype.indexOf.call(all, f);
    }
    return { key: sl.id + '|' + (task || '') + '|' + field, task: task || '', slide: sl };
  }
  function saveDraftsNow() { clearTimeout(draftTimer); draftTimer = null; writeJ(DRAFT_KEY, Object.keys(drafts).length ? drafts : null); }
  function dropDrafts(task) {
    if (!task) return;
    var gone = false;
    Object.keys(drafts).forEach(function (k) { if (drafts[k] && drafts[k].t === task) { delete drafts[k]; gone = true; } });
    if (gone) saveDraftsNow();
  }
  function clearDrafts() { drafts = {}; saveDraftsNow(); }
  document.addEventListener('input', function (e) {
    var d = draftOf(e.target);
    if (!d) return;
    var v = String(e.target.value || '');
    if (v.trim()) drafts[d.key] = { v: v, t: d.task, at: Date.now() }; else delete drafts[d.key];
    clearTimeout(draftTimer); draftTimer = setTimeout(saveDraftsNow, 300);
  }, true);
  /* A card on the slide that holds typed work not sent yet. */
  function hasDraft(sl) {
    if (!sl) return false;
    var fs = sl.querySelectorAll('textarea, input');
    for (var i = 0; i < fs.length; i++) {
      var f = fs[i];
      if (!f.value || f.disabled || f.offsetParent === null) continue;
      var d = draftOf(f);
      if (d && drafts[d.key] && drafts[d.key].v === f.value) return true;
    }
    return false;
  }
  var restoring = false;
  function restoreDrafts() {
    if (restoring || presenting) return;
    var sl = currentSlide();
    if (!sl) return;
    restoring = true;
    try {
      Array.prototype.forEach.call(sl.querySelectorAll('textarea, input'), function (f) {
        if (f.value || f.disabled || f.readOnly) return;
        var d = draftOf(f);
        if (!d || !drafts[d.key]) return;
        f.value = drafts[d.key].v;
        f.dispatchEvent(new Event('input', { bubbles: true }));
      });
    } finally { restoring = false; }
  }
  var restorePend = false;
  if (window.MutationObserver) new MutationObserver(function () {
    if (restorePend) return;
    restorePend = true;
    (window.requestAnimationFrame || setTimeout)(function () { restorePend = false; restoreDrafts(); });
  }).observe(document.body || document.documentElement, { childList: true, subtree: true });

  /* ---------------- chapter check result ---------------- */
  function showCheck(c) {
    var old = document.querySelector('.lbr'); if (old) old.remove();
    var box = el('div', 'lbr');
    box.setAttribute('role', 'status');
    var won = c.points > 0;
    box.appendChild(el('div', 'lbr-big', c.pct + '%'));
    var tx = el('div', 'lbr-tx');
    tx.appendChild(el('b', '', won ? '+' + c.points + ' points' : 'Chapter check marked'));
    var line = c.score + ' of ' + c.out + ' marked questions right. ';
    if (won) line += 'Your points are updated.';
    else if (c.hadPoints) line += 'You already have the points for this chapter check.';
    else if (c.note) line += c.note.replace(/^Not given yet: .*/, 'Your teacher will add the points.');
    else if (!c.bestCounts && !c.firstTry) line += 'Points come from the first try only. Your first try was ' + (c.first == null ? 'not recorded' : c.first + '%') + '.';
    else line += 'Points come from right answers, with a bonus for answers right in a row. Go back over the pages the check marked for you.' + (c.bestCounts ? ' Then try again.' : '');
    tx.appendChild(el('span', '', line));
    // With the first-try rule, another try is practice, so the deck's own button says so.
    var retry = document.querySelector('.quiz-retry');
    if (retry && !c.bestCounts) retry.textContent = 'Try again (practice, no points)';
    box.appendChild(tx);
    var x = el('button', 'lbr-x', 'OK'); x.type = 'button';
    x.addEventListener('click', function () { box.remove(); });
    box.appendChild(x);
    if (won) {
      var burst = el('div', 'lbr-burst');
      for (var i = 0; i < 18; i++) { var d = el('i'); d.style.setProperty('--a', (i * 20) + 'deg'); d.style.setProperty('--d', (60 + (i % 3) * 22) + 'px'); burst.appendChild(d); }
      box.appendChild(burst);
      box.classList.add('won');
    }
    document.body.appendChild(box);
    setTimeout(function () { if (box.parentNode) box.remove(); }, 15000);
  }

  /* ---------------- ask now ---------------- */
  var asking = null, askBar = null, askTimer = null, askLive = false;
  var DISMISS_KEY = 'liveboard.askSeen';
  function goToTask(taskId) {
    var t = byId[taskId];
    if (!t) return false;
    var e = t.slide ? document.getElementById(t.slide) : null;
    var s = e ? (e.classList.contains('slide') ? e : e.closest('.slide')) : null;
    if (!s || !s.id) return false;
    goSlide(s.id);
    setTimeout(function () {
      var q = document.querySelector('[data-question="' + taskId + '"]') || document.querySelector('[data-quiz-task="' + taskId + '"]');
      if (q && q.hidden) q = q.closest('.quiz') || q;   // the chapter check shows one question at a time
      if (q && q.scrollIntoView) q.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }, 120);
    return true;
  }
  function hideAsk() { if (askBar) { askBar.remove(); askBar = null; } }
  /* The countdown the teacher chose. At 0 the card says Time's up and closes. */
  function tickAsk() {
    var t = askBar && askBar.querySelector('.lbq-time');
    if (!t) return;
    var left = Math.max(0, Math.round((Number(t.getAttribute('data-ends')) - Date.now()) / 1000));
    t.textContent = Math.floor(left / 60) + ':' + ('0' + (left % 60)).slice(-2);
    if (left <= 0 && asking && !askBar.classList.contains('done')) {
      writeJ(DISMISS_KEY, askKey(asking));
      askBar.innerHTML = '';
      askBar.classList.add('done');
      askBar.appendChild(el('span', 'lbq-tag', "Time's up"));
      askBar.appendChild(el('div', 'lbq-q', 'Look up at the board.'));
      setTimeout(hideAsk, 2500);
    }
  }
  setInterval(tickAsk, 1000);
  function askKey(a) { return a.taskId + '@' + a.at; }
  function answeredAsk() {
    if (!asking) return;
    writeJ(DISMISS_KEY, askKey(asking));
    if (askBar && !askBar.classList.contains('done')) {   // answered on the slide itself
      askBar.innerHTML = '';
      askBar.classList.add('done');
      askBar.appendChild(el('span', 'lbq-tag', 'Sent'));
      askBar.appendChild(el('div', 'lbq-q', 'Your answer is on its way. Look up at the board.'));
      setTimeout(hideAsk, 3000);
    }
  }
  function isCheckTask(id) { return checkIds.indexOf(id) >= 0; }

  /* Sends one answer through the deck's own Check button, on a hidden copy of the question,
     so it works wherever the real question sits (a later part of a story, a step, a pager). */
  function sendAnswer(t, value) {
    var wrap = el('div'); wrap.hidden = true;
    var q = el('div'); q.setAttribute('data-question', t.id);
    var inp;
    if (t.kind === 'choice') { inp = el('input'); inp.type = 'radio'; inp.value = value; inp.checked = true; }
    else { inp = el(t.kind === 'written' ? 'textarea' : 'input'); inp.value = value; }
    inp.setAttribute('data-input', t.id);
    var b = el('button'); b.type = 'button'; b.setAttribute('data-action', 'submit');
    q.appendChild(inp); q.appendChild(b); wrap.appendChild(q); document.body.appendChild(wrap);
    inp.dispatchEvent(new Event('input', { bubbles: true }));
    b.click();
    var fb = wrap.querySelector('.feedback');
    var problem = fb && /^Enter /.test(fb.textContent || '') ? fb.textContent : '';
    wrap.remove();
    return problem;
  }

  function showAsk(a, folded) {
    hideAsk();
    var t = byId[a.taskId];
    askBar = el('div', 'lbq' + (folded ? ' folded' : ''));
    askBar.setAttribute('role', 'dialog');
    askBar.setAttribute('aria-label', 'Your teacher is asking');
    var head = el('div', 'lbq-head');
    head.appendChild(el('span', 'lbq-tag', 'Your teacher is asking'));
    if (a.ends) { var tm = el('span', 'lbq-time'); tm.setAttribute('data-ends', String(a.ends)); head.appendChild(tm); tickAsk(); }
    var x = el('button', 'lbq-x', '×'); x.type = 'button'; x.setAttribute('aria-label', 'Close');
    x.addEventListener('click', function () { writeJ(DISMISS_KEY, askKey(a)); hideAsk(); });
    head.appendChild(x);
    askBar.appendChild(head);
    askBar.appendChild(el('div', 'lbq-q', a.question));
    if (folded || !t || isCheckTask(a.taskId)) {
      var row0 = el('div', 'lbq-row');
      var open = el('button', 'lbq-send', isCheckTask(a.taskId) ? 'Go to the question' : 'Answer'); open.type = 'button';
      open.addEventListener('click', function () { if (isCheckTask(a.taskId)) { goToTask(a.taskId); hideAsk(); } else showAsk(a, false); });
      row0.appendChild(open);
      askBar.appendChild(row0);
      document.body.appendChild(askBar);
      return;
    }
    var value = '';
    var body = el('div', 'lbq-body');
    var send = el('button', 'lbq-send', 'Send answer'); send.type = 'button'; send.disabled = true;
    if (t.kind === 'choice') {
      var opts = el('div', 'lbq-opts');
      (t.options || []).forEach(function (o) {
        var ob = el('button', 'lbq-opt', o); ob.type = 'button';
        ob.addEventListener('click', function () {
          Array.prototype.forEach.call(opts.children, function (c) { c.classList.remove('on'); c.setAttribute('aria-pressed', 'false'); });
          ob.classList.add('on'); ob.setAttribute('aria-pressed', 'true'); value = o; send.disabled = false;
        });
        opts.appendChild(ob);
      });
      body.appendChild(opts);
    } else {
      var box = el('label', 'lbq-entry');
      var inp = el(t.kind === 'written' ? 'textarea' : 'input');
      if (t.kind === 'number') { inp.inputMode = 'decimal'; inp.placeholder = 'Your answer, e.g. 3.0e8'; } else inp.placeholder = 'Write your answer';
      inp.addEventListener('input', function () { value = inp.value; send.disabled = !value.trim(); });
      box.appendChild(inp);
      if (t.kind === 'number' && t.unit) box.appendChild(el('b', '', t.unit));
      body.appendChild(box);
    }
    askBar.appendChild(body);
    var row = el('div', 'lbq-row');
    row.appendChild(send);
    var look = el('button', 'lbq-link', 'See the slide'); look.type = 'button';
    look.addEventListener('click', function () { goToTask(a.taskId); showAsk(a, true); });
    row.appendChild(look);
    askBar.appendChild(row);
    var msg = el('p', 'lbq-msg'); askBar.appendChild(msg);
    send.addEventListener('click', function () {
      if (!value.trim()) return;
      var problem = sendAnswer(t, value);
      if (problem) { msg.textContent = problem; return; }
      writeJ(DISMISS_KEY, askKey(a));
      askBar.innerHTML = '';
      askBar.classList.add('done');
      askBar.appendChild(el('span', 'lbq-tag', 'Sent'));
      askBar.appendChild(el('div', 'lbq-q', 'Your answer is on its way. Look up at the board.'));
      setTimeout(hideAsk, 3000);
    });
    document.body.appendChild(askBar);
  }
  /* ---------------- quick check dock (version 15, Ruling A4) ----------------
     The check opens over the lower 35% of the deck, the same for every check type, so the slide it is about stays
     in view. One tap answers. The answer can be changed until the teacher closes the check. Nothing about how the
     class answered shows while it is open: the student's own result and the counts come only after it closes. */
  var dock = null, dockKey = '', dockMine = null, dockSending = false, dockShut = '', dockDrawn = '', dockErr = '', dockQ = null;
  function dockOn() { return !!dock; }
  function quickOptions(q) {
    if (Array.isArray(q.options) && q.options.length) return q.options.map(String);
    if (q.type === 'abcd') return ['A', 'B', 'C', 'D'];
    if (q.type === 'tf') return ['True', 'False'];
    if (q.type === 'gotit') return ['Got it', 'Nearly', 'Lost'];
    if (q.type === 'slide') { var t = byId[q.taskId]; if (t && t.kind === 'choice') return (t.options || []).map(String); }
    return [];
  }
  function closeDock() {
    if (dock) { dock.remove(); dock = null; }
    dockDrawn = '';
    document.body.classList.remove('lb-docked');
  }
  function showQuick(q) {
    if (presenting) return;
    if (!q || !q.id) { dockQ = null; closeDock(); return; }
    var key = q.id + ':' + (q.round || 1);
    if (key !== dockKey) { dockKey = key; dockMine = null; dockSending = false; dockErr = ''; }
    if (q.mine != null && !dockSending) dockMine = String(q.mine);
    dockQ = q;
    if (!q.open && dockShut === key) { closeDock(); return; }
    var view = JSON.stringify([key, !!q.open, dockMine, dockSending, dockErr, q.result || null, q.prompt || '']);
    if (view === dockDrawn && dock) return;
    // Never redraw under a student typing a word.
    var ae = document.activeElement;
    if (dock && q.open && dockDrawn && ae && dock.contains(ae) && ae.tagName === 'INPUT' && !dockSending && JSON.parse(dockDrawn)[1] === true) return;
    dockDrawn = view;
    drawDock(q, key);
  }
  function drawDock(q, key) {
    if (!dock) {
      dock = el('div', 'lbdock');
      dock.setAttribute('role', 'dialog');
      dock.setAttribute('aria-label', 'Quick check');
      document.body.appendChild(dock);
      document.body.classList.add('lb-docked');
    }
    dock.innerHTML = '';
    var inner = el('div', 'lbdock-in');
    dock.appendChild(inner);
    var head = el('div', 'lbdock-head');
    head.appendChild(el('span', 'lbdock-tag' + (q.open ? '' : ' shut'), q.open ? 'Quick check' : 'Quick check closed'));
    if ((q.round || 1) > 1) head.appendChild(el('span', 'lbdock-round', 'Round ' + q.round));
    inner.appendChild(head);
    var t = q.type === 'slide' ? byId[q.taskId] : null;
    var prompt = q.prompt || (t ? t.question : '') ||
      (q.type === 'gotit' ? 'How well do you understand this slide?' : q.type === 'word' ? 'Look at the board. Type one word as your answer.' : 'Look at the board, then answer here.');
    inner.appendChild(el('div', 'lbdock-q', prompt));
    var opts = quickOptions(q);
    if (q.open) {
      if (opts.length) {
        var grid = el('div', 'lbdock-opts' + (opts.length > 4 ? ' many' : ''));
        opts.forEach(function (o, i) {
          var b = el('button', 'lbdock-opt' + (dockMine === o ? ' on' : ''));
          b.type = 'button';
          b.setAttribute('aria-pressed', dockMine === o ? 'true' : 'false');
          if (q.type === 'slide' && opts.length > 1) b.appendChild(el('b', '', LETTERS.charAt(i)));
          b.appendChild(el('span', '', o));
          b.disabled = dockSending;
          b.addEventListener('click', function () { sendQuick(o); });
          grid.appendChild(b);
        });
        inner.appendChild(grid);
        inner.appendChild(el('p', 'lbdock-note' + (dockErr ? ' bad' : ''), dockErr || (dockSending ? 'Sending your answer.' : dockMine != null
          ? 'Your answer is ' + dockMine + '. You can change it until your teacher closes the check.'
          : 'Tap your answer. You can change it until your teacher closes the check.')));
      } else {
        var row = el('div', 'lbdock-entry'), inp = el('input');
        inp.type = 'text'; inp.autocomplete = 'off'; inp.spellcheck = false;
        inp.maxLength = q.type === 'word' ? 40 : 200;
        inp.placeholder = q.type === 'word' ? 'One word' : 'Your answer';
        inp.setAttribute('aria-label', 'Your answer');
        if (t && t.kind === 'number') inp.inputMode = 'decimal';
        inp.value = dockMine || '';
        var sb = el('button', 'lbdock-send', dockMine != null ? 'Send again' : 'Send'); sb.type = 'button';
        sb.disabled = dockSending;
        var go = function () { var v = inp.value.trim(); if (v) sendQuick(v); };
        sb.addEventListener('click', go);
        inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); go(); } });
        row.appendChild(inp);
        if (t && t.kind === 'number' && t.unit) row.appendChild(el('b', '', t.unit));
        row.appendChild(sb);
        inner.appendChild(row);
        inner.appendChild(el('p', 'lbdock-note' + (dockErr ? ' bad' : ''), dockErr || (dockSending ? 'Sending your answer.' : dockMine != null
          ? 'You sent ' + dockMine + '. You can send a different answer until your teacher closes the check.'
          : 'Type your answer, then tap Send.')));
      }
      return;
    }
    // Closed: the student's own result first, then the counts (never names).
    var res = q.result || null, line;
    var said = q.type === 'gotit' ? 'You chose ' : 'You answered ';
    if (dockMine == null) line = 'You did not answer this check.' + (res && res.correct ? ' The answer is ' + res.correct + '.' : '');
    else if (res && res.right === true) line = said + dockMine + '. That is right.';
    else if (res && res.right === false) line = said + dockMine + '.' + (res.correct ? ' The answer is ' + res.correct + '.' : '');
    else line = said + dockMine + '.';
    inner.appendChild(el('p', 'lbdock-mine' + (res && res.right === true ? ' ok' : res && res.right === false ? ' no' : ''), line));
    if (res && res.counts && typeof res.counts === 'object') {
      var keys = opts.length ? opts.slice() : Object.keys(res.counts).sort(function (a, b) { return (res.counts[b] || 0) - (res.counts[a] || 0); }).slice(0, 6);
      var total = Number(res.total) || keys.reduce(function (n, k) { return n + (Number(res.counts[k]) || 0); }, 0);
      var most = 1; keys.forEach(function (k) { most = Math.max(most, Number(res.counts[k]) || 0); });
      var bars = el('div', 'lbdock-bars');
      keys.forEach(function (k) {
        var n = Number(res.counts[k]) || 0, rowb = el('div', 'lbdock-bar' + (res.correct != null && String(res.correct) === k ? ' ok' : '') + (dockMine === k ? ' me' : ''));
        rowb.appendChild(el('span', 'l', k));
        var tr = el('span', 't'), fill = el('i'); fill.style.width = Math.round(100 * n / most) + '%'; tr.appendChild(fill); rowb.appendChild(tr);
        rowb.appendChild(el('b', '', String(n)));
        bars.appendChild(rowb);
      });
      inner.appendChild(bars);
      if (total) inner.appendChild(el('p', 'lbdock-note', total + (total === 1 ? ' answer' : ' answers') + ' from the class.'));
    }
    var okb = el('button', 'lbdock-send', 'OK'); okb.type = 'button';
    okb.addEventListener('click', function () { dockShut = key; closeDock(); });
    inner.appendChild(okb);
  }
  function sendQuick(answer) {
    var q = dockQ;
    if (!q || !q.open || dockSending) return;
    var key = q.id + ':' + (q.round || 1), was = dockMine;
    dockMine = String(answer); dockSending = true; dockErr = '';
    showQuick(q);
    api({ api: 'qa', st: stNow(), qid: q.id, round: q.round || 1, answer: String(answer) }).then(function (r) {
      if (dockKey !== key) return;
      dockSending = false;
      if (r && r.ok) { dockMine = r.mine != null ? String(r.mine) : String(answer); q.mine = dockMine; }
      else if (r && r.closed) { q.open = false; dockMine = was; clearTimeout(quickTimer); quickTimer = setTimeout(checkAsk, 300); }
      else if (r && r.signedOut) { signedOutHere(); return; }
      else { dockMine = was; dockErr = (r && r.error) || 'That did not send. Tap your answer again.'; }
      showQuick(q);
    }, function () {
      if (dockKey !== key) return;
      dockSending = false; dockMine = was;
      dockErr = 'That did not send. Check the wifi, then tap your answer again.';
      showQuick(q);
    });
  }
  var ctl = null, ctlKnown = false, fails = 0, followedAt = 0, readSecs = 15;
  /* Answers not yet saved by Live Board: the deck's own queue and the bridge's outbox. */
  function pendingCount() {
    var n = 0;
    try { n = window.ScienceSync && typeof window.ScienceSync.pending === 'function' ? window.ScienceSync.pending().length : 0; } catch (e) { n = 0; }
    return n + outboxCount();
  }
  var lessonMode = '';
  function checkAsk() {
    clearTimeout(askTimer); clearTimeout(quickTimer);
    askTimer = setTimeout(checkAsk, 8000 + Math.floor(Math.random() * 4000));   // replaced by Live Board's own timing below
    if (document.hidden) { clearTimeout(askTimer); return; }   // never while hidden: the check runs again when the page shows
    // One check at a time, so answers never arrive out of order (a check out for 10 s is given up).
    if (checkBusy && Date.now() - checkBusy < 10000) { checkAgain = true; return; }
    checkBusy = Date.now(); checkAgain = false;
    var myCheck = checkBusy;
    var checkDone = function () {
      if (checkBusy !== myCheck) return false;
      checkBusy = 0;
      if (checkAgain) { checkAgain = false; clearTimeout(quickTimer); quickTimer = setTimeout(checkAsk, 400); }
      return true;
    };
    lastCheckAt = Date.now();
    var me = readJ(ID_KEY), cur = currentSlide();
    var rd = readIds().map(slideNo).filter(Boolean).join(',');
    api({ api: 'live', topicId: cfg.topicId, who: me && me.cls ? { cls: me.cls, name: me.name } : null, st: me && me.st ? me.st : '', slide: slideNow(), total: slideCount(),
      dev: DEV, v: VERSION, on: Math.round((Date.now() - curSince) / 1000), rd: rd, pend: pendingCount(), sid: cur ? cur.id : '', step: getStep(cur) }).then(function (r) {
      if (!checkDone()) return;   // an older check, answered after a newer one
      fails = 0; offlineNote();
      if (r && r.poll) { clearTimeout(askTimer); askTimer = setTimeout(checkAsk, pollSecs(r) * 1000 * (0.85 + Math.random() * 0.3)); }
      if (r && r.readSecs) readSecs = r.readSecs;
      if (r && r.reset) { resetHere(); return; }
      if (r && r.signedOut) { signedOutHere(); return; }
      var wasLive = lessonLive;
      lessonLive = !!(r && r.live);
      lessonMode = r && r.mode ? String(r.mode) : '';
      if (lessonLive && !wasLive && outboxCount()) { heldTry = 0; setTimeout(flushOutbox, 300 + Math.random() * 2500); }   // answers held before Start go now
      if (r && r.bv && r.bv > VERSION) reloadForNewer();
      if (r && r.ok && r.ctl && r.live === undefined && me && !me.st) setMode('live');   // Live Board not updated yet
      if (r && r.who && me && me.st) {
        setMode(r.live ? 'live' : r.open ? 'revise' : 'closed');
        writeJ(LIVE_KEY, r.live ? { who: me.cls + '|' + me.name, at: Date.now() } : null);
      }
      ctl = r && r.ctl ? r.ctl : null;
      ctlKnown = true;
      applyLook(); enforce();
      try { sqStudent(r && r.ok && r.live ? r.game : null); } catch (e) { /* the slides carry on */ }
      try { showQuick(r && r.ok && r.live && me && me.st ? r.quick || null : null); } catch (e) { /* the slides carry on */ }
      if (!mineAsked && me && me.cls) askMine(me);
      var a = r && r.ok && r.ask && byId[r.ask.taskId] ? r.ask : null;
      if (handedQ) {   // opened from learnwithmrcedric: show the asked question, or go to the slide if it is no longer asked
        var hq = handedQ; handedQ = '';
        if (!a || a.taskId !== hq) goToTask(hq);
      }
      if (!a) { asking = null; if (askBar && !askBar.classList.contains('done')) hideAsk(); return; }
      var same = asking && askKey(asking) === askKey(a);
      asking = a;
      if (same && askBar) return;
      if (askBar && askBar.classList.contains('done')) return;
      if (readJ(DISMISS_KEY) === askKey(a)) return;
      if (a.ends && a.ends < Date.now()) return;
      showAsk(a, !!a.quiet);
    }).catch(function () {
      if (!checkDone()) return;
      fails++; offlineNote();
      // Errors back off, with jitter, up to 30 seconds.
      clearTimeout(askTimer);
      askTimer = setTimeout(checkAsk, Math.min(30000, 2000 * Math.pow(2, Math.min(fails, 5))) * (0.85 + Math.random() * 0.3));
    });
  }
  /* How long until the next check. Release 34 sets it: 4 s in a live lesson, 2 s while a quick check waits for this
     student's answer or just after a teacher command, 14 s outside a lesson. An older Live Board says 14 (6 while it
     is asking or leading), and then the iPad checks every 3 seconds in a lesson, as version 14 did. */
  var FAST_SECS = 3, lastCheckAt = 0, quickTimer = null, checkBusy = 0, checkAgain = false;
  function pollSecs(r) {
    if (r.mode !== undefined || r.quick !== undefined) return Math.max(1, Number(r.poll) || 4);
    var c = r.ctl || {};
    var lesson = !!(r.ask || r.live || c.pause || c.follow || c.hold || c.lead);
    return lesson ? Math.min(r.poll, FAST_SECS) : r.poll;
  }
  /* In a lesson, a student's slide change is checked in straight away (at most one check every 1.5 seconds), so the
     teacher's phone shows them on their new slide at once. */
  function quickCheck() {
    if (!askLive || presenting || mode !== 'live' || !ctlKnown || !ctl) return;
    clearTimeout(quickTimer);
    quickTimer = setTimeout(checkAsk, Math.max(500, 1500 - (Date.now() - lastCheckAt)));
  }
  function startLive() {
    if (askLive) return;
    askLive = true;
    if (handedQ && (isCheckTask(handedQ) || !byId[handedQ])) { var q = handedQ; handedQ = ''; setTimeout(function () { goToTask(q); }, 300); }
    // The first check is spread over four seconds, for a class that opens the deck together.
    askTimer = setTimeout(checkAsk, Math.floor(Math.random() * 4000));
    document.addEventListener('visibilitychange', function () { if (!document.hidden) { checkAsk(); keepAwake(); } else sendAway(); });
    window.addEventListener('pagehide', sendAway);
    keepAwake();
  }
  /* Off the slides: the moment the page is hidden, a short note tells Live Board, so the teacher's phone shows
     it within seconds. Coming back is the next check, which clears it. Sent with sendBeacon, which still goes
     out while the page is being hidden or closed. */
  function sendAway() {
    var me = readJ(ID_KEY);
    if (presenting || !me || !me.cls) return;
    var body = JSON.stringify({ api: 'away', topicId: cfg.topicId, who: { cls: me.cls, name: me.name }, st: me.st || '', away: true, dev: DEV });
    try { if (navigator.sendBeacon && navigator.sendBeacon(cfg.endpoint, new Blob([body], { type: 'text/plain;charset=utf-8' }))) return; } catch (e) { /* use fetch */ }
    try { original.call(window, cfg.endpoint, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: body, keepalive: true }).catch(function () {}); } catch (e) { /* nothing more to do */ }
  }

  /* ---------------- lesson control ---------------- */
  var block = null, blockKey = '', stepFollowed = '';
  function isCheckSlide(sl) {
    if (sl.getAttribute('data-kind') === 'assessment') return true;
    var t = checkIds.length ? byId[checkIds[0]] : null;
    return !!(t && t.slide === sl.id);
  }
  function isWholeClass(sl) { return sl.hasAttribute('data-whole-class') || sl.getAttribute('data-kind') === 'hook'; }
  function setBlock(b) {
    var key = b ? JSON.stringify(b) : '';
    if (key === blockKey) return;
    blockKey = key;
    if (block) { block.remove(); block = null; }
    if (!b) return;
    block = el('div', 'lbs' + (b.kind === 'pause' ? ' pause' : ''));
    block.setAttribute('role', 'alertdialog');
    var inner = el('div', 'lbs-in'), row = el('div', 'lbs-row');
    var btn = function (text, go, cls) { var x = el('button', cls || '', text); x.type = 'button'; x.addEventListener('click', go); row.appendChild(x); };
    if (b.kind === 'pause') {
      inner.appendChild(el('h2', '', 'Eyes on the board'));
      inner.appendChild(el('p', '', b.msg || 'Your teacher has paused the iPads.'));
    } else if (b.kind === 'stop') {
      inner.appendChild(el('h2', '', b.follow ? 'You are ahead of your teacher' : 'Stop here for now'));
      inner.appendChild(el('p', '', b.follow ? 'Your teacher is on slide ' + b.limit + '. Wait for them there, or look back at an earlier slide.' : 'Your teacher has asked the class to stop at slide ' + b.limit + '. Go back to anything still grey on your checklist.'));
      btn('Back to slide ' + b.limit, function () { goSlide(slideList()[b.limit - 1].id); }, 'go');
      if (summaryId) btn('My checklist', function () { goSlide(summaryId); });
    } else if (b.kind === 'check') {
      inner.appendChild(el('h2', '', 'The ' + CHECK_NAME + ' is not open yet'));
      inner.appendChild(el('p', '', 'Your teacher will open it when the class is ready.'));
      btn('Go back', function () { var n = b.n - 1; if (n >= 1) goSlide(slideList()[n - 1].id); }, 'go');
    } else if (b.kind === 'together') {
      inner.appendChild(el('h2', '', 'You are ahead of your teacher'));
      inner.appendChild(el('p', '', "We'll do this slide together. " + (b.lead ? 'Your teacher is on slide ' + b.lead + '. ' : '') + 'Wait for them to get here.'));
      btn(b.lead ? 'Back to slide ' + b.lead : 'Go back', function () { var n = b.lead || b.n - 1; if (n >= 1 && slideList()[n - 1]) goSlide(slideList()[n - 1].id); }, 'go');
    }
    inner.appendChild(row);
    block.appendChild(inner);
    document.body.appendChild(block);
  }
  /* Runs every second and after each check: puts up (or takes down) whatever the teacher has set. A student past the
     teacher's slide is told so on any slide: with Follow on it is a stop (the checklist slide stays open, with the
     note), with Follow off a note at the bottom, while the teacher is presenting. */
  function enforce() {
    if (presenting || !ctl) { setBlock(null); aheadNote(0); return; }
    if (sqOn && !ctl.pause) { setBlock(null); aheadNote(0); return; }   // the Streak Challenge covers the slides
    var sl = currentSlide();
    if (!sl) return;
    var n = slideList().indexOf(sl) + 1;
    if (ctl.pause) { setBlock({ kind: 'pause', msg: ctl.msg || '' }); aheadNote(0); return; }
    var lead = ctl.lead && ctl.lead.id ? ctl.lead : null;
    if (ctl.follow && lead && lead.at > followedAt) {
      followedAt = lead.at;
      // Version 15: drafts are kept before the jump, so nothing typed is lost.
      if (lead.id !== sl.id && document.getElementById(lead.id)) { saveDraftsNow(); setBlock(null); aheadNote(0); goSlide(lead.id); return; }
    }
    // Version 15: Together moves the step too. A card holding a draft is never drawn again by a jump: the step
    // waits until the answer is sent (or the box is emptied), and the student can always move on by themselves.
    if (ctl.follow && lead && lead.step != null && lead.id === sl.id) {
      var sk = lead.id + '|' + lead.at + '|' + lead.step + '|' + (lead.sat || '');
      if (sk !== stepFollowed && !hasDraft(sl)) {
        stepFollowed = sk;
        if (getStep(sl) !== Number(lead.step)) { saveDraftsNow(); setStep(sl, lead.step); }
      }
    }
    var limit = Number(ctl.to) || 0, byLead = false;
    if (ctl.follow && lead && lead.n && (!limit || lead.n < limit)) { limit = lead.n; byLead = true; }
    var b = null;
    if (limit && n > limit && sl.id !== summaryId) b = { kind: 'stop', limit: limit, follow: byLead };
    else if (ctl.check !== 'open' && isCheckSlide(sl)) b = { kind: 'check', n: n };
    else if (ctl.hooks && lead && isWholeClass(sl) && n > lead.n) b = { kind: 'together', n: n, lead: lead.n };
    setBlock(b);
    aheadNote(!b && lead && lead.n && n > lead.n && lead.fresh !== false ? lead.n : 0);
  }
  var aheadBox = null, aheadSince = 0, aheadShut = 0;
  function aheadNote(leadN) {
    if (!leadN || leadN === aheadShut) { aheadSince = 0; if (aheadBox) aheadBox.hidden = true; if (!leadN) aheadShut = 0; return; }
    if (!aheadSince) aheadSince = Date.now();
    if (Date.now() - aheadSince < 1500 && (!aheadBox || aheadBox.hidden)) return;   // the teacher may be on the way
    if (!aheadBox) {
      aheadBox = el('div', 'lbahead'); aheadBox.setAttribute('role', 'status');
      document.body.appendChild(aheadBox);
    }
    if (aheadBox.getAttribute('data-n') !== String(leadN)) {
      aheadBox.setAttribute('data-n', String(leadN));
      aheadBox.textContent = '';
      var tx = el('div');
      tx.appendChild(el('b', '', 'You are ahead of your teacher'));
      tx.appendChild(el('span', '', 'Your teacher is on slide ' + leadN + '.'));
      aheadBox.appendChild(tx);
      var go = el('button', '', 'Back to slide ' + leadN); go.type = 'button';
      go.addEventListener('click', function () { var s = slideList()[leadN - 1]; if (s) goSlide(s.id); });
      aheadBox.appendChild(go);
      var x = el('button', 'lbahead-x', '×'); x.type = 'button'; x.setAttribute('aria-label', 'Close this note');
      x.addEventListener('click', function () { aheadShut = leadN; aheadBox.hidden = true; });   // until the teacher moves on
      aheadBox.appendChild(x);
    }
    aheadBox.hidden = false;
  }
  var holdCss = el('style'); document.head.appendChild(holdCss);
  var vidNotes = false;
  function applyLook() {
    var hold = !!(ctl && ctl.hold && !ctl.relAll && !presenting);
    document.body.classList.toggle('lb-hold', hold);
    holdCss.textContent = hold ? (ctl.rel || []).map(function (id) {
      var q = '[data-question="' + String(id).replace(/["\\]/g, '') + '"]';
      return 'body.lb-hold .slide .question' + q + ' .feedback,body.lb-hold .slide .question' + q + ' p.small{display:block!important}' +
        'body.lb-hold .slide .question' + q + ' .model-answer:not([hidden]){display:block!important}' +
        'body.lb-hold .slide .question' + q + ' .actions::after{content:none!important}';
    }).join('') : '';
    var vid = !!(ctl && ctl.vid && ctl.lead && !presenting);
    if (vid && !vidNotes) {
      vidNotes = true;
      Array.prototype.forEach.call(document.querySelectorAll('figure[data-yt], .c1-video, iframe[src*="youtube"], [data-video-board]'), function (v) {
        if (v.previousElementSibling && v.previousElementSibling.classList.contains('lb-vidnote')) return;
        if (v.parentNode && v.parentNode.closest && v.parentNode.closest('.c1-video')) return;
        v.parentNode.insertBefore(el('div', 'lb-vidnote', 'Watch this video on the board.'), v);
      });
    }
    document.body.classList.toggle('lb-vid', vid);
    syncReviseButton();
  }

  /* ---------------- time on each slide ---------------- */
  var dwell = readJ(DWELL_KEY) || {}, curId = '', curSince = Date.now(), tick = 0, lastSync = 0;
  function readIds() { return Object.keys(dwell).filter(function (k) { return dwell[k] >= readSecs; }); }
  function onSlideChange(id) {
    if (presenting) { sendLead(); return; }
    quickCheck();
    if (reviseCard && reviseCard.getAttribute('data-host') === id) loadReview(false).then(null, function () {});
    // Send the record now and then as the student moves, so the slides they opened are kept.
    var me = readJ(ID_KEY), S = window.ScienceSync;
    if (me && me.cls && S && typeof S.sync === 'function' && Date.now() - lastSync > 120000) {
      lastSync = Date.now();
      Promise.resolve().then(function () { return S.sync(); }).catch(function () {});
    }
  }
  var curStep = 0;
  function seeSlide() {
    var sl = currentSlide(), id = sl ? sl.id : '';
    if (id !== curId) { curId = id; curSince = Date.now(); curStep = getStep(sl); if (id) onSlideChange(id); }
    else if (presenting && sl) {
      // Version 15: the presenter's step goes to Live Board as well, so Together moves the class's step.
      var stp = getStep(sl);
      if (stp !== curStep) { curStep = stp; sendLead(); }
    }
    return id;
  }
  /* A key, a tap or a click may change the slide: look straight away (and once more after the deck's move), so the
     projector's new slide goes to Live Board at once instead of at the next second. */
  ['keydown', 'click', 'touchend'].forEach(function (ev) {
    document.addEventListener(ev, function () {
      setTimeout(function () { seeSlide(); enforce(); }, 60);
      setTimeout(seeSlide, 450);
    }, true);
  });
  window.addEventListener('hashchange', function () { setTimeout(seeSlide, 60); });
  setInterval(function () {
    var id = seeSlide();
    if (!document.hidden && id && !presenting && readJ(ID_KEY) && mode === 'live') {
      dwell[id] = Math.min(3600, (dwell[id] || 0) + 1);
      if (++tick % 5 === 0) writeJ(DWELL_KEY, dwell);
    }
    enforce();
  }, 1000);

  /* ---------------- awake, offline, reset ---------------- */
  var wakeLock = null;
  function keepAwake() {
    if (!('wakeLock' in navigator) || document.hidden || wakeLock) return;
    navigator.wakeLock.request('screen').then(function (l) { wakeLock = l; l.addEventListener('release', function () { wakeLock = null; }); }).catch(function () {});
  }
  document.addEventListener('click', keepAwake, { once: true });
  var offBox = null;
  function offlineNote() {
    var off = !presenting && readJ(ID_KEY) && (navigator.onLine === false || fails >= 2);
    if (off && !offBox) {
      offBox = el('div', 'lbo', 'Not connected. Your work is saved on this iPad and will send by itself.');
      offBox.setAttribute('role', 'status');
      document.body.appendChild(offBox);
    }
    if (!off && offBox) { offBox.remove(); offBox = null; }
  }
  window.addEventListener('offline', offlineNote);
  window.addEventListener('online', function () { fails = 0; offlineNote(); checkAsk(); });
  /* The teacher pressed Reset this iPad in Live Board: forget the name and ask again. */
  // Answers still waiting to send are sent first; the reset waits for them.
  var RESET_KEY = 'liveboard.resetWanted';
  function resetHere() {
    writeJ(RESET_KEY, 1);
    var keep = readJ(ID_KEY);
    writeJ(ID_KEY, null);
    if (deckChange && nameBox.value) {
      var done = deckChange.call(changeBtn);
      if (done === false) {
        writeJ(ID_KEY, keep);
        var p = panel();
        p.appendChild(el('h2', '', 'One moment'));
        p.appendChild(el('p', '', 'Your teacher has reset the name on this iPad. Your last answers are being sent first.'));
        var S = window.ScienceSync;
        if (S && typeof S.sync === 'function') Promise.resolve().then(function () { return S.sync(); }).catch(function () {});
        return;
      }
    } else { writeJ(RESET_KEY, null); showWho(null); openGate('Your teacher has reset the name on this iPad. Sign in again.'); }
  }
  setInterval(function () { if (readJ(RESET_KEY) && readJ(ID_KEY) && !pendingCount()) resetHere(); }, 3000);

  /* ---------------- a newer copy on the site ---------------- */
  function reloadForNewer() {
    // Version 15: never while the class's lesson is live, never with answers waiting, never with typed drafts.
    if (presenting || presentEarly || overlay || pendingCount() || lessonLive || inLesson() || mode === 'live' || dockOn() || hasDraft(currentSlide())) return;
    var last = 0;
    try { last = Number(sessionStorage.getItem('liveboard.reloadAt')) || 0; } catch (e) { return; }
    if (Date.now() - last < 30 * 60000) return;   // the site may still serve the old copy for a few minutes
    try { sessionStorage.setItem('liveboard.reloadAt', String(Date.now())); } catch (e) { return; }
    location.reload();
  }

  /* ---------------- revision and not open ---------------- */
  var modeBar = null, closedBox = null;
  function drawMode() {
    if (presenting || presentEarly || !document.body) return;
    var me = readJ(ID_KEY), signed = !!(me && me.st);
    if (!modeBar) {
      modeBar = el('div', 'lbrev'); modeBar.setAttribute('role', 'status'); modeBar.hidden = true;
      modeBar.appendChild(el('b', '', 'Revision'));
      modeBar.appendChild(el('span', '', ' · Your answers here are kept as practice. They count in class.'));
      modeBar.addEventListener('click', function () { modeBar.classList.toggle('small'); });
      document.body.appendChild(modeBar);
    }
    var rev = signed && mode === 'revise';
    if (rev && modeBar.hidden) { modeBar.classList.remove('small'); setTimeout(function () { modeBar.classList.add('small'); }, 8000); }
    modeBar.hidden = !rev;
    var closed = signed && mode === 'closed';
    if (closed && !closedBox) {
      closedBox = el('div', 'lbx'); closedBox.setAttribute('role', 'dialog'); closedBox.setAttribute('aria-modal', 'true');
      var p = el('div', 'lbx-panel'); closedBox.appendChild(p);
      p.appendChild(el('h2', '', 'Not open yet'));
      p.appendChild(el('p', '', 'Your teacher has not opened this lesson for revision. It opens in class, or when your teacher opens it for your class.'));
      var a = el('a', 'lbx-ms', 'Back to learnwithmrcedric'); a.href = MS_URL; p.appendChild(a);
      document.body.appendChild(closedBox);
    } else if (!closed && closedBox) { closedBox.remove(); closedBox = null; }
  }

  /* ---------------- the checklist on the last slide ---------------- */
  // Numbered like the slides (the number at the top of the deck), and green for work saved from any iPad.
  var mineDone = {}, mineAsked = false;
  function askMine(me) {
    mineAsked = true;
    api({ api: 'mine', topicId: cfg.topicId, who: { cls: me.cls, name: me.name }, st: me.st || '' }).then(function (r) {
      if (r && r.ok && Array.isArray(r.done)) { r.done.forEach(function (id) { mineDone[id] = true; }); relabel(); }
    }).catch(function () { mineAsked = false; });
  }
  var grid = document.querySelector('.quick-grid'), relabelling = false;
  function relabel() {
    if (!grid || relabelling) return;
    relabelling = true;
    var cells = grid.querySelectorAll('.quick-cell[data-go]'), done = 0;
    Array.prototype.forEach.call(cells, function (c) {
      var id = c.getAttribute('data-go'), n = slideNo(id) || c.textContent.replace(/\D/g, '');
      var isDone = c.getAttribute('data-done') === 'true' || !!mineDone[id];
      if (isDone) done++;
      var want = n + (isDone ? ' ✓' : '');
      if (c.textContent !== want) c.textContent = want;
      if (isDone && c.getAttribute('data-done') !== 'true') c.setAttribute('data-done', 'true');
    });
    var count = document.querySelector('.quick-count');
    if (count && cells.length) { var t = done + ' / ' + cells.length + ' pages'; if (count.textContent !== t) count.textContent = t; }
    relabelling = false;
  }
  if (grid && window.MutationObserver) new MutationObserver(function () { if (!relabelling) relabel(); }).observe(grid, { childList: true, subtree: true, characterData: true });

  /* ---------------- bigger steps for sliders on a touch screen ---------------- */
  function addSteppers() {
    if (!window.matchMedia || !window.matchMedia('(pointer:coarse)').matches) return;
    Array.prototype.forEach.call(document.querySelectorAll('.slide input[type=range]:not([data-lbpm])'), function (r) {
      r.setAttribute('data-lbpm', '1');
      var box = el('span', 'lbpm');
      [['−', -1], ['+', 1]].forEach(function (x) {
        var b = el('button', '', x[0]); b.type = 'button'; b.setAttribute('aria-label', (x[1] < 0 ? 'Less ' : 'More ') + (r.getAttribute('aria-label') || ''));
        b.addEventListener('click', function (e) {
          e.preventDefault(); e.stopPropagation();
          if (r.disabled) return;
          if (x[1] < 0) r.stepDown(); else r.stepUp();
          r.dispatchEvent(new Event('input', { bubbles: true })); r.dispatchEvent(new Event('change', { bubbles: true }));
        });
        box.appendChild(b);
      });
      r.insertAdjacentElement('afterend', box);
    });
  }
  setInterval(addSteppers, 1500);

  /* ---------------- presenter mode ---------------- */
  /* The teacher's copy on the projector. After the teacher PIN it asks which class is being taught.
     Choosing one starts the lesson for that class in Live Board, as Start lesson does: the lesson shows
     on those students' learnwithmrcedric as the lesson in class now, and their iPads follow this slide. Opened
     from the Teacher Hub (#present&cls=...&part=...&tk=...), it is signed in and the class and part are
     known, so nothing is asked.
     Pause, Follow and who is where are on the teacher's phone, so the slides show only one small line,
     "Presenting to 1TG5", with Change class. Changing class ends the lesson for the class before. */
  var presenting = false, presPin = '', presCls = '', leadTimer = null, presInfo = null, pendingStart = null, authAsking = false;
  /* The sign-in or PIN stopped working (a sign-in from the Hub ran out, or the PIN was changed): ask for the PIN on
     this screen, then carry on (the lesson asked for by the Hub, or leading the class). */
  function presAuthLost() {
    if (authAsking) return;
    authAsking = true;
    try { sessionStorage.removeItem(PRES_KEY); } catch (e) {}
    presPin = '';
    askPinFor(function (pin) {
      presPin = pin; authAsking = false;
      try { sessionStorage.setItem(PRES_KEY, pin); } catch (e) {}
      closeOverlay();
      presInfo = null;
      if (pendingStart) presenterReady(); else if (presCls) sendLead(); else askClass();
    });
  }
  var PRES_NOW = 'liveboard.presenting:' + (cfg.topicId || '');
  function startPresenter() {
    presenting = true;
    whoLine.textContent = 'Presenter mode. Nothing is saved on this computer.';
    if (presentTk) { presPin = presentTk; presentTk = ''; try { sessionStorage.setItem(PRES_KEY, presPin); } catch (e) {} presenterReady(); return; }
    var saved = '';
    try { saved = sessionStorage.getItem(PRES_KEY) || ''; } catch (e) { saved = ''; }
    if (saved) { presPin = saved; presenterReady(); return; }
    askPinFor(function (pin) { presPin = pin; try { sessionStorage.setItem(PRES_KEY, pin); } catch (e) {} closeOverlay(); presenterReady(); });
  }
  function presenterReady() {
    document.body.classList.add('lb-presenter');
    var again = '';
    try { again = sessionStorage.getItem(PRES_NOW) || ''; } catch (e) { again = ''; }
    if (presentCls) { pendingStart = { cls: presentCls, part: presentPart, at: presentAt }; presentCls = ''; presentPart = ''; presentAt = 0; }
    if (pendingStart) {
      var ps = pendingStart;
      if (ps.part && ps.part !== 'all') loadPresentInfo().then(function () { startFor(ps.cls, Number(ps.part), true); }, function (er) { if (er && er.pin) { presAuthLost(); return; } startFor(ps.cls, null); });
      else startFor(ps.cls, null, ps.part === 'all');
      if (ps.at > 1) setTimeout(function () { var s0 = slideList()[ps.at - 1]; if (s0) goSlide(s0.id); }, 700);
    }
    else if (again === '-') showOnly();
    else if (again) beginLead(again);   // this tab chose already (the page was reloaded)
    else askClass();
  }
  /* The classes, the parts of this lesson (its modules) and which classes are in this lesson now. */
  function loadPresentInfo() {
    if (presInfo) return Promise.resolve(presInfo);
    return api({ api: 'present', pin: presPin, topicId: cfg.topicId }).then(function (r) {
      if (r && r.ok && Array.isArray(r.classes)) { presInfo = r; return r; }
      if (r && r.ok === false && /PIN|sign-in/i.test(r.error || '')) { var ep = new Error('PIN'); ep.pin = true; throw ep; }
      throw new Error('older Live Board');
    }).catch(function (err) {
      if (err && (err.kind || err.pin)) throw err;
      // A Live Board from before this: the class list only.
      return loadRoster().then(function () {
        presInfo = { classes: roster.map(function (c) { return c.cls; }), lessons: [], running: {} };
        return presInfo;
      });
    });
  }
  function askClass(err) {
    var p = panel();
    p.appendChild(el('h2', '', 'Which class are you teaching?'));
    p.appendChild(el('p', '', 'Their iPads follow your slides, and the lesson shows on their learnwithmrcedric.'));
    var top = el('div'), box = el('div', 'lbx-classes'), msg = el('p', 'lbx-msg');
    p.appendChild(top); p.appendChild(box);
    box.appendChild(el('p', 'lbx-wait', 'Loading the classes…'));
    p.appendChild(msg);
    var skip = el('button', 'lbx-skip', 'Just show the slides, without a class'); skip.type = 'button';
    skip.addEventListener('click', function () { endFor(presCls); try { sessionStorage.setItem(PRES_NOW, '-'); } catch (e) {} closeOverlay(); showOnly(); });
    p.appendChild(skip);
    if (presCls) {
      var keep = el('button', 'lbx-skip', 'Keep presenting to ' + presCls); keep.type = 'button';
      keep.addEventListener('click', closeOverlay);
      p.appendChild(keep);
    }
    if (err) failNote(msg, err, 'Starting the lesson');
    loadPresentInfo().then(function (info) {
      box.innerHTML = '';
      var part = null;
      if (info.lessons && info.lessons.length) {
        var lab = el('label', '', 'Part of the lesson');
        part = el('select');
        part.appendChild(new Option('The whole lesson', '-1'));
        var n = slideNow();
        info.lessons.forEach(function (l, i) {
          part.appendChild(new Option(l.t + ' (slides ' + l.from + '–' + l.to + ')', String(i)));
          if (n >= l.from && n <= l.to && n > 1) part.value = String(i);
        });
        lab.appendChild(part); top.appendChild(lab);
      }
      var last = readJ(PRES_CLS);
      info.classes.filter(function (c) { return c !== 'TEST'; }).forEach(function (c) {
        var b = el('button', 'lbx-class' + (c === last ? ' last' : ''));
        b.type = 'button';
        b.appendChild(el('b', '', c));
        if (info.running && info.running[c]) b.appendChild(el('span', '', 'In this lesson now'));
        b.addEventListener('click', function () {
          Array.prototype.forEach.call(box.querySelectorAll('button'), function (x) { x.disabled = true; });
          var li = part && part.value !== '-1' ? Number(part.value) : null;
          if (presCls && presCls !== c) endFor(presCls);
          startFor(c, li);
        });
        box.appendChild(b);
      });
      if (!box.childNodes.length) box.appendChild(el('p', '', 'There are no classes on the class list yet.'));
    }).catch(function (e2) { if (e2 && e2.pin) { presAuthLost(); return; } box.innerHTML = ''; failNote(msg, e2, 'Choosing the class'); });
  }
  /* Starts the lesson for one class, or carries on with it if it is already running. */
  function startFor(cls, li, chosen) {
    var l = li != null && presInfo && presInfo.lessons ? presInfo.lessons[li] : null;
    // chosen: the part was picked in the Hub, so a different part already running for the class is replaced.
    api({ api: 'start', pin: presPin, topicId: cfg.topicId, cls: cls, from: l ? l.from : 0, to: l ? l.to : 0, title: l ? l.t : 'The whole lesson', force: !!chosen })
      .then(function (r) {
        if (r && r.ok) return r;
        if (r && /PIN|sign-in/i.test(r.error || '')) { var e = new Error('PIN'); e.pin = true; throw e; }
        // A Live Board from before this: at least make the iPads follow.
        return api({ api: 'control', pin: presPin, topicId: cfg.topicId, cls: cls, set: { follow: true, hold: true, pause: false } });
      })
      .then(function () { closeOverlay(); beginLead(cls); })
      .catch(function (err) {
        if (err && err.pin) { presAuthLost(); return; }
        askClass(err);
      });
  }
  /* Ends the lesson for a class this tab was presenting to (when changing class). */
  function endFor(cls) {
    if (!cls || !presPin) return;
    api({ api: 'end', pin: presPin, topicId: cfg.topicId, cls: cls }).catch(function () {});
  }
  function beginLead(cls) {
    presCls = cls; writeJ(PRES_CLS, cls);
    try { sessionStorage.setItem(PRES_NOW, cls); } catch (e) {}
    pendingStart = null;
    drawPresLine();
    sendLead();
    clearInterval(leadTimer); leadTimer = setInterval(sendLead, presentPj ? 5000 : 12000);
    resultsButton(true);
    presLesson = null; presQuick = null; presActive = null; phoneLive = false; pgoSig = '';
    drawStrip();
  }
  function showOnly() { presCls = ''; clearInterval(leadTimer); drawPresLine(); resultsButton(false); clearTimeout(pgoTimer); phoneLive = false; drawStrip(); }
  /* Show answers: how the class answered the question on the slide being shown, full size for the projector. No
     names. The whole question, then the choices as bars, or the class's written answers as a wall of cards. The right
     answer shows only when the teacher asks for it. It follows the slide, and asks again every 3 seconds. */
  // The button sits in the deck's own bar at the bottom, beside Previous (or Back), looking like the deck's buttons. It is
  // there all the time you present, and greyed out on a slide with no question. A deck with no Previous or Back on screen
  // gets a button of its own at the bottom of the slide instead.
  var resBtn = null, resBox = null, resTimer = null, resPlace = null, resNav = null, resDressed = false;
  function tasksOn(n) { return n ? list.filter(function (t) { return slideOf(t).n === n; }) : []; }
  var RES_TIP = 'The class\'s answers to the question on this slide, full size. No names.';
  function resultsButton(on) {
    clearInterval(resPlace);
    if (!on) { if (resBtn) { resBtn.remove(); resBtn = null; } resNav = null; closeResults(); return; }
    if (!resBtn) {
      resBtn = el('button', '', 'Show answers'); resBtn.type = 'button'; resBtn.title = RES_TIP;
      resBtn.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); if (!resBtn.disabled) openResults(); });
    }
    placeResults(); resPlace = setInterval(placeResults, 800);
  }
  // The deck's Previous (or Back) button in its bar at the bottom of the screen.
  function navPrev() {
    var H = window.innerHeight, b = document.getElementById('prevBtn');
    var ok = function (x) { if (!x || x === resBtn) return false; var r = x.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.top > H * 0.6; };
    if (ok(b)) return b;
    var xs = document.querySelectorAll('footer > button, nav > button, footer > a, nav > a');
    for (var i = 0; i < xs.length; i++) {
      if (/^\W*\s*(previous|prev|back)\s*\W*$/i.test(String(xs[i].textContent || '').trim()) && ok(xs[i])) return xs[i];
    }
    return null;
  }
  var NAV_LOOK = ['font-family', 'font-size', 'font-weight', 'font-style', 'letter-spacing', 'text-transform', 'line-height', 'color', 'background-color',
    'background-image', 'border-top', 'border-right', 'border-bottom', 'border-left', 'border-radius', 'padding-top', 'padding-right', 'padding-bottom',
    'padding-left', 'min-height', 'height', 'box-shadow', 'transform', 'cursor'];
  function dressLike(btn, src) {
    var cs = getComputedStyle(src), par = getComputedStyle(src.parentElement);
    NAV_LOOK.forEach(function (k) { btn.style.setProperty(k, cs.getPropertyValue(k)); });
    btn.style.setProperty('margin-left', (parseFloat(par.columnGap) || 0) > 0 ? '0' : '10px');
    btn.style.setProperty('margin-right', '0');
  }
  function placeResults() {
    if (!resBtn) return;
    var has = tasksOn(slideNow()).length > 0, prev = navPrev();
    if (prev) {
      if (resNav !== prev || resBtn.previousElementSibling !== prev || !resBtn.isConnected) {
        resBtn.className = 'lbb-nav'; resBtn.removeAttribute('style'); resBtn.hidden = false;
        prev.insertAdjacentElement('afterend', resBtn); resNav = prev; resDressed = false;
      }
      // dressed like Previous, and again once Previous is not greyed out itself (on the first slide it may be)
      if (!resDressed) { dressLike(resBtn, prev); resDressed = !prev.disabled; }
      resBtn.disabled = !has;
      resBtn.title = has ? RES_TIP : 'No question on this slide';
      return;
    }
    if (resNav || resBtn.className !== 'lbres-btn lbb-go' || !resBtn.isConnected) {
      resBtn.className = 'lbres-btn lbb-go'; resBtn.removeAttribute('style'); resBtn.disabled = false; resBtn.title = RES_TIP;
      resNav = null; document.body.appendChild(resBtn);
    }
    resBtn.hidden = !!resBox || !has;
    if (resBtn.hidden) return;
    // Just above the deck's own bar at the bottom of the screen, when it has one.
    var lift = 16, H = window.innerHeight, barTop = 0;
    try {
      resBtn.style.visibility = 'hidden';
      var e = document.elementFromPoint(window.innerWidth / 2, H - 3);
      resBtn.style.visibility = '';
      for (; e && e !== document.body && e !== document.documentElement; e = e.parentElement) {
        var r = e.getBoundingClientRect();
        if (r.bottom >= H - 2 && r.height > 0 && r.height < H * 0.25) barTop = r.top; else if (barTop) break;
      }
    } catch (err) { resBtn.style.visibility = ''; }
    if (barTop) lift = Math.round(H - barTop + 12);
    resBtn.style.bottom = lift + 'px';
  }
  function closeResults() { clearTimeout(resTimer); resTimer = null; if (resBox) { resBox.remove(); resBox = null; } placeResults(); }
  var LETTERS = 'ABCDEFGHIJ';
  function openResults() {
    closeResults();
    var showRight = false, last = null, pick = 0, seenTexts = {};
    resBox = el('div', 'lbres lbb'); resBox.setAttribute('role', 'dialog'); resBox.setAttribute('aria-modal', 'true'); resBox.setAttribute('aria-label', 'The class\'s answers');
    var p = el('div', 'lbres-panel'), top = el('div', 'lbres-top');
    var tabs = el('div', 'lbb-tabs'); top.appendChild(tabs);
    var sub = el('span', 'lbres-sub', presCls); top.appendChild(sub);
    var right = el('button', 'lbres-right', 'Show the right answer'); right.type = 'button'; right.hidden = true;
    right.addEventListener('click', function () { showRight = !showRight; right.textContent = showRight ? 'Hide the right answer' : 'Show the right answer'; draw(last); });
    var x = el('button', 'lbres-x', 'Close'); x.type = 'button'; x.addEventListener('click', closeResults);
    top.appendChild(right); top.appendChild(x); p.appendChild(top);
    var qline = el('div', 'lbb-q'), nline = el('p', 'lbb-n'), body = el('div', 'lbb-body');
    body.appendChild(el('p', 'lbres-wait', 'Loading…'));
    p.appendChild(qline); p.appendChild(nline); p.appendChild(body);
    resBox.appendChild(p); document.body.appendChild(resBox);
    resBox.addEventListener('click', function (e) { if (e.target === resBox) closeResults(); });
    placeResults();
    function local(q) { return byId[q.taskId] || null; }
    function draw(r) {
      if (!r || !resBox) return;
      // The questions on the slide from Live Board, and any it has no answers for yet from the slide itself, so the
      // question shows on the board before anyone has answered.
      var qs = (r.questions || []).slice(), seen = {};
      qs.forEach(function (q) { seen[q.taskId] = 1; });
      tasksOn(r.n || slideNow()).forEach(function (t) {
        if (seen[t.id]) return;
        qs.push({ taskId: t.id, title: t.question, kind: t.kind, answered: 0, size: 0, pct: null,
          choices: t.kind === 'choice' ? (t.options || []).map(function (o) { return { t: String(o), n: 0, ok: t.correct !== '' && String(o) === String(t.correct) }; }) : null,
          texts: t.kind === 'choice' ? null : [] });
      });
      sub.textContent = (r.n ? 'Slide ' + r.n + ' · ' : '') + presCls;
      tabs.innerHTML = '';
      if (!qs.length) { qline.textContent = ''; nline.textContent = ''; right.hidden = true; body.innerHTML = ''; body.appendChild(el('p', 'lbb-empty', 'No question on this slide. Show answers follows the slide you are showing.')); return; }
      if (pick >= qs.length) pick = 0;
      if (qs.length > 1) qs.forEach(function (q, k) {
        var b = el('button', k === pick ? 'on' : '', 'Question ' + (k + 1)); b.type = 'button';
        b.addEventListener('click', function () { pick = k; draw(last); });
        tabs.appendChild(b);
      });
      var q = qs[pick], t = local(q) || {};
      var hasRight = q.pct != null || (!q.choices && !!(t.model || t.correct)) || (q.choices && q.choices.some(function (o) { return o.ok; }));
      right.hidden = !hasRight;
      qline.textContent = t.question || q.title || '';
      nline.innerHTML = '';
      nline.appendChild(el('b', '', String(q.answered))); nline.appendChild(document.createTextNode((q.size ? ' of ' + q.size : '') + ' answered' + (q.choices && q.answered ? ' · first tries' : '')));
      body.innerHTML = '';
      if (q.choices && q.choices.length) {
        var total = 0; q.choices.forEach(function (o) { total += o.n; });
        var most = 1; q.choices.forEach(function (o) { if (o.n > most) most = o.n; });
        var bars = el('div', 'lbb-bars');
        q.choices.forEach(function (o, k) {
          var row = el('div', 'lbb-bar' + (showRight && o.ok ? ' ok' : ''));
          row.appendChild(el('span', 'k', LETTERS.charAt(k) || String(k + 1)));
          var w = el('div', 'w'); w.appendChild(el('span', 'l', o.t));
          var rr = el('div', 'r'), tr = el('span', 't'), fill = el('i'); fill.style.width = Math.round(100 * o.n / most) + '%'; tr.appendChild(fill);
          var cnt = el('b', '', String(o.n)); cnt.appendChild(el('small', '', '  ' + (total ? Math.round(100 * o.n / total) : 0) + '%'));
          rr.appendChild(tr); rr.appendChild(cnt); w.appendChild(rr); row.appendChild(w);
          bars.appendChild(row);
        });
        body.appendChild(bars);
        return;
      }
      if (showRight && (q.pct != null || t.correct)) body.appendChild(el('p', 'lbb-pct', (q.pct != null ? q.pct + '% right on the first try' + (t.correct ? ' · ' : '') : '') + (t.correct ? 'the answer: ' + t.correct + (t.unit ? ' ' + t.unit : '') : '')));
      if (showRight && !q.choices && t.model) body.appendChild(el('p', 'lbb-pct', 'A good answer: ' + t.model));
      if (q.texts === undefined) { body.appendChild(el('p', 'lbb-empty', 'Written answers show here once Live Board has its newest server code (release 20). Its Setup check says what to paste.')); return; }
      var texts = q.texts || [];
      if (!texts.length) { body.appendChild(el('p', 'lbb-empty', q.answered ? 'The answers show here as they come in.' : 'No answers yet. They show here as the class answers.')); return; }
      var wall = el('div', 'lbb-wall');
      texts.forEach(function (a, k) {
        var key = q.taskId + '|' + k + '|' + a.x;
        var c = el('div', 'lbb-card c' + (k % 6) + (showRight && a.ok === true ? ' ok' : '') + (showRight && a.ok === false ? ' no' : ''), a.x + (q.kind === 'number' && t.unit && !/[a-z]$/i.test(a.x) ? ' ' + t.unit : ''));
        if (seenTexts[key]) c.style.animation = 'none';
        seenTexts[key] = 1;
        wall.appendChild(c);
      });
      body.appendChild(wall);
    }
    // One question to Live Board at a time: the next goes 3 seconds after the answer, so a slow answer about the slide
    // before never comes in after a newer one. A board that was closed (or opened again) drops what comes back.
    var mine = resBox;
    function again() { if (resBox === mine) resTimer = setTimeout(poll, 3000); }
    function poll() {
      if (resBox !== mine) return;
      api({ api: 'results', pin: presPin, topicId: cfg.topicId, cls: presCls, n: slideNow(), texts: 1 }).then(function (r) {
        if (resBox !== mine) return;
        if (!r || r.ok === false) { body.innerHTML = ''; body.appendChild(el('p', 'lbb-empty', r && r.error && !/Unknown request/.test(r.error) ? r.error : 'Show answers needs the new version of Live Board: update its deployment (Deploy > Manage deployments > New version).')); again(); return; }
        if (last && last.n !== r.n) { pick = 0; seenTexts = {}; }
        last = r; draw(r); again();
      }).catch(function (err) { if (resBox !== mine) return; if (!last) { body.innerHTML = ''; var m = el('p', 'lbb-empty'); failNote(m, err, 'Show answers'); body.appendChild(m); } again(); });
    }
    poll();
  }
  document.addEventListener('keydown', function (e) { if (resBox && e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeResults(); } }, true);
  function drawPresLine() {
    whoLine.innerHTML = '';
    if (presCls) { whoLine.appendChild(document.createTextNode('Presenting to ')); whoLine.appendChild(el('b', '', presCls)); }
    else whoLine.appendChild(document.createTextNode('Showing the slides, no class.'));
    var ch = el('button', '', presCls ? 'Change class' : 'Choose a class'); ch.type = 'button';
    ch.addEventListener('click', function (e) { if (e) e.preventDefault(); askClass(); });
    whoLine.appendChild(ch);
    if (typeof placeResults === 'function') placeResults();
  }
  /* Flicking through slides sends one call at a time, then the slide it ended on, so Live Board never keeps an
     earlier slide that happened to arrive last. */
  var leadBusy = 0, leadAgain = false;
  function sendLead() {
    if (!presenting || !presPin || !presCls) return;
    if (leadBusy && Date.now() - leadBusy < 15000) { leadAgain = true; return; }   // one at a time (a call stuck for 15 s is given up)
    var sl = currentSlide();
    if (!sl) return;
    leadBusy = Date.now(); leadAgain = false;
    // Version 15: the step inside the slide and the slide's kind go too (Together moves the step, and the kind
    // sets the lesson's default mode).
    var body = { api: 'lead', pin: presPin, topicId: cfg.topicId, cls: presCls, slide: sl.id, n: slideList().indexOf(sl) + 1,
      step: getStep(sl), steps: stepCount(sl), kind: sl.getAttribute('data-kind') || '', total: slideCount(), title: slideTitle(sl) };
    curStep = body.step;
    if (presentPj) body.pj = presentPj;
    var mine = leadBusy;
    var done = function () { if (leadBusy !== mine) return; leadBusy = 0; if (leadAgain) sendLead(); };
    api(body).then(function (r) {
      if (r && r.ok === false && /PIN|sign-in|paired/i.test(r.error || '')) presAuthLost();
      if (r && r.go && presentPj && typeof r.go === 'string') goNext(r.go);
      if (r && r.ok !== false) {
        takeLesson(r);
        // No word about a phone from this Live Board: ask the phone channel itself now and then.
        if (r.phone === undefined && !phoneLive && Date.now() - lastProbe > 12000) { lastProbe = Date.now(); phoneLive = true; pgoLoop(); }
      }
      done();
    }, done);
  }
  /* The projector screen's next step: another lesson's slides, or the waiting screen. */
  var going = false;
  function goNext(url) {
    if (going || !/^https:\/\//.test(String(url))) return;
    going = true;
    clearInterval(leadTimer);
    try { sessionStorage.removeItem('liveboard.pj'); } catch (e) { /* none kept */ }
    var a = document.createElement('a'); a.href = url;
    var samePage = a.origin === location.origin && a.pathname === location.pathname && a.search === location.search;
    location.href = url;
    if (samePage) location.reload();   // only the address after # changed: load the page again for the new part
  }

  /* ---------------- presenter strip (version 15) ----------------
     A status pill ("34 of 38 in · Together") and a menu, on the teacher's projector copy only. Every command goes to
     Live Board's t_do through the deck channel ({api:'tdo'}), idempotent by its cmdId, so a repeated tap or a resend
     does nothing twice. Nothing in the strip ever shows a student's name. */
  var strip = null, stripMenu = null, stripMsg = null, stripMsgTimer = null, presLesson = null, presQuick = null, presMode = '', presActive = null;
  var blankBox = null, endBar = null, endTimer = null, showBox = null, showKey = '';
  var phoneLive = false, pgoBusy = false, pgoSig = '', pgoShortUntil = 0, pgoTimer = null, lastGoCmd = '', lastProbe = 0;
  var MODE_WORD = { together: 'Together', own: 'Own pace', eyes: 'Eyes on me' };
  function cmdId() { return 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
  function takeLesson(r) {
    if (!r) return;
    if (r.lesson && typeof r.lesson === 'object') { presLesson = r.lesson; if (r.lesson.mode) presMode = r.lesson.mode; }
    else if (r.lesson === null) presLesson = null;
    if (r.ctl && !(r.lesson && r.lesson.mode)) presMode = r.ctl.pause ? 'eyes' : r.ctl.follow ? 'together' : 'own';
    if (typeof r.active === 'number') presActive = r.active;
    if (r.quick !== undefined) presQuick = r.quick;
    if (r.show !== undefined) renderShow(r.show);
    if (r.phone === true && !phoneLive) { phoneLive = true; pgoLoop(); }
    if (r.phone === false) phoneLive = false;
    drawStrip();
  }
  function pillText() {
    var mw = MODE_WORD[presMode] || '';
    var n = presLesson && presLesson.inCount != null ? presLesson.inCount + ' of ' + (presLesson.of != null ? presLesson.of : '?') + ' in'
      : presActive != null ? presActive + ' in' : presCls;
    return n + (mw ? ' · ' + mw : '');
  }
  function drawStrip() {
    if (!presenting || !presCls) { if (strip) { strip.remove(); strip = null; } closeStripMenu(); return; }
    if (!strip) {
      strip = el('div', 'lbstrip');
      strip.setAttribute('role', 'toolbar');
      strip.setAttribute('aria-label', 'Lesson controls');
      var pill = el('span', 'lbstrip-pill'); strip.appendChild(pill);
      var more = el('button', 'lbstrip-more', '⋯'); more.type = 'button'; more.setAttribute('aria-label', 'Lesson controls'); more.title = 'Lesson controls';
      more.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); if (stripMenu) closeStripMenu(); else openStripMenu(); });
      strip.appendChild(more);
      stripMsg = el('span', 'lbstrip-msg'); stripMsg.hidden = true; strip.appendChild(stripMsg);
      document.body.appendChild(strip);
    }
    var p = strip.querySelector('.lbstrip-pill'), t = pillText();
    if (p.textContent !== t) p.textContent = t;
    strip.classList.toggle('eyes', presMode === 'eyes');
    if (stripMenu) openStripMenu();
  }
  function stripNote(text, keep) {
    if (!stripMsg) return;
    stripMsg.textContent = text; stripMsg.hidden = !text;
    clearTimeout(stripMsgTimer);
    if (text && !keep) stripMsgTimer = setTimeout(function () { if (stripMsg) stripMsg.hidden = true; }, 2600);
  }
  function closeStripMenu() { if (stripMenu) { stripMenu.remove(); stripMenu = null; } }
  function openStripMenu() {
    closeStripMenu();
    stripMenu = el('div', 'lbstrip-menu');
    stripMenu.setAttribute('role', 'menu');
    var add = function (text, key, go, cls) {
      var b = el('button', cls || '', ''); b.type = 'button'; b.setAttribute('role', 'menuitem');
      b.appendChild(el('span', '', text)); if (key) b.appendChild(el('kbd', '', key));
      b.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); closeStripMenu(); go(); });
      stripMenu.appendChild(b);
      return b;
    };
    var q = presQuick;
    if (q && q.open) {
      stripMenu.appendChild(el('p', 'lbstrip-h', 'A quick check is open.'));
      var opts = quickOptions(q);
      if (opts.length && q.type !== 'gotit') {
        var row = el('div', 'lbstrip-mark');
        row.appendChild(el('span', '', 'Mark the right answer'));
        opts.forEach(function (o, i) {
          var b = el('button', '', q.type === 'slide' ? LETTERS.charAt(i) : o); b.type = 'button'; b.title = o;
          b.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); closeStripMenu(); tdo('mark', { correct: o }); });
          row.appendChild(b);
        });
        stripMenu.appendChild(row);
      }
      add('Close the check', '', function () { tdo('close', {}); });
    } else {
      add('Quick check', 'Q', openPicker);
      if (q && !q.open) {
        add(presShowOn() ? 'Take the results off the screen' : 'Show the results on the screen', '', function () { tdo('show', { on: !presShowOn() }); });
        add('Ask again', '', function () { tdo('again', {}); });
      }
    }
    add(presMode === 'eyes' ? 'Release the iPads' : 'Eyes on me', 'B', toggleEyes);
    add(presMode === 'together' ? 'Switch to Own pace' : 'Switch to Together', 'T', toggleMode);
    add(resBox ? 'Hide the answers' : 'Show answers', 'A', function () { if (resBox) closeResults(); else openResults(); });
    add('End the lesson', 'E', endWithUndo, 'end');
    strip.appendChild(stripMenu);
  }
  function presShowOn() { return !!showBox; }
  function tdo(op, args) {
    if (!presPin || !presCls) return Promise.resolve(null);
    stripNote('Sending', true);
    return api({ api: 'tdo', pin: presPin, topicId: cfg.topicId, cls: presCls, op: op, args: args || {}, cmdId: cmdId() }).then(function (r) {
      if (r && r.ok === false && /PIN|sign-in/i.test(r.error || '')) { stripNote(''); presAuthLost(); return null; }
      if (!r || r.ok === false) {
        stripNote(r && r.error && !/Unknown request/.test(r.error) ? r.error : 'Live Board did not take that. It needs the release 34 server code.');
        return null;
      }
      stripNote('Done');
      takeLesson(r);
      return r;
    }, function () { stripNote('Not sent. Check the connection, then try again.'); return null; });
  }
  function toggleEyes() {
    var on = presMode !== 'eyes';
    blankScreen(on);
    presMode = on ? 'eyes' : (presMode === 'eyes' ? '' : presMode);
    drawStrip();
    tdo('mode', { v: on ? 'eyes' : 'release' });
  }
  function toggleMode() { tdo('mode', { v: presMode === 'together' ? 'own' : 'together' }); }
  function blankScreen(on) {
    if (on && !blankBox) {
      blankBox = el('div', 'lbblank');
      blankBox.setAttribute('role', 'presentation');
      blankBox.appendChild(el('span', '', 'Eyes on me. Press B to show the slides again.'));
      document.body.appendChild(blankBox);
    } else if (!on && blankBox) { blankBox.remove(); blankBox = null; }
  }
  /* The quick check picker: the kind of check only, never a name. Question on this slide uses the slide's question. */
  function slideTask() {
    var sl = currentSlide();
    if (!sl) return '';
    var c = sl.getAttribute('data-cur-task') || '';
    if (!c) { var h = sl.querySelector('[data-cur-task]'); c = h ? h.getAttribute('data-cur-task') : ''; }
    if (c && byId[c]) return c;
    var ts = tasksOn(slideNow());
    return ts.length ? ts[0].id : '';
  }
  function openPicker() {
    if (!presCls) return;
    var p = panel();
    overlay.setAttribute('data-lbx', 'picker');
    p.appendChild(el('h2', '', 'Quick check'));
    p.appendChild(el('p', '', 'The check opens on every iPad in the class, over the lower part of the slides.'));
    var box = el('div', 'lbx-classes lbpick');
    var task = slideTask();
    [['abcd', 'A B C D'], ['tf', 'True or false'], ['gotit', 'Got it, Nearly, Lost'], ['word', 'Type a word'], ['slide', 'Question on this slide']].forEach(function (x) {
      var b = el('button', 'lbx-class'); b.type = 'button'; b.setAttribute('data-type', x[0]);
      b.appendChild(el('b', '', x[1]));
      if (x[0] === 'slide') { b.disabled = !task; if (task) b.appendChild(el('span', '', String(byId[task].question || '').slice(0, 60))); }
      b.addEventListener('click', function () { closeOverlay(); tdo('quick', x[0] === 'slide' ? { type: 'slide', taskId: task } : { type: x[0] }); });
      box.appendChild(b);
    });
    p.appendChild(box);
    var row = el('div', 'lbx-row'), cancel = el('button', '', 'Cancel'); cancel.type = 'button'; cancel.addEventListener('click', closeOverlay); row.appendChild(cancel); p.appendChild(row);
  }
  /* End: one tap, then 4 seconds to undo. Live Board ends the lesson itself when the 4 seconds are up. */
  function endWithUndo() {
    if (endBar || !presCls) return;
    var cls = presCls;
    endBar = el('div', 'lbend');
    endBar.setAttribute('role', 'alert');
    var tx = el('span', '', 'Ending the lesson for ' + cls + '.');
    var u = el('button', '', 'Undo'); u.type = 'button';
    u.addEventListener('click', function (e) { e.preventDefault(); undoEnd(); });
    endBar.appendChild(tx); endBar.appendChild(u);
    document.body.appendChild(endBar);
    var until = Date.now() + 4000;
    tdo('end', {}).then(function (r) { if (r && r.undoUntil) until = Number(r.undoUntil) || until; });
    clearInterval(endTimer);
    endTimer = setInterval(function () {
      var left = Math.ceil((until - Date.now()) / 1000);
      if (left > 0) { tx.textContent = 'Ending the lesson for ' + cls + ' in ' + left + ' s.'; return; }
      clearInterval(endTimer); endTimer = null;
      if (endBar) { endBar.remove(); endBar = null; }
      // One more call after the Undo time, so Live Board finishes the End now (even if the laptop is closed next).
      try { api({ api: 'tdo', pin: presPin, topicId: cfg.topicId, cls: cls, op: 'state', args: {}, cmdId: cmdId() }).then(null, function () {}); } catch (e) {}
      lessonEnded();
    }, 250);
  }
  function undoEnd() {
    if (!endBar) return;
    clearInterval(endTimer); endTimer = null;
    endBar.remove(); endBar = null;
    tdo('undo', {});
  }
  function lessonEnded() {
    try { sessionStorage.setItem(PRES_NOW, '-'); } catch (e) {}
    blankScreen(false); renderShow(null);
    presLesson = null; presQuick = null; presMode = ''; phoneLive = false;
    showOnly();
    whoLine.textContent = 'The lesson has ended. ';
    var ch = el('button', '', 'Choose a class'); ch.type = 'button';
    ch.addEventListener('click', function (e) { if (e) e.preventDefault(); askClass(); });
    whoLine.appendChild(ch);
  }
  /* Show on screen: the bars or the grouped words for the whole class, never names. */
  function renderShow(sh) {
    var key = sh ? JSON.stringify(sh) : '';
    if (key === showKey) return;
    showKey = key;
    if (!sh) { if (showBox) { showBox.remove(); showBox = null; } return; }
    if (!showBox) {
      showBox = el('div', 'lbres lbb lbshow'); showBox.setAttribute('role', 'dialog'); showBox.setAttribute('aria-label', 'The class\'s answers');
      document.body.appendChild(showBox);
    }
    showBox.innerHTML = '';
    var p = el('div', 'lbres-panel'), top = el('div', 'lbres-top');
    top.appendChild(el('h2', '', 'Quick check'));
    var tot = Number(sh.total) || 0;
    if (sh.kind === 'bars') top.appendChild(el('span', 'lbres-sub', tot + (tot === 1 ? ' answer' : ' answers')));
    var x = el('button', 'lbres-x', 'Close'); x.type = 'button';
    x.addEventListener('click', function () { tdo('show', { on: false }); renderShow(null); });
    top.appendChild(x);
    p.appendChild(top);
    var body = el('div', 'lbb-body');
    if (sh.kind === 'bars') {
      var counts = sh.counts || {}, opts = Array.isArray(sh.options) && sh.options.length ? sh.options.map(String) : Object.keys(counts);
      var most = 1; opts.forEach(function (o) { most = Math.max(most, Number(counts[o]) || 0); });
      var total = tot || opts.reduce(function (n, o) { return n + (Number(counts[o]) || 0); }, 0);
      var bars = el('div', 'lbb-bars');
      opts.forEach(function (o, k) {
        var n = Number(counts[o]) || 0;
        var row = el('div', 'lbb-bar' + (sh.correct != null && String(sh.correct) === o ? ' ok' : ''));
        row.appendChild(el('span', 'k', /^[A-D]$/.test(o) ? o : LETTERS.charAt(k)));
        var w = el('div', 'w'); w.appendChild(el('span', 'l', o));
        var rr = el('div', 'r'), tr = el('span', 't'), fill = el('i'); fill.style.width = Math.round(100 * n / most) + '%'; tr.appendChild(fill);
        var cnt = el('b', '', String(n)); cnt.appendChild(el('small', '', '  ' + (total ? Math.round(100 * n / total) : 0) + '%'));
        rr.appendChild(tr); rr.appendChild(cnt); w.appendChild(rr); row.appendChild(w);
        bars.appendChild(row);
      });
      body.appendChild(bars);
    } else if (sh.kind === 'words') {
      var words = Array.isArray(sh.words) ? sh.words : [], top1 = 1;
      words.forEach(function (w) { top1 = Math.max(top1, Number(w.n) || 1); });
      var wall = el('div', 'lbshow-words');
      if (!words.length) wall.appendChild(el('p', 'lbb-empty', 'No words yet.'));
      words.forEach(function (w, k) {
        var c = el('span', 'lbshow-word c' + (k % 6), String(w.text || ''));
        c.style.fontSize = Math.round(22 + 34 * ((Number(w.n) || 1) / top1)) + 'px';
        if ((Number(w.n) || 1) > 1) c.appendChild(el('small', '', ' ' + w.n));
        wall.appendChild(c);
      });
      body.appendChild(wall);
    }
    p.appendChild(body);
    showBox.appendChild(p);
  }
  /* While a paired phone is live, its commands (Back, Next, a named slide and step) reach the projector at once. */
  function pgoLoop() {
    clearTimeout(pgoTimer);
    if (!presenting || !presCls || !presPin || pgoBusy || !phoneLive || document.hidden) return;
    var short = Date.now() < pgoShortUntil, mine = presCls;
    pgoBusy = true;
    api({ api: 'pgo', pin: presPin, topicId: cfg.topicId, cls: presCls, sig: pgoSig, maxMs: short ? 0 : 20000 }).then(function (r) {
      pgoBusy = false;
      if (mine !== presCls) return;
      if (!r || r.ok === false) {
        if (r && /PIN|sign-in/i.test(r.error || '')) { presAuthLost(); return; }
        phoneLive = false; return;   // an older Live Board: the 12 second lead carries on alone
      }
      if (r.sig != null) pgoSig = r.sig;
      if (r.poll) { pgoShortUntil = Date.now() + 120000; pgoTimer = setTimeout(pgoLoop, Number(r.poll) * (0.85 + Math.random() * 0.3)); return; }
      if (r.go) applyGo(r.go);
      if (r.show !== undefined) renderShow(r.show);
      if (r.lesson !== undefined || r.quick !== undefined) takeLesson(r);
      if (r.phone === false) { phoneLive = false; return; }
      pgoTimer = setTimeout(pgoLoop, short ? 3000 * (0.85 + Math.random() * 0.3) : 30);
    }, function () {
      pgoBusy = false;
      // Too many calls at once, or a dropped connection: short polls every 3 seconds for 2 minutes.
      pgoShortUntil = Date.now() + 120000;
      pgoTimer = setTimeout(pgoLoop, 3000 * (0.85 + Math.random() * 0.3));
    });
  }
  document.addEventListener('visibilitychange', function () { if (!document.hidden && presenting && phoneLive) pgoLoop(); });
  function applyGo(g) {
    if (!g) return;
    if (g.cmd && g.cmd === lastGoCmd) return;
    lastGoCmd = g.cmd || '';
    var all = slideList(), target = null;
    if (typeof g.slide === 'number' || /^\d+$/.test(String(g.slide))) target = all[Number(g.slide) - 1] || null;
    else if (g.slide) target = document.getElementById(String(g.slide));
    if (!target) target = currentSlide();
    if (!target) return;
    if (target !== currentSlide()) {
      goSlide(target.id);
      if (g.step != null) setTimeout(function () { setStep(target, g.step); seeSlide(); }, 350);
    } else if (g.step != null) { setStep(target, g.step); }
    setTimeout(seeSlide, 60);
  }
  /* The deck's own Back and Next, for the clicker keys a deck does not handle itself. */
  function navBtn(dir) {
    var ids = dir > 0 ? ['nextBtn', 'next'] : ['prevBtn', 'prev'];
    for (var i = 0; i < ids.length; i++) { var b = document.getElementById(ids[i]); if (b && b.offsetParent !== null && !b.disabled) return b; }
    var c = document.querySelector(dir > 0 ? '.footer .next, footer .next' : '.footer .prev, footer .prev');
    if (c && c.offsetParent !== null) return c;
    var xs = document.querySelectorAll('footer button, nav button, .footer button');
    var re = dir > 0 ? /^\W*\s*(next)\b/i : /^\W*\s*(previous|prev|back)\b/i;
    for (var k = 0; k < xs.length; k++) if (re.test(String(xs[k].textContent || '').trim()) && xs[k].offsetParent !== null) return xs[k];
    return null;
  }
  function typing(t) { return !!(t && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable)); }
  // The presenter's keys (the teacher's laptop or clicker). Letters work only while presenting to a class.
  document.addEventListener('keydown', function (e) {
    if (!presenting || e.ctrlKey || e.metaKey || e.altKey || typing(e.target)) return;
    if (endBar && (e.key === 'u' || e.key === 'U' || e.key === 'Escape')) { e.preventDefault(); e.stopPropagation(); undoEnd(); return; }
    if (overlay || !presCls) return;
    var k = e.key, hit = true;
    if (k === 'b' || k === 'B' || k === '.') toggleEyes();
    else if (k === 'a' || k === 'A') { if (resBox) closeResults(); else openResults(); }
    else if (k === 'q' || k === 'Q') openPicker();
    else if (k === 't' || k === 'T') toggleMode();
    else if (k === 'e' || k === 'E') endWithUndo();
    else if (k === 'Escape' && stripMenu) closeStripMenu();
    else hit = false;
    if (hit) { e.preventDefault(); e.stopPropagation(); }
  }, true);
  // Arrows and PgUp/PgDn move the slides: the deck's own handler first, the bridge's when the deck has none.
  window.addEventListener('keydown', function (e) {
    if (!presenting || e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || typing(e.target) || overlay) return;
    var dir = e.key === 'PageDown' || e.key === 'ArrowRight' ? 1 : e.key === 'PageUp' || e.key === 'ArrowLeft' ? -1 : 0;
    if (!dir) return;
    var b = navBtn(dir);
    if (b) { e.preventDefault(); b.click(); setTimeout(seeSlide, 80); }
  });
  document.addEventListener('click', function (e) { if (stripMenu && strip && !strip.contains(e.target)) closeStripMenu(); }, true);

  /* ---------------- revise: My mistakes and Practise ---------------- */
  /* After the lesson, students revise in the deck itself (the Revise card on the last slide, the Revise button
     by their name, or the deck opened from learnwithmrcedric with #revise).
     My mistakes: the questions they got wrong on the first try, from any iPad (kept by Live Board) and from
     this iPad's own record, each with its slide. A later right answer, in the deck or in Practise, puts it right.
     Practise: the chapter check again (a deck without one: its questions), in a new order, the choices
     shuffled, and new numbers in calculations that have a recipe in #practice-variants. Nothing is sent to
     the teacher and there are no points. The chapter check can be practised only after the student's own
     first try, so the first try still counts. While the class's answers are held in a lesson, Revise waits. */
  var FIRST_KEY = 'liveboard.first:' + (cfg.topicId || ''), PFIX_KEY = 'liveboard.pfix:' + (cfg.topicId || '');
  var variants = {};
  try { var vEl = document.getElementById('practice-variants'); variants = vEl ? JSON.parse(vEl.textContent) || {} : {}; } catch (e) { variants = {}; }
  function whoKey() { var me = readJ(ID_KEY); return me && me.cls ? me.cls + '|' + me.name : ''; }
  function firstRec() {
    var r = readJ(FIRST_KEY), k = whoKey();
    if (!r || r.who !== k || !r.seen) r = { who: k, seen: {}, w: {}, f: {} };
    return r;
  }
  /* Every answer the deck sends passes here: the first answer to a question decides whether it is a mistake. */
  function noteFirst(e) {
    var t = e && byId[e.task];
    if (!t || t.kind === 'written' || e.action !== 'submit' || e.valid === false || presenting) return;
    var r = firstRec();
    if (!r.who) return;
    var c = e.correct === true ? true : e.correct === false ? false : null;
    if (!r.seen[t.id]) { r.seen[t.id] = 1; if (c === false) r.w[t.id] = 1; }
    else if (c === true && r.w[t.id]) r.f[t.id] = 1;
    writeJ(FIRST_KEY, r);
  }
  function pfixList() { var x = readJ(PFIX_KEY); return x && x.who === whoKey() && Array.isArray(x.ids) ? x.ids : []; }
  function addPfix(id) { var ids = pfixList(); if (ids.indexOf(id) < 0) { ids.push(id); writeJ(PFIX_KEY, { who: whoKey(), ids: ids }); } }
  var review = null, reviewAt = 0, reviewBusy = null, reviewFailed = false, retiring = false;
  /* Live Board's list for this student (and the questions put right in Practise, sent with it). */
  function loadReview(force) {
    var me = readJ(ID_KEY);
    if (!me || !me.cls || presenting) return Promise.resolve(null);
    if (!force && review && Date.now() - reviewAt < 30000) return Promise.resolve(review);
    if (reviewBusy) return reviewBusy;
    var send = pfixList().slice();
    reviewBusy = api({ api: 'review', topicId: cfg.topicId, who: { cls: me.cls, name: me.name }, st: me.st || '', fixed: send }).then(function (r) {
      reviewBusy = null;
      if (!r || !r.ok) { var e1 = new Error(r && r.error || 'no list'); e1.kind = 'old'; throw e1; }
      review = r; reviewAt = Date.now(); reviewFailed = false;
      if (send.length) {
        var left = pfixList().filter(function (id) { return send.indexOf(id) < 0; });
        writeJ(PFIX_KEY, left.length ? { who: whoKey(), ids: left } : null);
      }
      // Mistakes on questions this deck no longer has (or no longer marks) are retired, so learnwithmrcedric
      // does not count them for ever.
      var gone = (r.wrong || []).filter(function (id) { return (!byId[id] || byId[id].kind === 'written') && (r.fixed || []).indexOf(id) < 0; });
      if (gone.length && !retiring) { retiring = true; gone.forEach(addPfix); setTimeout(function () { loadReview(true).then(null, function () {}); }, 50); }
      drawReviseCard();
      syncReviseButton();
      return r;
    }, function (err) { reviewBusy = null; reviewFailed = true; drawReviseCard(); syncReviseButton(); throw err; });
    return reviewBusy;
  }
  function mistakes() {
    var r = firstRec(), w = {}, f = {}, seen = {};
    ((review && review.wrong) || []).forEach(function (id) { w[id] = 1; });
    ((review && review.answered) || []).forEach(function (id) { seen[id] = 1; });
    // This iPad's own first tries count only for questions Live Board has not had an answer to (yet):
    // a first try on another iPad comes first.
    Object.keys(r.w).forEach(function (id) { if (!seen[id]) w[id] = 1; });
    ((review && review.fixed) || []).concat(Object.keys(r.f), pfixList()).forEach(function (id) { f[id] = 1; });
    var ids = Object.keys(w).filter(function (id) { return byId[id] && byId[id].kind !== 'written'; })
      .sort(function (a, b) { return order[a] - order[b]; });
    return { todo: ids.filter(function (id) { return !f[id]; }), done: ids.filter(function (id) { return f[id]; }) };
  }
  /* Whether the class's answers are held is known once the first live check or the list has come back
     (or failed, offline, when the deck shows its own feedback anyway). Until then Revise shows nothing that
     could give an answer away. */
  function stateKnown() { var me = readJ(ID_KEY); return !(me && me.cls) || ctlKnown || !!review || reviewFailed; }
  function heldNow() {
    if (ctlKnown && ctl) return !!(ctl.hold && !ctl.relAll);
    return !!(review && review.held);
  }
  function inLesson() { return !!(ctl && ((ctl.hold && !ctl.relAll) || ctl.follow || ctl.pause || ctl.lead)); }
  function checkTried() {
    if (!checkIds.length) return true;
    if (review && review.checkTries > 0) return true;
    var r = firstRec();
    return checkIds.some(function (id) { return r.seen[id]; });
  }
  function slideInfo(id) {
    var t = byId[id], s = slideOf(t), sl = s.n ? slideList()[s.n - 1] : null, ttl = s.title;
    if (!ttl && sl) { var h = sl.querySelector('h1, h2'); ttl = h ? h.textContent.replace(/\s+/g, ' ').trim() : ''; }
    return { n: s.n, title: ttl };
  }
  function isReviseOverlay() { return !!(overlay && overlay.getAttribute('data-lbv')); }

  /* The card on the last slide (the checklist slide in decks that have one). */
  var reviseCard = null;
  function addReviseCard() {
    if (presentMode || reviseCard) return;
    var host = summaryId ? document.getElementById(summaryId) : null;
    if (!host) { var all = slideList(); host = all[all.length - 1]; }
    if (!host) return;
    reviseCard = el('div', 'lbv-card');
    reviseCard.setAttribute('data-host', host.id || '');
    var anchor = host.querySelector('.quick-progress');
    if (anchor) anchor.parentNode.insertBefore(reviseCard, anchor.nextSibling);
    else (host.querySelector('.inner') || host).appendChild(reviseCard);
    drawReviseCard();
  }
  var cardKey = '';
  function drawReviseCard() {
    if (!reviseCard) return;
    var me = readJ(ID_KEY), line;
    if (!stateKnown()) line = 'See your mistakes and practise this lesson again.';
    else if (heldNow()) line = 'Opens when your teacher shows the answers.';
    else if (!me || !me.cls) line = 'Practise the questions again. Sign in to keep a list of your mistakes.';
    else {
      var m = mistakes();
      line = (m.todo.length ? m.todo.length + (m.todo.length === 1 ? ' mistake' : ' mistakes') + ' to put right. '
        : m.done.length ? 'Every mistake put right. ' : 'No mistakes to put right. ') +
        (!checkIds.length ? 'Practise the questions in a new order.' : checkTried() ? 'Practise the ' + CHECK_NAME + ' with new numbers.'
          : 'After the ' + CHECK_NAME + ', practise it here with new numbers.');
    }
    if (line === cardKey) return;
    cardKey = line;
    reviseCard.innerHTML = '';
    var tx = el('div', 'lbv-tx');
    tx.appendChild(el('b', 'lbv-h', 'Revise this lesson'));
    tx.appendChild(el('span', '', line));
    reviseCard.appendChild(tx);
    var b = el('button', '', 'Revise'); b.type = 'button';
    b.disabled = heldNow();
    b.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); openRevise(); });
    reviseCard.appendChild(b);
  }

  function bigBtn(title, sub, go) {
    var b = el('button', 'lbv-big'); b.type = 'button';
    b.appendChild(el('b', '', title)); b.appendChild(el('span', '', sub));
    b.addEventListener('click', go);
    return b;
  }
  function reviseHead(p, text, onClose) {
    var head = el('div', 'lbv-head');
    head.appendChild(el('h2', '', text));
    var x = el('button', 'lbv-x', '×'); x.type = 'button'; x.setAttribute('aria-label', 'Close');
    x.addEventListener('click', onClose || closeOverlay);
    head.appendChild(x);
    p.appendChild(head);
  }
  function openRevise() {
    if (presenting) return;
    dropBackPill();
    var p = panel();
    overlay.setAttribute('data-lbv', 'revise');
    p.classList.add('lbv-wide');
    reviseHead(p, 'Revise this lesson');
    var body = el('div', 'lbv-body');
    p.appendChild(body);
    var me = readJ(ID_KEY);
    if (me && me.cls) {
      drawRevise(body, 'loading');
      loadReview(true).then(function () { drawRevise(body, ''); }, function () { drawRevise(body, 'offline'); });
    } else drawRevise(body, '');
  }
  function drawRevise(body, state) {
    if (!document.body.contains(body)) return;
    body.innerHTML = '';
    if (!stateKnown()) { body.appendChild(el('p', 'lbv-wait', 'One moment…')); return; }
    if (heldNow()) {
      body.appendChild(el('p', 'lbv-big-note', 'Your teacher is holding the answers for this lesson. Revise opens when they show them.'));
      return;
    }
    body.appendChild(el('p', 'lbv-sub', 'Practice gives no points and is not sent to your teacher.'));
    var me = readJ(ID_KEY), signed = !!(me && me.cls), m = mistakes();
    if (signed && state === 'loading') { body.appendChild(el('p', 'lbv-wait', 'Getting your list…')); return; }
    var acts = el('div', 'lbv-acts');
    if (signed && state !== 'loading' && m.todo.length) acts.appendChild(bigBtn('Practise my mistakes', m.todo.length + (m.todo.length === 1 ? ' question' : ' questions') + '. Right first time puts one right.',
      function () { startPractice(m.todo, 'mistakes'); }));
    if (checkIds.length) {
      var nv = checkIds.filter(function (id) { return variants[id]; }).length;
      if (checkTried()) acts.appendChild(bigBtn('Practise the ' + CHECK_NAME, checkIds.length + ' questions in a new order' + (nv ? ', with new numbers in the calculations' : ''),
        function () { startPractice(checkIds, 'check'); }));
      else if (state === 'loading') acts.appendChild(el('p', 'lbv-wait', 'Checking your ' + CHECK_NAME + '…'));
      else {
        var first = el('div', 'lbv-first'), at = slideInfo(checkIds[0]).n;
        first.appendChild(el('p', '', 'Do the ' + CHECK_NAME + ' first' + (at ? ' (slide ' + at + ')' : '') + '. Your first try is the one that counts. After that you can practise it here as often as you like.'));
        var g = el('button', 'lbv-plain', 'Go to the ' + CHECK_NAME); g.type = 'button';
        g.addEventListener('click', function () { closeOverlay(); goToTask(checkIds[0]); });
        first.appendChild(g);
        acts.appendChild(first);
      }
    } else {
      var all = list.filter(function (t) { return t.kind === 'choice' || t.kind === 'number'; }).map(function (t) { return t.id; });
      if (all.length) acts.appendChild(bigBtn('Practise the questions', all.length + ' questions from this lesson, in a new order', function () { startPractice(all, 'all'); }));
    }
    if (acts.children.length) body.appendChild(acts);
    var sec = el('div', 'lbv-sec lbv-mine');
    sec.appendChild(el('h3', '', 'My mistakes'));
    if (!signed) sec.appendChild(el('p', '', 'Sign in on this iPad to keep a list of the questions you get wrong.'));
    else if (state === 'loading') sec.appendChild(el('p', 'lbv-wait', 'Getting your list…'));
    else {
      if (state === 'offline') sec.appendChild(el('p', 'lbv-note', 'Live Board did not send your full list, so this shows the answers given on this iPad.'));
      if (!m.todo.length && !m.done.length) sec.appendChild(el('p', '', 'No mistakes on your first tries so far.'));
      else {
        sec.appendChild(el('p', '', m.todo.length ? 'Questions you got wrong the first time. Look at the slide again, then practise them.' : 'You have put every one right.'));
        m.todo.forEach(function (id) { sec.appendChild(mistakeRow(id, false)); });
        if (m.done.length) {
          var det = el('details', 'lbv-done');
          det.appendChild(el('summary', '', '✓ ' + m.done.length + ' put right'));
          m.done.forEach(function (id) { det.appendChild(mistakeRow(id, true)); });
          sec.appendChild(det);
        }
      }
    }
    body.appendChild(sec);
  }
  /* A chapter check question is taught earlier in the deck: the first other question on the same objective
     shows where, so Go to the slide goes there rather than back to the check. */
  function teachSlide(id) {
    var t = byId[id];
    if (!t || !isCheckTask(id) || !t.objective) return null;
    for (var i = 0; i < list.length; i++) {
      var x = list[i];
      if (x.objective === t.objective && !isCheckTask(x.id) && x.slide && document.getElementById(x.slide)) {
        var e = document.getElementById(x.slide), sl = e.classList.contains('slide') ? e : e.closest('.slide');
        if (sl && sl.id) return sl;
      }
    }
    return null;
  }
  function placeOf(id) {
    var sl = teachSlide(id);
    if (sl) {
      var h = sl.querySelector('h1, h2');
      return { el: sl, label: 'Chapter check · taught on slide ' + (slideList().indexOf(sl) + 1) + (h ? ' · ' + h.textContent.replace(/\s+/g, ' ').trim() : '') };
    }
    var s = slideInfo(id);
    return { el: null, label: (s.n ? 'Slide ' + s.n : 'Slide') + (s.title ? ' · ' + s.title : '') };
  }
  function goPlace(id) { var pl = placeOf(id); closeOverlay(); if (pl.el) goSlide(pl.el.id); else goToTask(id); }
  function mistakeRow(id, done, text) {
    var t = byId[id], pl = placeOf(id), row = el('div', 'lbv-row' + (done ? ' done' : ''));
    var tx = el('div', 'lbv-tx');
    tx.appendChild(el('span', 'lbv-where', pl.label));
    tx.appendChild(el('span', 'lbv-q', text || t.question));
    row.appendChild(tx);
    var go = el('button', '', 'Go to the slide'); go.type = 'button';
    go.addEventListener('click', function () { goPlace(id); });
    row.appendChild(go);
    return row;
  }

  /* ----- new numbers: #practice-variants -----
     { "taskId": { "vars": { "a": { "from": 1200, "to": 9800, "step": 100 }, "who": ["coach", "lorry"] },
                   "let": { "raw": "a + b" }, "ok": "a % 1000 !== 0", "q": "Rewrite {a} µA in mA.",
                   "answer": "a / 1000", "show": { "answer": 2, "raw": "sf4" }, "unit": "mA", "tol": 0.01,
                   "model": "... = {answer} mA.", "hint": "..." } }  (or a list of these, one chosen at random)
     Expressions may use the variables and rd(x, places), sf(x, figures), abs, min, max, sqrt, pow.
     show gives decimal places (a number) or significant figures ("sf3") for a value in the text. */
  function rd(x, n) { var p = Math.pow(10, n); return Math.round((x + (x >= 0 ? 1 : -1) * 1e-9) * p) / p; }
  function sf(x, n) { return x === 0 ? 0 : Number(Number(x).toPrecision(n)); }
  function calc(expr, s) {
    var names = Object.keys(s);
    var fn = new Function(names.concat(['rd', 'sf', 'abs', 'min', 'max', 'sqrt', 'pow']).join(','), '"use strict"; return (' + expr + ');');
    return fn.apply(null, names.map(function (k) { return s[k]; }).concat([rd, sf, Math.abs, Math.min, Math.max, Math.sqrt, Math.pow]));
  }
  function fmt(x, spec) {
    if (typeof x !== 'number') return String(x);
    var t;
    if (typeof spec === 'number') t = x.toFixed(spec);
    else if (/^sf\d+$/.test(spec || '')) { t = x.toPrecision(Number(spec.slice(2))); if (/e/.test(t)) t = String(Number(t)); }
    else t = String(Number(x.toPrecision(12)));
    return t.replace(/^-/, '−');
  }
  function fillIn(text, s, show) {
    return String(text || '').replace(/\{(\w+)\}/g, function (m0, k) { return s.hasOwnProperty(k) ? fmt(s[k], (show || {})[k]) : m0; });
  }
  function places(step) { var m = String(step).split('.')[1]; return m ? m.length : 0; }
  function makeVariant(t) {
    var v = variants[t.id];
    if (Array.isArray(v)) v = v[Math.floor(Math.random() * v.length)];
    if (!v || !v.q || !v.answer) return null;
    try {
      for (var tries = 0; tries < 200; tries++) {
        var s = {};
        Object.keys(v.vars || {}).forEach(function (k) {
          var d = v.vars[k];
          if (Array.isArray(d)) s[k] = d[Math.floor(Math.random() * d.length)];
          else { var n = Math.round((d.to - d.from) / d.step); s[k] = rd(d.from + d.step * Math.floor(Math.random() * (n + 1)), places(d.step)); }
        });
        Object.keys(v['let'] || {}).forEach(function (k) { s[k] = calc(v['let'][k], s); });
        if (v.ok && !calc(v.ok, s)) continue;
        var ans = calc(v.answer, s);
        if (typeof ans !== 'number' || !isFinite(ans)) continue;
        s.answer = ans;
        return { q: fillIn(v.q, s, v.show), correct: ans, shown: fmt(ans, (v.show || {}).answer), model: fillIn(v.model || '', s, v.show),
          unit: v.unit != null ? v.unit : (t.unit || ''), tol: v.rtol != null ? Math.abs(ans) * v.rtol : v.hasOwnProperty('tol') ? v.tol : null,
          hint: v.hint || t.hint || '', dp: v.dp != null ? v.dp : null, sf: v.sf != null ? v.sf : null };
      }
    } catch (e) { return null; }
    return null;
  }

  /* ----- the practice itself ----- */
  var prac = null, backPill = null;
  function shuffle(a) { for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), x = a[i]; a[i] = a[j]; a[j] = x; } return a; }
  // Choices that point at each other ("Both A and B", "All of the above") keep their order.
  function canShuffle(opts) { return !opts.some(function (o) { return /\b(all|none|both|neither) of (the|these)\b|\b(above|below)\b|^(both|neither)\b|\b[A-D] and [A-D]\b/i.test(String(o)); }); }
  function practiceItem(id) {
    var t = byId[id], v = t.kind === 'number' ? makeVariant(t) : null, opts = (t.options || []).slice();
    return { id: id, kind: t.kind, q: v ? v.q : t.question, options: t.kind === 'choice' && canShuffle(opts) ? shuffle(opts) : opts,
      correct: v ? v.correct : t.correct, shown: v ? v.shown : String(t.correct == null ? '' : t.correct), unit: v ? v.unit : (t.unit || ''),
      tol: v ? v.tol : t.tol, model: v ? v.model : (t.model || ''), hint: v ? v.hint : (t.hint || ''), why: v ? {} : (t.why || {}),
      dp: v ? v.dp : null, sf: v ? v.sf : null, fresh: !!v, tries: 0, firstRight: null, done: false, value: '' };
  }
  function startPractice(ids, kind) {
    prac = { kind: kind, ids: ids.slice(), items: shuffle(ids.slice()).map(practiceItem), i: 0 };
    drawPractice();
  }
  function parseNum(v) {
    var c = String(v).trim().replace(/[−–]/g, '-').replace(/,/g, '').replace(/\s+/g, '');
    c = c.replace(/[×x]10\^?([+-]?\d+)$/i, 'e$1');
    if (!/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(c)) return NaN;
    return Number(c);
  }
  /* How a typed number is written: its decimal places, and the significant figures it can stand for
     (a whole number ending in zeros, such as 40, can be 1 or 2 figures). */
  function formOf(str) {
    var c = String(str).trim().replace(/[\u2212\u2013]/g, '-').replace(/,/g, '').replace(/\s+/g, '').replace(/^[+-]/, '');
    var mant = c.split(/e|[×x]10/i)[0], dec = mant.indexOf('.') >= 0 ? mant.split('.')[1].length : 0;
    var digits = mant.replace('.', '').replace(/^0+/, '');
    if (mant.indexOf('.') >= 0) return { dp: dec, sfMin: digits.length, sfMax: digits.length };
    var trimmed = digits.replace(/0+$/, '');
    return { dp: 0, sfMin: Math.max(1, trimmed.length), sfMax: Math.max(1, digits.length) };
  }
  function dropBackPill() { if (backPill) { backPill.remove(); backPill = null; } }
  function drawPractice() {
    dropBackPill();
    if (!stateKnown() || heldNow()) { openRevise(); return; }
    var it = prac.items[prac.i];
    var p = panel();
    overlay.setAttribute('data-lbv', 'practice');
    p.classList.add('lbv-wide', 'lbp');
    if (!it) { drawPracticeEnd(p); return; }
    var head = el('div', 'lbp-head');
    head.appendChild(el('span', 'lbp-tag', 'Practice · no points'));
    head.appendChild(el('span', 'lbp-count', (prac.i + 1) + ' / ' + prac.items.length));
    var x = el('button', 'lbv-x', '×'); x.type = 'button'; x.setAttribute('aria-label', 'Stop practising');
    x.addEventListener('click', function () { flushPractice(); openRevise(); });
    head.appendChild(x);
    p.appendChild(head);
    if (prac.kind !== 'check') {
      var where = el('div', 'lbp-where');
      var pl = placeOf(it.id);
      where.appendChild(el('span', '', pl.el ? pl.label.replace('Chapter check', 'From the chapter check') : 'From ' + pl.label.replace(/^Slide/, 'slide')));
      var look = el('button', 'lbv-link', 'See the slide'); look.type = 'button';
      look.addEventListener('click', function () {
        goPlace(it.id);
        backPill = el('button', 'lbp-back', '← Back to practice'); backPill.type = 'button';
        backPill.addEventListener('click', drawPractice);
        document.body.appendChild(backPill);
      });
      where.appendChild(look);
      p.appendChild(where);
    }
    p.appendChild(el('div', 'lbp-q', it.q));
    if (it.fresh) p.appendChild(el('div', 'lbp-new', 'New numbers'));
    var fb = el('div', 'lbp-fb'); fb.setAttribute('aria-live', 'polite');
    var next = el('button', 'lbx-go lbp-next', prac.i + 1 < prac.items.length ? 'Next question' : 'See how you did'); next.type = 'button';
    next.hidden = !it.done;
    next.addEventListener('click', function () { prac.i++; drawPractice(); });
    function finish(text, good) {
      it.done = true;
      if (it.firstRight && mistakes().todo.indexOf(it.id) >= 0) addPfix(it.id);
      say(text, good);
      next.hidden = false;
      setTimeout(function () { try { next.focus(); } catch (e) {} }, 30);
    }
    function say(text, good) { fb.textContent = text; fb.className = 'lbp-fb ' + (good === true ? 'ok' : good === false ? 'no' : ''); }
    var answerText = it.shown + (it.unit ? ' ' + it.unit : '');
    if (it.kind === 'choice') {
      var opts = el('div', 'lbp-opts');
      var lockAll = function () { Array.prototype.forEach.call(opts.children, function (c) { c.disabled = true; }); };
      it.options.forEach(function (o) {
        var b = el('button', 'lbp-opt', o); b.type = 'button';
        if (it.done && o === String(it.correct)) b.classList.add('ok');
        b.disabled = it.done;
        b.addEventListener('click', function () {
          if (it.done || b.disabled) return;
          it.tries++;
          var right = o === String(it.correct);
          if (it.tries === 1) it.firstRight = right;
          if (right) { b.classList.add('ok'); lockAll(); finish('Right. ' + it.model, true); return; }
          b.classList.add('no'); b.disabled = true;
          if (it.tries >= 2) {
            Array.prototype.forEach.call(opts.children, function (c) { if (c.textContent === String(it.correct)) c.classList.add('ok'); });
            lockAll(); finish('Not this time. The answer is “' + it.correct + '”. ' + it.model, false);
          } else say('Not yet. ' + (it.why[o] || it.hint || 'Think again about what the slide showed.') + ' Try once more.', false);
        });
        opts.appendChild(b);
      });
      p.appendChild(opts);
    } else if (it.kind === 'number') {
      var row = el('div', 'lbp-entry'), inp = el('input');
      inp.inputMode = 'decimal'; inp.autocomplete = 'off'; inp.placeholder = 'Your answer'; inp.value = it.value;
      inp.setAttribute('aria-label', 'Your answer' + (it.unit ? ', in ' + it.unit : ''));
      inp.disabled = it.done;
      row.appendChild(inp);
      if (it.unit) row.appendChild(el('b', '', it.unit));
      var chk = el('button', 'lbx-go', 'Check'); chk.type = 'button'; chk.disabled = it.done;
      row.appendChild(chk);
      p.appendChild(row);
      var mark = function () {
        if (it.done) return;
        it.value = inp.value;
        var v = parseNum(inp.value.replace(new RegExp('\\s*' + String(it.unit || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*$'), ''));
        if (!isFinite(v)) { say('Type a number, for example 4.5 or 3.0e8.', null); return; }
        it.tries++;
        var tol = it.tol != null ? Number(it.tol) : Math.max(Math.abs(Number(it.correct)) * 0.005, 1e-14);
        var right = Math.abs(v - Number(it.correct)) <= tol + 1e-12;
        var form = formOf(inp.value), badForm = '';
        if (right && it.dp != null && form.dp !== it.dp) badForm = 'The value is right, but write it to ' + it.dp + (it.dp === 1 ? ' decimal place.' : ' decimal places.');
        if (right && it.sf != null && (it.sf < form.sfMin || it.sf > form.sfMax)) badForm = 'The value is right, but write it to ' + it.sf + ' significant figures.';
        if (badForm) right = false;
        if (it.tries === 1) it.firstRight = right;
        if (right) { inp.disabled = chk.disabled = true; finish('Right. ' + it.model, true); return; }
        if (badForm && it.tries < 2) { say('Not yet. ' + badForm + ' Try once more.', false); inp.select(); return; }
        if (it.tries >= 2) { inp.disabled = chk.disabled = true; finish('Not this time. The answer is ' + answerText + '. ' + it.model, false); return; }
        say('Not yet. ' + (it.hint || 'Check each step, and the unit.') + ' Try once more.', false);
        inp.select();
      };
      chk.addEventListener('click', mark);
      inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); mark(); } });
      if (!it.done) setTimeout(function () { try { inp.focus(); } catch (e) {} }, 60);
    } else {
      var ta = el('textarea', 'lbp-text'); ta.placeholder = 'Write your answer, then compare it with the model answer.'; ta.value = it.value;
      ta.addEventListener('input', function () { it.value = ta.value; });
      p.appendChild(ta);
      var show = el('button', 'lbx-go', 'Show the model answer'); show.type = 'button'; show.hidden = it.done;
      show.addEventListener('click', function () { show.hidden = true; finish('Model answer: ' + (it.model || 'none given') + ' Did yours say the same?', null); });
      p.appendChild(show);
    }
    if (it.done && !fb.textContent) say(it.firstRight === true ? 'Right. ' + it.model : it.kind === 'written' ? 'Model answer: ' + it.model : 'The answer is ' + answerText + '. ' + it.model, it.kind === 'written' ? null : it.firstRight === true);
    p.appendChild(fb);
    p.appendChild(next);
  }
  function drawPracticeEnd(p) {
    flushPractice();
    reviseHead(p, 'How you did', function () { openRevise(); });
    var marked = prac.items.filter(function (x) { return x.kind !== 'written'; });
    var right = marked.filter(function (x) { return x.firstRight === true; }).length;
    var missed = prac.items.filter(function (x) { return x.firstRight === false; });
    var big = el('div', 'lbp-score');
    big.appendChild(el('b', '', right + ' / ' + marked.length));
    big.appendChild(el('span', '', 'right first time' + (marked.length < prac.items.length ? ' (written answers are not marked)' : '')));
    p.appendChild(big);
    if (missed.length) {
      p.appendChild(el('p', '', 'Look at these slides again:'));
      missed.forEach(function (x) { p.appendChild(mistakeRow(x.id, false, x.q)); });
    } else if (marked.length) p.appendChild(el('p', '', 'Every one right first time.'));
    var row = el('div', 'lbx-row lbp-endrow');
    var again = el('button', 'lbx-go', 'Practise again'); again.type = 'button';
    again.title = 'A new order' + (prac.items.some(function (x) { return x.fresh; }) ? ' and new numbers' : '');
    again.addEventListener('click', function () { startPractice(prac.ids, prac.kind); });
    row.appendChild(again);
    if (missed.length && missed.length < prac.items.length) {
      var some = el('button', '', 'Just the ones I missed'); some.type = 'button';
      some.addEventListener('click', function () { startPractice(missed.map(function (x) { return x.id; }), prac.kind === 'check' ? 'check' : 'mistakes'); });
      row.appendChild(some);
    }
    var back = el('button', '', 'Back to Revise'); back.type = 'button';
    back.addEventListener('click', openRevise);
    row.appendChild(back);
    p.appendChild(row);
  }
  /* Questions put right in practice go to Live Board with the next list request (now, in the background). */
  function flushPractice() { if (pfixList().length) loadReview(true).then(null, function () {}); }
  function syncReviseButton() {
    var b = whoLine.querySelector('.lbv-open');
    if (b) b.hidden = presenting || inLesson() || !stateKnown() || heldNow();
    if (heldNow() || (ctl && ctl.pause)) { dropBackPill(); if (isReviseOverlay()) closeOverlay(); }
    if (reviseCard) drawReviseCard();
  }

  /* ---------------- sending again ---------------- */
  // The deck sends an answer once, a second after it is checked. If Live Board was busy or the
  // connection dropped, the answer stays saved on the iPad. This sends it again by itself: first
  // after 4 to 8 seconds, then waiting about twice as long each time (never more than about
  // 40 seconds), with a random part so a class of iPads does not all send again at once.
  var resendFails = 0, resendAt = 0, resendBusy = false;
  function resendCheck() {
    var S = window.ScienceSync;
    if (!S || typeof S.pending !== 'function' || typeof S.sync !== 'function' || resendBusy) return;
    var waiting = 0;
    try { waiting = S.pending().length; } catch (e) { return; }
    if (!waiting) { resendFails = 0; resendAt = 0; return; }
    var now = Date.now();
    if (!resendAt) { resendAt = now + 4000 + Math.random() * 4000; return; }   // leave the deck's own send its turn
    if (now < resendAt || (navigator.onLine === false)) return;
    resendBusy = true;
    Promise.resolve().then(function () { return S.sync(); }).catch(function () {}).then(function () {
      resendBusy = false;
      var left = 0;
      try { left = S.pending().length; } catch (e) { left = 0; }
      if (!left) { resendFails = 0; resendAt = 0; return; }
      resendFails += 1;
      var base = Math.min(30000, 4000 * Math.pow(2, resendFails - 1));
      resendAt = Date.now() + base * (0.75 + Math.random() * 0.6);
    });
  }
  setInterval(resendCheck, 2000);

  function go(id) {
    // Someone else's answers are still in this deck on this iPad: start a fresh record first.
    if (nameBox.value && (nameBox.value !== id.name || classBox.value !== id.cls) && deckChange) {
      var done = deckChange.call(changeBtn);
      if (done === false) {
        var p = panel();
        p.appendChild(el('h2', '', 'One moment'));
        p.appendChild(el('p', '', 'This lesson still has answers from ' + nameBox.value + ' that have not reached the teacher. Connect to the internet, wait a moment, then reload the page.'));
        return;
      }
      return;   // the deck reloads itself
    }
    setDeckProfile(id);
    showWho(id);
    drawMode();
  }
  /* ---------------- Streak Challenge ----------------
     Version 14: the chapter check as a class game, run from the projector. One question at a time for the whole class,
     like Kahoot, but speed gives nothing: every right answer is worth 100, and each right answer in a row after the first
     adds 50 more (up to 300 a question). A wrong answer ends the streak. The projector shows how many have answered,
     then the answer, the class's choices, the top 5 and the longest streaks. Each iPad shows the student's own result
     and place only. At the end the score becomes Worksheet Hub points (the full score earns the chapter check points),
     once per deck, and the game counts as the student's chapter check. */
  var SQ_COLOURS = ['#e9082b', '#1f6feb', '#e6a100', '#13945a', '#7a3fd1', '#0f8a9c'];
  var SQ_LETTERS = 'ABCDEF';
  var sqOn = false, sqBox = null, sqDrawn = '', sqGid = '', sqJoined = '', sqPick = '', sqSkew = 0, sqTick = null, sqMsg = '';
  var SQ_SEEN = 'liveboard.sqSeen:' + (cfg.topicId || '');
  function sqQs() { if (!CHECK_ON) return []; return checkIds.filter(function (id) { return byId[id] && (byId[id].kind === 'choice' || byId[id].kind === 'number'); }); }
  function sqAnswerText(t) { return String(t.correct == null ? '' : t.correct) + (t.kind === 'number' && t.unit ? ' ' + t.unit : ''); }
  function sqMark(t, value) {
    if (t.kind === 'choice') return value === String(t.correct);
    var raw = String(value).replace(new RegExp('\\s*' + String(t.unit || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*$'), '');
    var v = parseNum(raw);
    if (!isFinite(v)) return null;
    var tol = t.tol != null ? Number(t.tol) : Math.max(Math.abs(Number(t.correct)) * 0.005, 1e-14);
    return Math.abs(v - Number(t.correct)) <= tol + 1e-12;
  }
  function sqPlace(n) {
    var s = ['th', 'st', 'nd', 'rd'], v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  }
  function sqStreakText(n) { return n >= 2 ? n + ' in a row' : ''; }
  function sqLeft(ends) { return Math.max(0, Math.ceil((ends - (Date.now() + sqSkew)) / 1000)); }
  function sqClock(s) { return Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2); }
  function sqStyle() {
    if (document.getElementById('sq-style')) return;
    var st = document.createElement('style');
    st.id = 'sq-style';
    st.textContent =
      '.sq{position:fixed!important;inset:0!important;z-index:2147480500!important;background:#17113a!important;color:#fff!important;display:flex!important;flex-direction:column!important;font:18px/1.4 Arial,Helvetica,sans-serif!important;overflow:auto!important;-webkit-overflow-scrolling:touch!important}' +
      '.sq *{box-sizing:border-box!important}' +
      '.sq-top{display:flex!important;align-items:center!important;gap:12px!important;padding:14px 20px!important;background:rgba(255,255,255,.06)!important;border-bottom:2px solid rgba(255,255,255,.12)!important}' +
      '.sq-brand{font:900 20px/1 "Arial Black",Arial,sans-serif!important;letter-spacing:.3px!important}' +
      '.sq-brand i{display:inline-block!important;width:14px!important;height:18px!important;margin-right:8px!important;vertical-align:-2px!important;background:#ff8a1f!important;border-radius:50% 50% 50% 50%/60% 60% 40% 40%!important;box-shadow:0 0 12px #ff8a1f!important}' +
      '.sq-count{margin-left:auto!important;font-weight:700!important;color:#d8d2ff!important}' +
      '.sq-time{min-width:74px!important;text-align:center!important;font:900 22px/1 "Arial Black",Arial,sans-serif!important;background:#fff!important;color:#17113a!important;border-radius:999px!important;padding:8px 14px!important}' +
      '.sq-time.low{background:#ffd1d8!important;color:#a1001b!important}' +
      '.sq-main{flex:1!important;display:flex!important;flex-direction:column!important;gap:16px!important;padding:22px 20px 26px!important;width:min(1100px,100%)!important;margin:0 auto!important}' +
      '.sq-q{background:#fff!important;color:#101014!important;border-radius:14px!important;padding:18px 22px!important;font:700 24px/1.35 Arial,Helvetica,sans-serif!important;box-shadow:0 6px 0 rgba(0,0,0,.25)!important}' +
      '.sq-opts{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:12px!important}' +
      '.sq-opt{display:flex!important;align-items:center!important;gap:14px!important;min-height:76px!important;padding:14px 16px!important;border:0!important;border-radius:14px!important;color:#fff!important;font:700 20px/1.3 Arial,Helvetica,sans-serif!important;text-align:left!important;cursor:pointer!important;box-shadow:0 5px 0 rgba(0,0,0,.28)!important;transition:transform .12s,opacity .2s!important}' +
      '.sq-opt b{flex:none!important;display:grid!important;place-items:center!important;width:42px!important;height:42px!important;border-radius:10px!important;background:rgba(255,255,255,.22)!important;font:900 22px/1 "Arial Black",Arial,sans-serif!important}' +
      '.sq-opt span{flex:1!important}' +
      '.sq-opt:disabled{cursor:default!important;opacity:1!important}' +
      '.sq-opt.on{outline:5px solid #fff!important;outline-offset:3px!important;transform:translateY(-2px)!important}' +
      '.sq-opts.picked .sq-opt:not(.on){opacity:.45!important}' +
      '.sq-opts.shown .sq-opt:not(.right){opacity:.35!important}' +
      '.sq-opt.right{outline:5px solid #fff!important;outline-offset:3px!important}' +
      '.sq-opt em{flex:none!important;font:900 22px/1 "Arial Black",Arial,sans-serif!important;font-style:normal!important;background:rgba(0,0,0,.25)!important;border-radius:999px!important;padding:6px 12px!important}' +
      '.sq-entry{display:flex!important;gap:10px!important;align-items:center!important;background:#fff!important;border-radius:14px!important;padding:12px!important;color:#101014!important}' +
      '.sq-entry input{flex:1!important;min-width:0!important;font:700 26px Arial,sans-serif!important;padding:10px 12px!important;border:2px solid #101014!important;border-radius:10px!important}' +
      '.sq-entry b{font:700 22px Arial,sans-serif!important}' +
      '.sq-go{align-self:center!important;border:0!important;border-radius:999px!important;background:#fff!important;color:#17113a!important;font:900 20px/1 "Arial Black",Arial,sans-serif!important;padding:16px 30px!important;cursor:pointer!important;box-shadow:0 5px 0 rgba(0,0,0,.3)!important}' +
      '.sq-go:disabled{opacity:.45!important;cursor:default!important}' +
      '.sq-go.alt{background:transparent!important;color:#d8d2ff!important;box-shadow:none!important;font:700 16px Arial,sans-serif!important;text-decoration:underline!important;padding:8px!important}' +
      '.sq-row{display:flex!important;gap:12px!important;justify-content:center!important;align-items:center!important;flex-wrap:wrap!important}' +
      '.sq-act{position:sticky!important;bottom:0!important;margin:0 -20px -26px!important;padding:12px 20px 16px!important;background:linear-gradient(rgba(23,17,58,0),#17113a 30%)!important}' +
      '.sq-note .sq-flame{font-size:20px!important;padding:6px 16px!important}' +
      '.sq-top5 li span.sq-flame{flex:none!important}' +
      '.sq-note{text-align:center!important;color:#e6e1ff!important;font-size:19px!important}' +
      '.sq-msg{text-align:center!important;color:#ffd1d8!important;font-weight:700!important;min-height:1.4em!important}' +
      '.sq-big{text-align:center!important;font:900 46px/1.1 "Arial Black",Arial,sans-serif!important;margin:6px 0!important}' +
      '.sq-big.ok{color:#5df2a6!important}.sq-big.no{color:#ff9aab!important}' +
      '.sq-card{background:rgba(255,255,255,.08)!important;border:2px solid rgba(255,255,255,.14)!important;border-radius:14px!important;padding:16px 18px!important}' +
      '.sq-card h3{margin:0 0 10px!important;font:900 18px/1.2 "Arial Black",Arial,sans-serif!important;color:#fff!important}' +
      '.sq-rules{margin:0!important;padding-left:22px!important;color:#e6e1ff!important}.sq-rules li{margin:4px 0!important}' +
      '.sq-stats{display:flex!important;gap:12px!important;justify-content:center!important;flex-wrap:wrap!important}' +
      '.sq-stat{background:#fff!important;color:#17113a!important;border-radius:14px!important;padding:12px 18px!important;text-align:center!important;min-width:140px!important}' +
      '.sq-stat b{display:block!important;font:900 30px/1.1 "Arial Black",Arial,sans-serif!important}' +
      '.sq-stat span{font-size:14px!important;font-weight:700!important;color:#4a4566!important}' +
      '.sq-flame{display:inline-block!important;background:#ff8a1f!important;color:#1d0d00!important;border-radius:999px!important;padding:3px 10px!important;font:900 14px/1.2 Arial,sans-serif!important;white-space:nowrap!important}' +
      '.sq-board{display:grid!important;grid-template-columns:3fr 2fr!important;gap:14px!important}' +
      '.sq-top5{list-style:none!important;margin:0!important;padding:0!important}' +
      '.sq-top5 li{display:flex!important;align-items:center!important;gap:12px!important;padding:10px 12px!important;border-radius:10px!important;background:rgba(255,255,255,.08)!important;margin-bottom:8px!important;font-size:21px!important}' +
      '.sq-top5 li b{flex:none!important;width:44px!important;font:900 22px/1 "Arial Black",Arial,sans-serif!important;color:#ffd75e!important}' +
      '.sq-top5 li span{flex:1!important;font-weight:700!important;overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important}' +
      '.sq .sq-top5 li span.sq-disc,.sq-disc{flex:none!important;display:inline-grid!important;place-items:center!important;width:46px!important;height:46px!important;border-radius:50%!important;color:#fff!important;font:900 17px/1 "Arial Black",Arial,sans-serif!important;text-shadow:0 1px 2px rgba(0,0,0,.55)!important;margin:0 6px!important}' +
      '.sq-top5 li span.sq-gap{flex:1!important}' +
      '.sq-top5 li em{font-style:normal!important;font:900 22px/1 "Arial Black",Arial,sans-serif!important}' +
      '.sq-meter{height:12px!important;border-radius:999px!important;background:rgba(255,255,255,.15)!important;overflow:hidden!important}' +
      '.sq-meter i{display:block!important;height:100%!important;background:#5df2a6!important;transition:width .4s!important}' +
      '.sq-pick{display:flex!important;gap:8px!important;justify-content:center!important;flex-wrap:wrap!important}' +
      '.sq-pick button{border:2px solid rgba(255,255,255,.4)!important;background:transparent!important;color:#fff!important;border-radius:999px!important;padding:8px 16px!important;font:700 17px Arial,sans-serif!important;cursor:pointer!important}' +
      '.sq-pick button:hover,.sq-pick button:focus{background:rgba(255,255,255,.12)!important;color:#fff!important}' +
      '.sq-pick button.on,.sq-pick button.on:hover,.sq-pick button.on:focus{background:#fff!important;color:#17113a!important;border-color:#fff!important}' +
      '.sq-launch{position:fixed!important;left:50%!important;bottom:86px!important;transform:translateX(-50%)!important;z-index:2147480400!important;border:0!important;border-radius:999px!important;background:#17113a!important;color:#fff!important;font:900 20px/1 "Arial Black",Arial,sans-serif!important;padding:16px 28px!important;box-shadow:0 6px 0 #ff8a1f,0 10px 30px rgba(0,0,0,.35)!important;cursor:pointer!important}' +
      '.sq-launch i{display:inline-block!important;width:12px!important;height:16px!important;margin-right:10px!important;vertical-align:-1px!important;background:#ff8a1f!important;border-radius:50%/60% 60% 40% 40%!important}' +
      '.sq-pop{animation:sqPop .45s ease-out!important}' +
      '@keyframes sqPop{0%{transform:scale(.7)}70%{transform:scale(1.06)}100%{transform:scale(1)}}' +
      '@media (max-width:700px){.sq-opts{grid-template-columns:1fr!important}.sq-board{grid-template-columns:1fr!important}.sq-q{font-size:20px!important}.sq-big{font-size:34px!important}}' +
      '@media (prefers-reduced-motion:reduce){.sq-pop{animation:none}.sq-bar i,.sq-meter i{transition:none}}';
    document.head.appendChild(st);
  }
  function sqOpen() {
    sqStyle();
    if (!sqBox) {
      sqBox = el('div', 'sq');
      sqBox.setAttribute('role', 'dialog');
      sqBox.setAttribute('aria-label', 'Streak Challenge');
      document.body.appendChild(sqBox);
    }
    sqOn = true;
    return sqBox;
  }
  function sqClose() { if (sqBox) { sqBox.remove(); sqBox = null; } sqOn = false; sqDrawn = ''; clearInterval(sqTick); sqTick = null; }
  function sqHead(box, count, ends) {
    var top = el('div', 'sq-top');
    var br = el('div', 'sq-brand'); br.appendChild(el('i')); br.appendChild(document.createTextNode('Streak Challenge'));
    top.appendChild(br);
    if (count) top.appendChild(el('span', 'sq-count', count));
    if (ends) {
      var tm = el('span', 'sq-time'); tm.setAttribute('data-ends', String(ends));
      top.appendChild(tm);
    }
    box.appendChild(top);
    sqTickNow();
    return top;
  }
  function sqTickNow() {
    if (!sqBox) return;
    Array.prototype.forEach.call(sqBox.querySelectorAll('.sq-time'), function (t) {
      var left = sqLeft(Number(t.getAttribute('data-ends')));
      t.textContent = sqClock(left);
      t.classList.toggle('low', left <= 5);
    });
  }
  function sqRules(main) {
    var c = el('div', 'sq-card');
    c.appendChild(el('h3', '', 'How it works'));
    var ul = el('ul', 'sq-rules');
    ['Each right answer is worth 100 points. Answering fast earns nothing extra, so take your time and think.',
      'Get answers right in a row for a streak bonus: 150 for the second, 200 for the third, up to 300 a question.',
      'A wrong answer ends your streak. Your final score becomes Worksheet Hub points.'].forEach(function (x) { ul.appendChild(el('li', '', x)); });
    c.appendChild(ul);
    main.appendChild(c);
  }

  /* ----- the student's iPad ----- */
  function sqStudent(g) {
    if (presenting) return;
    if (!g || mode !== 'live') { if (sqOn) sqClose(); return; }
    if (g.ends && g.now) sqSkew = g.now - Date.now();
    if (readJ(SQ_SEEN) === g.gid + ':end' && g.phase === 'end') { if (sqOn) sqClose(); return; }
    if (sqGid !== g.gid) { sqGid = g.gid; sqPick = ''; sqMsg = ''; }
    if (sqJoined !== g.gid && !g.joined) {
      sqJoined = g.gid;
      api({ api: 'sqjoin', topicId: cfg.topicId, st: stNow(), gid: g.gid }).catch(function () { sqJoined = ''; });
    }
    var key = [g.gid, g.phase, g.qi, g.mine == null ? '' : g.mine, g.me ? g.me.score + '/' + g.me.place : '', g.result ? 1 : 0].join('|');
    if (key === sqDrawn && sqBox) return;
    if (g.phase === 'q' && sqDrawn.split('|').slice(0, 3).join('|') === [g.gid, g.phase, g.qi].join('|') && sqBox && g.mine == null) return;   // still choosing
    sqDrawn = key;
    if (sqOn && sqBox) sqBox.innerHTML = ''; else sqOpen();
    var box = sqBox, t = g.task ? byId[g.task] : null;
    if (g.phase === 'lobby') {
      sqHead(box, '');
      var m0 = el('div', 'sq-main');
      m0.appendChild(el('div', 'sq-big sq-pop', 'You are in'));
      m0.appendChild(el('p', 'sq-note', 'Look at the board. The first question is coming.'));
      sqRules(m0);
      box.appendChild(m0);
      return;
    }
    if (g.phase === 'q' && t) {
      sqHead(box, 'Question ' + (g.qi + 1) + ' of ' + g.n, g.ends);
      var main = el('div', 'sq-main');
      main.appendChild(el('div', 'sq-q', t.question));
      var msg = el('p', 'sq-msg', '');
      var locked = g.mine != null;
      if (locked) {
        if (t.kind === 'choice') main.appendChild(sqTiles(t, g.mine, null, true));
        else main.appendChild(el('div', 'sq-big', g.mine + (t.unit && String(g.mine).indexOf(t.unit) < 0 ? ' ' + t.unit : '')));
        main.appendChild(el('p', 'sq-note', 'Your answer is locked in. Wait for your teacher to show the answer.'));
        box.appendChild(main);
        return;
      }
      if (sqLeft(g.ends) <= 0) {
        main.appendChild(el('div', 'sq-big', "Time's up"));
        main.appendChild(el('p', 'sq-note', 'Look at the board for the answer.'));
        box.appendChild(main);
        return;
      }
      var go = el('button', 'sq-go', 'Lock in my answer'); go.type = 'button'; go.disabled = true;
      var value = '';
      if (t.kind === 'choice') {
        var tiles = sqTiles(t, '', function (o, b) {
          value = o; go.disabled = false;
          Array.prototype.forEach.call(tiles.children, function (c) { c.classList.toggle('on', c === b); c.setAttribute('aria-pressed', c === b ? 'true' : 'false'); });
          tiles.classList.add('picked');
        });
        main.appendChild(tiles);
        main.appendChild(el('p', 'sq-note', 'Tap an answer, check it, then lock it in. You cannot change it after that.'));
      } else {
        var row = el('label', 'sq-entry'), inp = el('input');
        inp.inputMode = 'decimal'; inp.autocomplete = 'off'; inp.placeholder = 'Your answer';
        inp.setAttribute('aria-label', 'Your answer' + (t.unit ? ', in ' + t.unit : ''));
        inp.addEventListener('input', function () { value = inp.value.trim(); go.disabled = !value; msg.textContent = ''; });
        inp.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !go.disabled) { e.preventDefault(); go.click(); } });
        row.appendChild(inp);
        if (t.unit) row.appendChild(el('b', '', t.unit));
        main.appendChild(row);
        main.appendChild(el('p', 'sq-note', 'Type the number, check it, then lock it in. You cannot change it after that.'));
      }
      var r0 = el('div', 'sq-row'); r0.appendChild(go); main.appendChild(r0);
      main.appendChild(msg);
      go.addEventListener('click', function () {
        var right = sqMark(t, value);
        if (right === null) { msg.textContent = 'Type a number, for example 4.5 or 3.0e8.'; return; }
        go.disabled = true; msg.textContent = 'Sending…';
        api({ api: 'sqans', topicId: cfg.topicId, st: stNow(), gid: g.gid, qi: g.qi, task: g.task, answer: value, right: right }).then(function (r) {
          if (r && r.ok) { g.mine = value; sqDrawn = ''; sqStudent(g); return; }
          if (r && r.signedOut) { signedOutHere(); return; }
          msg.textContent = (r && r.error) || 'That did not send. Try again.';
          go.disabled = !!(r && r.closed);
        }, function () { msg.textContent = 'That did not send. Check the wifi, then try again.'; go.disabled = false; });
      });
      box.appendChild(main);
      return;
    }
    if (g.phase === 'reveal' && t) {
      sqHead(box, 'Question ' + (g.qi + 1) + ' of ' + g.n);
      var mr = el('div', 'sq-main'), me = g.me || { now: -1, score: 0, streak: 0, place: 0, last: 0 };
      if (me.now === 1) {
        mr.appendChild(el('div', 'sq-big ok sq-pop', 'Right! +' + me.last));
        if (me.streak >= 2) { var f = el('p', 'sq-note'); f.appendChild(el('span', 'sq-flame', sqStreakText(me.streak))); mr.appendChild(f); }
      } else {
        mr.appendChild(el('div', 'sq-big no sq-pop', me.now === 0 ? 'Not this time' : 'No answer'));
        mr.appendChild(el('p', 'sq-note', 'The answer is ' + sqAnswerText(t) + '.' + (me.now === 0 && g.mine != null ? ' You answered ' + g.mine + '.' : '')));
      }
      if (t.model) mr.appendChild(el('p', 'sq-note', t.model));
      mr.appendChild(sqMine(me));
      mr.appendChild(el('p', 'sq-note', 'Look at the board for the next question.'));
      box.appendChild(mr);
      return;
    }
    if (g.phase === 'end' && !g.result && !(g.me && g.me.place)) {
      sqHead(box, '');
      var m4 = el('div', 'sq-main');
      m4.appendChild(el('div', 'sq-big', 'The game has ended'));
      m4.appendChild(el('p', 'sq-note', 'You did not answer any questions in this game, so there is no score.'));
      var c4 = el('button', 'sq-go', 'Back to the slides'); c4.type = 'button';
      c4.addEventListener('click', function () { writeJ(SQ_SEEN, g.gid + ':end'); sqClose(); });
      var r4 = el('div', 'sq-row'); r4.appendChild(c4); m4.appendChild(r4);
      box.appendChild(m4);
      return;
    }
    if (g.phase === 'end') {
      sqHead(box, '');
      var me2 = g.me || { score: 0, place: 0, right: 0, of: 0 }, res = g.result, me3 = el('div', 'sq-main');
      me3.appendChild(el('div', 'sq-big sq-pop', 'Final score ' + (res ? res.score : me2.score)));
      var stats = el('div', 'sq-stats');
      var stat = function (b, s) { var x = el('div', 'sq-stat'); x.appendChild(el('b', '', b)); x.appendChild(el('span', '', s)); stats.appendChild(x); };
      if (res) { stat(res.right + ' / ' + res.of, 'right'); stat(sqPlace(res.place), 'place'); }
      else if (me2.place) stat(sqPlace(me2.place), 'place');
      if (res && res.hub > 0) stat('+' + res.hub, 'Worksheet Hub points');
      me3.appendChild(stats);
      var line = !res ? 'The game has ended.'
        : res.had ? 'You already have the points for this chapter check, so this game was for the score only.'
          : res.later ? 'Your teacher will add your Worksheet Hub points.'
            : res.hub > 0 ? 'Your points are in the Worksheet Hub. Spend them in the shop and the night market.'
              : 'No right answers this time, so no points. Go back over the chapter, then practise the check.';
      me3.appendChild(el('p', 'sq-note', line));
      var close = el('button', 'sq-go', 'Back to the slides'); close.type = 'button';
      close.addEventListener('click', function () { writeJ(SQ_SEEN, g.gid + ':end'); sqClose(); loadReview(true).then(null, function () {}); });
      var r1 = el('div', 'sq-row'); r1.appendChild(close); me3.appendChild(r1);
      box.appendChild(me3);
      return;
    }
    sqClose();
  }
  function sqMine(me) {
    var s = el('div', 'sq-stats');
    var a = el('div', 'sq-stat'); a.appendChild(el('b', '', String(me.score))); a.appendChild(el('span', '', 'your score')); s.appendChild(a);
    if (me.place) { var b = el('div', 'sq-stat'); b.appendChild(el('b', '', sqPlace(me.place))); b.appendChild(el('span', '', 'of ' + (me.of || '') + ' players')); s.appendChild(b); }
    return s;
  }
  /* The choices as coloured tiles, in the deck's own order, so A is A on every iPad and on the board. */
  function sqTiles(t, chosen, pick, done) {
    var box = el('div', 'sq-opts' + (chosen ? ' picked' : ''));
    (t.options || []).forEach(function (o, i) {
      var b = el('button', 'sq-opt' + (String(o) === String(chosen) ? ' on' : ''));
      b.type = 'button';
      b.style.setProperty('background', SQ_COLOURS[i % SQ_COLOURS.length], 'important');
      b.appendChild(el('b', '', SQ_LETTERS.charAt(i)));
      b.appendChild(el('span', '', o));
      b.disabled = !!done || !pick;
      if (pick) b.addEventListener('click', function () { pick(String(o), b); });
      box.appendChild(b);
    });
    return box;
  }

  /* ----- the projector ----- */
  var sqLaunch = null, sqState = null, sqPoll = null, sqBusy = false, sqSecs = 60, sqAuto = '', sqView = '';
  function sqCall(op, extra) {
    var body = { api: 'sq', op: op, pin: presPin, topicId: cfg.topicId, cls: presCls };
    Object.keys(extra || {}).forEach(function (k) { body[k] = extra[k]; });
    return api(body).then(function (r) {
      if (r && r.ok === false && /PIN|sign-in/i.test(r.error || '')) { var e = new Error('PIN'); e.pin = true; throw e; }
      if (r && r.ok === false && /Unknown request/.test(r.error || '')) throw new Error('The Streak Challenge needs the new Live Board code. Paste Code.gs and App.gs from the update, then try again.');
      if (!r || r.ok === false) throw new Error((r && r.error) || 'Live Board did not answer.');
      return r;
    });
  }
  var sqResumed = '';
  function sqWatchPresenter() {
    var on = presenting && presCls && sqQs().length > 0;
    if (on && sqResumed !== presCls && !sqOn) {
      sqResumed = presCls;   // the page was reloaded during a game: carry on with it
      sqCall('state').then(function (r) { if (r.game && r.game.phase !== 'end' && !sqOn) sqPresenter(false, r); }, function () {});
    }
    var sl = on ? currentSlide() : null;
    var show = !!(sl && isCheckSlide(sl)) && !sqOn;
    if (show && !sqLaunch) {
      sqStyle();
      sqLaunch = el('button', 'sq-launch');
      sqLaunch.type = 'button';
      sqLaunch.appendChild(el('i'));
      sqLaunch.appendChild(document.createTextNode('Play the chapter check as a Streak Challenge'));
      sqLaunch.addEventListener('click', function () { sqPresenter(true); });
      document.body.appendChild(sqLaunch);
      // A game already running for this class (the page was reloaded): pick it up.
      sqCall('state').then(function (r) { if (r.game && r.game.phase !== 'end') sqPresenter(false, r); }, function () {});
    } else if (!show && sqLaunch) { sqLaunch.remove(); sqLaunch = null; }
  }
  setInterval(sqWatchPresenter, 900);
  setInterval(function () { if (sqOn && !presenting) sqTickNow(); }, 500);
  function sqPresenter(fresh, r) {
    sqOpen();
    if (sqLaunch) { sqLaunch.remove(); sqLaunch = null; }
    clearInterval(sqPoll);
    sqPoll = setInterval(sqRefresh, 2000);
    clearInterval(sqTick); sqTick = setInterval(function () { sqTickNow(); sqAutoReveal(); }, 500);
    if (r) { sqShow(r); return; }
    if (fresh) {
      sqCall('state').then(function (r2) { if (r2.game && r2.game.phase !== 'end') sqShow(r2); else sqSetup(); }, function () { sqSetup(); });
      return;
    }
    sqRefresh();
  }
  function sqStopPresenter() { clearInterval(sqPoll); sqPoll = null; sqClose(); sqState = null; sqView = ''; }
  function sqRefresh() {
    if (!sqOn || sqBusy || !sqState) return;
    sqCall('state').then(function (r) { if (!sqBusy) sqShow(r); }, function () {});
  }
  function sqDo(op, extra) {
    if (sqBusy) return;
    sqBusy = true;
    var b = sqBox && sqBox.querySelectorAll('button');
    if (b) Array.prototype.forEach.call(b, function (x) { x.disabled = true; });
    sqCall(op, extra).then(function (r) { sqBusy = false; if (op === 'stop') { sqStopPresenter(); return; } sqShow(r); }, function (err) {
      sqBusy = false;
      if (err && err.pin) { presAuthLost(); return; }
      sqMsg = err.message; sqView = '';
      if (sqState) sqShow(sqState); else sqSetup();
    });
  }
  function sqSetup() {
    sqState = null; sqView = 'setup';
    var box = sqOpen(); box.innerHTML = '';
    sqHead(box, presCls);
    var main = el('div', 'sq-main'), qs = sqQs();
    main.appendChild(el('div', 'sq-big', 'Chapter check: ' + qs.length + ' questions'));
    sqRules(main);
    var c = el('div', 'sq-card');
    c.appendChild(el('h3', '', 'Time for each question'));
    var pick = el('div', 'sq-pick');
    [30, 45, 60, 90, 120].forEach(function (s) {
      var b = el('button', s === sqSecs ? 'on' : '', s < 60 ? s + ' seconds' : s === 60 ? '1 minute' : (s / 60) + ' minutes'); b.type = 'button';
      b.addEventListener('click', function () { sqSecs = s; Array.prototype.forEach.call(pick.children, function (x) { x.classList.toggle('on', x === b); }); });
      pick.appendChild(b);
    });
    c.appendChild(pick);
    c.appendChild(el('p', 'sq-note', 'You can show the answer early once everyone has answered.'));
    main.appendChild(c);
    var row = el('div', 'sq-row');
    var go = el('button', 'sq-go', 'Start the game'); go.type = 'button';
    go.addEventListener('click', function () {
      sqMsg = '';
      sqDo('start', { qs: qs, kinds: qs.map(function (id) { return byId[id].kind; }), secs: sqSecs });
    });
    row.appendChild(go);
    var no = el('button', 'sq-go alt', 'Not now'); no.type = 'button';
    no.addEventListener('click', sqStopPresenter);
    row.appendChild(no);
    main.appendChild(row);
    main.appendChild(el('p', 'sq-msg', sqMsg));
    box.appendChild(main);
  }
  function sqAutoReveal() {
    var g = sqState && sqState.game;
    if (!g || g.phase !== 'q' || sqBusy) return;
    var key = g.gid + ':' + g.qi;
    if (sqAuto !== key && sqLeft(g.ends) <= 0) { sqAuto = key; sqDo('reveal'); }
  }
  function sqShow(r) {
    var g = r && r.game;
    if (!g) { if (sqView !== 'setup') sqSetup(); return; }
    if (r.now) sqSkew = r.now - Date.now();
    sqState = r;
    var t = g.task ? byId[g.task] : null;
    var view = [g.gid, g.phase, g.qi, g.phase === 'q' ? r.answered : JSON.stringify([r.joined, r.top, r.tally, r.done])].join('|');
    if (view === sqView) return;
    // In the lobby only the number in changes: update it in place.
    if (g.phase === 'lobby' && sqView.split('|').slice(0, 2).join('|') === [g.gid, 'lobby'].join('|') && sqBox && sqBox.querySelector('.sq-joined')) {
      sqView = view; sqBox.querySelector('.sq-joined').textContent = String(r.joined || 0); return;
    }
    // During a question only the count changes: update it in place.
    if (g.phase === 'q' && sqView.split('|').slice(0, 3).join('|') === [g.gid, g.phase, g.qi].join('|') && sqBox) {
      sqView = view; sqCount(r); return;
    }
    sqView = view;
    var box = sqOpen(); box.innerHTML = '';
    var main = el('div', 'sq-main');
    var stop = el('button', 'sq-go alt', 'Stop the game (no points)'); stop.type = 'button';
    stop.addEventListener('click', function () { if (window.confirm('Stop the game? Nobody gets points from it.')) sqDo('stop'); });
    if (g.phase === 'lobby') {
      sqHead(box, presCls);
      main.appendChild(el('div', 'sq-big sq-pop', 'Join on your iPad'));
      main.appendChild(el('p', 'sq-note', 'The game is on the iPads of everyone in this lesson. Stay on the slides.'));
      var st = el('div', 'sq-stats'), s1 = el('div', 'sq-stat');
      s1.appendChild(el('b', 'sq-joined', String(r.joined || 0))); s1.appendChild(el('span', '', 'of ' + (r.classSize || 0) + ' are in'));
      st.appendChild(s1); main.appendChild(st);
      sqRules(main);
      var row = el('div', 'sq-row sq-act'), go = el('button', 'sq-go', 'First question'); go.type = 'button';
      go.addEventListener('click', function () { sqDo('next'); });
      row.appendChild(go); row.appendChild(stop); main.appendChild(row);
    } else if (g.phase === 'q' && t) {
      sqHead(box, 'Question ' + (g.qi + 1) + ' of ' + g.n, g.ends);
      main.appendChild(el('div', 'sq-q', t.question));
      if (t.kind === 'choice') main.appendChild(sqTiles(t, '', null, true));
      else main.appendChild(el('p', 'sq-note', 'Type your answer on your iPad' + (t.unit ? ', in ' + t.unit : '') + '.'));
      var meter = el('div', 'sq-card');
      meter.appendChild(el('h3', 'sq-answered', ''));
      var bar = el('div', 'sq-meter'); bar.appendChild(el('i', 'sq-fill')); meter.appendChild(bar);
      main.appendChild(meter);
      var row2 = el('div', 'sq-row sq-act'), rv = el('button', 'sq-go', 'Show the answer'); rv.type = 'button';
      rv.addEventListener('click', function () { sqAuto = g.gid + ':' + g.qi; sqDo('reveal'); });
      row2.appendChild(rv); row2.appendChild(stop); main.appendChild(row2);
      box.appendChild(main);
      sqCount(r);
      main.appendChild(el('p', 'sq-msg', sqMsg)); sqMsg = '';
      return;
    } else if (g.phase === 'reveal' && t) {
      sqHead(box, 'Question ' + (g.qi + 1) + ' of ' + g.n);
      main.appendChild(el('div', 'sq-q', t.question));
      var total = r.answered || 0;
      if (t.kind === 'choice') {
        var tiles = sqTiles(t, '', null, true);
        tiles.classList.add('shown');
        Array.prototype.forEach.call(tiles.children, function (b, i) {
          var o = String(t.options[i]);
          if (o === String(t.correct)) b.classList.add('right');
          b.appendChild(el('em', '', String((r.tally || {})[o] || 0)));
        });
        main.appendChild(tiles);
      } else {
        main.appendChild(el('div', 'sq-big ok', sqAnswerText(t)));
      }
      main.appendChild(el('p', 'sq-note', (r.right || 0) + ' of ' + total + ' got it right.' + (t.model ? ' ' + t.model : '')));
      main.appendChild(sqBoard(r));
      var last = g.qi + 1 >= g.n;
      var row3 = el('div', 'sq-row sq-act'), nx = el('button', 'sq-go', last ? 'Finish and give the points' : 'Next question'); nx.type = 'button';
      nx.addEventListener('click', function () { sqDo(last ? 'end' : 'next'); });
      row3.appendChild(nx);
      if (!last) { var en = el('button', 'sq-go alt', 'End the game here and give the points'); en.type = 'button'; en.addEventListener('click', function () { if (window.confirm('End the game now? Points are given for the questions played so far.')) sqDo('end'); }); row3.appendChild(en); }
      main.appendChild(row3);
    } else if (g.phase === 'end') {
      sqHead(box, presCls);
      main.appendChild(el('div', 'sq-big sq-pop', 'Final results'));
      main.appendChild(sqBoard(r, true));
      var d = r.done || {};
      var parts = [];
      if (d.given) parts.push('Worksheet Hub points were added for ' + d.given + (d.given === 1 ? ' student.' : ' students.'));
      if (d.had) parts.push(d.had + (d.had === 1 ? ' student already had' : ' students already had') + ' the points for this chapter check.');
      if (d.note) parts.push(d.note);
      if (!parts.length) parts.push(d.players ? 'No points were due.' : 'Nobody answered, so no points were given.');
      main.appendChild(el('p', 'sq-note', parts.join(' ')));
      var row4 = el('div', 'sq-row sq-act'), cl = el('button', 'sq-go', 'Back to the slides'); cl.type = 'button';
      cl.addEventListener('click', sqStopPresenter);
      row4.appendChild(cl); main.appendChild(row4);
    } else { sqSetup(); return; }
    main.appendChild(el('p', 'sq-msg', sqMsg)); sqMsg = '';
    box.appendChild(main);
  }
  function sqCount(r) {
    if (!sqBox) return;
    var n = r.answered || 0, of = Math.max(r.joined || 0, n);
    var h = sqBox.querySelector('.sq-answered'), f = sqBox.querySelector('.sq-fill');
    if (h) h.textContent = n + ' of ' + of + ' have answered' + (of && n >= of ? '. Everyone is in, so you can show the answer.' : '');
    if (f) f.style.setProperty('width', (of ? Math.round(100 * n / of) : 0) + '%', 'important');
  }
  /* Version 15 (Ruling A2): the projector never shows a name. Each player is their initials on a disc in two
     colours from their avatar (c1 fills it, c2 rings it). */
  function sqDisc(x) {
    var d = el('span', 'sq-disc', String(x.initials || '?').slice(0, 3));
    var c1 = /^#[0-9a-f]{3,8}$/i.test(String(x.c1 || '')) ? x.c1 : '#5b4bd6', c2 = /^#[0-9a-f]{3,8}$/i.test(String(x.c2 || '')) ? x.c2 : '#ffd75e';
    d.style.setProperty('background', c1, 'important');
    d.style.setProperty('box-shadow', '0 0 0 4px ' + c2, 'important');
    return d;
  }
  function sqBoard(r, final) {
    var wrap = el('div', 'sq-board');
    var c1 = el('div', 'sq-card');
    c1.appendChild(el('h3', '', final ? 'Top 5' : 'Top 5 so far'));
    var ol = el('ol', 'sq-top5');
    (r.top || []).forEach(function (x) {
      var li = el('li');
      li.appendChild(el('b', '', sqPlace(x.place)));
      li.appendChild(sqDisc(x));
      if (x.streak >= 2 && !final) li.appendChild(el('span', 'sq-flame', sqStreakText(x.streak)));
      li.appendChild(el('em', '', String(x.score)));
      ol.appendChild(li);
    });
    if (!(r.top || []).length) ol.appendChild(el('li', '', 'No scores yet.'));
    c1.appendChild(ol);
    wrap.appendChild(c1);
    var c2 = el('div', 'sq-card');
    c2.appendChild(el('h3', '', final ? 'Best streak' : 'Longest streaks now'));
    if (final) c2.appendChild(el('div', 'sq-big', r.best ? r.best + ' in a row' : 'None'));
    else if ((r.streaks || []).length) {
      var ul = el('ol', 'sq-top5');
      r.streaks.forEach(function (x) { var li = el('li'); li.appendChild(sqDisc(x)); li.appendChild(el('span', 'sq-gap')); li.appendChild(el('span', 'sq-flame', sqStreakText(x.streak))); ul.appendChild(li); });
      c2.appendChild(ul);
    } else c2.appendChild(el('p', 'sq-note', 'No streaks yet. Two right in a row starts one.'));
    wrap.appendChild(c2);
    return wrap;
  }

  function start() {
    if (presentMode) { startPresenter(); return; }
    addReviseCard();
    var id = readJ(ID_KEY), handed = fromLink();
    if (!id) writeJ(RESET_KEY, null);
    if (handed && handed.st) {
      if (!id || !id.st || id.st !== handed.st) {
        // Version 15: a sign-in handed over by the app. It is checked, then kept, with no box to fill in. A different
        // student signed in on the app takes over this iPad (the deck sends the last student's answers first).
        api({ api: 'st', op: 'me', st: handed.st }).then(function (r) {
          if (r && r.ok && r.cls && r.name) { lockIn({ cls: r.cls, name: r.name, st: handed.st }); return; }
          if (id && id.st) go(id);
          else { showWho(null); openGate('Your sign-in has run out. Sign in again with your password.', { cls: handed.cls, name: handed.name }); }
        }).catch(function () {
          if (id && id.st) go(id);
          else if (handed.cls && handed.name) lockIn(handed);
          else { showWho(null); openGate('', {}); }
        });
        return;
      }
    }
    if (id && id.cls && id.name && (id.st || oldLb())) { if (!id.st) mode = 'live'; go(id); return; }
    // A name kept on this iPad before passwords: that student signs in once with their password.
    showWho(null);
    openGate('', id && id.cls ? { cls: id.cls, name: id.name } : {});
  }
  start();
})();