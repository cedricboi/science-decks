# Chapter 10 interactive textbook: progress in the Teacher Hub (release 47)

The Chapter 10 Networking Interactive Textbook (`10.B` in `computing.json`, kind `book`) is one offline HTML file
that students open from the Computing page, like a Coach. Instead of saving Excel files, it sends each finished
activity to the hub, so the Teacher Hub can show who is done, who is stuck and who has not started.

## What changed

- `app/ComputingCode.gs`: a `Computing progress` tab (one row per student per activity, best score kept and the
  number of tries), the student ops `progress` (a batch of saves) and `progressOf` (restore on a new device), and
  `api_t_cmpBook(class, id)` for the teacher's grid. `cmpSetup` now makes this tab too.
- `app/App.gs`: `APP_BUILD` and `APP_SEQ` 47.
- `app/HubTeacher.html`: opening a book shows the book grid, by section or by activity (Details), with Finished,
  Working on it, Stuck and Not started, Remind, Refresh and Reset PIN as before.
- `app/Computing.html`: a book opens like a Coach, with no task files.
- `computing.json`: the `10.B` entry with its sections and 72 activities (scene missions, flip cards, quick
  checks, sorters and the boss game best score).

## What the textbook sends

`POST <exec URL>` with `Content-Type: text/plain` and a JSON body `{ api: 'cmp', op: 'progress', ct, items }`,
each item `{ id, kind, score, of, at }`. Kinds: `mission`, `flip`, `mcq`, `tf`, `dnd`, `order`, `game`, `builder`.
Saves queue in the browser while offline or signed out and flush in batches of 60.

## To turn it on

1. Paste `app/App.gs` and `app/ComputingCode.gs` into the Apps Script project and deploy a new version.
2. Put `Chapter 10 Networking Interactive Textbook.html` in Drive, in Worksheet Hub > Computing > Coaches and task files.
3. In the Teacher Hub's Computing tab, open `10.B` to each class.

Until the server code is pasted, the pages stay on release 46, students can still open the book from the Computing
page once it is in Drive, and their saves wait in the browser and send once the new code is live.
