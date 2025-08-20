# WinUI 3 C++/WinRT 高级数据绑定与 MVVM 架构实践（第 1 篇：核心基石与基础实现）

> 本篇为 **MVVM 深入实践系列** 的第 1 篇（基础与核心基石）。
> 系列结构：
> 1. 第1篇（当前）：MVVM 分层职责、基础 BaseViewModel / 命令体系 / 基础绑定落地
> 2. 第2篇：高级绑定技巧、值转换 / 多源组合 / 动态资源与主题 / 复杂控件绑定
> 3. 第3篇：异步与任务编排、错误与取消、消息与事件聚合、领域服务注入
> 4. 第4篇：性能优化、诊断调试、测试策略、可扩展项目结构与部署
> 5. 附录合辑：IDL 设计模式库 / 代码骨架模板 / 常见陷阱清单
>
> 若你是第一次阅读，建议与已有基础文档（data-binding-basics / property-change-notification / dependency-attached-properties / interface 等）交叉对照；本系列不再重复那些文件中的已详述段落，而是给出“已讲解位置”索引与在 MVVM 场景下的整合方式。

---

本文档作为前部分《WinUI 3 C++/WinRT 数据绑定与 UI 界面更新详解》的高级补充，深入讲解 MVVM 架构实现、高级绑定技巧、性能优化策略和企业级开发最佳实践。本文档分为多个部分，本部分专注于 MVVM 基础架构和 ViewModel 设计模式。


## 一、MVVM 架构全面解析

### 1. MVVM 架构概念与作用

**MVVM 三层架构：**
```
View (视图层)
├── XAML 文件定义 UI 布局
├── 用户交互事件处理
└── 数据绑定到 ViewModel

ViewModel (视图模型层)
├── 业务逻辑处理
├── 数据状态管理
├── 命令和属性暴露
└── 与 Model 层交互

Model (模型层)
├── 数据实体定义
├── 业务规则实现
├── 数据访问逻辑
└── 与后端服务通信
```

**MVVM 优势详解：**
- **关注点分离**：UI 逻辑与业务逻辑完全分离
- **可测试性**：ViewModel 可独立进行单元测试
- **可维护性**：修改业务逻辑不影响 UI 代码
- **可重用性**：同一 ViewModel 可被多个 View 使用
- **团队协作**：UI 设计师和开发者可并行工作

### 2. WinRT/C++ 中的 MVVM 特殊考虑

> 若不熟悉 WinRT 接口与投影，请先阅读：interface.md；若不熟悉属性通知，请先阅读：property-change-notification.md。

**类型系统要求：**
```cpp
// ViewModel 必须实现的基础接口 (见 property-change-notification.md 已解释事件机制)
struct BaseViewModel : winrt::implements<BaseViewModel, winrt::INotifyPropertyChanged>
{
    winrt::event<winrt::PropertyChangedEventHandler> PropertyChanged;
protected:
    template<typename T>
    bool SetProperty(T& field, T const& value, hstring const& propertyName);
    void RaisePropertyChanged(hstring const& propertyName);
};
```

**IDL 文件结构要求（结合“IDL 放置策略”详见本系列第2篇附加段落，会给完整生成脚手架）：**
```idl
// BaseViewModel.idl - 基类声明（仅需要声明可供绑定的成员；模板/内部帮助函数无需出现在 IDL）
namespace MyApp.ViewModels
{
    [default_interface]
    interface IBaseViewModel : Windows.UI.Xaml.Data.INotifyPropertyChanged
    {
    };
    runtimeclass BaseViewModel : IBaseViewModel
    {
        BaseViewModel();
    };
}

// MainViewModel.idl - 具体 ViewModel (展示“属性 + 集合 + 命令方法”形式)
import "BaseViewModel.idl";
namespace MyApp.ViewModels
{
    runtimeclass MainViewModel : BaseViewModel
    {
        MainViewModel();
        String Title;
        String UserName;
        Int32 Age;
        Boolean IsEnabled;
        Windows.Foundation.Collections.IObservableVector<String> Items{ get; };
        String SelectedItem;
        void AddItemCommand();
        void RemoveItemCommand();
        void ClearItemsCommand();
    };
}
```

> 已讲解：集合接口细节参见 winrt-collections-overview.md；IObservableVector 实践参见 collection-binding.md。

---

## 二、BaseViewModel 基类设计与实现

### 1. 完整 BaseViewModel 实现

**BaseViewModel.h 头文件：**
```cpp
#pragma once
#include "BaseViewModel.g.h"

namespace winrt::MyApp::ViewModels::implementation
{
    struct BaseViewModel : BaseViewModelT<BaseViewModel>
    {
        BaseViewModel() = default;
        virtual ~BaseViewModel() = default;

        // INotifyPropertyChanged 实现
        winrt::event<winrt::PropertyChangedEventHandler> PropertyChanged;

    protected:
        // 设置属性值并触发通知的通用方法
        template<typename T>
        bool SetProperty(T& field, T const& value, hstring const& propertyName)
        {
            // 检查值是否真正改变
            if constexpr (std::is_same_v<T, hstring>)
            {
                // 字符串比较
                if (field == value)
                    return false;
            }
            else if constexpr (std::is_floating_point_v<T>)
            {
                // 浮点数比较（考虑精度）
                if (std::abs(field - value) < std::numeric_limits<T>::epsilon())
                    return false;
            }
            else
            {
                // 其他类型直接比较
                if (field == value)
                    return false;
            }

            // 更新值并触发通知
            field = value;
            RaisePropertyChanged(propertyName);
            return true;
        }

        // 触发属性变化通知
        void RaisePropertyChanged(hstring const& propertyName)
        {
            PropertyChanged(*this, winrt::PropertyChangedEventArgs{ propertyName });
        }

        // 批量属性通知
        void RaisePropertyChanged(std::initializer_list<hstring> propertyNames)
        {
            for (auto const& name : propertyNames)
            {
                PropertyChanged(*this, winrt::PropertyChangedEventArgs{ name });
            }
        }

        // 条件属性通知
        void RaisePropertyChangedIf(bool condition, hstring const& propertyName)
        {
            if (condition)
            {
                RaisePropertyChanged(propertyName);
            }
        }
    };
}

// 工厂声明
namespace winrt::MyApp::ViewModels::factory_implementation
{
    struct BaseViewModel : BaseViewModelT<BaseViewModel, implementation::BaseViewModel>
    {
    };
}
```

**BaseViewModel.cpp 实现文件：**
```cpp
#include "pch.h"
#include "BaseViewModel.h"
#include "BaseViewModel.g.cpp"

namespace winrt::MyApp::ViewModels::implementation
{
    // BaseViewModel 实现已在头文件中完成（模板方法）
    // 如需额外实现，可在此处添加
}
```

### 2. 属性设置的最佳实践

**类型安全的属性设置：**
```cpp
// 字符串属性示例
class PersonViewModel : public BaseViewModel
{
private:
    hstring m_name{ L"" };
    int32_t m_age{ 0 };
    double m_salary{ 0.0 };
    bool m_isActive{ false };

public:
    // 字符串属性
    hstring Name() const { return m_name; }
    void Name(hstring const& value)
    {
        SetProperty(m_name, value, L"Name");
    }

    // 整数属性
    int32_t Age() const { return m_age; }
    void Age(int32_t value)
    {
        if (SetProperty(m_age, value, L"Age"))
        {
            // 年龄变化时，同时通知相关属性
            RaisePropertyChanged({ L"IsAdult", L"AgeGroup" });
        }
    }

    // 浮点数属性
    double Salary() const { return m_salary; }
    void Salary(double value)
    {
        SetProperty(m_salary, value, L"Salary");
    }

    // 布尔属性
    bool IsActive() const { return m_isActive; }
    void IsActive(bool value)
    {
        SetProperty(m_isActive, value, L"IsActive");
    }

    // 计算属性（只读）
    bool IsAdult() const { return m_age >= 18; }
    hstring AgeGroup() const
    {
        if (m_age < 18) return L"未成年";
        else if (m_age < 60) return L"成年";
        else return L"老年";
    }
};
```

### 3. 集合属性的高级处理

**可观察集合的创建和管理：**
```cpp
class CollectionViewModel : public BaseViewModel
{
private:
    winrt::Windows::Foundation::Collections::IObservableVector<hstring> m_items{
        winrt::single_threaded_observable_vector<hstring>()
    };
    hstring m_selectedItem{ L"" };
    int32_t m_selectedIndex{ -1 };

public:
    // 集合属性
    winrt::Windows::Foundation::Collections::IObservableVector<hstring> Items() const
    {
        return m_items;
    }

    // 选中项属性
    hstring SelectedItem() const { return m_selectedItem; }
    void SelectedItem(hstring const& value)
    {
        if (SetProperty(m_selectedItem, value, L"SelectedItem"))
        {
            // 更新选中索引
            UpdateSelectedIndex();
        }
    }

    // 选中索引属性
    int32_t SelectedIndex() const { return m_selectedIndex; }
    void SelectedIndex(int32_t value)
    {
        if (SetProperty(m_selectedIndex, value, L"SelectedIndex"))
        {
            // 更新选中项
            UpdateSelectedItem();
        }
    }

    // 只读属性：项目数量
    uint32_t ItemCount() const { return m_items.Size(); }

    // 只读属性：是否有选中项
    bool HasSelection() const { return !m_selectedItem.empty(); }

private:
    void UpdateSelectedIndex()
    {
        int32_t newIndex = -1;
        for (uint32_t i = 0; i < m_items.Size(); ++i)
        {
            if (m_items.GetAt(i) == m_selectedItem)
            {
                newIndex = static_cast<int32_t>(i);
                break;
            }
        }
        
        if (m_selectedIndex != newIndex)
        {
            m_selectedIndex = newIndex;
            RaisePropertyChanged(L"SelectedIndex");
        }
    }

    void UpdateSelectedItem()
    {
        hstring newItem{ L"" };
        if (m_selectedIndex >= 0 && m_selectedIndex < static_cast<int32_t>(m_items.Size()))
        {
            newItem = m_items.GetAt(static_cast<uint32_t>(m_selectedIndex));
        }

        if (m_selectedItem != newItem)
        {
            m_selectedItem = newItem;
            RaisePropertyChanged(L"SelectedItem");
        }
    }
};
```

---

## 三、命令模式实现（ICommand 接口）

### 1. RelayCommand 基础实现

**ICommand 接口的 C++/WinRT 实现：**
```cpp
// RelayCommand.h
#pragma once
#include "pch.h"

namespace winrt::MyApp::Commands::implementation
{
    struct RelayCommand : winrt::implements<RelayCommand, winrt::ICommand>
    {
        using ExecuteAction = std::function<void()>;
        using CanExecuteFunc = std::function<bool()>;

        // 构造函数
        RelayCommand(ExecuteAction execute)
            : m_execute(std::move(execute)), m_canExecute(nullptr) {}

        RelayCommand(ExecuteAction execute, CanExecuteFunc canExecute)
            : m_execute(std::move(execute)), m_canExecute(std::move(canExecute)) {}

        // ICommand 接口实现
        bool CanExecute(winrt::IInspectable const& parameter)
        {
            // 忽略参数，使用内部 CanExecute 函数
            return m_canExecute ? m_canExecute() : true;
        }

        void Execute(winrt::IInspectable const& parameter)
        {
            // 忽略参数，使用内部 Execute 函数
            if (CanExecute(parameter))
            {
                m_execute();
            }
        }

        // CanExecuteChanged 事件
        winrt::event<winrt::EventHandler<winrt::IInspectable>> CanExecuteChanged;

        // 手动触发 CanExecute 状态变化
        void NotifyCanExecuteChanged()
        {
            CanExecuteChanged(*this, nullptr);
        }

    private:
        ExecuteAction m_execute;
        CanExecuteFunc m_canExecute;
    };
}
```

### 2. 带参数的命令实现

**支持参数的 RelayCommand：**
```cpp
// ParameterizedRelayCommand.h
namespace winrt::MyApp::Commands::implementation
{
    template<typename TParameter>
    struct ParameterizedRelayCommand : winrt::implements<ParameterizedRelayCommand<TParameter>, winrt::ICommand>
    {
        using ExecuteAction = std::function<void(TParameter)>;
        using CanExecuteFunc = std::function<bool(TParameter)>;

        ParameterizedRelayCommand(ExecuteAction execute)
            : m_execute(std::move(execute)), m_canExecute(nullptr) {}

        ParameterizedRelayCommand(ExecuteAction execute, CanExecuteFunc canExecute)
            : m_execute(std::move(execute)), m_canExecute(std::move(canExecute)) {}

        bool CanExecute(winrt::IInspectable const& parameter)
        {
            try
            {
                if (parameter)
                {
                    auto typedParam = winrt::unbox_value<TParameter>(parameter);
                    return m_canExecute ? m_canExecute(typedParam) : true;
                }
                return m_canExecute ? m_canExecute(TParameter{}) : true;
            }
            catch (...)
            {
                return false;
            }
        }

        void Execute(winrt::IInspectable const& parameter)
        {
            if (CanExecute(parameter))
            {
                try
                {
                    if (parameter)
                    {
                        auto typedParam = winrt::unbox_value<TParameter>(parameter);
                        m_execute(typedParam);
                    }
                    else
                    {
                        m_execute(TParameter{});
                    }
                }
                catch (...)
                {
                    // 处理参数转换错误
                }
            }
        }

        winrt::event<winrt::EventHandler<winrt::IInspectable>> CanExecuteChanged;

        void NotifyCanExecuteChanged()
        {
            CanExecuteChanged(*this, nullptr);
        }

    private:
        ExecuteAction m_execute;
        CanExecuteFunc m_canExecute;
    };
}
```

### 3. ViewModel 中的命令使用

**在 ViewModel 中集成命令：**
```cpp
class MainViewModel : public BaseViewModel
{
private:
    // 数据
    winrt::Windows::Foundation::Collections::IObservableVector<hstring> m_items{
        winrt::single_threaded_observable_vector<hstring>()
    };
    hstring m_selectedItem{ L"" };
    hstring m_newItemText{ L"" };
    
    // 命令
    winrt::ICommand m_addCommand{ nullptr };
    winrt::ICommand m_removeCommand{ nullptr };
    winrt::ICommand m_clearCommand{ nullptr };

public:
    MainViewModel()
    {
        InitializeCommands();
        InitializeData();
    }

    // 属性
    auto Items() const { return m_items; }
    
    hstring SelectedItem() const { return m_selectedItem; }
    void SelectedItem(hstring const& value)
    {
        if (SetProperty(m_selectedItem, value, L"SelectedItem"))
        {
            // 选中项变化时，更新命令状态
            UpdateCommandStates();
        }
    }

    hstring NewItemText() const { return m_newItemText; }
    void NewItemText(hstring const& value)
    {
        if (SetProperty(m_newItemText, value, L"NewItemText"))
        {
            UpdateCommandStates();
        }
    }

    // 命令属性
    winrt::ICommand AddCommand() const { return m_addCommand; }
    winrt::ICommand RemoveCommand() const { return m_removeCommand; }
    winrt::ICommand ClearCommand() const { return m_clearCommand; }

private:
    void InitializeCommands()
    {
        // 添加命令
        m_addCommand = winrt::make<Commands::implementation::RelayCommand>(
            [this]() { ExecuteAddItem(); },
            [this]() { return CanAddItem(); }
        );

        // 删除命令
        m_removeCommand = winrt::make<Commands::implementation::RelayCommand>(
            [this]() { ExecuteRemoveItem(); },
            [this]() { return CanRemoveItem(); }
        );

        // 清空命令
        m_clearCommand = winrt::make<Commands::implementation::RelayCommand>(
            [this]() { ExecuteClearItems(); },
            [this]() { return CanClearItems(); }
        );
    }

    void InitializeData()
    {
        m_items.Append(L"初始项目 1");
        m_items.Append(L"初始项目 2");
        m_items.Append(L"初始项目 3");
    }

    // 命令执行方法
    void ExecuteAddItem()
    {
        if (!m_newItemText.empty())
        {
            m_items.Append(m_newItemText);
            NewItemText(L""); // 清空输入框
        }
    }

    void ExecuteRemoveItem()
    {
        if (!m_selectedItem.empty())
        {
            // 查找并删除选中项
            for (uint32_t i = 0; i < m_items.Size(); ++i)
            {
                if (m_items.GetAt(i) == m_selectedItem)
                {
                    m_items.RemoveAt(i);
                    SelectedItem(L""); // 清空选中项
                    break;
                }
            }
        }
    }

    void ExecuteClearItems()
    {
        m_items.Clear();
        SelectedItem(L"");
    }

    // 命令可执行性检查
    bool CanAddItem() const
    {
        return !m_newItemText.empty();
    }

    bool CanRemoveItem() const
    {
        return !m_selectedItem.empty();
    }

    bool CanClearItems() const
    {
        return m_items.Size() > 0;
    }

    // 更新所有命令状态
    void UpdateCommandStates()
    {
        if (auto addCmd = m_addCommand.try_as<Commands::implementation::RelayCommand>())
            addCmd->NotifyCanExecuteChanged();
        
        if (auto removeCmd = m_removeCommand.try_as<Commands::implementation::RelayCommand>())
            removeCmd->NotifyCanExecuteChanged();
        
        if (auto clearCmd = m_clearCommand.try_as<Commands::implementation::RelayCommand>())
            clearCmd->NotifyCanExecuteChanged();
    }
};
```

---

## 四、View 与 ViewModel 的绑定实现

### 1. XAML 中的完整绑定语法

**MainWindow.xaml 布局文件：**
```xml
<Window x:Class="MyApp.MainWindow"
        xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        xmlns:viewmodels="using:MyApp.ViewModels">

    <!-- 设置 DataContext 为 ViewModel -->
    <Window.DataContext>
        <viewmodels:MainViewModel/>
    </Window.DataContext>

    <Grid Padding="20">
        <Grid.RowDefinitions>
            <RowDefinition Height="Auto"/>
            <RowDefinition Height="Auto"/>
            <RowDefinition Height="*"/>
            <RowDefinition Height="Auto"/>
            <RowDefinition Height="Auto"/>
        </Grid.RowDefinitions>

        <!-- 标题区域 -->
        <TextBlock Grid.Row="0"
                   Text="MVVM 数据绑定示例"
                   FontSize="24"
                   FontWeight="Bold"
                   Margin="0,0,0,20"/>

        <!-- 输入区域 -->
        <StackPanel Grid.Row="1" Orientation="Horizontal" Spacing="10" Margin="0,0,0,10">
            <TextBox PlaceholderText="输入新项目"
                     Text="{x:Bind ViewModel.NewItemText, Mode=TwoWay}"
                     Width="200"/>
            <Button Content="添加"
                    Command="{x:Bind ViewModel.AddCommand}"/>
        </StackPanel>

        <!-- 列表区域 -->
        <ListView Grid.Row="2"
                  ItemsSource="{x:Bind ViewModel.Items}"
                  SelectedItem="{x:Bind ViewModel.SelectedItem, Mode=TwoWay}"
                  Margin="0,0,0,10">
            <ListView.ItemTemplate>
                <DataTemplate x:DataType="x:String">
                    <TextBlock Text="{x:Bind}" Padding="10,5"/>
                </DataTemplate>
            </ListView.ItemTemplate>
        </ListView>

        <!-- 操作按钮区域 -->
        <StackPanel Grid.Row="3" Orientation="Horizontal" Spacing="10" Margin="0,0,0,10">
            <Button Content="删除选中项"
                    Command="{x:Bind ViewModel.RemoveCommand}"/>
            <Button Content="清空列表"
                    Command="{x:Bind ViewModel.ClearCommand}"/>
        </StackPanel>

        <!-- 状态显示区域 -->
        <TextBlock Grid.Row="4"
                   Text="{x:Bind StatusText, Mode=OneWay}"
                   Foreground="Gray"/>
    </Grid>
</Window>
```

### 2. Code-Behind 的最小化实现

**MainWindow.xaml.h 头文件：**
```cpp
#pragma once
#include "MainWindow.g.h"
#include "ViewModels/MainViewModel.h"

namespace winrt::MyApp::implementation
{
    struct MainWindow : MainWindowT<MainWindow>
    {
        MainWindow();

        // ViewModel 属性
        MyApp::ViewModels::MainViewModel ViewModel();

        // 状态文本（计算属性）
        hstring StatusText();

    private:
        MyApp::ViewModels::MainViewModel m_viewModel{ nullptr };
        winrt::event_token m_propertyChangedToken{};

        // 事件处理
        void OnViewModelPropertyChanged(
            winrt::IInspectable const& sender,
            winrt::PropertyChangedEventArgs const& args);
    };
}
```

**MainWindow.xaml.cpp 实现文件：**
```cpp
#include "pch.h"
#include "MainWindow.xaml.h"
#include "MainWindow.g.cpp"

namespace winrt::MyApp::implementation
{
    MainWindow::MainWindow()
    {
        InitializeComponent();
        
        // 创建 ViewModel 实例
        m_viewModel = winrt::make<ViewModels::implementation::MainViewModel>();
        
        // 订阅 ViewModel 属性变化事件
        m_propertyChangedToken = m_viewModel.PropertyChanged(
            { this, &MainWindow::OnViewModelPropertyChanged }
        );
    }

    MyApp::ViewModels::MainViewModel MainWindow::ViewModel()
    {
        return m_viewModel;
    }

    hstring MainWindow::StatusText()
    {
        if (!m_viewModel)
            return L"正在初始化...";

        auto itemCount = m_viewModel.Items().Size();
        auto selectedItem = m_viewModel.SelectedItem();

        if (selectedItem.empty())
        {
            return L"共 " + winrt::to_hstring(itemCount) + L" 项，未选中任何项目";
        }
        else
        {
            return L"共 " + winrt::to_hstring(itemCount) + L" 项，已选中：" + selectedItem;
        }
    }

    void MainWindow::OnViewModelPropertyChanged(
        winrt::IInspectable const&,
        winrt::PropertyChangedEventArgs const& args)
    {
        auto propertyName = args.PropertyName();
        
        // 当影响状态文本的属性变化时，触发状态文本更新
        if (propertyName == L"SelectedItem")
        {
            // 通知 UI 更新状态文本
            if (auto bindingSource = this->try_as<winrt::INotifyPropertyChanged>())
            {
                // 如果 MainWindow 也实现了 INotifyPropertyChanged
                // 这里可以触发 StatusText 属性的更新通知
            }
        }
    }
}
```

## 衔接说明（系列后续篇章导航）

| 主题 | 下一篇位置 | 本篇铺垫点 |
|------|------------|------------|
| 高级绑定与多源/转换 | 第2篇 §2/§3 | SetProperty / 基础命令 |
| 复杂控件（TreeView / Grid / DataGrid 绑定策略） | 第2篇 §4 | Observable 集合骨架 |
| 值转换、格式化、合成属性缓存 | 第2篇 §3 | 计算属性示例 |
| 异步加载 / 取消 / 超时封装 | 第3篇 §1/§2 | RelayCommand 基础 |
| 域服务注入 / DI 容器 | 第3篇 §4 | ViewModel 构造形式 |
| 全局消息事件聚合器 | 第3篇 §5 | PropertyChanged 事件模式 |
| 性能（批量通知 / 虚拟化 / 协程分层） | 第4篇 §1/§2 | SetProperty/集合策略 |
| 测试（金字塔 / Mock Service / UI smoke） | 第4篇 §4 | 基类解耦 |
| 部署与结构化目录 | 第4篇 §5 | IDL 拆分策略 |

> 继续阅读：请打开即将新增的 `winui3-mvvm-part2-advanced-binding.md`。

---

（第一篇完）