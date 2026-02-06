// vendorScrollbar.js - Custom scrollbar for products scroll container

(function() {
  var el = document.getElementById('productsScroll'),
      track = document.getElementById('scrollTrack'),
      thumb = document.getElementById('scrollThumb'),
      dragging = false,
      dragY = 0,
      dragTop = 0;

  if (!el || !track || !thumb) return;

  function update() {
    var ratio = el.clientHeight / el.scrollHeight,
        thumbH = Math.max(30, track.clientHeight * ratio),
        maxTop = track.clientHeight - thumbH,
        scrollRatio = el.scrollTop / (el.scrollHeight - el.clientHeight);
    thumb.style.height = thumbH + 'px';
    thumb.style.top = (maxTop * scrollRatio) + 'px';
  }

  el.addEventListener('scroll', update);
  update();

  thumb.addEventListener('mousedown', function(e) {
    dragging = true;
    dragY = e.clientY;
    dragTop = parseInt(thumb.style.top) || 0;
    e.preventDefault();
  });

  thumb.addEventListener('touchstart', function(e) {
    dragging = true;
    dragY = e.touches[0].clientY;
    dragTop = parseInt(thumb.style.top) || 0;
    e.preventDefault();
  }, { passive: false });

  document.addEventListener('mousemove', function(e) {
    if (!dragging) return;
    move(e.clientY);
  });

  document.addEventListener('touchmove', function(e) {
    if (!dragging) return;
    move(e.touches[0].clientY);
  }, { passive: false });

  document.addEventListener('mouseup', function() {
    dragging = false;
  });

  document.addEventListener('touchend', function() {
    dragging = false;
  });

  function move(y) {
    var ratio = el.clientHeight / el.scrollHeight,
        thumbH = Math.max(30, track.clientHeight * ratio),
        maxTop = track.clientHeight - thumbH,
        newTop = Math.min(maxTop, Math.max(0, dragTop + (y - dragY)));
    thumb.style.top = newTop + 'px';
    el.scrollTop = (newTop / maxTop) * (el.scrollHeight - el.clientHeight);
  }

  track.addEventListener('click', function(e) {
    if (e.target === thumb) return;
    var rect = track.getBoundingClientRect(),
        ratio = el.clientHeight / el.scrollHeight,
        thumbH = Math.max(30, track.clientHeight * ratio),
        clickPos = e.clientY - rect.top - thumbH / 2,
        maxTop = track.clientHeight - thumbH;
    el.scrollTop = (Math.max(0, Math.min(maxTop, clickPos)) / maxTop) * (el.scrollHeight - el.clientHeight);
  });
})();
