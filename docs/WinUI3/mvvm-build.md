下面是一篇面向 WinUI 3 + C++/WinRT 的模式速查与实例，覆盖 MVVM、命令模式、建造者模式等，并结合 IDL/x:Bind 的关键点。

一、栈与构建流程速览
- XAML 负责 UI 声明；x:Bind/Binding 做数据绑定。
- IDL 定义本地 WinRT 类型（View、ViewModel、Model）；MIDL 生成 winmd 元数据；cppwinrt 基于 winmd 生成 .g.h/.g.cpp 骨架。
- 依赖关系：使用某个类型前需 import 其 IDL（例如 MainWindow.idl import ViewModels/MainViewModel.idl）。

二、IDL 与 x:Bind 的关键
- 在 View 的 IDL 里暴露 ViewModel 属性，供 x:Bind 强类型绑定。
- 引用外部类型必须 import 对应 IDL，否则会出现 unresolved type declaration。

示例：MainWindow.idl
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

示例：MainViewModel.idl（按你的 XAML 需要的属性/命令最小化定义）
namespace StarNet.ViewModels
{
    [default_interface]
    runtimeclass MainViewModel : Microsoft.UI.Xaml.Data.INotifyPropertyChanged
    {
        MainViewModel();
        // 标题栏
        String AppVersion;
        String StatusText;

        // 导航状态
        Boolean IsHomePageSelected;
        Boolean IsNetworkPageSelected;
        Boolean IsPeerPageSelected;
        Boolean IsTransferPageSelected;
        Boolean IsSettingsPageSelected;

        // 快速统计
        Int32 ConnectedPeersCount;
        Int32 ActiveTransfersCount;
        String TotalBytesTransferredText;
        String CurrentTransferSpeedText;

        // 最近活动
        Windows.Foundation.Collections.IVectorView<String> RecentActivities { get; };

        // 状态栏
        Boolean HasError;
        String  LastError;
        Boolean HasNotification;
        String  LastNotification;
        String  UserName;
        String  DeviceName;

        // 命令
        Microsoft.UI.Xaml.Input.ICommand ShowAboutCommand;
        Microsoft.UI.Xaml.Input.ICommand NavigateToPageCommand;
        Microsoft.UI.Xaml.Input.ICommand StartNetworkDetectionCommand;
        Microsoft.UI.Xaml.Input.ICommand ConnectToPeerCommand;
        Microsoft.UI.Xaml.Input.ICommand RefreshCommand;
        Microsoft.UI.Xaml.Input.ICommand ClearErrorCommand;
    }
}
```
三、MVVM 的落地方式（常见几种）
1) View 拥有并公开 VM（简单直接，配合 x:Bind）
- 适合你的当前 XAML：直接 x:Bind ViewModel.*
- 在 MainWindow 构造函数里创建 VM 并返回给只读属性。

```cpp
// MainWindow.xaml.h/.cpp（要点）
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
    InitializeComponent();
}
```
2) 依赖注入（组合根创建）
- App 启动时注册工厂，View 构造时解析。适合中大型项目与单元测试。
- 可实现一个极简 ServiceProvider，用 std::function 保存工厂。

3) ViewModelLocator
- XAML 资源提供 VM，View 通过资源/定位器绑定。适合设计时数据与多个页面共享。

4) ViewModel-first 导航
- 先构建 VM，再把 VM 作为参数导航到 Page。

5) DataTemplate + DataContext
- 如果你用 Binding 而非 x:Bind，可直接把 DataContext 设为 VM，不必在 IDL 暴露 ViewModel 属性。

四、命令模式（ICommand）在 WinUI 3 中
- 命令模式把“动作”封装成对象，Button.Command 等通过接口调用，不依赖具体实现。
- 在 C++/WinRT 中实现 `Microsoft.UI.Xaml.Input.ICommand`。

简易 RelayCommand
```cpp
struct RelayCommand : winrt::implements<RelayCommand, Microsoft::UI::Xaml::Input::ICommand>
{
    using Execute = std::function<void(winrt::Windows::Foundation::IInspectable const&)>;
    using CanExec = std::function<bool(winrt::Windows::Foundation::IInspectable const&)>;

    RelayCommand(Execute e, CanExec c = {}) : exec(std::move(e)), can(std::move(c)) {}

    winrt::event<winrt::Windows::Foundation::EventHandler<winrt::Windows::Foundation::IInspectable>> m_canChanged;
    winrt::event_token CanExecuteChanged(winrt::Windows::Foundation::EventHandler<winrt::Windows::Foundation::IInspectable> const& h) { return m_canChanged.add(h); }
    void CanExecuteChanged(winrt::event_token const& t) noexcept { m_canChanged.remove(t); }
    void RaiseCanExecuteChanged() { m_canChanged(*this, nullptr); }

    bool CanExecute(winrt::Windows::Foundation::IInspectable const& p) const { return can ? can(p) : true; }
    void Execute(winrt::Windows::Foundation::IInspectable const& p) const { if (exec) exec(p); }

private:
    Execute exec;
    CanExec can;
};
```
```cpp
ViewModel 中使用命令（部分）
struct MainViewModel : MainViewModelT<MainViewModel>
{
    MainViewModel()
    {
        ShowAboutCommand(RelayCommand{ [this](auto){ StatusText(L"About..."); } });
        RefreshCommand(RelayCommand{ [this](auto){ DoRefresh(); }, [this](auto){ return !IsBusy(); } });
        NavigateToPageCommand(RelayCommand{ [this](auto const& param){ Navigate(param); } });
    }

    // ICommand 属性样板
    Microsoft::UI::Xaml::Input::ICommand ShowAboutCommand() const { return m_showAbout; }
    void ShowAboutCommand(Microsoft::UI::Xaml::Input::ICommand const& v) { m_showAbout = v; RaisePropertyChanged(L"ShowAboutCommand"); }
    // ...同理实现其它命令...

private:
    void DoRefresh() { /* 刷新逻辑，必要时切回 UI 线程 */ }
    void Navigate(winrt::Windows::Foundation::IInspectable const& p) { /* 根据参数切换 IsXXXPageSelected */ }

    Microsoft::UI::Xaml::Input::ICommand m_showAbout{ nullptr };
    Microsoft::UI::Xaml::Input::ICommand m_refresh{ nullptr };
    Microsoft::UI::Xaml::Input::ICommand m_navigate{ nullptr };
    bool IsBusy() const { return m_busy; }
    bool m_busy{ false };

    void RaisePropertyChanged(wchar_t const* name)
    {
        m_propertyChanged(*this, Microsoft::UI::Xaml::Data::PropertyChangedEventArgs{ name });
    }
    winrt::event<Microsoft::UI::Xaml::Data::PropertyChangedEventHandler> m_propertyChanged;
};
```
五、建造者（Builder）模式
- 通过链式 API 构造复杂配置对象，避免“巨构造函数”，提高可读性。

示例：传输选项 Builder
```cpp
struct TransferOptions
{
    uint32_t chunkSize{};
    bool encryption{};
    winrt::hstring cipher{};
};

struct TransferOptionsBuilder
{
    TransferOptionsBuilder& ChunkSize(uint32_t v) { opt.chunkSize = v; return *this; }
    TransferOptionsBuilder& Encryption(bool v) { opt.encryption = v; return *this; }
    TransferOptionsBuilder& Cipher(winrt::hstring v) { opt.cipher = std::move(v); return *this; }
    TransferOptions Build() const { return opt; }
private:
    TransferOptions opt{};
};
// 使用
auto opts = TransferOptionsBuilder{}.ChunkSize(1 << 20).Encryption(true).Cipher(L"AES-256").Build();

```
六、策略（Strategy）模式
- 为可替换算法定义统一接口，运行时选择具体策略。可用于协议选择、路由、打包压缩等。

接口与实现
```cpp
struct IProtocolStrategy
{
    virtual ~IProtocolStrategy() = default;
    virtual void Connect(winrt::hstring const& endpoint) = 0;
};

struct TcpStrategy : IProtocolStrategy
{
    void Connect(winrt::hstring const& endpoint) override { /* TCP 连接 */ }
};

struct UdpStrategy : IProtocolStrategy
{
    void Connect(winrt::hstring const& endpoint) override { /* UDP 连接 */ }
};
```
在 VM/Service 中注入策略
```cpp
class NetworkService
{
public:
    explicit NetworkService(std::unique_ptr<IProtocolStrategy> s) : strategy(std::move(s)) {}
    void Connect(winrt::hstring const& ep) { strategy->Connect(ep); }
private:
    std::unique_ptr<IProtocolStrategy> strategy;
};
```
七、工厂/抽象工厂（Factory）
- 根据配置或环境创建不同实现，集中对象构造逻辑。

示例
```cpp
enum class Proto { TCP, UDP };

std::unique_ptr<IProtocolStrategy> MakeProtocol(Proto p)
{
    switch (p)
    {
    case Proto::TCP: return std::unique_ptr<IProtocolStrategy>(new TcpStrategy{});
    case Proto::UDP: return std::unique_ptr<IProtocolStrategy>(new UdpStrategy{});
    default:         return nullptr;
    }
}
```
八、适配器（Adapter）
- 把第三方/非 WinRT API 包装成 WinRT 友好的接口或 ViewModel 可用的模型。

示例：包装一个非 WinRT 的速率计算器
```cpp
class LegacyRateCounter { public: double avg() const; };
struct RateCounterAdapter
{
    explicit RateCounterAdapter(LegacyRateCounter* p) : ptr(p) {}
    winrt::hstring AverageSpeedText() const
    {
        auto v = ptr ? ptr->avg() : 0.0;
        wchar_t buf[64]{};
        swprintf_s(buf, L"%.2f KB/s", v / 1024.0);
        return buf;
    }
private:
    LegacyRateCounter* ptr{};
};
```
九、外观（Facade）
- 对复杂子系统（网络、存储、加解密）提供简化入口，降低 VM 的复杂度。

示例
```cpp
class AppFacade
{
public:
    void RefreshAll()
    {
        network.CheckStatus();
        storage.PruneTemp();
        // ...
    }
private:
    NetworkService network{/*...*/};
    // StorageService storage; CryptoService crypto; ...
};
```
十、观察者（Observer）
- INotifyPropertyChanged 就是观察者模式。属性变更后 RaisePropertyChanged，UI 自动更新。

要点
- 属性 setter 内部比较旧值与新值，不同再通知。
- 事件字段类型：winrt::event<Microsoft::UI::Xaml::Data::PropertyChangedEventHandler>

十一、模板方法/状态（Template Method/State）
- 模板方法：在基类中定义流程骨架，子类扩展步骤（适合多个 VM/页共享流程）。
- 状态模式：将对象在不同状态下的行为分离成状态类（适合传输/连接状态机）。

简单状态切换
```cpp
enum class ConnState { Disconnected, Connecting, Connected };
struct ConnectionContext
{
    void SetState(ConnState s) { state = s; UpdateText(); }
    winrt::hstring Text() const { return text; }
private:
    void UpdateText()
    {
        switch (state)
        {
        case ConnState::Disconnected: text = L"未连接"; break;
        case ConnState::Connecting:   text = L"连接中"; break;
        case ConnState::Connected:    text = L"已连接"; break;
        }
    }
    ConnState state{ ConnState::Disconnected };
    winrt::hstring text{ L"未连接" };
};
```
十二、与 WinUI 3 的线程与异步（不使用协程）
- 后台工作用 std::thread 或线程池，回到 UI 线程用 DispatcherQueue.TryEnqueue。
- 不依赖 co_await，同样可满足 C++14。

示例：回 UI 线程更新
```cpp
auto dq = Microsoft::UI::Dispatching::DispatcherQueue::GetForCurrentThread();
// 后台线程
std::thread([dq, this]
{
    // do work...
    dq.TryEnqueue([this]
    {
        StatusText(L"完成");
    });
}).detach();
```
十三、落地检查清单
- IDL 引用的类型已 import 对应 idl，且文件被项目包含。
- View 若用 x:Bind，必须公开强类型属性（你已在 MainWindow.idl 暴露 ViewModel { get; }）。
- XAML 绑定的属性/命令，在 ViewModel.idl 中必须声明；实现中要 RaisePropertyChanged。
- ICommand 的 CanExecute 为假时按钮不可点击；状态变化时调用 RaiseCanExecuteChanged。
- UI 更新必须回 UI 线程（DispatcherQueue）。
- 生成失败优先看：未 import、.idl 未编译、命名空间不一致、生成头（.g.h）未生成。

十四、把本文模式直接应用到你的 XAML
- 你的 MainWindow.xaml 正在 x:Bind ViewModel.AppVersion、ShowAboutCommand、NavigateToPageCommand 等。
- 按上面的 MainViewModel.idl 把这些成员补充完整；在 MainViewModel 实现中提供对应属性与命令。
- MainWindow.idl 已 import MainViewModel.idl；在 MainWindow 构造中创建并返回 VM 实例。
- 如需更可测试的结构，引入一个最小 DI 容器，在 App 启动注册 VM 工厂，然后 MainWindow 解析 VM。

这样组合使用 MVVM + 命令模式 + Builder/Strategy/Factory/Adapter/Facade，基本能覆盖 WinUI 3 + C++/WinRT 的大部分工程化需求。