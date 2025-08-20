# WinUI 3 C++/WinRT 高级数据绑定与 MVVM 架构实践（第 2 篇：高级绑定与 ViewModel 结构深化）

> 衔接自第1篇：已具备 BaseViewModel / RelayCommand / 基础集合与属性通知。本文聚焦：项目目录规划、IDL 拆分策略、进阶绑定（值转换/多源组合/复杂控件）、附加属性与 DependencyProperty 融合 MVVM、典型实体建模与分层放置决策。

## 1. 目录与分层策略（完整落地）

推荐在解决方案根（示例：`src/`）采用如下结构：
```
src/
  App.xaml / App.idl / App.xaml.*
  Models/
    Domain/               // 纯领域实体 (无 WinRT 依赖，可单元测试)
      User.h
      Order.h
      Product.h
    Dtos/                 // 传输结构（与后端 API / 序列化绑定）
      UserDto.h
      PagedResult.h
    Contracts.idl         // 需要暴露到 XAML 绑定的 WinRT 可见模型（少量）
  Services/
    Abstractions/         // 接口 (C++ 纯虚 or WinRT interface)
      IUserRepository.h
      INetworkClient.h
    Implementations/
      UserRepository.cpp
      NetworkClient.cpp
  ViewModels/
    Base/
      BaseViewModel.idl
      BaseViewModel.h/.cpp
      RelayCommand.h
    Home/
      HomeViewModel.idl
      HomeViewModel.h/.cpp
    Users/
      UsersListViewModel.idl
      UsersListViewModel.h/.cpp
      UserDetailViewModel.idl
      UserDetailViewModel.h/.cpp
  Views/
    HomePage.xaml/.h/.cpp/.idl
    UsersPage.xaml/.h/.cpp/.idl
    UserDetailPage.xaml/.h/.cpp/.idl
  Controls/
    ValidatingTextBox.xaml/.idl/.h/.cpp    // 自定义控件
  Resources/
    Strings/zh-CN/Resources.resw
    Themes/Generic.xaml
  Infrastructure/
    ServiceLocator.h/.cpp
    MessageBus.h/.h
  Diagnostics/
    Logging.h
```

### 1.1 Model / ViewModel / View 放什么？
| 层 | 放置内容 | 绝不放 | 说明 |
|----|---------|--------|------|
| Model.Domain | 领域状态 + 业务不变式 | XAML/WinRT 依赖 | 纯 C++，利于测试/复用 |
| Model.Dtos | 序列化映射结构 | 逻辑 | 与 JSON/XML 映射 |
| ViewModel | 可绑定属性 + 命令 + 协调服务调用 | 复杂渲染/控件实例 | 只输出 primitive / hstring / enum / IObservableVector / bool / DateTime 等 |
| View(XAML) | UI 布局 + 轻度交互 (导航) | 业务规则 | 事件转 Command 或 minimal code-behind |
| Service | IO / 网络 / 缓存 / 仓储 | UI 控件 | 提供异步 API 给 VM |
| Infrastructure | DI / 消息总线 / 主题切换 | 领域规则 | 基础设施支持 |

### 1.2 哪些需要写 IDL？
| 场景 | 是否写 IDL | 理由 |
|------|------------|------|
| 被 XAML `{x:Bind}` 直接访问的 runtimeclass | 是 | 需生成 .winmd 供编译期绑定解析 |
| 仅内部 C++ 使用的纯类 (领域实体) | 否 | 降低开销，保持纯净 |
| 需要被多语言组件消费 | 是 | WinRT 边界需要元数据 |
| 自定义控件公开 DependencyProperty | 是 | 让 XAML 可识别类型 |
| 命令实现 RelayCommand (内部) | 否 | 通过 `winrt::make` 工厂创建，无需 IDL |

### 1.3 IDL 继承策略
- ViewModel 基类：继承 `Windows.UI.Xaml.Data.INotifyPropertyChanged`
- 需要支持集合：仅属性返回 `IObservableVector<T>`，无需额外继承
- 附加属性提供者：注册为静态 `runtimeclass`（若只写静态附加属性，可不实例化）
- 自定义控件：继承 `Microsoft.UI.Xaml.Controls.Control` 或派生控件基类

示例：`UsersListViewModel.idl`
```idl
import "BaseViewModel.idl";
namespace MyApp.ViewModels
{
    runtimeclass UsersListViewModel : BaseViewModel
    {
        UsersListViewModel();
        Windows.Foundation.Collections.IObservableVector<String> Users{ get; };
        String SelectedUserId;
        Boolean IsLoading;
        String ErrorMessage;
        // 命令方法
        void RefreshCommand();
        void LoadMoreCommand();
    };
}
```

## 2. 高级绑定策略

### 2.1 计算/派生属性缓存
在频繁刷新 UI 的场景避免重复拼接：
```cpp
// UsersListViewModel.h (片段)
struct UsersListViewModel : UsersListViewModelT<UsersListViewModel, BaseViewModel>
{
    // ...existing code...
private:
    hstring m_selectedUserId;
    bool m_isLoading{false};
    hstring m_error;
    // 派生缓存
    hstring m_statusBarCache;

    void RecomputeStatusBar()
    {
        // O(1) 构造，避免 List 遍历
        m_statusBarCache = L"共 " + winrt::to_hstring(m_users.Size()) + L" 人" +
            (m_selectedUserId.empty()? L"" : L"，选中=" + m_selectedUserId);
        RaisePropertyChanged(L"StatusBarText");
    }
public:
    hstring StatusBarText() const { return m_statusBarCache; }

    void SelectedUserId(hstring const& v)
    {
        if (SetProperty(m_selectedUserId, v, L"SelectedUserId"))
            RecomputeStatusBar();
    }
};
```

### 2.2 多源组合（无官方 MultiBinding）
通过函数：
```xml
<TextBlock Text="{x:Bind ViewModel.FormatUserLine(ViewModel.SelectedUserId, ViewModel.IsLoading), Mode=OneWay}"/>
```
```cpp
hstring UsersListViewModel::FormatUserLine(hstring const& id, bool loading)
{
    if (loading) return L"加载中...";
    if (id.empty()) return L"未选中";
    return L"当前用户: " + id;
}
```
> 注意：任一参数属性变化会触发函数重新求值（编译期生成表达式订阅）；保持函数纯净。参见 data-binding-basics.md §10。

### 2.3 自定义值转换替代方案
优先 x:Bind 函数；若需在资源字典重用或必须使用 Binding：
```cpp
struct BoolToVisibilityConverter : winrt::implements<BoolToVisibilityConverter, winrt::IValueConverter>
{
    winrt::IInspectable Convert(winrt::IInspectable const& v, winrt::TypeName const&, winrt::IInspectable const&, hstring const&)
    {
        bool b = winrt::unbox_value<bool>(v);
        return winrt::box_value(b? winrt::Visibility::Visible : winrt::Visibility::Collapsed);
    }
    winrt::IInspectable ConvertBack(winrt::IInspectable const&, winrt::TypeName const&, winrt::IInspectable const&, hstring const&) { return nullptr; }
};
```

XAML 引用：
```xml
<Page.Resources>
    <local:BoolToVisibilityConverter x:Key="BoolToVis"/>
</Page.Resources>
<TextBlock Text="正在加载" Visibility="{Binding IsLoading, Converter={StaticResource BoolToVis}}"/>
```

### 2.4 复杂控件（ListView + 增量加载）
ViewModel 暴露实现 `ISupportIncrementalLoading` 的集合封装（详见 第六部分教程 + 第1篇中引用示例）：
```cpp
struct IncrementalUsersSource : winrt::implements<IncrementalUsersSource,
    winrt::IObservableVector<hstring>, winrt::ISupportIncrementalLoading>
{
    // ...省略基础集合实现（参考 winui3-advanced-binding 第1篇 和 collection-binding.md）
    bool HasMoreItems() const { return m_hasMore; }
    winrt::IAsyncOperation<winrt::LoadMoreItemsResult> LoadMoreItemsAsync(uint32_t count)
    {
        co_await winrt::resume_background();
        // 拉取数据 -> append
        co_return winrt::LoadMoreItemsResult{ loaded }; // UI 自动刷新
    }
};
```
ViewModel：
```cpp
auto Users() const { return m_incrementalUsers; } // 直接绑定 ItemsSource
```
ListView：
```xml
<ListView ItemsSource="{x:Bind ViewModel.Users}" IncrementalLoadingTrigger="Edge" IncrementalLoadingThreshold="5"/>
```

### 2.5 附加属性 + MVVM 行为注入
自定义“自动滚动到底”行为：
`AutoScrollBehavior.idl`
```idl
namespace MyApp.Attached
{
    [default_interface]
    runtimeclass AutoScrollBehavior : Microsoft.UI.Xaml.DependencyObject
    {
        AutoScrollBehavior();
        static Microsoft.UI.Xaml.DependencyProperty EnableProperty{ get; };
        static Boolean GetEnable(Microsoft.UI.Xaml.DependencyObject target);
        static void SetEnable(Microsoft.UI.Xaml.DependencyObject target, Boolean value);
    };
}
```
实现：
```cpp
// AutoScrollBehavior.cpp (片段)
DependencyProperty AutoScrollBehavior::s_enableProperty =
    DependencyProperty::RegisterAttached(L"Enable", xaml_typename<bool>(), xaml_typename<MyApp::Attached::AutoScrollBehavior>(),
        PropertyMetadata{ winrt::box_value(false), PropertyChangedCallback{ &AutoScrollBehavior::OnEnableChanged }});

void AutoScrollBehavior::OnEnableChanged(DependencyObject const& d, DependencyPropertyChangedEventArgs const& e)
{
    if (auto list = d.try_as<winrt::ListView>())
    {
        bool enabled = winrt::unbox_value<bool>(e.NewValue());
        if (enabled)
        {
            // 订阅集合变化
            if (auto ov = list.ItemsSource().try_as<winrt::IObservableVector<IInspectable>>())
            {
                auto weak = winrt::make_weak(list);
                ov.VectorChanged([weak](auto const& src, auto const& args)
                {
                    if (auto strong = weak.get())
                    {
                        strong.UpdateLayout();
                        strong.ScrollIntoView(src.GetAt(src.Size()-1));
                    }
                });
            }
        }
    }
}
```
XAML 使用：
```xml
<ListView ItemsSource="{x:Bind ViewModel.Logs}" local:AutoScrollBehavior.Enable="True"/>
```
> 附加属性放在 *Attached* 子命名空间；只需在 IDL 声明公开静态成员即可。详见 dependency-attached-properties.md 原理章节。

## 3. 异步协程与命令耦合（预告第3篇）
在第3篇将扩展：
```cpp
winrt::IAsyncAction UsersListViewModel::RefreshCommand()
{
    if (m_isLoading) co_return; // 防抖
    IsLoading(true);
    auto guard = wil::scope_exit([&]{ IsLoading(false); });
    try
    {
        auto data = co_await m_userRepo->FetchUsersAsync();
        m_users.Clear();
        for (auto&& u : data) m_users.Append(u.Id);
        RaisePropertyChanged(L"Users");
    }
    catch (winrt::hresult_error const& ex)
    {
        ErrorMessage(ex.message());
    }
}
```
并给出统一错误转换 / 取消 Token / 超时包装模式。

## 4. 放置决策速表（补充）
| 需求 | 放置 | 示例 |
|------|------|------|
| 登录状态（当前用户信息） | SessionService / ViewModel 暴露投影 | CurrentUserViewModel |
| UI 层缓存（列表分页） | ViewModel 内部字段 | m_pageIndex, m_buffer |
| 领域计算（价格折扣） | Domain Model 方法 | Order::ApplyDiscount(rate) |
| UI 状态（IsBusy, DialogOpen） | ViewModel 属性 | bool + RaisePropertyChanged |
| 主题切换 / 全局消息 | Infrastructure (MessageBus/ThemeService) | ThemeService::SetDark() |
| 附加行为（AutoScroll） | Attached runtimeclass | AutoScrollBehavior |

## 5. 已覆盖与外部参阅映射
| 本篇主题 | 已引用基础 | 外部文件 |
|----------|-----------|----------|
| IDL 拆分策略 | 接口机制 | interface.md |
| IObservableVector 使用 | 集合差量 | collection-binding.md |
| SetProperty 模板 | INPC 原理 | property-change-notification.md |
| 附加属性实现 | DependencyProperty 流程 | dependency-attached-properties.md |
| 函数组合绑定 | x:Bind 工作模型 | data-binding-basics.md |
| 增量加载骨架 | 性能部分 | WinUI3-WinRT-CPP-完整教程-第六部分-实战技巧与最佳实践.md |

## 6. 下一篇预告（第3篇）
将覆盖：
- 协程与命令融合（AsyncRelayCommand in C++/WinRT）
- 错误/取消/超时/重试策略矩阵
- 消息与事件聚合（弱引用 + 频道分发）
- 服务注入：手写 ServiceLocator vs. 基于 guid map 的容器
- 复合 ViewModel（主从结构 / 工作单元模式）
- 测试：Mock Repository & 协程调度注入

---
（第2篇完）
