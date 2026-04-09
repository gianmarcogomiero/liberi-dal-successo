/**
 * Liberi dal Successo — Web App (doPost)
 * Incolla in Apps Script collegato al foglio Google Sheets.
 * Deploy: Implementa come app web, accesso "Chiunque", esegui come "tu".
 *
 * Fogli richiesti: "Collabora", "Iscrizioni" (nomi esatti).
 *
 * MITTENTE EMAIL: GmailApp invia dall’account Google del progetto Apps Script
 * (Deploy → Esegui come: io). Per usare liberidalsuccesso@gmail.com, crea e
 * distribuisci lo script mentre sei loggato con quell’account (o un account
 * con “Invia come” verificato verso quell’indirizzo). Il campo `name` nel
 * sendEmail è solo il nome visualizzato accanto al mittente.
 *
 * NOTIFICHE ORGANIZZATORE (WhatsApp): a ogni iscrizione o richiesta collaborazione
 * viene inviato un messaggio WhatsApp tramite CallMeBot (vedi sotto). In caso di
 * errore invio, la richiesta utente resta comunque salvata.
 *
 * Setup CallMeBot (una tantum): https://www.callmebot.com/blog/free-api-whatsapp-messages/
 * — Aggiungi il numero del bot in rubrica, invia il messaggio di attivazione, ricevi apikey.
 * — NON committare numero né apikey nel repository: usa solo Progetto → Impostazioni →
 *   Proprietà dello script → Aggiungi proprietà: WHATSAPP_PHONE (solo cifre, es. 39347…),
 *   CALLMEBOT_APIKEY (chiave CallMeBot). Le variabili sotto restano vuote nel codice pubblico.
 */

/** Lasciare vuoto nel repo; valore reale solo in Proprietà dello script WHATSAPP_PHONE. */
var WHATSAPP_PHONE_INTERNATIONAL = '';

/** Lasciare vuoto nel repo; valore reale solo in Proprietà CALLMEBOT_APIKEY. */
var WHATSAPP_CALLMEBOT_APIKEY = '';

/** Riga 1 dei fogli = intestazioni; le righe dati partono dalla 2. */
var SHEET_HAS_HEADER_ROW = true;

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return jsonOut({ success: false, message: 'Richiesta vuota o non valida.' });
    }

    var data;
    try {
      data = JSON.parse(e.postData.contents);
    } catch (parseErr) {
      return jsonOut({ success: false, message: 'JSON non valido.' });
    }

    if (!data || typeof data !== 'object') {
      return jsonOut({ success: false, message: 'Dati mancanti.' });
    }

    var ss = SpreadsheetApp.getActiveSpreadsheet();

    if (data.tipo === 'Collaborazione') {
      var sheetCollab = ss.getSheetByName('Collabora');
      if (!sheetCollab) {
        return jsonOut({ success: false, message: 'Configurazione foglio Collabora mancante.' });
      }
      sheetCollab.appendRow([
        data.timestamp || '',
        data.nome,
        data.email,
        data.ruolo,
        data.messaggio || ''
      ]);
      sendCollabEmail(data);
      try {
        var sheetIscrForCount = ss.getSheetByName('Iscrizioni');
        sendAdminNotifyCollaborazione(data, sheetCollab, sheetIscrForCount);
      } catch (adminErr) {
        Logger.log('sendAdminNotifyCollaborazione: ' + (adminErr && adminErr.message ? adminErr.message : adminErr));
      }
    } else {
      var sheetIscr = ss.getSheetByName('Iscrizioni');
      if (!sheetIscr) {
        return jsonOut({ success: false, message: 'Configurazione foglio Iscrizioni mancante.' });
      }
      sheetIscr.appendRow([
        data.timestamp || '',
        data.nome,
        data.cognome,
        data.email,
        data.eta,
        data.comune,
        data.posti,
        data.accompagnatori,
        data.consenso_foto,
        data.tipo
      ]);
      sendConfirmEmail(data);
      try {
        var sheetCollabForCount = ss.getSheetByName('Collabora');
        sendAdminNotifyIscrizione(data, sheetIscr, sheetCollabForCount);
      } catch (adminErr) {
        Logger.log('sendAdminNotifyIscrizione: ' + (adminErr && adminErr.message ? adminErr.message : adminErr));
      }
    }

    return jsonOut({ success: true, result: 'ok' });
  } catch (err) {
    return jsonOut({
      success: false,
      message: err && err.message ? String(err.message) : 'Errore server. Riprova più tardi.'
    });
  }
}

/**
 * Nota: ContentService non imposta il codice HTTP reale in tutti i casi;
 * il client si affida al body JSON (success) e a response.ok quando possibile.
 */
function jsonOut(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/** Escape minimo per inserire testi utente in HTML email */
function escapeHtml(s) {
  if (s == null || s === undefined) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Testo sicuro per ICS (una riga, senza interruzioni non gestite) */
function escapeIcsText(s) {
  if (s == null || s === undefined) return '';
  return String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

/** Numero righe dati (esclusa intestazione). */
function countDataRows(sheet) {
  if (!sheet) return 0;
  var lr = sheet.getLastRow();
  if (lr === 0) return 0;
  if (SHEET_HAS_HEADER_ROW) return lr <= 1 ? 0 : lr - 1;
  return lr;
}

/** Somma colonna posti (colonna G = 7) nel foglio Iscrizioni. */
function sumPostiColumn(sheet) {
  if (!sheet) return 0;
  var lr = sheet.getLastRow();
  var start = SHEET_HAS_HEADER_ROW ? 2 : 1;
  if (lr < start) return 0;
  var values = sheet.getRange(start, 7, lr, 7).getValues();
  var t = 0;
  for (var i = 0; i < values.length; i++) {
    var v = values[i][0];
    if (v === '' || v == null) continue;
    var n = parseFloat(String(v).replace(',', '.').replace(/\s/g, ''));
    if (!isNaN(n)) t += n;
  }
  return t;
}

// ── NOTIFICHE ORGANIZZATORE (WhatsApp via CallMeBot) ──
function adminLine_(v) {
  return String(v == null ? '' : v).replace(/\r|\n/g, ' ');
}

function getWhatsAppConfig_() {
  var props = PropertiesService.getScriptProperties();
  var phone = props.getProperty('WHATSAPP_PHONE') || WHATSAPP_PHONE_INTERNATIONAL;
  var apikey = props.getProperty('CALLMEBOT_APIKEY') || WHATSAPP_CALLMEBOT_APIKEY;
  phone = phone ? String(phone).replace(/\D/g, '') : '';
  apikey = apikey ? String(apikey).trim() : '';
  return { phone: phone, apikey: apikey };
}

/**
 * Invia messaggio WhatsApp tramite https://www.callmebot.com/ (UrlFetch).
 * Se mancano proprietà o CallMeBot risponde errore, scrive in Logger (Esecuzioni).
 */
function sendWhatsAppAdmin(text) {
  var c = getWhatsAppConfig_();
  if (!c.phone || !c.apikey) {
    Logger.log(
      '[WhatsApp] NON inviato: imposta Proprietà dello script WHATSAPP_PHONE (solo cifre, es. 393474836611) e CALLMEBOT_APIKEY.'
    );
    return { sent: false, reason: 'missing_config' };
  }
  var body = String(text);
  if (body.length > 4000) body = body.substring(0, 3997) + '...';
  var url =
    'https://api.callmebot.com/whatsapp.php?phone=' +
    encodeURIComponent(c.phone) +
    '&text=' +
    encodeURIComponent(body) +
    '&apikey=' +
    encodeURIComponent(c.apikey);
  try {
    var resp = UrlFetchApp.fetch(url, { muteHttpExceptions: true, followRedirects: true });
    var code = resp.getResponseCode();
    var txt = resp.getContentText() || '';
    Logger.log('[WhatsApp] HTTP ' + code + ' — ' + txt.substring(0, 400));
    var ok = code === 200 && /queued|Message sent|sent/i.test(txt);
    if (!ok) {
      Logger.log(
        '[WhatsApp] Possibile errore API. Controlla apikey, che il bot non sia in Stop, e il numero su CallMeBot.'
      );
    }
    return { sent: ok, httpCode: code, responseSnippet: txt.substring(0, 300) };
  } catch (fetchErr) {
    Logger.log('[WhatsApp] UrlFetch errore: ' + (fetchErr && fetchErr.message ? fetchErr.message : fetchErr));
    return { sent: false, reason: 'fetch_error' };
  }
}

/**
 * Esegui dal menu Apps Script (Run) dopo aver salvato le Proprietà.
 * Invia un messaggio di test e controlla Visualizzazione → Log / Esecuzioni.
 */
function testWhatsAppIntegration() {
  var r = sendWhatsAppAdmin('Test Liberi dal Successo — se leggi questo, Apps Script + CallMeBot sono OK.');
  Logger.log('testWhatsAppIntegration result: ' + JSON.stringify(r));
}

function sendAdminNotifyIscrizione(data, sheetIscr, sheetCollab) {
  var nIscr = countDataRows(sheetIscr);
  var nCollab = countDataRows(sheetCollab);
  var postiTot = sumPostiColumn(sheetIscr);
  var msg =
    'Liberi dal Successo — nuova ISCRIZIONE\n\n' +
    'Nome: ' +
    adminLine_(data.nome) +
    ' ' +
    adminLine_(data.cognome) +
    '\nEmail: ' +
    adminLine_(data.email) +
    '\nTipo: ' +
    adminLine_(data.tipo) +
    '\nPosti: ' +
    adminLine_(data.posti) +
    '\nEtà: ' +
    adminLine_(data.eta) +
    ' · Comune: ' +
    adminLine_(data.comune) +
    '\nAccompagnatori: ' +
    adminLine_(data.accompagnatori || '—') +
    '\nConsenso foto: ' +
    adminLine_(data.consenso_foto) +
    '\nInvio: ' +
    adminLine_(data.timestamp || '') +
    '\n\n— Totali aggiornati —\n' +
    'Iscrizioni (righe foglio): ' +
    nIscr +
    '\nPosti richiesti (somma): ' +
    postiTot +
    '\nRichieste collaborazione: ' +
    nCollab;
  sendWhatsAppAdmin(msg);
}

function sendAdminNotifyCollaborazione(data, sheetCollab, sheetIscr) {
  var nIscr = countDataRows(sheetIscr);
  var nCollab = countDataRows(sheetCollab);
  var postiTot = sheetIscr ? sumPostiColumn(sheetIscr) : 0;
  var msg =
    'Liberi dal Successo — nuova COLLABORAZIONE\n\n' +
    'Nome: ' +
    adminLine_(data.nome) +
    '\nEmail: ' +
    adminLine_(data.email) +
    '\nRuolo: ' +
    adminLine_(data.ruolo) +
    '\nMessaggio: ' +
    adminLine_(data.messaggio || '—') +
    '\nInvio: ' +
    adminLine_(data.timestamp || '') +
    '\n\n— Totali aggiornati —\n' +
    'Iscrizioni (righe foglio): ' +
    nIscr +
    '\nPosti richiesti (somma): ' +
    postiTot +
    '\nRichieste collaborazione: ' +
    nCollab;
  sendWhatsAppAdmin(msg);
}

// ── EMAIL CONFERMA ISCRIZIONE ──
function sendConfirmEmail(data) {
  var isWait = data.tipo === "Lista d'attesa";
  var subject = isWait
    ? "Sei in lista d'attesa — Liberi dal Successo"
    : 'Iscrizione confermata — Liberi dal Successo';

  var nome = escapeHtml(data.nome);
  var emailEsc = escapeHtml(data.email);

  var detailsCal =
    'Non+per+imparare+ad+avere+successo+%E2%80%94+ma+per+imparare+ad+essere+noi+stessi.' +
    '%0A%0AIngresso+gratuito+%C2%B7+Rinfresco%0A%0Ahttps://liberidalsuccesso.it';

  var gcalLink =
    'https://calendar.google.com/calendar/render?action=TEMPLATE' +
    '&text=Liberi+dal+Successo' +
    '&dates=20260620T153000Z/20260620T200000Z' +
    '&details=' +
    detailsCal +
    '&location=Sala+Polivalente%2C+Via+Alcide+De+Gasperi+22%2C+Bresseo%2C+Teolo+(PD)';

  var accompTxt = '';
  if (data.accompagnatori && String(data.accompagnatori).trim()) {
    accompTxt =
      '<tr><td style="padding:8px 0;color:#AFC6E9;font-size:13px;">Accompagnatori</td>' +
      '<td style="padding:8px 0;color:#E6E8EC;font-size:14px;">' +
      escapeHtml(data.accompagnatori) +
      '</td></tr>';
  }

  var bodyHtml;

  if (isWait) {
    bodyHtml = buildEmail(
      'Ciao ' + nome + ',',
      "grazie per il tuo interesse per <strong style='color:#C4A962;'>Liberi dal Successo</strong>.",
      "<p style='font-size:15px;color:#E6E8EC;line-height:1.8;'>I posti per la serata sono tutti occupati, ma <strong>sei in lista d'attesa</strong>.</p>" +
        "<p style='font-size:15px;color:#E6E8EC;line-height:1.8;'>Ti contatteremo a <strong style='color:#AFC6E9;'>" +
        emailEsc +
        '</strong> se si libera un posto.</p>',
      '',
      ''
    );
  } else {
    bodyHtml = buildEmail(
      'Ciao ' + nome + ',',
      "la tua iscrizione a <strong style='color:#C4A962;'>Liberi dal Successo</strong> è confermata!",
      "<table style='width:100%;border-collapse:collapse;margin:24px 0;'>" +
        "<tr><td style='padding:8px 0;color:#AFC6E9;font-size:13px;width:130px;'>Quando</td>" +
        "<td style='padding:8px 0;color:#E6E8EC;font-size:14px;'>Sabato 20 Giugno 2026 · ore 17:30 – 22:00</td></tr>" +
        "<tr><td style='padding:8px 0;color:#AFC6E9;font-size:13px;'>Dove</td>" +
        "<td style='padding:8px 0;color:#E6E8EC;font-size:14px;'>Sala Polivalente, Bresseo, Teolo (PD)</td></tr>" +
        "<tr><td style='padding:8px 0;color:#AFC6E9;font-size:13px;'>Accesso</td>" +
        "<td style='padding:8px 0;color:#E6E8EC;font-size:14px;'>Gratuito · Rinfresco</td></tr>" +
        "<tr><td style='padding:8px 0;color:#AFC6E9;font-size:13px;'>Posti</td>" +
        "<td style='padding:8px 0;color:#E6E8EC;font-size:14px;'>" +
        escapeHtml(data.posti) +
        '</td></tr>' +
        accompTxt +
        '</table>',
      '<a href="' +
        gcalLink +
        '" target="_blank" style="display:inline-block;padding:14px 32px;background:linear-gradient(135deg,#c4a962,#d8bb72,#c4a962);color:#0B1C2D;font-family:sans-serif;font-size:14px;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;text-decoration:none;border-radius:8px;">Salva nel calendario</a>',
      "<p style='font-size:14px;color:rgba(230,232,236,0.5);margin-top:20px;'>Seguici su Instagram per restare aggiornato: <a href='https://www.instagram.com/liberidalsuccesso/' style='color:#AFC6E9;'>@liberidalsuccesso</a></p>"
    );
  }

  var icsDescPlain =
    'Non per imparare ad avere successo — ma per imparare ad essere noi stessi.\n' +
    'Ingresso gratuito · Rinfresco\n' +
    'https://liberidalsuccesso.it';

  var icsContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Liberi dal Successo//IT',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    'UID:liberidalsuccesso-20260620@bresseo',
    'DTSTAMP:' + Utilities.formatDate(new Date(), 'Europe/Rome', "yyyyMMdd'T'HHmmss'Z'"),
    'DTSTART:20260620T153000Z',
    'DTEND:20260620T200000Z',
    'SUMMARY:Liberi dal Successo',
    'DESCRIPTION:' + escapeIcsText(icsDescPlain),
    'LOCATION:' + escapeIcsText('Sala Polivalente, Via Alcide De Gasperi 22, Bresseo, Teolo (PD)'),
    'URL:https://liberidalsuccesso.it',
    'BEGIN:VALARM',
    'TRIGGER:-P20D',
    'ACTION:DISPLAY',
    'DESCRIPTION:Liberi dal Successo tra 20 giorni!',
    'END:VALARM',
    'BEGIN:VALARM',
    'TRIGGER:-P7D',
    'ACTION:DISPLAY',
    'DESCRIPTION:Liberi dal Successo tra 1 settimana!',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR'
  ].join('\r\n');

  var icsBlob = Utilities.newBlob(icsContent, 'text/calendar', 'liberi-dal-successo.ics');

  GmailApp.sendEmail(data.email, subject, '', {
    htmlBody: bodyHtml,
    name: 'Liberi dal Successo',
    attachments: [icsBlob]
  });
}

// ── EMAIL CONFERMA COLLABORAZIONE ──
function sendCollabEmail(data) {
  var subject = 'Grazie per il tuo interesse — Liberi dal Successo';
  var nome = escapeHtml(data.nome);

  var bodyHtml = buildEmail(
    'Ciao ' + nome + ',',
    "grazie per aver scritto a <strong style='color:#C4A962;'>Liberi dal Successo</strong>!",
    "<p style='font-size:15px;color:#E6E8EC;line-height:1.8;'>Abbiamo ricevuto la tua disponibilità come <strong style='color:#AFC6E9;'>" +
      escapeHtml(data.ruolo) +
      '</strong>.</p>' +
      "<p style='font-size:15px;color:#E6E8EC;line-height:1.8;'>Ti risponderemo di solito entro <strong>3–5 giorni lavorativi</strong>, salvo imprevisti.</p>",
    '',
    "<p style='font-size:14px;color:rgba(230,232,236,0.5);margin-top:20px;'>Seguici su Instagram: <a href='https://www.instagram.com/liberidalsuccesso/' style='color:#AFC6E9;'>@liberidalsuccesso</a></p>"
  );

  GmailApp.sendEmail(data.email, subject, '', {
    htmlBody: bodyHtml,
    name: 'Liberi dal Successo'
  });
}

// ── TEMPLATE EMAIL HTML ──
function buildEmail(greeting, intro, body, cta, footer) {
  return (
    '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>' +
    '<body style="margin:0;padding:0;background:#0a1520;font-family:sans-serif;">' +
    '<table width="100%" cellpadding="0" cellspacing="0" style="background:#0a1520;padding:40px 16px;">' +
    '<tr><td align="center">' +
    '<table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#0B1C2D;border-radius:16px;border:1px solid rgba(175,198,233,0.08);overflow:hidden;">' +
    '<tr><td style="height:4px;background:linear-gradient(90deg,transparent,#C4A962,transparent);"></td></tr>' +
    '<tr><td align="center" style="padding:36px 32px 20px;">' +
    '<img src="https://liberidalsuccesso.it/Loghi/colorato%201.png" alt="Liberi dal Successo" width="80" style="display:block;" />' +
    '</td></tr>' +
    '<tr><td style="padding:0 32px 8px;">' +
    '<h1 style="font-size:22px;color:#D9CFC3;font-weight:700;margin:0;">' +
    greeting +
    '</h1>' +
    '</td></tr>' +
    '<tr><td style="padding:0 32px 16px;">' +
    '<p style="font-size:15px;color:#E6E8EC;line-height:1.8;margin:0;">' +
    intro +
    '</p>' +
    '</td></tr>' +
    '<tr><td style="padding:0 32px 24px;">' +
    body +
    '</td></tr>' +
    (cta ? '<tr><td align="center" style="padding:8px 32px 32px;">' + cta + '</td></tr>' : '') +
    '<tr><td style="padding:0 32px;"><div style="height:1px;background:linear-gradient(90deg,transparent,rgba(175,198,233,0.12),transparent);"></div></td></tr>' +
    '<tr><td style="padding:24px 32px 32px;text-align:center;">' +
    '<p style="font-size:13px;color:rgba(230,232,236,0.35);margin:0;line-height:1.7;">' +
    '<em style="color:rgba(196,169,98,0.6);">Non per imparare ad avere successo.<br>Ma per imparare ad essere noi stessi.</em></p>' +
    (footer || '') +
    '<p style="font-size:11px;color:rgba(230,232,236,0.2);margin-top:16px;">© 2026 Liberi dal Successo · Bresseo, Teolo (PD)<br>' +
    '<a href="https://liberidalsuccesso.it" style="color:rgba(175,198,233,0.3);">liberidalsuccesso.it</a></p>' +
    '</td></tr>' +
    '</table></td></tr></table></body></html>'
  );
}
