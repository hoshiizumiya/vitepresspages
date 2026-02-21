# WinUI3 cpp/winRT 将Window与appWindow结合使用创造丰富的自定义界面，带你从零认识窗口设计

本篇基于 Windows App SDK 因为和 UWP 的 API 有很大区别，windows SDK 在 WinUI3 里大量已经不适用

## 引言

> 参考:[https://learn.microsoft.com/windows/apps/develop/ui/windowing-overview](https://learn.microsoft.com/windows/apps/develop/ui/windowing-overview)  

首先会带你介绍 Window 类和 AppWindow 类的详细概念并指出有什么具体区别

## 核心概念：Window vs AppWindow

- Window（Microsoft.UI.Xaml.Window）
  - XAML 顶层窗口，承载 UI 树（XAML 视觉层）的根。
  - 直接可用 XAML 功能（资源、主题、SystemBackdrop 等）。
  - 在 Windows App SDK 1.2+ 可通过 window.AppWindow 访问底层 AppWindow。

- AppWindow（Microsoft.UI.Windowing.AppWindow）
  - 面向窗口管理的抽象（Presenter、标题栏按钮、位置/尺寸、多屏 DisplayArea、Z 序）。
  - 可用于非 XAML 场景（工具窗、无边框自绘窗、紧凑叠加等）。
  - 可从 Window 获得（window.AppWindow），也可独立创建（TryCreateAsync）。

何时使用
- 仅需要一个主 UI 窗口：用 Window（并使用 window.AppWindow 做窗口级控制）。
- 需要特殊外观/形态（无边框、置顶、紧凑叠加、全屏）：用 AppWindow 的 Presenter 能力。
- 多窗口：二选一
  - 新建 XAML Window（常规子窗口、对话框、工具窗，XAML 能力完整）。
  - 独立 AppWindow（无需 XAML、轻量级工具窗或托管非 XAML 内容）。

## 生命周期与线程模型

- Window
  - 创建：new Window() -> Content = rootPage -> Activate()
  - 关闭：Closed 事件；与 App 启动/挂起解耦（桌面进程）。
  - 线程：UI 必须在 UI 线程（Dispatcher Queue）上操作。

- AppWindow
  - 获取：window.AppWindow 或 AppWindow::GetFromWindowId(windowId)
  - 事件：Changed、Closing、Destroyed
  - 显示形态：通过 SetPresenter 与 Presenter 派生类控制
  - 独立创建：co_await AppWindow::TryCreateAsync()

## 互操作：HWND、WindowId、AppWindow

从 Window 获取 HWND 和 AppWindow
```cpp
#include <winrt/Microsoft.UI.Xaml.h>
#include <winrt/Microsoft.UI.Windowing.h>
#include <winrt/Microsoft.UI.Interop.h> // IWindowNative, Win32Interop

using namespace winrt;
using namespace Microsoft::UI;
using namespace Microsoft::UI::Xaml;
using namespace Microsoft::UI::Windowing;

void Init(Window const& window)
{
    // 1) 直接获取 AppWindow（WinAppSDK 1.2+）
    AppWindow appWindow = window.AppWindow();

    // 2) HWND 与 WindowId（如需 Win32 API / DPI）
    com_ptr<::IWindowNative> native = window.as<::IWindowNative>();
    HWND hwnd{};
    native->get_WindowHandle(&hwnd);

    auto windowId = Win32Interop::GetWindowIdFromWindow(hwnd);
    AppWindow appWindow2 = AppWindow::GetFromWindowId(windowId);
}
```

从 HWND 反查 AppWindow
```cpp
AppWindow FromHwnd(HWND hwnd)
{
    auto windowId = Microsoft::UI::Win32Interop::GetWindowIdFromWindow(hwnd);
    return Microsoft::UI::Windowing::AppWindow::GetFromWindowId(windowId);
}
```

## 标题栏与非客户区自定义

两条路线：
1) Window 路线（XAML 标题栏）：适合直接在 XAML 中自定义拖拽区与按钮。
   - Window.ExtendsContentIntoTitleBar(true)
   - Window.SetTitleBar(xamlElement) 指定可拖拽元素
2) AppWindow 路线（系统标题栏与按钮）：使用 AppWindow.TitleBar、SetDragRectangles 自定义。

Window 自定义标题栏（XAML）
```cpp
// 假设 XAML 中有 Grid TitleBarHost 作为自定义标题栏容器
void SetupXamlTitleBar(Window const& window, Microsoft::UI::Xaml::Controls::Grid const& titleBarHost)
{
    window.ExtendsContentIntoTitleBar(true);
    window.SetTitleBar(titleBarHost); // 指定可拖拽区域

    // 建议配合 Padding 预留系统按钮区域，避免遮挡
}
```

AppWindow 标题栏与按钮样式
```cpp
#include <winrt/Windows.UI.h>
#include <winrt/Windows.Graphics.h>

using namespace Windows::UI;
using namespace Windows::Graphics;

void SetupAppWindowTitleBar(Windowing::AppWindow const& appWindow, HWND hwnd,
                            RectInt32 dragRectInDips)
{
    auto tb = appWindow.TitleBar();
    // 让内容延伸进标题栏区域
    tb.ExtendsContentIntoTitleBar(true);

    // 配置按钮颜色（根据主题自适配或自定义）
    tb.ButtonBackgroundColor(Colors::Transparent());
    tb.ButtonInactiveBackgroundColor(Colors::Transparent());
    tb.ButtonForegroundColor(Colors::White());
    tb.ButtonHoverBackgroundColor(Color{255, 32, 32, 32});
    tb.ButtonPressedBackgroundColor(Color{255, 48, 48, 48});

    // DPI 缩放：RectInt32 以物理像素为单位
    const float scale = static_cast<float>(GetDpiForWindow(hwnd)) / 96.0f;
    RectInt32 dragPx{
        static_cast<int32_t>(dragRectInDips.X * scale),
        static_cast<int32_t>(dragRectInDips.Y * scale),
        static_cast<int32_t>(dragRectInDips.Width * scale),
        static_cast<int32_t>(dragRectInDips.Height * scale),
    };
    std::array<RectInt32, 1> rects{ dragPx };
    tb.SetDragRectangles(rects);
}
```

无边框/隐藏系统标题栏（OverlappedPresenter）
```cpp
using namespace Microsoft::UI::Windowing;

void MakeBorderless(AppWindow const& appWindow)
{
    appWindow.SetPresenter(AppWindowPresenterKind::Overlapped);
    if (auto overlapped = appWindow.Presenter().try_as<OverlappedPresenter>())
    {
        // 移除边框与系统标题栏
        overlapped.SetBorderAndTitleBar(false, false);
        overlapped.IsResizable(true);        // 是否可缩放
        overlapped.IsMaximizable(true);
        overlapped.IsMinimizable(true);
    }
}
```

提示：移除系统标题栏后，需提供拖拽与缩放逻辑（可用 SetTitleBar 或命中测试/SendMessage 模拟）。

## Presenter：窗口形态与行为

常用形态
- Overlapped：标准可重叠窗口（可配置边框/标题栏、是否置顶、是否可缩放等）。
- CompactOverlay：紧凑置顶（类似画中画）。
- FullScreen：全屏（覆盖工作区）。

示例
```cpp
void UsePresenters(AppWindow const& appWindow)
{
    // 标准形态
    appWindow.SetPresenter(AppWindowPresenterKind::Overlapped);
    if (auto p = appWindow.Presenter().try_as<OverlappedPresenter>())
    {
        p.IsAlwaysOnTop(false);
        p.IsResizable(true);
        // p.Maximize(); p.Minimize(); p.Restore();
    }

    // 置顶紧凑叠加
    appWindow.SetPresenter(AppWindowPresenterKind::CompactOverlay);

    // 全屏
    appWindow.SetPresenter(AppWindowPresenterKind::FullScreen);
}
```

## 位置、尺寸、多显示器

- Move/Resize：使用 AppWindow.Move/MoveAndResize
- 显示区域：DisplayArea 决定窗口目标屏与工作区
```cpp
#include <winrt/Windows.Graphics.h>

using namespace Windows::Graphics;

void MoveResize(AppWindow const& appWindow, int32_t x, int32_t y, int32_t w, int32_t h)
{
    RectInt32 rect{ x, y, w, h };
    appWindow.MoveAndResize(rect);
}

void MoveToDisplayOf(AppWindow const& appWindow, WindowId otherId)
{
    using namespace Microsoft::UI::Windowing;
    auto area = DisplayArea::GetFromWindowId(otherId, DisplayAreaFallback::Primary);
    auto work = area.WorkArea(); // 物理像素
    // 居中到同一屏
    RectInt32 rect{
        work.X + work.Width / 4,
        work.Y + work.Height / 4,
        work.Width / 2,
        work.Height / 2
    };
    appWindow.MoveAndResize(rect);
}
```

## 系统材质：Mica / Acrylic（WinUI 3）

在 Window 级别启用 SystemBackdrop
```cpp
#include <winrt/Microsoft.UI.Xaml.Media.h>
using namespace Microsoft::UI::Xaml::Media;

void EnableMica(Microsoft::UI::Xaml::Window const& window)
{
    // Windows 11 上 Mica；Windows 10 将自动回退
    window.SystemBackdrop(MicaBackdrop{});
}
```

Acrylic 亦可使用 AcrylicBackdrop，根据设计选择其一。

## 常见场景速览

- 无边框可缩放 + 自绘标题栏
```cpp
void MakeCustomChrome(Window const& window)
{
    auto appWindow = window.AppWindow();
    MakeBorderless(appWindow);

    // 假设 TitleBarHost 为 XAML 的可拖拽区域
    // window.ExtendsContentIntoTitleBar(true);
    // window.SetTitleBar(TitleBarHost);
}
```

- 工具窗（置顶 + 紧凑）
```cpp
void MakeToolWindow(AppWindow const& appWindow)
{
    appWindow.SetPresenter(AppWindowPresenterKind::CompactOverlay);
    if (auto p = appWindow.Presenter().try_as<OverlappedPresenter>())
    {
        p.IsAlwaysOnTop(true);
        p.IsResizable(false);
    }
}
```

- 多窗口
```cpp
// 方案 A：再建一个 XAML Window
winrt::Microsoft::UI::Xaml::Window NewChildWindow()
{
    winrt::Microsoft::UI::Xaml::Window w;
    w.Activate();
    return w;
}

// 方案 B：独立 AppWindow（无 XAML 内容）
winrt::Windows::Foundation::IAsyncAction NewAppWindowAsync()
{
    using namespace Microsoft::UI::Windowing;
    if (auto newAppWindow = co_await AppWindow::TryCreateAsync())
    {
        newAppWindow.Title(L"Tool");
        newAppWindow.SetPresenter(AppWindowPresenterKind::Overlapped);
        newAppWindow.MoveAndResize(Windows::Graphics::RectInt32{100,100,480,360});
        newAppWindow.Show();
    }
}
```

- 保存/恢复窗口位置与形态
```cpp
struct WindowState { int32_t X, Y, W, H; AppWindowPresenterKind Kind; };

WindowState Save(AppWindow const& appWindow)
{
    WindowState s{};
    auto r = appWindow.Position(); // 或读取 MoveAndResize 过的 Rect
    s.X = r.X; s.Y = r.Y; s.W = r.Width; s.H = r.Height;
    s.Kind = appWindow.PresenterKind();
    return s;
}

void Restore(AppWindow const& appWindow, WindowState const& s)
{
    appWindow.MoveAndResize({ s.X, s.Y, s.W, s.H });
    appWindow.SetPresenter(s.Kind);
}
```

## 事件与关闭流程

- Window：Activated、Closed、SizeChanged
- AppWindow：Changed、Closing（可取消）、Destroyed
```cpp
winrt::event_token token{};
void HookAppWindowEvents(Windowing::AppWindow const& appWindow)
{
    token = appWindow.Closing([](auto const&, Windowing::AppWindowClosingEventArgs const& e)
    {
        // e.Cancel(true); // 若需要拦截关闭
    });
    appWindow.Destroyed([](auto const&, auto const&)
    {
        // 清理资源
    });
}
```

## 注意事项与坑

- DPI 缩放：AppWindow/TitleBar 的拖拽矩形为物理像素；XAML 为 DIPs（1/96 英寸）。务必换算。
- 透明与点击穿透：自定义标题栏透明区域仍需提供拖拽命中或避开系统按钮区域。
- 最小/最大尺寸：OverlappedPresenter 不直接提供最小尺寸约束，可在 SizeChanged 中回退；或使用 Win32 API SetWindowPos/WM_GETMINMAXINFO。
- 紧凑叠加：CompactOverlay 会改变窗口客户区大小，布局需适配。
- API 差异：UWP 的 CoreWindow/SetTitleBar 等在 WinUI 3 桌面与 Windows App SDK 中对应方式不同，避免混用旧 API。
- 权限与窗口风格：Win32 互操作可用 ShowWindow/SetWindowLong 等，但需确保句柄正确且风格与 Presenter 配置不冲突。

## 参考 API（命名空间）

- Microsoft.UI.Xaml.Window（ExtendsContentIntoTitleBar、SetTitleBar、SystemBackdrop）
- Microsoft.UI.Windowing.AppWindow（GetFromWindowId、TryCreateAsync、Show、MoveAndResize、PresenterKind、TitleBar）
- Microsoft.UI.Windowing.OverlappedPresenter（SetBorderAndTitleBar、IsResizable/Maximizable/Minimizable、IsAlwaysOnTop、Maximize/Minimize/Restore）
- Microsoft.UI.Windowing.DisplayArea（GetFromWindowId、WorkArea）
- Microsoft.UI.Win32Interop（GetWindowIdFromWindow）
- Windows.Graphics.RectInt32
- Windows.UI.Colors

## 结语

本文从 Window 与 AppWindow 的定位出发，覆盖了标题栏与 Presenter 自定义、互操作、布局与形态管理、系统材质与常见场景，便于在 WinUI 3 桌面应用中构建现代、灵活的窗口体验。

