# WinUI 3 页面生命周期与导航实战

## 引言
在 WinUI 3 中，页面生命周期和导航是应用程序开发的核心部分。理解这些概念对于创建响应式和用户友好的应用至关重要。本篇文章将深入探讨 WinUI 3 中页面的生命周期、导航机制以及相关的事件处理。

## 应用初始化与启动阶段详解

UWP 和 WinUI 3 cppwinrt 架构的启动顺序基本一致，详见第一部分，此处不赘述。

### 程序启动流程简述
1. Windows 外壳启动进程并调用 Main 函数。
2. Main 函数创建 CoreApplication 对象。
3. CoreApplication 对象创建 CoreWindow 对象。
4. CoreWindow 对象被激活，同时创建 DispatcherQueue。
5. App 对象被创建，并调用其构造函数。
6. App 对象的 OnLaunched 方法被调用。
### 窗口启动激活阶段：

执行 OnLaunched 方法。
在 OnLaunched 方法中。我们可以自定义启动行为。 
### 窗口启动与自定义
WinUI 3 使用 `Microsoft.UI.Windowing` 命名空间进行窗口管理，推荐使用 `AppWindow` 类实现高级窗口操作。
通常我们使用 make<`T`>() 创建页面实例。
1.	对象分配与初始化
make<`T`>() 会分配一个实现了 WinRT 接口的对象，并调用其构造函数（可以传递参数）。
2.	返回智能指针
返回的是一个 WinRT 智能指针（如 winrt::MainWindow），自动管理对象生命周期（引用计数）。
3.	类型安全
保证返回的对象类型和接口类型一致，避免手动 new/delete 和 COM 相关的繁琐操作。
#### AppWindow 常用属性与方法
- **Create**：创建窗口实例。
- **Destroy**：销毁窗口。
- **Show/Hide**：显示/隐藏窗口。
- **Move/MoveAndResize**：移动或移动并调整窗口大小。
- **Resize/ResizeClient**：调整窗口或客户区大小。
- **SetIcon/SetTaskbarIcon/SetTitleBarIcon**：设置窗口、任务栏、标题栏图标。
- **SetPresenter**：设置窗口呈现方式（如重叠、全屏等）。
- **AssociateWithDispatcherQueue**：关联到 DispatcherQueue。
- **GetFromWindowId**：通过窗口 ID 获取窗口实例。
- **MoveInZOrderAtTop/Bottom/Below**：调整窗口 Z 顺序。

## 自定义窗口启动
有关此框架的所有窗口高级定义都在 Microsoft.UI.Windowing 命名空间中。
UWP 与 WinUI 3 不一样，特别是命名空间。目前 WinUI 3 使用 `Microsoft.UI.Windowing` 命名空间来处理窗口相关的操作，而不是 `Windows.UI.Xaml.Window`。
你在查找文档时，千万要注意不要和 UWP 的混淆。你应该是 windows app sdk 中查找相关文档。
我们主要使用 `AppWindow` 类来创建和管理应用窗口。以下是在任何位置**自定义**创建应用窗口的基本步骤：
```cpp
// WinUI3\AppWindowSample.cpp
#include <winrt/Microsoft.UI.Xaml.h>
#include <winrt/Microsoft.UI.Windowing.h>
#include <winrt/Microsoft.UI.Xaml.Controls.h>
#include <winrt/Windows.Foundation.h>

using namespace winrt;
using namespace Microsoft::UI::Xaml;
using namespace Microsoft::UI::Windowing;
using namespace Windows::Foundation;

IAsyncAction CreateAndShowAppWindowAsync()
{
    // 1. 异步创建 AppWindow 实例
    auto appWindow = co_await AppWindow::TryCreateAsync();
    if (!appWindow)
    {
        co_return; // 创建失败直接返回
    }

    // 2. 创建 XAML 内容（如一个简单的 TextBlock）
    auto textBlock = TextBlock();
    textBlock.Text(L"Hello, AppWindow!");

    // 3. 设置窗口内容
    AppWindow::SetAppWindowContent(appWindow, textBlock);

    // 4. 设置窗口最小尺寸
    Size minSize{400, 300};
    appWindow.SetPresenter(AppWindowPresenterKind::Overlapped);
    appWindow.SetPreferredMinSize(minSize);

    // 5. 显示窗口
    co_await appWindow.TryShowAsync();

    // 6. 关闭事件处理器（可选）
    appWindow.Closed([](auto const&, auto const&)
    {
        // 资源清理逻辑
    });
}

// 在合适的位置调用（如 App.xaml.cpp 的 OnLaunched 或按钮点击事件中）
// winrt::CreateAndShowAppWindowAsync();
```
- 使用 co_await AppWindow::TryCreateAsync() 异步创建窗口。
- 通过 AppWindow::SetAppWindowContent 设置窗口内容（需传入 XAML 元素）。
- 使用 SetPreferredMinSize 设置窗口最小尺寸。
- 通过 TryShowAsync() 显示窗口
### 关闭窗口与资源释放
关闭时的资源释放和清理工作可以通过已在步骤6中注册的事件来完成。我们直接调用这个方法即可出发注册的事件处理器。
```cpp
appWindow.Close();
```
原理说明：  
AppWindow 的 Closed 事件会在窗口关闭时被触发，无论是用户手动关闭窗口，还是通过代码调用 appWindow.Close()。因此，你在 Closed 事件中注册的资源清理逻辑会被正常执行。


## 使用 AppWindowPresenter 来自定义设置窗口呈现方式

1. Include Necessary Headers: Make sure to include the required headers for using the AppWindow and AppWindowPresenter classes.  
包含必要的头文件：确保包含使用 AppWindow 和 AppWindowPresenter 类所需的头文件。

```C++
#include <winrt/Microsoft.UI.Windowing.h>
using namespace winrt;
using namespace Microsoft::UI::Windowing;
```
2. Initialize the AppWindowPresenter: Create an instance of AppWindowPresenter and set its properties to customize the window’s appearance and behavior.  
初始化 AppWindowPresenter：创建 AppWindowPresenter 的实例，并设置其属性以自定义窗口的外观和行为。

```C++
AppWindowPresenter presenter;
// Set properties such as title, size, etc.
presenter.Title(L"My Custom Window");
presenter.Size({800, 600});
presenter.IsResizable(true);
```
3. Create the AppWindow: Use the Create method of AppWindow to create a new window using the configured presenter.  
创建 AppWindow：使用 AppWindow 的 Create 方法，通过配置好的 presenter 创建新窗口。

```C++
AppWindow myWindow = AppWindow::Create(presenter);
```
4. Show the Window: Finally, display the window using the Show method and set up any necessary event handlers.  
显示窗口：最后，使用 Show 方法显示窗口，并设置任何必要的事件处理器。

```C++
myWindow.Show();
myWindow.Closed([](auto const&, auto const&) {
    // Handle window close
});
```
This example demonstrates how to create a custom window with specific styles and properties defined by the AppWindowPresenter in C++/WinRT. You can further customize the window’s behavior and appearance as needed in your application.
本示例展示了如何在 C++/WinRT 中创建具有特定样式和属性的定制窗口。您可以根据需要在应用程序中进一步自定义窗口的行为和外观。

## Xaml 控件访问操作
假设已经在 XAML 中定义了一个 TextBox 控件，并且希望在 C++/WinRT 代码中访问和操作它。以下是如何在 C++/WinRT 中访问和操作 XAML 控件的示例。
```xml
<TextBox x:Name="MyTextBox" />
```

**有两者种方式可以访问 XAML 控件：**
### 使用 FindName() 方法
```cpp
auto textBox = this->FindName(L"MyTextBox").try_as<winrt::Microsoft::UI::Xaml::Controls::TextBox>();
if (textBox) {
    textBox.Text(L"Hello");
}
```
### 使用自动生成的访问器
```cpp
// 可以直接这样访问控件
MyTextBox().Text(L"Hello World");
auto text = MyTextBox().Text();
MyTextBox().Visibility(winrt::Microsoft::UI::Xaml::Visibility::Collapsed);
```
### Principles

```cpp
// 在 .g.h 中会生成类似这样的声明
winrt::Microsoft::UI::Xaml::Controls::TextBox MyTextBox();

// 在 .g.cpp 中会生成对应的实现
winrt::Microsoft::UI::Xaml::Controls::TextBox MyTextBox()
{
    return GetTemplateChild(L"MyTextBox").try_as<winrt::Microsoft::UI::Xaml::Controls::TextBox>();
}
```
`FindName()` 的作用是根据控件的 XAML 名称（Name 属性）查找并返回对应的 UI 元素实例。  
在 WinUI3 或 UWP 中，通常你会在 XAML 里给控件设置 `x:Name="MyTextBox"`，然后在 C++ 代码里通过 `FindName(L"MyTextBox")` 获取该控件对象，进而操作它（如设置文本、绑定事件等）。
- `FindName(L"MyTextBox") `返回一个 `IInspectable`，需要用 `try_as<>()` 转换为具体控件类型（如 TextBox）。
- 如果控件存在，返回其实例；否则返回空。
- 适用于页面或控件树已加载完毕的场景。


### 与使用 FindName() 的对比

自动生成的访问器（推荐）要求：  
1.	必须调用 InitializeComponent() 来初始化 XAML 控件
2.	控件必须在 XAML 中正确定义并设置 x:Name
3.	项目必须成功构建，生成 .g.h 和 .g.cpp 文件

## 导航视图与导航事件处理

在 xaml 中定义了一个 NavigationView 控件，并且在 C++/WinRT 中处理其导航事件。以下是如何在 C++/WinRT 中处理 NavigationView 的导航事件的示例。
我们常使用 Tag 属性来标识导航项，并在事件处理函数中根据 Tag 值进行不同的操作。

- Tag：是控件的一个属性，可以存储任意对象或标识，常用于数据绑定、临时标记等。注意它不是控件的名字，不能用来查找控件，只能通过控件实例访问其 Tag。它通常用于存储与控件相关的额外信息，如数据上下文或标识符。



## NavigationViewItemInvokedEventArgs Class

NavigationViewItemInvokedEventArgs 类，它位于 Windows.UI.Xaml.Controls 命名空间中。此类提供了 NavigationView.ItemInvoked 事件的事件数据。页面中提到了一些重要信息，包括该类的构造函数、属性以及与 WinUI 2 API 的等效性。

主要内容包括：  
定义：NavigationViewItemInvokedEventArgs 类用于处理导航视图项被调用时的事件数据。  
构造函数：提供了初始化该类的新实例的方法。  
属性：
- InvokedItem：获取被调用项的引用。
- InvokedItemContainer：获取被调用项的容器。
- IsSettingsInvoked：指示被调用项是否为设置菜单项的值。
- RecommendedNavigationTransitionInfo：获取推荐的导航过渡信息。
示例内容：  
该类的构造函数可以通过 new NavigationViewItemInvokedEventArgs() 来创建一个新的实例。


在 NavigationViewItemInvokedEventArgs 类中，IsSettingsInvoked 属性是一个布尔值，用于指示被调用的项是否为设置菜单项。设置菜单项通常是指在导航视图中提供访问应用程序设置或偏好的特定项。例如，当用户点击导航菜单中的齿轮图标时，IsSettingsInvoked 属性将返回 true，表明被调用的项是设置菜单项。这使得开发人员能够根据用户的交互来处理导航。

设置菜单项的概念指的是在导航视图中允许用户访问与应用程序相关的设置的特定项。通过 IsSettingsInvoked 属性，开发人员可以确定用户是否与此特定项进行了交互。例如，如果用户从导航菜单中选择标记为“设置”的选项，IsSettingsInvoked 属性将为 true，这使得应用程序能够做出相应的反应，比如显示设置页面。

在应用程序开发中，IsSettingsInvoked 属性作为指示器，帮助开发人员判断用户是否选择了专门用于设置的菜单项。这一点非常重要，因为它允许应用程序根据用户的交互以不同的方式处理导航。例如，如果用户选择了一个用于设置的菜单项，应用程序可以触发特定的导航过渡或显示设置界面，从而确保用户体验的相关性和流畅性。