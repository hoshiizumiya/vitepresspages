# C++/WinRT 原理及实践 —— 模板元编程在 WinRT 中的实现  

## 📚 前置知识：从零开始理解关键概念

在深入分析代码之前，我们需要先理解一些关键的基础概念，这些概念对于理解 C++/WinRT 的工作原理至关重要。

### 🔍 什么是 COM？为什么需要它？

**COM (Component Object Model)** 是微软开发的组件对象模型，是理解 WinRT 的基础：

```cpp
// COM 的核心概念：接口
struct IUnknown {
    virtual HRESULT QueryInterface(REFIID riid, void** ppvObject) = 0;
    virtual ULONG AddRef() = 0;
    virtual ULONG Release() = 0;
};
```

**为什么需要 COM？**
- **跨语言互操作**：让 C++、C#、VB.NET 等不同语言可以互相调用
- **二进制兼容性**：不同编译器产生的代码可以互相调用
- **版本兼容**：新版本的组件可以与旧版本的客户端兼容
- **进程隔离**：组件可以运行在不同的进程中

**实际例子：**
```cpp
// 传统的 C++ 类调用（只能在同一进程中）
MyClass obj;
obj.DoSomething();

// COM 接口调用（可以跨进程、跨语言）
IMyInterface* pInterface = nullptr;
CreateMyComponent(&pInterface);  // 可能来自另一个 DLL 或进程
pInterface->DoSomething();
```

### 🎯 什么是 WinRT？与 COM 的关系

**WinRT (Windows Runtime)** 是基于 COM 的现代化 API 系统：

```cpp
// 传统 Win32 API（C 风格）
HWND hwnd = CreateWindow(...);
SetWindowText(hwnd, L"Hello");

// WinRT API（面向对象）
auto window = winrt::make<MainWindow>();
window.Title(L"Hello");
```

**WinRT 的优势：**
- **类型安全**：强类型检查，减少运行时错误
- **现代语法**：支持属性、事件、异步操作
- **自动内存管理**：引用计数，无需手动 Release
- **跨平台**：可以在 Windows、Xbox、HoloLens 等平台使用

### 🏗️ 什么是 ABI (Application Binary Interface)？

**ABI** 定义了不同模块之间如何在二进制层面进行交互：

```cpp
// C++/WinRT 的高级接口（开发者使用的）
winrt::hstring text = L"Hello World";
int length = text.size();

// ABI 层（底层 COM 接口，实际调用的）
HSTRING abi_string;
::WindowsCreateString(L"Hello World", 11, &abi_string);
UINT32 abi_length;
::WindowsGetStringLen(abi_string, &abi_length);
```

**为什么需要 ABI？**
- **二进制兼容**：确保不同编译器生成的代码可以互操作
- **稳定接口**：ABI 不会因为 C++ 版本更新而改变
- **跨语言调用**：其他语言（如 C#）可以调用相同的 ABI

### 🧠 什么是智能指针？为什么重要？

**智能指针** 是自动管理内存的指针包装器：

```cpp
// 传统裸指针（容易出错）
MyClass* ptr = new MyClass();
// ... 使用 ptr ...
delete ptr;  // 忘记调用会内存泄漏

// 智能指针（自动管理）
std::unique_ptr<MyClass> ptr = std::make_unique<MyClass>();
// ... 使用 ptr ...
// 析构时自动删除，无需手动 delete
```

**C++/WinRT 中的智能指针：**
```cpp
// winrt::com_ptr - 管理 COM 对象
winrt::com_ptr<IMyInterface> ptr;
CreateMyComponent(ptr.put());  // 获取接口
// 自动调用 Release()

// WinRT 对象本身就是智能指针
winrt::hstring str = L"Hello";  // 内部自动管理引用计数
```

### 📝 什么是引用计数？

**引用计数** 是一种内存管理技术，追踪有多少个指针指向同一个对象：

```cpp
// 引用计数示例
class RefCountedObject {
    mutable int refCount = 1;  // 初始引用计数为 1
public:
    void AddRef() const { ++refCount; }
    void Release() const { 
        if (--refCount == 0) delete this; 
    }
};

// 使用示例
RefCountedObject* obj = new RefCountedObject();  // refCount = 1
obj->AddRef();   // refCount = 2
obj->Release();  // refCount = 1
obj->Release();  // refCount = 0, 对象被删除
```
> cpp std 也有类似的 `std::shared_ptr`，但 C++/WinRT 使用的是 COM 风格的引用计数。

**在 C++/WinRT 中的应用：**
```cpp
// WinRT 对象自动管理引用计数
auto obj1 = winrt::make<MyClass>();     // refCount = 1
auto obj2 = obj1;                       // refCount = 2（自动 AddRef）
obj1 = nullptr;                         // refCount = 1（自动 Release）
// obj2 超出作用域时，refCount = 0，对象自动销毁

```

## 下面我们将以 `PreferredHeightOption()` 为例，带你讲解 cpp/winRT 是如何转换参数给 COM 的，以及相关使用模板元编程概念：

```cpp
template <typename D> auto consume_Microsoft_UI_Windowing_IAppWindowTitleBar2<D>::PreferredHeightOption(winrt::Microsoft::UI::Windowing::TitleBarHeightOption const& value) const
{
    if constexpr (!std::is_same_v<D, winrt::Microsoft::UI::Windowing::IAppWindowTitleBar2>) //注意取反
    {
        winrt::hresult _winrt_cast_result_code;
        auto const _winrt_casted_result = impl::try_as_with_reason<winrt::Microsoft::UI::Windowing::IAppWindowTitleBar2, D const*>(static_cast<D const*>(this), _winrt_cast_result_code);
        check_hresult(_winrt_cast_result_code);
        auto const _winrt_abi_type = *(abi_t<winrt::Microsoft::UI::Windowing::IAppWindowTitleBar2>**)&_winrt_casted_result;
        check_hresult(_winrt_abi_type->put_PreferredHeightOption(static_cast<int32_t>(value)));
    }
    else
    {
        auto const _winrt_abi_type = *(abi_t<winrt::Microsoft::UI::Windowing::IAppWindowTitleBar2>**)this;
        check_hresult(_winrt_abi_type->put_PreferredHeightOption(static_cast<int32_t>(value)));
    }
}
```

*这里只讲部分，后面也会涉及到其他部分。*

这么长的函数！？别急，我们慢慢来搞清楚。  

- 首先从第一行名字入手，我们定义了一个模板类型D。
    - 注意我们在此句没有进行通常的换行，直接开始定义函数，这在模板中是可行的。这是由 WinRT生成的 cpp 代码的风格（模板声明紧跟函数定义），为了紧凑并缩短文件长度。
    - `auto`:你要知道一般函数的**返回类型**必须**显式**地在**定义**时指定，除了这种方法，还有由 cpp11 引入的**尾随/尾置返回类型**：使用`auto`关键字占位，真正的返回类型在紧跟在参数列表后面的`->`后面符号指定，即可以由最后函数的返回值类型来指定当前函数返回值类型。亦能了解到与模板使用，能降低大量重复的代码编写。
    - 后来在 C++14 引入了 `auto` 作为函数返回类型 的功能。前提是函数体中只有一个或多个类型相同的  return 语句，编译器就能推导出返回类型。此即为泛型，提高了编写效率，但降低了可读性。
    - 此函数没有返回类型，故编译器推导返回值为 void 类型。那问题来了，一个简单的 void 为什么要使用 auto 来让编译器推导？这即是模板编程的强大之处。使用 `auto` 可以让模板更灵活，如果将来需要返回某个值（比如链式调用），只需要添加 `return` 语句，而不需要修改函数签名。当然这也是为了 cpp/winrt 框架的一致性。
    - 从完整函数名我们得到了`PreferredHeightOption`是`consume_Microsoft_UI_Windowing_IAppWindowTitleBar2<D>`类的成员。可见其所在类本身也是模板类。
    - 参数：类型为`winrt::Microsoft::UI::Windowing::TitleBarHeightOption`（从枚举类型传来的枚举数值），参数是一个 const& 引用，避免拷贝。如果你不熟悉，强烈建议学习[C++ 移动语义](/C++/memory1.md)。
- `if constexpr()` 是 C++17 开始引入的**编译期条件判断**语句，在现代 cpp **模板元编程**很常见，尤其 WinRT 强类型多接口情况。
  - 在()内容为 false 时，为假的不执行的分支代码将跳过编译，非运行时判断。让模板代码可以根据类型参数，选择性地编译不同的实现，避免无效代码导致的编译错误。所以你在编译器里面看到的错误提示完全可以看模板实例化情况忽略掉。
  - 通过使用位于标准库 `<type_traits>` 的 `srd::is_same_v<A,B>` ，在编译时判断AB类型是否完全相同，返回一个 bool 类型。如果不是，走 if 分支；否则走 else 分支。较为简单，故不再举例讲解。  
- 为什么要这样区分？
WinRT 的接口和实现类有时需要不同的处理方式。比如：
  - 某些接口方法只能在接口类型下调用，不能在实现类下调用，反之亦然。
  - 通过 if constexpr + std::is_same_v，可以让模板代码根据传入的类型参数，自动选择合适的实现，避免**类型不匹配**导致的编译错误。
- 那现在来看具体来看都区分了什么：
  - 当 D 不是 IAppWindowTitleBar2 进入 if 分支。
    - 首先声明了个 `hresult` 类型变量。使用`_winrt_cast_result_code`接收类型转换的结果码（HRESULT），判断转换是否成功。
    - 看清括号，我们使用 auto 推导出位于 = 后面`impl::try_as_with_reason<...>()`函数的返回值，并使用`_winrt_casted_result`接收。
    - `impl::try_as_with_reason<...>()`:<span style="color:red;font-weight: bold">try_as_with_reason</span>是 WinRT 辅助函数，用来安全地尝试将一个对象转换为另一个接口类型。尝试将当前 this 指针（类型 D 的 const 指针）转换为 IAppWindowTitleBar2 **接口指针**，并将结果保存在 _winrt_casted_result，HRESULT 保存在 `_winrt_cast_result_code`。
        - 辅助函数是指帮助完成某些重复、底层、复杂操作的工具性函数，让调用者不用关心细节。在 C++/WinRT 框架里，很多底层 COM 操作都被封装成了"辅助函数"，比如类型转换、错误处理、内存管理等。
        - 用例：
          - `auto const _winrt_casted_result = impl::try_as_with_reason<目标接口类型, 源对象类型>(源对象指针, hresult& 错误码);`
          - 模板参数：
            - 第一个参数是你想要转换到的接口类型（如 winrt::Microsoft::UI::Windowing::IAppWindowTitleBar2）。
            - 第二个参数是源对象的类型（如 D const*，通常是当前对象的类型指针）。
          - 参数：
            - 第一个参数是源对象指针。
            - 第二个参数是一个 hresult 类型的引用，用于接收转换的结果码。
          - 返回值：
            - 返回目标接口类型的智能指针（或包装对象），如果转换失败则为 nullptr。
        - `try_as_with_reason`究竟干了什么？`try_as_with_reason<Target, Source>(pointer, hresult&)` 是 C++/WinRT 框架里用于 **接口类型转换（QueryInterface）** 的工具函数，尝试把 pointer 转换为 Target 接口，返回转换后的**智能指针**，并把 HRESULT 存进 `hresult&` 这个引用里，这样你就通过后面的`check_hresult()`知道转换成功还是失败，并能获得失败的原因。
        - `try_as_with_reason` 的实现原理：
            - 首先调用 COM 的 `QueryInterface` 方法尝试获取目标接口的指针将当前对象转换为指定的接口类型。
            - 如果成功，hresult 设为 S_OK，返回目标接口的智能指针。
            - 如果失败，将错误码存入传入的 `hresult&` 参数，并返回 nullptr。
            - 比直接强制类型转换更安全，因为它会检查接口是否真的被实现，防止野指针或未定义行为。
    - 通过`check_hresult()`检查转换情况。为什么要在这里检查？因为其底层是基于 COM 和 ABI 的，其内部出错不便于错误定位。
    - `abi_t<...>`详细解析：
        - `abi_t` 是 C++/WinRT 里表示底层 ABI 类型的类型别名，等同于 abi_type。其定义为：`template <typename T> using abi_t = typename T::abi_type;`。
        - 在 C++/WinRT 中，对于 WinRT 接口来说，`::abi_type` (即 `abi_t`) 就是 `Interface*`，也就是指向 COM 接口的裸指针。
        - 为什么需要 ABI 类型？因为 C++/WinRT 的高级包装类型（如 `IAppWindowTitleBar2`）最终需要转换为底层的 COM 接口指针才能与 Windows 系统进行交互。ABI（Application Binary Interface）是应用程序二进制接口，是不同模块间调用的约定。
        - `*(abi_t<winrt::Microsoft::UI::Windowing::IAppWindowTitleBar2>**)&_winrt_casted_result` 这行代码做了什么？
            1. `&_winrt_casted_result`：获取智能指针对象的地址
            2. `(abi_t<...>**)`：将地址强制转换为指向 ABI 类型指针的指针
            3. `*(...)`：解引用，获得 ABI 类型的裸指针
        - 这种复杂的指针操作是因为 C++/WinRT 需要从高级智能指针中提取出底层的 COM 接口指针。
    
    - `static_cast<D const*>(this)` 详细解析：
        - `static_cast` 是 C++ 中的**编译时类型转换**操作符，用于相关类型之间的转换。
        - 在模板上下文中，`this` 指针的实际类型是 `consume_Microsoft_UI_Windowing_IAppWindowTitleBar2<D>*`。
        - 通过 `static_cast<D const*>(this)` 将 `this` 指针转换为 `D const*` 类型。
        - 为什么需要这个转换？因为 `try_as_with_reason` 需要接收具体的派生类型指针，而不是基类指针。这样可以确保类型转换的准确性。
        - `const*` 表示指向常量对象的指针，保证在转换过程中不会修改对象状态，符合函数的 `const` 修饰符。
    
    - `check_hresult(_winrt_abi_type->put_PreferredHeightOption(static_cast<int32_t>(value)))` 详细解析：
        - 这是最终的 COM 方法调用。`put_PreferredHeightOption` 是 COM 接口中的 setter 方法。
        - `static_cast<int32_t>(value)`：将强类型枚举 `TitleBarHeightOption` 转换为 32 位整数。
            - 为什么要转换？因为 COM 接口定义的参数类型是 `int32_t`，而 C++/WinRT 使用强类型枚举提供类型安全。
            - 枚举值（如 `TitleBarHeightOption::Standard` 或 `TitleBarHeightOption::Tall`）在底层存储为整数常量。
            - COM 层面只认识基础数据类型，不认识 C++ 的枚举类型。
        - `->put_PreferredHeightOption(...)`：通过 COM 接口指针调用方法，设置标题栏高度选项。
        - `check_hresult(...)`：检查 COM 方法的返回值（HRESULT），如果失败会抛出异常。

  - 当 D 就是 IAppWindowTitleBar2 时，进入 else 分支：
    - `auto const _winrt_abi_type = *(abi_t<winrt::Microsoft::UI::Windowing::IAppWindowTitleBar2>**)this;`
        - 与 if 分支类似，但这里直接从 `this` 指针提取 ABI 类型，无需进行接口转换。
        - 因为 D 已经是目标接口类型，所以可以直接访问，避免了额外的 `QueryInterface` 开销。
    - `check_hresult(_winrt_abi_type->put_PreferredHeightOption(static_cast<int32_t>(value)));`
        - 直接调用 COM 方法，逻辑与 if 分支相同。

## 深入理解：为什么需要这样复杂的实现？

### 1. **类型安全与性能优化的平衡**
- C++/WinRT 提供强类型的现代 C++ 接口，但底层必须与 COM 兼容。
- 通过模板元编程，在编译时决定最优的代码路径，避免运行时开销。

### 2. **接口继承与多态的处理**
- WinRT 接口有复杂的继承关系，一个对象可能实现多个接口。
- `if constexpr` 确保在编译时选择正确的类型转换策略。

### 3. **COM 互操作性**
- 所有 WinRT 对象最终都是 COM 对象，需要遵循 COM 的调用约定。
- ABI 层确保了跨模块、跨语言的互操作性。

## 高级模板元编程技术深度初级解析讨论

### 4. **CRTP (Curiously Recurring Template Pattern) 在 C++/WinRT 中的应用**

C++/WinRT 大量使用了 CRTP 模式，这是一种让基类了解派生类类型的技术：

```cpp
// CRTP 基本模式
template<typename D>
class Base {
public:
    void someMethod() {
        static_cast<D*>(this)->derivedMethod();
    }
};

class Derived : public Base<Derived> {
public:
    void derivedMethod() { /* 具体实现 */ }
};
```

在我们的例子中，`consume_Microsoft_UI_Windowing_IAppWindowTitleBar2<D>` 就是采用 CRTP 模式：
- `D` 是实际的派生类类型
- 基类通过模板参数知道派生类的具体类型
- 这使得基类可以调用派生类的特定方法，实现静态多态

**CRTP 的优势：**
- **零运行时开销**：编译时就确定了调用关系，没有虚函数表查找
- **类型安全**：编译时检查类型匹配
- **接口统一**：提供统一的基类接口，同时保持派生类的特化能力

### 5. **SFINAE 与 enable_if 的深入应用**

虽然我们的例子没有直接展示，但 C++/WinRT 仍有可能大量使用 SFINAE（Substitution Failure Is Not An Error）(替换失败不是错误)技术。这是 Cpp11/14 的老方法，在 C++20 之前广泛使用。

```cpp
// SFINAE 示例：只有当 T 有 put_Value 方法时才启用此模板
template<typename T>
auto set_value(T& obj, int value) 
    -> decltype(obj.put_Value(value), void()) 
{
    obj.put_Value(value);
}

// 或者使用 std::enable_if
template<typename T>
typename std::enable_if_t<std::is_same_v<T, IAppWindowTitleBar2>, void>
process_interface(T& interface) {
    // 只有当 T 确实是 IAppWindowTitleBar2 时才编译此函数
}
```

**SFINAE 的作用：**
- **编译时类型检查**：确保只有符合条件的类型才会实例化模板
- **避免编译错误**：当类型不匹配时，编译器会忽略此模板而不是报错
- **实现重载解析**：让编译器在多个模板之间选择最合适的版本

### 6. **类型萃取 (Type Traits) 的高级应用**

C++/WinRT 使用复杂的类型萃取技术来处理不同的 WinRT 类型：

```cpp
// 判断是否为 WinRT 接口类型
template<typename T>
struct is_winrt_interface : std::false_type {};

template<typename T>
struct is_winrt_interface<winrt::Microsoft::UI::Windowing::IAppWindowTitleBar2> 
    : std::true_type {};

// 获取 ABI 类型
template<typename T>
struct abi_type_traits {
    using type = typename T::abi_type;
};

// 在编译时选择不同的实现路径
template<typename T>
void process_type() {
    if constexpr (is_winrt_interface<T>::value) {
        // 处理 WinRT 接口
    } else {
        // 处理其他类型
    }
}
```

**类型萃取的优势：**
- **编译时类型信息获取**：在编译期就能知道类型的特性
- **模板特化**：为不同类型提供不同的实现
- **接口统一**：通过统一的萃取接口处理不同类型

### 7. **完美转发 (Perfect Forwarding) 在参数传递中的应用**

虽然我们的例子使用的是 `const&`，但 C++/WinRT 在很多地方使用了完美转发：

```cpp
template<typename T>
auto make_interface(T&& value) {
    return impl::create_interface(std::forward<T>(value));
}

// 这样可以同时处理左值和右值，且保持其属性
auto result1 = make_interface(some_value);        // 左值
auto result2 = make_interface(std::move(value));  // 右值
auto result3 = make_interface(create_value());    // 临时对象
```

**完美转发的价值：**
- **避免不必要的拷贝**：右值直接移动，左值正常拷贝
- **模板通用性**：一个模板函数处理所有情况
- **性能优化**：特别是处理大对象时，性能提升明显

### 8. **constexpr 与编译时计算的深度应用**

现代 C++ 允许在编译时进行复杂计算，C++/WinRT 充分利用了这一点：

```cpp
// 编译时计算接口 ID
constexpr winrt::guid interface_id_v = winrt::guid_of<IAppWindowTitleBar2>();

// 编译时类型检查
template<typename T>
constexpr bool is_valid_winrt_type() {
    return requires {
        typename T::abi_type;
        { T{} } -> std::convertible_to<winrt::Windows::Foundation::IInspectable>;
    };
}

// 使用编译时条件
template<typename T>
void process_if_valid() {
    if constexpr (is_valid_winrt_type<T>()) {
        // 只有有效的 WinRT 类型才会编译这部分代码
        process_winrt_type<T>();
    }
}
```

## 实际开发中的模板元编程最佳实践

### 9. **错误诊断与调试技巧**

模板元编程的错误信息通常很难理解，以下是一些实用技巧：

```cpp
// 使用 static_assert 提供清晰的错误信息
template<typename T>
void require_winrt_interface(T&& obj) {
    static_assert(is_winrt_interface<std::decay_t<T>>::value, 
                  "T must be a WinRT interface type");
    
    static_assert(!std::is_pointer_v<std::decay_t<T>>, 
                  "Pass WinRT objects by value or reference, not pointer");
}

// 使用 concept (C++20) 提供更好的错误信息
template<typename T>
concept WinRTInterface = requires {
    typename T::abi_type;
    requires std::is_convertible_v<T, winrt::Windows::Foundation::IInspectable>;
};

template<WinRTInterface T>
void process_interface(T&& interface) {
    // 如果 T 不满足 WinRTInterface，编译器会给出清晰的错误信息
}
```

### 10. **性能分析与优化**

模板元编程的性能特点：

```cpp
// 编译时开销 vs 运行时开销对比

// 运行时多态 - 有虚函数开销
class RuntimeInterface {
public:
    virtual void setValue(int value) = 0;  // 虚函数调用开销
    virtual ~RuntimeInterface() = default;
};

// 编译时多态 - 零运行时开销
template<typename T>
void compile_time_call(T& obj, int value) {
    obj.setValue(value);  // 直接函数调用，可能被内联
}
```

**性能优化策略：**
1. **编译时计算**：能在编译时确定的尽量不留到运行时
2. **内联优化**：模板函数更容易被编译器内联
3. **避免不必要的类型转换**：使用精确的类型匹配
4. **合理使用 constexpr**：标记编译时常量表达式

### 11. **与现代 C++ 特性的结合**

C++/WinRT 积极采用现代 C++ 特性：

```cpp
// C++20 Concepts
template<typename T>
concept WinRTEnum = std::is_enum_v<T> && 
                   requires { typename winrt::impl::enum_type<T>; };

// C++17 结构化绑定
auto [success, result] = try_get_interface<ITargetInterface>(obj);

// C++20 协程
winrt::Windows::Foundation::IAsyncOperation<int> async_operation() {
    auto result = co_await some_async_call();
    co_return result.Value();
}

// C++17 if constexpr 的嵌套使用
template<typename T>
auto smart_convert(T&& value) {
    if constexpr (std::is_integral_v<std::decay_t<T>>) {
        if constexpr (std::is_signed_v<std::decay_t<T>>) {
            return convert_signed_integer(value);
        } else {
            return convert_unsigned_integer(value);
        }
    } else if constexpr (std::is_floating_point_v<std::decay_t<T>>) {
        return convert_floating_point(value);
    } else {
        return convert_other_type(std::forward<T>(value));
    }
}
```
## cpp/winRT 中的其他模板元编程技术——接口及实现框架
**C++/WinRT** 框架中一个关键的设计模式：**编译期方法注入（通过模板） vs 运行时多态（通过虚函数）**。此问题屡见不鲜，老生常谈。下面的回答基于页面操作其一个典型方法 `OnNavigatedTo`，来解释为什么不能使用 `override` 关键字。

我们来深入解释为什么在 `OnNavigatedTo` 这种由模板混入（mixin）的方法中，**不能使用 `override` 关键字**，即使它看起来像是在“重写”一个基类方法。

### 🔍 问题核心：`override` 的语义是“重写虚函数”

在标准 C++ 中，`override` 是一个**编译器检查关键字**，它的作用是：

> “我这个函数是要重写（override）**从基类继承来的虚函数（virtual function）**的。如果基类没有这样一个虚函数，编译器就报错。”

所以，`override` 只对 **虚函数继承体系** 有效。

### 🚫 为什么 `OnNavigatedTo` 不能加 `override`？

#### 1. `OnNavigatedTo` 不是虚函数，也不是基类定义的

在 C++/WinRT 中，页面类（如 `HomePage`）通常是这样定义的：

```cpp
// HomePage.h
struct HomePage : HomePageT<HomePage>
{
    HomePage();

    // ❌ 这不是一个 virtual 函数
    // 它是通过模板 HomePageT<HomePage> 注入的“可替换方法”
    void OnNavigatedTo(Microsoft::UI::Xaml::Navigation::NavigationEventArgs const& e);
};
```

关键点：
- `HomePageT<HomePage>` 是一个 **CRTP（奇异递归模板模式）** 的基类模板。
- `OnNavigatedTo` 是在 `HomePageT` 模板中通过代码生成或模板特化“注入”到派生类中的。
- 它**不是**一个 `virtual` 函数，也没有在基类中声明为 `virtual`。
- 因此，`OnNavigatedTo` 的调用是**静态绑定**（编译期决定），而不是动态多态。

#### 2. `override` 会触发编译器检查虚函数继承链

如果你写：

```cpp
void OnNavigatedTo(...) override; // ❌ 错误！
```

编译器会去检查：
> “`HomePageT<HomePage>` 这个基类里，有没有一个 `virtual void OnNavigatedTo(...)` 函数？”

答案是：**没有**。

所以编译器报错：
> `error C3668: 'HomePage::OnNavigatedTo': method with override specifier 'override' did not override any base class methods`

---

### ✅ 正确的理解：这是“混入（Mixin）” + “静态多态”，不是“虚函数多态”

C++/WinRT 使用 **CRTP + 模板代码生成** 实现了一种“接口方法”的机制：

```cpp
template <typename D>
struct PageT : public DependencyObjectT<D>, public ... {
    // 在导航发生时，框架会调用：
    void NavigateTo(...) {
        // 静态调用派生类的 OnNavigatedTo
        // 这里是通过 D 类型（即 HomePage）直接调用
        static_cast<D*>(this)->OnNavigatedTo(args); // ✅ 静态分发
    }
};
```

- 这种调用方式叫 **静态多态（static polymorphism）** 或 **编译期多态**。
- 它不依赖 `vtable`，没有运行时开销。
- 但它要求派生类（如 `HomePage`）必须提供 `OnNavigatedTo` 方法，否则编译失败。

---

### 🧩 类比：像“接口”但不是运行时接口

你说得对：

> “`OnNavigatedTo()` 属于页面类的接口方法。”

这里的“接口”是**概念上的**，意思是：
- 框架期望你实现这个方法。
- 它会在特定时机（导航到页面时）被调用。
- 但它不是通过 `virtual` 实现的运行时接口。

它更像是一个 **编译期契约（compile-time contract）**：
> “如果你继承了 `PageT<YourPage>`，你就必须提供一个 `OnNavigatedTo` 方法。”

这类似于 **C++ 概念（Concepts）** 或 **策略模式（Policy-based design）** 中的“要求”。

---

### 📌 总结：为什么不能用 `override`

| 项目 | 说明 |
|------|------|
| ❌ `override` 的前提 | 基类中必须有一个 `virtual` 函数 |
| ❌ `OnNavigatedTo` 的本质 | 是通过模板注入的“可替换方法”，不是虚函数 |
| ❌ 编译器行为 | 使用 `override` 会检查虚函数继承链，找不到就报错 |
| ✅ 正确做法 | 直接实现方法，不加 `override`，由 CRTP 模板在编译期静态调用 |

---

### ✅ 正确代码示例

```cpp
// HomePage.h
struct HomePage : PageT<HomePage> // CRTP
{
    // 正确：不加 override
    void OnNavigatedTo(Microsoft::UI::Xaml::Navigation::NavigationEventArgs const& e);
};

// HomePage.cpp
void HomePage::OnNavigatedTo(Microsoft::UI::Xaml::Navigation::NavigationEventArgs const& e)
{
    // 处理导航逻辑
}
```

框架内部通过 `static_cast<D*>(this)->OnNavigatedTo(e)` 调用它。

---

### 💡 类似技术对比

| 技术 | 多态类型 | 性能 | 典型用途 |
|------|---------|------|----------|
| `virtual` + `override` | 运行时多态 | 有 `vtable` 开销 | 标准 OOP 多态 |
| CRTP + `OnNavigatedTo` | 编译期多态 | 零成本抽象 | C++/WinRT、高性能库 |
| `concept` + `requires` | 编译期约束 | 零成本 | C++20 模板约束 |

---

### ✅ 结论

> **`OnNavigatedTo` 不能加 `override`，因为它不是虚函数，也不是通过运行时多态调用的。它是通过 CRTP 模板在编译期“混入”的方法，属于静态多态机制。使用 `override` 会导致编译器误以为你要重写一个不存在的虚函数，从而报错。**

这是 C++/WinRT 利用模板元编程实现高效、类型安全的 UI 框架的关键设计之一。


### 关键问题：**如何让一个基类模板“智能地”调用派生类中“可能存在，也可能不存在”的方法？**

这正是 C++/WinRT 实现 `OnNavigatedTo` 这类“可选钩子”的核心技术。我们今天就从零开始，**用最通俗的语言、最简单的例子**，一步步带你理解这些看似复杂的模板元编程技术。

---

### 🌟 目标：实现一个“智能基类”

我们想要实现这样的效果：

```cpp
struct MyPage {
    void OnNavigatedTo() { 
        std::cout << "Page navigated!\n"; 
    }
};

struct SimplePage {
    // 没有 OnNavigatedTo 方法
};

MyPage p1;
SimplePage p2;

call_on_navigated_to(p1); // ✅ 输出 "Page navigated!"
call_on_navigated_to(p2); // ✅ 什么也不做，不报错
```

即：**如果对象有 `OnNavigatedTo` 方法，就调用它；没有，就跳过。**

这在 C++ 中如何实现？我们一步步来。

---

### 第一步：最简单的静态调用（CRTP 基础）

先看最基础的 CRTP 模式：

```cpp
template <typename D>
struct PageBase {
    void NavigateTo() {
        D* derived = static_cast<D*>(this);
        derived->OnNavigatedTo(); // 直接调用
    }
};

struct MyPage : PageBase<MyPage> {
    void OnNavigatedTo() {
        std::cout << "Hello!\n";
    }
};
```

但这有问题：如果 `MyPage` **没有** `OnNavigatedTo`，编译就失败！

> ❌ 错误：`'OnNavigatedTo': is not a member of 'SimplePage'`

我们需要一种“**先检查，再调用**”的机制。

---

### 第二步：条件调用 —— `if constexpr` + `requires`（C++20）

这是**最现代、最清晰**的写法。

#### ✅ 方法 1：使用 `if constexpr` 和 `requires` 表达式

```cpp
#include <iostream>

// 通用函数模板
template <typename T>
void call_on_navigated_to(T& obj) {
    if constexpr (requires { obj.OnNavigatedTo(); }) {
        // 如果 obj 有 OnNavigatedTo() 方法，就调用它
        obj.OnNavigatedTo();
    }
    else {
        // 否则，什么也不做
        std::cout << "[No OnNavigatedTo method]\n";
    }
}
```

#### 🧪 测试一下：

```cpp
struct MyPage {
    void OnNavigatedTo() { 
        std::cout << "Page navigated!\n"; 
    }
};

struct SimplePage {
    // 什么方法都没有
};

int main() {
    MyPage p1;
    SimplePage p2;

    call_on_navigated_to(p1); // ✅ 输出 "Page navigated!"
    call_on_navigated_to(p2); // ✅ 输出 "[No OnNavigatedTo method]"
}
```

#### 🔍 原理讲解

- `requires { obj.OnNavigatedTo(); }` 是一个 **“要求表达式”（requires expression）**
  - 它在**编译期**检查：`obj` 是否可以调用 `.OnNavigatedTo()`
  - 如果可以，表达式为 `true`；否则为 `false`
- `if constexpr` 是**编译期 if**
  - 条件在编译时求值
  - 只编译“为真的分支”
  - 所以不会生成对 `SimplePage` 调用 `OnNavigatedTo` 的代码

> ✅ 这就是“零成本抽象”：没有运行时开销，没有虚函数表。

---

### 第三步：更复杂的场景 —— 带参数的函数

现实中的 `OnNavigatedTo` 是带参数的：

```cpp
void OnNavigatedTo(NavigationEventArgs const& args);
```

我们来升级：

```cpp
struct NavigationEventArgs {
    int parameter = 42;
};

template <typename T>
void call_on_navigated_to(T& obj, NavigationEventArgs const& args) {
    if constexpr (requires { obj.OnNavigatedTo(args); }) {
        obj.OnNavigatedTo(args);
    }
    else {
        std::cout << "[No OnNavigatedTo method]\n";
    }
}

// 测试类
struct MyPage {
    void OnNavigatedTo(NavigationEventArgs const& e) {
        std::cout << "Navigated with parameter: " << e.parameter << "\n";
    }
};

struct SimplePage {}; // 没有方法
```

✅ 完美工作！

---

### 第四步：SFINAE（Substitution Failure Is Not An Error）

这是 C++11/14 的老方法，在 C++20 之前广泛使用。

#### ✅ 方法 2：使用 `std::enable_if` + SFINAE

```cpp
#include <type_traits>

// 辅助类型：检查 T 是否有 OnNavigatedTo 方法
template <typename T>
struct has_on_navigated_to {
    // 声明一个函数，它接受任何类型，返回 char
    template <typename U>
    static char test(decltype(&U::OnNavigatedTo)*);

    // 重载：接受任何类型，返回 long
    template <typename U>
    static long test(...);

    // 判断：如果 U 有 OnNavigatedTo，test<U>(&U::OnNavigatedTo) 会匹配 char 版
    // 否则匹配 ... 版，返回 long
    static constexpr bool value = sizeof(test<T>(nullptr)) == sizeof(char);
};
```

#### 使用它：

```cpp
template <typename T>
typename std::enable_if<has_on_navigated_to<T>::value>::type
call_on_navigated_to(T& obj) {
    obj.OnNavigatedTo();
}

template <typename T>
typename std::enable_if<!has_on_navigated_to<T>::value>::type
call_on_navigated_to(T& obj) {
    std::cout << "[No OnNavigatedTo method]\n";
}
```

#### 测试例：

```cpp
struct MyPage { void OnNavigatedTo() { std::cout << "Hello!\n"; } };
struct SimplePage {};

call_on_navigated_to(MyPage{});   // ✅ 输出 "Hello!"
call_on_navigated_to(SimplePage{}); // ✅ 输出 "[No ...]"
```

#### 🔍 原理：SFINAE

- 编译器尝试匹配第一个 `call_on_navigated_to`
- 如果 `T` 没有 `OnNavigatedTo`，`decltype(&U::OnNavigatedTo)` 会出错
- 但 SFINAE 规则说：“**替换失败不是错误**”，所以编译器**安静地移除这个候选函数**
- 然后尝试第二个版本，成功匹配

> ⚠️ 这种写法复杂、难懂，C++20 之后已被 `requires` 取代。

---

### 第五步：函数重载 + ADL（参数依赖查找）

这是另一种高级技巧，C++/WinRT 内部可能使用。

#### ✅ 方法 3：通过重载和 ADL 实现“自定义点”（Customization Point）

```cpp
namespace my_framework {
    // 1. 定义一个“fallback”版本（默认行为）
    void call_on_navigated_to_fallback(...) {
        std::cout << "[No OnNavigatedTo method]\n";
    }

    // 2. 在命名空间内声明一个可被 ADL 找到的函数
    template <typename T>
    void call_on_navigated_to(T& obj) {
        // 这里不直接调用 obj.OnNavigatedTo()
        // 而是调用一个同名函数，让 ADL 决定调哪个
        call_on_navigated_to_fallback(obj);
    }
}

// 用户在自己的命名空间中定义“定制化”版本
void call_on_navigated_to(MyPage& obj) {
    obj.OnNavigatedTo();
}

// 测试
MyPage p;
my_framework::call_on_navigated_to(p); 
// ADL 会找到用户定义的版本，而不是 fallback
```

> 这种方式更灵活，但更复杂，通常用于标准库设计（如 `std::swap`）。

### 三种技术对比

| 方法 | C++ 标准 | 难度 | 推荐程度 | 说明 |
|------|--------|------|----------|------|
| `if constexpr` + `requires` | C++20 | ⭐⭐ | ✅ 强烈推荐 | 最清晰，编译期判断 |
| SFINAE + `enable_if` | C++11 | ⭐⭐⭐⭐ | ❌ 不推荐 | 复杂，已被淘汰 |
| 函数重载 + ADL | C++98 | ⭐⭐⭐ | ⚠️ 高级用法 | 用于标准库设计 |

---

### 🔚 C++/WinRT 怎么做的？

C++/WinRT 使用的是 **`if constexpr`类似的编译期探测机制

在生成的代码中，你会看到类似：

```cpp
if constexpr (has_method_v<D, &D::OnNavigatedTo, NavigationEventArgs>) {
    static_cast<D*>(this)->OnNavigatedTo(args);
}
```

它不是虚函数，不是运行时多态，而是：

> **编译器在编译时“看一眼”你的类有没有这个方法，有就生成调用代码，没有就跳过。**

所以：
- ✅ 你不实现，不会报错
- ✅ 实现了，就会被调用
- ❌ 不能加 `override`，因为它不是虚函数

你不需要掌握所有模板元编程技巧，但要记住：

> **C++/WinRT 的 `OnNavigatedTo` 是通过“编译期探测”实现的可选钩子，不是虚函数。**
>
> - 不实现 → 编译器生成空逻辑
> - 实现了 → 编译器生成调用代码
> - 不能加 `override` → 因为不是虚函数
> - 零运行时开销 → 全部在编译期决定

这就是现代 C++ 的强大之处：**用模板实现“智能接口”，既灵活又高效**。
## 总结与展望

### 核心设计理念
C++/WinRT 的模板元编程设计体现了以下核心理念：

1. **零开销抽象**：高级接口不应带来运行时性能损失
2. **类型安全**：编译时捕获类型错误，避免运行时问题
3. **开发效率**：提供简洁易用的 API，隐藏复杂的底层细节
4. **向后兼容**：与现有 COM 基础设施完全兼容

### 学习路径建议
要掌握这样的高级模板元编程技术，建议按以下路径学习：

**基础阶段：**
1. C++ 基础语法（指针、引用、类）
2. 基础模板（函数模板、类模板）
3. 标准库容器和算法

**进阶阶段：**
4. 现代 C++ 特性（auto、lambda、智能指针）
5. 高级模板技术（特化、萃取、SFINAE）
6. 元编程概念（编译时计算、类型操作）

**专业阶段：**
7. COM 基础知识
8. WinRT 架构理解
9. C++/WinRT 框架深入研究
10. 实际项目实践

通过深入理解这些概念，你不仅能更好地使用 C++/WinRT，还能在其他需要高性能和类型安全的场景中应用类似的设计模式。这正是现代 C++ 模板元编程的魅力所在：用编译时的复杂性换取运行时的简洁与高效。