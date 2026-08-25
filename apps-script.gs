/* ============================================================
   GOOGLE APPS SCRIPT — portfolio lead form -> Google Sheets
   ============================================================
   SETUP (one time, ~5 min):

   1. Create a new Google Sheet. Name row 1 columns:
      Timestamp | Name | Email | Project Type | Details | Source

   2. In the Sheet: Extensions > Apps Script. Delete everything,
      paste this file's code in.

   3. Click Deploy > New deployment > select type: Web app
      - Description: portfolio form
      - Execute as: Me (your account)
      - Who has access: Anyone        <-- must be "Anyone", not
        "Anyone with Google account", or the site form fails

   4. Deploy > Authorize (it asks for permission to edit the
      sheet - that is the script writing rows for you).

   5. Copy the Web app URL (ends in /exec). Send it to me and
      I'll wire it into the site's form handler.
   ============================================================ */

const SHEET_NAME = 'sheet my website'; // change if you renamed the tab

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);

    const data = JSON.parse(e.postData.contents);

    // honeypot: bots fill the hidden "company" field. Pretend success, save nothing.
    if (data.company) {
      return json({ ok: true });
    }

    // basic validation + length caps (defense against junk payloads)
    const name = String(data.name || '').slice(0, 120).trim();
    const email = String(data.email || '').slice(0, 200).trim();
    const type = String(data.type || '').slice(0, 120).trim();
    const message = String(data.message || '').slice(0, 3000).trim();

    if (!name || !email || !message) {
      return json({ ok: false, error: 'missing fields' }, 400);
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return json({ ok: false, error: 'bad email' }, 400);
    }

    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
    sheet.appendRow([
      new Date(),
      name,
      email,
      type,
      message,
      data.source || 'portfolio',
    ]);

    return json({ ok: true });
  } catch (err) {
    return json({ ok: false, error: String(err) }, 500);
  } finally {
    lock.releaseLock();
  }
}

// health check: open the /exec URL in a browser, should say ok
function doGet() {
  return json({ ok: true, service: 'portfolio-form' });
}

function json(obj, code) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
