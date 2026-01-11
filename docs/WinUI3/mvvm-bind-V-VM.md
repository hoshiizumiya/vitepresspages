# WinUI 3 + C++/WinRT 的 MVVM 从入门到精通指南

本指南面向从零上手到工程落地的完整路径：x:Bind 强类型绑定、IDL 与 WinMD 打通、INotifyPropertyChanged、ICommand 命令、依赖注入、ViewModelLocator、导航、设计时数据、测试与发布检查表。

目录
- 快速开始（最小可用三步）
- View 创建并持有 VM（入门首选）
- IDL 导入与类型可见性（必读）
- 模式速览与示例（进阶）
- 设计时数据与 DataTemplate
- 导航与页面生命周期
- 测试策略（ViewModel 单元测试）
- 性能与线程（绑定性能、UI 线程回切）
- 发布与检查表（常见坑位合集）

## 快速开始：三步落地 x:Bind
- 在 ViewModel.idl 定义属性并实现 INotifyPropertyChanged
- 在 MainWindow.idl 中 import ViewModel 的 .idl，并暴露 ViewModel { get; }
- 在 MainWindow.cpp 构造 VM 并赋值；XAML 用 x:Bind 绑定 ViewModel.属性
// 详细代码见下文“View 创建并持有 VM（最简单）”与“模式速览与示例（进阶）”。

## 概念速览
- x:Bind 强类型绑定：编译期检查，依赖 WinMD 中可见的属性签名
- Binding + DataContext：弱类型，灵活度高；适合模板与 DataTemplate 场景
- INotifyPropertyChanged：属性变更通知，驱动 UI 更新
- ICommand：解耦交互逻辑（Button.Command 等）
- IDL import：让类型对 MIDL/XAML 编译器“可见”，是强类型绑定的前置

## View 创建并持有 VM（最简单）
适合小型场景。你当前用 x:Bind ViewModel.X，需要在 View 内部公开一个只读属性 ViewModel，并在构造函数里创建并赋值。

### idl属性公开要求
MIDL 提示“unresolved type declaration”是因为在 MainWindow.idl 里引用了 StarNet.ViewModels.MainViewModel，但该类型没有被 MIDL 看见。
修复要点：
	在 MainWindow.idl 顶部 import 定义 MainViewModel 的 idl 文件，例如：import "ViewModels/MainViewModel.idl";
	确保路径正确，且 ViewModels/MainViewModel.idl 已被项目包含并参与 MIDL 编译。
import "ViewModels/MainViewModel.idl";

它是 MIDL/WinRT IDL 的导入指令，作用如下：

- 让当前 IDL 编译单元在编译时读取并解析 ViewModels/MainViewModel.idl 的内容。
- 使该文件里声明/定义的类型（如 StarNet.ViewModels.MainViewModel）在本文件中可见并可被引用，从而避免“unresolved type declaration”。
- 将导入文件的类型一并写入生成的 WinMD 元数据，并参与生成对应的 C++/WinRT 头文件（.g.h 等）。
- 只影响 MIDL 编译阶段，不是 C/C++ 的 #include，也不会在运行时做任何事。
- 路径是相对当前 IDL 文件（或项目包含目录）的；重复导入会被安全地去重。

简要说明它“如何让能用”的链路：

- 编译 IDL 阶段：import 让 midlrt 在处理 MainWindow.idl 时加载并解析 ViewModels/MainViewModel.idl，把对 StarNet.ViewModels.MainViewModel 的引用写进生成的 winmd 元数据里（不导入就解析不了类型）。
- 代码生成阶段：cppwinrt 基于 winmd 生成 MainWindow.g.h/.cpp，属性签名生成为 winrt::StarNet::ViewModels::MainViewModel。XAML 编译器也用同一份 winmd 做 x:Bind 的类型检查（验证 ViewModel.XXX 是否存在）。
- 你的代码阶段：import 只让“类型可见/可生成”，不等于自动可用。你还需要：
  - 在 MainWindow 实现里持有并返回一个 MainViewModel 实例（实现 ViewModel { get; }）。
  - 在 .cpp 里包含 ViewModels/MainViewModel.h，构造实例（它在 IDL 里可激活：MainViewModel();）。
  - 在 XAML 里通过 x:Bind 使用 ViewModel.属性，或设置 DataContext。
  - 若想在 XAML 里直接实例化，还需 xmlns:vm="using:StarNet.ViewModels"。

总结：import 解决“类型解析/元数据/代码生成”的前置条件；真正“能用”取决于你创建对象并把它暴露给 XAML/代码绑定。


## 模式速览与示例（进阶）
下面这篇是面向 C++/WinRT + WinUI 3 的模式速览与示例，覆盖 MVVM、命令模式、建造者模式等在该栈中的常见实践。示例均为 C++/WinRT 风格，尽量保持简洁可运行思路。

### 一、C++/WinRT + WinUI 3 心智模型
- WinUI 3 提供 UI 控件/XAML 运行时与 XAML 编译器
- C++/WinRT 提供现代 C++ 的 WinRT 投影（winrt:: 都来自它）
- IDL 定义你的运行时类型（View、ViewModel、Model 等），MIDL 生成 winmd，cppwinrt 再生成 .g.h/.g.cpp 供你实现
- XAML 的 x:Bind/Binding 做强类型或弱类型绑定，依赖 winmd 里能看到的属性/命名空间

### 二、MVVM 在 WinUI 3（C++/WinRT）中的最小落地
- ViewModel 需要通知机制：INotifyPropertyChanged
- x:Bind（强类型） vs Binding（DataContext 弱类型）
- 在 IDL 中为 View 暴露一个 ViewModel 只读属性，供 x:Bind 使用

示例：简化的 MainViewModel
- IDL（暴露属性与方法）
```idl
namespace PROJ.ViewModels
{
    [default_interface]
    runtimeclass MainViewModel : Microsoft.UI.Xaml.Data.INotifyPropertyChanged
    {
        MainViewModel();
        String StatusText;
        Boolean IsBusy;
        void Refresh();
    }
}
```
- 头文件（关键点：属性 get/set、PropertyChanged 事件）
```cpp
struct MainViewModel : MainViewModelT<MainViewModel>
{
    MainViewModel() = default;

    winrt::hstring StatusText() const { return m_status; }
    void StatusText(winrt::hstring const& v)
    {
        if (m_status != v) { m_status = v; RaisePropertyChanged(L"StatusText"); }
    }

    bool IsBusy() const { return m_busy; }
    void IsBusy(bool v)
    {
        if (m_busy != v) { m_busy = v; RaisePropertyChanged(L"IsBusy"); }
    }

    void Refresh();

    winrt::event<Microsoft::UI::Xaml::Data::PropertyChangedEventHandler> m_propertyChanged;
    winrt::event_token PropertyChanged(Microsoft::UI::Xaml::Data::PropertyChangedEventHandler const& h)
    { return m_propertyChanged.add(h); }
    void PropertyChanged(winrt::event_token const& t) noexcept { m_propertyChanged.remove(t); }

private:
    void RaisePropertyChanged(wchar_t const* name)
    {
        m_propertyChanged(*this, Microsoft::UI::Xaml::Data::PropertyChangedEventArgs{ name });
    }

    winrt::hstring m_status = L"Ready";
    bool m_busy = false;
};
```
示例：View 暴露 VM 供 x:Bind
- IDL

```idl
import "ViewModels/MainViewModel.idl";
namespace StarNet
{
    [default_interface]
    runtimeclass MainWindow : Microsoft.UI.Xaml.Window
    {
        MainWindow();
        StarNet.ViewModels.MainViewModel ViewModel { get; };
    }
}
- .h/.cpp
struct MainWindow : MainWindowT<MainWindow>
{
    MainWindow();
    StarNet::ViewModels::MainViewModel ViewModel() const { return m_vm; }
private:
    StarNet::ViewModels::MainViewModel m_vm{ nullptr };
};

MainWindow::MainWindow()
{
    m_vm = StarNet::ViewModels::MainViewModel{};
    InitializeComponent(); // XAML 生成
}
```
### 三、ViewModel 创建/持有的多种模式
1) View 拥有 VM（简单直接）
- 适合小型或样例项目；你已有的 ViewModel { get; } 就是为 x:Bind 准备的
- XAML 可直接 x:Bind ViewModel.StatusText

2) 依赖注入（组合根创建 VM）
- App 启动时注册服务与 VM 工厂；View 构造时从容器解析
- 最小容器示例

```cpp
struct IServiceProvider {
    template<typename T> using Factory = std::function<T()>;
    template<typename T> void Register(Factory<T> f) { m_[typeid(T).hash_code()] = [f]{ return winrt::box_value(f()); }; }
    template<typename T> T Resolve() { return winrt::unbox_value<T>(m_.at(typeid(T).hash_code())()); }
private:
    std::unordered_map<size_t, std::function<winrt::Windows::Foundation::IInspectable()>> m_;
};

static IServiceProvider g_container;

void App::OnLaunched(...)
{
    g_container.Register<StarNet::ViewModels::MainViewModel>([] { return StarNet::ViewModels::MainViewModel{}; });
}

MainWindow::MainWindow()
{
    m_vm = g_container.Resolve<StarNet::ViewModels::MainViewModel>();
    InitializeComponent();
}
```
3) ViewModelLocator
- 在 XAML 用资源定位器获取 VM；适合设计时数据、多个页面

```cpp
struct ViewModelLocator
{
    StarNet::ViewModels::MainViewModel Main() const { return StarNet::ViewModels::MainViewModel{}; }
};
```
```xml
<Window ... xmlns:vm="using:StarNet">
    <Window.Resources>
        <vm:ViewModelLocator x:Key="Locator" />
    </Window.Resources>
    <Grid DataContext="{Binding Main, Source={StaticResource Locator}}">
        <TextBlock Text="{Binding StatusText}" />
    </Grid>
</Window>
```
4) ViewModel-first 导航
- 先创建 VM，再作为参数导航到 View（Page）
- 适合复杂导航/深链接；WinUI 3 的 Frame.Navigate 支持参数传递

5) XAML 资源/DataTemplate
- 在资源中实例化 VM 或通过 DataTemplate 将 VM 类型映射到 View

### 四、命令模式（ICommand）在 MVVM 中的实现
- 命令模式通过把“动作”封装为对象解耦调用者与实现者
- 在 MVVM 中对应 `Microsoft.UI.Xaml.Input.ICommand`，用于 Button.Command 等

最小 RelayCommand（C++/WinRT）
```cpp
struct RelayCommand : winrt::implements<RelayCommand, Microsoft::UI::Xaml::Input::ICommand>
{
    using ExecuteFunc = std::function<void(winrt::Windows::Foundation::IInspectable const&)>;
    using CanFunc = std::function<bool(winrt::Windows::Foundation::IInspectable const&)>;

    RelayCommand(ExecuteFunc exec, CanFunc can = {}) : m_exec(std::move(exec)), m_can(std::move(can)) {}

    winrt::event<winrt::Windows::Foundation::EventHandler<winrt::Windows::Foundation::IInspectable>> m_canChanged;
    winrt::event_token CanExecuteChanged(winrt::Windows::Foundation::EventHandler<winrt::Windows::Foundation::IInspectable> const& h) { return m_canChanged.add(h); }
    void CanExecuteChanged(winrt::event_token const& t) noexcept { m_canChanged.remove(t); }
    void RaiseCanExecuteChanged() { m_canChanged(*this, nullptr); }

    bool CanExecute(winrt::Windows::Foundation::IInspectable const& p) const
    { return m_can ? m_can(p) : true; }

    void Execute(winrt::Windows::Foundation::IInspectable const& p) const
    { if (m_exec) m_exec(p); }

private:
    ExecuteFunc m_exec;
    CanFunc m_can;
};
```
ViewModel 使用
```cpp
struct MainViewModel : ... {
    MainViewModel()
    {
        ShowAboutCommand(RelayCommand{ [this](auto){ StatusText(L"About..."); } });
        RefreshCommand(RelayCommand{ [this](auto){ Refresh(); }, [this](auto){ return !IsBusy(); } });
    }

    Microsoft::UI::Xaml::Input::ICommand ShowAboutCommand() const { return m_show; }
    void ShowAboutCommand(Microsoft::UI::Xaml::Input::ICommand const& v) { m_show = v; RaisePropertyChanged(L"ShowAboutCommand"); }

    Microsoft::UI::Xaml::Input::ICommand RefreshCommand() const { return m_refresh; }
    void RefreshCommand(Microsoft::UI::Xaml::Input::ICommand const& v) { m_refresh = v; RaisePropertyChanged(L"RefreshCommand"); }

private:
    Microsoft::UI::Xaml::Input::ICommand m_show{ nullptr };
    Microsoft::UI::Xaml::Input::ICommand m_refresh{ nullptr };
};
```
```xml
<Button Command="{x:Bind ViewModel.RefreshCommand}" Content="Refresh"/>
<Button Command="{x:Bind ViewModel.ShowAboutCommand}" Content="About"/>
```
### 五、建造者（Builder）模式在 C++/WinRT 的应用
- 用分步构建、链式 API 创建复杂不可变对象，避免巨构造函数

示例：构建传输选项
```cpp
struct TransferOptions
{
    uint32_t chunkSize{};
    bool encryption{};
    winrt::hstring cipher{};
};

struct TransferOptionsBuilder
{
    TransferOptionsBuilder& ChunkSize(uint32_t v) { m_.chunkSize = v; return *this; }
    TransferOptionsBuilder& Encryption(bool v) { m_.encryption = v; return *this; }
    TransferOptionsBuilder& Cipher(winrt::hstring v) { m_.cipher = std::move(v); return *this; }
    TransferOptions Build() const { return m_; }
private:
    TransferOptions m_{};
};

// 使用
auto opts = TransferOptionsBuilder{}.ChunkSize(1 << 20).Encryption(true).Cipher(L"AES-256").Build();
```
### 六、其他经典模式与该栈的贴合点
- 观察者（Observer）：INotifyPropertyChanged、事件（event<...>）
- 策略（Strategy）：在 VM/Service 中用函数对象或接口抽象可替换算法（如不同路由/传输协议）
- 工厂/抽象工厂（Factory）：根据配置创建不同 VM/Service
- 适配器（Adapter）：把 Win32/C API/第三方库包成 WinRT 友好接口（IInspectable/idl）
- 外观（Facade）：为复杂子系统（网络、文件、序列化）提供简化门面 Service
- 单例（Singleton）：App 级服务（配置、日志、导航）。注意线程安全与测试替换

### 七、IDL 与 WinMD 的胶水
- import "X.idl"; 让 MIDL 解析并把类型写进 winmd；x:Bind/代码生成依赖它
- 在 View 的 IDL 暴露 ViewModel 属性是为 x:Bind 提供强类型入口
- 属性应在 IDL 定义为 get/set（或只读），否则 XAML 编译器可能找不到成员
- 需要在 .vcxproj 中包含 IDL 文件，确保参与 MIDL 编译

### 八、异步与线程
- 使用 co_await + winrt::Windows::Foundation::IAsyncAction 进行异步
- 回到 UI 线程更新绑定：co_await DispatcherQueue::GetForCurrentThread().TryEnqueue(...) 或用 winrt::resume_foreground(DispatcherQueue)
示例

```cpp
winrt::Windows::Foundation::IAsyncAction MainViewModel::Refresh()
{
    IsBusy(true);
    co_await winrt::resume_background();
    // do work...
    auto ui = Microsoft::UI::Dispatching::DispatcherQueue::GetForCurrentThread();
    co_await winrt::resume_foreground(ui);
    StatusText(L"Done");
    IsBusy(false);
}
```
### 九、项目结构建议
- Proj/
  - MainWindow.xaml, .h, .cpp, .idl（暴露 ViewModel）
  - ViewModels/
    - MainViewModel.idl/.h/.cpp（INPC、命令、状态）
  - Models/ Services/
    - 纯业务类型（可用 Builder/策略/工厂）
  - Infrastructure/
    - RelayCommand、ServiceProvider、ViewModelLocator
  - pch.h：包含常用 winrt 头
  - App.xaml/.h/.cpp：注册服务、全局资源

### 十、常见坑位与检查表
- x:Bind 找不到属性：检查 IDL 是否有对应属性，文件是否参与 MIDL 编译，命名空间是否一致
- ICommand 不触发：确认 CanExecute 返回 true，或 RaiseCanExecuteChanged 被调用
- 线程问题：UI 更新必须回 UI 线程；后台操作用 resume_background
- 循环引用：事件/命令持有 lambda 捕获 this 时注意生命周期
- 生成失败：缺少 import、.vcxproj 未包含 IDL、未启用 C++/WinRT 头（<winrt/...>）

## 设计时数据与 DataTemplate

设计时数据（d: 命名空间）
````xaml
<!-- 设计时在设计器中预览 -->
<Window
    ...
    xmlns:d="http://schemas.microsoft.com/expression/blend/2008"
    xmlns:vm="using:StarNet.ViewModels">
    <Grid
        d:DataContext="{d:DesignInstance Type=vm:MainViewModel, IsDesignTimeCreatable=True}">
        <!-- 设计期可预览 StatusText -->
        <TextBlock Text="{x:Bind ViewModel.StatusText, Mode=OneWay}" />
    </Grid>
</Window>
````

DataTemplate + x:DataType（为模板引入强类型）
````xaml
<Page
    ...
    xmlns:vm="using:StarNet.ViewModels">
    <Page.Resources>
        <DataTemplate x:Key="MainItemTemplate" x:DataType="vm:MainViewModel">
            <StackPanel Orientation="Horizontal">
                <TextBlock Text="{x:Bind StatusText}"/>
                <Button Content="Refresh" Command="{x:Bind RefreshCommand}"/>
            </StackPanel>
        </DataTemplate>
    </Page.Resources>
    <!-- ItemsControl 等控件中复用模板 -->
    <!-- <ListView ItemTemplate="{StaticResource MainItemTemplate}" .../> -->
</Page>
````

要点
- x:DataType 使模板内的 x:Bind 具备编译期检查
- 设计时数据仅影响设计器，不参与运行时

## 导航与页面生命周期（ViewModel-first 可选）

最小导航服务（Frame 适配）
````cpp
// filepath: c:\Files\Blog-vitepress\docs\WinUI3\mvvm-bind-V-VM.md
// ...existing code...
// 伪代码示例：在 App 组合根注册并注入
struct NavigationService {
    Microsoft::UI::Xaml::Controls::Frame m_frame{ nullptr };
    void Attach(Microsoft::UI::Xaml::Controls::Frame const& f) { m_frame = f; }
    template<typename TPage, typename TParam>
    bool Navigate(TParam const& p) { return m_frame.Navigate(xaml_typename<TPage>(), box_value(p)); }
    void GoBack() { if (m_frame.CanGoBack()) m_frame.GoBack(); }
};
// VM-first：先造 VM，再作为参数传入 Page，Page.OnNavigatedTo 中接收并赋值
// ...existing code...
````

要点
- Page 接收参数：OnNavigatedTo(args.Parameter())
- VM 生命周期：避免与 Page 强耦合，必要时用弱引用或工厂

## 测试策略（ViewModel 单元测试）

最小示例：断言属性与事件
````cpp
// filepath: c:\Files\Blog-vitepress\docs\WinUI3\mvvm-bind-V-VM.md
// ...existing code...
// 伪代码：使用任意 C++ 测试框架
void Test_StatusText_Raises_PropertyChanged()
{
    StarNet::ViewModels::MainViewModel vm;
    bool raised = false;
    auto token = vm.PropertyChanged([&](auto&&, Microsoft::UI::Xaml::Data::PropertyChangedEventArgs const& e){
        if (e.PropertyName() == L"StatusText") raised = true;
    });
    vm.StatusText(L"Hello");
    // ASSERT_TRUE(raised);
    vm.PropertyChanged(token);
}
// ...existing code...
````

要点
- VM 不依赖 UI 线程，可直接单测
- 命令可通过调用 Execute/CanExecute 断言逻辑

## 性能与线程最佳实践

- x:Bind 优先于 Binding：减少运行时开销
- 合理批量更新：减少 PropertyChanged 风暴
- UI 线程回切：resume_foreground(DispatcherQueue) 后再改属性
- 大列表虚拟化：模板内避免复杂绑定计算；必要时用转换器或值缓存
- 事件/命令避免循环引用：lambda 捕获 this 用 weak_ref

## 发布与检查表（总览）

- IDL/WinMD：所有需要 x:Bind 的属性必须在 .idl 中声明；.idl 已纳入项目并被 MIDL 编译
- import 链路：View.idl import ViewModel.idl；命名空间一致
- 构建：确保 cppwinrt 生成的 .g.h/.g.cpp 被包含，InitializeComponent 正常
- 线程：后台任务回 UI 线程再触发属性更新
- 命令：CanExecute 与 RaiseCanExecuteChanged 配套
- 设计时数据：仅设计器使用，勿在运行时依赖
- 导航：参数类型可序列化/可投影，避免复杂对象跨页

结语
- 从“View 拥有 VM + x:Bind”的最小闭环起步，再按需引入命令、DI/Locator、模板化、导航与测试，逐步走向可维护、可扩展的工程化 MVVM。