# WinUI 3 C++/WinRT 高级数据绑定与 MVVM 架构实践（第 4 篇：性能、诊断、架构演进与部署）

> 前置：第1~3篇已完成 MVVM 全流程（基础/绑定深化/异步+服务+测试）。本篇聚焦：
> 1. 性能策略矩阵（属性/集合/渲染/线程/启动）
> 2. 批量通知与差量同步模板
> 3. 诊断：引用计数快照 / 绑定耗时 / UI 线程阻塞检测
> 4. 架构演进：模块化拆分 / Feature 文件夹 / 跨组件通信
> 5. 发布与遥测 / 环境切换 / 配置注入
> 6. 脚手架建议与清单

## 1. 性能基线矩阵
| 场景 | 问题模式 | 优化策略 | 代码骨架 |
|------|----------|----------|----------|
| 高频属性刷新 | 每次 Raise 触发布局 | Batch 聚合 | §1.1 |
| 大列表首次展示 | 冷启动长卡 | 预加载分页+虚拟化 | §1.2 |
| 增量加载高频 | 多次 UI 线程切换 | Background accumulate -> UI bulk append | §1.2 |
| 复杂函数绑定 | 重复计算 | 缓存 + 失效点 Set | 第2篇 2.1 |
| 启动依赖服务多 | 串行 await | 并行 gather + lazy 初始化 | §1.3 |

### 1.1 批量通知
```cpp
class BatchNotifier
{
public:
    template<typename TRaise>
    static void Run(TRaise raise, std::vector<hstring> props)
    {
        // 记录再统一 Raise，可加去重
        std::sort(props.begin(), props.end());
        props.erase(std::unique(props.begin(), props.end()), props.end());
        for (auto const& p : props) raise(p);
    }
};

// ViewModel 使用
void ComplexUpdate()
{
    std::vector<hstring> dirty;
    if (SetProperty(m_a, 10, L"A")) dirty.push_back(L"A");
    if (SetProperty(m_b, 20, L"B")) dirty.push_back(L"B");
    RecomputeDerived(); dirty.push_back(L"Derived");
    BatchNotifier::Run([this](auto const& n){ RaisePropertyChanged(n); }, std::move(dirty));
}
```

### 1.2 列表增量与分块追加
```cpp
winrt::IAsyncAction UsersListViewModel::LoadInitialAsync()
{
    auto chunk = co_await m_repo->GetUsersAsync(0);
    {
        // 背景准备 vector 再批量 Append 减少多次 VectorChanged
        std::vector<hstring> buffer;
        buffer.reserve(chunk.size());
        for (auto& u : chunk) buffer.push_back(u.Id);
        for (auto& id : buffer) m_users.Append(id);
    }
}
```

### 1.3 并行启动协程
```cpp
winrt::IAsyncAction AppBootstrapper::InitializeAsync()
{
    auto t1 = InitConfigAsync();
    auto t2 = InitCacheAsync();
    auto t3 = InitThemeAsync();
    co_await winrt::when_all(t1, t2, t3); // 并行
}
```

## 2. 差量同步（List Diff 模板）
```cpp
struct DiffOp{ enum Kind{Insert,Remove,Replace} kind; uint32_t index; hstring value; };

std::vector<DiffOp> Diff(const std::vector<hstring>& oldV, const std::vector<hstring>& newV)
{
    // 简化：线性比较（真实可用 LCS 优化）
    std::vector<DiffOp> ops;
    size_t i=0; for(; i<oldV.size() && i<newV.size(); ++i)
        if(oldV[i]!=newV[i]) ops.push_back({DiffOp::Replace,(uint32_t)i,newV[i]});
    for(; i<oldV.size(); ++i) ops.push_back({DiffOp::Remove,(uint32_t)(oldV.size()-1-i),L""});
    for(; i<newV.size(); ++i) ops.push_back({DiffOp::Insert,(uint32_t)i,newV[i]});
    return ops;
}

void Apply(winrt::IObservableVector<hstring> const& target, std::vector<DiffOp> const& ops)
{
    // 执行顺序注意 Remove 从尾开始
    for (auto const& op : ops)
    {
        switch(op.kind){
        case DiffOp::Insert: target.InsertAt(op.index, op.value); break;
        case DiffOp::Remove: target.RemoveAt(op.index); break;
        case DiffOp::Replace: target.SetAt(op.index, op.value); break;
        }
    }
}
```

## 3. 诊断工具化

### 3.1 引用计数快照
```cpp
bool GetRef(winrt::Windows::Foundation::IInspectable const& o, uint32_t& c){ if(auto p=winrt::get_unknown(o)){ c=p->AddRef()-1; p->Release(); return true;} return false; }
```

定期：
```cpp
void LogRefCounts(std::span<winrt::IInspectable const> objs)
{
    for(auto const& o: objs){ uint32_t c; if(GetRef(o,c)) OutputDebugStringW((L"RC="+winrt::to_hstring(c)+L"\n").c_str()); }
}
```

### 3.2 绑定耗时探针（调试版）
```cpp
struct BindingScopeTimer
{
    std::chrono::high_resolution_clock::time_point start{ std::chrono::high_resolution_clock::now() };
    ~BindingScopeTimer(){ auto d=std::chrono::duration_cast<std::chrono::microseconds>(std::chrono::high_resolution_clock::now()-start); if(d.count()>200) OutputDebugStringW((L"[BindSlow]"+winrt::to_hstring(d.count())+L"us\n").c_str()); }
};
// 在需诊断的 getter 内临时放置：BindingScopeTimer _t;
```

### 3.3 UI 线程阻塞监视
```cpp
class UiHangMonitor
{
public:
    void Start()
    {
        m_worker = std::thread([this]{ Probe(); });
    }
    ~UiHangMonitor(){ m_stop=true; if(m_worker.joinable()) m_worker.join(); }
private:
    std::atomic<bool> m_stop{false};
    std::thread m_worker; std::atomic<uint64_t> m_ping{0};
    void Probe()
    {
        while(!m_stop){ auto baseline=m_ping.load(); std::this_thread::sleep_for(std::chrono::seconds(2)); if(m_ping.load()==baseline) OutputDebugStringW(L"[WARN] UI maybe blocked\n"); }
    }
public:
    void Tick(){ m_ping.fetch_add(1); }
};
```
在 UI Dispatcher 定时 `Tick()`。

## 4. 架构演进

### 4.1 Feature 文件夹 vs. 层级文件夹
| 模式 | 结构 | 优点 | 何时切换 |
|------|------|------|----------|
| 分层 (Models/ViewModels/Views) | 经典 | 直观 | 项目早期 |
| Feature 模式 | Features/Users/{Model,VM,View} | 关注封装 | 模块 >5 或团队协作 |

### 4.2 模块化 winmd 拆分
- 每个 Feature 生成独立 winmd：减少增量编译
- 公共基类（BaseViewModel / RelayCommand）放 Core 模块
- 跨模块消息通过 MessageBus，避免直接引用循环

### 4.3 版本化与 API 稳定层
- 导出仅必要 runtimeclass
- 内部类保持纯 C++ (不暴露 IDL)
- 增量演进：新增属性 -> 保持旧接口兼容 -> 标记弃用文档

## 5. 发布与遥测

### 5.1 配置注入
```cpp
struct AppConfig { hstring ApiEndpoint; bool EnableTelemetry; };
class ConfigProvider { public: static AppConfig const& Current(); };
```
- 启动读取 JSON (LocalState)
- ViewModel 不直接读文件，依赖 ConfigProvider

### 5.2 遥测埋点
```cpp
struct Telemetry
{
    static void TrackViewShown(hstring const& name)
    { OutputDebugStringW((L"[Telemetry]View="+name+L"\n").c_str()); }
};
// View Loaded -> Telemetry::TrackViewShown(L"UsersPage");
```

### 5.3 AB 开关
```cpp
bool FeatureEnabled(hstring const& key)
{
    auto& cfg = ConfigProvider::Current();
    // 简化：Map 查找
    return key==L"NewList" && cfg.EnableTelemetry;
}
```
XAML：
```xml
<Grid x:Load="{x:Bind FeatureFlag.NewList}"/>
```
ViewModel 暴露 `FeatureFlag.NewList` 只读属性。

## 6. 脚手架清单
| 功能 | 文件 | 说明 |
|------|------|------|
| BaseViewModel | ViewModels/Base | SetProperty + 批量通知 |
| Relay / AsyncRelay | ViewModels/Base | 命令体系 |
| MessageBus | Infrastructure | 跨 VM 事件 |
| ServiceContainer | Infrastructure | DI 容器 |
| AutoScrollBehavior | Attached | 常用行为示例 |
| Diff Utility | Infrastructure/Collections | 差量同步 |
| Telemetry | Diagnostics | 可插拔 |
| ConfigProvider | Infrastructure | 环境/开关 |

## 7. 常见性能陷阱汇总（对照前文）
| 陷阱 | 症状 | 解决 |
|------|------|------|
| Getter 内做 IO | 卡顿 | 提前缓存 / 异步预热 |
| 每项 Append 单独通知 | 列表抖动 | 批量缓冲后统一 Append |
| 复杂 ToString 频繁执行 | CPU 飙升 | 缓存派生文本 |
| 不移除事件订阅 | 内存泄漏 | 弱引用 + 令牌释放 |
| ViewModel 直接持有控件 | 难测试 / 循环引用 | 仅通过属性/命令交互 |
| 背景线程访问 UI | 崩溃 | resume_foreground/DispatcherQueue |

## 8. 系列导航回顾
| 篇章 | 重点 | 关联文件 |
|------|------|----------|
| 第1篇 | 基础骨架 / BaseViewModel / RelayCommand | winui3-advanced-binding.md |
| 第2篇 | 高级绑定 / 附加属性 / IDL 规划 | winui3-mvvm-part2-advanced-binding.md |
| 第3篇 | 异步命令 / 服务 / 测试 / 消息 | winui3-mvvm-part3-async-services-testing.md |
| 第4篇 | 性能 / 诊断 / 架构演进 | (当前) |

---
（第4篇完 — MVVM 高阶系列结束，后续附录若新增将以 *Appendix* 命名）
