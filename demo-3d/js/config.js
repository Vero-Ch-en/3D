/*
 * Personalisation for the 3D demo.
 *
 * You don't need to edit this file. The demo reads the 2D game's config
 * (../cozy-birthday-simulator/js/config.js) when it's next to it in the repo, so
 * names, nicknames and the birthday message live in one place for both games.
 * The values below are only used when the 3D folder is hosted on its own; if you
 * host it that way, copy your edits from the 2D config into here.
 */
(() => {
  const defaults = {
    playerLabel: 'You',
    partnerLabel: 'Partner',
    // What they call each other in the 3D game.
    // She calls him “my charming partner”; he calls her “my lovely partner”; both say “my dearest” / “my dearest partner”.
    callPlayer: 'my charming partner',
    callPartner: 'my lovely partner',
    callBoth: ['my dearest', 'my dearest partner'],
    // The card at the end of the 3D game.
    closing: {
      heading: 'Still here. Still us.',
      // After most endings, one line. The whole thing only after The First Snow.
      short: 'However it ended: somewhere, someone is still whistling three notes for you.',
      full: [
        'Somewhere there is a cabin in the snow, with two mugs on the drying rack. Only two.',
        'Someone always steals the blanket. Someone always stops at the kitchen door and complains about the floor.',
        'Neither of them remembers exactly how it started. It doesn’t matter. They keep choosing it, one ordinary morning at a time.',
        'If you ever get lost, whistle. Three notes, slightly flat on the last one. Someone will come and find you.',
      ],
      signature: '',
    },
    birthday: {
      heading: 'Happy birthday.',
      short: 'Whichever ending you found: happy birthday. I am so glad you exist.',
      full: [
        'I made you a small world full of ordinary things, because the ordinary things are where I keep finding you.',
        'Stolen blankets. Disputed races. Pancakes that go missing when you look away for one second.',
        'I don’t remember exactly how it started. I’m still glad it did.',
        'Here’s to another year of choosing each other on purpose.',
      ],
      signature: '— with love, from the person who made this',
    },
  };
  const given = window.CBS_CONFIG || {};
  window.CBS_CONFIG = Object.assign({}, defaults, given, { birthday: Object.assign({}, defaults.birthday, given.birthday || {}), closing: Object.assign({}, defaults.closing, given.closing || {}) });
})();
