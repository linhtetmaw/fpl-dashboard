# Premier League / FPL API exploration: fantasy news, scout, feeds

Summary of what exists in the **official APIs** and what does **not**, for fantasy-related news, scout selections, and similar content.

---

## 1. Fantasy Premier League API (`fantasy.premierleague.com/api/`)

### What the FPL API **does** provide

- **Player news (injuries, suspensions, updates)**  
  In **`bootstrap-static/`**, each item in `elements` (players) can have:
  - `news` – short text (e.g. "Has joined Werder Bremen on loan...", "Expected back 15 March")
  - `news_added` – ISO timestamp when the update was added
  - `status` – `'a'` (available), `'d'` (doubtful), `'i'` (injured), `'s'` (suspended), `'u'` (update)
  - `chance_of_playing_next_round` / `chance_of_playing_this_round` – 0, 25, 50, 75, 100  

  **This app already uses this** in **Player News** (from `bootstrap.elements`), shown on the Player Stats page.

- **Gameweek / event metadata**  
  In **`bootstrap-static/`**, `events` includes things like:
  - `most_captained`, `most_vice_captained` (element ids)
  - `most_selected`, `most_transferred_in`
  - `top_element`, `top_element_info`
  - `chip_plays`, `average_entry_score`, `highest_score`, etc.  

  Useful for “most captained this GW” style content, but **not** a “scout picks” or article feed.

- **Other bootstrap data**  
  - `element_stats`, `element_types`, `teams`, `game_settings`, `phases`, `chips`  
  No news or scout-specific structures there.

### What the FPL API **does not** provide

- **No dedicated “news” or “articles” endpoint**  
  No `/api/news`, `/api/feed`, `/api/articles`, or similar that returns fantasy news or editorials.

- **No “Scout selections” or “best XI” feed**  
  Scout picks (e.g. “Best Fantasy team for Gameweek 37”) are published as **articles on the Premier League website**, not as a machine-readable feed in the FPL API.

- **No RSS/Atom**  
  The FPL API is JSON-only; there is no official RSS/Atom feed for news or scout.

---

## 2. Premier League website (`premierleague.com`)

- **Scout content**  
  “Scout Selection”, “The Scout’s differentials”, etc. appear as normal web articles, e.g.  
  `https://www.premierleague.com/news/...` or `.../en/news/4309433`.

- **No public API**  
  There is no documented, public JSON/RSS API for Premier League news or fantasy articles.  
  Third-party options (e.g. Football Feeds, Statorium, Goalserve) are separate services, not “Premier League API” feeds.

---

## 3. Summary table

| Content type              | Source              | In FPL API? | In this app              |
|---------------------------|---------------------|------------|---------------------------|
| Player injuries/updates   | FPL bootstrap       | Yes (`elements[].news`, `status`) | Yes (Player News on Player Stats) |
| Most captained / GW stats | FPL bootstrap       | Yes (`events[]`) | Partially (can be used for widgets) |
| Scout selections / best XI | Premier League site | No         | No (would need links or scraping) |
| General fantasy “news” feed | —                  | No         | No                        |

---

## 4. Recommendations

1. **Keep using FPL `bootstrap-static` for player news**  
   This is the only official fantasy “news” feed: injuries, suspensions, and short updates. The app already consumes it in **Player News**.

2. **Scout / “best team” content**  
   - **Option A:** Add links to Premier League Scout articles (e.g. “Scout Selection – Gameweek X” → `premierleague.com/...`) so users can open them; no API needed.  
   - **Option B:** Use a third-party API that aggregates Premier League/FPL news (if you have a key and terms of use allow it).  
   - **Option C:** Scrape premierleague.com (only if compliant with their terms and robots.txt).

3. **Enrich “Player News”**  
   You can add more from `bootstrap-static` in the same UI, e.g. “Most captained this GW”, “Most transferred in”, using `events[].most_captained`, `most_transferred_in`, and `elements` for names.

4. **Event-level stats**  
   `events[].chip_plays`, `average_entry_score`, `highest_score`, `top_element_info` are available for small “GW facts” or stats widgets if you want them.

---

## 5. References

- FPL API (community): [FPL APIs Explained – Oliver Looney](https://www.oliverlooney.com/blogs/FPL-APIs-Explained)
- FPL endpoint list / examples: [fpldev/fplserver (GitHub)](https://github.com/fpldev/fplserver)
- Scout articles (examples): [Scout Selection GW37](https://www.premierleague.com/en/news/4309433), [The Scout’s analysis](https://www.premierleague.com/en/news/4359297)
