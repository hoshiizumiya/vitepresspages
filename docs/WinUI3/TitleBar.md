# C++/WinRT 原理及实践 —— 通过 WinUI 3 自定义窗口 TitleBar 带你入门现代的 CPP 编程

## 1. 前言

`cpp/winRT`作为基于现代 cpp 的框架，学习路线十分陡峭，本文尽可能事无巨细地向你展示它的使用基础。 
希望通过本 C++/WinRT 原理及实践系列 能够帮助你了解`cpp/WinRT`语法的设计不同和巧妙之处！
WinUI 3 支持对窗口标题栏（Title Bar）进行多种自定义，包括高度、颜色、内容扩展等。以下从讲解如何自定义入手。 

## 2. 相关命名空间

你需要确保包含如下头文件和命名空间：

```cpp
#include <winrt/Microsoft.UI.Windowing.h>
using namespace winrt;
using namespace Microsoft::UI::Xaml;
```

- `winrt/Microsoft.UI.Windowing.h` 提供了窗口和标题栏相关的 API。
- `Microsoft::UI::Xaml` 是 WinUI 的核心命名空间。
- 引入的位置应该是要与你的窗口定义的 cpp 文件一致，建议放到 `app.xaml.cpp`内的`OnLaunched()`函数内，在窗口创建前确保已完成自定义
 
## 3. 关键对象与方法

### 3.1 获取窗口对象

在 WinUI 3 中，通常通过 `MainWindow` 类创建主窗口实例作为入口窗口：

```cpp
window = make<MainWindow>();
window.Activate();
```

### 3.2 确保已扩展内容到标题栏

通过 `ExtendsContentIntoTitleBar(true)`，可以让自定义内容延伸到系统标题栏区域，以去掉默认的样式：

```cpp
window.ExtendsContentIntoTitleBar(bool);
```

- 函数接受一个 `bool` 类型的参数。
- 参数为 `true` 时，内容会延伸到标题栏区域，允许自定义。
- 参数为 `false` 时，使用系统默认标题栏。

### 3.3 获取 AppWindow 和 TitleBar

`AppWindow` 提供了对窗口的更底层控制，我们在页面操作其二中也做了介绍。
该函数位于`winrt/Microsoft.UI.Windowing.h`头文件中。通过 `window.AppWindow()` 获取当前你要自定义的`window`对象：

```cpp
auto appWindow = window.AppWindow();
```

`AppWindow::TitleBar()` 返回一个 `AppWindowTitleBar` 对象，用于进一步自定义标题栏：

```cpp
auto titleBar = appWindow.TitleBar();
```

### 3.4 设置标题栏高度 

可以通过 `PreferredHeightOption` 设置标题栏高度，此在 Microsoft doc 中亦有记载，你可以通过将鼠标当前光标提示放在要查询的位置，按键盘F1以跳转浏览器查看具体细节：

```cpp
titleBar.PreferredHeightOption(winrt::Microsoft::UI::Windowing::TitleBarHeightOption::Tall);
```

通过作用域限定符访问
- `TitleBarHeightOption::Tall`：高的标题栏
- `TitleBarHeightOption::Standard`：标准的高的标题栏

#### winrt::Microsoft::UI::Windowing::TitleBarHeightOption::Tall 语法的细节

你肯定不熟悉`winrt::Microsoft::UI::Windowing::TitleBarHeightOption::Tall`这是什么：  
由 C++11 标准开始引入的**强类型枚举**（enum class）语法。这在 cpp/winRT 中大量使用。对标C#直接成员访问。  
用法：**命名空间::枚举类型::枚举值**。被投影为了以下的 cpp enum class 类型：  
```cpp
enum class TitleBarHeightOption : int32_t
{
    Standard = 0,
    Tall = 1,
    Collapsed = 2,
};
```
那你是否记得你以前用的 cpp 是如何定义并访问的？  

```cpp
enum Color { Red, Green, Blue };
Color c = Red; // 直接用 Red
```
为什么不这样使用？这样会使定义的属性成员都暴露在定义处的作用域中，出现冲突时会报错重定义，同时与 cpp/winRT 的强类型设计相违背。
```cpp
enum Color { Red, Blue , Green};
enum Fruit { Apple, Green, Banana };

int x = Green; // 这里Green到底是Color的还是Fruit的？编译器会报错：重定义或二义性，究竟是3还是2？
```

你要知道枚举成员底层实现都是一个整数常量，名称只是便于快速准确的开发。作为参数时传递的是基于 cpp 的一个整数，在此是继承了 int32_t 类型，这也是强类型枚举的好处，可以指定基础类型。4byte的 int 整型。
同时意味着你不能传递一个非 enum class 的值，必须进行显示转换。例如直接把 Tall 对应的 1 作为参数传递，防止误用。  


## 4. 代码示例与语法讲解 

完整流程如下：

```cpp
void App::OnLaunched([[maybe_unused]] LaunchActivatedEventArgs const& e)
{
    // 1. 创建主窗口
    window = make<MainWindow>();
    window.Activate();

    // 2. 扩展内容到标题栏
    window.ExtendsContentIntoTitleBar(true);

    // 3. 获取 AppWindow 和 TitleBar
    auto appWindow = window.AppWindow();
    if (appWindow)
    {
        auto titleBar = appWindow.TitleBar();
        if (titleBar)
        {
            // 4. 设置标题栏高度为 Tall
            titleBar.PreferredHeightOption(winrt::Microsoft::UI::Windowing::TitleBarHeightOption::Tall);
        }
    }
}
```

进阶使用用法：
```cpp
window.AppWindow().TitleBar().PreferredHeightOption(winrt::Microsoft::UI::Windowing::TitleBarHeightOption::Tall);
```

### 4.1 SetTitleBar 自定义标题栏区域

WinUI 3 支持通过 `SetTitleBar` 方法将自定义的 XAML 元素（如 Grid、StackPanel 等）指定为窗口的标题栏区域。例如：

```cpp
window.SetTitleBar(AppTitleBar());
```

其中 `AppTitleBar()` 返回你自定义的 XAML 元素（如 Grid）。这样可以让你完全自定义标题栏的内容和样式。

#### 注意：自定义区域的行为变化

- 使用 `SetTitleBar` 后，系统默认的拖动、双击最大化等行为会失效。
- 你需要手动为自定义区域实现拖动和双击最大化等功能。

##### 拖动和双击最大化的实现示例

以 XAML 的 Grid 作为自定义标题栏为例：

```cpp
// XAML
<Grid x:Name="AppTitleBar" PointerPressed="AppTitleBar_PointerPressed" DoubleTapped="AppTitleBar_DoubleTapped">
    <!-- 你的自定义内容 -->
</Grid>
```

```cpp
// C++/WinRT 事件处理
void MainWindow::AppTitleBar_PointerPressed(IInspectable const&, PointerRoutedEventArgs const& e)
{
    // 让窗口可拖动
    this->TryDragMove();
}

void MainWindow::AppTitleBar_DoubleTapped(IInspectable const&, DoubleTappedRoutedEventArgs const& e)
{
    // 双击最大化/还原
    if (this->AppWindow().Presenter().State() == winrt::Microsoft::UI::Windowing::AppWindowPresenterState::Maximized)
    {
        this->AppWindow().Presenter().Restore();
    }
    else
    {
        this->AppWindow().Presenter().Maximize();
    }
}
```
[设置可拖动的矩形参考](https://learn.microsoft.com/zh-cn/windows/windows-app-sdk/api/winrt/microsoft.ui.windowing.appwindowtitlebar.setdragrectangles)
- `TryDragMove()` 让窗口响应拖动。
- 通过判断 `AppWindow().Presenter().State()` 实现双击最大化/还原。

> 只有你手动处理这些事件后，自定义区域才能像原生标题栏一样拖动和最大化。
> 可以不设置 SetTitleBar = 系统默认标题栏，省心但不可自定义这些方法行为。
> 设置 SetTitleBar = 获得自定义UI能力，但需要自己处理所有行为和细节，否则会有副作用和“难用”感。

### 语法说明

- `make<MainWindow>()`：C++/WinRT 的工厂函数，创建 `MainWindow` 实例。
- `window.ExtendsContentIntoTitleBar(true)`：扩展内容到标题栏。
- `auto appWindow = window.AppWindow();`：获取底层窗口对象。
- `auto titleBar = appWindow.TitleBar();`：获取标题栏对象。
- `titleBar.PreferredHeightOption(...)`：设置标题栏高度选项。
- `window.SetTitleBar(AppTitleBar())`：将自定义 XAML 元素作为标题栏区域。

#### 进阶用法：

这是 `C++/WinRT（wincpp/cppwinrt）`风格的“链式调用”语法，体现了现代 C++/WinRT 对 WinRT API 的包装方式。每个方法返回一个对象（引用），以继续调用属于它的下一个成员方法。

#### 语法关键：

##### 使用`.`成员运算符

对于不太了解`cpp`的初学者，你一定疑惑为什么使用成员运算符。  

在 C++ 中使用**成员运算符**要求访问的是**目标对象**或的**成员函数**或**成员变量**，而我们访问的明明是一个方法不应该用指针->吗  

在 C++/WinRT 中，API 被包装成 C++ 类，**对象**调用**成员方法**时自然用 `.` 。这也是*WinRT投影*实现——将`COM底层通过winRT`投影到CPP语言中使用。  

易混淆点是：`cpp/winrt`的标准实现中返回的都是**对象**而不是创建的**指向对象的指针**，我们常常会`Class *ptr = new Classfunc()`
创建一个在堆上的对象，此时我们使用的是`ptr`就需要`ptr->`访问，相当于`(*ptr).*)`，而`cpp/winrt`返回的正是栈对象、非堆对象。  

同时你也要注意，为了让`cpp/winrt`项目能够便携地使用你自定义的函数等，你应该让他们继承自`winrt::implements<T,winrt::Windows::Foundation::IInspectable>`T为你当前类的类型。
这也意味着编译器和 IDE（如 Visual Studio）会自动推断你可能需要用到 winrt::com_ptr\<`T`\> 智能指针来管理这些接口对象。你需要使用`->`来访问。如下
![举例图片](https://cdn.jsdelivr.net/gh/hoshiizumiya/images/指针与成员.png)
com_ptr 是 C++/WinRT 提供的智能指针模板，用于安全地管理 WinRT/COM 对象的生命周期（自动 AddRef/Release）。当你实现自定义 WinRT 组件、接口或工厂函数时，IDE 会智能提示 com_ptr 相关的命名空间和类型，帮助你正确管理对象引用，防止内存泄漏或悬挂指针。
你的函数会自动通过`cpp/winrt`的智能指针模板类 winrt::com_ptr\<`T`\>并要求实现。

##### C++/WinRT 对象的分配与生命周期

而C++/WinRT 返回的对象本质上是对底层 COM 对象的智能指针引用，拷贝和传递开销极小。属于轻量级句柄，由智能指针自动管理引用计数，开发者
不用手动调用 Release() 或 delete，对象会在不再使用时自动释放。对于`cpp/winrt`的对象，对象本身就是值类型（类似 std::string），
但内部持有指向 COM 对象的指针，自动管理生命周期。所以你可以直接用 . 访问成员。

那你就肯定有疑问了：这些值类型的对象究竟被分配在了哪里。首先这些类型你在表面上看是属于值类型的对象，像是直接声明在了栈上进行使用。但
实际上，对象的内部持有一个指向底层 com 对象的智能指针（`winrt::impl::abi_t*`） 当拷贝复制这些对象时只是拷贝了智能指针并不会复制
底层 com 对象本身，开销极小。所以这些由函数返回的对象（变量）的确分配在栈上，但他们内部的指针 是指向的 com 对象 这些 com 对象实际
分配在堆上由COM运行时进行管理。  

总的来说通过`AppWindow()`声明的`appWindow`只是在栈上面分配了一个很小的对象，通常只有一个指针的成员来指向实际的 com 对象，生命
周期由引用计数自动管理 。

##### C++/WinRT 对象的分配细节示例

我们下面来分析 TitleBar() 的原函数实现并予以解释，以便展示 `winrt/cpp` 的冰山一角。

```cpp
template <typename D>   //模板来自调用层传递
auto consume_Microsoft_UI_Windowing_IAppWindow<D>::TitleBar() const  
{
    void* value{};
    if constexpr (!std::is_same_v<D, winrt::Microsoft::UI::Windowing::IAppWindow>)
    {
        winrt::hresult _winrt_cast_result_code;
        auto const _winrt_casted_result = impl::try_as_with_reason<winrt::Microsoft::UI::Windowing::IAppWindow, D const*>(static_cast<D const*>(this), _winrt_cast_result_code);
        check_hresult(_winrt_cast_result_code);
        auto const _winrt_abi_type = *(abi_t<winrt::Microsoft::UI::Windowing::IAppWindow>**)&_winrt_casted_result;  //这就是由对象持有的指针
        check_hresult(_winrt_abi_type->get_TitleBar(&value));
    }
    else
    {
        auto const _winrt_abi_type = *(abi_t<winrt::Microsoft::UI::Windowing::IAppWindow>**)this;
        check_hresult(_winrt_abi_type->get_TitleBar(&value));
    }
    return winrt::Microsoft::UI::Windowing::AppWindowTitleBar{ value, take_ownership_from_abi };
}
```

*因全文过长，所以将模板元讲解分开。强烈在此处开始阅读[C++/WinRT 原理及实践 —— 模板元编程在 WinRT 中的实现](Template.md)！*

`void* value{}` 是一个未初始化的通用指针变量，初始值为 `nullptr`。  

在 `WinRT/COM` 接口调用中，常用 `void**` 作为 out 参数，用于接收接口方法返回的对象指针。  

在此我们简要介绍：  

-	作为 get_TitleBar(&value) 的输出参数，接收底层 COM 返回的 AppWindowTitleBar 接口指针。
-	后续用 `AppWindowTitleBar{ value, take_ownership_from_abi }` 包装成 C++/WinRT 对象，自动管理生命周期。
`TitleBar() const` 表示不会修改当前 C++/WinRT 包装对象的状态（即不会修改 this 指向的成员变量，包装对象本身不变）。不影响通过返回对象修改底层数据。
意味着你只能调用其 const成员函数不能修改成员变量 但是 由于它只约束当前对象本身 不约束返回的对象去操作底层数据 所以你从TitleBar() 得到的是另外一个 winRT 对象的包装还可以操作它 
-	通过 COM ABI（Application Binary Interface）调用 get_TitleBar，获取底层的 AppWindowTitleBar 接口指针。
1. `if constexpr` 与类型判断
-	`if constexpr (!std::is_same_v<D, ...>) `用于模板元编程，区分不同类型的处理方式。
2. `static_cast<D const*>(this)`
-	将当前对象强制转换为目标类型指针，便于后续的接口查询。
3. `impl::try_as_with_reason`
-	尝试将当前对象转换为指定的 WinRT 接口类型，获取底层 ABI 指针。
4. `abi_t<T>`
-	获取 WinRT 接口的底层 ABI 类型（即 `COM` 接口的 `vtable` 指针）。
5. `check_hresult`
-	检查 COM 方法调用的返回值，抛出异常或处理错误。
6. `take_ownership_from_abi`
-	指示 C++/WinRT 对象接管底层 COM 指针的生命周期，防止内存泄漏。

##### 关于 hresult(Handle to an Result)

你可能经常会在调试时遇到来自该类型的`check_hresult()`抛出异常，这是极为正常的。以下是解释：
它值本身是一个32位的整数值，用来表示函数调用的成功或失败状态，并且携带有关该操作返回结果的详细信息。具体来说，HRESULT 包含了三个部分：  
一个严重性代码（指示成功或错误），一个设备代码（标识引发错误的系统组件），以及一个状态码（描述具体的错误或成功条件）。
如果你对 Windows API熟悉那你肯定知道他的 HRESULT 。在 C++/WinRT 中，winrt::hresult 其实就是对传统 HRESULT 的类型安全封装，和 Windows API 的 HRESULT 兼容。
check_hresult 会检查这个值，如果不是S_OK(0)表示成功，会抛出异常或终止执行，包含错误码，如 E_FAIL、E_INVALIDARG 等（来自 windows sdk winerror.h）

这里也贴出结构定义，有兴趣可以看看：
```cpp
31 30 29 ... 16 15 ... 0
| S | F |      Code     |
```
S (Severity): 1 位，表示严重性（0 = 成功，1 = 失败）
F (Facility): 11 位，表示错误来源（设施代码）
Code: 20 位，具体的错误代码

📌 常见的 HRESULT 错误值：
|HRESULT 常量|	值（十六进制）|	含义|
|---|---|---|
|S_OK|	0x00000000	|操作成功|
|S_FALSE	|0x00000001	|操作成功但返回“假”结果（如布尔函数）|
|E_FAIL|	0x80000005	|一般性失败（未知错误）|
|E_INVALIDARG	|0x80070057	|参数无效|
|E_OUTOFMEMORY|	0x8007000E|	内存不足|
|E_NOINTERFACE	|0x80004002	|不支持请求的接口|
|E_POINTER	|0x80004003	|指针无效（NULL）|
|E_NOTIMPL	|0x80004001	|方法未实现|
|CO_E_NOTINITIALIZED	|0x800401F0	COM| 库未初始化|

## 5. 更多自定义

你还可以通过 `AppWindowTitleBar` 设置更多属性，如背景色、前景色、按钮样式等。例如：

```cpp
titleBar.ButtonBackgroundColor(winrt::Windows::UI::Colors::Transparent());
titleBar.ButtonForegroundColor(winrt::Windows::UI::Colors::White());
```

## 6. 图标自定义
相关参考
> [AppWindow.SetTitleBarIcon 方法](https://learn.microsoft.com/zh-cn/windows/windows-app-sdk/api/winrt/microsoft.ui.windowing.appwindow.settitlebaricon)
### 6.1 设置标题栏图标
namespace = Microsoft.UI.Windowing  
```cpp
SetTitleBarIcon(IconId)	
Sets the icon for the window title bar using the specified icon ID.
使用指定的图标 ID 设置窗口标题栏的图标。

SetTitleBarIcon(String)	
Sets the icon for the window title bar using the specified icon path.
使用指定的图标路径设置窗口标题栏的图标。
```

这两个方法比较复杂，我们展开来看看

何为IconId？
隶属语 Microsoft.UI 命名空间
`IconId` 由结构存储，底层由metadata驱动来定义图标的标识符。表示图标的资源 ID，图片应该在你的项目文件夹下并确保作为内容包含在你的项目资源中一起生成。

必须使用平台调用（P/Invoke）通过 Win32 LoadImage 函数获取图标句柄。然后您可以获得 IconId 并在调用 SetIcon 时使用它。
DLLImport 用于访问 user32.dll 中的 LoadImage 函数。
```cs
using Microsoft.UI;
using System;
using System.Runtime.InteropServices;

// ...

protected override void OnLaunched(Microsoft.UI.Xaml.LaunchActivatedEventArgs args)
{
    m_window = new MainWindow();
    LoadIconById("Assets/MyAppIcon.ico");
    m_window.Activate();
}

private void LoadIconById(string iconName)
{
    nint hwnd = WinRT.Interop.WindowNative.GetWindowHandle(m_window);
    IntPtr hIcon = LoadImage(
        IntPtr.Zero, iconName, ImageType.IMAGE_ICON, 16, 16, LoadImageFlags.LR_LOADFROMFILE);
    IconId iconID = Microsoft.UI.Win32Interop.GetIconIdFromIcon(hIcon);

    // SetIcon
    m_window?.AppWindow.SetIcon(iconID);
}

[DllImport("user32.dll", SetLastError = true)]
public static extern unsafe IntPtr LoadImage(
    IntPtr hInst,
    string name,
    ImageType type,
    int cx,
    int cy,
    LoadImageFlags fuLoad);

public enum ImageType : uint
{
    IMAGE_BITMAP = 0,
    IMAGE_ICON = 1,
    IMAGE_CURSOR = 2,
}

[Flags]
public enum LoadImageFlags : uint
{
    LR_CREATEDIBSECTION = 0x00002000,
    LR_DEFAULTCOLOR = 0x0,
    LR_DEFAULTSIZE = 0x00000040,
    LR_LOADFROMFILE = 0x00000010,
    LR_LOADMAP3DCOLORS = 0x00001000,
    LR_LOADTRANSPARENT = 0x00000020,
    LR_MONOCHROME = 0x00000001,
    LR_SHARED = 0x00008000,
    LR_VGACOLOR = 0x00000080,
}
```

⚠️暂未测试
```idl

//...
static void SetAppWindowIcon();

```
```cpp
// 1. 包含必要头文件
#include <windows.h>
#include <winrt/Microsoft.UI.Windowing.h>
#include <winrt/Microsoft.UI.Xaml.h>

// 2. 定义 LoadImage 的 C++ 版本
HICON LoadIconFromFile(const wchar_t* iconPath)
{
    // 调用 Win32 API LoadImage 加载图标
    return static_cast<HICON>(
        ::LoadImageW(
            nullptr,                // hInstance
            iconPath,               // 图标文件路径
            IMAGE_ICON,             // 类型
            16, 16,                 // 宽高
            LR_LOADFROMFILE         // 从文件加载
        )
    );
}

// 3. 获取 HWND 并设置图标
void SetAppWindowIcon(winrt::Microsoft::UI::Xaml::Window const& window, const wchar_t* iconPath)
{
    // 获取 HWND
    HWND hwnd = 0;
    window.try_as<IWindowNative>()->get_WindowHandle(&hwnd); // 注意必须使用 window 类型
    if (!hwnd) return;

    // 加载图标
    HICON hIcon = LoadIconFromFile(iconPath);

    // 设置窗口图标（小图标/大图标都可）
    if (hIcon)
    {
        ::SendMessage(hwnd, WM_SETICON, ICON_SMALL, (LPARAM)hIcon);
        ::SendMessage(hwnd, WM_SETICON, ICON_BIG, (LPARAM)hIcon);
    }
}

// 4. 在 OnLaunched 或窗口初始化时调用
void App::OnLaunched(winrt::Microsoft::UI::Xaml::LaunchActivatedEventArgs const&)
{
    window = winrt::make<MainWindow>();
    SetAppWindowIcon(window, L"Assets\\MyAppIcon.ico");
    window.Activate();
}
```