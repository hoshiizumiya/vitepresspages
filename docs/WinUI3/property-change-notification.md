# 单属性变更通知与 INotifyPropertyChanged

本篇专注：何时实现 INotifyPropertyChanged，属性实现模板，计算属性策略与常见陷阱。

---
## 1. 什么时候需要 INotifyPropertyChanged

| 目的 | 是否需要 | 原因 |
|------|----------|------|
| OneTime 绑定 | ❌ | 初始化一次即可 |
| OneWay / TwoWay 同步 UI | ✅ | 需要刷新机制 |
| SelectedItem / Text 双向 | ✅ | 控件写回后需通知其它依赖属性 |
| 纯依赖属性内部值动画 | ❌ | 依赖属性系统自身处理 |

---
## 2. IDL 声明

```idl
runtimeclass DetailViewModel : Microsoft.UI.Xaml.Data.INotifyPropertyChanged
{
    DetailViewModel();
    String Title;
    Int32 Count;
    Boolean IsBusy;
}
```

> 若未在 IDL 中声明，x:Bind/Binding 无法访问。

---
## 3. 基础实现模板

```cpp
struct DetailViewModel : DetailViewModelT<DetailViewModel>
{
    DetailViewModel() = default;

    hstring Title() const { return m_title; }
    void Title(hstring const& v) { SetProperty(m_title, v, L"Title"); }

    int32_t Count() const { return m_count; }
    void Count(int32_t v) { if (SetProperty(m_count, v, L"Count")) { RaisePropertyChanged(L"IsZero"); } }

    bool IsBusy() const { return m_busy; }
    void IsBusy(bool v) { SetProperty(m_busy, v, L"IsBusy"); }

    // 只读计算属性
    bool IsZero() const { return m_count == 0; }

    winrt::event<winrt::PropertyChangedEventHandler> PropertyChanged;

private:
    hstring m_title;
    int32_t m_count{0};
    bool m_busy{false};

    template<class T>
    bool SetProperty(T& field, T const& value, wchar_t const* name)
    {
        if (field == value) return false;
        field = value;
        PropertyChanged(*this, { name });
        return true;
    }
    void RaisePropertyChanged(hstring const& n) { PropertyChanged(*this, { n }); }
};
```

---
## 4. 计算属性策略

| 类型 | 更新策略 | 示例 |
|------|----------|------|
| 简单派生 | 主属性 setter 中额外通知 | IsZero 依赖 Count |
| 多属性组合 | 任一参与者变化时批量通知 | RaisePropertyChanged({L"A",L"B"}) |
| 惰性缓存 | 复杂计算，标记 dirty，按需计算 | 大型集合统计 |

---
## 5. 防止多余刷新

坏例：
```cpp
void Title(hstring const& v) { m_title = v; PropertyChanged(*this,{L"Title"}); }
```
好例：
```cpp
void Title(hstring const& v) { if (m_title != v) { m_title = v; PropertyChanged(*this,{L"Title"}); } }
```

---
## 6. TwoWay 绑定注意

| 问题 | 描述 | 解决 |
|------|------|------|
| 死循环 | Setter 再写回控件属性 | Setter 只改状态，不调用控件 API |
| 失去焦点才更新 | 默认 UpdateSourceTrigger | 使用 `{Binding Text, Mode=TwoWay, UpdateSourceTrigger=PropertyChanged}` (Binding) |
| 空文本判定 | hstring 与 L"" 对比 | 直接 `empty()` |

---
## 7. 与依赖属性取舍

| 场景 | 用 INPC | 用 DependencyProperty |
|------|---------|---------------------|
| 纯数据 / 视图模型 | ✅ | ❌ |
| 控件内部可参与样式/动画 | ❌ | ✅ |
| 需要附加属性交互 | ❌ | ✅ |
| 只需通知，不要值优先级 | ✅ | ❌ |

---
## 8. 调试建议

```cpp
PropertyChanged(*this, { name });
OutputDebugStringW((L"[INPC] " + hstring{name} + L"\n").c_str());
```

或在包装函数中统一打点。不要在发布版保留大量 OutputDebugString。

---
## 9. 常见错误

| 现象 | 可能原因 | 排查 |
|------|----------|------|
| UI 不刷新 | 未实现接口或未调用事件 | 断点 SetProperty |
| XAML 编译失败 | IDL 与实现签名不匹配 | 检查返回类型/名称大小写 |
| 属性名拼写漏 | 静默失败 | 使用常量或宏集中管理 |

---
（完）
