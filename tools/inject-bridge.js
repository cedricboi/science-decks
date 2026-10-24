#!/usr/bin/env node
/* Puts the one canonical Live Board bridge (kit/liveboard-bridge.v15.js) into every deck.

   Usage:  node tools/inject-bridge.js            replace the bridge in every deck, print a report
           node tools/inject-bridge.js --check    change nothing; exit 1 if any deck is not on the canonical bridge
           node tools/inject-bridge.js Phy1.html  only the named decks

   Which decks: every deck listed in lessons.json (kind "deck"), and any Phy*.html or Ch*.html at the root that has a
   bridge block. A deck must hold exactly one <script id="liveboard-bridge"> block: a deck with none, or with more than
   one, is refused and left as it is. Two kinds of deck file are handled:
     plain    the block sits in the HTML:            <script id="liveboard-bridge"> ... </script>
     bundled  the page is a JSON string inside <script type="__bundler/template">, where the block is
              <script id=\"liveboard-bridge\"> ... </script>, escaped the way the bundler escapes it.
   Only the bytes between the block's opening tag and its closing tag change. Running it twice changes nothing. */
'use strict';
var fs = require('fs');
var path = require('path');

var ROOT = path.resolve(__dirname, '..');
var KIT = path.join(ROOT, 'kit', 'liveboard-bridge.v15.js');
var args = process.argv.slice(2);
var CHECK = args.indexOf('--check') >= 0;
var only = args.filter(function (a) { return !/^--/.test(a); });

var OPEN = '<script id="liveboard-bridge">', CLOSE = '</script>';
var OPEN_J = '<script id=\\"liveboard-bridge\\">', CLOSE_J = '<\\u002Fscript>';
var TPL = '<script type="__bundler/template">';

function fail(msg) { console.error('inject-bridge: ' + msg); process.exit(2); }

var bridge = fs.readFileSync(KIT, 'utf8');
if (/<\/script/i.test(bridge)) fail('the bridge contains "</script", which would end its script block early.');
if (/<!--/.test(bridge)) fail('the bridge contains "<!--", which changes how browsers read a script block.');
var vm = /var VERSION = (\d+);/.exec(bridge);
if (!vm) fail('no "var VERSION = n;" in ' + KIT);
var NEW_V = Number(vm[1]);
// The bridge as it must appear inside a bundled deck's JSON template string.
var bridgeJ = JSON.stringify(bridge).slice(1, -1).replace(/<\//g, '<\\u002F').replace(/<!--/g, '<\\u0021--');

function count(hay, needle, from, to) {
  var n = 0, i = from || 0, end = to == null ? hay.length : to;
  for (;;) { i = hay.indexOf(needle, i); if (i < 0 || i >= end) return n; n++; i += needle.length; }
}
function versionOf(code) { var m = /var VERSION = (\d+);/.exec(code); return m ? Number(m[1]) : null; }

/* The decks: lessons.json first, then the Phy* and Ch* files at the root that carry a bridge. */
function deckList() {
  var listed = [];
  try {
    var cat = JSON.parse(fs.readFileSync(path.join(ROOT, 'lessons.json'), 'utf8'));
    (cat.subjects || []).forEach(function (s) { (s.groups || []).forEach(function (g) { (g.items || []).forEach(function (it) {
      if (it && it.kind === 'deck' && it.file && listed.indexOf(it.file) < 0) listed.push(it.file);
    }); }); });
  } catch (e) { fail('lessons.json could not be read: ' + e.message); }
  var extra = fs.readdirSync(ROOT).filter(function (f) {
    if (!/^(Phy|Ch).*\.html$/.test(f) || listed.indexOf(f) >= 0) return false;
    var t = fs.readFileSync(path.join(ROOT, f), 'utf8');
    return t.indexOf(OPEN) >= 0 || t.indexOf(OPEN_J) >= 0;
  });
  return { listed: listed, all: listed.concat(extra.sort()) };
}

function inject(file) {
  var full = path.join(ROOT, file);
  if (!fs.existsSync(full)) return { file: file, status: 'refused', why: 'file not found' };
  var html = fs.readFileSync(full, 'utf8');
  var t = html.indexOf(TPL), tEnd = t >= 0 ? html.indexOf(CLOSE, t + TPL.length) : -1;
  var plainN = count(html, OPEN), bundN = t >= 0 && tEnd > t ? count(html, OPEN_J, t, tEnd) : 0;
  // A plain block inside the template region cannot occur (the template escapes its quotes), so the counts add up.
  if (plainN + bundN === 0) return { file: file, status: 'refused', why: 'no bridge block' };
  if (plainN + bundN > 1) return { file: file, status: 'refused', why: (plainN + bundN) + ' bridge blocks' };
  var out, oldCode, kind;
  if (plainN === 1) {
    kind = 'plain';
    var a = html.indexOf(OPEN) + OPEN.length, b = html.indexOf(CLOSE, a);
    if (b < 0) return { file: file, status: 'refused', why: 'the bridge block has no closing tag' };
    oldCode = html.slice(a, b);
    out = html.slice(0, a) + bridge + html.slice(b);
  } else {
    kind = 'bundled';
    var aj = html.indexOf(OPEN_J, t) + OPEN_J.length, bj = html.indexOf(CLOSE_J, aj);
    if (bj < 0 || bj > tEnd) return { file: file, status: 'refused', why: 'the bundled bridge block has no closing tag' };
    try { oldCode = JSON.parse('"' + html.slice(aj, bj) + '"'); } catch (e) { oldCode = ''; }
    out = html.slice(0, aj) + bridgeJ + html.slice(bj);
    // The template must still be one valid JSON string, holding exactly the canonical bridge.
    var t2 = out.indexOf(TPL), e2 = out.indexOf(CLOSE, t2 + TPL.length);
    var page;
    try { page = JSON.parse(out.slice(t2 + TPL.length, e2).trim()); } catch (e) { return { file: file, status: 'refused', why: 'the template would not be valid JSON: ' + e.message }; }
    var p0 = page.indexOf(OPEN) + OPEN.length, p1 = page.indexOf(CLOSE, p0);
    if (count(page, OPEN) !== 1 || page.slice(p0, p1) !== bridge) return { file: file, status: 'refused', why: 'the bundled bridge did not read back the same' };
  }
  var res = { file: file, kind: kind, from: versionOf(oldCode), to: NEW_V, bytes: out.length - html.length };
  if (out === html) { res.status = 'unchanged'; return res; }
  res.status = CHECK ? 'outdated' : 'replaced';
  if (!CHECK) fs.writeFileSync(full, out, 'utf8');
  return res;
}

var decks = deckList();
var files = only.length ? only : decks.all;
var rows = files.map(inject);
var bad = 0;
console.log('Live Board bridge v' + NEW_V + ' from ' + path.relative(ROOT, KIT) + (CHECK ? ' (check only, nothing written)' : ''));
rows.forEach(function (r) {
  var line = '  ' + (r.file + '                    ').slice(0, 20) + ' ' + (r.status + '          ').slice(0, 10);
  if (r.status === 'refused') { bad++; line += ' ' + r.why; }
  else {
    line += ' ' + r.kind + ', v' + (r.from == null ? '?' : r.from) + ' to v' + r.to;
    if (r.status !== 'unchanged') line += ' (' + (r.bytes >= 0 ? '+' : '') + r.bytes + ' characters)';
    if (r.status === 'outdated') bad++;
  }
  if (decks.listed.indexOf(r.file) < 0 && !only.length) line += ' [not in lessons.json]';
  console.log(line);
});
var tally = {};
rows.forEach(function (r) { tally[r.status] = (tally[r.status] || 0) + 1; });
console.log(Object.keys(tally).map(function (k) { return tally[k] + ' ' + k; }).join(', ') + '.');
process.exit(bad ? 1 : 0);
