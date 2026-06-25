// == EMAIL "Grazie di esserci stati" — Liberi dal Successo (post-evento) ==
// Incolla come NUOVO file nel progetto Apps Script (stesso di Code.gs).
// Usa readIscrizioni_ (definita in Code.gs). Invio: una mail PERSONALE a
// ciascun iscritto (1 destinatario per messaggio).
//
// COME SI USA:
//   1) testGrazie()                     -> invia SOLO a te, per il test
//   2) inviaGrazieATuttiGliIscritti()   -> invio reale a tutti gli iscritti

var GRAZIE_SUBJECT = 'Grazie di esserci stati — Liberi dal Successo';
var GRAZIE_PRETEXT = 'Ci sono serate che continuano dentro le persone. Grazie di aver fatto parte di Liberi dal Successo.';

// Destinatari EXTRA oltre al foglio Iscrizioni (team / contatti dal CSV).
// Vengono uniti e deduplicati con le email del foglio: niente doppioni.
var EMAIL_EXTRA = [
  'agnes.ardolino@gmail.com',
  'bellioagnese@gmail.com',
  'alemorato57@gmail.com',
  'trolesealessandro95@gmail.com',
  'beatricebabolin@gmail.com',
  'beatrice.gallarotti92@gmail.com',
  'monterossocarlotta@gmail.com',
  'denismazzu@live.it',
  'giorgiadengo07@gmail.com',
  'toffaningiovanni64@gmail.com',
  'giulylazzaretto91@gmail.com',
  'jgomiero4@gmail.com',
  'joel.m.parman@gmail.com',
  'lucamarinuzzi1996@gmail.com',
  'marchettimarcello60@gmail.com',
  'bilato97@gmail.com',
  'frizza97@gmail.com',
  'mayaelisa.bosello99@gmail.com',
  'casottonicolo@gmail.com',
  'samiazzouz1204@gmail.com',
  'silvia.grimaldi95@gmail.com',
  'cantonstefano96@gmail.com'
];

/** TEST: invia SOLO a te, per controllare la resa. */
function testGrazie() {
  inviaGrazie_('gianmarcogomiero@gmail.com');
}

/**
 * INVIO REALE: una mail individuale a ogni iscritto del foglio.
 * Ogni messaggio ha un solo destinatario -> niente limite "Recipients Per Message".
 */
function inviaGrazieATuttiGliIscritti() {
  var emails = getEmailPartecipanti_();
  var html = buildGrazieEmailHtml_();
  var inviate = 0;
  var falliti = [];

  for (var i = 0; i < emails.length; i++) {
    try {
      GmailApp.sendEmail(emails[i], GRAZIE_SUBJECT, GRAZIE_PRETEXT, {
        htmlBody: html,
        name: 'Liberi dal Successo'
      });
      inviate++;
      Utilities.sleep(250);
    } catch (e) {
      falliti.push(emails[i] + ' -> ' + (e && e.message ? e.message : e));
    }
  }

  Logger.log('Inviate ' + inviate + ' / ' + emails.length + ' mail.');
  if (falliti.length) Logger.log('NON inviate:\n' + falliti.join('\n'));
  return { inviate: inviate, totale: emails.length, falliti: falliti };
}

/** Invio a un singolo indirizzo (usata dal test). */
function inviaGrazie_(destinatario) {
  GmailApp.sendEmail(destinatario, GRAZIE_SUBJECT, GRAZIE_PRETEXT, {
    htmlBody: buildGrazieEmailHtml_(),
    name: 'Liberi dal Successo'
  });
}

/** Email uniche e valide: foglio Iscrizioni + lista EMAIL_EXTRA, deduplicate. */
function getEmailPartecipanti_() {
  var out = [];
  function aggiungi(e) {
    e = String(e || '').trim().toLowerCase();
    if (e && e.indexOf('@') > 0 && out.indexOf(e) === -1) out.push(e);
  }
  // 1) dal foglio Iscrizioni (riusa readIscrizioni_ di Code.gs)
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Iscrizioni');
  var rows = readIscrizioni_(sh);
  for (var i = 0; i < rows.length; i++) aggiungi(rows[i].email);
  // 2) dai contatti extra (team / CSV)
  for (var j = 0; j < EMAIL_EXTRA.length; j++) aggiungi(EMAIL_EXTRA[j]);
  return out;
}

/** HTML dell'email. */
function buildGrazieEmailHtml_() {
  return `<!DOCTYPE html>
<html lang="it" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="x-apple-disable-message-reformatting" />
  <meta name="color-scheme" content="dark" />
  <meta name="supported-color-schemes" content="dark" />
  <title>Grazie di esserci stati — Liberi dal Successo</title>
  <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;1,400&family=DM+Sans:wght@400;500&display=swap" rel="stylesheet" />
  <!--[if mso]>
  <style>
    .serif { font-family: Georgia, 'Times New Roman', serif !important; }
    .sans  { font-family: Arial, Helvetica, sans-serif !important; }
  </style>
  <![endif]-->
  <style>
    body { margin:0; padding:0; background:#0a1520; }
    a { color:#AFC6E9; }
    @media only screen and (max-width:600px){
      .container { width:100% !important; }
      .px { padding-left:22px !important; padding-right:22px !important; }
      .h1 { font-size:26px !important; }
      .hero-img { width:100% !important; height:auto !important; }
    }
  </style>
</head>
<body style="margin:0; padding:0; background:#0a1520;">
  <div style="display:none; max-height:0; overflow:hidden; opacity:0;">Ci sono serate che continuano dentro le persone. Grazie di aver fatto parte di Liberi dal Successo.</div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#0a1520" style="background:#0a1520;">
    <tr>
      <td align="center" style="padding:32px 14px;">

        <table role="presentation" class="container" width="600" cellpadding="0" cellspacing="0" border="0" bgcolor="#0B1C2D" style="width:600px; max-width:600px; background:#0B1C2D; border-radius:16px; overflow:hidden;">

          <!-- top gold bar -->
          <tr><td style="height:4px; line-height:4px; font-size:0; background:#C4A962;">&nbsp;</td></tr>

          <!-- HEADER -->
          <tr>
            <td align="center" class="px" style="padding:36px 40px 8px;">
              <img src="https://liberidalsuccesso.it/Loghi/colorato%201.png" width="74" height="74" alt="Liberi dal Successo" style="display:block; border:0;" />
            </td>
          </tr>
          <tr>
            <td align="center" class="px" style="padding:18px 40px 0;">
              <div class="sans" style="font-family:'DM Sans',Arial,sans-serif; font-size:11px; letter-spacing:2.5px; text-transform:uppercase; color:#AFC6E9;">20 Giugno 2026 · Grazie</div>
              <div class="serif h1" style="font-family:'Playfair Display',Georgia,serif; font-size:32px; line-height:1.2; color:#D9CFC3; padding-top:12px;">Grazie di esserci stati</div>
            </td>
          </tr>

          <!-- HERO PHOTO -->
          <tr>
            <td class="px" align="center" style="padding:24px 40px 0;">
              <img class="hero-img" src="https://liberidalsuccesso.it/thanks/hero-gruppo.jpg" width="520" height="347" alt="Foto di gruppo della serata" style="display:block; width:520px; max-width:100%; height:auto; border-radius:12px; border:0;" />
            </td>
          </tr>

          <!-- BODY -->
          <tr>
            <td class="px" style="padding:26px 40px 0;">
              <div class="sans" style="font-family:'DM Sans',Arial,sans-serif; font-size:15px; line-height:1.75; color:#bcc6d2;">
                Ci sono serate che finiscono quando si spengono le luci. E poi ci sono serate che continuano dentro le persone.
                <br /><br />
                Quello che si è creato sabato sera è difficile da raccontare con foto o video: storie vere, musica, emozioni e soprattutto persone che hanno scelto di mettersi in gioco con autenticità. Grazie per aver fatto parte di tutto questo.
              </div>
            </td>
          </tr>

          <!-- TRE PAROLE -->
          <tr>
            <td class="px" align="center" style="padding:24px 40px 0;">
              <div class="sans" style="font-family:'DM Sans',Arial,sans-serif; font-size:13px; line-height:1.6; color:#97A3B3; font-style:italic;">Se dovessimo scegliere tre parole per descrivere quella serata?</div>
              <div class="serif" style="font-family:'Playfair Display',Georgia,serif; font-size:18px; color:#C4A962; padding-top:8px; letter-spacing:0.5px;">Autenticità · Unione · Consapevolezza &#128153;</div>
            </td>
          </tr>

          <tr><td class="px" style="padding:30px 40px 0;"><div style="height:1px; background:#16304a;"></div></td></tr>

          <!-- SOSTENITORI -->
          <tr>
            <td class="px" align="center" style="padding:26px 40px 0;">
              <div class="sans" style="font-family:'DM Sans',Arial,sans-serif; font-size:11px; letter-spacing:2px; text-transform:uppercase; color:#AFC6E9;">Il sostegno</div>
              <div class="serif" style="font-family:'Playfair Display',Georgia,serif; font-size:22px; line-height:1.25; color:#D9CFC3; padding-top:10px;">Hanno scelto di sostenere la serata</div>
              <div class="sans" style="font-family:'DM Sans',Arial,sans-serif; font-size:13.5px; line-height:1.65; color:#97A3B3; padding-top:12px; max-width:430px; margin:0 auto;">Realtà del territorio che ci hanno dato una mano e hanno creduto in questa prima serata.</div>
            </td>
          </tr>

          <!-- Studio Essere -->
          <tr>
            <td class="px" style="padding:18px 40px 0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#0E2236" style="background:#0E2236; border:1px solid #21405f; border-radius:12px;">
                <tr><td align="center" style="padding:20px 24px;">
                  <div class="sans" style="font-family:'DM Sans',Arial,sans-serif; font-size:10.5px; letter-spacing:1.5px; text-transform:uppercase; color:#C4A962;">Respiro &amp; consapevolezza</div>
                  <div class="serif" style="font-family:'Playfair Display',Georgia,serif; font-size:18px; color:#D9CFC3; padding-top:5px;">Studio Essere</div>
                  <div class="sans" style="font-family:'DM Sans',Arial,sans-serif; font-size:13px; line-height:1.6; color:#9aa6b4; padding-top:6px;">Con Michele Uliana, per ricordarci che tutto parte dal respiro e dall'ascolto di sé.</div>
                  <div style="padding-top:9px;"><a href="https://www.studio-essere.com/" target="_blank" class="sans" style="font-family:'DM Sans',Arial,sans-serif; font-size:12.5px; color:#AFC6E9; text-decoration:underline;">studio-essere.com →</a></div>
                </td></tr>
              </table>
            </td>
          </tr>
          <!-- Forno Maistrello -->
          <tr>
            <td class="px" style="padding:12px 40px 0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#0E2236" style="background:#0E2236; border:1px solid #21405f; border-radius:12px;">
                <tr><td align="center" style="padding:20px 24px;">
                  <div class="sans" style="font-family:'DM Sans',Arial,sans-serif; font-size:10.5px; letter-spacing:1.5px; text-transform:uppercase; color:#C4A962;">Il rinfresco</div>
                  <div class="serif" style="font-family:'Playfair Display',Georgia,serif; font-size:18px; color:#D9CFC3; padding-top:5px;">Forno Maistrello</div>
                  <div class="sans" style="font-family:'DM Sans',Arial,sans-serif; font-size:13px; line-height:1.6; color:#9aa6b4; padding-top:6px;">Per aver dato sapore e calore al momento conviviale, con la bontà dei suoi prodotti.</div>
                  <div style="padding-top:9px;"><a href="https://www.facebook.com/p/Forno-Maistrello-100057686438396/" target="_blank" class="sans" style="font-family:'DM Sans',Arial,sans-serif; font-size:12.5px; color:#AFC6E9; text-decoration:underline;">Vai alla pagina →</a></div>
                </td></tr>
              </table>
            </td>
          </tr>
          <!-- Jessydance -->
          <tr>
            <td class="px" style="padding:12px 40px 0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#0E2236" style="background:#0E2236; border:1px solid #21405f; border-radius:12px;">
                <tr><td align="center" style="padding:20px 24px;">
                  <div class="sans" style="font-family:'DM Sans',Arial,sans-serif; font-size:10.5px; letter-spacing:1.5px; text-transform:uppercase; color:#C4A962;">La danza</div>
                  <div class="serif" style="font-family:'Playfair Display',Georgia,serif; font-size:18px; color:#D9CFC3; padding-top:5px;">Jessydance ASD</div>
                  <div class="sans" style="font-family:'DM Sans',Arial,sans-serif; font-size:13px; line-height:1.6; color:#9aa6b4; padding-top:6px;">Per aver riempito la sala di movimento e chiuso la serata con una performance che resta.</div>
                  <div style="padding-top:9px;"><a href="https://jessydanceasd9.wixsite.com/website" target="_blank" class="sans" style="font-family:'DM Sans',Arial,sans-serif; font-size:12.5px; color:#AFC6E9; text-decoration:underline;">jessydanceasd9.wixsite.com →</a></div>
                </td></tr>
              </table>
            </td>
          </tr>

          <tr><td class="px" style="padding:30px 40px 0;"><div style="height:1px; background:#16304a;"></div></td></tr>

          <!-- CTA FEEDBACK -->
          <tr>
            <td class="px" align="center" style="padding:28px 40px 0;">
              <div class="serif" style="font-family:'Playfair Display',Georgia,serif; font-size:24px; line-height:1.25; color:#D9CFC3;">Cosa ti è rimasto<br />di questa serata?</div>
              <div class="sans" style="font-family:'DM Sans',Arial,sans-serif; font-size:14px; line-height:1.7; color:#97A3B3; padding-top:14px; max-width:430px; margin:0 auto 24px;">
                Ci farebbe piacere leggere il tuo pensiero — anche solo poche parole. Lo custodiamo con cura e ci aiuta a far crescere la prossima.
              </div>

              <!-- primary button -->
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto;">
                <tr>
                  <td align="center" bgcolor="#D9CFC3" style="border-radius:100px;">
                    <a href="https://liberidalsuccesso.it/grazie.html#feedback" target="_blank" class="sans" style="display:inline-block; padding:14px 34px; font-family:'DM Sans',Arial,sans-serif; font-size:15px; font-weight:600; color:#0B1C2D; text-decoration:none; border-radius:100px;">Lascia un pensiero</a>
                  </td>
                </tr>
              </table>

              <!-- secondary button -->
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:14px auto 0;">
                <tr>
                  <td align="center" style="border:1px solid #38506b; border-radius:100px;">
                    <a href="https://liberidalsuccesso.it/grazie.html" target="_blank" class="sans" style="display:inline-block; padding:13px 32px; font-family:'DM Sans',Arial,sans-serif; font-size:14px; color:#D9CFC3; text-decoration:none; border-radius:100px;">Rivivi la serata in foto</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- FOOTER -->
          <tr>
            <td class="px" align="center" style="padding:34px 40px 36px;">
              <div style="height:1px; background:#16304a; margin-bottom:24px;"></div>
              <div class="serif" style="font-family:'Playfair Display',Georgia,serif; font-style:italic; font-size:13px; line-height:1.7; color:#9c8a55;">
                Non per imparare ad avere successo.<br />Ma per imparare ad essere noi stessi.
              </div>
              <div class="sans" style="font-family:'DM Sans',Arial,sans-serif; font-size:11px; color:#5f6b7a; padding-top:18px;">
                © 2026 Liberi dal Successo · Bresseo, Teolo (PD)<br />
                <a href="https://liberidalsuccesso.it" target="_blank" style="color:#6f7d8d; text-decoration:none;">liberidalsuccesso.it</a>
              </div>
            </td>
          </tr>

        </table>

      </td>
    </tr>
  </table>
</body>
</html>
`;
}
