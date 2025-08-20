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
// MyControl.idl
namespace MyApp.UserNamespace
{
    [default_interface]
    runtimeclass MyControl : Microsoft.UI.Xaml.Controls.Control
    {
        MyControl();
        // 投影包装属性 (可选，若同时想让 x:Bind 访问自然函数包装)
        String Title; 
        static Microsoft.UI.Xaml.DependencyProperty TitleProperty{ get; };
    }
}
```
头文件略，请复制 Generated Files\sources下 cppwinrt 生成的 UserNamespace.MyControl.h 文件。注意删去静态断言内容。  
实现：
```cpp
// MyControl.cpp
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
                winrt::xaml_typename<class_type>(), // 不要使用 ::implementation 命名空间，我们可以简便地写模板实现类里的类型返回方法
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
### 细节解释：

不要使用 ::implementation 命名空间：
- 根因：DependencyProperty::Register/RegisterAttached 的 ownerType 必须是“公开的 WinRT 运行时类型”（winmd 里的 runtimeclass）。XAML 与 DP 系统按“(OwnerType, PropertyName)”来定位属性。
- ::implementation 是 C++/WinRT 的后端实现类，不是 runtimeclass，不在元数据中，XAML 不认识。用它注册会把属性挂到一个“外界不可见”的类型上。
- 典型后果：
- XAML/样式 Setter/TemplateBinding/Storyboard 找不到该属性，设置不生效或抛异常（如找不到属性/类型）。
- 跨语言/跨程序集消费控件失败。
- C++ 包装器在代码里看似能 SetValue/GetValue，但 XAML 设置依旧无效，因为查找的 OwnerType 不匹配。
正确写法：
- 始终传“投影的公开类型”（即 runtimeclass），在控件模板里用 C++/WinRT 生成的 class_type 别名即可。
- 直接写 `class_type_` ，它在 cppwinrt 自动生成引入的头文件 .g.h 文件中被定义命名空间，确保引入正确的头文件即可。无需关注跳转内容。
示例（对比）：
```cpp
// 错误：ownerType 指向实现命名空间，XAML 不识别
Microsoft::UI::Xaml::DependencyProperty::Register(
    L"Title",
    winrt::xaml_typename<hstring>(),
    winrt::xaml_typename<MyApp::MyControl::implementation::MyControl>(), // ❌
    Microsoft::UI::Xaml::PropertyMetadata{ winrt::box_value(L"") }
);
```
```cpp
// 正确：ownerType 指向公开的 runtimeclass（投影类型）
Microsoft::UI::Xaml::DependencyProperty::Register(
    L"Title",
    winrt::xaml_typename<hstring>(),
    winrt::xaml_typename<class_type>(), // ✅ C++/WinRT 生成的基层模板，指向 MyApp::MyControl
    Microsoft::UI::Xaml::PropertyMetadata{ winrt::box_value(L""), &OnTitleChanged }
);
```

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

### 附加属性同理：
- 若要在 XAML 中用 namespace.Property，ownerType 必须是公开 runtimeclass（在 IDL 暴露），不要用 ::implementation。
---
我们可以给任何 DependencyObject 派生类（如 Button、Grid）附加属性。  
我们也可以为 `Microsoft::UI::Xaml::PropertyMetadata` 参数的初始化内指定回调函数（如 OnFocusGroupChanged）来实现 PropertyChangedCallback Delegate(属性回调委托)，当依赖属性的有效属性值更改时调用回调。  
我们可以用 C++ 的“统一初始化”（brace-initialization，花括号初始化）在 C++/WinRT 下用来构造临时对象的写法。

`PropertyMetadata{ nullptr, PropertyChangedCallback{ &NodeGraphPanel::OnAppearanceChanged } });`

逐层拆解这句：
- 目标：给 `DependencyProperty::Register` 的最后一个参数传一个 `PropertyMetadata` 实例。
- 外层的 `PropertyMetadata{ … }`：
  - 用花括号对 `PropertyMetadata` 做直接列表初始化，相当于调用它的构造函数。
  - 第1个实参 `nullptr`：表示该依赖属性的默认值是 null（比如 Brush 没默认值时就传 `nullptr`；若是 `double` 等值类型则常用 `box_value(2.5)` 这类默认值）。
  - 第2个实参是一个 `PropertyChangedCallback` 对象，用来指定“**属性变更回调**”。

- 内层的 `PropertyChangedCallback{ &NodeGraphPanel::OnAppearanceChanged }`：
  - 同样是列表初始化，构造一个回调委托对象。
  - `&NodeGraphPanel::OnAppearanceChanged` 是指向静态成员函数的函数指针。DP 的回调签名要求一个静态/自由函数，形如：
    `static void OnAppearanceChanged(DependencyObject const&, DependencyPropertyChangedEventArgs const&);`
  - 运行时当该 DP 发生变化时，就会调用这个回调。你的实现里先 `d.try_as<NodeGraphPanel>()` 拿到实例 self，再做刷新。

等价写法举例（效果一样）：
- 使用圆括号：`PropertyMetadata(nullptr, PropertyChangedCallback(&NodeGraphPanel::OnAppearanceChanged));`
- 直接传函数指针（构造能推导时）：`PropertyMetadata(nullptr, &NodeGraphPanel::OnAppearanceChanged);`
- 用 lambda：`PropertyMetadata(nullptr, PropertyChangedCallback{ [](auto const& d, auto const& e){ /*...*/ } });`

小结
- 外层花括号：构造 PropertyMetadata（默认值 + 变更回调）。
- 内层花括号：构造 PropertyChangedCallback（由函数指针或 lambda 构成）。
- 这是标准的 C++ 列表初始化语法，常见于 C++/WinRT 的依赖属性注册里。
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
