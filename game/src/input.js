// input.js — keyboard and mouse state for Tanjung Matahari.
//
// Keys are tracked by `code` (KeyW, ArrowUp, Space, ...) rather than by the
// character they produce, so the game plays the same on any keyboard
// layout. Mouse drag orbits the camera; a short click (press and release
// within a few pixels) counts as a shot, not a drag.

const SCROLL_KEYS = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'];

export class Input {
  constructor(canvas) {
    this.keys = new Set();
    // Keys pressed since the last poll() — consumed once, so a single press
    // of M cannot open and close the map in the same frame.
    this.pressed = new Set();
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.mouseDown = false;
    this.clicked = false;
    this.dragging = false;
    this.lastX = 0;
    this.lastY = 0;

    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.keys.add(e.code);
      this.pressed.add(e.code);
      // Stop arrows and space from scrolling the page while playing.
      if (SCROLL_KEYS.includes(e.code)) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    // Losing the window must not leave a key stuck down.
    window.addEventListener('blur', () => this.keys.clear());

    canvas.addEventListener('mousedown', (e) => {
      this.mouseDown = true;
      this.dragging = true;
      this.lastX = e.clientX;
      this.lastY = e.clientY;
    });
    window.addEventListener('mouseup', (e) => {
      if (this.dragging && Math.hypot(e.clientX - this.lastX, e.clientY - this.lastY) < 5) {
        this.clicked = true;
      }
      this.mouseDown = false;
      this.dragging = false;
    });
    window.addEventListener('mousemove', (e) => {
      if (!this.dragging) return;
      this.mouseDX += e.clientX - this.lastX;
      this.mouseDY += e.clientY - this.lastY;
      this.lastX = e.clientX;
      this.lastY = e.clientY;
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  down(code) {
    return this.keys.has(code);
  }

  // True when any of the given codes is held down.
  anyDown(...codes) {
    for (const c of codes) if (this.keys.has(c)) return true;
    return false;
  }

  wasPressed(code) {
    return this.pressed.has(code);
  }

  // True once for a key pressed since the last poll(), then consumed.
  consumePressed(code) {
    if (!this.pressed.has(code)) return false;
    this.pressed.delete(code);
    return true;
  }

  // True once for a mouse click since the last poll(), then consumed.
  // The game uses this for shooting, so one click is one shot.
  consumeClick() {
    if (!this.clicked) return false;
    this.clicked = false;
    return true;
  }

  // WASD or arrow keys as a 2D axis: x is strafe/steer, y is forward/back.
  axis() {
    let x = 0;
    let y = 0;
    if (this.down('KeyA') || this.down('ArrowLeft')) x -= 1;
    if (this.down('KeyD') || this.down('ArrowRight')) x += 1;
    if (this.down('KeyW') || this.down('ArrowUp')) y += 1;
    if (this.down('KeyS') || this.down('ArrowDown')) y -= 1;
    return { x, y };
  }

  // Mouse movement since the last call, then reset.
  consumeMouse() {
    const dx = this.mouseDX;
    const dy = this.mouseDY;
    this.mouseDX = 0;
    this.mouseDY = 0;
    return { dx, dy };
  }

  // End of frame: forget one-shot presses and clicks.
  poll() {
    this.pressed.clear();
    this.clicked = false;
  }
}
