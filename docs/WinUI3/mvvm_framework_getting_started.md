# WinUI3 C++/WinRT MVVM Framework 使用手册

本文以 mvvm_framework 为准，结合 `ViewModels/MyEntityViewModel.*` 的示例，介绍：属性、命令、异步、校验、依赖广播、线程调度与清理等。
由于我们还未有正式发布的 NuGet 包，建议直接把 `mvvm_framework` 目录拷贝到你的项目的目录中直接使用。

## 1. 框架是什么

mvvm_framework 是一个轻量的 C++/WinRT MVVM 基础库，核心目标：
- 更少样板代码，目的是写起来像 C# MVVM。在以后我们最希望随着 C++ 标准的更新，MVVM 能够支持到反射快速使用
- 支持同步/异步命令、依赖广播、属性校验
- 自动化清理命令依赖与订阅，避免泄漏

关键组件：
- `WrapNotifyPropertyChanged<T>`：属性变更通知、校验、依赖广播
- `ViewModelBase<T>`：线程感知的 Get/SetProperty 包装
- `ViewModel<T>`：提供 UI `DispatcherQueue`、自动清理注册
- 命令：`DelegateCommand<TParam>`、`AsyncDelegateCommand<TParam>` + 对应 Builder
- 事件模型：命令执行/校验的事件参数（IDL/WinRT 可订阅）

## 2. 项目结构与约定

- 框架头文件：`/mvvm_framework/*`
- VM：`ViewModels/MyEntityViewModel.*`
- 服务/模型：`Models/*`
- VM 定位器：`ViewModels/Locator.*`（不一定需要）

部分建议的和我们的标准命名约定：
- 私有字段：`m_` 前缀（如 `m_isBusy`）
- 公开属性：PascalCase（如 `IsBusy`）
- 命令属性：以 `Command` 结尾（如 `ResetCommand`/`AsyncCommand`）
- 布尔状态：以 `Is` 开头（如 `IsValid`/`IsBusy`）
- 依赖广播源/从属性名：与绑定名一致（如 `FirstName` -> `FullName`）
- 更多命名约定内容你可以前往[链接暂未准备好公开]()查询详情

## 3. 快速上手

### 3.1 新建一个 ViewModel
- 继承 `::mvvm::ViewModel<YourVm>`
- 定义属性（使用 SetProperty/GetProperty）
- 暴露命令（ICommand）

示例：

```cpp
//MyVM.h
#pragma once
#include "mvvm_framework/delegate_command.h"
#include "mvvm_framework/delegate_command_builder.h"
#include "mvvm_framework/async_command_builder.h"

//这里 MyVm 是你的 ViewModel 名称，要求继承mvvm::ViewModel<MyVm>
// MyVm.cpp
struct MyVm : ::mvvm::ViewModel<MyVm>
{
    MyVM::MyVm() 
    {
        InitCommands(); 
    }

    // 属性
    int32_t Counter() { return GetProperty(m_counter); }
    void    Counter(int32_t v) { SetProperty(m_counter, v, L"Counter"); }

    // 命令
    Microsoft::UI::Xaml::Input::ICommand IncCommand() { return m_inc; }

private:
    void InitCommands()
    {
        m_inc = ::mvvm::DelegateCommandBuilder<winrt::Windows::Foundation::IInspectable>(*this)
            .Execute([this](auto&&){ Counter(Counter()+1); })
            .CanExecute([this](auto&&){ return Counter() < 10; })
            .DependsOn(L"Counter")
            .Build();

        RegisterForAutoCleanup(m_inc); // 自动清理
    }

    int32_t m_counter{};
    Microsoft::UI::Xaml::Input::ICommand m_inc{ nullptr };
};
```
我们提供的方法采用 C++/WinRT 标准的链式调用风格，并支持缺省方法，你可用省略不需要的命令配置，例如不需要 `CanExecute`，则省略即可。
### 3.2 接入到 View（XAML）
服务定位器（Locator）是一个可选的辅助类，方便集中管理 VM 实例的创建与生命周期。你也可以直接在页面里 new VM 实例，然后在页面销毁时调用 `FrameworkCleanup()`。（服务定位器模式）确保 VM 析构时调用 `FrameworkCleanup()` ，否则可能会存在命令/订阅泄漏，我们提供了自动的生命周期管理（存疑）
- 建议通过 `ViewModels/Locator` 提供 VM 实例：

```cpp
// code-behind（C++/WinRT）
#include "ViewModels/Locator.h"
auto vm = winrt::WinUI3MVVMSample1::ViewModels::Locator::MyEntity();
myPage.DataContext(vm);
```

- XAML 绑定：

```xml
<TextBlock Text="{Binding Counter}"/>
<Button Content="Inc" Command="{Binding IncCommand}"/>
```

### 3.3 异步保存命令（最常用的）

```cpp
m_save = ::mvvm::AsyncCommandBuilder<void>(*this)
    .ExecuteAsync([this]() -> IAsyncAction { co_await DoSaveAsync(); })
    .CanExecute([this](){ return IsValid() && !IsBusy(); })
    .DependsOn(L"IsValid").DependsOn(L"IsBusy")
    .Build();
RegisterForAutoCleanup(m_save);
```

## 4. 属性与通知

### 4.1 基本属性
- 读取用 `GetProperty(field)`
- 赋值用 `SetProperty(field, value, L"PropertyName")`
- 自动触发 `PropertyChanged`（UI 刷新）

### 4.2 属性依赖广播
- 当一个属性变化时，自动广播其它依赖它的属性（例如 `FullName` 依赖 `FirstName/LastName`）

```cpp
RegisterDependency(L"FirstName", { L"FullName" });
RegisterDependency(L"LastName",  { L"FullName" });
```

### 4.3 线程感知（读/写 UI 属性更安全）
- `ViewModelBase` 在非 UI 线程调用 Get/SetProperty 时，会使用 `DispatcherQueue` 回到 UI 线程执行
- 保障“从后台线程更新 UI 绑定属性”不崩溃


## 5. 命令（同步/异步）与依赖

### 5.1 同步命令（DelegateCommand）
>同步命令是阻塞式命令，按照 WinRT 建议，不应在 UI 线程执行耗时操作，否则会卡死 UI。对于耗时操作，推荐使用异步命令。

创建方式（四选一）：
- 方式1：直接 `make<DelegateCommand>`（需要手动 `RaiseCanExecuteChangedEvent`）
- 方式2：构造时绑定依赖/自动执行条件
- 方式3：先构造，再通过 `AddRelayDependency` / `AddAutoExecute`（对应 API 见 Builder 简化）
- 方式4：推荐：`DelegateCommandBuilder`（最简）

方式 4 示例（优先推荐）：

```cpp
m_reset = ::mvvm::DelegateCommandBuilder<IInspectable>(*this)
    .Execute([this](auto&&){ MyProperty(0); })
    .CanExecute([this](auto&&){ return MyProperty() > 0; })
    .DependsOn(L"MyProperty",
        [this](auto&&, auto&&){ return MyProperty()==0 || MyProperty()==1; }, // 触发重新评估条件
        [this](auto&&){ return MyProperty() >= 10; }) // 自动执行条件
    .Build();
RegisterForAutoCleanup(m_reset);
```

内部的依赖说明（内部实现参考）：
- RelayDependencyCondition：属性变化后“是否需要重新评估 CanExecute”
- AutoExecuteCondition：属性变化后“是否自动执行 Execute”

### 5.2 异步命令（AsyncDelegateCommand）
我们希望你在使用异步命令前阅读学习 WinRT 的异步编程模型，必读文档：
- [Microsoft Docs - Concurrency and asynchronous operations with C++/WinRT](https://learn.microsoft.com/en-us/windows/uwp/cpp-and-winrt-apis/concurrency)
- [Advanced concurrency and asynchrony with C++/WinRT](https://learn.microsoft.com/en-us/windows/uwp/cpp-and-winrt-apis/concurrency-2)

>异步命令适用于需要执行异步操作的场景，例如网络请求、文件读写等。异步命令不会阻塞 UI 线程，确保应用保持响应。
- `Execute` 内部会使用你提供的 `IAsyncAction`/`IAsyncOperation<T>`返回，并自动管理 `IsRunning`、`CanExecute` 等
- 支持取消：`Cancel()`（内部调用 `IAsyncAction::Cancel()`）
- 可重入控制：`AllowReentrancy(bool)`
- Builder可用版本：`AsyncCommandBuilder`/`AsyncCommandBuilderR<TParam,TResult>`

基础用法：

```cpp
m_async = ::mvvm::AsyncCommandBuilder<void>(*this)
    .ExecuteAsync([this]() -> IAsyncAction { co_await DoWorkAsync(); })
    .CanExecute([this](){ return !IsBusy(); })
    .DependsOn(L"IsBusy")
    .Build();
```

订阅命令事件（调试/业务回调）：

```cpp
if (auto dc = m_reset.try_as< ::mvvm::DelegateCommand<IInspectable> >())
{
    dc->CanExecuteRequested(...);
    dc->CanExecuteCompleted(...);
    dc->ExecuteRequested(...);
    dc->ExecuteCompleted(...);
}

if (auto ac = m_async.try_as< ::mvvm::AsyncDelegateCommand<> >())
{
    ac->ExecuteCompleted([weak=this->get_weak()](auto&&, Mvvm::Framework::Core::ExecuteCompletedEventArgs const& e){ ... });
}
```

## 6. 校验（Validation）与错误提示

- 添加校验器：`AddValidator<T>(L"Prop", [](T v)->optional<hstring>{ ... })`
- 赋值并校验：`SetPropertyValidate(field, value, L"Prop")`
- 错误收集：`GetValidateErrors(L"Prop")`，是否有错：`HasValidateErrors([prop])`
- 事件：`ValidationRequested`/`ValidationCompleted`/`ErrorsChanged`

示例：

```cpp
AddValidator<int>(L"Age", [this](int v)->std::optional<hstring>
{
    if (!m_service->ValidateAge(v)) return hstring{ L"Age must be in [0, 130]." };
    return std::nullopt;
});

if (!SetPropertyValidate(m_age, v, L"Age"))
{
    auto errs = GetValidateErrors(L"Age");
    // 拼接错误展示到 AgeErrorsText
}
```

## 7. 线程与 UI 调度（DispatcherQueue）

- VM 构造必须在 UI 线程（否则抛 `hresult_wrong_thread`）
- 异步里切回 UI：建议 `co_await wil::resume_foreground(m_ui);`
- `ViewModelBase` 的 Get/SetProperty 在非 UI 线程也能安全回 UI 执行

示例：

```cpp
IAsyncAction DoSaveAsync()
{
    if (m_ui) co_await wil::resume_foreground(m_ui);
    IsBusy(true);
    StatusText(L"Saving...");

    co_await m_service->SaveAsync(m_cancelRequested);

    if (m_ui) co_await wil::resume_foreground(m_ui);
    StatusText(L"Save completed.");
    IsBusy(false);
}
```

## 8. 生命周期与清理（Cleanup）

- 将命令/订阅注册进自动清理：`RegisterForAutoCleanup(obj)`
- 框架清理入口：`IViewModelCleanup::FrameworkCleanup()`
  - 取消/解绑命令依赖、清空订阅、重置处理器
  - 清理 VM 自身的校验器与依赖广播
- 示例中通过 `Locator::ResetViewModel(vm)` 调用清理

注意：异步命令可 `Cancel()`，同步命令的 `Cancel()` 为“清空事件”用途

## 9. XAML 绑定与页面接入

- 通过 `Locator` 获取 VM，并设置到 `Page/DataContext`
- XAML 按常规 `Binding`
- 导航离开/页面销毁时，调用 `Locator::ResetViewModel(vm)` 或在自定义生命周期中触发 `FrameworkCleanup`

## 10. 常见问题（FAQ）

Q1：为什么在后台线程改 VM 属性也能更新 UI？
A：`ViewModelBase` 封装了 `DispatcherQueue`，在非 UI 线程调用 Get/SetProperty 会切回 UI 线程执行。

Q2：命令没刷新 CanExecute？
A：确保使用 `DependsOn(L"Prop")` 或属性变更后手动 `RaiseCanExecuteChangedEvent()`。

Q3：异步取消为什么错误码是 0x800704C7？
A：框架统一把取消映射为 `HRESULT_FROM_WIN32(ERROR_CANCELLED)`，便于 UI 识别。

Q4：如何避免事件/订阅泄漏？
A：对命令和其它 `INotifyPropertyChanged` 订阅使用 `RegisterForAutoCleanup`，并在 `FrameworkCleanup()` 阶段自动解绑、清空。

Q5: 可不可以不使用 Locator？
A: 可以。你可以直接在页面里 new VM 实例，然后在页面销毁时调用 `FrameworkCleanup()`。
**欢迎你对反馈和建议！如果你在使用中遇到任何问题，或者有改进建议，请提出 issue.**