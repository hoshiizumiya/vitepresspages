# WinUI 3 + C++/WinRT 数据绑定总览（入口）

本篇为数据与 UI 更新机制的【导航综述】。针对新手到进阶读者，将冗长内容拆分为多篇专题：基础概念、集合绑定、属性变更通知、依赖/附加属性、ComboBox 典型模式以及调试与常见错误。请按需阅读，避免一次性过载。

> 约定：WinUI 3 使用命名空间 `Microsoft.UI.Xaml`；若看到旧示例里的 `Windows.UI.Xaml` 请替换。所有可参与 XAML 绑定的公开属性均需要在 `.idl` 中声明为 WinRT 类型（或返回 WinRT 可投影接口）。

## 目录速览

| 专题 | 目标人群 | 关键点 | 链接 |
|------|----------|--------|------|
| 0. WinRT 集合接口全览 | 新手→进阶 | Windows.Foundation.Collections 系列接口速查 | [winrt-collections-overview.md](winrt-collections-overview.md) |
| 1. 绑定基础模型与数据流 | 新手 | 绑定分类 / 一次性 vs 单向 vs 双向 / x:Bind 与 Binding 区别 | [data-binding-basics.md](data-binding-basics.md) |
| 2. 集合类型与列表绑定 | 新手→进阶 | `IVector<T>` vs `IObservableVector<T>` / 何时 UI 自动刷新 | [collection-binding.md](collection-binding.md) |
| 3. 单属性通知与 ViewModel 基础 | 进阶 | `INotifyPropertyChanged` / IDL 要求 / 计算属性策略 | [property-change-notification.md](property-change-notification.md) |
| 4. 依赖属性与附加属性 | 进阶 | DependencyProperty 注册 / RegisterAttached / 投影模式 | [dependency-attached-properties.md](dependency-attached-properties.md) |
| 5. ComboBox 三种绑定模式示例 | 新手→实战 | 手动 Items / ItemsSource / XAML 属性绑定对比 | [combobox-binding-examples.md](combobox-binding-examples.md) |
| 6. 调试、性能与常见错误 | 全部 | 常见坑 / 性能基线 / 调试脚手架 | [binding-debugging-and-pitfalls.md](binding-debugging-and-pitfalls.md) |
| 7. MVVM 高级实践（已存在） | 进阶 | RelayCommand / 多层 ViewModel 结构 | [winui3-advanced-binding.md](winui3-advanced-binding.md) |

---
## 1. 总体认知图

```
数据源 (字段 / 集合 / 依赖属性)
  │
  ├─ 手动赋值：代码直接操作控件属性 (无通知要求)
  ├─ x:Bind：编译期生成访问代码 (OneTime / OneWay / TwoWay)
  └─ Binding：运行期解析，依赖 DataContext (常规 OneWay / TwoWay)

刷新触发：
  - 集合：IObservableVector<T>.VectorChanged
  - 单属性：INotifyPropertyChanged.PropertyChanged
  - 依赖属性：DependencyProperty 系统内部监听 (可选回调)
```

## 2. WinRT 可绑定类型要求（关键）

1. 公开给 XAML 的属性必须在 `.idl` 中声明（运行时类 / 接口），否则 x:Bind / Binding 无法投影。
2. 属性类型须为 WinRT 可投影类型：
   - 基元：`String` → `hstring`，`Int32`，`Double`，`Boolean` 等。
   - 集合接口：`Windows.Foundation.Collections.IVector<T>` / `IObservableVector<T>` / `IMap<K,V>` 等。
   - 自定义 `runtimeclass` / `interface`。
3. C++ 实现函数签名与 IDL 严格匹配（返回类型、名称、参数）。
4. 仅 `IObservableVector<T>` 触发 UI 列表自动刷新；`IVector<T>` 可以绑定但修改后不自动更新（需手动重置 ItemsSource 或触发重新绑定）。

## 3. 集合类型对比速记

| 类型 | 可绑定 | 自动通知 | 典型用途 | 升级策略 |
|------|--------|----------|----------|----------|
| `IVector<T>` | ✅ | ❌ | 静态列表 / 初始化后不变 | 改为 `IObservableVector<T>` |
| `IObservableVector<T>` | ✅ | ✅ | 动态增删改 | 无 |
| `std::vector<T>` | ❌ | ❌ | 纯 C++ 逻辑 | 用 WinRT vector 重新暴露 |

> 若已有内部 `std::vector<T>`，可在 getter 中同步拷贝到 `IObservableVector<T>`（成本 O(n)，频繁同步不划算）。

## 4. 模式决策速查

| 需求 | 推荐 | 说明 |
|------|------|------|
| 静态配置一次展示 | x:Bind + OneTime | 不实现通知，最少开销 |
| 可编辑表单（少量字段） | x:Bind + TwoWay + INotifyPropertyChanged | 编译期安全与性能平衡 |
| 动态列表 + 选中项 | IObservableVector + INPC(选中属性) | 列表刷新 + 选中同步 |
| 复用 ViewModel / Converter | Binding + DataContext | 需要运行期灵活性 |
| 需要动画 / 样式参与属性系统 | 依赖属性 (DependencyProperty) | 统一值优先级解析 |
| 横向增强现有控件行为 | 附加属性 | 非侵入扩展 |

## 5. 常见易混点

| 易错点 | 说明 | 解决 |
|--------|------|------|
| 用 `std::vector` 直接绑定 | XAML 无法识别 STL | 暴露 `IObservableVector<T>` 包装 |
| 更新 `IVector<T>` 期待 UI 刷新 | 没有 VectorChanged | 改用 `IObservableVector<T>` 或重设 ItemsSource |
| 未在 IDL 声明属性 | 绑定失败（静默） | 补充 IDL 声明并重新生成 |
| 使用旧命名空间 `Windows.UI.Xaml` | WinUI 3 新框架不一致 | 全面替换为 `Microsoft.UI.Xaml` |
| 属性 setter 每次都 Raise | 造成无意义刷新 | 先比较再通知 |
| 依赖属性注册类型错误 | 运行时异常或静默无效 | 使用 `winrt::xaml_typename<T>()` 校验 |

## 6. 接下来阅读什么？

按学习路径建议：
1. 初次接触：先读《绑定基础模型与数据流》与《集合类型与列表绑定》
2. 需要修改属性自动刷新：研读《单属性通知》
3. 做控件扩展或样式动画：阅读《依赖属性与附加属性》
4. 需要具体控件案例：参考《ComboBox 模式示例》
5. 排错 & 优化：最后翻《调试与常见错误》

---
## 7. 快速示例对照

```cpp
// IDL
runtimeclass SamplePage : Microsoft.UI.Xaml.Page
{
    SamplePage();
    Windows.Foundation.Collections.IObservableVector<String> Items{ get; }; // 动态列表
    String Title; // 单属性（需通知）
}

// C++ 片段
winrt::Windows::Foundation::Collections::IObservableVector<hstring> SamplePage::Items()
{ return m_items; }

void SamplePage::Title(hstring const& v)
{ if (m_title != v) { m_title = v; PropertyChanged(*this, { L"Title" }); } }

// XAML
<ListView ItemsSource="{x:Bind Items}"/>
<TextBox Text="{x:Bind Title, Mode=TwoWay}"/>
```

> 更完整控件扩展示例（依赖属性 / 附加属性）参阅：`dependency-attached-properties.md`

---
## 8. FAQ 精简

| 问题 | 简答 |
|------|------|
| 必须实现 INotifyPropertyChanged 吗？ | 仅当需要运行时刷新（非 OneTime）或 TwoWay 时。 |
| 不想写 INPC 还能刷新吗？ | 通过依赖属性或手动更新控件属性。 |
| 集合同步大量数据卡顿？ | 批量 Clear 后 Append；或后台组装后一次性替换内部存储并逐项 Append。 |
| 能否暴露 `std::wstring`？ | 否，需 `hstring`。 |
| 属性必须在 IDL 吗？ | 是（供 XAML 绑定 / 投影）。内部私有逻辑可用普通成员。 |

---
## 9. 术语最小表

| 术语 | 含义 | 记忆关键词 |
|------|------|------------|
| x:Bind | 编译期绑定 | 快 / 类型安全 |
| Binding | 运行期绑定 | 灵活 / Converter |
| INPC | INotifyPropertyChanged | 单属性刷新 |
| IObservableVector | 可观察集合 | 列表自动刷新 |
| DependencyProperty | 依赖属性 | 样式动画系统 |
| Attached Property | 附加属性 | 横向扩展 |

---

后续深入请进入各专题文件。欢迎在重构或补充阶段提出新章节需求。
