# ComboBox 三种数据绑定模式对照

目标：以最小代码展示三种典型用法的实现、适用场景与取舍。

---
## 1. 手动 Items 操作（无绑定）

适合：纯静态或极少更改；不想引入通知机制。

```cpp
void InitManual() {
    auto items = manualBox().Items();
    items.Clear();
    items.Append(winrt::box_value(L"Item 1"));
    items.Append(winrt::box_value(L"Item 2"));
    manualBox().SelectedIndex(0);
}

void AddManual() {
    static int i=0;
    manualBox().Items().Append(winrt::box_value(L"Dyn " + winrt::to_hstring(++i)));
}
```

XAML：
```xml
<ComboBox x:Name="manualBox" Header="Manual" />
```

| 特性 | 说明 |
|------|------|
| 性能 | 最高（无绑定层） |
| 维护 | 最差，逻辑耦合 UI |
| MVVM | 不适用 |

---
## 2. 代码设 ItemsSource（仅集合通知）

适合：需要列表动态变化，但不做选中项属性双向绑定。

IDL：
```idl
Windows.Foundation.Collections.IObservableVector<String> ItemsProgram{ get; };
```

C++：
```cpp
auto ItemsProgram() { return m_itemsProgram; }

MainPage::MainPage() {
    InitializeComponent();
    progBox().ItemsSource(ItemsProgram());
    m_itemsProgram.Append(L"Alpha");
    m_itemsProgram.Append(L"Beta");
}
```

XAML：
```xml
<ComboBox x:Name="progBox" Header="Programmatic"/>
```

| 特性 | 说明 |
|------|------|
| 选中项获取 | `progBox().SelectedItem()` 代码访问 |
| 需要 INPC? | 只操作集合不需要 |
| 列表刷新 | Append/Remove 自动 |

---
## 3. 完全 XAML 绑定（集合 + 选中项）

适合：MVVM / 双向同步 / 解耦。

IDL：
```idl
Windows.Foundation.Collections.IObservableVector<String> ItemsBind{ get; };
String CurrentItem; // 选中项
Int32 CurrentIndex; // 可选
```

C++：
```cpp
hstring CurrentItem() { return m_cur; }
void CurrentItem(hstring const& v) { if (m_cur!=v){ m_cur=v; PropertyChanged(*this,{L"CurrentItem"}); }}

int32_t CurrentIndex() { return m_index; }
void CurrentIndex(int32_t v) { if (m_index!=v){ m_index=v; PropertyChanged(*this,{L"CurrentIndex"}); }}
```

XAML：
```xml
<ComboBox Header="Bound"
          ItemsSource="{x:Bind ItemsBind}"
          SelectedItem="{x:Bind CurrentItem, Mode=TwoWay}"
          SelectedIndex="{x:Bind CurrentIndex, Mode=TwoWay}" />
```

| 能力 | 说明 |
|------|------|
| 集合更新 | IObservableVector 自动 |
| 选中同步 | 通过 INPC 属性 |
| MVVM | 支持 DataContext / Binding 模式 |

---
## 4. 选择指南

| 需求 | 推荐 |
|------|------|
| 最快简单列表 | 手动 Items |
| 动态内容 + 简单逻辑 | ItemsSource 代码绑定 |
| MVVM / 多处复用 / 双向选中 | XAML 全绑定 |

---
## 5. 常见问题

| 问题 | 原因 | 解决 |
|------|------|------|
| 改 std::vector 不刷新 | 非 WinRT 集合 | 用 IObservableVector |
| 选中项属性不更新 | 未实现 INPC | 在 setter 中触发事件 |
| 绑定失败静默 | 未在 IDL 声明属性 | 补齐 IDL 重新生成 |
| 频繁重建集合闪烁 | 每次替换集合实例 | Clear()+Append 批量重填 |

---
（完）
