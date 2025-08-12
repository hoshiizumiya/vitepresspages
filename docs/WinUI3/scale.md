# WIndows 系统缩放 —— 以 WinUI 3 高分辨率和 DPI 缩放问题为例

## WinUI 3 控件在高 DPI 下变小的原因及解决方案

在将 WPF 应用迁移到 WinUI 3 时，可能会遇到控件在高 DPI 下变小的问题。以下是一些原因和解决方案：

1. 控件默认大小和布局单位的差异
- WPF 使用“设备无关像素（DIP）”，1 DIP = 1/96 英寸。WPF 的渲染引擎会自动根据系统 DPI 缩放控件，保证在不同 DPI 下视觉大小一致。
- WinUI 3 也使用 DIP，但其控件的默认样式、Padding、Margin、字体等与 WPF 不完全一致。例如，WPF 的 Button 默认高度和字体比 WinUI 3 的 Button 要大。这是你从 WPF 迁移产生控件变小的主要原因之一。
- 直接复制 Height/Width：如果你在 WPF 里用 Height="30"，在 WinUI 3 里同样设置，控件实际显示出来的大小可能会不同，尤其是字体和内容区域。
---
2. DPI 处理方式的不同
- WPF 在高 DPI 下会自动缩放所有 UI 元素，且缩放算法和渲染方式较为成熟，兼容性好，但效果一般。
- WinUI 3 也支持高 DPI，但其 DPI 感知和缩放机制与 WPF 有细微差别，特别是在多显示器和高 DPI 场景下。WinUI 3 更依赖于操作系统的 DPI 感知声明（如 PerMonitorV2），并且控件的视觉密度（density）更高，导致同样的 DIP 数值下控件看起来更小。
---
3. 系统缩放的影响
- 如果你的系统缩放（如 200%）下，WPF 和 WinUI 3 都会尝试适配，但由于控件模板和渲染方式不同，WinUI 3 的控件可能会显得更“紧凑”或“瘦小”。
- WinUI 3 的控件在高 DPI 下不会像 WPF 那样自动“放大”到和 WPF 一样的视觉效果，尤其是字体和内容区域。
---
4. 内容被遮挡的原因
- 由于 WinUI 3 控件的默认 Padding、Margin、字体等都比 WPF 小，直接用 WPF 的高度/宽度设置，内容（如文字）可能会显示不全或被遮挡。
- 例如，WPF 的 Button 用 Height="30" 足够显示一行文字，但 WinUI 3 可能需要更高的值。
---
5. 如何解决？
- 不要直接照搬 WPF 的 Height/Width，而是根据 WinUI 3 的实际显示效果调整。
- 明确设置 FontSize、Padding，并适当增大控件的高度。
- 在高 DPI 环境下，优先使用**自适应布局**（如 Grid、StackPanel），减少绝对数值的使用。
- 检查 manifest 文件，确保 DPI 感知模式为 visual studio 默认的 `PerMonitorV2`，并在必要时动态调整布局。
```xml
<!-- app.manifest 片段 -->
<application xmlns="urn:schemas-microsoft-com:asm.v3">
  <windowsSettings>
    <dpiAware xmlns="http://schemas.microsoft.com/SMI/2005/WindowsSettings">PerMonitorV2</dpiAware>
  </windowsSettings>
</application>
```
---
## 缩放系统讲解：

### 1. PerMonitorV2 设置是什么？
-	PerMonitorV2 是 Windows 现代应用框架的 DPI 感知模式之一，声明在应用的 manifest 文件中。
-	含义：应用可以感知并适应每个显示器的 DPI（分辨率缩放），并在显示器 DPI 变化时自动调整 UI 缩放，获得最佳清晰度和布局。
-	适用场景：多显示器、不同缩放比例、动态切换显示器时，UI 能自适应缩放，避免模糊或错位。
-	WinUI 3 推荐并且默认使用 PerMonitorV2，这样控件和字体会根据当前显示器 DPI 自动缩放。

### 2. EXE 属性里的 “高 DPI 设置” 及 “DPI 缩放替代”

在 Windows 资源管理器中，右键 EXE → 属性 → 兼容性 → “更改高 DPI 设置”，可以看到 DPI 缩放替代（DPI scaling override） 

它允许你强制 Windows 以不同方式处理高 DPI 缩放，适用于未声明或不支持高 DPI 的老应用。

**选项说明** 

- 应用（Application）
  - 让应用自己负责 DPI 缩放。**只有**应用声明了高 DPI 感知（如 PerMonitorV2 或 PerMonitor），Windows 不做额外缩放。适合 WinUI 3、WPF 等现代应用。我们大部分情况都是为了对于老式的 Win32 应用而设置的，其也可能导致 UI 模糊或错位。
  - 强制应用程序忽略系统缩放，自行决定如何渲染界面。
  - 如果程序内部已经适配高 DPI（如使用高分辨率资源或矢量图形），此模式能直接启用其优化。
  - 如果程序未适配高 DPI，此模式可能导致界面 过小（因为未按系统缩放比例放大），但 **不会模糊**（因为未进行拉伸）。
- 系统（System）
  - Windows 以系统 DPI 启动应用，应用本身不感知 DPI。Windows 会整体放大应用窗口（像素级别拉伸），可能导致 UI 模糊。适合老旧 Win32 应用。
- 系统增强（System (Enhanced)）
  - Windows 尝试智能缩放如双线性插值算法，改善传统 GDI 应用的缩放效果。对现代 UI 框架（如 WinUI 3）无效。而且可能会造成 UI 错位或模糊。以及在非 200% 缩放下，文字等内容反复拉伸，导致模糊。具体不再展开。
  - GDI（Graphics Device Interface）是 Windows 早期的图形编程接口。GDI 应用指的是主要使用 GDI 技术进行界面绘制和渲染的 Windows 桌面程序，常见于 Win32、MFC、早期的 VB、Delphi 等开发的传统应用。
主要特点
- 通过 GDI API（如 BitBlt、DrawText、Rectangle 等）直接在窗口上绘制文本、图形和图片。
- 不支持现代的矢量化、硬件加速，渲染效率和显示效果有限。
- DPI 适配能力较弱，默认只支持 96 DPI，遇到高分屏时容易出现模糊或缩放问题。
典型例子
- 记事本（Notepad.exe，老版本）
- 画图（mspaint.exe，老版本）
- 很多 2000 年前后的 Windows 桌面软件
- 传统的 Windows Forms 应用（如 VB6、Delphi 早期版本）
与现代 UI 框架的区别 

- 现代框架（如 WPF、WinUI、UWP）支持高 DPI、矢量绘制、硬件加速，并且相关内容均进行了封装，界面自适应能力强。
- GDI 应用在高 DPI 下常常需要系统“位图拉伸”来缩放，导致界面模糊。
TIPS：
如果你在“高 DPI 设置”里看到“系统增强（System Enhanced）”选项，这就是专门为 GDI 应用优化缩放效果的。对 WinUI 3、WPF 等现代应用无效。



#### 如果 不启用高 DPI 缩放覆盖，Windows 的默认行为是：

- 检测应用程序是否支持高 DPI：
  - 如果应用程序未声明 DPI 感知（Unaware），Windows 会强制拉伸其界面。而且这个强制拉伸算法是基于**位图缩放**（Bitmap Scaling）实现，所以直接导致界面模糊。
  - 如果应用程序声明为“系统 DPI 感知”，但缩放比例不匹配显示器，Windows 仍会拉伸界面。
- 位图拉伸的局限性：
  - 位图拉伸的本质是将低分辨率图像简单放大，导致像素模糊（类似放大照片的效果）。
  - 非整数倍缩放（如 125%）时，模糊更明显。
- 应用程序未适配多显示器缩放：
  - 在多显示器环境中，若显示器缩放比例不同，未适配的程序无法动态调整，导致模糊或错乱。

#### 注意： 

我遇到过有些未声明高 DPI 感知的应用，在高 DPI 显示器上运行时，界面非常模糊。虽然程序具有高分辨率资源，但是系统仍然会选择缩放。


### 3. 它们的关系
- manifest 里的 PerMonitorV2
告诉 Windows：我的应用能感知并适应每个显示器的 DPI，请不要帮我缩放。
- EXE 属性里的 DPI 缩放替代
是用户/管理员手动干预的方式，强制 Windows 以某种方式缩放应用。
- 如果 manifest 已声明 PerMonitorV2，建议不要在这里启用“DPI 缩放替代”，否则可能导致缩放冲突或 UI 问题。
- 如果应用未声明高 DPI 感知，才建议用“系统”或“系统增强”来改善显示效果。


## 程序启动过程详解

### 1. 程序启动时的 DPI 感知声明

在 Windows 中，应用程序的 DPI 感知声明决定了其在高 DPI 显示器上的显示效果。以下是两种主要的 DPI 感知模式及其启动流程和执行过程：

(1) 应用程序未适配高 DPI（DPI Unaware）

启动流程：
程序启动时，Windows 检测到其未声明 DPI 感知。
系统默认以 96 DPI（100% 缩放）运行程序。
如果系统缩放比例为 125% 或 150%，Windows 会强制拉伸程序界面（位图缩放）。
执行过程：
位图拉伸：程序界面（如按钮、文字）被放大到系统缩放比例，导致像素模糊。
分辨率错位：程序的逻辑分辨率与物理分辨率不匹配，可能导致界面元素错位或失真。
动态调整失败：如果程序移动到不同缩放比例的显示器，Windows 会再次拉伸界面，进一步加剧模糊。

(2) 应用程序适配高 DPI（Per-Monitor DPI Aware）

启动流程：

程序启动时声明为“每显示器 DPI 感知”（Per-Monitor DPI Aware）。
Windows 会通知程序当前显示器的 DPI 值。
程序根据 DPI 值动态调整界面元素大小和布局。
执行过程：
无拉伸：程序直接以高 DPI 渲染，界面清晰。
动态适配：如果程序移动到不同缩放比例的显示器，程序会重新计算布局，避免模糊。

### 2. 设置为“应用程序”模式时的程序启动过程

(1) 强制启用“应用程序”模式
启动流程：
- 程序启动时，Windows 将其标记为“应用程序级 DPI 感知”（Application DPI Aware）。
- 程序不再接收系统缩放比例，直接以原始 DPI 运行。
执行过程：
- 无拉伸：程序界面以原始 DPI 渲染，避免位图拉伸导致的模糊。
- 界面过小：如果程序未适配高 DPI，界面可能过小（但清晰）。
- 手动调整：用户需手动拖动窗口边框放大界面，或等待程序自身优化。

(2) 程序适配高 DPI 的情况
效果：程序直接以高 DPI 渲染，界面清晰且适配。
示例：现代游戏（如 Steam 游戏）或 WPF 应用程序（如 Visual Studio）通常已适配高 DPI，设置为“应用程序”模式后效果最佳。

## 我们拿 Galgame 等程序来举例

### 1. Galgame（或其他老程序）即使有高清资源，为什么界面还是模糊、被强制缩放？例如大名鼎鼎的 恋彼女 steam 高清重制版。

原因分析： 

-	很多 Galgame 或老程序没有在 manifest 文件中声明高 DPI 感知（如 PerMonitorV2），属于“DPI Unaware”。或者说框架就没有提供这个支持。
-	Windows 检测到这种程序后，会用位图拉伸（Bitmap Scaling）方式强制缩放界面，把 96DPI 的内容直接放大到系统缩放比例（如 150%、200%）。96 dpi 是非常小的界面，Windows不得不要进行放大，如果不放大实际就是很小，只能适用于 1080P 的屏幕大小。
-	这种拉伸是像素级别的，哪怕你资源是高清的，程序本身没用高 DPI 方式加载和布局，Windows 只会把渲染结果整体放大，导致模糊。
- 	只有声明了高 DPI 感知，程序才会根据当前 DPI 重新布局和渲染，高清资源才能真正发挥作用。

为什么“应用程序”模式能解决？

-	“应用程序”模式（Application DPI Aware）让 Windows 不再对程序做强制缩放，程序自己负责渲染。
-	如果程序本身有高分辨率资源，且能自适应 DPI，这时界面就会清晰。
-	但如果程序没适配高 DPI，界面会变小，但不会模糊。

### 2. 不可避免地要提一嘴 ALT + Enter 全屏模式

实现原理通常是：将窗口样式切换为无边框、最大化并覆盖整个屏幕。
- 全屏时，窗口会去掉边框、标题栏，尺寸设置为屏幕分辨率，位于最顶层。
- 退出全屏时，恢复原有窗口样式和大小。
- 传统 Win32 应用会用 SetWindowLong、SetWindowPos 等 API 实现类似效果。

### 3. 不管你有没有注意到，我也想让你注意到一个问题

1. DPI 缩放的本质
- Windows 的“缩放”其实是 DPI（每英寸点数）缩放。比如 200% 缩放，系统 DPI 从 96（100%）变为 192（200%）。
- 这不是改变物理分辨率，而是让“1 逻辑像素（DIP）”对应 2×2 个物理像素。
- 这样做的目的是让界面元素在高分辨率屏幕上不会变得太小，保持视觉大小一致。
---
2. 应用检测到的“分辨率”变化
- DPI 感知（DPI Aware）应用：能感知 DPI，获取到的分辨率是物理分辨率（如 3840×2160），但布局时会自动按 DPI 缩放。
- DPI Unaware 应用：不能感知 DPI，Windows 会把它“骗”成 96 DPI，虚拟一个较小的分辨率（如 1920×1080），并用位图拉伸放大到实际屏幕。
- 你看到“分辨率变成一半”，其实是 DPI Unaware 应用被虚拟化的结果。
---
3. 对 4K 内容或浏览器视频播放的影响
- 视频播放窗口：如果播放器是 DPI 感知的，视频会以原生分辨率渲染，4K 视频在 4K 屏幕上依然清晰。
- DPI Unaware 播放器：窗口被系统缩放，视频先以较低分辨率渲染，再被拉伸，导致画质损失、模糊。
- 浏览器：现代浏览器都是 PerMonitorV2，能正确适配 DPI，4K 视频播放不会被缩放影响。
---
4. 对界面布局和字体显示的影响
- DPI 感知应用：布局、字体大小会自动按 DPI 缩放，视觉效果和 100% 缩放时一致且清晰。
- DPI Unaware 应用：布局和字体会被整体拉伸，可能模糊、错位、显示不全。
- 100% 缩放时：所有应用都以 96 DPI 渲染，无需缩放，显示最原始、最清晰的效果。
---
5. Windows 默认的强制缩放机制
- 当你设置 200% 缩放，DPI Unaware 应用会被 Windows 强制“位图缩放”。
- 这就是你看到的“分辨率变小、界面被放大且模糊”的根本原因。
- DPI 感知应用不会被强制缩放，能正确适配高 DPI。
---
6. 对于开发者
你可能注意到你的浏览器的分辨率检测到的数值，是你屏幕分辨率除以你的缩放比例。这个我们必须说清。
- 浏览器（如 Edge、Chrome）里的 window.innerWidth、screen.width 返回的是CSS 像素（逻辑像素），不是物理像素。
- 在 200% 缩放下，1 CSS 像素 = 2×2 物理像素，所以 3200×2000 的屏幕，网页检测到的就是 1600×1000。
- 这和 devicePixelRatio 有关：
- devicePixelRatio = 物理像素 / CSS像素，200% 缩放时为 2。
- 你可以在浏览器控制台输入 window.devicePixelRatio，会发现是 2。

#### 底层原理
- Windows 把 DPI 缩放暴露给应用，DPI 感知应用会用“逻辑像素”布局。
- 浏览器为了保证网页在不同 DPI 下视觉一致，自动把物理分辨率除以缩放比例，让网页开发者只关心“逻辑像素”。
- 这样网页在 100% 和 200% 缩放下，布局和字体大小都一致，只是渲染时用更多物理像素保证清晰。
相关 API 和标准： 

- 浏览器遵循 W3C CSSOM View Module 标准。
- window.innerWidth、screen.width 返回逻辑像素，devicePixelRatio 反映缩放关系。
- 物理像素 = 逻辑像素 × devicePixelRatio。
- 你看到的“分辨率减半”是浏览器的逻辑像素，不是物理像素。

## 几个例子

我必须再次做出提醒 如同 WinUI3 UWP WPF 等现代框架，都自动处理 DPI 适配，开发者没有需要已不需要再改动什么了。傻逼 QT 除外。

### WinUI3 程序
```cs
// WinUI 3 获取当前窗口 DPI
using Microsoft.UI.Windowing;
using Microsoft.UI.Xaml;
using Windows.Graphics;

var hwnd = WinRT.Interop.WindowNative.GetWindowHandle(this);
var displayId = Microsoft.UI.Win32Interop.GetDisplayIdFromWindow(hwnd);
var displayInfo = DisplayInformation.GetForCurrentView();
float dpi = displayInfo.LogicalDpi; // 例如 192 表示 200% 缩放

// 计算缩放比例
float scale = dpi / 96.0f;
```

### WPF 程序 

```cs
// WPF 获取 DPI
using System.Windows;
using System.Windows.Media;

var source = PresentationSource.FromVisual(this);
if (source?.CompositionTarget != null)
{
    Matrix m = source.CompositionTarget.TransformToDevice;
    double dpiX = m.M11 * 96; // 横向 DPI
    double dpiY = m.M22 * 96; // 纵向 DPI
    double scale = dpiX / 96.0;
}
```

### Win32 

```cpp
// Win32 获取窗口 DPI（C/C++）
#include <windows.h>

UINT dpi = GetDpiForWindow(hwnd); // 需要 Windows 10 1607 及以上
float scale = dpi / 96.0f;
```

### 浏览器检测（devicePixelRatio） 

```js
// JS 检测 DPI 缩放
console.log(window.devicePixelRatio); // 2 表示 200% 缩放

// 获取逻辑像素和物理像素
console.log(window.innerWidth); // 逻辑像素
console.log(screen.width);      // 逻辑像素
console.log(window.innerWidth * window.devicePixelRatio); // 物理像素

```

### 补一个 WinUI 3 的动态 DPI 响应

```cs
// 监听 DPI 变化
Window.Current.CoreWindow.DpiChanged += (s, e) =>
{
    float newDpi = e.NewDpi;
    // 根据 newDpi 动态调整布局
};
```
- 当窗口移动到不同 DPI 的显示器时触发。
- 可在事件中重新计算控件大小、字体等。

## 感觉缺了 DirectX 这篇文章就不完整，是没有灵魂东西，那么他就失去了价值

### 1. DirectX 的显示模式概述
1.1 三种常见显示模式
1.	窗口化（Windowed）
- 游戏/应用在普通窗口内运行，有边框、或自定义的有无标题栏，可随意切换、拖动、缩放。
- 系统桌面和其他程序可见，渲染内容受桌面合成器（DWM）管理。
2.	无边框窗口化（Borderless Windowed / Fullscreen Windowed）
- 窗口大小等于屏幕分辨率，但没有边框和标题栏，看起来像全屏。
- 实际上还是窗口，受 DWM 管理，和桌面其他内容一起合成。
- 切换速度快，兼容性好，易于多屏操作，但有轻微性能损耗。
- 这个和第一个基本一致，区别可能就只在于是否能够拖动了。
3.	独占全屏（Exclusive Fullscreen）
- 游戏/应用直接占用显示设备，独占显卡输出，系统桌面不可见。
- 不经过 DWM，渲染帧直接输出到显示器，延迟低、性能最佳。
- 切换慢，兼容性差，易导致分辨率闪烁、黑屏。
---
### 2. DX9/10/11 独占全屏的实现原理
- 通过 DirectX 的 SwapChain（交换链）创建时，指定 `DXGI_SWAP_EFFECT_DISCARD` 并设置 `Windowed = FALSE`。
- DirectX 通知驱动和操作系统，当前进程独占显示输出，DWM 暂停合成，所有渲染帧直接传递到显示器。
- 可以通过 `IDXGISwapChain::SetFullscreenState(TRUE, ...)` 动态切换全屏/窗口。
- 游戏会请求更改显示器分辨率（Display Mode），如 1920x1080 → 1280x720，系统会临时切换分辨率，退出时恢复。这也是你在部分游戏启动前见到的桌面分辨率变化。要注意如果此刻游戏因系统意外退出了，你的分辨率可能就无法恢复回去了。 

优点：
- 性能极佳（无 DWM 合成、无多余拷贝），输入延迟最低。
- 支持分辨率切换，适合高帧率、电竞场景。 

缺点：
- 切换慢，黑屏闪烁。
- 多显示器下兼容性差，易导致主屏幕丢失内容。
- 录屏、截图、Alt+Tab 切换体验不佳。
---
### 3. DX12 及现代游戏的“伪全屏”与原理
#### 3.1 DX12 为什么没有真正的独占全屏？
- DX12 推崇“无边框窗口化”作为主流全屏方案，推荐开发者用 `DXGI_SWAP_EFFECT_FLIP_DISCARD` 并设置窗口为无边框、最大化。
- Windows 10 及以后，DWM 合成器性能大幅提升，窗口化和独占全屏的性能差距大大缩小。
- DX12 仍然支持独占全屏，但很多游戏和引擎默认只实现无边框窗口化，兼容性更好，切换更快。 


#### 3.2 “伪全屏”与“真全屏”的区别
- 伪全屏（无边框窗口化）：窗口大小等于屏幕分辨率，DWM 负责合成，鼠标可被锁定在窗口内（通过 API），但本质还是窗口。
- 真全屏（独占全屏）：应用独占显示输出，DWM 暂停，鼠标自动锁定，输入延迟更低。


#### 3.3 鼠标锁定与窗口行为
- DX11/12 游戏在全屏时通常会调用 `ClipCursor` 或 `Raw Input API`，将鼠标限制在窗口区域，防止多屏误操作。
- 只有按下 Win、Alt+Tab 等系统快捷键，才会释放鼠标。
- 无边框窗口化下，鼠标锁定是软件实现的，独占全屏下是系统级别的。
---
### 4. 分辨率切换的底层机制
#### 4.1 早期游戏/软件的分辨率切换
- 通过 DirectX 或 Win32 API（如 `ChangeDisplaySettings`）在启动时直接更改系统分辨率。
- 这样做的原因：独占全屏下，游戏可用更低分辨率提升性能，或适配特定画面比例。
- 退出游戏时再恢复原分辨率。
- 缺点：切换时屏幕黑屏、闪烁，影响体验。
#### 4.2 现代游戏的分辨率处理
- 多数现代游戏（尤其是无边框窗口化）直接用桌面分辨率，游戏内部用渲染分辨率缩放（如 4K 屏幕下 1080p 渲染再拉伸）。
- 不再更改系统分辨率，切换更平滑，兼容性更好。
- 只有极少数需要极致性能或特殊需求的游戏才会主动切换系统分辨率。
---
### 5. 性能与体验对比
| 模式                | 性能 | 输入延迟 | 切换速度 | 多屏兼容 | 鼠标锁定 | 分辨率切换 | 录屏兼容 | 
|---------------------|------|----------|----------|----------|----------|------------|----------| 
| 独占全屏（DX11及以下） | 最佳 | 最低     | 慢/黑屏   | 差       | 系统级   | 支持       | 差       |
| 无边框窗口化（DX12）  | 略低 | 略高     | 快        | 好       | 软件级   | 不切换     | 好       |
| 普通窗口            | 最低 | 最高     | 快        | 好       | 无       | 不切换     | 好       |
---
### 6. 相关 API 与实现代码片段

#### 6.1 DX11 独占全屏切换与分辨率设置
```cpp
// DX11 独占全屏切换与分辨率设置
// 假设 swapChain 已经创建

// 进入独占全屏模式
swapChain->SetFullscreenState(TRUE, NULL);

// 切换分辨率（Display Mode）
DXGI_MODE_DESC desc = {};
desc.Width = 1920;
desc.Height = 1080;
desc.RefreshRate.Numerator = 60;
desc.RefreshRate.Denominator = 1;
desc.Format = DXGI_FORMAT_R8G8B8A8_UNORM;
desc.ScanlineOrdering = DXGI_MODE_SCANLINE_ORDER_UNSPECIFIED;
desc.Scaling = DXGI_MODE_SCALING_UNSPECIFIED;
swapChain->ResizeTarget(&desc);

// 恢复为窗口模式
swapChain->SetFullscreenState(FALSE, NULL);
```

#### 6.2 DirectX 12 推荐的无边框窗口化全屏
```cpp
// DX12 推荐用无边框窗口化
// 设置窗口样式为无边框，最大化到屏幕
SetWindowLong(hwnd, GWL_STYLE, WS_POPUP | WS_VISIBLE);
SetWindowPos(hwnd, HWND_TOP, 0, 0, width, height, SWP_SHOWWINDOW);
```

#### 6.3 鼠标锁定到窗口（DX11/DX12/Win32）
```cpp
// 鼠标锁定到窗口区域
RECT rect;
GetClientRect(hwnd, &rect);
POINT lt = { rect.left, rect.top };
POINT rb = { rect.right, rect.bottom };
ClientToScreen(hwnd, &lt);
ClientToScreen(hwnd, &rb);
RECT screenRect = { lt.x, lt.y, rb.x, rb.y };
ClipCursor(&screenRect); // 锁定鼠标
// 解除锁定
ClipCursor(NULL);
```

#### 6.4 Win32 更改系统分辨率（早期 DirectX 游戏（DX9/10/11）独占全屏）
```cpp
// Win32 更改系统分辨率（早期游戏/独占全屏）
#include <windows.h>

// 设置分辨率
DEVMODE dm = {};
dm.dmSize = sizeof(dm);
dm.dmPelsWidth = 1280;
dm.dmPelsHeight = 720;
dm.dmFields = DM_PELSWIDTH | DM_PELSHEIGHT;
ChangeDisplaySettings(&dm, CDS_FULLSCREEN);

// 恢复分辨率
ChangeDisplaySettings(NULL, 0);
```

### 7. 有关 Windows 的全屏优化问题

- 全屏优化（Fullscreen Optimization） 是 Windows 10 引入的一个特性，目的是让无边框窗口化的游戏也能获得接近独占全屏的性能和低延迟。
- 启用全屏优化时，DWM（桌面窗口管理器）会尝试减少合成延迟，把游戏帧直接“快速路径”送到显示器，但本质上还是窗口化。
- 但全屏优化并不等同于独占全屏，部分游戏和驱动仍然会有性能差异，尤其在高帧率、低延迟场景下。

为什么独占全屏能提升帧数、稳定性、降低低帧
- 独占全屏下，游戏直接控制显示输出，DWM 暂停，渲染帧直接送到显示器，无需桌面合成，减少了拷贝和延迟。
- 系统资源优先分配给独占全屏应用，减少了后台干扰。
- 没有桌面合成和其他窗口的干扰，帧率更高、更稳定，低帧（帧率抖动）更少。
- 输入（鼠标、键盘）路径更短，响应更快。


为什么很多游戏无边框窗口化有问题
- 无边框窗口化本质还是窗口，受 DWM 管理，所有内容都要经过桌面合成。
- 这会带来：
- 轻微的输入延迟和帧延迟（尤其在高刷新率下）。
- 某些情况下帧率上限受限于桌面刷新率。
- 录屏、截图兼容性好，但极限性能略低。
- 某些游戏/引擎对无边框窗口化支持不好，可能出现鼠标穿屏、窗口焦点丢失等问题。

为什么有些游戏只有独占全屏才能开 HDR
- HDR（高动态范围） 需要操作系统和显卡直接控制显示输出的色彩空间和像素格式。
- 只有独占全屏时，应用可以直接切换显示器到 HDR 模式，绕过 DWM 的 sRGB 合成。
- 无边框窗口化下，DWM 负责所有窗口的合成，无法为单个应用切换 HDR，导致很多游戏只有独占全屏才能启用 HDR。
- Windows 11/10 新版 DWM 支持“桌面级 HDR”，但兼容性和色彩准确性仍不如独占全屏。


为什么 DX12 不用原生分辨率输入延迟会变高
- DX12 推荐用无边框窗口化+渲染分辨率缩放（如 4K 屏幕下 1080p 渲染）。
- 如果不是用原生分辨率，DWM 需要对渲染结果做缩放处理，增加一帧延迟。
- 只有独占全屏+原生分辨率时，渲染帧能直接输出到显示器，延迟最低。
- DX12 的“Flip Model”交换链虽然优化了窗口化性能，但仍无法完全消除缩放带来的延迟。


早期游戏/软件启动时更改系统分辨率，是不是独占全屏？
- 是的，早期 DirectX 游戏（DX9/10/11）在独占全屏模式下，常常用 ChangeDisplaySettings 或 IDXGISwapChain::ResizeTarget 直接更改系统分辨率。
- 这样做是为了让游戏画面和显示器分辨率一致，获得最佳性能和画质。
- 退出游戏时再恢复原分辨率，这就是你看到的“黑屏闪烁”现象。

客户只要效果好就行，而开发者要考虑的事情就很多了。

