# WinUI 3 WinRT C++ 开发完整教程 - 第一部分：基础概念与架构

## 概述

WinUI 3 是微软最新的原生 Windows 应用程序 UI 框架，它结合了 WinRT（Windows Runtime）的强大功能和 C++ 的高性能。本教程将从底层原理开始，详细讲解如何使用 C++/WinRT 开发现代化的 Windows 应用程序。

### 为什么选择 WinUI 3 + C++/WinRT？

1. **原生性能**：C++ 提供最佳的运行时性能和内存控制
2. **现代化 UI**：WinUI 3 提供 Fluent Design 系统和现代化控件
3. **跨版本支持**：支持 Windows 10 1809+ 和 Windows 11
4. **与系统深度集成**：可以访问所有 Windows API 和功能

## WinRT 基础概念

### 什么是 WinRT？

Windows Runtime (WinRT) 是微软设计的应用程序架构，它提供了：

1. **语言无关的组件模型**：基于 COM 但简化了接口
2. **元数据驱动**：使用 .winmd 文件描述类型信息
3. **投影技术**：为不同语言提供自然的编程模型

### WinRT 的核心概念

#### 1. 接口定义语言 (IDL)

WinRT 使用 IDL 文件定义运行时类和接口。在我们的项目中可以看到：

```idl
// MainWindow.idl
namespace WinUI3App1C__
{
    [default_interface]
    runtimeclass MainWindow : Microsoft.UI.Xaml.Window
    {
        MainWindow();
        Windows.Foundation.Collections.IObservableVector<String> collection{ get; };
    }
}
```

**深度解析**：
- `runtimeclass` 关键字定义一个可被其他语言使用的运行时类
- `[default_interface]` 特性指定这是默认接口
- 继承自 `Microsoft.UI.Xaml.Window` 提供窗口基础功能
- `collection{ get; }` 定义一个只读属性

#### 2. ABI (Application Binary Interface)

WinRT 的 ABI 基于 COM 接口，但进行了现代化改进：

```cpp
// 生成的 ABI 代码示例（简化版）
struct __declspec(uuid("...")) IMainWindow : ::IInspectable
{
    virtual HRESULT __stdcall get_collection(
        void** value) = 0;
};
```

**关键点**：
- 所有 WinRT 接口都继承自 `IInspectable`
- 使用标准 COM 调用约定 (`__stdcall`)
- 自动处理引用计数和错误处理

#### 3. 投影层 (Projection Layer)

C++/WinRT 投影层将底层 ABI 转换为现代 C++ 代码：

```cpp
// 从项目代码中看到的投影示例
namespace winrt::WinUI3App1C__::implementation
{
    struct MainWindow : MainWindowT<MainWindow>
    {
        winrt::Windows::Foundation::Collections::IObservableVector<hstring> collection();
    };
}
```

## C++/WinRT 语言投影

### 投影架构

C++/WinRT 使用多层架构：

```
用户代码 (MainWindow.xaml.cpp)
     ↓
投影层 (MainWindow.g.h)
     ↓
ABI 层 (Generated ABI code)
     ↓
WinRT 运行时
```

### 代码生成过程

1. **IDL 编译**：`midl.exe` 将 IDL 文件编译为 `.winmd` 文件
2. **投影生成**：`cppwinrt.exe` 读取 `.winmd` 生成 C++ 头文件
3. **实现模板**：生成 `.g.h` 和 `.g.cpp` 文件作为实现基础

### 类型映射

WinRT 类型与 C++ 类型的映射：

| WinRT 类型 | C++ 类型 | 说明 |
|-----------|----------|------|
| `String` | `winrt::hstring` | 不可变字符串 |
| `IObservableVector<T>` | `winrt::Windows::Foundation::Collections::IObservableVector<T>` | 可观察集合 |
| `Object` | `winrt::Windows::Foundation::IInspectable` | 基础对象类型 |

### 智能指针和生命周期管理

C++/WinRT 使用智能指针自动管理对象生命周期：

```cpp
// 从项目代码中的示例
winrt::Windows::Foundation::Collections::IObservableVector<hstring> sourceArray{
    winrt::single_threaded_observable_vector<hstring>()
};
```

**关键特性**：
- 自动引用计数
- RAII (Resource Acquisition Is Initialization) 原则
- 异常安全

## WinUI 3 架构深度解析

### 分层架构

```
应用层 (XAML + C++)
    ↓
WinUI 3 控件层
    ↓
Win32/WinRT 系统层
    ↓
Windows 内核
```

### XAML 与 C++ 的绑定机制

#### 1. 代码绑定（Direct Binding）

```cpp
// 从 MainWindow.xaml.cpp 中的示例
sourceList().ItemsSource(sourceArray);
```

这种方式直接在 C++ 代码中设置控件属性，优点是：
- 性能最佳
- 编译时类型检查
- 调试友好

#### 2. 数据绑定（Data Binding）

```cpp
// IDL 中定义的属性
Windows.Foundation.Collections.IObservableVector<String> collection{ get; };

// C++ 实现
winrt::Windows::Foundation::Collections::IObservableVector<hstring> MainWindow::collection()
{
    return boundArray;
}
```

**深层原理**：
- XAML 编译器生成绑定表达式
- 运行时通过反射访问属性
- 支持双向绑定和变更通知

*绑定的更多内容会在入门中讲解[jump-link]()*

### 事件处理机制

```cpp
void MainWindow::addManualListButton_Click(
    winrt::Windows::Foundation::IInspectable const& sender,
    winrt::Microsoft::UI::Xaml::RoutedEventArgs const& e)
{
    // 事件处理逻辑
}
```

**事件处理流程**：
1. XAML 解析器注册事件处理器
2. 用户交互触发事件
3. WinUI 3 框架调用 C++ 处理函数
4. 通过投影层传递参数

## 项目结构与文件组织

### 核心文件类型

#### 1. IDL 文件 (.idl)
定义 WinRT 类型和接口：
```idl
namespace WinUI3App1C__
{
    [default_interface]
    runtimeclass MainWindow : Microsoft.UI.Xaml.Window
    {
        MainWindow();
        Windows.Foundation.Collections.IObservableVector<String> collection{ get; };
    }
}
```

#### 2. XAML 文件 (.xaml)
定义用户界面：
```xml
<Page x:Class="WinUI3App1C__.SettingsPage">
    <Grid>
        <!-- UI 元素 -->
    </Grid>
</Page>
```

#### 3. 头文件 (.h)
```cpp
#pragma once
#include "MainWindow.g.h"

namespace winrt::WinUI3App1C__::implementation
{
    struct MainWindow : MainWindowT<MainWindow>
    {
        MainWindow();
        winrt::Windows::Foundation::Collections::IObservableVector<hstring> collection();
        // 其他成员...
    };
}
```

#### 4. 实现文件 (.cpp)
```cpp
#include "pch.h"
#include "MainWindow.xaml.h"
#if __has_include("MainWindow.g.cpp")
#include "MainWindow.g.cpp"
#endif

namespace winrt::WinUI3App1C__::implementation
{
    MainWindow::MainWindow()
    {
        InitializeComponent();
        // 初始化逻辑...
    }
}
```

### 预编译头文件 (pch.h)

```cpp
#pragma once
#include <windows.h>
#include <unknwn.h>
#include <restrictederrorinfo.h>
#include <hstring.h>

#undef GetCurrentTime
#define _VSDESIGNER_DONT_LOAD_AS_DLL

#include <winrt/Windows.Foundation.h>
#include <winrt/Windows.Foundation.Collections.h>
// ... 其他 WinRT 头文件
```

**作用**：
- 加速编译过程
- 提供所有必要的 WinRT 类型定义
- 解决宏冲突问题

## 编译系统与代码生成

### 编译流程

1. **预处理**：处理预编译头文件
2. **IDL 编译**：生成元数据和类型信息
3. **XAML 编译**：生成 XAML 相关的 C++ 代码
4. **C++ 编译**：编译用户代码和生成代码
5. **链接**：生成最终可执行文件

### 生成的文件结构

```
Generated Files/
├── winrt/
│   ├── WinUI3App1C__.h           # 投影头文件
│   ├── impl/
│   │   └── WinUI3App1C__.2.h     # 实现模板
│   └── ...
├── MainWindow.g.h                # XAML 代码背后文件
├── MainWindow.g.cpp              # XAML 实现文件
└── ...
```

### 代码生成原理

#### 1. XAML 编译器生成

XAML 编译器分析 XAML 文件并生成：
- 控件实例化代码
- 事件绑定代码
- 资源查找代码

#### 2. IDL 投影生成

基于 IDL 文件，cppwinrt.exe 生成：
- ABI 接口定义
- 投影类型
- 工厂实现

### C++17 兼容性

项目默认使用 C++17 标准，这意味着：
- 支持 `auto` 类型推导
- 支持泛型 lambda
- 支持 `constexpr` 函数
- 若你需要自定义，需要自己选择项目调整属性设置，如图 
![C++17设置](https://cdn.jsdelivr.net/gh/hoshiizumiya/images/cpp语言支持.png)

**在代码中的体现**：
```cpp
// C++17 兼容的写法
auto sourceArray = winrt::single_threaded_observable_vector<hstring>();

// 使用 auto 简化类型声明
for (auto&& item : collection()) {
    // 处理每个项目
}
```

## 总结

本部分介绍了 WinUI 3 WinRT C++ 开发的基础概念：

1. **WinRT** 提供了语言无关的组件模型
2. **C++/WinRT** 通过投影技术提供现代 C++ 接口
3. **WinUI 3** 在此基础上构建现代化 UI 框架
4. **项目结构** 清晰分离了接口定义、实现和 UI

下一部分将深入讲解具体的开发实践和高级特性。

---

*这是 WinUI 3 WinRT C++ 完整教程的第一部分。接下来的部分将涵盖具体的开发实践、数据绑定、导航、异步编程等主题。*