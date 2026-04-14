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

  if (payload.eventType === "click") {
    await mouse.click(toMouseButton(payload.button));
  }

  return { ok: true, simulated: true };
}

async function executeRemoteKeyboard(payload) {
  const key = toNutKey(payload.key);

  if (!key && payload.eventType === "keydown" && isPrintableKey(payload.key)) {
    await keyboard.type(payload.key);
    return { ok: true, simulated: true };
  }

  if (!key) {
    return { ok: false, simulated: false };
  }

  if (payload.eventType === "keyup") {
    await keyboard.releaseKey(key);
    return { ok: true, simulated: true };
  }

  if (isModifierKey(payload.key)) {
    await keyboard.pressKey(key);
    return { ok: true, simulated: true };
  }

  await keyboard.type(key);
  return { ok: true, simulated: true };
}

function toScreenPoint(payload) {
  const display = screen.getPrimaryDisplay();
  const width = Math.max(payload.width || 1, 1);
  const height = Math.max(payload.height || 1, 1);
  const x = Math.round((payload.x / width) * display.size.width);
  const y = Math.round((payload.y / height) * display.size.height);

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

module.exports = {
  executeRemoteKeyboard,
  executeRemoteMouse
};
