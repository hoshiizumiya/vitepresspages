# WinUI3 中 Window 与 Page 的区别与生命周期详解

目前针对 Windows App sdk 1.7 版本进行说明，注意时间有效性。

## 1. 基本概念

- **Window**：应用的顶层窗口，负责承载和显示内容（通常是一个 Page），拥有完整的生命周期和相关事件。
- **Page**：Window 的内容视图，负责具体的 UI 和逻辑，支持页面导航（Frame.Navigate），没有独立的关闭事件。
- **关系**：一个 Window 通常包含一个 Frame，Frame 负责导航不同的 Page。Page 依赖于 Window 来显示和管理内容，无法独立存在并启动。
- 值得一提的是在 win10 以后，相关由于系统对 dpi 所有窗口的优化，以后无论是顶层窗口还是子窗口，都能够支持高 dpi 的动态调整缩放。
- 注意尽管在 UWP 中，Page 的概念已经被淡化，更多的是使用 UserControl 来承载内容，但在 WinUI3 中 Page 依然是主要的内容视图。

## 2. 生命周期与事件机制

### Window

- 主要事件：
    - `Closed`：窗口关闭时触发，可用于全局资源释放或通知内容清理。
    - `Activated`：窗口激活时触发。
- 典型用途：管理应用生命周期、全局资源、通知页面清理。

### Page

- 没有 `Closed` 事件。
- 主要生命周期方法：
    - `xbindFrameName().Navigate(winrt::Windows::UI::Xaml::Interop::TypeName const& sourcePageType)`
        - 属于 XAML 的控件方法。函数的名字就是 NavigationView 设置的 x:Name。
        - 发起导航，导航到新页面时调用，旧页面会被销毁。[官方 Frame 参考](https://learn.microsoft.com/en-us/windows/windows-app-sdk/api/winrt/microsoft.ui.xaml.controls.frame)
        - 接受一个 winrt 页面类型参数 sourcePageType[模板函数用法官方文档](https://learn.microsoft.com/en-us/uwp/cpp-ref-for-winrt/xaml-typename)。这个命名空间中 Interop （inter operation）代表了在 UWP 代码和 XAML 之间的互操作，目前同样适用于 WinUI3。
        - 我们使用 winrt::xaml_typename function template (C++/WinRT)辅助函数来获得页面类型。它允许开发者直接使用页面名称对应其模板类型。（注意引入winrt命名空间，页面类型在 winrt::ApplicationName::命名空间下）[内部类型参考](https://learn.microsoft.com/en-us/uwp/api/windows.ui.xaml.interop.typename?view=winrt-26100)
        - 在访问您的页面时转换为 TypeName 是必要的，因为它确保导航函数能够正确解释页面的类型。 TypeName 结构包含了类型的 Name 以及其 Kind ，这提供了关于类型来源的上下文信息。这在类型可能是自定义类型或原始类型的情况下尤为重要。通过使用 TypeName ，您确保导航函数接收正确的类型信息以继续进行导航。此实现位于 windows 11 build 中，不开源，故无法查看其具体实现进行分析，欢迎你来对公开资料的补充。
        - 它返回一个 Windows 运行时类型 `Windows::UI::Xaml::Interop::TypeName` 对象来表示该类型。注意，C# 的.NET框架与此不同，请使用 `typeof(YourPageName)`。
        - 用例：
            ```cpp
            xbindFrameName().Navigate(xaml_typename<YourPageName>());
            ```
        - `Navigate()`返回一个布尔值，表示导航是否成功。
        - 具体来说 ，可以通过检查 `NavigationFailed` 事件处理的内部状态来判断导航是否成功。
    - `OnNavigatedTo()`
        - 属于页面类的接口方法。
          - 注意这不是虚方法(Virtual function)，而是一个接口方法(Interface)。不是基类的 virtual 函数。
          - 通过 HomePageT<`HomePage`> 模板混入的“可替换方法”
          - 不要加 override，因为它会告诉编译器：“我要重写一个虚函数”，但基类没有这样的 virtual 函数。编译器报错：“不能重写基类成员”。
          - 在 C++/WinRT 中，这是通过**模板**和代码生成在编译期完成的，不是**运行时虚函数**机制。
          - WinRT底层使用 CRTP（Curiously Recurring Template Pattern）模式来实现这种接口方法的混入。我们在[模板元章节](https://hoshiizumiya.github.io/vitepresspages/WinUI3/Template.html#%E9%AB%98%E7%BA%A7%E6%A8%A1%E6%9D%BF%E5%85%83%E7%BC%96%E7%A8%8B%E6%8A%80%E6%9C%AF%E6%B7%B1%E5%BA%A6%E8%A7%A3%E6%9E%90)中已经简要介绍过相关概念。
        - 在目标 cpp 页面中实现接口。在页面被导航到时，框架自动调用。
        - 函数完整签名：
            ```cpp
            //.xaml.h 文件中的声明
            void OnNavigatedTo(winrt::Microsoft::UI::Xaml::Navigation::NavigationEventArgs const& e);
            ```
        - 要求函数签名必须一致，返回类型可以不一致，但建议一致。因为 C++ 支持返回类型协变（如指针/引用），但一般要求一致或能自动推导(auto)。
        - 我们能看到其位于 `\Generated Files\winrt\Microsoft.UI.Xaml.Controls.h` 文件中有相关的接口声明：是由 cpp/winrt 自动生成的 **接口调用转发胶水代码**，顾名思义它与 IPageOverridesT<`D`> 配合，完成了从 WinRT 接口到你 C++ 方法实现的完整调用链。
        ```cpp
        template <typename T, typename D>
        struct WINRT_IMPL_EMPTY_BASES produce_dispatch_to_overridable<T, D, winrt::Microsoft::UI::Xaml::Controls::IPageOverrides>
            : produce_dispatch_to_overridable_base<T, D, winrt::Microsoft::UI::Xaml::Controls::IPageOverrides>
        {
            auto OnNavigatedFrom(winrt::Microsoft::UI::Xaml::Navigation::NavigationEventArgs const& e)
            {
                if (auto overridable = this->shim_overridable())
                {
                    return overridable.OnNavigatedFrom(e);
                }

                return this->shim().OnNavigatedFrom(e);
            }
            auto OnNavigatedTo(winrt::Microsoft::UI::Xaml::Navigation::NavigationEventArgs const& e)
            {
                if (auto overridable = this->shim_overridable())
                {
                    return overridable.OnNavigatedTo(e);
                }

                return this->shim().OnNavigatedTo(e);
            }
            auto OnNavigatingFrom(winrt::Microsoft::UI::Xaml::Navigation::NavigatingCancelEventArgs const& e)
            {
                if (auto overridable = this->shim_overridable())
                {
                    return overridable.OnNavigatingFrom(e);
                }

                return this->shim().OnNavigatingFrom(e);
            }
        };
        ```
        - 我们这是在为接口 IPageOverrides 提供一个实现。这类似于“实现接口”，但它是通过 CRTP + 模板 在编译期完成的。通过接口投影 + 混入（mixin） 实现。我们有机会会讲讲相关的底层投影逻辑。
        - 遗憾的是我们必须要手写其声明和实现。
        - 我们以后应该会讲到它的底层投影实现细节。其位于`Generated Files\winrt\impl\*.h`中。
        - 框架的自动调用过程：
        ```
        1. XAML Runtime (WinRT)
           ↓ 调用 COM 接口
        2. IPageOverrides::OnNavigatedTo(IInspectable* e)
           ↓ 通过 ABI 调用
        3. winrt::impl::abi<...>::type::OnNavigatedTo(void*)
           ↓ 被 C++/WinRT 分发器捕获
        4. produce_dispatch_to_overridable<...>::OnNavigatedTo(e)
           ↓ 调用 shim()
        5. HomePage::OnNavigatedTo(NavigationEventArgs const& e)  ← 你的实现！
        ```
    - `OnNavigatingFrom`：
      - 属于页面类的接口方法。
      - 在页面**即将离开**时调用，适用于取消导航或保存状态。
      - 非常用方法。
    - `OnNavigatedFrom`：
      - 属于页面类的接口方法。
      - 在页面**已被导航离开**时调用，适合做页面资源释放。
      - 当页面被缓存时（NavigationCacheMode.Required），不会调用析构函数，但**仍然会调用此方法**。
    - 析构函数（C++/WinRT）：页面对象被销毁时自动调用，可做最后的清理。C# 不支持析构函数。
        - 注意：析构函数只在页面对象**真正被销毁**时调用，如果页面被缓存（如设置 NavigationCacheMode 为 Required），析构函数不会及时执行。
        - 在 C# 中，推荐使用 `OnNavigatedFrom` 或实现 `IDisposable` 接口来释放资源。
    - `Unloaded` 事件：
        - 页面从视觉树中移除时触发该事件，适合做 UI 相关的清理。
        - 页面缓存时导航离开**不会触发** `Unloaded`。
- 典型用途：管理页面内资源、响应导航、UI逻辑。
### 简要对比：
- `OnNavigatedFrom` vs `Unloaded`
  - 相似点：都可以用于资源释放和解绑操作。
  - 不同点：
    - `OnNavigatedFrom` 专门用于页面导航离开时，适合释放页面级资源。
    - `Unloaded` 用于页面或控件从视觉树移除时，适合释放 UI 相关资源。
    - 两者触发时机不同，页面缓存时导航离开不会触发 `Unloaded`。
- `Loaded` vs `OnNavigatedTo`
这个极容易混淆记错！
  - `OnNavigatedTo`
    - 触发时机：页面被 Frame 导航到时（即页面成为当前显示页面时）。
    - 典型用途：处理导航参数、初始化页面数据、绑定事件等。
    - 特点：只在导航时触发一次（当页面被缓存，缓存后再次显示不会再触发）。
  - `Loaded`
    - 触发时机：页面的 UI 元素被添加到视觉树（Visual Tree）时。
    - 典型用途：初始化 UI、动画、布局相关操作。
    - 特点：多次触发（如页面缓存后再次显示，或控件被重新加载）。
    > 实际开发建议：
    > 页面数据和导航参数处理放在 `OnNavigatedTo`，UI相关初始化放在 `Loaded`，这样结构更清晰。
- `NavigationCacheMode`：文章后面也会详细介绍。
    - `Required`：页面被缓存，导航离开时不会销毁页面对象，`OnNavigatedFrom` 会被调用，但析构函数不会被调用。
    - `Disabled`：页面不缓存，每次导航都会创建新实例，`OnNavigatedFrom` 和析构函数都会被调用。
    - `Enabled`：页面缓存，但不保证资源释放，适合需要频繁切换的页面。
- `OnNavigatingFrom` vs `OnNavigatedFrom`
  - OnNavigatingFrom 在导航即将发生时触发，可取消导航。
  - OnNavigatedFrom 在导航完成后触发，适合做最终清理。
#### 调用流程：

1. 用户触发导航（如点击按钮），调用 `xbindFrameName().Navigate()` 方法。
2. 框架开始导航，旧页面的 `OnNavigatedFrom()` 被调用。
3. 新页面的 `OnNavigatedTo()` 被调用，完成导航。
运行的流程如下：
```
[PageA] 
   ↓ 调用 Frame.Navigate<PageB>(parameter)
[PageB 被创建]
   ↓ 框架自动调用，前面已有框架调用流程
[PageB.OnNavigatedTo(e)]  ← 接收 parameter
   ↓ 页面加载完成
[PageB.Loaded] 事件触发
   ↓ 页面显示在 Frame 中
```

## 3. 典型用法与推荐实践

- **不要在 Page 里订阅 `Closed` 事件**，因为 Page **没有**这个事件。
- **推荐在 Window 的 `Closed` 事件里通知当前 Page 做清理**，如调用 Page 的自定义清理方法。
- **页面切换时**（Frame.Navigate），旧 Page 会被析构或调用 `OnNavigatedFrom`，适合做资源释放。

在 WinUI3 中，页面资源释放推荐优先使用 `OnNavigatedFrom()` 方法，而不是依赖析构函数。原因如下：
- `OnNavigatedFrom()` 是专门为页面导航离开时设计的生命周期方法，**每次页面被导航离开都会调用**，适合释放事件绑定、定时器等资源。如果用 C++/WinRT，析构函数可做最后兜底清理，但不要只依赖它。
- 析构函数（C++/WinRT 支持，C# 不支持）只有在页面对象**真正被销毁时**才会调用，**如果页面被缓存（如设置 NavigationCacheMode.Required），析构函数不会及时执行**，页面内的资源会长时间无法释放。
- 在 C# 中没有析构函数，只能用 `OnNavigatedFrom` 或实现 `IDisposable`。
- 如果页面需要被 Window 通知关闭，可实现自定义清理方法，由 Window 的 Closed 事件主动调用 Page 的自定义清理方法，确保页面资源被释放。这样可以在整个窗口关闭时，通知页面做一些特殊的清理工作（比如释放资源、保存数据等），而不是只依赖页面的导航事件或析构函数。

示例：
### C++/WinRT 示例
```cpp
// MainWindow.xaml.cpp

MainWindow::MainWindow()
{
    this->Closed({ this, &MainWindow::OnClosed });
    // 假设有一个 Frame 控件的名字叫 m_frame，我们在此处直接导航到页面，在第二部分会讲如何通过按钮点击导航到页面。
    m_frame().Navigate(xaml_typename<YourPage>());
}

void OnClosed(IInspectable const&, IInspectable const&)
{
    // 获取当前页面
    auto page = m_frame.Content().try_as<YourPage>();
    if (page)
    {
        // 调用页面的自定义清理方法。注意需要声明暴露其 Page 对应的 idl 方法。
        page.OnWindowClosed();
    }
    // 还可以做其他全局清理
}

// YourPage.xaml.cpp
void YourPage::OnWindowClosed()
{
    // 这里做自定义清理调用，比如释放资源、保存数据等
    // 例如：m_timer.Stop();
}
```
- 通过 Window 的 Closed 事件，主动通知 Page 做清理，适合需要在窗口关闭时释放资源或保存数据的场景。

## 4. Page 导航时内容状态持久化方案

在 WinUI 3 中，默认情况下，页面（Page）对象在导航离开时会被销毁（析构），页面上的内容和状态（如表单、文本框输入、操作记录等）也会随之丢失。如果希望页面切换后再次返回时内容保持原样，需要实现“状态持久化”机制。

### 4.1 状态持久化的常见方案

1. **外部保存页面状态**  
   在页面导航离开时，将需要保存的数据（如文本、操作记录等）存储到外部容器（如 ViewModel、全局对象、静态变量、字典等），再次导航回来时从外部容器恢复数据。

2. **页面缓存（Page Cache）**  
   通过 Frame 的缓存机制（如设置 `NavigationCacheMode` 为 `Required`），让页面对象不会被销毁，页面内容和状态会自动保留。

3. **序列化与反序列化**  
   导航离开时将页面状态序列化为字符串或对象，导航回来时反序列化恢复。不太靠谱，适合简单数据。



### 4.2 推荐做法：使用 Frame 的缓存机制

WinUI3 的 Frame 控件支持页面缓存，设置 `NavigationCacheMode` 为 `Required` 后，页面对象不会被销毁，所有内容和状态会自动保留。

#### C++/WinRT 示例

```cpp
// YourPage.xaml.cpp
YourPage::YourPage()
{
    // 设置页面缓存，保证状态持久化，相关语法已经在前面章节提到，不再赘述
    this->NavigationCacheMode(winrt::Microsoft::UI::Xaml::Navigation::NavigationCacheMode::Required);
}
```

#### C# 示例

```csharp
// YourPage.xaml.cs
public YourPage()
{
    this.NavigationCacheMode = NavigationCacheMode.Required;
}
```

> 注意：缓存模式下，页面不会被析构，所有控件内容和变量状态都会保留，适合需要“记住内容”的场景。

### 4.3 外部保存与恢复页面状态（适用于不缓存页面的场景）

如果不希望缓存整个页面对象，也可以在导航事件中手动保存和恢复页面状态。

#### C++/WinRT 示例

```cpp
// YourPage.xaml.h
struct YourPage : YourPageT<YourPage>
{
    static winrt::hstring s_text; // 静态变量保存内容
    void OnNavigatedFrom(winrt::Microsoft::UI::Xaml::Navigation::NavigationEventArgs const& e);
    void OnNavigatedTo(winrt::Microsoft::UI::Xaml::Navigation::NavigationEventArgs const& e);
};

// YourPage.xaml.cpp
void YourPage::OnNavigatedFrom(winrt::Microsoft::UI::Xaml::Navigation::NavigationEventArgs const& e)
{
    s_text = myTextBox().Text(); // 离开时保存
}

void YourPage::OnNavigatedTo(winrt::Microsoft::UI::Xaml::Navigation::NavigationEventArgs const& e)
{
    myTextBox().Text(s_text); // 返回时恢复
}
```
注： 

- `static` 静态成员变量属于该类，不属于任何一个对象，只有一份，具有全局生命周期，不会随页面销毁而丢失。所以我们十分不推荐，如果产生了多个页面实例，静态变量会被所有实例共享，可能导致数据混乱。
    - 这个涉及到页面的生命周期了，稍微澄清一些相关内容：
    - 成员变量（如 winrt::hstring m_text;）属于页面对象本身。
    - 当页面被销毁（比如 Frame.Navigate 导航到其他页面），成员变量会随对象一起销毁，数据也会丢失。
    - 如果你只用成员变量保存内容，页面切换回来时是新对象，原来的数据已经没了。
- 你也可以用全局变量、单例类等方式保存数据，但需要自己实现。建议用外部状态容器（如 ViewModel、全局字典、单例对象、参数传递等），或者直接用 Frame 的缓存机制。
#### C# 示例

```csharp
// YourPage.xaml.cs
private static string _cachedText;

protected override void OnNavigatedFrom(NavigationEventArgs e)
{
    _cachedText = myTextBox.Text;
}

protected override void OnNavigatedTo(NavigationEventArgs e)
{
    if (_cachedText != null)
        myTextBox.Text = _cachedText;
}
```

### 4.4 方案选择建议

- **页面内容较多且需要完整保留时**，推荐使用 Frame 的缓存机制（`NavigationCacheMode.Required`）。
- **只需保存部分数据或页面对象不宜缓存时**，推荐在导航事件中手动保存和恢复状态。
- **缓存机制会占用更多内存**，适合页面数量有限的场景；大量页面建议用外部保存方案。

## 5. Page 析构与资源释放实用指导

- **C++/WinRT**：可以直接实现析构函数（`~YourPage()`），在页面对象销毁时自动释放资源。
    - 推荐释放事件绑定、定时器、非托管资源等。
    - 注意：析构函数只在对象真正销毁时调用，导航离开但未销毁不会触发。
- **C#**：没有析构函数，推荐重写 `OnNavigatedFrom` 做清理。
    - 也可实现 `IDisposable` 接口，手动释放资源。
- **通用建议**：
    - 所有资源绑定、订阅、线程、定时器等都应在页面离开或销毁时释放。
    - 如果页面需要被 Window 通知关闭，建议实现一个自定义方法（如 `OnWindowClosed`），由 Window 的事件主动调用。

## 6. 总结

- Window 是顶层容器，拥有完整生命周期和关闭事件，适合做全局管理。
- Page 是内容视图，负责具体 UI 和逻辑，没有关闭事件，适合做页面资源管理。
- 推荐在 Window 的关闭事件里通知 Page 做清理，Page 切换时用导航事件或析构函数释放资源。
- C++/WinRT 支持析构函数，C# 推荐用导航事件或 IDisposable。
- 默认导航会销毁页面对象，内容会丢失。
- 设置 `NavigationCacheMode` 为 `Required` 可自动保留页面内容和状态。
- 也可在导航事件中手动保存和恢复页面状态。
- 选择合适方案，确保用户操作和内容不会因页面切换而丢失。

后面我们会讲页面窗口的生命周期与导航实战