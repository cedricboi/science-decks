# science-decks

Lower Secondary Science lesson decks, served as a website from this repository.

**Live site:** https://cedricboi.github.io/science-decks/

## What is in here

| File | What it is |
|---|---|
| `index.html` | the hub page students land on — links every deck |
| `Ch7.1.html` | Chapter 7.1 deck (already in the repo) |
| `Ch16.1.html` – `Ch16.4.html` | Chapter 16 decks, one per subsection |
| `.nojekyll` | stops GitHub processing the files and breaking them |
| `download/` | whatever you had here before — untouched |

Every deck is one self-contained file. Fonts, images and diagrams are embedded,
so a deck keeps working if the school wifi drops mid-lesson. Two things reach
the network and both fail softly: the YouTube embeds (each has a visible link
beside it) and the Submit button on written answers (the answer stays in the
box and a Copy button appears).

## Uploading a new chapter

1. **Add file → Upload files** on the repo's Code tab
2. Drag the deck files in, and `index.html` if the hub changed
3. Commit to `main`
4. Wait about a minute, then hard-refresh the live site

Keep files flat at the root. GitHub's web uploader flattens dropped folders, so
a deck linked as `decks/Ch16.1.html` will 404 while the file itself sits at the
root.

## Adding a lesson to the hub by hand

Open `index.html`, copy one `<a class="deck">` block, and change the three
things in it: the `href`, the number in `<span class="num">`, and the title.

## Where student answers go

Each deck posts written answers to the Google Apps Script endpoint set on its
`<body data-collect-url="…">`, along with the student's name, class, subsection
and question id. If submissions stop arriving, re-deploy the Apps Script and
re-authorise it — the deck will report `Could not send` and offer students a
Copy button rather than losing their work.
