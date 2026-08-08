# Science decks — cedricboi

Interactive lesson decks for Lower Secondary Science.
Live at **https://cedricboi.github.io/science-decks/**

---

## First-time publishing (about two minutes)

1. Go to **https://github.com/new**
   - Repository name: `science-decks`
   - **Public** — GitHub Pages needs a public repo on a free account
   - Do **not** tick "Add a README" (this folder already has one)
   - Click **Create repository**

2. On the new repo page click **uploading an existing file**
   (or **Add file > Upload files**).
   Drag in **the contents of this folder** — `index.html`, `README.md`,
   `.nojekyll`, and the `decks` folder. Not the folder itself, its contents.
   Click **Commit changes**.

3. **Settings** (top of repo) > **Pages** (left sidebar)
   - Source: **Deploy from a branch**
   - Branch: **main**, folder: **/ (root)**
   - **Save**

4. Wait about a minute, then open:

   | what | link |
   |---|---|
   | Lesson list | https://cedricboi.github.io/science-decks/ |
   | Chapter 7.1 | https://cedricboi.github.io/science-decks/decks/Ch7.1.html |
   | Chapter 7.2 | https://cedricboi.github.io/science-decks/decks/Ch7.2.html |
   | Chapter 7.3 | https://cedricboi.github.io/science-decks/decks/Ch7.3.html |

   (7.2 and 7.3 will 404 until you add those files — the pattern is fixed.)

Each deck is its own full-screen link. Give a class just the one they need.

---

## Adding a lesson later

1. Repo page > `decks` folder > **Add file > Upload files** > drag the new deck in.
2. Open `index.html` > pencil icon > copy the commented block, change the file
   name and title > **Commit changes**.

Same URL, no reconfiguring. Changes appear in under a minute.

---

## Two things that will bite you

- **Filenames are case-sensitive on Pages.** `decks/Ch7.1.html` and
  `decks/ch7.1.html` are different files. A link that works on your laptop can
  404 online. Keep the capital C.
- **Keep `.nojekyll`.** Without it GitHub runs Jekyll over the site and ignores
  anything starting with an underscore. It is an empty file and easy to lose
  when copying folders around.

---

## Short links for class

Once live, shorten each deck at **https://for.edu.sg** with your `.edu.sg`
account — e.g. `for.edu.sg/sci-7-1`. Easier to read off a board, and if you ever
move hosts the short link is the thing that does not change.

---

## Note on privacy

This repo is public, so the decks and the response-collector URL inside them are
readable by anyone. That URL can only *add* rows to your Google Sheet, never
read it — the worst case is junk rows. Fine for classwork; do not put anything
graded behind it.
