# science-decks

Lower Secondary Science and Physics lesson decks, served as a website from this repository.

**Live site:** https://cedricboi.github.io/science-decks/

Students open lessons from **learnwithmrcedric** (Live Board) on the Google Site. This site's own index page is a backup that lists the same lessons.

## What is in here

| File | What it is |
|---|---|
| `lessons.json` | the list of lessons: subject tabs, chapters, numbers and titles. The index page, Live Board and learnwithmrcedric all read it |
| `index.html` | the backup lesson page. It builds itself from `lessons.json`, so it never needs editing |
| `Ch….html`, `Phy….html` | one deck per file |
| `…StudyBuddy.html` | study tools |
| `.nojekyll` | stops GitHub processing the files and breaking them |

Every deck is one self-contained file. Fonts, images and diagrams are embedded, so a deck keeps working if the school wifi drops mid-lesson.

## Adding or updating a lesson

Use **one** of these. Both put the deck online, connect it to Live Board, and add it to `lessons.json`, so it appears on the index page, in learnwithmrcedric and in Live Board's Start lesson list.

1. **Live Board > Lessons > Add or update a lesson.** Choose the HTML file on your laptop, check the subject, chapter and title, press **Put it online**.
2. **Ask Claude.** Decks built with deckforge are published by Claude at the end of the build.

GitHub takes about a minute to show a new file. To update a lesson, add it again with the same file name.

Uploading by hand on GitHub still works, but then the lesson is not added to `lessons.json` and not connected to Live Board.

## Where student answers go

Decks with **Live Board** in their saving block send answers to the Live Board web app named in `lessons.json` (`liveboard`). The older decks (Chapters 7, 8, 9, 16 and Physics 9) send written answers to the older Apps Script set on their `<body data-collect-url="…">`.
