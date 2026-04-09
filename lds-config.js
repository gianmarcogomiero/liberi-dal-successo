/**
 * Liberi dal Successo — configurazione condivisa (aggiorna qui prima di pubblicare)
 * Caricato da index.html e iscrizioni.html
 */
(function () {
  'use strict';

  window.LDS = {
    /** true = capienza evento piena → CTA lista d'attesa */
    eventFull: false,

    /** Capienza massima (per messaggi e barra posti; aggiorna a mano se serve) */
    spotsMax: 200,

    /** Posti già assegnati / iscritti confermati (stima manuale per copy in homepage) */
    spotsRegistered: 0,

    /** Numero indicativo in lista d'attesa (null = non mostrare riga dedicata) */
    waitlistApprox: null,

    /** Speaker confermati (null = nascondi) */
    speakersConfirmed: null,

    /** Volontari confermati (null = nascondi) */
    volunteersConfirmed: null,

    /** Testo breve banner lista d'attesa (iscrizioni) — tono positivo */
    waitlistIntro:
      'I posti per la serata sono tutti occupati, ma la lista d’attesa ci aiuta a organizzarci: se si libera un posto, ti scriviamo. Iscriversi resta utile anche così: ci fai capire quante persone ci tengono a esserci.',

    /** Sottotitolo opzionale sotto lo strip hero (null = nascosto) */
    heroStripNote: null
  };
})();
