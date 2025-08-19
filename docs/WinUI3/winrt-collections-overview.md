# Windows.Foundation.Collections 命名空间全览（WinUI 3 / C++/WinRT）

聚焦 WinRT 标准集合接口/类：语义、与 .NET 映射、典型使用、与 XAML 数据绑定的关系、实现与封装策略。避免一次性过长，仅保留核心 + 可扩展模式。

---
## 1. 分类速览

| 类别 | 接口 / 类 | 语义 | 是否可变 | 通知 | .NET 投影 | XAML ItemsSource 自动刷新 |
|------|-----------|------|----------|------|-----------|----------------------------|
| 可迭代 | IIterable<`T`>, IIterator<`T`> | 枚举序列 | 取决于底层 | ❌ | IEnumerable<`T`> / IEnumerator<`T`> | 否（取决于具体集合实现） |
| 随机访问 | IVector<`T`> | 索引随机访问列表 | ✅ | ❌ | IList<`T`> | 否（需重设 ItemsSource） |
| 只读视图 | IVectorView<`T`> | 不可变快照 | ❌ | 不适用 | IReadOnlyList<`T`> | 否 |
| 可观察向量 | IObservableVector<`T`> | 含变更事件的向量 | ✅ | VectorChanged | IList<`T`> + INotifyCollectionChanged 类似 | 是 |
| 映射 | IMap<K,V> | 可变字典 | ✅ | ❌ | IDictionary<TKey,TValue> | 否 |
| 只读映射视图 | IMapView<K,V> | 字典快照 | ❌ | 不适用 | IReadOnlyDictionary<TKey,TValue> | 否 |
| 可观察映射 | IObservableMap<K,V> | 带变更通知字典 | ✅ | MapChanged | IDictionary + 通知 | Data binding 支持（使用 {Binding} 时）|
| 键值对 | IKeyValuePair<K,V> | (K,V) 结构 | N/A | N/A | KeyValuePair<TKey,TValue> | N/A |
| 变更参数 | IVectorChangedEventArgs / IMapChangedEventArgs<`K`> | 事件参数 | N/A | - | - | - |
| 事件委托 | VectorChangedEventHandler<`T`> / MapChangedEventHandler<K,V> | 订阅模型 | - | - | - | - |
| 特殊容器 | PropertySet / ValueSet / StringMap | 统一键值存储 | ✅ | (部分支持) | IDictionary<string,object> | ValueSet 常用于跨进程 |

---
## 2. 典型接口语义与模式

### 2.1 IIterable<`T`> + IIterator<`T`>
最小可枚举协议；若你只需要 `for (auto v : obj)` 支持，实现它即可。若要绑定到 XAML ItemsSource 并期望刷新 → 使用 IObservableVector。

### 2.2 IVector<`T`> vs IObservableVector<`T`>
- IVector<`T`> = 可变、无通知；适合一次性填充的静态数据。
- IObservableVector<`T`> = 附加 VectorChanged(CollectionChange, Index)；UI 列表（ListView / ComboBox）自动响应。

### 2.3 IVectorView<`T`>
快照 / 只读视图，常由 IVector<`T`>::GetView() 返回。

### 2.4 IMap / IMapView / IObservableMap
键值对字典；XAML ItemsSource 支持对 `IObservableMap<String,object>` 的绑定场景较少（典型在 Key/Value 可视化）；更常配合 DataContext + {Binding Path=KeyName} 使用。

### 2.5 PropertySet / ValueSet / StringMap
| 类型 | 键类型 | 值类型 | 用途 |
|------|--------|--------|------|
| PropertySet | hstring | IInspectable(PropertyValue) | 动态属性包、Navigation 参数 |
| ValueSet | hstring | (受限) 基元 / 数组 / 子 ValueSet | AppService / 跨进程消息 |
| StringMap | hstring | hstring | 字符串字典 |

---
## 3. 变更事件参数

```cpp
// VectorChanged
args.CollectionChange() // Add / Remove / Replace / Reset
args.Index()            // 发生位置 (Reset 时常置 0)

// MapChanged
args.CollectionChange() // ItemInserted / ItemRemoved / ItemChanged / Reset (同枚举)
args.Key()              // 相关 key
```

---
## 4. 与 .NET 映射影响

C++/WinRT 原生语义独立；.NET 投影供跨语言兼容。实践上只需记住：IObservableVector<`T`> ≈ WPF 的 ObservableCollection<`T`>（功能子集）。

---
## 5. 常用创建工厂

| 工厂函数 | 返回 | 线程模型 |
|----------|------|----------|
| single_threaded_vector<`T`>() | IVector<`T`> | 单线程 |
| single_threaded_observable_vector<`T`>() | IObservableVector<`T`> | 单线程 |
| single_threaded_map<K,V>() | IMap<K,V> | 单线程 |
| single_threaded_observable_map<K,V>() | IObservableMap<K,V> | 单线程 |

(WinUI 3 通常 UI 线程单线程足够。若需多线程数据源，使用锁自封装或并发集合 + 同步调度。)

---
## 6. 自定义封装与桥接 STL

内部逻辑基于 std::vector<`T`>，UI 暴露 IObservableVector<`T`>：
```cpp
class VectorAdapter {
    std::vector<hstring> _core;
    winrt::IObservableVector<hstring> _proj{ winrt::single_threaded_observable_vector<hstring>() };
public:
    winrt::IObservableVector<hstring> View() const { return _proj; }
    void Commit() {
        _proj.Clear();
        for (auto const& s : _core) _proj.Append(s);
    }
    void Push(hstring v) { _core.push_back(v); _proj.Append(v); } // 小批量直接同步
};
```

> 大批量：先 `_proj.Clear()` 后 Append；或构建新的 observable vector 再替换引用（注意绑定持有的是接口值，可直接赋值）。

---
## 7. 监听集合事件

```cpp
m_vec.VectorChanged([](auto const&, auto const& e)
{
    using CC = winrt::Windows::Foundation::Collections::CollectionChange;
    switch(e.CollectionChange()){
        case CC::ItemInserted: /* ... */ break;
        case CC::ItemRemoved:  /* ... */ break;
        case CC::ItemChanged:  /* ... */ break;
        case CC::Reset:        /* ... */ break;
    }
});
```

---
## 8. 集合与 XAML 绑定策略

| 控件属性 | 常用集合类型 | 刷新机制 | 备注 |
|----------|--------------|----------|------|
| ItemsControl.ItemsSource | IObservableVector<`T`> | VectorChanged | 首选 |
| ComboBox.ItemsSource | 同上 | 同上 | SelectedItem 另行属性通知 |
| AutoSuggestBox.ItemsSource | IVectorView<`T`> / IObservableVector<`T`> | 若只读则替换 | 实时过滤时用可观察 |
| NavigationView.MenuItemsSource | IObservableVector<`IInspectable`> | 需要装箱 | 可自定义项模板 |

---
## 9. PropertySet / ValueSet 典型用法

导航参数：
```cpp
PropertySet p;
p.Insert(L"UserId", winrt::box_value(42));
frame.Navigate(xaml_typename<DetailPage>(), p);
```

AppService 消息：
```cpp
ValueSet request;
request.Insert(L"command", winrt::box_value(L"ping"));
auto status = co_await connection.SendMessageAsync(request);
```

---
## 10. 自实现 IObservableVector (高级)

多数情况使用内置工厂即可；若需包装复杂结构可实现：
```cpp
struct MyObservableVector : winrt::implements<MyObservableVector,
    winrt::IObservableVector<hstring>, winrt::IVector<hstring>> {
    std::vector<hstring> _data;
    winrt::event<winrt::VectorChangedEventHandler<hstring>> _evt;

    uint32_t Size() const { return (uint32_t)_data.size(); }
    hstring GetAt(uint32_t i) const { return _data.at(i); }
    void Append(hstring const& v){ _data.push_back(v); Raise(CC::ItemInserted, (uint32_t)_data.size()-1); }
    void Clear(){ _data.clear(); Raise(CC::Reset, 0); }
    // 其它接口成员省略 (需要全部实现)
private:
    using CC = winrt::Windows::Foundation::Collections::CollectionChange;
    void Raise(CC kind, uint32_t index){ _evt(*this, winrt::make<winrt::VectorChangedEventArgs>(kind,index)); }
};
```
> 通常不推荐：实现完整接口成本高，除非需自定义懒加载或缓存策略。

---
## 11. 选择指南

| 用例 | 推荐 |
|------|------|
| 初始化后永不变化 | IVector + 一次性绑定（x:Bind OneTime） |
| 动态增删改列表 | IObservableVector |
| 暴露只读数据 | IVectorView (由内部 IVector 提供) |
| 键值快取 | IMap / PropertySet |
| 跨进程消息 | ValueSet |

---
## 12. 常见问题 (FAQ)

| 问题 | 原因 | 方案 |
|------|------|------|
| UI 不更新 | 使用 IVector / std::vector | 换 IObservableVector |
| 频繁闪烁 | 多次 Append 导致多次布局 | Clear + 批量添加 或 虚拟化控件 |
| ValueSet 插入复杂对象失败 | 非支持类型 | 仅使用基元/字符串/数组/ValueSet 嵌套 |
| 想监听某项属性内部变化 | VectorChanged 只报告项替换 | 让项自身实现 INPC 并绑定子属性 |
| 需要排序/过滤 | 重新生成新的 observable vector 或手动重排并发出 Reset | Consider CollectionViewSource (部分场景) |

---
后续：绑定方法/模板/附加属性等见 `binding-advanced-topics.md`；集合与 ViewModel 结合参阅 `property-change-notification.md` 与 `combobox-binding-examples.md`。

（完）
