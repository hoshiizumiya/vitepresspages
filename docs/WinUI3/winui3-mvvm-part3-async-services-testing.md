# WinUI 3 C++/WinRT 高级数据绑定与 MVVM 架构实践（第 3 篇：异步、服务注入、消息总线与测试）

> 衔接第2篇：已有完善同步 ViewModel 结构。本篇引入：
> 1. AsyncRelayCommand（支持并发防抖 / 错误捕获 / CanExecute 动态）
> 2. 协程错误、取消、超时与重试封装模式
> 3. 服务注入（轻量容器 + 生命周期）
> 4. 事件/消息聚合器（解耦跨 ViewModel 通信）
> 5. 复合 ViewModel（主从 / 子上下文）
> 6. 可测试化：Mock Repository、调度器抽象、同步协程执行策略

## 1. AsyncRelayCommand 设计

### 1.1 需求特性
| 功能 | 说明 |
|------|------|
| 防重入 | 正在执行时禁止再次触发 |
| 捕获异常 | 转换为错误回调 / 事件 |
| 可取消 | 支持 CancellationTokenSource |
| 动态 CanExecute | 绑定到 IsRunning / 额外谓词 |
| 自动状态属性 | IsRunning / LastError |

### 1.2 IDL（可选）
通常命令类不需要 IDL；通过 `winrt::make` 构造。若你要在 XAML 中直接实例化，可添加：
```idl
namespace MyApp.Commands
{
    [default_interface]
    runtimeclass AsyncRelayCommand : Windows.UI.Xaml.Data.INotifyPropertyChanged
    {
        AsyncRelayCommand();
        Boolean IsRunning{ get; };
        String LastError{ get; };
        void Execute();
        Boolean CanExecute();
    };
}
```
> 但推荐：命令留在 C++ 层；XAML 经由 ViewModel 暴露。避免不必要元数据。

### 1.3 实现（AsyncRelayCommand.h）
```cpp
struct AsyncRelayCommand : winrt::implements<AsyncRelayCommand, winrt::ICommand>
{
    using AsyncFunc = std::function<winrt::fire_and_forget()>; // 或 IAsyncAction 包装
    using CanExecuteFunc = std::function<bool()>;

    AsyncRelayCommand(AsyncFunc exec, CanExecuteFunc canExec = nullptr)
        : m_execute(std::move(exec)), m_can(std::move(canExec)) {}

    bool CanExecute(winrt::IInspectable const&)
    {
        return !m_isRunning && (m_can ? m_can() : true);
    }
    void Execute(winrt::IInspectable const&)
    {
        if (!CanExecute(nullptr)) return;
        m_isRunning = true; NotifyCanChanged();
        auto weak = winrt::make_weak(this->get_strong());
        m_executeWrapper = m_execute(); // fire_and_forget
        // fire_and_forget 内部负责 try/catch + 结束时重置状态
    }
    winrt::event<winrt::EventHandler<winrt::IInspectable>> CanExecuteChanged;
    void NotifyCanChanged(){ CanExecuteChanged(*this, nullptr); }
private:
    AsyncFunc m_execute;
    CanExecuteFunc m_can;
    bool m_isRunning{false};
    winrt::fire_and_forget m_executeWrapper; // 保存引用避免提前销毁
};
```

### 1.4 fire_and_forget 包装模板
```cpp
template<typename TAwaitable, typename TOnError>
winrt::fire_and_forget RunSafe(TAwaitable&& awt, std::atomic<bool>& flag, TOnError onError, std::function<void()> finally)
{
    try
    {
        co_await awt;
    }
    catch (winrt::hresult_canceled const&)
    {
        // 忽略取消
    }
    catch (winrt::hresult_error const& ex)
    {
        onError(ex.message());
    }
    catch (...)
    {
        onError(L"未知错误");
    }
    finally();
    flag.store(false);
}
```

## 2. 异步模式矩阵

| 模式 | 适用 | 模板 |
|------|------|------|
| 超时包装 | API 可能挂起 | `WhenAny(timeout_task, real_task)` |
| 重试（指数退避） | 临时网络失败 | for + delay *= 2 |
| 取消传播 | 用户中止 | CancellationToken + throw_if_cancelled |
| 竞争最快 | 并行源取最快结果 | 2 tasks + WhenAny + Cancel 另一个 |

示例：超时 + 重试：
```cpp
winrt::IAsyncOperation<hstring> FetchWithPolicyAsync()
{
    int attempt = 0; int delayMs = 200;
    for (; attempt < 4; ++attempt)
    {
        auto cts = winrt::CancellationTokenSource();
        auto timeoutOp = winrt::resume_after(std::chrono::milliseconds(1500));
        auto fetchOp = m_api->FetchAsync();
        auto winner = co_await winrt::WhenAny(timeoutOp, fetchOp);
        if (winner == fetchOp)
        {
            cts.Cancel();
            co_return co_await fetchOp; // 成功
        }
        // 超时
        co_await winrt::resume_after(std::chrono::milliseconds(delayMs));
        delayMs *= 2;
    }
    throw winrt::hresult_error(E_FAIL, L"重试失败");
}
```

## 3. 服务注入（轻量 IoC 容器）

### 3.1 Guid Map 容器
```cpp
class ServiceContainer
{
public:
    template<typename TInterface, typename TImpl, typename... Args>
    static void RegisterSingleton(Args&&... args)
    {
        auto boxed = std::make_shared<TImpl>(std::forward<Args>(args)...);
        s_singletons[winrt::guid_of<TInterface>()] = boxed;
    }
    template<typename TInterface>
    static std::shared_ptr<TInterface> Resolve()
    {
        auto it = s_singletons.find(winrt::guid_of<TInterface>());
        if (it != s_singletons.end()) return std::static_pointer_cast<TInterface>(it->second);
        return nullptr;
    }
private:
    static inline std::unordered_map<winrt::guid, std::shared_ptr<void>> s_singletons;
};
```
注册：
```cpp
ServiceContainer::RegisterSingleton<IUserRepository, UserRepository>(apiEndpoint);
```
使用：
```cpp
m_userRepo = ServiceContainer::Resolve<IUserRepository>();
```

### 3.2 抽象接口（IUserRepository.h）
```cpp
struct IUserRepository
{
    virtual winrt::IAsyncOperation<std::vector<UserDto>> GetUsersAsync(int page)=0;
    virtual ~IUserRepository() = default;
};
```
实现：
```cpp
struct UserRepository : IUserRepository
{
    winrt::IAsyncOperation<std::vector<UserDto>> GetUsersAsync(int page) override
    {
        co_await winrt::resume_background();
        // HTTP 调用 / 解析 JSON
        co_return resultVector;
    }
};
```

## 4. 消息总线（事件聚合器）

### 4.1 需求
- 解耦：不同 ViewModel 不直接引用彼此
- 弱引用：防止订阅泄漏
- 频道区分 / 泛型 Payload

### 4.2 实现（MessageBus.h）
```cpp
struct IMessageToken { virtual ~IMessageToken() = default; };

class MessageBus
{
public:
    template<typename TMsg, typename THandler>
    static std::shared_ptr<IMessageToken> Subscribe(THandler&& handler)
    {
        auto token = std::make_shared<HandlerHolder<TMsg>>(std::forward<THandler>(handler));
        GetVec<TMsg>().push_back(token);
        return token;
    }
    template<typename TMsg>
    static void Publish(TMsg const& msg)
    {
        auto& vec = GetVec<TMsg>();
        for (auto it = vec.begin(); it != vec.end(); )
        {
            if (auto h = it->lock()) { h->Invoke(msg); ++it; }
            else it = vec.erase(it);
        }
    }
private:
    template<typename TMsg>
    struct HandlerHolder : IMessageToken
    {
        std::function<void(TMsg const&)> Fn;
        HandlerHolder(std::function<void(TMsg const&)> f):Fn(std::move(f)){}
        void Invoke(TMsg const& m){ Fn(m);}    };
    template<typename TMsg>
    static std::vector<std::weak_ptr<HandlerHolder<TMsg>>>& GetVec()
    {
        static std::vector<std::weak_ptr<HandlerHolder<TMsg>>> s_vec; return s_vec;
    }
};
```
使用：
```cpp
struct UserSelectedMsg{ hstring Id; };
// 订阅
m_token = MessageBus::Subscribe<UserSelectedMsg>([weak = winrt::make_weak(*this)](auto const& m){ if(auto self=weak.get()) self->OnUserSelected(m.Id); });
// 发布
MessageBus::Publish(UserSelectedMsg{ selectedId });
```

## 5. 复合 ViewModel
示例：主列表 + 详情子 VM（复用）：
```cpp
struct UserDetailViewModel : BaseViewModel { /* 加载单个用户、编辑保存 */ };
struct UsersShellViewModel : BaseViewModel
{
    winrt::Windows::Foundation::Collections::IObservableVector<hstring> m_ids{ winrt::single_threaded_observable_vector<hstring>() };
    UserDetailViewModel m_detail{ nullptr }; // 子上下文

    void Select(hstring const& id)
    {
        m_detail.LoadAsync(id); // 子 VM 协程
        RaisePropertyChanged(L"Detail");
    }
    UserDetailViewModel Detail() const { return m_detail; }
};
```
XAML：
```xml
<Grid>
  <Grid.ColumnDefinitions>
    <ColumnDefinition Width="2*"/>
    <ColumnDefinition Width="3*"/>
  </Grid.ColumnDefinitions>
  <ListView ItemsSource="{x:Bind ShellVM.Ids}" SelectionChanged="..."/>
  <local:UserDetailView DataContext="{x:Bind ShellVM.Detail}" Grid.Column="1"/>
</Grid>
```

## 6. 可测试化策略

### 6.1 纯 C++ 单元测试（不加载 WinRT UI）
- 不在测试工程中引用 XAML
- 替换协程调度：将 `resume_background()` mock 成同步执行

```cpp
struct ImmediateDispatcher
{
    static winrt::fire_and_forget Run(winrt::IAsyncAction action)
    {
        co_await action; // 直接同步跑完
    }
};
```

### 6.2 Mock Repository
```cpp
struct FakeUserRepository : IUserRepository
{
    winrt::IAsyncOperation<std::vector<UserDto>> GetUsersAsync(int page) override
    {
        co_return std::vector<UserDto>{ UserDto{L"u1"}, UserDto{L"u2"} };
    }
};
```
注册：
```cpp
ServiceContainer::RegisterSingleton<IUserRepository, FakeUserRepository>();
```

### 6.3 验证属性通知
```cpp
TEST_METHOD(ShouldRaiseIsLoadingFlags)
{
    auto vm = winrt::make_self<UsersListViewModel>();
    bool raised = false;
    auto token = vm->PropertyChanged([&](auto&&, auto const& args){ if(args.PropertyName()==L"IsLoading") raised=true; });
    vm->RefreshCommand();
    Assert::IsTrue(raised);
}
```

## 7. 小结映射
| 目标 | 工具/模式 | 参考 |
|------|-----------|------|
| 异步命令 | AsyncRelayCommand | §1 |
| 稳健网络调用 | 超时+重试+取消 | §2 |
| 解耦服务 | Guid 容器 | §3 |
| 跨 VM 通信 | MessageBus | §4 |
| 子上下文复用 | 复合 VM | §5 |
| 单元测试 | Mock Repo + 属性断言 | §6 |

## 8. 下一篇预告（第4篇）
- 性能（批量通知/虚拟化策略表/热点属性剖析）
- 诊断（事件跟踪/绑定耗时/引用计数快照）
- 构建可演进目录（Feature 分包 / 模块化 winmd）
- 发布与 A/B 开关、遥测注入
- 模板化脚手架生成脚本

---
（第3篇完）
