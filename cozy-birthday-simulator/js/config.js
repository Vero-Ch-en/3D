/*
 * Cozy Birthday Simulator — personal configuration.
 *
 * This is the only file you need to edit to make the gift yours.
 * Names appear as dialogue labels; the birthday message is shown after every
 * ending (short form) and in full after The First Snow.
 */
window.CBS_CONFIG = {
  // How the two characters are labelled in dialogue.
  playerLabel: 'You',
  partnerLabel: 'Partner',

  // What Partner calls the player, and what the player calls Partner.
  nickForPlayer: 'giant',
  nickForPartner: 'gremlin',

  // The real birthday message — the one thing in the game the Entity cannot counterfeit.
  birthday: {
    heading: 'Happy birthday.',
    // Shown briefly after every ending.
    short: 'Whichever ending you found: happy birthday. I am so glad you exist.',
    // Shown in full after The First Snow.
    full: [
      'I made you a small world full of ordinary things, because the ordinary things are where I keep finding you.',
      'Stolen blankets. Disputed races. Pancakes that go missing when you look away for one second.',
      'I don’t remember exactly how it started. I’m still glad it did.',
      'Here’s to another year of choosing each other on purpose.'
    ],
    signature: '— with love, from the person who made this'
  }
};
