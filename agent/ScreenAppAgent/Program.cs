using System.Runtime.InteropServices;
using System.Windows.Forms;

SetProcessDPIAware();

var builder = WebApplication.CreateBuilder(args);
builder.WebHost.UseUrls("http://127.0.0.1:47071");

var app = builder.Build();

app.MapGet("/health", () => Results.Json(new
{
  ok = true,
  service = "ScreenAppAgent",
  version = "1.0.0"
}));

app.MapGet("/displays", () => Results.Json(DisplayController.GetDisplays()));

app.MapPost("/mouse", (MousePayload payload) =>
{
  return Results.Json(InputController.ExecuteMouse(payload));
});

app.MapPost("/keyboard", (KeyboardPayload payload) =>
{
  return Results.Json(InputController.ExecuteKeyboard(payload));
});

app.MapPost("/scroll", (ScrollPayload payload) =>
{
  return Results.Json(InputController.ExecuteScroll(payload));
});

app.Run();

static void SetProcessDPIAware()
{
  try
  {
    NativeMethods.SetProcessDPIAware();
  }
  catch
  {
    // Best effort only. The agent still works without this call.
  }
}

record MousePayload(
  string? EventType,
  double? NormalizedX,
  double? NormalizedY,
  int? Button,
  string? DisplayId
);

record KeyboardPayload(
  string? EventType,
  string? Key,
  string? Code,
  bool CtrlKey,
  bool AltKey,
  bool ShiftKey,
  bool MetaKey
);

record ScrollPayload(
  double DeltaY
);

static class DisplayController
{
  public static object[] GetDisplays()
  {
    return Screen.AllScreens.Select(screen => new
    {
      id = screen.DeviceName,
      primary = screen.Primary,
      bounds = new
      {
        x = screen.Bounds.X,
        y = screen.Bounds.Y,
        width = screen.Bounds.Width,
        height = screen.Bounds.Height
      },
      workingArea = new
      {
        x = screen.WorkingArea.X,
        y = screen.WorkingArea.Y,
        width = screen.WorkingArea.Width,
        height = screen.WorkingArea.Height
      }
    }).Cast<object>().ToArray();
  }

  public static Screen ResolveDisplay(string? displayId)
  {
    if (!string.IsNullOrWhiteSpace(displayId))
    {
      var match = Screen.AllScreens.FirstOrDefault(screen => screen.DeviceName.Equals(displayId, StringComparison.OrdinalIgnoreCase));
      if (match is not null)
      {
        return match;
      }
    }

    return Screen.PrimaryScreen ?? Screen.AllScreens.First();
  }
}

static class InputController
{
  public static object ExecuteMouse(MousePayload payload)
  {
    var eventType = payload.EventType?.Trim().ToLowerInvariant();
    if (string.IsNullOrWhiteSpace(eventType))
    {
      return new { ok = false, error = "Mouse eventType lipsa" };
    }

    var targetDisplay = DisplayController.ResolveDisplay(payload.DisplayId);
    var point = ToAbsolutePoint(targetDisplay, payload.NormalizedX ?? 0.5, payload.NormalizedY ?? 0.5);

    MoveCursor(point);

    if (eventType == "mousedown")
    {
      SendMouseButton(payload.Button ?? 0, false);
    }
    else if (eventType == "mouseup")
    {
      SendMouseButton(payload.Button ?? 0, true);
    }

    return new
    {
      ok = true,
      action = eventType,
      point = new { x = point.X, y = point.Y },
      display = targetDisplay.DeviceName
    };
  }

  public static object ExecuteKeyboard(KeyboardPayload payload)
  {
    var eventType = payload.EventType?.Trim().ToLowerInvariant();
    var key = payload.Key?.Trim();

    if (string.IsNullOrWhiteSpace(eventType) || string.IsNullOrWhiteSpace(key))
    {
      return new { ok = false, error = "Keyboard payload invalid" };
    }

    var modifierKeys = GetModifierVirtualKeys(payload, key);

    if (TryGetModifierVirtualKey(key, out var modifierVirtualKey))
    {
      SendKeyboard(modifierVirtualKey, eventType == "keyup");
      return new { ok = true, action = $"{eventType}:{key}" };
    }

    if (eventType == "keyup" && modifierKeys.Length > 0)
    {
      return new { ok = true, action = $"skip-keyup:{key}" };
    }

    if (!TryGetVirtualKey(key, out var virtualKey))
    {
      if (eventType == "keydown" && key.Length == 1 && modifierKeys.Length == 0)
      {
        SendUnicodeCharacter(key[0]);
        return new { ok = true, action = $"type:{key}" };
      }

      return new { ok = false, error = $"Tasta necunoscuta: {key}" };
    }

    if (modifierKeys.Length > 0)
    {
      foreach (var modifier in modifierKeys)
      {
        SendKeyboard(modifier, false);
      }

      SendKeyboard(virtualKey, false);
      SendKeyboard(virtualKey, true);

      for (var i = modifierKeys.Length - 1; i >= 0; i--)
      {
        SendKeyboard(modifierKeys[i], true);
      }

      return new { ok = true, action = $"shortcut:{key}" };
    }

    SendKeyboard(virtualKey, eventType == "keyup");
    return new { ok = true, action = $"{eventType}:{key}" };
  }

  public static object ExecuteScroll(ScrollPayload payload)
  {
    var amount = payload.DeltaY;
    var steps = Math.Max(1, Math.Min(10, (int)Math.Round(Math.Abs(amount) / 40d)));
    var wheelDelta = (amount > 0 ? -1 : 1) * NativeMethods.WHEEL_DELTA * steps;

    var input = new NativeMethods.INPUT
    {
      type = NativeMethods.INPUT_MOUSE,
      U = new NativeMethods.InputUnion
      {
        mi = new NativeMethods.MOUSEINPUT
        {
          mouseData = wheelDelta,
          dwFlags = NativeMethods.MOUSEEVENTF_WHEEL
        }
      }
    };

    NativeMethods.SendInput(1, new[] { input }, Marshal.SizeOf<NativeMethods.INPUT>());

    return new
    {
      ok = true,
      action = amount > 0 ? "scroll:down" : "scroll:up",
      steps
    };
  }

  static Point ToAbsolutePoint(Screen targetDisplay, double normalizedX, double normalizedY)
  {
    normalizedX = Clamp(normalizedX, 0, 1);
    normalizedY = Clamp(normalizedY, 0, 1);

    var virtualLeft = NativeMethods.GetSystemMetrics(NativeMethods.SM_XVIRTUALSCREEN);
    var virtualTop = NativeMethods.GetSystemMetrics(NativeMethods.SM_YVIRTUALSCREEN);
    var virtualWidth = NativeMethods.GetSystemMetrics(NativeMethods.SM_CXVIRTUALSCREEN);
    var virtualHeight = NativeMethods.GetSystemMetrics(NativeMethods.SM_CYVIRTUALSCREEN);

    var pixelX = targetDisplay.Bounds.Left + (int)Math.Round(normalizedX * (targetDisplay.Bounds.Width - 1));
    var pixelY = targetDisplay.Bounds.Top + (int)Math.Round(normalizedY * (targetDisplay.Bounds.Height - 1));

    var absoluteX = (int)Math.Round(((pixelX - virtualLeft) * 65535d) / Math.Max(1, virtualWidth - 1));
    var absoluteY = (int)Math.Round(((pixelY - virtualTop) * 65535d) / Math.Max(1, virtualHeight - 1));

    return new Point(absoluteX, absoluteY);
  }

  static void MoveCursor(Point point)
  {
    var input = new NativeMethods.INPUT
    {
      type = NativeMethods.INPUT_MOUSE,
      U = new NativeMethods.InputUnion
      {
        mi = new NativeMethods.MOUSEINPUT
        {
          dx = point.X,
          dy = point.Y,
          dwFlags = NativeMethods.MOUSEEVENTF_MOVE | NativeMethods.MOUSEEVENTF_ABSOLUTE | NativeMethods.MOUSEEVENTF_VIRTUALDESK
        }
      }
    };

    NativeMethods.SendInput(1, new[] { input }, Marshal.SizeOf<NativeMethods.INPUT>());
  }

  static void SendMouseButton(int button, bool isButtonUp)
  {
    var flags = button switch
    {
      1 => isButtonUp ? NativeMethods.MOUSEEVENTF_MIDDLEUP : NativeMethods.MOUSEEVENTF_MIDDLEDOWN,
      2 => isButtonUp ? NativeMethods.MOUSEEVENTF_RIGHTUP : NativeMethods.MOUSEEVENTF_RIGHTDOWN,
      _ => isButtonUp ? NativeMethods.MOUSEEVENTF_LEFTUP : NativeMethods.MOUSEEVENTF_LEFTDOWN
    };

    var input = new NativeMethods.INPUT
    {
      type = NativeMethods.INPUT_MOUSE,
      U = new NativeMethods.InputUnion
      {
        mi = new NativeMethods.MOUSEINPUT
        {
          dwFlags = flags
        }
      }
    };

    NativeMethods.SendInput(1, new[] { input }, Marshal.SizeOf<NativeMethods.INPUT>());
  }

  static void SendKeyboard(ushort virtualKey, bool keyUp)
  {
    var input = new NativeMethods.INPUT
    {
      type = NativeMethods.INPUT_KEYBOARD,
      U = new NativeMethods.InputUnion
      {
        ki = new NativeMethods.KEYBDINPUT
        {
          wVk = virtualKey,
          dwFlags = keyUp ? NativeMethods.KEYEVENTF_KEYUP : 0
        }
      }
    };

    NativeMethods.SendInput(1, new[] { input }, Marshal.SizeOf<NativeMethods.INPUT>());
  }

  static void SendUnicodeCharacter(char character)
  {
    var keyDown = new NativeMethods.INPUT
    {
      type = NativeMethods.INPUT_KEYBOARD,
      U = new NativeMethods.InputUnion
      {
        ki = new NativeMethods.KEYBDINPUT
        {
          wScan = character,
          dwFlags = NativeMethods.KEYEVENTF_UNICODE
        }
      }
    };

    var keyUp = new NativeMethods.INPUT
    {
      type = NativeMethods.INPUT_KEYBOARD,
      U = new NativeMethods.InputUnion
      {
        ki = new NativeMethods.KEYBDINPUT
        {
          wScan = character,
          dwFlags = NativeMethods.KEYEVENTF_UNICODE | NativeMethods.KEYEVENTF_KEYUP
        }
      }
    };

    NativeMethods.SendInput(2, new[] { keyDown, keyUp }, Marshal.SizeOf<NativeMethods.INPUT>());
  }

  static ushort[] GetModifierVirtualKeys(KeyboardPayload payload, string key)
  {
    var result = new List<ushort>();

    if (payload.CtrlKey && !key.Equals("Control", StringComparison.OrdinalIgnoreCase))
    {
      result.Add(NativeMethods.VK_CONTROL);
    }

    if (payload.AltKey && !key.Equals("Alt", StringComparison.OrdinalIgnoreCase))
    {
      result.Add(NativeMethods.VK_MENU);
    }

    if (payload.ShiftKey && !key.Equals("Shift", StringComparison.OrdinalIgnoreCase))
    {
      result.Add(NativeMethods.VK_SHIFT);
    }

    if (payload.MetaKey && !key.Equals("Meta", StringComparison.OrdinalIgnoreCase))
    {
      result.Add(NativeMethods.VK_LWIN);
    }

    return result.ToArray();
  }

  static bool TryGetModifierVirtualKey(string key, out ushort virtualKey)
  {
    if (key.Equals("Control", StringComparison.OrdinalIgnoreCase))
    {
      virtualKey = NativeMethods.VK_CONTROL;
      return true;
    }

    if (key.Equals("Shift", StringComparison.OrdinalIgnoreCase))
    {
      virtualKey = NativeMethods.VK_SHIFT;
      return true;
    }

    if (key.Equals("Alt", StringComparison.OrdinalIgnoreCase))
    {
      virtualKey = NativeMethods.VK_MENU;
      return true;
    }

    if (key.Equals("Meta", StringComparison.OrdinalIgnoreCase))
    {
      virtualKey = NativeMethods.VK_LWIN;
      return true;
    }

    virtualKey = 0;
    return false;
  }

  static bool TryGetVirtualKey(string key, out ushort virtualKey)
  {
    if (TryGetModifierVirtualKey(key, out virtualKey))
    {
      return true;
    }

    if (key.Length == 1)
    {
      var lookup = NativeMethods.VkKeyScan(key[0]);
      if (lookup != -1)
      {
        virtualKey = (ushort)(lookup & 0xff);
        return true;
      }
    }

    if (SpecialKeys.TryGetValue(key, out virtualKey))
    {
      return true;
    }

    virtualKey = 0;
    return false;
  }

  static double Clamp(double value, double min, double max)
  {
    return Math.Min(Math.Max(value, min), max);
  }

  static readonly Dictionary<string, ushort> SpecialKeys = new(StringComparer.OrdinalIgnoreCase)
  {
    ["Enter"] = NativeMethods.VK_RETURN,
    ["Tab"] = NativeMethods.VK_TAB,
    ["Escape"] = NativeMethods.VK_ESCAPE,
    ["Backspace"] = NativeMethods.VK_BACK,
    ["Delete"] = NativeMethods.VK_DELETE,
    ["ArrowUp"] = NativeMethods.VK_UP,
    ["ArrowDown"] = NativeMethods.VK_DOWN,
    ["ArrowLeft"] = NativeMethods.VK_LEFT,
    ["ArrowRight"] = NativeMethods.VK_RIGHT,
    ["Home"] = NativeMethods.VK_HOME,
    ["End"] = NativeMethods.VK_END,
    ["PageUp"] = NativeMethods.VK_PRIOR,
    ["PageDown"] = NativeMethods.VK_NEXT,
    [" "] = NativeMethods.VK_SPACE,
    ["Space"] = NativeMethods.VK_SPACE,
    ["F1"] = NativeMethods.VK_F1,
    ["F2"] = NativeMethods.VK_F2,
    ["F3"] = NativeMethods.VK_F3,
    ["F4"] = NativeMethods.VK_F4,
    ["F5"] = NativeMethods.VK_F5,
    ["F6"] = NativeMethods.VK_F6,
    ["F7"] = NativeMethods.VK_F7,
    ["F8"] = NativeMethods.VK_F8,
    ["F9"] = NativeMethods.VK_F9,
    ["F10"] = NativeMethods.VK_F10,
    ["F11"] = NativeMethods.VK_F11,
    ["F12"] = NativeMethods.VK_F12
  };
}

static class NativeMethods
{
  public const int INPUT_MOUSE = 0;
  public const int INPUT_KEYBOARD = 1;

  public const uint MOUSEEVENTF_MOVE = 0x0001;
  public const uint MOUSEEVENTF_LEFTDOWN = 0x0002;
  public const uint MOUSEEVENTF_LEFTUP = 0x0004;
  public const uint MOUSEEVENTF_RIGHTDOWN = 0x0008;
  public const uint MOUSEEVENTF_RIGHTUP = 0x0010;
  public const uint MOUSEEVENTF_MIDDLEDOWN = 0x0020;
  public const uint MOUSEEVENTF_MIDDLEUP = 0x0040;
  public const uint MOUSEEVENTF_WHEEL = 0x0800;
  public const uint MOUSEEVENTF_ABSOLUTE = 0x8000;
  public const uint MOUSEEVENTF_VIRTUALDESK = 0x4000;

  public const uint KEYEVENTF_KEYUP = 0x0002;
  public const uint KEYEVENTF_UNICODE = 0x0004;

  public const int WHEEL_DELTA = 120;

  public const int SM_XVIRTUALSCREEN = 76;
  public const int SM_YVIRTUALSCREEN = 77;
  public const int SM_CXVIRTUALSCREEN = 78;
  public const int SM_CYVIRTUALSCREEN = 79;

  public const ushort VK_BACK = 0x08;
  public const ushort VK_TAB = 0x09;
  public const ushort VK_RETURN = 0x0D;
  public const ushort VK_SHIFT = 0x10;
  public const ushort VK_CONTROL = 0x11;
  public const ushort VK_MENU = 0x12;
  public const ushort VK_ESCAPE = 0x1B;
  public const ushort VK_SPACE = 0x20;
  public const ushort VK_PRIOR = 0x21;
  public const ushort VK_NEXT = 0x22;
  public const ushort VK_END = 0x23;
  public const ushort VK_HOME = 0x24;
  public const ushort VK_LEFT = 0x25;
  public const ushort VK_UP = 0x26;
  public const ushort VK_RIGHT = 0x27;
  public const ushort VK_DOWN = 0x28;
  public const ushort VK_DELETE = 0x2E;
  public const ushort VK_LWIN = 0x5B;
  public const ushort VK_F1 = 0x70;
  public const ushort VK_F2 = 0x71;
  public const ushort VK_F3 = 0x72;
  public const ushort VK_F4 = 0x73;
  public const ushort VK_F5 = 0x74;
  public const ushort VK_F6 = 0x75;
  public const ushort VK_F7 = 0x76;
  public const ushort VK_F8 = 0x77;
  public const ushort VK_F9 = 0x78;
  public const ushort VK_F10 = 0x79;
  public const ushort VK_F11 = 0x7A;
  public const ushort VK_F12 = 0x7B;

  [StructLayout(LayoutKind.Sequential)]
  public struct INPUT
  {
    public uint type;
    public InputUnion U;
  }

  [StructLayout(LayoutKind.Explicit)]
  public struct InputUnion
  {
    [FieldOffset(0)] public MOUSEINPUT mi;
    [FieldOffset(0)] public KEYBDINPUT ki;
  }

  [StructLayout(LayoutKind.Sequential)]
  public struct MOUSEINPUT
  {
    public int dx;
    public int dy;
    public int mouseData;
    public uint dwFlags;
    public uint time;
    public IntPtr dwExtraInfo;
  }

  [StructLayout(LayoutKind.Sequential)]
  public struct KEYBDINPUT
  {
    public ushort wVk;
    public ushort wScan;
    public uint dwFlags;
    public uint time;
    public IntPtr dwExtraInfo;
  }

  [DllImport("user32.dll", SetLastError = true)]
  public static extern uint SendInput(uint nInputs, INPUT[] pInputs, int cbSize);

  [DllImport("user32.dll")]
  public static extern short VkKeyScan(char ch);

  [DllImport("user32.dll")]
  public static extern int GetSystemMetrics(int nIndex);

  [DllImport("user32.dll")]
  [return: MarshalAs(UnmanagedType.Bool)]
  public static extern bool SetProcessDPIAware();
}
