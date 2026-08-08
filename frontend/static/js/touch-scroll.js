(function () {
  var THRESHOLD = 10;
  var INTERACTIVE = 'input, textarea, select, [contenteditable], button, a, .osk, .user-dropdown, .slider';
  var touchCapable = 'ontouchstart' in window || (navigator.maxTouchPoints && navigator.maxTouchPoints > 0);
  var debug = location.search.indexOf('tsdebug=1') !== -1;

  var active = false;
  var dragging = false;
  var suppressClick = false;
  var startX = 0, startY = 0, lastX = 0, lastY = 0;
  var scroller = null;
  var debugLog = [];

  function dlog(msg) {
    if (!debug) return;
    debugLog.push(msg);
    if (debugLog.length > 7) debugLog.shift();
    var el = document.getElementById('tsdebug-panel');
    if (el) el.textContent = debugLog.join('\n');
  }

  function showDebug() {
    if (!debug) return;
    if (document.getElementById('tsdebug-panel')) return;
    var el = document.createElement('div');
    el.id = 'tsdebug-panel';
    el.style.cssText = 'position:fixed;right:8px;bottom:8px;z-index:99999;background:rgba(0,0,0,0.85);color:#0f0;font:11px/1.4 monospace;padding:8px;border-radius:6px;max-width:60vw;white-space:pre-wrap;pointer-events:none;';
    document.body.appendChild(el);
    dlog('ts loaded v2');
    dlog('touchCapable=' + touchCapable);
    dlog('maxTouchPoints=' + (navigator.maxTouchPoints || 0));
    dlog('PointerEvent=' + !!window.PointerEvent);
  }

  function findScroller(el) {
    var node = el;
    while (node && node.nodeType === 1) {
      var s = getComputedStyle(node);
      var oy = s.overflowY;
      if ((oy === 'auto' || oy === 'scroll' || oy === 'overlay') && node.scrollHeight > node.clientHeight) {
        return node;
      }
      node = node.parentNode;
    }
    return null;
  }

  function isInteractive(el) {
    return !!(el && el.nodeType === 1 && el.closest && el.closest(INTERACTIVE));
  }

  function scrollBy(dx, dy) {
    if (scroller) {
      scroller.scrollLeft -= dx;
      scroller.scrollTop -= dy;
    } else {
      window.scrollBy(-dx, -dy);
    }
  }

  function beginDrag(x, y, type, el) {
    if (active) return;
    if (!el || el.nodeType !== 1) return;
    if (isInteractive(el)) return;
    active = true;
    dragging = false;
    suppressClick = false;
    startX = lastX = x;
    startY = lastY = y;
    scroller = findScroller(el);
    dlog('down:' + type + ' -> ' + (scroller ? scroller.className || scroller.tagName : 'window'));
  }

  function moveDrag(x, y) {
    if (!active) return;
    if (!dragging) {
      if (Math.abs(x - startX) < THRESHOLD && Math.abs(y - startY) < THRESHOLD) return;
      dragging = true;
      dlog('drag on');
    }
    scrollBy(x - lastX, y - lastY);
    lastX = x;
    lastY = y;
  }

  function endDrag() {
    if (!active) return;
    if (dragging) suppressClick = true;
    active = false;
    dragging = false;
    scroller = null;
    dlog('up' + (suppressClick ? ' (clicksuppressed)' : ''));
  }

  if (touchCapable) {
    document.documentElement.style.touchAction = 'none';
  }

  if (window.PointerEvent) {
    document.addEventListener('pointerdown', function (e) {
      if (e.button !== 0) return;
      beginDrag(e.clientX, e.clientY, 'ptr:' + e.pointerType, e.target);
    }, true);

    document.addEventListener('pointermove', function (e) {
      if (!active) return;
      if (!dragging && Math.abs(e.clientX - startX) < THRESHOLD && Math.abs(e.clientY - startY) < THRESHOLD) return;
      if (!dragging) dragging = true;
      e.preventDefault();
      scrollBy(e.clientX - lastX, e.clientY - lastY);
      lastX = e.clientX;
      lastY = e.clientY;
    }, { capture: true, passive: false });

    document.addEventListener('pointerup', endDrag, true);
    document.addEventListener('pointercancel', endDrag, true);
  } else {
    document.addEventListener('touchstart', function (e) {
      var t = e.changedTouches && e.changedTouches[0];
      if (!t) return;
      if (active) return;
      beginDrag(t.clientX, t.clientY, 'touch', e.target);
    }, { capture: true, passive: false });

    document.addEventListener('touchmove', function (e) {
      if (!active) return;
      var t = e.changedTouches && e.changedTouches[0];
      if (!t) return;
      e.preventDefault();
      moveDrag(t.clientX, t.clientY);
    }, { capture: true, passive: false });

    document.addEventListener('touchend', endDrag, true);
    document.addEventListener('touchcancel', endDrag, true);
  }

  document.addEventListener('click', function (e) {
    if (!suppressClick) return;
    suppressClick = false;
    e.preventDefault();
    e.stopPropagation();
  }, true);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', showDebug);
  } else {
    showDebug();
  }
})();
