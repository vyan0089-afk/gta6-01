// input.js — Keyboard, mouse and gamepad for Tanjung Matahari.
// One object owns every device: keys held, keys just pressed, mouse drag
// for the camera, and a polled gamepad. The game reads axes (moveX/moveY)
// and edge-triggered actions (pressed('KeyE')) each frame, so the main loop
// never touches the DOM events itself. Mouse click fires the weapon; the
// wheel is handled by the HUD. Gamepad: left stick moves, right stick aims
// the camera, A enters cars, RT drives, X shoots, Y changes weapon.

/** Key codes the game listens to. */
export const KEYS = {
  up: ['KeyW', 'ArrowUp'],
  down: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  sprint: ['ShiftLeft', 'ShiftRight'],
  jump: ['Space'],
  enter: ['KeyE'],
  weapon: ['KeyQ'],
  radio: ['KeyR'],
  map: ['KeyM'],
  pause: ['Escape', 'KeyP'],
  reload: ['KeyT'],
  nitro: ['ShiftLeft', 'ShiftRight'],
  interact: ['KeyF'],
};

export class Input {
  constructor() {
    this.held = new Set();
    this.pressedSet = new Set();
    // Edge state is double-buffered: keydown events land in pressedSet at
    // any time, update() moves them into consumed at the start of a frame,
    // and the game reads consumed during that frame. A key that arrives
    // mid-frame (after the step, before endFrame) is never lost.
    this.consumed = new Set();
    this.frameClicked = false;
    this.moveX = 0;
    this.moveY = 0;
    this.sprint = false;
    this.jump = false;
    this.handbrake = false;
    this.lookDX = 0;
    this.lookDY = 0;
    this.mouseDown = false;
    this.mouseClicked = false;
    this.gamepadIndex = null;
    this.pad = { moveX: 0, moveY: 0, lookX: 0, lookY: 0, gas: 0, brake: 0 };
    this.padPressed = new Set();
    this._onKeyDown = (e) => this.onKeyDown(e);
    this._onKeyUp = (e) => this.onKeyUp(e);
    this._onMouseDown = (e) => this.onMouseDown(e);
    this._onMouseUp = (e) => this.onMouseUp(e);
    this._onMouseMove = (e) => this.onMouseMove(e);
    this._onBlur = () => this.held.clear();
    this._onPadConnect = (e) => { this.gamepadIndex = e.gamepad.index; };
    this._onPadDisconnect = () => { this.gamepadIndex = null; };
    this.dragging = false;
    this.lastX = 0;
    this.lastY = 0;
    // Touch controls: left half is a virtual stick, right half drags the
    // camera, a quick tap on the right fires the weapon.
    this.touchMove = null; // {id, startX, startY, x, y}
    this.touchLook = null;
    this.touchTapAt = 0;
    this._onTouchStart = (e) => this.onTouchStart(e);
    this._onTouchMove = (e) => this.onTouchMove(e);
    this._onTouchEnd = (e) => this.onTouchEnd(e);
  }

  /** Attach all listeners. */
  attach() {
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('mousedown', this._onMouseDown);
    window.addEventListener('mouseup', this._onMouseUp);
    window.addEventListener('mousemove', this._onMouseMove);
    window.addEventListener('blur', this._onBlur);
    window.addEventListener('gamepadconnected', this._onPadConnect);
    window.addEventListener('gamepaddisconnected', this._onPadDisconnect);
    window.addEventListener('touchstart', this._onTouchStart, { passive: false });
    window.addEventListener('touchmove', this._onTouchMove, { passive: false });
    window.addEventListener('touchend', this._onTouchEnd);
    window.addEventListener('touchcancel', this._onTouchEnd);
  }

  /** Detach all listeners. */
  detach() {
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
    window.removeEventListener('mousedown', this._onMouseDown);
    window.removeEventListener('mouseup', this._onMouseUp);
    window.removeEventListener('mousemove', this._onMouseMove);
    window.removeEventListener('blur', this._onBlur);
    window.removeEventListener('gamepadconnected', this._onPadConnect);
    window.removeEventListener('gamepaddisconnected', this._onPadDisconnect);
    window.removeEventListener('touchstart', this._onTouchStart);
    window.removeEventListener('touchmove', this._onTouchMove);
    window.removeEventListener('touchend', this._onTouchEnd);
    window.removeEventListener('touchcancel', this._onTouchEnd);
  }

  /** A finger went down: left half moves, right half looks. */
  onTouchStart(e) {
    if (e.target && (e.target.tagName === 'BUTTON' || e.target.tagName === 'INPUT')) return;
    e.preventDefault();
    for (const t of e.changedTouches) {
      if (t.clientX < window.innerWidth / 2 && !this.touchMove) {
        this.touchMove = { id: t.identifier, startX: t.clientX, startY: t.clientY, x: t.clientX, y: t.clientY };
      } else if (!this.touchLook) {
        this.touchLook = { id: t.identifier, x: t.clientX, y: t.clientY };
        this.touchTapAt = performance.now();
      }
    }
  }

  /** A finger moved: update the virtual stick or the camera drag. */
  onTouchMove(e) {
    e.preventDefault();
    for (const t of e.changedTouches) {
      if (this.touchMove && t.identifier === this.touchMove.id) {
        this.touchMove.x = t.clientX;
        this.touchMove.y = t.clientY;
      } else if (this.touchLook && t.identifier === this.touchLook.id) {
        this.lookDX += t.clientX - this.touchLook.x;
        this.lookDY += t.clientY - this.touchLook.y;
        this.touchLook.x = t.clientX;
        this.touchLook.y = t.clientY;
      }
    }
  }

  /** A finger went up: release the stick, or fire on a quick right tap. */
  onTouchEnd(e) {
    for (const t of e.changedTouches) {
      if (this.touchMove && t.identifier === this.touchMove.id) this.touchMove = null;
      if (this.touchLook && t.identifier === this.touchLook.id) {
        if (performance.now() - this.touchTapAt < 250) this.mouseClicked = true;
        this.touchLook = null;
      }
    }
  }

  /** Virtual stick axes, -1..1, from the touch move finger. */
  touchAxes() {
    if (!this.touchMove) return { x: 0, y: 0 };
    const dx = (this.touchMove.x - this.touchMove.startX) / 48;
    const dy = (this.touchMove.y - this.touchMove.startY) / 48;
    return {
      x: Math.max(-1, Math.min(1, dx)),
      y: Math.max(-1, Math.min(1, -dy)),
    };
  }

  onKeyDown(e) {
    if (e.repeat) return;
    this.held.add(e.code);
    this.pressedSet.add(e.code);
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  }

  onKeyUp(e) {
    this.held.delete(e.code);
  }

  onMouseDown(e) {
    if (e.target && (e.target.tagName === 'BUTTON' || e.target.tagName === 'INPUT')) return;
    this.mouseDown = true;
    this.mouseClicked = true;
    this.dragging = true;
    this.lastX = e.clientX;
    this.lastY = e.clientY;
  }

  onMouseUp() {
    this.mouseDown = false;
    this.dragging = false;
  }

  onMouseMove(e) {
    if (!this.dragging) return;
    this.lookDX += e.clientX - this.lastX;
    this.lookDY += e.clientY - this.lastY;
    this.lastX = e.clientX;
    this.lastY = e.clientY;
  }

  /** True when any of the codes was pressed this frame. */
  pressed(...codes) {
    for (const c of codes) if (this.consumed.has(c)) return true;
    return false;
  }

  /** True when any of the codes is held. */
  heldAny(...codes) {
    for (const c of codes) if (this.held.has(c)) return true;
    return false;
  }

  /** Poll the gamepad and merge it into the axes. */
  pollGamepad() {
    this.pad.moveX = 0;
    this.pad.moveY = 0;
    this.pad.lookX = 0;
    this.pad.lookY = 0;
    this.pad.gas = 0;
    this.pad.brake = 0;
    if (this.gamepadIndex === null) return;
    let gp = null;
    try {
      const pads = navigator.getGamepads ? navigator.getGamepads() : [];
      gp = pads[this.gamepadIndex] || null;
    } catch (e) {
      gp = null;
    }
    if (!gp) return;
    const dz = (v) => (Math.abs(v) < 0.18 ? 0 : v);
    this.pad.moveX = dz(gp.axes[0] || 0);
    this.pad.moveY = -dz(gp.axes[1] || 0);
    this.pad.lookX = dz(gp.axes[2] || 0);
    this.pad.lookY = dz(gp.axes[3] || 0);
    this.pad.gas = gp.buttons[7] ? gp.buttons[7].value : 0;
    this.pad.brake = gp.buttons[6] ? gp.buttons[6].value : 0;
    const edge = (i) => {
      const down = gp.buttons[i] && gp.buttons[i].pressed;
      const key = `pad${i}`;
      if (down && !this.padPressed.has(key)) {
        this.padPressed.add(key);
        return true;
      }
      if (!down) this.padPressed.delete(key);
      return false;
    };
    if (edge(0)) this.pressedSet.add('PadA');
    if (edge(1)) this.pressedSet.add('PadB');
    if (edge(2)) this.pressedSet.add('PadX');
    if (edge(3)) this.pressedSet.add('PadY');
    if (edge(9)) this.pressedSet.add('PadStart');
  }

  /** Recompute axes from keys + pad. Call once per frame. */
  update() {
    // Move pending edge presses into this frame's consumed set.
    this.consumed = this.pressedSet;
    this.pressedSet = new Set();
    this.frameClicked = this.mouseClicked;
    this.mouseClicked = false;
    this.pollGamepad();
    let mx = 0;
    let my = 0;
    if (this.heldAny(...KEYS.right)) mx += 1;
    if (this.heldAny(...KEYS.left)) mx -= 1;
    if (this.heldAny(...KEYS.up)) my += 1;
    if (this.heldAny(...KEYS.down)) my -= 1;
    mx += this.pad.moveX;
    my += this.pad.moveY;
    const ta = this.touchAxes();
    mx += ta.x;
    my += ta.y;
    if (this.pad.gas > 0.1) my = Math.max(my, this.pad.gas);
    if (this.pad.brake > 0.1) my = Math.min(my, -this.pad.brake);
    const len = Math.sqrt(mx * mx + my * my);
    if (len > 1) {
      mx /= len;
      my /= len;
    }
    this.moveX = mx;
    this.moveY = my;
    this.sprint = this.heldAny(...KEYS.sprint);
    this.jump = this.pressed('Space');
    this.handbrake = this.held.has('Space');
    this.lookDX += this.pad.lookX * 6;
    this.lookDY += this.pad.lookY * 4;
  }

  /** Clear edge-triggered state at the end of the frame. */
  endFrame() {
    this.consumed.clear();
    this.lookDX = 0;
    this.lookDY = 0;
  }
}
