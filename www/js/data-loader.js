(function (global) {
  'use strict';

  function tryFetch(name) {
    return fetch('data/' + name).then(r => {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    });
  }

  function load() {
    const inline = global.__AGRI_DATA__;
    if (inline && inline.notes && inline.questions && inline.manifest) {
      return Promise.resolve(inline);
    }
    return Promise.all([
      tryFetch('notes.json'),
      tryFetch('questions.json'),
      tryFetch('manifest.json')
    ]).then(([notes, questions, manifest]) => ({ notes, questions, manifest }));
  }

  global.AgriData = { load };
})(window);
