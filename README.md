# Client Status

A private, view-only project status page for a client. You update a Google Sheet; the client opens a secret link and sees progress, tasks and updates.

```
Google Sheet (you edit)  →  Apps Script API (checks secret key)  →  this page on GitHub Pages
```

- Preview with sample data: `https://rinshidvp.github.io/client-status/?demo=1`
- The sheet stays private. Data is only returned when the link's key is correct.
- Page text is rendered as plain text, is hidden from search engines and auto-refreshes every 5 minutes.

## One-time setup (about 10 minutes)

### 1. Create the sheet and script
1. Create a new Google Sheet, e.g. "Client Status – <client name>".
2. Open **Extensions → Apps Script**, delete the sample code, paste all of [`apps-script/Code.gs`](apps-script/Code.gs) and click **Save**.
3. Select `setupSheet` in the function dropdown and click **Run**. Allow the permissions when asked (it's your own script).
   It creates the **Project**, **Tasks** and **Updates** tabs with dropdowns and sample rows, plus a secret key. Delete the empty default `Sheet1` tab if you like.

### 2. Deploy the API
1. In Apps Script, click **Deploy → New deployment**, then the gear icon → **Web app**.
2. Set **Execute as: Me** and **Who has access: Anyone**, then **Deploy**.
3. Copy the **Web app URL** (it ends in `/exec`).

"Anyone" is needed so the page can call it, but without the secret key the API only returns `unauthorized`.

### 3. Connect the page
Edit [`config.js`](config.js) on GitHub (pencil icon), paste the URL into `API_URL`, and commit:

```js
API_URL: "https://script.google.com/macros/s/XXXX/exec",
```

### 4. Send the client their link
Reload the sheet. A **Client Status** menu appears. Use **Client Status → Show client link** and send that link to the client:

```
https://rinshidvp.github.io/client-status/?k=<secret key>
```

## Daily use
Just edit the sheet:

| Tab | What to do |
|---|---|
| **Project** | Name, client, start date, deadline, status (On track / At risk / Delayed / On hold / Completed), short summary |
| **Tasks** | One row per task. Status dropdown: To do, In progress, Waiting for client, Blocked, Done. The note column is visible to the client. |
| **Updates** | Add a row with date + message whenever there's news. Newest is shown first. |

Overall progress is calculated automatically (done tasks ÷ all tasks). The client sees changes on their next refresh.

**If the link leaks:** run **Client Status → Make new link**. The old link stops working immediately; send the new one.

**If you change `Code.gs` later:** use **Deploy → Manage deployments → Edit → Version: New version** so the URL stays the same.

## Development

```bash
npm install
npm start              # http://localhost:4173/?demo=1
npm test               # logic + Apps Script API tests
npm run test:e2e       # browser tests (desktop + mobile)
```

Files: `index.html` / `styles.css` / `app.js` (page), `lib.js` (pure helpers), `config.js` (settings), `demo-data.js` (sample data), `apps-script/Code.gs` (sheet API).
