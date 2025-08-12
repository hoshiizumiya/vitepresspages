# WinUI 3 WinRT C++ 开发完整教程 - 第二部分：实践开发指南

## 项目创建与配置

### 项目模板结构

WinUI 3 C++ 项目包含以下关键组件：

```
WinUI3App1C++/
├── App.xaml                    # 应用程序定义
├── App.xaml.h/cpp             # 应用程序实现
├── MainWindow.xaml            # 主窗口界面
├── MainWindow.xaml.h/cpp      # 主窗口实现
├── MainWindow.idl             # 主窗口接口定义
├── pch.h                      # 预编译头文件
├── Generated Files/           # 自动生成的代码
├── Assets/                    # 资源文件
└── WinUI3App1C++.vcxproj     # 项目文件
```

### 项目配置要点

大部分内容在使用项目模板创建项目后已经准备好。

####  预编译头文件优化

在 `pch.h` 中包含所有常用的 WinRT 头文件：

```cpp
#pragma once
#include <windows.h>
#include <unknwn.h>
#include <restrictederrorinfo.h>
#include <hstring.h>

// 解决宏冲突
#undef GetCurrentTime
#define _VSDESIGNER_DONT_LOAD_AS_DLL

// WinRT 基础头文件
#include <winrt/Windows.Foundation.h>
#include <winrt/Windows.Foundation.Collections.h>
#include <winrt/Windows.ApplicationModel.Activation.h>

// WinUI 3 核心头文件
#include <winrt/Microsoft.UI.Composition.h>
#include <winrt/Microsoft.UI.Xaml.h>
#include <winrt/Microsoft.UI.Xaml.Controls.h>
#include <winrt/Microsoft.UI.Xaml.Controls.Primitives.h>
#include <winrt/Microsoft.UI.Xaml.Data.h>
#include <winrt/Microsoft.UI.Xaml.Interop.h>
#include <winrt/Microsoft.UI.Xaml.Markup.h>
#include <winrt/Microsoft.UI.Xaml.Media.h>
#include <winrt/Microsoft.UI.Xaml.Navigation.h>
#include <winrt/Microsoft.UI.Xaml.Shapes.h>
#include <winrt/Microsoft.UI.Dispatching.h>

// Windows Implementation Library (WIL)
#include <wil/cppwinrt_helpers.h>
```

## 页面与窗口开发

### 窗口类型

WinUI 3 提供多种窗口类型：

#### 1. 主窗口 (MainWindow)

```cpp
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

**实现要点**：

```cpp
// MainWindow.xaml.h
namespace winrt::WinUI3App1C__::implementation
{
    struct MainWindow : MainWindowT<MainWindow>
    {
    private:
        // 私有成员变量
        int32_t manualIndex = 0;
        winrt::Windows::Foundation::Collections::IObservableVector<hstring> sourceArray{
            winrt::single_threaded_observable_vector<hstring>()
        };
        winrt::Windows::Foundation::Collections::IObservableVector<hstring> boundArray{
            winrt::single_threaded_observable_vector<hstring>()
        };

    public:
        MainWindow();
        
        // 属性访问器
        winrt::Windows::Foundation::Collections::IObservableVector<hstring> collection();
        
        // 事件处理器
        void addManualListButton_Click(
            winrt::Windows::Foundation::IInspectable const& sender,
            winrt::Microsoft::UI::Xaml::RoutedEventArgs const& e);
    };
}
```

#### 2. 自定义窗口 (BlankWindow)

```cpp
// BlankWindow.idl
namespace WinUI3App1C__
{
    [default_interface]
    runtimeclass BlankWindow : Microsoft.UI.Xaml.Window
    {
        BlankWindow();
    }
}
```

**实现特点**：
- 继承自 `Microsoft.UI.Xaml.Window`
- 可以自定义窗口行为
- 支持多窗口应用程序

### 页面开发

#### 1. 基础页面结构

```xml
<!-- SettingsPage.xaml -->
<?xml version="1.0" encoding="utf-8"?>
<Page
    x:Class="WinUI3App1C__.SettingsPage"
    xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
    xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
    xmlns:local="using:WinUI3App1C__"
    xmlns:d="http://schemas.microsoft.com/expression/blend/2008"
    xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"
    mc:Ignorable="d">

    <Grid>
        <!-- 页面内容 -->
    </Grid>
</Page>
```

#### 2. 页面生命周期

```cpp
// UserMainPage.xaml.cpp
namespace winrt::WinUI3App1C__::implementation
{
    void UserMainPage::Page_Loaded(
        winrt::Windows::Foundation::IInspectable const& sender,
        winrt::Microsoft::UI::Xaml::RoutedEventArgs const& e)
    {
        InitializeComponent();
        // 页面加载后的初始化逻辑
        
        // 访问界面元素
        // 设置初始状态
        // 绑定数据源
    }
}
```

**关键生命周期事件**：
- `Loaded`：页面完全加载后触发
- `Unloaded`：页面从视觉树移除时触发
- `SizeChanged`：页面大小改变时触发

## 控件使用与事件处理

### 常用控件

#### 1. Button 控件

```xml
<Button x:Name="addManualListButton" 
        Content="添加项目" 
        Click="addManualListButton_Click"/>
```

```cpp
void MainWindow::addManualListButton_Click(
    winrt::Windows::Foundation::IInspectable const& sender,
    winrt::Microsoft::UI::Xaml::RoutedEventArgs const& e)
{
    manualIndex++;
    manualList().Items().Append(box_value(hstring{L"Item" + to_hstring(manualIndex)}));
    
    if (manualList().SelectedItem() == nullptr)
    {
        manualList().SelectedIndex(0);
    }
}
```

**重要概念**：
- `box_value()`：将 C++ 类型装箱为 WinRT 对象
- `to_hstring()`：将数值转换为 hstring
- 事件参数使用 `const&` 传递避免不必要的复制

#### 2. ListView 控件

```xml
<ListView x:Name="manualList" 
          SelectionMode="Single"
          ItemClick="manualList_ItemClick">
    <ListView.ItemTemplate>
        <DataTemplate>
            <TextBlock Text="{Binding}" />
        </DataTemplate>
    </ListView.ItemTemplate>
</ListView>
```

**程序化操作**：

```cpp
// 添加项目
manualList().Items().Append(box_value(L"新项目"));

// 获取选中项目
auto selectedItem = manualList().SelectedItem();
if (selectedItem != nullptr)
{
    auto text = unbox_value<hstring>(selectedItem);
    // 处理选中的文本
}

// 清空列表
manualList().Items().Clear();
```

#### 3. NavigationView 控件

```xml
<NavigationView x:Name="mainNavigationView"
                ItemInvoked="NavigationView_ItemInvoked">
    <NavigationView.MenuItems>
        <NavigationViewItem Content="首页" Tag="home" Icon="Home"/>
        <NavigationViewItem Content="其他页面" Tag="other" Icon="Document"/>
    </NavigationView.MenuItems>
    
    <Frame x:Name="mainFrame"/>
</NavigationView>
```

```cpp
void UserMainPage::NavigationView_ItemInvoked(
    winrt::Microsoft::UI::Xaml::Controls::NavigationView const& sender,
    winrt::Microsoft::UI::Xaml::Controls::NavigationViewItemInvokedEventArgs const& args)
{
    if (args.IsSettingsInvoked())
    {
        openSettingsPage();
    }
    else
    {
        hstring tag = unbox_value<hstring>(args.InvokedItemContainer().Tag());
        if (tag == L"home")
            openHomePage();
        else if (tag == L"other")
            openOtherPage();
    }
}
```

### 事件处理模式

#### 1. XAML 声明式事件绑定

```xml
<Button Click="Button_Click"/>
```

#### 2. 代码中事件绑定

```cpp
addButton().Click([this](auto&& sender, auto&& args)
{
    // Lambda 表达式事件处理
});

// 或使用成员函数
addButton().Click({this, &MainWindow::OnAddButtonClick});
```

#### 3. 事件参数类型

```cpp
// 标准事件处理器签名
void EventHandler(
    winrt::Windows::Foundation::IInspectable const& sender,    // 发送者
    winrt::Microsoft::UI::Xaml::RoutedEventArgs const& args   // 事件参数
);

// 特定控件事件参数
void SelectionChanged(
    winrt::Windows::Foundation::IInspectable const& sender,
    winrt::Microsoft::UI::Xaml::Controls::SelectionChangedEventArgs const& args
);
```

## 数据绑定深度解析

### 绑定类型

#### 1. 直接代码绑定

```cpp
// 在构造函数或初始化方法中
sourceList().ItemsSource(sourceArray);
```

**优点**：
- 性能最佳
- 编译时类型检查
- 调试友好

**缺点**：
- UI 和逻辑耦合较紧
- 不支持自动更新

#### 2. XAML 数据绑定

```xml
<!-- 属性绑定 -->
<ListView ItemsSource="{x:Bind collection}"/>

<!-- 双向绑定 -->
<TextBox Text="{x:Bind UserName, Mode=TwoWay}"/>

<!-- 函数绑定 -->
<TextBlock Text="{x:Bind FormatText(ItemCount)}"/>
```

对应的 C++ 实现：

```cpp
// IDL 定义
runtimeclass MainWindow : Microsoft.UI.Xaml.Window
{
    Windows.Foundation.Collections.IObservableVector<String> collection{ get; };
    String UserName;
    String FormatText(Int32 count);
}

// 实现
winrt::Windows::Foundation::Collections::IObservableVector<hstring> MainWindow::collection()
{
    return boundArray;
}

hstring MainWindow::FormatText(int32_t count)
{
    return hstring{L"总计: " + to_hstring(count) + L" 项"};
}
```

#### 3. 可观察集合

```cpp
// 创建可观察集合
auto observableVector = winrt::single_threaded_observable_vector<hstring>();

// 添加项目（自动通知 UI）
observableVector.Append(L"新项目");

// 移除项目
observableVector.RemoveAt(index);

// 清空集合
observableVector.Clear();
```

**自动更新机制**：
- 实现 `INotifyCollectionChanged` 接口
- UI 自动响应集合变化
- 支持增删改查操作

### 属性变更通知

#### 1. 实现 INotifyPropertyChanged

```cpp
// 在 IDL 中声明属性
runtimeclass ViewModel : Windows.UI.Xaml.Data.INotifyPropertyChanged
{
    String Title;
    Int32 Count;
}

// C++ 实现
namespace winrt::WinUI3App1C__::implementation
{
    struct ViewModel : ViewModelT<ViewModel>
    {
    private:
        hstring m_title;
        int32_t m_count{0};
        winrt::event<Windows::UI::Xaml::Data::PropertyChangedEventHandler> m_propertyChanged;

    public:
        // 属性访问器
        hstring Title() { return m_title; }
        void Title(hstring const& value)
        {
            if (m_title != value)
            {
                m_title = value;
                m_propertyChanged(*this, Windows::UI::Xaml::Data::PropertyChangedEventArgs{L"Title"});
            }
        }

        // 事件注册
        winrt::event_token PropertyChanged(Windows::UI::Xaml::Data::PropertyChangedEventHandler const& handler)
        {
            return m_propertyChanged.add(handler);
        }

        void PropertyChanged(winrt::event_token const& token)
        {
            m_propertyChanged.remove(token);
        }
    };
}
```

#### 2. 辅助宏简化代码

```cpp
// 定义属性变更通知宏
#define NOTIFY_PROPERTY_CHANGED(propertyName) \
    m_propertyChanged(*this, Windows::UI::Xaml::Data::PropertyChangedEventArgs{L#propertyName})

#define IMPLEMENT_PROPERTY(type, name, fieldName) \
    type name() { return fieldName; } \
    void name(type const& value) \
    { \
        if (fieldName != value) \
        { \
            fieldName = value; \
            NOTIFY_PROPERTY_CHANGED(name); \
        } \
    }
```

### 数据转换器

```cpp
// 实现 IValueConverter
namespace winrt::WinUI3App1C__::implementation
{
    struct BoolToVisibilityConverter : winrt::Windows::UI::Xaml::Data::IValueConverter
    {
        winrt::Windows::Foundation::IInspectable Convert(
            winrt::Windows::Foundation::IInspectable const& value,
            winrt::Windows::UI::Xaml::Interop::TypeName const& targetType,
            winrt::Windows::Foundation::IInspectable const& parameter,
            hstring const& language)
        {
            bool boolValue = unbox_value<bool>(value);
            return box_value(boolValue ? 
                winrt::Microsoft::UI::Xaml::Visibility::Visible : 
                winrt::Microsoft::UI::Xaml::Visibility::Collapsed);
        }

        winrt::Windows::Foundation::IInspectable ConvertBack(
            winrt::Windows::Foundation::IInspectable const& value,
            winrt::Windows::UI::Xaml::Interop::TypeName const& targetType,
            winrt::Windows::Foundation::IInspectable const& parameter,
            hstring const& language)
        {
            auto visibility = unbox_value<winrt::Microsoft::UI::Xaml::Visibility>(value);
            return box_value(visibility == winrt::Microsoft::UI::Xaml::Visibility::Visible);
        }
    };
}
```

## 导航系统实现

### Frame 导航

```cpp
// 导航到页面
void UserMainPage::openHomePage()
{
    mainFrame().Navigate(xaml_typename<HomePage>());
}

void UserMainPage::openSettingsPage()
{
    mainFrame().Navigate(xaml_typename<SettingsPage>());
}

// 带参数导航
void NavigateWithParameter()
{
    winrt::Windows::Foundation::IInspectable parameter = box_value(L"参数数据");
    mainFrame().Navigate(xaml_typename<DetailPage>(), parameter);
}
```

### 导航参数处理

```cpp
// 在目标页面处理导航参数
void DetailPage::OnNavigatedTo(
    winrt::Microsoft::UI::Xaml::Navigation::NavigationEventArgs const& args)
{
    if (args.Parameter() != nullptr)
    {
        auto parameter = unbox_value<hstring>(args.Parameter());
        // 使用导航参数初始化页面
        titleText().Text(parameter);
    }
}
```

### 导航历史管理

```cpp
// 检查是否可以后退
if (mainFrame().CanGoBack())
{
    mainFrame().GoBack();
}

// 检查是否可以前进
if (mainFrame().CanGoForward())
{
    mainFrame().GoForward();
}

// 清空导航历史
mainFrame().BackStack().Clear();
```

## 资源管理与样式

### 应用程序资源

```xml
<!-- App.xaml -->
<Application.Resources>
    <ResourceDictionary>
        <ResourceDictionary.MergedDictionaries>
            <XamlControlsResources xmlns="using:Microsoft.UI.Xaml.Controls" />
        </ResourceDictionary.MergedDictionaries>
        
        <!-- 自定义资源 -->
        <SolidColorBrush x:Key="CustomBrush" Color="Blue"/>
        <Style x:Key="CustomButtonStyle" TargetType="Button">
            <Setter Property="Background" Value="{StaticResource CustomBrush}"/>
        </Style>
    </ResourceDictionary>
</Application.Resources>
```

### 本地化资源

```cpp
// 访问字符串资源
auto resourceLoader = winrt::Windows::ApplicationModel::Resources::ResourceLoader::GetForCurrentView();
auto localizedString = resourceLoader.GetString(L"HelloWorld");
```

## 调试技巧与性能优化

### 调试技术

#### 1. 引用计数调试

```cpp
// 检查对象引用计数
bool DebugGetCurrentRefCount(winrt::Windows::Foundation::IInspectable const& obj, uint32_t& refCount)
{
    IUnknown* pUnk = winrt::get_unknown(obj);
    if (pUnk)
    {
        refCount = pUnk->AddRef() - 1;
        pUnk->Release();
        return true;
    }
    return false;
}

// 使用示例
uint32_t refCount = 0;
if (DebugGetCurrentRefCount(*this, refCount))
{
    OutputDebugStringW((L"对象引用计数: " + std::to_wstring(refCount)).c_str());
}
```

#### 2. XAML 热重载

启用 XAML 热重载可以在运行时修改 UI：
- 修改 XAML 文件
- 保存文件
- 应用程序自动更新 UI

#### 3. 断点调试

```cpp
// 条件断点
if (某个条件)
{
    __debugbreak(); // 触发断点
}

// 输出调试信息
OutputDebugStringW(L"调试信息\n");
```

### 性能优化

#### 1. 避免频繁的类型转换

```cpp
// 不推荐：每次都转换
for (int i = 0; i < 1000; ++i)
{
    list.Append(box_value(to_hstring(i)));
}

// 推荐：批量操作
std::vector<hstring> items;
for (int i = 0; i < 1000; ++i)
{
    items.push_back(to_hstring(i));
}
for (auto&& item : items)
{
    list.Append(box_value(item));
}
```

#### 2. 使用虚拟化

```xml
<!-- 对于大数据集使用虚拟化 -->
<ListView VirtualizationMode="Recycling">
    <ListView.ItemsPanel>
        <ItemsPanelTemplate>
            <VirtualizingStackPanel/>
        </ItemsPanelTemplate>
    </ListView.ItemsPanel>
</ListView>
```

#### 3. 异步操作

```cpp
// 使用 co_await 进行异步操作
winrt::Windows::Foundation::IAsyncAction LoadDataAsync()
{
    co_await winrt::resume_background();
    
    // 后台线程执行耗时操作
    auto data = LoadLargeDataSet();
    
    co_await winrt::resume_foreground(Dispatcher());
    
    // 回到 UI 线程更新界面
    dataList().ItemsSource(data);
}
```

## 总结

本部分详细介绍了 WinUI 3 WinRT C++ 的实践开发：

1. **项目配置**：正确设置 C++14 和 WinRT 组件
2. **页面开发**：窗口和页面的创建与生命周期管理
3. **控件使用**：常用控件的使用和事件处理
4. **数据绑定**：多种绑定方式和变更通知机制
5. **导航系统**：页面间导航和参数传递
6. **调试优化**：调试技巧和性能优化策略

下一部分将继续深入异步编程、COM 互操作等高级主题。

---

*这是 WinUI 3 WinRT C++ 完整教程的第二部分。下一部分将覆盖异步编程、多线程、COM 互操作等高级开发主题。*