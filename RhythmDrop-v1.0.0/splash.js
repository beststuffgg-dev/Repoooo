(function () {
  var splash = document.getElementById('intro-splash');
  if (!splash) return;
  splash.addEventListener('animationend', function (e) {
    if (e.target === splash) splash.remove();
  });
})();
