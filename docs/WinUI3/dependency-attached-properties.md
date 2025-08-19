# 依赖属性与附加属性（Dependency / Attached Property）

本篇：面向已理解基础绑定的读者，系统梳理 WinUI 3 中依赖属性与附加属性在 C++/WinRT 的声明、注册、使用与取舍。

---
## 1. 为什么需要依赖属性

普通（INPC）属性无法：
- 参与样式 Setter / Theme 资源
- 被动画系统 Storyboard 直接寻址
- 参与模板绑定 TemplateBinding
- 支持值优先级（本地值覆盖样式等）

这些均由 DependencyProperty 系统提供。

---
## 2. 依赖属性核心特征

| 能力 | 说明 |
|------|------|
| 值优先级解析 | 动画 > 本地值 > 样式 Setter > 默认值 |
| 默认值 & 回调 | 注册时提供 PropertyMetadata |
| 继承（部分类型） | 如 FontSize 沿视觉树传递 |
| 附加属性机制 | 跨类扩展目标对象 |

---
## 3. 依赖属性注册模板

IDL：
```idl
runtimeclass MyControl : Microsoft.UI.Xaml.Controls.Control
{
    MyControl();
    // 投影包装属性 (可选，若同时想让 x:Bind 访问自然函数包装)
    String Title; 
    static Microsoft.UI.Xaml.DependencyProperty TitleProperty{ get; };
}
```

实现：
```cpp
struct MyControl : MyControlT<MyControl>
{
    MyControl() = default;

    static Microsoft::UI::Xaml::DependencyProperty s_titleProperty;

    static Microsoft::UI::Xaml::DependencyProperty TitleProperty()
    {
        if (!s_titleProperty)
        {
            s_titleProperty = Microsoft::UI::Xaml::DependencyProperty::Register(
                L"Title",
                winrt::xaml_typename<hstring>(),
                winrt::xaml_typename<MyControl>(),
                Microsoft::UI::Xaml::PropertyMetadata{ winrt::box_value(L""), &OnTitleChanged }
            );
        }
        return s_titleProperty;
    }

    hstring Title() const { return winrt::unbox_value_or<hstring>(GetValue(s_titleProperty), L""); }
    void Title(hstring const& v) { SetValue(s_titleProperty, winrt::box_value(v)); }

private:
    static void OnTitleChanged(Microsoft::UI::Xaml::DependencyObject const& d,
                               Microsoft::UI::Xaml::DependencyPropertyChangedEventArgs const& e)
    {
        if (auto self = d.try_as<MyControl>())
        {
            // 自定义逻辑
            OutputDebugStringW(L"[DP] Title changed\n");
        }
    }
};

Microsoft::UI::Xaml::DependencyProperty MyControl::s_titleProperty{ nullptr };
```

XAML:
```xml
<local:MyControl Title="Hello" />
```

---
## 4. 附加属性 RegisterAttached 模板

IDL 容器（可选）：
```idl
runtimeclass ViewAttach
{
    static Microsoft.UI.Xaml.DependencyProperty FocusGroupProperty{ get; };
    static void SetFocusGroup(Microsoft.UI.Xaml.UIElement element, Int32 value);
    static Int32 GetFocusGroup(Microsoft.UI.Xaml.UIElement element);
}
```

实现：
```cpp
struct ViewAttach
{
    static Microsoft::UI::Xaml::DependencyProperty s_focusGroupProperty;

    static Microsoft::UI::Xaml::DependencyProperty FocusGroupProperty()
    {
        if (!s_focusGroupProperty)
        {
            s_focusGroupProperty = Microsoft::UI::Xaml::DependencyProperty::RegisterAttached(
                L"FocusGroup",
                winrt::xaml_typename<int32_t>(),
                winrt::xaml_typename<ViewAttach>(),
                Microsoft::UI::Xaml::PropertyMetadata{ winrt::box_value(0) }
            );
        }
        return s_focusGroupProperty;
    }

    static void SetFocusGroup(Microsoft::UI::Xaml::UIElement const& e, int32_t v)
    { e.SetValue(FocusGroupProperty(), winrt::box_value(v)); }

    static int32_t GetFocusGroup(Microsoft::UI::Xaml::UIElement const& e)
    { return winrt::unbox_value<int32_t>(e.GetValue(FocusGroupProperty())); }
};

Microsoft::UI::Xaml::DependencyProperty ViewAttach::s_focusGroupProperty{ nullptr };
```

XAML：
```xml
<Button Content="A" local:ViewAttach.FocusGroup="1"/>
```

---
## 5. 依赖属性 vs INPC 选择表

| 需求 | 依赖属性 | INPC 普通属性 |
|------|----------|---------------|
| 样式 Setter | ✅ | ❌ |
| Storyboard 动画目标 | ✅ | ❌ |
| 仅 ViewModel 数据 | ❌ | ✅ |
| 模板内部 TemplateBinding | ✅ | ❌ |
| 性能（存取） | 略慢 | 快 | 
| 值优先级 | ✅ | ❌ |

---
## 6. 包装属性与只注册 Property

可只注册 static DependencyProperty 而不提供 C++ 包装 get/set：
```cpp
// 直接在 XAML 使用 MyControl.TitleProperty="..." 或绑定
```
但通常提供函数包装便于 C++ 端与 x:Bind 访问。

---
## 7. 常见错误

| 现象 | 原因 | 修复 |
|------|------|------|
| 属性不生效 | 注册使用旧命名空间或类型名错误 | 使用 `winrt::xaml_typename<T>()` |
| 回调未触发 | 静态字段未存活 / 未缓存 | 确保 static 成员存在且惰性初始化 |
| 绑定失败 | 未在 IDL 暴露（若需要 x:Bind 包装） | 添加 IDL 属性或静态 DP getter |
| 动画找不到属性 | 目标不是依赖属性 | 改为 DependencyProperty |

---
## 8. 调试建议

```cpp
OutputDebugStringW((L"Local value? " + (GetValue(s_titleProperty)?L"Y":L"N")).c_str());
```
使用 `ReadLocalValue(dp)` 可判断当前是否有本地值。

---
## 9. 最小取舍指南

| 场景 | 建议 |
|------|------|
| 自定义控件对外公开可样式化属性 | 依赖属性 |
| 视图模型纯数据 | INPC |
| 横向标签/布局元信息 | 附加属性 |
| 需要动画/模板 | 依赖属性 |
| 只是内部状态且无需样式影响 | 普通字段 + INPC（或都不要） |

---
（完）
