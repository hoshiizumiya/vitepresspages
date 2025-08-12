# WinUI 3 WinRT C++ 开发完整教程 - 第零部分：环境配置与基础概念

## 什么是 WinUI 3 和 WinRT？

### WinUI 3 简介

**WinUI 3** 是微软为 Windows 平台开发的现代原生用户界面框架。让我们通过类比来理解：

- 如果说 **Win32 API** 是传统的"汇编语言级别"的 UI 开发方式
- 那么 **WinUI 3** 就是"高级语言级别"的现代化 UI 开发方式

**WinUI 3 的优势**：
1. **现代化设计**：内置 Fluent Design System，自动适配 Windows 11 风格
2. **高性能**：基于硬件加速的渲染引擎
3. **跨版本兼容**：支持 Windows 10 1809 及更高版本
4. **丰富控件**：提供 100+ 现代化 UI 控件

### WinRT 详解

**WinRT (Windows Runtime)** 是微软设计的应用程序平台架构。为了理解 WinRT，我们需要了解几个关键概念：

#### 1. 什么是 COM？

**COM (Component Object Model)** 是微软的组件对象模型：

```cpp
// 传统的 COM 接口定义
interface IUnknown
{
    virtual HRESULT QueryInterface(REFIID riid, void** ppv) = 0;
    virtual ULONG AddRef() = 0;
    virtual ULONG Release() = 0;
};
```

**COM 的核心概念**：
- **接口**：定义对象的行为契约
- **引用计数**：自动管理对象生命周期
- **语言无关**：可以被不同编程语言使用

#### 2. WinRT 如何改进 COM？

WinRT 基于 COM 但进行了现代化改进：

**传统 COM 的问题**：
```cpp
// 传统 COM 代码很繁琐
IFileDialog* pFileDialog = nullptr;
HRESULT hr = CoCreateInstance(CLSID_FileOpenDialog, 
                              nullptr, 
                              CLSCTX_ALL, 
                              IID_IFileDialog, 
                              (void**)&pFileDialog);
if (SUCCEEDED(hr))
{
    // 使用对象...
    pFileDialog->Release(); // 手动管理内存
}
```

**WinRT 的简化**：
```cpp
// WinRT 代码更简洁
auto fileDialog = winrt::Windows::Storage::Pickers::FileOpenPicker();
// 自动内存管理，无需手动 Release
```

#### 3. 元数据驱动开发

WinRT 使用 **.winmd** 文件存储类型信息：

```idl
// MainWindow.idl - 接口定义语言
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

**这个 IDL 文件做了什么？**
1. **定义接口契约**：告诉编译器这个类有什么方法和属性
2. **生成元数据**：编译成 .winmd 文件，包含类型信息
3. **启用投影**：其他语言可以使用这些类型

## 核心概念详解

### 1. 命名空间 (Namespace)

WinRT 使用分层命名空间组织 API：

```cpp
// WinRT 命名空间层次结构
winrt::Windows::Foundation::                    // 基础类型
winrt::Windows::Foundation::Collections::       // 集合类型
winrt::Microsoft::UI::Xaml::                   // XAML UI 框架
winrt::Microsoft::UI::Xaml::Controls::         // UI 控件
```

**实际使用示例**：
```cpp
// 完整命名空间
winrt::Windows::Foundation::Collections::IObservableVector<hstring> collection;

// 使用 using 简化
using namespace winrt::Windows::Foundation::Collections;
IObservableVector<hstring> collection; // 简化后的写法
```

### 2. hstring 类型详解

**hstring** 是 WinRT 的字符串类型：

```cpp
// 创建 hstring 的几种方式
hstring str1{L"Hello World"};                    // 从字面量创建
hstring str2 = winrt::to_hstring(42);           // 从数字创建
hstring str3 = L"Direct assignment";             // 直接赋值

// hstring 的特点
std::wcout << str1.c_str() << std::endl;        // 获取 C 风格字符串
size_t length = str1.size();                     // 获取长度
bool isEmpty = str1.empty();                     // 检查是否为空
```

**为什么不直接用 std::string？**
- **WinRT 互操作性**：hstring 是 WinRT ABI 的标准字符串类型
- **性能优化**：内部优化了跨语言传递
- **自动编码处理**：自动处理 UTF-16 编码

### 3. 装箱和拆箱 (Boxing/Unboxing)

WinRT 使用 `IInspectable` 作为基础对象类型，类似于 C# 的 `object`：

```cpp
// 装箱：将具体类型转换为 IInspectable
int32_t number = 42;
winrt::Windows::Foundation::IInspectable boxed = winrt::box_value(number);

// 拆箱：从 IInspectable 恢复具体类型
int32_t unboxed = winrt::unbox_value<int32_t>(boxed);

// 字符串装箱示例
hstring text = L"Hello";
auto boxedText = winrt::box_value(text);
```

**装箱的应用场景**：
```cpp
// ListView 的 Items 集合只接受 IInspectable
manualList().Items().Append(winrt::box_value(hstring{L"Item 1"}));
```

### 4. 智能指针和 RAII

C++/WinRT 使用智能指针自动管理内存：

```cpp
// 自动内存管理示例
{
    auto button = winrt::Microsoft::UI::Xaml::Controls::Button();
    button.Content(winrt::box_value(L"Click Me"));
    // 当 button 超出作用域时，自动释放内存
} // button 在这里自动销毁

// 弱引用示例
winrt::weak_ref<winrt::Microsoft::UI::Xaml::Controls::Button> weakButton = button;
if (auto strongButton = weakButton.get())
{
    // 安全使用按钮
    strongButton.Content(winrt::box_value(L"Updated"));
}
```

## 开发环境搭建

### 环境

1. **Visual Studio 2022**
   - 版本：使用最新版，社区版即可
   - 必须工作负载：使用 C++ 的桌面开发

2. **Windows SDK**
   - 版本：Windows 10 SDK (10.0.19041.0) 或更高
   - 包含：WinRT 头文件和库

## C++ 基础要求

### 必需的 C++ 知识

#### 1. C++17 特性

项目使用 ISO C++17 标准，需要了解基础的，如果你不熟悉，我们在入门系列里也深入讲解了：

```cpp
// auto 类型推导
auto number = 42;                    // int
auto text = L"Hello";               // const wchar_t*
auto collection = std::vector<int>{}; // std::vector<int>

// Lambda 表达式
auto clickHandler = [this](auto&& sender, auto&& args)
{
    // 事件处理逻辑
};

// 范围-based for 循环
std::vector<hstring> items = {L"A", L"B", L"C"};
for (auto&& item : items)
{
    std::wcout << item.c_str() << std::endl;
}
```

#### 2. 智能指针

```cpp
#include <memory>

// unique_ptr：独占所有权
std::unique_ptr<int> ptr = std::make_unique<int>(42);

// shared_ptr：共享所有权
std::shared_ptr<std::string> shared = std::make_shared<std::string>("Hello");

// weak_ptr：弱引用
std::weak_ptr<std::string> weak = shared;
```

#### 3. 异常处理

```cpp
try
{
    // 可能抛出异常的代码
    auto result = risky_operation();
}
catch (winrt::hresult_error const& ex)
{
    // 处理 WinRT 异常
    std::wcout << L"Error: " << ex.message().c_str() << std::endl;
}
catch (std::exception const& ex)
{
    // 处理标准 C++ 异常
    std::cout << "Error: " << ex.what() << std::endl;
}
```

### 推荐的 C++ 学习资源

1. **书籍**：
   - 《C++ 20 高级编程》（第5版）
   - 《Effective Modern C++》
   - 《C++ Core Guidelines》

2. **在线资源**：
   - cppreference.com
   - Microsoft C++ 文档

## 第一个 WinUI 3 应用程序

### 创建项目

1. 打开 Visual Studio 2022
2. 选择"创建新项目"
3. 搜索"WinUI"
4. 选择"空白应用，打包的 (WinUI 3 in C++)"
5. 设置项目名称：例如 "MyFirstWinUI3App"

### 项目结构解析

创建后的项目包含这些重要文件：

```
MyFirstWinUI3App/
├── App.xaml                 # 应用程序定义
├── App.xaml.h              # 应用程序头文件
├── App.xaml.cpp            # 应用程序实现
├── MainWindow.xaml         # 主窗口界面定义
├── MainWindow.xaml.h       # 主窗口头文件
├── MainWindow.xaml.cpp     # 主窗口实现
├── MainWindow.idl          # 主窗口接口定义
├── pch.h                   # 预编译头文件
└── Package.appxmanifest    # 应用程序清单
```

### 理解关键文件

#### pch.h（预编译头文件）

```cpp
#pragma once
#include <windows.h>
#include <unknwn.h>
#include <restrictederrorinfo.h>
#include <hstring.h>

// 解决宏名称冲突
#undef GetCurrentTime

// WinRT 基础头文件
#include <winrt/base.h>
#include <winrt/Windows.Foundation.h>
#include <winrt/Windows.Foundation.Collections.h>

// WinUI 3 头文件
#include <winrt/Microsoft.UI.Xaml.h>
#include <winrt/Microsoft.UI.Xaml.Controls.h>
#include <winrt/Microsoft.UI.Xaml.Navigation.h>
```

**pch.h 的作用**：
- **加速编译**：预编译常用头文件
- **统一包含**：所有源文件都包含这些基础类型
- **解决冲突**：处理宏名称冲突

#### MainWindow.idl

```idl
namespace MyFirstWinUI3App
{
    [default_interface]
    runtimeclass MainWindow : Microsoft.UI.Xaml.Window
    {
        MainWindow();
        Int32 MyProperty;
    }
}
```

**IDL 文件的作用**：
1. **定义公共接口**：声明可以被外部访问的方法和属性
2. **生成元数据**：编译器生成 .winmd 文件
3. **启用代码生成**：自动生成投影代码

#### MainWindow.xaml.h

```cpp
#pragma once

#include "MainWindow.g.h"

namespace winrt::MyFirstWinUI3App::implementation
{
    struct MainWindow : MainWindowT<MainWindow>
    {
        MainWindow();

        int32_t MyProperty();
        void MyProperty(int32_t value);

    private:
        int32_t m_myProperty{0};
    };
}

namespace winrt::MyFirstWinUI3App::factory_implementation
{
    struct MainWindow : MainWindowT<MainWindow, winrt::MyFirstWinUI3App::implementation::MainWindow>
    {
    };
}
```

**关键点解释**：
- `#include "MainWindow.g.h"`：包含自动生成的基类
- `MainWindowT<MainWindow>`：CRTP (Curiously Recurring Template Pattern)
- `implementation` 命名空间：包含具体实现
- `factory_implementation`：对象工厂实现

### 编译流程详解

1. **IDL 编译**：
   ```bash
   midl.exe MainWindow.idl
   # 生成 MainWindow.winmd
   ```

2. **代码生成**：
   ```bash
   cppwinrt.exe -input . -output Generated Files
   # 生成 MainWindow.g.h 和 MainWindow.g.cpp
   ```

3. **XAML 编译**：
   ```bash
   # XAML 编译器处理 .xaml 文件
   # 生成相应的 C++ 代码
   ```

4. **C++ 编译**：
   ```bash
   cl.exe /std:c++14 *.cpp
   # 编译所有 C++ 源文件
   ```

### 运行第一个应用程序

1. 按 F5 或点击"调试">"开始调试"
2. 应用程序应该显示一个空白窗口
3. 这表明环境配置正确！

### 添加第一个控件

让我们修改 MainWindow.xaml 添加一个按钮：

```xml
<Window x:Class="MyFirstWinUI3App.MainWindow"
        xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml">

    <Grid>
        <Button x:Name="myButton" 
                Content="点击我！" 
                Click="myButton_Click"/>
    </Grid>
</Window>
```

在 MainWindow.xaml.h 中添加事件处理器声明：

```cpp
void myButton_Click(winrt::Windows::Foundation::IInspectable const& sender, 
                   winrt::Microsoft::UI::Xaml::RoutedEventArgs const& e);
```

在 MainWindow.xaml.cpp 中实现事件处理器：

```cpp
void MainWindow::myButton_Click(winrt::Windows::Foundation::IInspectable const& sender, 
                               winrt::Microsoft::UI::Xaml::RoutedEventArgs const& e)
{
    myButton().Content(winrt::box_value(L"已点击！"));
}
```

**代码解释**：
- `x:Name="myButton"`：为控件指定名称，可在 C++ 代码中访问
- `Click="myButton_Click"`：指定点击事件处理器
- `myButton()`：访问 XAML 中定义的控件
- `winrt::box_value()`：将字符串装箱为 WinRT 对象

## 总结

这一部分我们学习了：

1. **WinUI 3 和 WinRT 的基本概念**
2. **COM 和 WinRT 的关系**
3. **开发环境的搭建**
4. **必要的 C++ 知识**
5. **第一个 WinUI 3 应用程序的创建**

下一部分我们将深入学习 WinRT 的类型系统和基础 API。

---

*这是 WinUI 3 WinRT C++ 完整教程的第零部分。接下来我们将学习更深入的概念和实际开发技巧。*