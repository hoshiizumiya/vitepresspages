# 从零开始的 CRTP 与 RTTI 实战（与 Template.md 互补）

导读
- 本文与《C++/WinRT 原理及实践 —— 模板元编程在 WinRT 中的实现》（Template.md）互补：那一篇重在 COM/ABI 调用链与模板生成代码；本文侧重“编译期多态（CRTP）与运行时多态（RTTI）”的取舍与落地实践，尤其在 C++/WinRT 中正确替代 dynamic_cast 的方式。

你将获得
- 何时用 CRTP，何时用 RTTI；C++/WinRT 中为何尽量不用 dynamic_cast
- try_as/as 的使用与差异、运行时类名调试、接口查询与可选钩子实现
- 性能/体积/可维护性取舍与工程化检查表

目录
- 基础对比：CRTP vs RTTI
- CRTP 最小闭环：可选钩子（编译期探测）
- RTTI 在纯 C++ 与 WinRT 的边界
- C++/WinRT 实战：try_as/QueryInterface 与调试技巧
- 选择指南与性能要点
- 工程化检查清单

## 基础对比：CRTP vs RTTI

- CRTP（编译期多态）
  - 机制：模板静态绑定，编译期决定调用目标
  - 优点：零运行时开销、易内联、强类型
  - 典型用途：可选钩子、策略模式、生成式 API（见 Template.md 中 consume_* 模式）
- RTTI（运行时类型识别）
  - 机制：typeid/dynamic_cast 依赖编译器生成的类型信息（/GR）
  - 优点：运行时按真实类型分发、无需模板约束
  - 代价：有运行时与二进制体积开销；跨 ABI/COM 边界无效

结论
- C++/WinRT 的跨语言/跨模块对象遵循 COM/WinRT（IInspectable + QueryInterface），因此跨边界应使用 try_as 而非 dynamic_cast。
- 仅在纯 C++ 对象层（非 WinRT/COM）需要运行时判断时再考虑 RTTI。

## CRTP 最小闭环：可选钩子（编译期探测）

与 Template.md 的可选方法探测一致，这里给出极简版（C++20）：
```cpp
template <typename T>
void call_on_navigated_to(T& obj) {
    if constexpr (requires { obj.OnNavigatedTo(); }) {
        obj.OnNavigatedTo();
    }
    // 没有该方法则不生成调用代码，零运行时分支
}

struct PageA { void OnNavigatedTo() {/*...*/} };
struct PageB { /* 无该方法 */ };

PageA a; PageB b;
call_on_navigated_to(a); // 调用
call_on_navigated_to(b); // 静默跳过
```
要点
- if constexpr + requires 在编译期裁剪无效分支，实现“可选钩子”
- 无虚表，无 override；参见 Template.md 中“为什么不能 override OnNavigatedTo”

## RTTI 在纯 C++ 与 WinRT 的边界

- 纯 C++（单一编译单元/无 ABI 跨越）
  - dynamic_cast、typeid 有效，依赖 /GR 启用 RTTI
  - 用于库内对象图的安全 downcast 或调试输出
- WinRT/COM 对象（IInspectable、接口投影）
  - dynamic_cast 无法跨 ABI 工作（不同语言/编译器边界）
  - 正确方式：QueryInterface 语义，即 C++/WinRT 的 obj.try_as<>()
  - 获取运行时类名：winrt::get_class_name(obj) 或 IInspectable::GetRuntimeClassName

对比示例
```cpp
// 纯 C++
struct Base { virtual ~Base() = default; };
struct Derived : Base { void f(){} };

void foo(Base* p) {
    if (auto d = dynamic_cast<Derived*>(p)) { d->f(); }
}

// WinRT（错误做法，dynamic_cast 不起作用）
void bar(winrt::Windows::Foundation::IInspectable obj) {
    // auto d = dynamic_cast<MyRuntimeClass*>(obj); // ❌
}

// WinRT 正确做法
#include <winrt/Windows.Foundation.h>
template <typename I>
bool supports(winrt::Windows::Foundation::IInspectable const& obj) {
    return static_cast<bool>(obj.try_as<I>());
}
```

启用与禁用 RTTI
- MSVC：/GR 开启 RTTI，/GR- 关闭（会影响 dynamic_cast/typeid）
- 可在应用层保留 /GR，以便对纯 C++ 类型使用 RTTI；对 WinRT 类型一律使用 try_as

## C++/WinRT 实战：try_as/QueryInterface 与调试技巧

接口查询（推荐优先使用 try_as）
```cpp
using namespace winrt;
using namespace Microsoft::UI::Windowing;

void SetTallIfSupported(winrt::Windows::Foundation::IInspectable const& obj) {
    if (auto t = obj.try_as<IAppWindowTitleBar2>()) {
        t.PreferredHeightOption(TitleBarHeightOption::Tall);
    }
    // as<I>() 会在不支持时抛 hresult_no_interface，适合“必须支持”的场景
}
```

从 XAML Window 获取接口再调用（与 Template.md 中 PreferredHeightOption 的调用链呼应）
```cpp
#include <winrt/Microsoft.UI.Xaml.h>
#include <winrt/Microsoft.UI.Windowing.h>

void Configure(winrt::Microsoft::UI::Xaml::Window const& w) {
    auto aw = w.AppWindow();
    if (auto tb2 = aw.TitleBar().try_as<IAppWindowTitleBar2>()) {
        tb2.PreferredHeightOption(TitleBarHeightOption::Standard);
    }
}
```

运行时类名与接口 GUID（调试定位）
```cpp
#include <winrt/Windows.Foundation.h>
#include <winrt/base.h>

template <typename T>
void DebugType(T const& obj) {
    // WinRT 运行时类名（如 Microsoft.UI.Windowing.AppWindowTitleBar）
    auto name = winrt::get_class_name(obj);
    // 某接口的 GUID（编译期已知）
    auto iid  = winrt::guid_of<Microsoft::UI::Windowing::IAppWindowTitleBar2>();
    (void)name; (void)iid;
}
```

底层 QueryInterface（需要时）
```cpp
#include <winrt/base.h>
template <typename I, typename T>
winrt::com_ptr<std::remove_pointer_t<winrt::impl::abi_t<I>>> qi(T const& obj) {
    winrt::com_ptr<winrt::impl::abi_t<I>> ptr;
    winrt::check_hresult(winrt::get_unknown(obj)->QueryInterface(winrt::guid_of<I>(), ptr.put_void()));
    return ptr;
}
```

统一适配器：同时支持 WinRT 接口查询与纯 C++ RTTI
```cpp
#include <type_traits>
#include <winrt/Windows.Foundation.h>

template <typename To, typename From>
auto as_or_null(From& obj)
{
    using Decay = std::decay_t<From>;
    if constexpr (std::is_convertible_v<Decay, winrt::Windows::Foundation::IInspectable>) {
        return obj.try_as<To>(); // WinRT：返回 To（可能为空）
    } else {
        if constexpr (std::is_pointer_v<Decay>) {
            return dynamic_cast<To>(obj); // 纯 C++：To 必须是指针目标
        } else {
            return dynamic_cast<To*>(&obj);
        }
    }
}
```

## 选择指南与性能要点

- 先选 CRTP（编译期）
  - 可选钩子、策略/策略组合、静态派发的生成式 API
  - 优点：零成本、强类型；缺点：编译时间增加、接口变化需重编译
- WinRT 对象的“类型判断/转换”
  - 一律使用 try_as/as（COM QI 语义），不要 dynamic_cast
  - try_as 返回空对象，不抛异常；as 不支持时抛 hresult_no_interface
- 纯 C++ 对象的运行时派发
  - 需要时启用 /GR，用 dynamic_cast/typeid；性能敏感路径避免频繁使用
- 调试与诊断
  - WinRT：get_class_name + guid_of；纯 C++：typeid(T).name()（记得 /GR）

体感性能
- CRTP 调用多为内联，分支在编译期裁剪
- try_as 一次 QI 代价可忽略（缓存接口指针可进一步降低开销）
- dynamic_cast 需 RTTI 支持，有一定常数开销与体积成本

## 工程化检查清单

- WinRT 侧
  - 接口判断/转换：统一 try_as/as，不混用 dynamic_cast
  - 调试：使用 get_class_name(obj)，记录 `guid_of<I>()`
  - 错误处理：as 失败的异常抓取或改用 try_as
- CRTP 侧
  - 可选钩子使用 if constexpr + requires（C++20）；老编译器用 SFINAE 退化
  - 避免与 virtual/override 混搭造成误解（详见 Template.md）
- 构建与选项
  - C++20（if constexpr/requires）、/permissive-、/EHsc
  - RTTI：按需开启 /GR（仅纯 C++ 场景）；链路中 WinRT 对象不依赖 RTTI
  - 跨模块：避免在 DLL 边界传递非 POD 的 C++ 类型；WinRT 类型经 IInspectable 安全跨越
- 性能与稳定性
  - 高频路径缓存接口（持有 I... 成员而非每次 try_as）
  - 异常策略明确：禁用异常路径可统一 try_as + 显式分支

结语
- CRTP 与 RTTI 并非对立：在 C++/WinRT 中，跨边界对象选 QueryInterface（try_as），框架扩展点选 CRTP。把运行时开销留给不得不做的地方，把类型错误留在编译期暴露，是零开销抽象的精髓。
- 建议先通读 Template.md，再回到本篇按清单做工程化收敛。
