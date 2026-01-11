# 集合绑定与 IObservableVector 详解

本篇聚焦：列表控件 ItemsSource 的数据结构选择、`IVector<T>` 与 `IObservableVector<T>` 的差异、批量更新策略与性能注意。

---
## 1. 可用集合类型一览

| 接口 | 可绑定 | 自动 UI 刷新 | 典型用途 | 备注 |
|------|--------|--------------|----------|------|
| `IVector<T>` | ✅ | ❌ | 静态/一次性列表 | 修改后需重置 ItemsSource |
| `IObservableVector<T>` | ✅ | ✅ | 动态增删 | 常规推荐 |
| `IVectorView<T>` | ✅ (只读) | 不适用 | 只读投影 | 通常由其他接口返回 |
| `std::vector<T>` | ❌ | ❌ | 内部算法 | 需适配层 |

---
## 2. IDL 与实现模板

```idl
runtimeclass ListPage : Microsoft.UI.Xaml.Page
{
    ListPage();
    Windows.Foundation.Collections.IObservableVector<String> Items{ get; };
    Windows.Foundation.Collections.IVector<String> StaticItems{ get; };
}
```

```cpp
IObservableVector<hstring> ListPage::Items() { return m_dynamic; }
IVector<hstring> ListPage::StaticItems() { return m_static; }
```

---
## 3. IVector vs IObservableVector 行为差异

```cpp
// IVector 修改后 UI 不刷新
m_static.Append(L"A");  // ListView 不会自动更新
listView().ItemsSource(m_static); // 手动刷新：重新设置

// IObservableVector 修改后 UI 自动刷新
m_dynamic.Append(L"B"); // 立即出现在 UI
```

| 操作 | IVector | IObservableVector |
|------|---------|------------------|
| Append | 需手动重设 ItemsSource | 自动刷新 |
| RemoveAt | 同上 | 自动刷新 |
| SetAt | 同上 | 自动刷新 |
| Clear | 同上 | 自动刷新 |

---
## 4. 批量更新策略

低效写法（触发 N 次 VectorChanged）：
```cpp
for (auto& x : data) m_dynamic.Append(x); // N 次 UI 刷新
```

可接受策略（中等数量 < 200）：
```cpp
m_dynamic.Clear();
for (auto& x : data) m_dynamic.Append(x);
```

大批量（数千以上）建议：
```cpp
// 1. 构建临时 vector收集
std::vector<hstring> staging = Load();
// 2. 尽可能冻结 UI（可选：替换 ItemsSource 为空后再恢复）
auto backup = m_dynamic; // 引用保持
m_dynamic.Clear();
for (auto& s : staging) m_dynamic.Append(s);
```

> WinUI 没有官方“批量抑制”API，需通过减少中间状态或虚拟化控件（如 ListView/ItemsRepeater）减负。

---
## 5. 与 std::vector 协同

内部仍想用 std::vector：
```cpp
void Sync() {
    m_dynamic.Clear();
    for (auto const& s : internal_) m_dynamic.Append(s);
}
```

频繁同步优化：
- 只在“提交”阶段同步
- 或者直接改用 IObservableVector 作为主存储

---
## 6. 选中项与索引绑定

```xaml
<ListView ItemsSource="{x:Bind Items}"
          SelectedItem="{x:Bind SelectedItem, Mode=TwoWay}"
          SelectedIndex="{x:Bind SelectedIndex, Mode=TwoWay}"/>
```

```cpp
hstring SelectedItem() { return m_selected; }
void SelectedItem(hstring const& v) {
    if (m_selected != v) { m_selected = v; RaisePropertyChanged(L"SelectedItem"); }
}
```

避免双重更新：在 SelectedItem setter 中不要再写 SelectedIndex(...)，用内部同步函数，注意差异判断。

---
## 7. 监听集合变化调试

```cpp
m_dynamic.VectorChanged([](auto const&, auto const& args){
    OutputDebugStringW(L"[VectorChanged]\n");
});
```

可根据 `args.CollectionChange()` 区分 Add/Remove/Replace/Reset。

---
## 8. 性能提示

| 问题 | 影响 | 对策 |
|------|------|------|
| 大量 Append | 多次布局 | Clear + 批量再添加 |
| Replace 触发大量测量 | 频繁 SetAt | 判断是否真正变化 |
| 冗余绑定 | 多次 ItemsSource 设置 | 仅首次绑定，其余只改集合 |
| 非虚拟化控件 | 内存/布局飙升 | 使用 `ListView`（内部虚拟化）/ `ItemsRepeater` |

---
## 9. 何时选择 IVector

| 条件 | 选择 IVector | 原因 |
|------|--------------|------|
| 列表只初始化一次 | ✅ | 少一层事件开销 |
| 明确不会动态增删 | ✅ | 更简单 |
| 需要动态 | ❌ | 直接用 IObservableVector |

---
（完）
