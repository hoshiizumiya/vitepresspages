# WinUI3 C++/WinRT MVVM Framework API 参考

本手册列出 mvvm_framework 的主要类型与成员，给出调用方式与注意事项。  
⚠️ 注意：当前 MVVM 辅助框架随时更新，本文档内容可能存在错误，可能会随着框架更新而变化，最新内容请参考 MVVM 源码。
目录：
- A. 属性与通知：`WrapNotifyPropertyChanged<T>` / `ViewModelBase<T>` / `ViewModel<T>`
- B. 命令（同步）：`DelegateCommand<TParameter>` 与 `DelegateCommandBuilder<T>`
- C. 命令（异步）：`AsyncDelegateCommand<T>` / `AsyncDelegateCommandR<T,TResult>` 与 Builder
- D. 事件模型（命令/校验）：IDL 类型
- E. 属性宏与辅助：`property_macros.h`、`name_of.h`、`mvvm_hresult_helper.h`
- F. 订阅与清理：`ICommandCleanup`、`IViewModelCleanup`、`IAutoCleanupRegister`、`SubscriptionTracker`


## A. 属性与通知

### A.1 `mvvm::WrapNotifyPropertyChanged<Derived>`
- 能力：
  - `PropertyChanged` 事件（INotifyPropertyChanged）
  - 属性读取/写入封装：`GetProperty`/`SetProperty`/`SetPropertyNoCompare` 等
  - 依赖广播：`RegisterDependency`、`RaisePropertyChangedBroadcast`
  - 校验：`AddValidator<T>`、`SetPropertyValidate`、`GetValidateErrors`、`ErrorsChanged` 等
- 用法要点：
  - 写属性时必须传递属性名（或列表）以触发通知：`SetProperty(field, value, L"Name")`
  - 依赖广播能把“源属性变化”扩散为多个属性变更事件
  - 校验器返回 `optional<hstring>`，有值表示错误

常用成员：
- 事件：`PropertyChanged`、`ValidationRequested`、`ValidationCompleted`、`ErrorsChanged`
- Get：`Value GetProperty(Value const&)`
- Set：
  - `bool SetProperty(field, newValue)`（不通知）
  - `bool SetProperty(field, newValue, L"Prop")`（通知）
  - `bool SetProperty(field, newValue, oldValue, L"Prop")`（回调前拿旧值）
  - `void SetPropertyNoCompare(field, newValue, L"Prop")`（无比较强制通知）
  - `bool SetPropertyValidate(field, newValue, L"Prop", commitOnInvalid=false)`
- 依赖：`RegisterDependency(source, dependents)`/`RegisterDependency(source, dependent)`/`ClearDependencies()`
- 校验：`AddValidator<T>(prop, fn)`/`GetValidateErrors(prop)`/`HasValidateErrors([prop])`/`ClearValidators*`

### A.2 `mvvm::ViewModelBase<Derived>`
- 在非 UI 线程调用 Set/GetProperty 时，自动切回 UI `DispatcherQueue` 执行（同步等候）
- `HasThreadAccess()` 判断当前线程是否为 UI 线程
- `IsThreadAccessible()` 在非 UI 线程调用会抛错（可用于调试）

### A.3 `mvvm::ViewModel<Derived>`
- 构造必须在 UI 线程（内部要求有 `DispatcherQueue`）
- 成员：
  - `Dispatcher()`/`GetDispatcherOverride()`
  - `RegisterForAutoCleanup(IInspectable)`：把命令/订阅交给框架统一清理
  - `FrameworkCleanup()`：取消命令、解绑依赖、清空订阅、清理校验与依赖广播
  - `TrackUnbind(F&&)`/`UnbindAll()`：可注册额外清理回调


## B. 命令（同步）

类型：`mvvm::DelegateCommand<TParameter>`
- `ICommand` 实现，支持：
  - `Execute`/`CanExecute` 与 `CanExecuteChanged`
  - 依赖属性变更触发 `CanExecuteChanged`（RelayDependency）
  - 条件满足自动执行（AutoExecute）
  - 执行/判定事件：`CanExecuteRequested/Completed`、`ExecuteRequested/Completed`
  - 清理接口：`ICommandCleanup`（Detach/Clear/Reset/Cancel）

构造方式：
- 直接构造：`make<DelegateCommand<T>>(execute, canExecute)`
- 绑定依赖：`DelegateCommand(notifier, exec, can, vector<DependencyRegistration>)`
- Builder：`DelegateCommandBuilder<T>`（推荐）

核心 API：
- 事件：
  - `event_token CanExecuteChanged(handler)`/`CanExecuteChanged(token)`
  - `event_token CanExecuteRequested(handler)`/`CanExecuteRequested(token)`
  - `event_token CanExecuteCompleted(handler)`/`CanExecuteCompleted(token)`
  - `event_token ExecuteRequested(handler)`/`ExecuteRequested(token)`
  - `event_token ExecuteCompleted(handler)`/`ExecuteCompleted(token)`
- 依赖：
  - `AttachProperty(notifier, propertyName, RelayDependencyCondition)`
  - `RegisterAutoExecuteCond(notifier, AutoExecuteCondition)`
  - `AttachDependencies(notifier, vector<DependencyRegistration>)`
  - `DetachRelayDependencies()`/`DetachAutoExecuteDependencies()`/`DetachAllDependencies()`/`DetachFrom()`/`PruneExpiredDependencies()`
- 其它：`RaiseCanExecuteChangedEvent()`、`ResetHandlers()`、`ClearAllSubscribers()`、`HasDependencies()`

Builder：`DelegateCommandBuilder<TParam>`
- `Execute(fn)`/`CanExecute(fn)`
- `DependsOn(L"Prop", relayCond, autoExecCond)`（可多次调用）
- `Build()` 返回 `ICommand`

参数适配规则：
- `TParam=void`：`Execute()`/`CanExecute()` 无参
- `TParam=IInspectable`：原样传入 XAML 参数
- 其它类型：框架尝试 `try_as<T>()` 或 `unbox_value_or<T>(param,{})`

## C. 命令（异步）

类型：
- `mvvm::AsyncDelegateCommand<TParam>` -> `IAsyncAction`
- `mvvm::AsyncDelegateCommandR<TParam,TResult>` -> `IAsyncOperation<TResult>`

能力：
- 运行中 `IsRunning=true`，自动触发 `CanExecuteChanged`
- 允许设置是否可重入：`AllowReentrancy(bool)`
- 取消：`Cancel()`（调用底层异步的 `Cancel`）
- 同步事件模型：`CanExecute*`、`Execute*`

Builder：
- `AsyncCommandBuilder<TParam>`（无返回）
- `AsyncCommandBuilderR<TParam,TResult>`（有返回）

使用：

```cpp
m_cmd = ::mvvm::AsyncCommandBuilder<void>(*this)
  .ExecuteAsync([this]() -> IAsyncAction { co_await Something(); })
  .CanExecute([this](){ return !IsBusy(); })
  .DependsOn(L"IsBusy")
  .Build();
```

事件：
- `ExecuteCompleted` 提供 `ExecuteCompletedEventArgs(parameter, hresult)`
  - 取消：错误码等于 `mvvm::HResultHelper::hresult_error_fCanceled()`

## D. 事件模型（IDL）

IDL 文件：`mvvm_framework_events.idl`/`mvvm_framework_inf.idl`

- CanExecuteRequestedEventArgs(Object Parameter, bool Handled)
- CanExecuteCompletedEventArgs(Object Parameter, bool Result)
- ExecuteRequestedEventArgs(Object Parameter)
- ExecuteCompletedEventArgs(Object Parameter, Int32 hresult)
  - `Succeeded`：`hresult >= 0`
  - `Error`：hresult

校验相关：
- ValidationRequestedEventArgs(String PropertyName, Object NewValue, bool Handled, bool Cancel)
- ValidationCompletedEventArgs(String PropertyName, Object NewValue, bool IsValid, IVectorView<String> Errors)
- ValidationErrorsChangedEventArgs(String PropertyName, IVectorView<String> Errors)

接口：
- ICommandCleanup：`DetachAllDependencies()`、`ClearAllSubscribers()`、`ResetHandlers()`、`Cancel()`
- IViewModelCleanup：`FrameworkCleanup()`
- IAutoCleanupRegister：`RegisterForAutoCleanup(Object obj)`

## E. 属性宏与辅助

E.1 `property_macros.h`
- 快速生成属性样板代码：
  - `DEFINE_PROPERTY(type, Name, defaultValue)`
  - `DEFINE_PROPERTY_NO_NOTIFY(type, Name, defaultValue)`
  - `DEFINE_PROPERTY_NO_COMPARE(type, Name, defaultValue)`
  - `DEFINE_PROPERTY_CALLBACK(_NO_NOTIFY)`：带 `OnNameChanged(old,new)` 回调
- 宏内部调用框架 `GetProperty/SetProperty`，自动触发 `PropertyChanged`

E.2 `name_of.h`
- `NAME_OF(Type, Member)` -> `L"Member"sv`，减少硬编码

E.3 `mvvm_hresult_helper.h`
- `HResultHelper::hresult_error_fCanceled()`：标准化“取消”错误码（0x800704C7）

## F. 订阅与清理

F.1 生命周期建议
- VM 内部所有命令、外部订阅，构造后调用 `RegisterForAutoCleanup(obj)`
- 页面离开时，调用 `IViewModelCleanup::FrameworkCleanup()`
- 如果使用 `Locator` 缓存 VM，可在 `Locator::ResetViewModel(vm)` 中触发清理

F.2 `SubscriptionTracker`（若使用）
- 用于跟踪自定义订阅，统一在 `UnbindAll()` 释放
- 通过 `TrackUnbind([token, obj]{ obj.Event(token); })` 注册

