# WinUI 3 WinRT C++ 开发完整教程 - 第五部分：XAML框架与数据绑定深层机制

## XAML 编译和解析机制

### XAML 编译流程详解

XAML 不是在运行时解析的，而是在编译时被转换为 C++ 代码。让我们深入了解这个过程：

#### 1. XAML 编译器的工作原理

```xml
<!-- MainWindow.xaml 原始文件 -->
<Window x:Class="WinUI3App1C__.MainWindow"
        xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml">
    <Grid>
        <Button x:Name="myButton" Content="点击我" Click="myButton_Click"/>
    </Grid>
</Window>
```

编译器会生成对应的 C++ 代码（MainWindow.g.h）：

```cpp
// MainWindow.g.h (简化版)
namespace winrt::WinUI3App1C__::implementation
{
    template<typename D>
    struct MainWindowT : DependencyObjectT<D>
    {
    private:
        bool _contentLoaded = false;
        
        // XAML 中定义的控件的成员变量
        winrt::Microsoft::UI::Xaml::Controls::Button _myButton{nullptr};
        
    public:
        void InitializeComponent()
        {
            if (_contentLoaded)
                return;
            
            _contentLoaded = true;
            
            // 创建根元素 (Grid)
            auto grid = winrt::Microsoft::UI::Xaml::Controls::Grid{};
            
            // 创建按钮
            _myButton = winrt::Microsoft::UI::Xaml::Controls::Button{};
            _myButton.Content(winrt::box_value(L"点击我"));
            
            // 绑定事件处理器
            _myButton.Click({this, &MainWindow::myButton_Click});
            
            // 添加到父容器
            grid.Children().Append(_myButton);
            
            // 设置为窗口内容
            Content(grid);
        }
        
        // 访问 XAML 控件的方法
        winrt::Microsoft::UI::Xaml::Controls::Button myButton()
        {
            return _myButton;
        }
    };
}
```

#### 2. x:Name 的实现机制

当你在 XAML 中写 `x:Name="myButton"` 时，编译器会：

1. **生成私有成员变量**：`_myButton`
2. **生成公共访问方法**：`myButton()`
3. **在 InitializeComponent 中初始化**：创建对象并赋值

```cpp
// 理解为什么可以在 C++ 代码中直接使用 myButton()
void MainWindow::SomeMethod()
{
    // 这个调用实际上是调用生成的访问方法
    myButton().Content(winrt::box_value(L"新内容"));
    
    // 等价于访问私有成员 _myButton
    // _myButton.Content(winrt::box_value(L"新内容")); // 直接访问会编译错误
}
```

#### 3. 事件绑定的生成机制

XAML 中的 `Click="myButton_Click"` 会被编译器转换为：

```cpp
// 在 InitializeComponent 中生成的代码
_myButton.Click({this, &implementation::MainWindow::myButton_Click});

// 这需要你在 .h 文件中声明对应的方法：
void myButton_Click(
    winrt::Windows::Foundation::IInspectable const& sender,
    winrt::Microsoft::UI::Xaml::RoutedEventArgs const& e);
```

### XAML 命名空间映射

#### 1. 默认命名空间

```xml
<!-- 默认命名空间包含所有基础 UI 控件 -->
<Window xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation">
    <Button/>  <!-- Microsoft.UI.Xaml.Controls.Button -->
    <TextBox/> <!-- Microsoft.UI.Xaml.Controls.TextBox -->
</Window>
```

这个 URL 映射到：
- `winrt::Microsoft::UI::Xaml::Controls::`
- `winrt::Microsoft::UI::Xaml::`
- 其他相关命名空间

#### 2. XAML 命名空间 (x:)

```xml
<Window xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml">
    <Button x:Name="myButton"/>     <!-- 指定名称 -->
    <Grid x:FieldModifier="public"/><!-- 修改字段访问性 -->
</Window>
```

#### 3. 自定义命名空间映射

```xml
<!-- 映射到项目中的自定义类型 -->
<Window xmlns:local="using:WinUI3App1C__">
    <local:CustomControl/>  <!-- 使用自定义控件 -->
</Window>
```

对应的 C++ 命名空间：
```cpp
namespace winrt::WinUI3App1C__::implementation
{
    struct CustomControl : CustomControlT<CustomControl>
    {
        // 自定义控件实现
    };
}
```

## 依赖属性系统深度解析

### 依赖属性的底层实现

依赖属性是 WinUI 3 的核心特性，支持数据绑定、动画、样式等功能：

#### 1. 依赖属性的内部结构

```cpp
// 简化的依赖属性系统实现
class DependencyPropertySystem
{
private:
    // 全局属性注册表
    static std::unordered_map<winrt::guid, std::unique_ptr<PropertyMetadata>> s_properties;
    
    // 每个对象的属性值存储
    std::unordered_map<winrt::Microsoft::UI::Xaml::DependencyProperty, winrt::Windows::Foundation::IInspectable> m_localValues;
    
public:
    // 注册依赖属性
    static winrt::Microsoft::UI::Xaml::DependencyProperty Register(
        hstring const& name,
        winrt::Windows::UI::Xaml::Interop::TypeName const& propertyType,
        winrt::Windows::UI::Xaml::Interop::TypeName const& ownerType,
        winrt::Microsoft::UI::Xaml::PropertyMetadata const& metadata);
    
    // 获取属性值
    winrt::Windows::Foundation::IInspectable GetValue(
        winrt::Microsoft::UI::Xaml::DependencyProperty const& property);
    
    // 设置属性值
    void SetValue(
        winrt::Microsoft::UI::Xaml::DependencyProperty const& property,
        winrt::Windows::Foundation::IInspectable const& value);
};
```

#### 2. 创建自定义依赖属性

让我们创建一个完整的依赖属性示例：

```cpp
// CustomControl.idl
namespace WinUI3App1C__
{
    [default_interface]
    runtimeclass CustomControl : Microsoft.UI.Xaml.Controls.UserControl
    {
        CustomControl();
        
        // 声明依赖属性
        static Microsoft.UI.Xaml.DependencyProperty TitleProperty{ get; };
        String Title;
        
        static Microsoft.UI.Xaml.DependencyProperty ValueProperty{ get; };
        Double Value;
    }
}
```

```cpp
// CustomControl.h
namespace winrt::WinUI3App1C__::implementation
{
    struct CustomControl : CustomControlT<CustomControl>
    {
    private:
        // 静态依赖属性字段
        static winrt::Microsoft::UI::Xaml::DependencyProperty s_titleProperty;
        static winrt::Microsoft::UI::Xaml::DependencyProperty s_valueProperty;
        
    public:
        CustomControl();
        
        // 依赖属性访问器
        static winrt::Microsoft::UI::Xaml::DependencyProperty TitleProperty() { return s_titleProperty; }
        hstring Title() const;
        void Title(hstring const& value);
        
        static winrt::Microsoft::UI::Xaml::DependencyProperty ValueProperty() { return s_valueProperty; }
        double Value() const;
        void Value(double value);
        
    private:
        // 属性变更回调
        static void OnTitlePropertyChanged(
            winrt::Microsoft::UI::Xaml::DependencyObject const& d,
            winrt::Microsoft::UI::Xaml::DependencyPropertyChangedEventArgs const& e);
        
        static void OnValuePropertyChanged(
            winrt::Microsoft::UI::Xaml::DependencyObject const& d,
            winrt::Microsoft::UI::Xaml::DependencyPropertyChangedEventArgs const& e);
    };
}
```

```cpp
// CustomControl.cpp
namespace winrt::WinUI3App1C__::implementation
{
    // 注册依赖属性
    winrt::Microsoft::UI::Xaml::DependencyProperty CustomControl::s_titleProperty =
        winrt::Microsoft::UI::Xaml::DependencyProperty::Register(
            L"Title",                                        // 属性名称
            winrt::xaml_typename<hstring>(),                 // 属性类型
            winrt::xaml_typename<winrt::WinUI3App1C__::CustomControl>(), // 拥有者类型
            winrt::Microsoft::UI::Xaml::PropertyMetadata{
                winrt::box_value(L""),                       // 默认值
                &OnTitlePropertyChanged                      // 变更回调
            });
    
    winrt::Microsoft::UI::Xaml::DependencyProperty CustomControl::s_valueProperty =
        winrt::Microsoft::UI::Xaml::DependencyProperty::Register(
            L"Value",
            winrt::xaml_typename<double>(),
            winrt::xaml_typename<winrt::WinUI3App1C__::CustomControl>(),
            winrt::Microsoft::UI::Xaml::PropertyMetadata{
                winrt::box_value(0.0),
                &OnValuePropertyChanged
            });
    
    CustomControl::CustomControl()
    {
        InitializeComponent();
    }
    
    // 属性访问器实现
    hstring CustomControl::Title() const
    {
        return winrt::unbox_value<hstring>(GetValue(s_titleProperty));
    }
    
    void CustomControl::Title(hstring const& value)
    {
        SetValue(s_titleProperty, winrt::box_value(value));
    }
    
    double CustomControl::Value() const
    {
        return winrt::unbox_value<double>(GetValue(s_valueProperty));
    }
    
    void CustomControl::Value(double value)
    {
        SetValue(s_valueProperty, winrt::box_value(value));
    }
    
    // 属性变更回调
    void CustomControl::OnTitlePropertyChanged(
        winrt::Microsoft::UI::Xaml::DependencyObject const& d,
        winrt::Microsoft::UI::Xaml::DependencyPropertyChangedEventArgs const& e)
    {
        if (auto control = d.try_as<winrt::WinUI3App1C__::implementation::CustomControl>())
        {
            // 处理 Title 属性变更
            hstring oldValue = winrt::unbox_value<hstring>(e.OldValue());
            hstring newValue = winrt::unbox_value<hstring>(e.NewValue());
            
            OutputDebugStringW((L"Title 从 '" + oldValue + L"' 变更为 '" + newValue + L"'\n").c_str());
        }
    }
    
    void CustomControl::OnValuePropertyChanged(
        winrt::Microsoft::UI::Xaml::DependencyObject const& d,
        winrt::Microsoft::UI::Xaml::DependencyPropertyChangedEventArgs const& e)
    {
        if (auto control = d.try_as<winrt::WinUI3App1C__::implementation::CustomControl>())
        {
            // 处理 Value 属性变更
            double oldValue = winrt::unbox_value<double>(e.OldValue());
            double newValue = winrt::unbox_value<double>(e.NewValue());
            
            OutputDebugStringW((L"Value 从 " + winrt::to_hstring(oldValue) + 
                               L" 变更为 " + winrt::to_hstring(newValue) + L"\n").c_str());
        }
    }
}
```

#### 3. 依赖属性的值解析优先级

依赖属性系统按以下优先级解析属性值：

1. **动画值**（最高优先级）
2. **本地值**（通过 SetValue 设置）
3. **模板绑定**
4. **样式 Setter**
5. **继承值**
6. **默认值**（最低优先级）

```cpp
// 演示属性值优先级
void DemonstrateDependencyPropertyPriority()
{
    auto button = winrt::Microsoft::UI::Xaml::Controls::Button{};
    
    // 1. 默认值（在注册时指定）
    // button.FontSize() 返回默认值
    
    // 2. 通过样式设置（优先级高于默认值）
    auto style = winrt::Microsoft::UI::Xaml::Style{winrt::xaml_typename<winrt::Microsoft::UI::Xaml::Controls::Button>()};
    auto setter = winrt::Microsoft::UI::Xaml::Setter{};
    setter.Property(winrt::Microsoft::UI::Xaml::Controls::Control::FontSizeProperty());
    setter.Value(winrt::box_value(16.0));
    style.Setters().Append(setter);
    button.Style(style);
    
    // 3. 本地值（优先级最高，会覆盖样式值）
    button.FontSize(20.0);
    
    // 4. 清除本地值，恢复到样式值
    button.ClearValue(winrt::Microsoft::UI::Xaml::Controls::Control::FontSizeProperty());
}
```

## 数据绑定底层原理

### x:Bind 与 Binding 的区别

#### 1. x:Bind（编译时绑定）

```xml
<!-- x:Bind 在编译时生成代码 -->
<TextBlock Text="{x:Bind UserName, Mode=OneWay}"/>
<TextBlock Text="{x:Bind FormatAge(User.Age)}"/>
```

编译器生成的代码：

```cpp
// MainWindow.g.h 中生成的绑定代码
class MainWindow_obj2_Bindings
{
private:
    winrt::weak_ref<winrt::WinUI3App1C__::MainWindow> weakRefToRootObject;
    
public:
    void Initialize(winrt::WinUI3App1C__::MainWindow const& rootObject)
    {
        weakRefToRootObject = winrt::make_weak(rootObject);
    }
    
    void Update()
    {
        if (auto rootObject = weakRefToRootObject.get())
        {
            // 获取绑定的值
            hstring userName = rootObject.UserName();
            hstring formattedAge = rootObject.FormatAge(rootObject.User().Age());
            
            // 更新 UI 元素
            rootObject.userNameTextBlock().Text(userName);
            rootObject.ageTextBlock().Text(formattedAge);
        }
    }
};
```

**x:Bind 的优势**：
- **编译时检查**：类型安全，编译时发现错误
- **高性能**：直接调用，无反射开销
- **智能提示**：IDE 支持自动完成

#### 2. Binding（运行时绑定）

```xml
<!-- Binding 使用反射，在运行时解析 -->
<TextBlock Text="{Binding UserName, Mode=OneWay}"/>
<TextBlock Text="{Binding User.Age, Converter={StaticResource AgeConverter}}"/>
```

```cpp
// Binding 的内部实现原理（简化版）
class RuntimeBindingEngine
{
public:
    static void EstablishBinding(
        winrt::Microsoft::UI::Xaml::DependencyObject const& target,
        winrt::Microsoft::UI::Xaml::DependencyProperty const& targetProperty,
        winrt::Windows::Foundation::IInspectable const& source,
        hstring const& path)
    {
        // 1. 解析属性路径
        auto pathSegments = ParsePropertyPath(path);
        
        // 2. 使用反射获取属性值
        auto value = GetValueThroughReflection(source, pathSegments);
        
        // 3. 应用转换器（如果有）
        if (auto converter = GetConverter())
        {
            value = converter.Convert(value, /* ... */);
        }
        
        // 4. 设置目标属性
        target.SetValue(targetProperty, value);
        
        // 5. 建立变更通知
        RegisterForPropertyChanges(source, path, [=](auto newValue)
        {
            // 属性变更时更新目标
            target.SetValue(targetProperty, newValue);
        });
    }
    
private:
    static std::vector<hstring> ParsePropertyPath(hstring const& path)
    {
        // 解析 "User.Age" 为 ["User", "Age"]
        std::vector<hstring> segments;
        // 实现路径解析逻辑...
        return segments;
    }
    
    static winrt::Windows::Foundation::IInspectable GetValueThroughReflection(
        winrt::Windows::Foundation::IInspectable const& source,
        std::vector<hstring> const& pathSegments)
    {
        // 使用 WinRT 反射 API 获取属性值
        auto currentObject = source;
        for (auto&& segment : pathSegments)
        {
            // 获取属性值...
        }
        return currentObject;
    }
};
```

### 双向绑定的实现

```cpp
// 实现双向绑定的接口
namespace winrt::WinUI3App1C__::implementation
{
    struct UserViewModel : UserViewModelT<UserViewModel>
    {
    private:
        hstring m_userName;
        int32_t m_age;
        
        // 属性变更事件
        winrt::event<winrt::Microsoft::UI::Xaml::Data::PropertyChangedEventHandler> m_propertyChanged;
        
    public:
        // 实现 INotifyPropertyChanged
        winrt::event_token PropertyChanged(winrt::Microsoft::UI::Xaml::Data::PropertyChangedEventHandler const& handler)
        {
            return m_propertyChanged.add(handler);
        }
        
        void PropertyChanged(winrt::event_token const& token)
        {
            m_propertyChanged.remove(token);
        }
        
        // 带变更通知的属性
        hstring UserName() const { return m_userName; }
        void UserName(hstring const& value)
        {
            if (m_userName != value)
            {
                m_userName = value;
                RaisePropertyChanged(L"UserName");
            }
        }
        
        int32_t Age() const { return m_age; }
        void Age(int32_t value)
        {
            if (m_age != value)
            {
                m_age = value;
                RaisePropertyChanged(L"Age");
            }
        }
        
    private:
        void RaisePropertyChanged(hstring const& propertyName)
        {
            m_propertyChanged(*this, winrt::Microsoft::UI::Xaml::Data::PropertyChangedEventArgs{propertyName});
        }
    };
}
```

在 XAML 中使用双向绑定：

```xml
<!-- TwoWay 绑定会在控件值变化时更新源属性 -->
<TextBox Text="{x:Bind ViewModel.UserName, Mode=TwoWay}"/>
<Slider Value="{x:Bind ViewModel.Age, Mode=TwoWay}"/>
```

## XAML 资源系统详解

### 资源查找机制

XAML 资源系统使用层次化查找：  

实际顺序可概括为（找到即停止）：
1.	当前元素的 Resources (element.Resources)
2.	向上遍历视觉树：父元素、再父元素……
3.	所在 Page / Window / UserControl 的 Resources
4.	Application.Current.Resources（含 MergedDictionaries）
5.	主题字典（ThemeDictionaries：根据 Light/Dark/HighContrast 选分支）
6.	系统内置资源（控件库提供的默认样式、系统颜色）
7.	找不到：抛异常（StaticResource）或返回 null（TryLookup）
---
备注：
- StaticResource：加载/应用模板时一次性解析，失败直接报错。
- ThemeResource（WinUI 特有）：不是立即固定，主题切换时重新解析。
- （WPF 的 DynamicResource 在 WinUI 里没有；文档示例里提“动态”只是概念说明。）
```xml
<!-- App.xaml - 应用程序级资源 -->
<Application.Resources>
    <SolidColorBrush x:Key="AppPrimaryBrush" Color="Blue"/>
    <Style x:Key="AppButtonStyle" TargetType="Button">
        <Setter Property="Background" Value="{StaticResource AppPrimaryBrush}"/>
    </Style>
</Application.Resources>
```

```xml
<!-- MainWindow.xaml - 窗口级资源 -->
<Window.Resources>
    <SolidColorBrush x:Key="WindowBackgroundBrush" Color="White"/>
    <local:MyConverter x:Key="BoolToVisibilityConverter"/>
</Window.Resources>

<Grid>
    <Grid.Resources>
        <!-- 页面级资源 -->
        <SolidColorBrush x:Key="GridBackgroundBrush" Color="LightGray"/>
    </Grid.Resources>
    
    <Button Background="{StaticResource AppPrimaryBrush}"
            Style="{StaticResource AppButtonStyle}"/>
</Grid>
```

#### 资源查找的 C++ 实现 （非源码，仅伪代码示意）
核心思想（人话）：
- 从当前元素开始：如果它的 Resources 字典里有 key，用它。
- 没有就拿它的 Parent 继续。
- 顶层还没有就去 Application.Resources。
- 还没就再去系统/库级资源。
- 如果都没有：报错或返回空。
```cpp
// 资源查找的内部实现
class ResourceLookup
{
public:
    static winrt::Windows::Foundation::IInspectable FindResource(
        winrt::Microsoft::UI::Xaml::FrameworkElement const& element,
        winrt::Windows::Foundation::IInspectable const& key)
    {
        // 1. 从当前元素开始查找
        auto current = element;
        while (current != nullptr)
        {
            if (current.Resources().HasKey(key))
            {
                return current.Resources().Lookup(key);
            }
            
            // 2. 向上查找父元素
            current = current.Parent().try_as<winrt::Microsoft::UI::Xaml::FrameworkElement>();
        }
        
        // 3. 查找应用程序资源
        auto app = winrt::Microsoft::UI::Xaml::Application::Current();
        if (app.Resources().HasKey(key))
        {
            return app.Resources().Lookup(key);
        }
        
        // 4. 查找系统资源
        return FindSystemResource(key);
    }
    
private:
    static winrt::Windows::Foundation::IInspectable FindSystemResource(
        winrt::Windows::Foundation::IInspectable const& key)
    {
        // 查找系统定义的资源（如系统颜色、字体等）
        return nullptr;
    }
};
```

### 动态资源和主题切换
WinUI 3 标准做法:  

WinUI 3 要区分三类“看起来像换主题/换皮肤”的需求场景：

1. 系统 / 深色浅色主题切换（Light / Dark / HighContrast高对比度）  
2. 应用自定义（与 Light/Dark 组合）  
3. 运行时根据用户操作即时变色（例如自定义主题、不随系统改变，调色板实时预览）

核心机制只有两种：
- ThemeResource + RequestedTheme（或系统主题变化） → 重新解析(使用 ThemeResource 定义可随主题变化的资源)
- 同一资源实例（对象地址不变）属性被修改 → 引用它的控件视觉刷新

WinUI 3 没有 WPF 的 DynamicResource 关键字。StaticResource 在解析后就“定死”引用的对象实例，不会自动换对象！一定要注意；**ThemeResource** 而会在主题触发点重新解析。

---

#### 1. 标准深浅主题切换：ThemeDictionaries + ThemeResource

适用于场景：深色/浅色（可扩展高对比度）主题自动适配。这会根据系统主题变化或用户切换主题时，自动重新解析 ThemeResource。覆盖系统默认的主题设置。

Application 级资源（App.xaml）：  
你当然也可以在 Page / Window 级别定义 ThemeDictionaries，但通常放在 App 里全局定义。也推荐创建 Style 文件夹后单独编写 XAML 文件管理样式与资源。

```xml
<Application.Resources>
  <ResourceDictionary>
    <ResourceDictionary.ThemeDictionaries>
      <ResourceDictionary x:Key="Light">
        <!-- Light 下的基色 -->
        <Color x:Key="BrandBaseColor">#0062B8</Color>
        <SolidColorBrush x:Key="AppBackgroundBrush" Color="White"/>
        <SolidColorBrush x:Key="AppForegroundBrush" Color="Black"/>
        <SolidColorBrush x:Key="BrandBrush"
                         Color="{StaticResource BrandBaseColor}"/>
      </ResourceDictionary>

      <ResourceDictionary x:Key="Dark">
        <!-- Dark 下可重用同名键；ThemeResource 会重新解析 -->
        <Color x:Key="BrandBaseColor">#3399FF</Color>
        <SolidColorBrush x:Key="AppBackgroundBrush" Color="#1E1E1E"/>
        <SolidColorBrush x:Key="AppForegroundBrush" Color="#F1F1F1"/>
        <SolidColorBrush x:Key="BrandBrush"
                         Color="{StaticResource BrandBaseColor}"/>
      </ResourceDictionary>

      <ResourceDictionary x:Key="HighContrast">
        <!-- 高对比度模式下的专用颜色 -->
        <SolidColorBrush x:Key="AppBackgroundBrush" Color="Black"/>
        <SolidColorBrush x:Key="AppForegroundBrush" Color="Yellow"/>
        <SolidColorBrush x:Key="BrandBrush" Color="Yellow"/>
      </ResourceDictionary>
    </ResourceDictionary.ThemeDictionaries>
  </ResourceDictionary>
</Application.Resources>
```

页面 / 控件使用 ThemeResource（注意不是 StaticResource）：

```xml
<Grid Background="{ThemeResource AppBackgroundBrush}">
  <StackPanel>
    <TextBlock Foreground="{ThemeResource AppForegroundBrush}"
               Text="主题示例"/>
    <Button Background="{ThemeResource BrandBrush}"
            Content="Action"/>
  </StackPanel>
</Grid>
```

在 C++ 中切换窗口局部主题（不影响系统）：
Namespace:
Microsoft.UI.Xaml 
```cpp
// MainWindow.xaml.cpp 片段
void MainWindow::ToggleTheme()
{
    using namespace winrt::Microsoft::UI::Xaml;
    auto root = this->Content().try_as<FrameworkElement>();
    if (!root) return;

    auto current = root.RequestedTheme();
    // ElementTheme::Default 表示跟随系统；此处简单在 Light / Dark 间切换
    ElementTheme next =
        (current == ElementTheme::Dark) ? ElementTheme::Light : ElementTheme::Dark;
    root.RequestedTheme(next);
}
```

说明：
- [ElementTheme 文档参考](https://learn.microsoft.com/zh-cn/windows/windows-app-sdk/api/winrt/microsoft.ui.xaml.elementtheme)
- 设置根元素 `FrameworkElement::RequestedTheme` 触发 ThemeResource 重新解析。
- FrameworkElement.RequestedTheme Property
  - 获取或设置 UIElement（及其子元素）用于资源确定的 UI 主题。您使用 RequestedTheme 指定的 UI 主题可以覆盖应用程序级别的 RequestedTheme。
  - ElementTheme::Light 时使用 Light 字典。
  - ElementTheme::Dark 时使用 Dark 字典。
  - ElementTheme::HighContrast 时使用 HighContrast 字典。
  - Remarks  言论
    - Changing the RequestedTheme value is effectively changing the resource lookup behavior for the element's default template. If you change the value to Light then the template uses the values from the ResourceDictionary that is keyed as "Light" in the ThemeDictionaries collection. Setting the UI theme differently from the app's theme is often appropriate for floating controls such as menus and flyouts.
    - 更改 RequestedTheme 值实际上是更改元素默认模板的资源查找行为。如果将值更改为 Light ，则模板将使用 ResourceDictionary 中的值，该值在 ThemeDictionaries 集合中键入为“Light”。将 UI 主题设置为与应用程序主题不同，通常适用于菜单和弹出按钮等浮动控件。
    - You can change the value of the RequestedTheme property for any given element at run-time. That's in contrast to the Application.RequestedTheme property, which throws an exception if you try to set it while the app's running.
    - 您可以在运行时更改任何给定元素的 RequestedTheme 属性的值。这与应用程序相反。RequestedTheme 属性，如果您在应用程序运行时尝试设置它，则会抛出异常。
    - The RequestedTheme value you set on a FrameworkElement will inherit to any elements that are nested within the element where RequestedTheme is set, but that inheritance can be overridden by explicitly setting RequestedTheme again. For example, in this XAML example, the parent StackPanel sets the theme to Light, and that value inherits to the first TextBlock child element, but not to the second TextBlock because it's setting the value to Dark instead.
    - 您在 FrameworkElement 上设置的 RequestedTheme 值将继承到嵌套在设置了 RequestedTheme 的元素中的任何元素，但可以通过再次显式设置 RequestedTheme 来覆盖该继承。例如，在这个 XAML 示例中，父级 StackPanel 将主题设置为 Light ，该值继承给第一个 TextBlock 子元素，但不继承给第二个 TextBlock ，因为它将值设置为 Dark 。
    ```xml
    <StackPanel RequestedTheme="Light">
      <TextBlock>Text using light theme.</TextBlock>
      <TextBlock RequestedTheme="Dark">Text using dark theme.</TextBlock>
    </StackPanel>
    ```
    - The RequestedTheme property is ignored if the user is running in high contrast mode. See High-contrast themes and XAML high contrast style sample.
    - 如果用户在高对比度模式下运行，则忽略 RequestedTheme 属性。请参阅高对比度主题和 XAML 高对比度样式示例。
    - 备注
      - On Windows, setting RequestedTheme to ElementTheme.Default will always result in "Dark" being the theme.
      - 在 Windows 上，将 RequestedTheme 设置为 ElementTheme。默认情况下，主题始终为“黑暗”。
- ElementTheme::Default 时由系统（或 App 级）决定。
- 不需要手动“刷新”或遍历视觉树。

如果想全局强制主题（所有窗口），可以为每个窗口根节点设置相同 RequestedTheme；WinUI 3 桌面版 Application::RequestedTheme 目前不总是即时影响已创建的窗口，故推荐对根元素逐一设置。

---

#### 2. 自定义“换肤” / 实时调色：保持同一实例修改其属性

适用于：非 Light/Dark 概念，而是用户在 UI 中自选颜色（实时预览）。

初始化：插入一次 Brush 对象（保持实例地址不变）：

```cpp
// App.xaml.cpp OnLaunched 中（或初始化逻辑）
// 只插入一次；后续修改 Color 即可
void EnsureThemeRuntimeBrushes()
{
    using namespace winrt;
    using namespace winrt::Microsoft::UI::Xaml;

    auto app = Application::Current();
    auto res = app.Resources();

    // 如果已经有，避免重复覆盖
    if (!res.HasKey(box_value(L"RuntimeAccentBrush")))
    {
        res.Insert(L"RuntimeAccentBrush",
            Microsoft::UI::Xaml::Media::SolidColorBrush{
                Windows::UI::Colors::CornflowerBlue()
            });
    }
}
```

XAML 使用 StaticResource（这次允许，因为我们改的是“同一个实例的属性”）：

```xml
<Button Background="{StaticResource RuntimeAccentBrush}"
        Content="实时换肤"/>
```

运行时修改颜色（所有引用立即更新）：

```cpp
void AccentService::UpdateAccentColor(winrt::Windows::UI::Color const& color)
{
    using namespace winrt;
    using namespace winrt::Microsoft::UI::Xaml;

    auto app = Application::Current();
    auto res = app.Resources();

    if (auto brushObj = res.Lookup(box_value(L"RuntimeAccentBrush")))
    {
        if (auto brush = brushObj.try_as<Microsoft::UI::Xaml::Media::SolidColorBrush>())
        {
            brush.Color(color); // 修改实例 -> 所有使用处同步刷新
        }
    }
}
```

说明：
- StaticResource 返回的是对象引用；我们不替换字典值，而是修改对象内部状态。
- 避免“把旧 Brush 替换成新 Brush 实例”——那样控件仍持有旧实例，不会更新。

---

#### 3. 不推荐/常见误区对比

| 做法 | 问题 |
|------|------|
| Clear() Application.Resources().MergedDictionaries() 再 Append 新字典 | 误删其他第三方样式；StaticResource 已经拿到旧实例不会刷新 |
| 用 StaticResource 期望 Light/Dark 自动变 | 不会重新解析；只能 ThemeResource |
| 频繁创建新的 SolidColorBrush 替换字典 | 控件仍引用旧实例 → 无视觉更新 |
| 手写“InvalidateVisualTree”遍历强制刷新 | 多余；ThemeResource 或实例属性修改已足够 |

---

#### 4. 组合用法（BrandBrush + Theme）

可在 ThemeDictionaries 中定义一个“占位 Brush”（BrandBrush），再通过运行时修改 BrandBrush.Color 实现“Brand色”与 Light/Dark 兼容：

1. ThemeDictionaries 定义 BrandBrush（分别给 Light / Dark 不同的初始 HSV 基础）
2. 运行时只修改 BrandBrush.Color（同一实例）
3. 切主题时 ThemeResource 重新解析可能会替换实例；若你想“保留实例 + 改色”，则不要把 BrandBrush 放 ThemeDictionaries，而是外层 static + 只放衍生色在 ThemeDictionaries

简单示例（Brand Brush 放外层，主题差异只控制背景/前景）：

```xml
<Application.Resources>
  <SolidColorBrush x:Key="BrandBrush" Color="#0A84FF"/>
  <ResourceDictionary>
    <ResourceDictionary.ThemeDictionaries>
      <ResourceDictionary x:Key="Light">
        <SolidColorBrush x:Key="AppBackgroundBrush" Color="White"/>
      </ResourceDictionary>
      <ResourceDictionary x:Key="Dark">
        <SolidColorBrush x:Key="AppBackgroundBrush" Color="#1E1E1E"/>
      </ResourceDictionary>
    </ResourceDictionary.ThemeDictionaries>
  </ResourceDictionary>
</Application.Resources>
```

C++ 改Brand色（不受主题切换替换实例影响）：

```cpp
void BrandService::SetBrand(winrt::Windows::UI::Color const& c)
{
    using namespace winrt;
    using namespace winrt::Microsoft::UI::Xaml;

    auto res = Application::Current().Resources();
    if (auto obj = res.Lookup(box_value(L"BrandBrush")))
    {
        if (auto brush = obj.try_as<Microsoft::UI::Xaml::Media::SolidColorBrush>())
            brush.Color(c);
    }
}
```

---

#### 5. 选择策略速览

| 需求 | 建议 |
|------|------|
| 标准浅/深色适配 | ThemeDictionaries + ThemeResource + RequestedTheme |
| 响应系统主题自动变 | 使用 ThemeResource，根元素 RequestedTheme=Default |
| 自定义运行时色板实时预览 | 固定实例（StaticResource）+ 修改 Brush.Color |
| 同时支持主题 + Brand色 | 主题差异用 ThemeResource；Brand主色用固定实例 |

---

#### 6. 调试与验证技巧

- 检查是否写成 ThemeResource：在主题切换后，如果颜色不变，首先确认不是 StaticResource。
- 断点：在 ToggleTheme 后立即查看某个 ThemeResource 的 Brush 实例地址（指针值）是否变化；变化说明重新解析。
- 性能：避免在高频交互中反复替换 ResourceDictionary；优先改对象属性。

---

#### 7. 小结

1. ThemeResource = 主题点触发重新解析；StaticResource = 一次解析，引用对象实例。  
2. 没有 DynamicResource 关键字；“动态”依赖两条路径：主题驱动解析或修改对象属性。  
3. 替换字典集合（Clear + Append）通常不是必要也不安全。  
4. 运行时个性化配色首选“同一 Brush 实例 + 修改属性”策略。  

这一套模式基本覆盖 WinUI 3 桌面应用主题 / 换肤的主流需求。

## 模板和样式机制

### 控件模板的内部工作原理
仅作示例，代码未测试运行！！！
```cpp
// 控件模板的应用过程
class TemplatedControl : public winrt::Microsoft::UI::Xaml::Controls::Control
{
protected:
    virtual void OnApplyTemplate() override
    {
        // 1. 基类处理
        __super::OnApplyTemplate();
        
        // 2. 查找模板中的命名元素
        auto contentPresenter = GetTemplateChild(L"PART_ContentPresenter")
            .try_as<winrt::Microsoft::UI::Xaml::Controls::ContentPresenter>();
        
        auto border = GetTemplateChild(L"PART_Border")
            .try_as<winrt::Microsoft::UI::Xaml::Controls::Border>();
        
        // 3. 建立模板绑定
        if (contentPresenter)
        {
            // 绑定内容属性
            auto binding = winrt::Microsoft::UI::Xaml::Data::Binding{};
            binding.Source(*this);
            binding.Path(winrt::Microsoft::UI::Xaml::PropertyPath{L"Content"});
            winrt::Microsoft::UI::Xaml::Data::BindingOperations::SetBinding(
                contentPresenter, 
                winrt::Microsoft::UI::Xaml::Controls::ContentPresenter::ContentProperty(), 
                binding);
        }
        
        // 4. 注册模板元素的事件
        if (border)
        {
            border.PointerEntered([this](auto&&, auto&&) { OnPointerEntered(); });
            border.PointerExited([this](auto&&, auto&&) { OnPointerExited(); });
        }
    }
    
private:
    void OnPointerEntered()
    {
        // 处理鼠标进入
        winrt::Microsoft::UI::Xaml::VisualStateManager::GoToState(*this, L"PointerOver", true);
    }
    
    void OnPointerExited()
    {
        // 处理鼠标离开
        winrt::Microsoft::UI::Xaml::VisualStateManager::GoToState(*this, L"Normal", true);
    }
};
```

### 自定义控件模板

```xml
<!-- 定义自定义控件模板 -->
<Style x:Key="CustomButtonStyle" TargetType="Button">
    <Setter Property="Template">
        <Setter.Value>
            <ControlTemplate TargetType="Button">
                <Border x:Name="PART_Border"
                        Background="{TemplateBinding Background}"
                        BorderBrush="{TemplateBinding BorderBrush}"
                        BorderThickness="{TemplateBinding BorderThickness}"
                        CornerRadius="5">
                    <VisualStateManager.VisualStateGroups>
                        <VisualStateGroup x:Name="CommonStates">
                            <VisualState x:Name="Normal"/>
                            <VisualState x:Name="PointerOver">
                                <VisualState.Setters>
                                    <Setter Target="PART_Border.Background" Value="LightBlue"/>
                                </VisualState.Setters>
                            </VisualState>
                            <VisualState x:Name="Pressed">
                                <VisualState.Setters>
                                    <Setter Target="PART_Border.Background" Value="DarkBlue"/>
                                </VisualState.Setters>
                            </VisualState>
                        </VisualStateGroup>
                    </VisualStateManager.VisualStateGroups>
                    
                    <ContentPresenter x:Name="PART_ContentPresenter"
                                      Content="{TemplateBinding Content}"
                                      ContentTemplate="{TemplateBinding ContentTemplate}"
                                      HorizontalAlignment="{TemplateBinding HorizontalContentAlignment}"
                                      VerticalAlignment="{TemplateBinding VerticalContentAlignment}"/>
                </Border>
            </ControlTemplate>
        </Setter.Value>
    </Setter>
</Style>
```

## 自定义标记扩展

### 创建自定义标记扩展

```cpp
// CustomExtension.idl
namespace WinUI3App1C__
{
    [default_interface]
    runtimeclass LocalizationExtension : Microsoft.UI.Xaml.Markup.MarkupExtension
    {
        LocalizationExtension();
        LocalizationExtension(String key);
        
        String Key;
        String DefaultValue;
    }
}
```

```cpp
// LocalizationExtension.h
namespace winrt::WinUI3App1C__::implementation
{
    struct LocalizationExtension : LocalizationExtensionT<LocalizationExtension>
    {
    private:
        hstring m_key;
        hstring m_defaultValue;
        
    public:
        LocalizationExtension() = default;
        LocalizationExtension(hstring const& key) : m_key(key) {}
        
        hstring Key() const { return m_key; }
        void Key(hstring const& value) { m_key = value; }
        
        hstring DefaultValue() const { return m_defaultValue; }
        void DefaultValue(hstring const& value) { m_defaultValue = value; }
        
        // 实现 MarkupExtension 的核心方法
        winrt::Windows::Foundation::IInspectable ProvideValue(
            winrt::Microsoft::UI::Xaml::Markup::IXamlServiceProvider const& serviceProvider) override;
    };
}
```

```cpp
// LocalizationExtension.cpp
winrt::Windows::Foundation::IInspectable LocalizationExtension::ProvideValue(
    winrt::Microsoft::UI::Xaml::Markup::IXamlServiceProvider const& serviceProvider)
{
    // 1. 获取资源加载器
    auto resourceLoader = winrt::Windows::ApplicationModel::Resources::ResourceLoader::GetForCurrentView();
    
    // 2. 尝试加载本地化字符串
    try
    {
        hstring localizedText = resourceLoader.GetString(m_key);
        if (!localizedText.empty())
        {
            return winrt::box_value(localizedText);
        }
    }
    catch (...)
    {
        // 资源不存在，使用默认值
    }
    
    // 3. 返回默认值或键名
    hstring fallback = !m_defaultValue.empty() ? m_defaultValue : m_key;
    return winrt::box_value(fallback);
}
```

在 XAML 中使用自定义标记扩展：

```xml
<Window xmlns:local="using:WinUI3App1C__">
    <TextBlock Text="{local:LocalizationExtension Key=WelcomeMessage, DefaultValue='Welcome!'}"/>
    <Button Content="{local:LocalizationExtension ClickMe}"/>
</Window>
```

## 总结

本部分深入讲解了 XAML 框架的核心机制：

1. **XAML 编译**：理解 XAML 如何转换为 C++ 代码
2. **依赖属性**：掌握 WinUI 3 属性系统的底层实现
3. **数据绑定**：了解编译时和运行时绑定的区别和原理
4. **资源系统**：掌握资源查找和主题切换机制
5. **模板系统**：理解控件模板的应用和自定义
6. **标记扩展**：学会创建自定义的 XAML 扩展

这些深层知识帮助我们更好地理解和使用 WinUI 3 框架。

---

*这是 WinUI 3 WinRT C++ 完整教程的第五部分。下一部分我们将学习高级控件开发和性能优化技巧。*