const { screen } = require("electron");
const { Button, Key, Point, keyboard, mouse, straightTo } = require("@nut-tree-fork/nut-js");

keyboard.config.autoDelayMs = 0;
mouse.config.autoDelayMs = 0;
mouse.config.mouseSpeed = 3000;

const modifierKeyMap = {
  Alt: Key.LeftAlt,
  Control: Key.LeftControl,
  Shift: Key.LeftShift,
  Meta: Key.LeftSuper
};

const specialKeyMap = {
  Enter: Key.Enter,
  Tab: Key.Tab,
  Escape: Key.Escape,
  Backspace: Key.Backspace,
  Delete: Key.Delete,
  ArrowUp: Key.Up,
  ArrowDown: Key.Down,
  ArrowLeft: Key.Left,
  ArrowRight: Key.Right,
  Home: Key.Home,
  End: Key.End,
  PageUp: Key.PageUp,
  PageDown: Key.PageDown,
  " ": Key.Space,
  Space: Key.Space,
  F1: Key.F1,
  F2: Key.F2,
  F3: Key.F3,
  F4: Key.F4,
  F5: Key.F5,
  F6: Key.F6,
  F7: Key.F7,
  F8: Key.F8,
  F9: Key.F9,
  F10: Key.F10,
  F11: Key.F11,
  F12: Key.F12
};

async function executeRemoteMouse(payload) {
  const point = toScreenPoint(payload);
  await mouse.move(straightTo(point));

  if (payload.eventType === "mousedown") {
    await mouse.pressButton(toMouseButton(payload.button));
  }

  if (payload.eventType === "mouseup") {
    await mouse.releaseButton(toMouseButton(payload.button));
  }

  if (payload.eventType === "click") {
    await mouse.click(toMouseButton(payload.button));
  }

  if (payload.eventType === "dblclick") {
    await mouse.doubleClick(toMouseButton(payload.button));
  }

  if (payload.eventType === "contextmenu") {
    await mouse.click(Button.RIGHT);
  }

  return { ok: true, simulated: true, action: payload.eventType, point };
}

async function executeRemoteKeyboard(payload) {
  const key = toNutKey(payload.key);
  const modifiers = getModifierKeys(payload);

  if (!key && payload.eventType === "keydown" && isPrintableKey(payload.key) && modifiers.length === 0) {
    await keyboard.type(payload.key);
    return { ok: true, simulated: true, action: `type:${payload.key}` };
  }

  if (!key) {
    return { ok: false, simulated: false, action: "ignored" };
  }

  if (payload.eventType === "keyup") {
    if (!isModifierKey(payload.key) && modifiers.length > 0) {
      return { ok: true, simulated: false, action: `skip-keyup:${payload.key}` };
    }

    await keyboard.releaseKey(key);
    return { ok: true, simulated: true, action: `release:${payload.key}` };
  }

  if (isModifierKey(payload.key)) {
    await keyboard.pressKey(key);
    return { ok: true, simulated: true, action: `press:${payload.key}` };
  }

  if (modifiers.length > 0) {
    await keyboard.pressKey(...modifiers);
    await keyboard.pressKey(key);
    await keyboard.releaseKey(key);
    await keyboard.releaseKey(...modifiers.slice().reverse());
    return { ok: true, simulated: true, action: `shortcut:${payload.key}` };
  }

  await keyboard.type(key);
  return { ok: true, simulated: true, action: `type:${payload.key}` };
}

async function executeRemoteScroll(payload) {
  const amount = Number(payload.deltaY || 0);
  const direction = amount > 0 ? "down" : "up";
  const steps = Math.max(1, Math.min(10, Math.round(Math.abs(amount) / 40) || 1));

  await mouse.scrollDown(direction === "down" ? steps : 0);
  await mouse.scrollUp(direction === "up" ? steps : 0);

  return { ok: true, simulated: true, action: `scroll:${direction}:${steps}` };
}

function toScreenPoint(payload) {
  const display = screen.getPrimaryDisplay();
  const scaleFactor = display.scaleFactor || 1;
  const normalizedX = clamp(
    Number.isFinite(payload.normalizedX) ? payload.normalizedX : payload.x / Math.max(payload.width || 1, 1),
    0,
    1
  );
  const normalizedY = clamp(
    Number.isFinite(payload.normalizedY) ? payload.normalizedY : payload.y / Math.max(payload.height || 1, 1),
    0,
    1
  );
  const x = Math.round((display.bounds.x + (normalizedX * display.bounds.width)) * scaleFactor);
  const y = Math.round((display.bounds.y + (normalizedY * display.bounds.height)) * scaleFactor);

  return new Point(x, y);
}

function toMouseButton(button) {
  if (button === 1) {
    return Button.MIDDLE;
  }

  if (button === 2) {
    return Button.RIGHT;
  }

  return Button.LEFT;
}

function toNutKey(key) {
  if (modifierKeyMap[key]) {
    return modifierKeyMap[key];
  }

  if (specialKeyMap[key]) {
    return specialKeyMap[key];
  }

  if (/^[a-z]$/i.test(key)) {
    return Key[key.toUpperCase()];
  }

  if (/^[0-9]$/.test(key)) {
    return Key[`Num${key}`] || null;
  }

  return null;
}

function isPrintableKey(key) {
  return typeof key === "string" && key.length === 1;
}

function isModifierKey(key) {
  return key in modifierKeyMap;
}

function getModifierKeys(payload) {
  const modifierKeys = [];

  if (payload.ctrlKey && payload.key !== "Control") {
    modifierKeys.push(Key.LeftControl);
  }

  if (payload.altKey && payload.key !== "Alt") {
    modifierKeys.push(Key.LeftAlt);
  }

  if (payload.shiftKey && payload.key !== "Shift") {
    modifierKeys.push(Key.LeftShift);
  }

  if (payload.metaKey && payload.key !== "Meta") {
    modifierKeys.push(Key.LeftSuper);
  }

  return modifierKeys;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

module.exports = {
  executeRemoteKeyboard,
  executeRemoteMouse,
  executeRemoteScroll
};
