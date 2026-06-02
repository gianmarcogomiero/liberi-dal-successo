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
 *
 * UrlFetch (CallMeBot): se vedi "You do not have permission to call UrlFetchApp.fetch",
 * copia `appsscript.json` dal repo nel progetto (Visualizza → Mostra file manifest),
 * salva, poi Autorizza di nuovo l’accesso (Esegui testWhatsAppIntegration e accetta i permessi).
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

// ── ANALISI AGGREGATA ISCRIZIONI ──

/** Italian-name → gender heuristic. Returns 'M', 'F', or null. */
function detectGenderFromFirst_(name) {
  if (!name) return null;
  var first = String(name).trim().split(/\s+/)[0].toLowerCase();
  if (!first) return null;
  first = first.replace(/['`’]/g, '');

  var MALE = {
    'andrea':1,'luca':1,'mattia':1,'nicola':1,'elia':1,'enea':1,'tobia':1,
    'simone':1,'michele':1,'daniele':1,'gabriele':1,'emanuele':1,'samuele':1,
    'manuele':1,'niccolò':1,'niccolo':1,'denis':1,'antonio':1,'samuel':1,
    'noè':1,'noe':1,'ettore':1,'salvatore':1,'cesare':1,'felice':1,'ulisse':1,
    'ac':1,'davide':1,'manuel':1,'gabriel':1,'raphael':1,'oscar':1
  };
  var FEMALE = {
    'noemi':1,'ester':1,'beatrice':1,'agnese':1,'alice':1,'irene':1,'iris':1,
    'agnes':1,'carmen':1,'helene':1,'eleonore':1,'sole':1,'dafne':1,'ines':1,
    'mariele':1,'rachele':1,'micol':1,'estrella':1,'consuelo':1,'miriam':1
  };

  if (MALE[first]) return 'M';
  if (FEMALE[first]) return 'F';

  var last = first.charAt(first.length - 1);
  if (last === 'a') return 'F';
  if (last === 'o') return 'M';
  if (last === 'e') return 'M';
  if (last === 'i') return 'M';
  return null;
}

/** Try nome first, fallback to cognome (handles swapped fields / initials). */
function detectGender_(nome, cognome) {
  var g = detectGenderFromFirst_(nome);
  if (g) return g;
  if (cognome) return detectGenderFromFirst_(cognome);
  return null;
}

/** Read all iscrizioni rows as objects. */
function readIscrizioni_(sheet) {
  if (!sheet) return [];
  var lr = sheet.getLastRow();
  var startRow = SHEET_HAS_HEADER_ROW ? 2 : 1;
  if (lr < startRow) return [];
  var values = sheet.getRange(startRow, 1, lr - startRow + 1, 10).getValues();
  var out = [];
  for (var i = 0; i < values.length; i++) {
    var r = values[i];
    if (!r[1] && !r[3]) continue; // skip empty rows
    out.push({
      timestamp: r[0],
      nome: r[1],
      cognome: r[2],
      email: r[3],
      eta: r[4],
      comune: r[5],
      posti: r[6],
      accompagnatori: r[7],
      consenso_foto: r[8],
      tipo: r[9]
    });
  }
  return out;
}

/** Comuni della provincia di Padova (per categorizzazione “fuori”). */
var PD_COMUNI_ = {
  'padova':1,'teolo':1,'bresseo':1,'montegrotto terme':1,'selvazzano dentro':1,
  'mestrino':1,'limena':1,'cervarese santa croce':1,'rubano':1,'abano terme':1,
  'albignasego':1,'cadoneghe':1,'vigodarzere':1,'vigonza':1,'rovolon':1,'veggiano':1,
  'saccolongo':1,'galzignano terme':1,'torreglia':1,'battaglia terme':1,'monselice':1,
  'montagnana':1,'este':1,'conselve':1,'piove di sacco':1,'brugine':1,'legnaro':1,
  'ponte san nicolò':1,'noventa padovana':1,'casalserugo':1,'tribano':1,'polverara':1,
  'due carrare':1,'maserà di padova':1,'maserà':1,'cinto euganeo':1,'vò':1,"vo'":1,
  'arquà petrarca':1,'baone':1,'cervarese':1,'selvazzano':1,'galliera veneta':1
};

/** Build the WhatsApp analysis message from the current sheet state. */
function buildAnalysisMessage_(sheetIscr) {
  var rows = readIscrizioni_(sheetIscr);
  if (!rows.length) return null;

  var totalIscritti = rows.length;
  var totalPosti = 0;
  for (var i = 0; i < rows.length; i++) {
    var n = parseInt(String(rows[i].posti).replace(/\s/g, ''), 10);
    if (!isNaN(n)) totalPosti += n;
  }

  var bucketsOrder = ['18-25','26-35','36-50','51-65','over65'];
  var buckets = { '18-25':0, '26-35':0, '36-50':0, '51-65':0, 'over65':0 };
  for (var j = 0; j < rows.length; j++) {
    var e = String(rows[j].eta || '').trim().toLowerCase();
    if (buckets.hasOwnProperty(e)) buckets[e]++;
  }

  var gen = { F: 0, M: 0, U: 0 };
  for (var k = 0; k < rows.length; k++) {
    var r = rows[k];
    var g = detectGender_(r.nome, r.cognome);
    if (g === 'F') gen.F++; else if (g === 'M') gen.M++; else gen.U++;
    if (r.accompagnatori) {
      var parts = String(r.accompagnatori).split(/[,;]/);
      for (var p = 0; p < parts.length; p++) {
        var nn = parts[p].trim();
        if (!nn) continue;
        var g2 = detectGender_(nn);
        if (g2 === 'F') gen.F++; else if (g2 === 'M') gen.M++; else gen.U++;
      }
    }
  }

  var comuniMap = {};
  var noComune = 0;
  for (var c = 0; c < rows.length; c++) {
    var cm = String(rows[c].comune || '').trim();
    if (!cm || /^ext$/i.test(cm)) { noComune++; continue; }
    comuniMap[cm] = (comuniMap[cm] || 0) + 1;
  }
  var comuniArr = [];
  for (var key in comuniMap) comuniArr.push([key, comuniMap[key]]);
  comuniArr.sort(function(a, b) { return b[1] - a[1]; });

  var top = comuniArr.filter(function(x) { return x[1] >= 2; });
  var singles = comuniArr.filter(function(x) { return x[1] === 1; });
  var singlesPD = singles.filter(function(x) { return PD_COMUNI_[x[0].toLowerCase()]; });
  var singlesFuori = singles.filter(function(x) { return !PD_COMUNI_[x[0].toLowerCase()]; });

  var maxBucket = '26-35', maxCount = -1;
  for (var b = 0; b < bucketsOrder.length; b++) {
    if (buckets[bucketsOrder[b]] > maxCount) { maxCount = buckets[bucketsOrder[b]]; maxBucket = bucketsOrder[b]; }
  }

  function pct(x) { return totalIscritti ? Math.round(x / totalIscritti * 100) : 0; }
  var totGen = gen.F + gen.M + gen.U;
  function pctG(x) { return totGen ? Math.round(x / totGen * 100) : 0; }
  function ageLabel(x) { return x === 'over65' ? 'over 65' : x; }

  var ageLines = bucketsOrder.map(function(bk) {
    var label = ageLabel(bk);
    if (bk === maxBucket) return '• *' + label + ' → ' + buckets[bk] + ' (' + pct(buckets[bk]) + '%)* ← gruppo più numeroso';
    return '• ' + label + ' → ' + buckets[bk] + ' (' + pct(buckets[bk]) + '%)';
  });

  var comuniLines = [];
  top.forEach(function(x, idx) {
    if (idx === 0) comuniLines.push('• *' + x[0] + ' → ' + x[1] + '* (il cuore di casa 💙)');
    else comuniLines.push('• ' + x[0] + ' → ' + x[1]);
  });
  if (singlesPD.length) {
    comuniLines.push('• ' + singlesPD.map(function(x){ return x[0]; }).join(', ') + ' → 1 ciascuno');
  }
  if (singlesFuori.length) {
    comuniLines.push('• Anche da fuori: ' + singlesFuori.map(function(x){ return x[0]; }).join(', ') + ' → 1 ciascuno');
  }
  if (noComune > 0) {
    comuniLines.push('• ' + noComune + ' iscritt' + (noComune === 1 ? 'o' : 'i') + ' senza comune compilato');
  }

  var polariz = pct(buckets['26-35'] + buckets['51-65']);
  var insightLines = ['• Pubblico polarizzato: *26-35 + 51-65 = ' + polariz + '%*'];
  if (buckets['18-25'] <= 2) {
    insightLines.push('• Quasi assenti i *18-25* (solo ' + buckets['18-25'] + ' iscritt' + (buckets['18-25'] === 1 ? 'o' : 'i') + ')');
  }
  if (top.length) {
    insightLines.push('• Bel mix territoriale: ' + top[0][0] + ' zoccolo duro, ma stiamo arrivando anche oltre i Colli');
  }

  var dateStr = Utilities.formatDate(new Date(), 'Europe/Rome', 'dd.MM.yyyy');

  return [
    '📊 *Analisi iscrizioni — Liberi dal Successo*',
    '📅 ' + dateStr,
    '',
    'Ciao a tutti! 👋',
    'Piccolo update sui numeri delle iscrizioni 👇',
    '',
    '🎫 *Totali*',
    '• ' + totalPosti + ' posti richiesti',
    '',
    "👥 *Fasce d'età*",
    ageLines.join('\n'),
    '',
    '⚖️ *Genere (stimato dal nome)*',
    pctG(gen.F) + '% F · ' + pctG(gen.M) + '% M',
    '',
    '📍 *Provenienza*',
    comuniLines.join('\n'),
    '',
    '💡 *Cosa notiamo*',
    insightLines.join('\n'),
    '',
    '💙'
  ].join('\n');
}

// ── FOGLIO "LISTA NOMINATIVI" (contatore + elenco completo per cognome) ──

/**
 * Esegui A MANO questa funzione (menu funzioni → buildListaNominativi → Esegui)
 * per creare/aggiornare subito il foglio "Lista nominativi".
 * Per l'aggiornamento automatico vedi rebuildListaNominativi_, richiamata
 * a ogni nuova iscrizione dentro sendAdminNotifyIscrizione.
 */
function buildListaNominativi() {
  var n = rebuildListaNominativi_(SpreadsheetApp.getActiveSpreadsheet());
  Logger.log('Lista nominativi aggiornata: ' + n + ' persone.');
  return n;
}

/** Spezza "Nome Cognome" → {nome, cognome} (ultima parola = cognome). */
function splitFullName_(full) {
  var parts = String(full == null ? '' : full).trim().split(/\s+/).filter(String);
  if (!parts.length) return { nome: '', cognome: '' };
  if (parts.length === 1) return { nome: parts[0], cognome: '' };
  var cognome = parts.pop();
  return { nome: parts.join(' '), cognome: cognome };
}

/**
 * (Ri)costruisce il foglio "Lista nominativi": contatore totale persone
 * + elenco completo (iscritti + accompagnatori) ordinato per cognome.
 * Sovrascrive il foglio a ogni chiamata, quindi resta sempre aggiornato.
 */
function rebuildListaNominativi_(ss) {
  var sheetIscr = ss.getSheetByName('Iscrizioni');
  if (!sheetIscr) throw new Error('Foglio "Iscrizioni" non trovato.');

  var rows = readIscrizioni_(sheetIscr);
  var people = [];

  for (var i = 0; i < rows.length; i++) {
    var nome = String(rows[i].nome == null ? '' : rows[i].nome).trim();
    var cognome = String(rows[i].cognome == null ? '' : rows[i].cognome).trim();
    if (nome || cognome) {
      people.push({ nome: nome, cognome: cognome, ruolo: 'Iscritto' });
    }
    if (rows[i].accompagnatori) {
      var parts = String(rows[i].accompagnatori).split(/[,;]/);
      for (var p = 0; p < parts.length; p++) {
        var nn = parts[p].trim();
        if (!nn) continue;
        var sp = splitFullName_(nn);
        people.push({ nome: sp.nome, cognome: sp.cognome, ruolo: 'Accompagnatore' });
      }
    }
  }

  people.sort(function (a, b) {
    var ca = a.cognome.toLowerCase(), cb = b.cognome.toLowerCase();
    if (ca < cb) return -1;
    if (ca > cb) return 1;
    var na = a.nome.toLowerCase(), nb = b.nome.toLowerCase();
    return na < nb ? -1 : (na > nb ? 1 : 0);
  });

  var SHEET_NAME = 'Lista nominativi';
  var sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) sh = ss.insertSheet(SHEET_NAME);
  else sh.clear();

  // Titolo + contatore
  sh.getRange(1, 1).setValue('Lista completa — Liberi dal Successo');
  sh.getRange(2, 1).setValue('Totale persone:');
  sh.getRange(2, 2).setValue(people.length);

  // Intestazione tabella
  var headerRow = 4;
  sh.getRange(headerRow, 1, 1, 4).setValues([['#', 'Cognome', 'Nome', 'Ruolo']]);

  // Dati
  if (people.length) {
    var data = people.map(function (person, idx) {
      return [idx + 1, person.cognome, person.nome, person.ruolo];
    });
    sh.getRange(headerRow + 1, 1, data.length, 4).setValues(data);
  }

  // Formattazione leggera
  sh.getRange(1, 1).setFontWeight('bold').setFontSize(13);
  sh.getRange(2, 1, 1, 2).setFontWeight('bold');
  sh.getRange(headerRow, 1, 1, 4)
    .setFontWeight('bold')
    .setBackground('#0B1C2D')
    .setFontColor('#FFFFFF');
  sh.setColumnWidth(1, 44);
  sh.setColumnWidth(2, 190);
  sh.setColumnWidth(3, 190);
  sh.setColumnWidth(4, 130);
  sh.setFrozenRows(headerRow);

  return people.length;
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

  try {
    var analysisMsg = buildAnalysisMessage_(sheetIscr);
    if (analysisMsg) {
      Utilities.sleep(2000);
      sendWhatsAppAdmin(analysisMsg);
    }
  } catch (analysisErr) {
    Logger.log('buildAnalysisMessage error: ' + (analysisErr && analysisErr.message ? analysisErr.message : analysisErr));
  }

  // Aggiorna automaticamente il foglio "Lista nominativi" (dinamico).
  try {
    rebuildListaNominativi_(sheetIscr.getParent());
  } catch (listaErr) {
    Logger.log('rebuildListaNominativi_ error: ' + (listaErr && listaErr.message ? listaErr.message : listaErr));
  }
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
