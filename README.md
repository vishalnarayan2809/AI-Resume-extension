## AI Presume — Groq‑powered Resume Builder (Chrome MV3 Extension)
## Screenshots

Below are screenshots of the extension in action:

![Resume Preview](images/image1.png)
*Resume preview interface.*

![Options Page](images/image2.png)
*Options page for entering provider key and profile details.*



**Important Firefox Limitations:**
- Chrome MV3 service workers have limited Firefox support
- The extension may not work reliably in Firefox due to:
  - Different background script handling
  - Partial MV3 API compatibility
  - Storage API differences
- For best results, use Chrome/Chromium browsers

Firefox / Safari
- This project primarily targets Chrome Manifest V3. While Firefox has some MV3 support, full compatibility is not guaranteed due to service worker and API differences.ume is a privacy‑friendly, on‑device Chrome extension that tailors your resume to any job post using Groq’s Llama 3 model. It generates a one‑page, ATS‑optimized resume in your existing template and exports a selectable, clickable PDF.

### Highlights
- Groq‑only AI (no server) with retry/backoff for transient errors
- Keeps your HTML template and layout intact; rewrites only text
- One A4 page with strict text length control
- Export to PDF with selectable text and clickable links
- Works on Chromium browsers (Chrome, Edge, Brave, Opera, Vivaldi)

---

## Prerequisites
- Node.js 18+ and npm
- A Chromium‑based browser (Chrome recommended)
- A Groq API key

---

## Get a Groq API Key
1. Create an account at: https://console.groq.com/
2. Go to “API Keys” and click “Create API Key”.
3. Copy the key (it starts with gsk_…). Keep it safe.

Notes
- This project uses model: `llama3-70b-8192` via the Chat Completions API.
- Your key is stored locally in the browser using `chrome.storage.local` and never sent to any third‑party server by this extension.

---

## Install & Build
1. Install dependencies
	 - `npm install`
2. Build the extension
	 - `npm run build`
	 - This runs icon generation, builds with Vite, and prepares the unpacked extension in `dist/`.

Optional (development)
- `npm run dev` starts a Vite dev server for the React pages only. To test the extension, use `npm run build` and reload the extension in your browser after changes.

---

## Load the Unpacked Extension

After building, you’ll load `dist/` in your browser. Steps vary by browser:

Chrome (recommended)
1. Visit `chrome://extensions`
2. Enable “Developer mode” (top right)
3. Click “Load unpacked” and select the `dist/` folder
4. Pin the extension (optional) via the puzzle icon

Microsoft Edge
1. Visit `edge://extensions`
2. Toggle “Developer mode”
3. Click “Load unpacked” and select `dist/`

Brave
1. Visit `brave://extensions`
2. Enable “Developer mode”
3. Click “Load unpacked” and select `dist/`

Opera
1. Visit `opera://extensions`
2. Enable “Developer Mode”
3. Click “Load unpacked” and select `dist/`

Vivaldi
1. Visit `vivaldi://extensions`
2. Enable “Developer Mode”
3. Click “Load unpacked” and select `dist/`

Firefox / Safari
- This project targets Chrome Manifest V3 with a service worker. Firefox and Safari have different/limited MV3 support; loading as‑is is not supported.

---

## First‑Run Setup (Options)
1. Open the extension’s Options page:
	 - Chrome: `chrome://extensions` → AI Presume → Details → “Extension options”
	 - Or right‑click the extension icon → Options
2. Paste your Groq API key (gsk_…)
3. Save

Data entry
- Profile: Your summary, contact, and core info
- Previous Resume: Paste text or import PDF/DOCX/TXT (parsed locally)

---

## Usage
1. Open a job listing in a tab
2. Click the AI Presume icon
3. Click “Generate Resume”
	 - The extension scrapes the job description from the active tab
	 - Groq tailors your resume to fit one A4 page
4. Review the preview in the popup
5. Click “Export PDF” to download a selectable, clickable PDF

Tips
- Keep the job listing tab active/visible when generating for best extraction
- Edit your profile/previous resume in Options for better results

---

## Project Structure (Quick)
- `src/popup` — UI for preview and export
- `src/options` — Settings, profile, and API key storage
- `src/background.js` — Service worker; Groq calls, prompts, validation, retries
- `src/utils/pdf.js` — HTML → pdfmake docDefinition, export logic
- `public/manifest.json` — Chrome MV3 manifest

Build scripts
- `scripts/generate-icons.cjs` — Generates icons automatically
- `scripts/copy-extension-files.cjs` — Prepares MV3 assets into `dist/`

---

## Troubleshooting
- “No valid API key found”
	- Add a Groq key in Options and try again
- 401 Unauthorized
	- Invalid/expired key; create a new key in the Groq Console
- 429 Too Many Requests / 5xx from Groq
	- Built‑in retries/backoff will attempt recovery; try again after a short pause
- Service worker didn’t update
	- Go to the extensions page and click the “Reload” button on AI Presume
- PDF overflows to a second page
	- The extension auto‑compresses content, but if it still happens, reduce “Previous Resume” content or profile length

Logs
- Open `chrome://extensions`, enable “Developer mode”, click “service worker” under AI Presume to view background logs

---

## Privacy
- Your Groq API key and inputs are stored locally via `chrome.storage.local`
- AI calls go directly from your browser to Groq’s API
- No analytics or third‑party servers are used by this extension

---

## FAQ
Q: Can I change the model?
- Not via UI. The extension targets `llama3-70b-8192` in `src/background.js`.

Q: Can I use OpenAI/Gemini instead?
- The current build is Groq‑only.

Q: Does this change my template structure?
- No. It preserves tags/classes and rewrites only text content.

Q: Is the PDF selectable with clickable links?
- Yes. The export uses pdfmake with live text and link annotations.

---

## Scripts
- `npm run build` — Generate icons, build the extension, and prepare `dist/`
- `npm run dev` — Vite dev server for popup/options pages (for UI iteration)
- `npm run lint` — Lint the project

---

## License
MIT

