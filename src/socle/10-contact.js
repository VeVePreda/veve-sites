
// Reassemble les adresses de contact cote navigateur (anti-aspirateur).
(function () {
  var els = document.querySelectorAll('.mail');
  for (var i = 0; i < els.length; i++) {
    var u = els[i].getAttribute('data-u'), d = els[i].getAttribute('data-d');
    if (!u || !d) continue;
    var a = u + String.fromCharCode(64) + d;
    var link = document.createElement('a');
    link.href = 'mai' + 'lto' + ':' + a;
    link.textContent = a;
    els[i].textContent = '';
    els[i].appendChild(link);
  }
})();
