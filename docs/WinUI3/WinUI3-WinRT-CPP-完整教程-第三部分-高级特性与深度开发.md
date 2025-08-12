# WinUI 3 WinRT C++ 开发完整教程 - 第三部分：高级特性与深度开发

## 异步编程模型

### WinRT 异步基础

WinRT 使用基于协程的异步模型，C++/WinRT 通过 `co_await` 关键字提供现代异步编程体验。

#### 异步操作类型

```cpp
// 异步操作的四种基本类型
winrt::Windows::Foundation::IAsyncAction         // 无返回值的异步操作
winrt::Windows::Foundation::IAsyncOperation<T>   // 有返回值的异步操作
winrt::Windows::Foundation::IAsyncActionWithProgress<P>    // 带进度的异步操作
winrt::Windows::Foundation::IAsyncOperationWithProgress<T, P>  // 带返回值和进度的异步操作
```

#### 基础异步操作实现

```cpp
// 基础异步方法
winrt::Windows::Foundation::IAsyncAction BasicAsyncOperation()
{
    // 切换到后台线程
    co_await winrt::resume_background();
    
    // 执行耗时操作
    std::this_thread::sleep_for(std::chrono::seconds(2));
    
    // 切换回 UI 线程
    co_await winrt::resume_foreground(Dispatcher());
    
    // 更新 UI
    statusText().Text(L"操作完成");
}

// 带返回值的异步方法
winrt::Windows::Foundation::IAsyncOperation<hstring> LoadDataAsync()
{
    co_await winrt::resume_background();
    
    // 模拟数据加载
    std::this_thread::sleep_for(std::chrono::milliseconds(500));
    std::wstring data = L"加载的数据";
    
    co_return hstring{data};
}
```

#### 异步操作的调用

```cpp
// 在事件处理器中调用异步方法
winrt::fire_and_forget MainWindow::LoadButton_Click(
    winrt::Windows::Foundation::IInspectable const&,
    winrt::Microsoft::UI::Xaml::RoutedEventArgs const&)
{
    try
    {
        // 调用无返回值异步操作
        co_await BasicAsyncOperation();
        
        // 调用有返回值异步操作
        auto result = co_await LoadDataAsync();
        resultText().Text(result);
    }
    catch (...)
    {
        // 异常处理
        errorText().Text(L"操作失败");
    }
}
```

### 异步操作的取消

```cpp
// 支持取消的异步操作
winrt::Windows::Foundation::IAsyncAction CancellableOperation(
    winrt::Windows::Foundation::IInspectable const& token)
{
    auto cancellationToken = winrt::get_cancellation_token();
    
    for (int i = 0; i < 100; ++i)
    {
        // 检查取消请求
        cancellationToken.throw_if_cancelled();
        
        // 执行部分工作
        co_await winrt::resume_background();
        std::this_thread::sleep_for(std::chrono::milliseconds(100));
        
        // 更新进度
        co_await winrt::resume_foreground(Dispatcher());
        progressBar().Value(i);
    }
}

// 使用取消令牌
void StartCancellableOperation()
{
    m_cancellationTokenSource = winrt::Windows::Foundation::CancellationTokenSource{};
    CancellableOperation(m_cancellationTokenSource.Token());
}

void CancelOperation()
{
    if (m_cancellationTokenSource)
    {
        m_cancellationTokenSource.Cancel();
    }
}
```

### 进度报告

```cpp
// 带进度报告的异步操作
winrt::Windows::Foundation::IAsyncOperationWithProgress<bool, double> 
ProcessWithProgressAsync()
{
    auto progress = co_await winrt::get_progress_token();
    
    co_await winrt::resume_background();
    
    for (int i = 0; i <= 100; ++i)
    {
        // 执行工作
        std::this_thread::sleep_for(std::chrono::milliseconds(50));
        
        // 报告进度 (0.0 到 1.0)
        progress(static_cast<double>(i) / 100.0);
    }
    
    co_return true;
}

// 调用带进度的异步操作
winrt::fire_and_forget ProcessButton_Click(
    winrt::Windows::Foundation::IInspectable const&,
    winrt::Microsoft::UI::Xaml::RoutedEventArgs const&)
{
    auto operation = ProcessWithProgressAsync();
    
    // 注册进度回调
    operation.Progress([this](auto&&, double progress)
    {
        // 在 UI 线程更新进度
        Dispatcher().BeginInvoke([this, progress]()
        {
            progressBar().Value(progress * 100);
        });
    });
    
    // 等待完成
    auto result = co_await operation;
    statusText().Text(result ? L"处理成功" : L"处理失败");
}
```

## COM 互操作性

### 基础 COM 概念

WinRT 建立在 COM 基础之上，理解 COM 对于深度开发至关重要。

#### 接口查询 (QueryInterface)

```cpp
// 手动 COM 接口操作
void ManualCOMOperation()
{
    // 获取 WinRT 对象的 IUnknown 接口
    auto button = findName(L"myButton").as<winrt::Microsoft::UI::Xaml::Controls::Button>();
    IUnknown* pUnknown = winrt::get_unknown(button);
    
    // 查询特定接口
    winrt::Microsoft::UI::Xaml::IUIElement uiElement{nullptr};
    HRESULT hr = pUnknown->QueryInterface(
        __uuidof(winrt::Microsoft::UI::Xaml::IUIElement),
        winrt::put_unknown(uiElement));
    
    if (SUCCEEDED(hr))
    {
        // 使用接口
        uiElement.Visibility(winrt::Microsoft::UI::Xaml::Visibility::Collapsed);
    }
}

// 使用 C++/WinRT 简化的接口转换
void SimplifiedInterfaceConversion()
{
    auto button = findName(L"myButton");
    
    // 尝试转换接口
    if (auto uiElement = button.try_as<winrt::Microsoft::UI::Xaml::IUIElement>())
    {
        uiElement.Visibility(winrt::Microsoft::UI::Xaml::Visibility::Collapsed);
    }
    
    // 强制转换接口（如果失败会抛出异常）
    auto control = button.as<winrt::Microsoft::UI::Xaml::Controls::Control>();
}
```

#### 引用计数管理

```cpp
// 手动引用计数管理
class CustomCOMObject : public winrt::implements<CustomCOMObject, winrt::Windows::Foundation::IInspectable>
{
private:
    std::atomic<uint32_t> m_refCount{1};

public:
    // IUnknown 实现
    HRESULT __stdcall QueryInterface(REFIID riid, void** ppv) noexcept override
    {
        if (riid == __uuidof(IUnknown) || riid == __uuidof(winrt::Windows::Foundation::IInspectable))
        {
            *ppv = static_cast<winrt::Windows::Foundation::IInspectable*>(this);
            AddRef();
            return S_OK;
        }
        *ppv = nullptr;
        return E_NOINTERFACE;
    }

    ULONG __stdcall AddRef() noexcept override
    {
        return ++m_refCount;
    }

    ULONG __stdcall Release() noexcept override
    {
        uint32_t count = --m_refCount;
        if (count == 0)
        {
            delete this;
        }
        return count;
    }
};

// 使用智能指针自动管理
void AutomaticReferenceCountManagement()
{
    // C++/WinRT 智能指针自动管理引用计数
    winrt::com_ptr<IUnknown> comPtr;
    
    // 获取原始指针
    IUnknown* rawPtr = comPtr.get();
    
    // 分离所有权
    IUnknown* detachedPtr = comPtr.detach();
    
    // 重新附加
    comPtr.attach(detachedPtr);
}
```

### 与传统 Win32 COM 组件互操作

```cpp
// 使用传统 COM 组件
#include <combaseapi.h>
#include <shobjidl_core.h>

winrt::Windows::Foundation::IAsyncAction OpenFileDialogAsync()
{
    // 初始化 COM
    winrt::init_apartment(winrt::apartment_type::single_threaded);
    
    // 创建文件对话框
    winrt::com_ptr<IFileOpenDialog> fileDialog;
    winrt::check_hresult(CoCreateInstance(
        CLSID_FileOpenDialog,
        nullptr,
        CLSCTX_INPROC_SERVER,
        IID_PPV_ARGS(fileDialog.put())));
    
    // 设置选项
    DWORD options;
    winrt::check_hresult(fileDialog->GetOptions(&options));
    winrt::check_hresult(fileDialog->SetOptions(options | FOS_FORCEFILESYSTEM));
    
    // 显示对话框
    HRESULT hr = fileDialog->Show(nullptr);
    if (SUCCEEDED(hr))
    {
        winrt::com_ptr<IShellItem> item;
        winrt::check_hresult(fileDialog->GetResult(item.put()));
        
        PWSTR filePath;
        winrt::check_hresult(item->GetDisplayName(SIGDN_FILESYSPATH, &filePath));
        
        // 处理文件路径
        hstring path{filePath};
        CoTaskMemFree(filePath);
        
        // 在 UI 线程更新界面
        co_await winrt::resume_foreground(Dispatcher());
        filePathText().Text(path);
    }
}
```

## 内存管理与对象生命周期

### RAII 原则应用

```cpp
// 资源管理类示例
class ResourceManager
{
private:
    HANDLE m_handle{INVALID_HANDLE_VALUE};
    winrt::com_ptr<IUnknown> m_comObject;
    std::unique_ptr<uint8_t[]> m_buffer;

public:
    ResourceManager()
    {
        // 获取资源
        m_handle = CreateEvent(nullptr, FALSE, FALSE, nullptr);
        m_buffer = std::make_unique<uint8_t[]>(1024);
    }

    ~ResourceManager()
    {
        // 自动释放资源
        if (m_handle != INVALID_HANDLE_VALUE)
        {
            CloseHandle(m_handle);
        }
        // m_comObject 和 m_buffer 自动释放
    }

    // 禁用复制，允许移动
    ResourceManager(const ResourceManager&) = delete;
    ResourceManager& operator=(const ResourceManager&) = delete;
    ResourceManager(ResourceManager&&) = default;
    ResourceManager& operator=(ResourceManager&&) = default;
};
```

### 弱引用处理循环引用

```cpp
// 避免循环引用的模式
class Parent : public winrt::implements<Parent, winrt::Windows::Foundation::IInspectable>
{
private:
    std::vector<winrt::com_ptr<Child>> m_children;

public:
    void AddChild(winrt::com_ptr<Child> child)
    {
        m_children.push_back(child);
        // 子对象只保存父对象的弱引用
        child->SetParent(winrt::make_weak(this));
    }
};

class Child : public winrt::implements<Child, winrt::Windows::Foundation::IInspectable>
{
private:
    winrt::weak_ref<Parent> m_parent;

public:
    void SetParent(winrt::weak_ref<Parent> parent)
    {
        m_parent = parent;
    }

    void DoSomethingWithParent()
    {
        // 尝试获取强引用
        if (auto parent = m_parent.get())
        {
            // 安全使用父对象
            parent->SomeMethod();
        }
    }
};
```

### 内存泄漏检测

```cpp
// 自定义内存分配跟踪
class MemoryTracker
{
private:
    static std::atomic<size_t> s_allocatedBytes;
    static std::atomic<size_t> s_allocationCount;

public:
    static void* TrackedAlloc(size_t size)
    {
        void* ptr = malloc(size);
        if (ptr)
        {
            s_allocatedBytes += size;
            s_allocationCount++;
        }
        return ptr;
    }

    static void TrackedFree(void* ptr, size_t size)
    {
        if (ptr)
        {
            free(ptr);
            s_allocatedBytes -= size;
            s_allocationCount--;
        }
    }

    static void ReportLeaks()
    {
        if (s_allocationCount > 0)
        {
            OutputDebugStringW(
                (L"内存泄漏检测: " + 
                 std::to_wstring(s_allocationCount) + L" 次分配, " +
                 std::to_wstring(s_allocatedBytes) + L" 字节未释放\n").c_str());
        }
    }
};

// 使用示例
class TrackedClass
{
private:
    std::unique_ptr<uint8_t[], decltype(&MemoryTracker::TrackedFree)> m_data{
        static_cast<uint8_t*>(MemoryTracker::TrackedAlloc(1024)),
        [](uint8_t* ptr) { MemoryTracker::TrackedFree(ptr, 1024); }
    };
};
```

## 自定义控件开发

### 用户控件 (UserControl)

```cpp
// CustomControl.idl
namespace WinUI3App1C__
{
    [default_interface]
    runtimeclass CustomControl : Microsoft.UI.Xaml.Controls.UserControl
    {
        CustomControl();
        
        // 自定义属性
        String Title;
        Double Value;
        
        // 自定义事件
        event Windows.Foundation.TypedEventHandler<CustomControl, Object> ValueChanged;
    }
}
```

```xml
<!-- CustomControl.xaml -->
<UserControl x:Class="WinUI3App1C__.CustomControl">
    <Border Background="LightBlue" 
            CornerRadius="5" 
            Padding="10">
        <StackPanel>
            <TextBlock x:Name="titleText" 
                       Text="{x:Bind Title, Mode=OneWay}"
                       FontWeight="Bold"/>
            <Slider x:Name="valueSlider"
                    Value="{x:Bind Value, Mode=TwoWay}"
                    ValueChanged="OnValueChanged"/>
            <TextBlock Text="{x:Bind Value, Mode=OneWay}"/>
        </StackPanel>
    </Border>
</UserControl>
```

```cpp
// CustomControl.xaml.h
namespace winrt::WinUI3App1C__::implementation
{
    struct CustomControl : CustomControlT<CustomControl>
    {
    private:
        hstring m_title;
        double m_value{0.0};
        winrt::event<winrt::Windows::Foundation::TypedEventHandler<
            winrt::WinUI3App1C__::CustomControl, 
            winrt::Windows::Foundation::IInspectable>> m_valueChangedEvent;

    public:
        CustomControl();

        // 属性访问器
        hstring Title() const { return m_title; }
        void Title(hstring const& value);

        double Value() const { return m_value; }
        void Value(double value);

        // 事件处理
        winrt::event_token ValueChanged(
            winrt::Windows::Foundation::TypedEventHandler<
                winrt::WinUI3App1C__::CustomControl,
                winrt::Windows::Foundation::IInspectable> const& handler);
        void ValueChanged(winrt::event_token const& token);

        void OnValueChanged(
            winrt::Windows::Foundation::IInspectable const& sender,
            winrt::Microsoft::UI::Xaml::Controls::Primitives::RangeBaseValueChangedEventArgs const& args);
    };
}
```

```cpp
// CustomControl.xaml.cpp
namespace winrt::WinUI3App1C__::implementation
{
    CustomControl::CustomControl()
    {
        InitializeComponent();
    }

    void CustomControl::Title(hstring const& value)
    {
        if (m_title != value)
        {
            m_title = value;
            // 通知属性变更
            RaisePropertyChanged(L"Title");
        }
    }

    void CustomControl::Value(double value)
    {
        if (m_value != value)
        {
            m_value = value;
            RaisePropertyChanged(L"Value");
            
            // 触发自定义事件
            m_valueChangedEvent(*this, winrt::box_value(value));
        }
    }

    void CustomControl::OnValueChanged(
        winrt::Windows::Foundation::IInspectable const&,
        winrt::Microsoft::UI::Xaml::Controls::Primitives::RangeBaseValueChangedEventArgs const& args)
    {
        Value(args.NewValue());
    }
}
```

### 模板化控件 (Templated Control)

```cpp
// TemplatedControl.idl
namespace WinUI3App1C__
{
    [default_interface]
    runtimeclass TemplatedControl : Microsoft.UI.Xaml.Controls.Control
    {
        TemplatedControl();
        
        static Microsoft.UI.Xaml.DependencyProperty TextProperty{ get; };
        String Text;
    }
}
```

```cpp
// TemplatedControl.xaml.h
namespace winrt::WinUI3App1C__::implementation
{
    struct TemplatedControl : TemplatedControlT<TemplatedControl>
    {
    private:
        static winrt::Microsoft::UI::Xaml::DependencyProperty s_textProperty;

    public:
        TemplatedControl();

        // 依赖属性访问器
        static winrt::Microsoft::UI::Xaml::DependencyProperty TextProperty() { return s_textProperty; }
        
        hstring Text() const;
        void Text(hstring const& value);

        // 控件模板相关
        void OnApplyTemplate() override;

    private:
        static void OnTextPropertyChanged(
            winrt::Microsoft::UI::Xaml::DependencyObject const& d,
            winrt::Microsoft::UI::Xaml::DependencyPropertyChangedEventArgs const& e);
    };
}
```

```cpp
// TemplatedControl.xaml.cpp
namespace winrt::WinUI3App1C__::implementation
{
    // 注册依赖属性
    winrt::Microsoft::UI::Xaml::DependencyProperty TemplatedControl::s_textProperty =
        winrt::Microsoft::UI::Xaml::DependencyProperty::Register(
            L"Text",
            winrt::xaml_typename<hstring>(),
            winrt::xaml_typename<winrt::WinUI3App1C__::TemplatedControl>(),
            winrt::Microsoft::UI::Xaml::PropertyMetadata{
                winrt::box_value(L""),
                winrt::Microsoft::UI::Xaml::PropertyChangedCallback{&TemplatedControl::OnTextPropertyChanged}
            });

    TemplatedControl::TemplatedControl()
    {
        DefaultStyleKey(winrt::box_value(winrt::xaml_typename<winrt::WinUI3App1C__::TemplatedControl>()));
    }

    hstring TemplatedControl::Text() const
    {
        return winrt::unbox_value<hstring>(GetValue(s_textProperty));
    }

    void TemplatedControl::Text(hstring const& value)
    {
        SetValue(s_textProperty, winrt::box_value(value));
    }

    void TemplatedControl::OnApplyTemplate()
    {
        __super::OnApplyTemplate();
        
        // 获取模板中的控件
        if (auto textBlock = GetTemplateChild(L"PART_TextBlock").try_as<winrt::Microsoft::UI::Xaml::Controls::TextBlock>())
        {
            textBlock.Text(Text());
        }
    }

    void TemplatedControl::OnTextPropertyChanged(
        winrt::Microsoft::UI::Xaml::DependencyObject const& d,
        winrt::Microsoft::UI::Xaml::DependencyPropertyChangedEventArgs const& e)
    {
        if (auto control = d.try_as<winrt::WinUI3App1C__::implementation::TemplatedControl>())
        {
            // 更新模板中的控件
            if (auto textBlock = control->GetTemplateChild(L"PART_TextBlock").try_as<winrt::Microsoft::UI::Xaml::Controls::TextBlock>())
            {
                textBlock.Text(winrt::unbox_value<hstring>(e.NewValue()));
            }
        }
    }
}
```

## 依赖属性与附加属性

### 依赖属性系统

依赖属性是 WinUI 3 数据绑定、动画和样式系统的基础。

```cpp
// 完整的依赖属性实现
class DependencyPropertyExample : public winrt::implements<DependencyPropertyExample, winrt::Microsoft::UI::Xaml::DependencyObject>
{
private:
    static winrt::Microsoft::UI::Xaml::DependencyProperty s_valueProperty;
    static winrt::Microsoft::UI::Xaml::DependencyProperty s_isEnabledProperty;

public:
    // 注册依赖属性
    static void RegisterDependencyProperties()
    {
        s_valueProperty = winrt::Microsoft::UI::Xaml::DependencyProperty::Register(
            L"Value",
            winrt::xaml_typename<double>(),
            winrt::xaml_typename<DependencyPropertyExample>(),
            winrt::Microsoft::UI::Xaml::PropertyMetadata{
                winrt::box_value(0.0),                              // 默认值
                &OnValuePropertyChanged,                            // 变更回调
                &CoerceValueCallback                                // 强制回调
            });

        s_isEnabledProperty = winrt::Microsoft::UI::Xaml::DependencyProperty::Register(
            L"IsEnabled",
            winrt::xaml_typename<bool>(),
            winrt::xaml_typename<DependencyPropertyExample>(),
            winrt::Microsoft::UI::Xaml::PropertyMetadata{
                winrt::box_value(true),
                &OnIsEnabledPropertyChanged
            });
    }

    // 属性访问器
    static winrt::Microsoft::UI::Xaml::DependencyProperty ValueProperty() { return s_valueProperty; }
    double Value() const
    {
        return winrt::unbox_value<double>(GetValue(s_valueProperty));
    }
    void Value(double value)
    {
        SetValue(s_valueProperty, winrt::box_value(value));
    }

    static winrt::Microsoft::UI::Xaml::DependencyProperty IsEnabledProperty() { return s_isEnabledProperty; }
    bool IsEnabled() const
    {
        return winrt::unbox_value<bool>(GetValue(s_isEnabledProperty));
    }
    void IsEnabled(bool value)
    {
        SetValue(s_isEnabledProperty, winrt::box_value(value));
    }

private:
    // 属性变更回调
    static void OnValuePropertyChanged(
        winrt::Microsoft::UI::Xaml::DependencyObject const& d,
        winrt::Microsoft::UI::Xaml::DependencyPropertyChangedEventArgs const& e)
    {
        auto instance = d.try_as<DependencyPropertyExample>();
        if (instance)
        {
            double oldValue = winrt::unbox_value<double>(e.OldValue());
            double newValue = winrt::unbox_value<double>(e.NewValue());
            instance->OnValueChanged(oldValue, newValue);
        }
    }

    // 值强制回调
    static winrt::Windows::Foundation::IInspectable CoerceValueCallback(
        winrt::Microsoft::UI::Xaml::DependencyObject const& d,
        winrt::Windows::Foundation::IInspectable const& value)
    {
        double newValue = winrt::unbox_value<double>(value);
        // 将值限制在 0-100 范围内
        newValue = std::max(0.0, std::min(100.0, newValue));
        return winrt::box_value(newValue);
    }

    void OnValueChanged(double oldValue, double newValue)
    {
        // 处理值变更
        OutputDebugStringW((L"Value changed from " + std::to_wstring(oldValue) + 
                           L" to " + std::to_wstring(newValue) + L"\n").c_str());
    }
};
```

### 附加属性

附加属性允许子元素存储由父元素定义的属性值。

```cpp
// 附加属性示例
class AttachedPropertyProvider
{
private:
    static winrt::Microsoft::UI::Xaml::DependencyProperty s_dockProperty;

public:
    // 注册附加属性
    static void RegisterAttachedProperties()
    {
        s_dockProperty = winrt::Microsoft::UI::Xaml::DependencyProperty::RegisterAttached(
            L"Dock",
            winrt::xaml_typename<int32_t>(),
            winrt::xaml_typename<AttachedPropertyProvider>(),
            winrt::Microsoft::UI::Xaml::PropertyMetadata{
                winrt::box_value(0),
                &OnDockPropertyChanged
            });
    }

    // 附加属性访问器
    static winrt::Microsoft::UI::Xaml::DependencyProperty DockProperty() { return s_dockProperty; }

    static int32_t GetDock(winrt::Microsoft::UI::Xaml::DependencyObject const& element)
    {
        return winrt::unbox_value<int32_t>(element.GetValue(s_dockProperty));
    }

    static void SetDock(winrt::Microsoft::UI::Xaml::DependencyObject const& element, int32_t value)
    {
        element.SetValue(s_dockProperty, winrt::box_value(value));
    }

private:
    static void OnDockPropertyChanged(
        winrt::Microsoft::UI::Xaml::DependencyObject const& d,
        winrt::Microsoft::UI::Xaml::DependencyPropertyChangedEventArgs const& e)
    {
        // 处理附加属性变更
        if (auto parent = d.try_as<winrt::Microsoft::UI::Xaml::FrameworkElement>())
        {
            auto container = parent.Parent().try_as<winrt::Microsoft::UI::Xaml::Controls::Panel>();
            if (container)
            {
                // 触发布局更新
                container.InvalidateArrange();
            }
        }
    }
};
```

## 动画与视觉效果

### 故事板动画

```cpp
// 创建和控制动画
void CreateAndRunAnimation()
{
    // 创建双精度动画
    winrt::Microsoft::UI::Xaml::Media::Animation::DoubleAnimation opacityAnimation;
    opacityAnimation.From(1.0);
    opacityAnimation.To(0.0);
    opacityAnimation.Duration(winrt::Windows::Foundation::TimeSpan{std::chrono::seconds(2)});
    opacityAnimation.AutoReverse(true);
    opacityAnimation.RepeatBehavior(winrt::Microsoft::UI::Xaml::Media::Animation::RepeatBehavior::Forever());

    // 设置动画目标
    winrt::Microsoft::UI::Xaml::Media::Animation::Storyboard::SetTarget(
        opacityAnimation, targetElement());
    winrt::Microsoft::UI::Xaml::Media::Animation::Storyboard::SetTargetProperty(
        opacityAnimation, L"Opacity");

    // 创建故事板
    winrt::Microsoft::UI::Xaml::Media::Animation::Storyboard storyboard;
    storyboard.Children().Append(opacityAnimation);

    // 注册事件
    storyboard.Completed([this](auto&&, auto&&)
    {
        OutputDebugStringW(L"动画完成\n");
    });

    // 开始动画
    storyboard.Begin();
}

// 复杂的组合动画
void CreateComplexAnimation()
{
    auto storyboard = winrt::Microsoft::UI::Xaml::Media::Animation::Storyboard{};

    // 位移动画
    auto translateAnimation = winrt::Microsoft::UI::Xaml::Media::Animation::DoubleAnimation{};
    translateAnimation.From(0.0);
    translateAnimation.To(200.0);
    translateAnimation.Duration(winrt::Windows::Foundation::TimeSpan{std::chrono::milliseconds(500)});
    translateAnimation.EasingFunction(winrt::Microsoft::UI::Xaml::Media::Animation::QuadraticEase{});

    winrt::Microsoft::UI::Xaml::Media::Animation::Storyboard::SetTarget(translateAnimation, targetElement());
    winrt::Microsoft::UI::Xaml::Media::Animation::Storyboard::SetTargetProperty(
        translateAnimation, L"(UIElement.RenderTransform).(TranslateTransform.X)");

    // 缩放动画
    auto scaleAnimation = winrt::Microsoft::UI::Xaml::Media::Animation::DoubleAnimation{};
    scaleAnimation.From(1.0);
    scaleAnimation.To(1.5);
    scaleAnimation.Duration(winrt::Windows::Foundation::TimeSpan{std::chrono::milliseconds(300)});
    scaleAnimation.BeginTime(winrt::Windows::Foundation::TimeSpan{std::chrono::milliseconds(200)});

    winrt::Microsoft::UI::Xaml::Media::Animation::Storyboard::SetTarget(scaleAnimation, targetElement());
    winrt::Microsoft::UI::Xaml::Media::Animation::Storyboard::SetTargetProperty(
        scaleAnimation, L"(UIElement.RenderTransform).(ScaleTransform.ScaleX)");

    storyboard.Children().Append(translateAnimation);
    storyboard.Children().Append(scaleAnimation);
    storyboard.Begin();
}
```

### Composition API

```cpp
// 使用 Composition API 创建高性能动画
void CreateCompositionAnimation()
{
    // 获取元素的 Visual
    auto elementVisual = winrt::Microsoft::UI::Xaml::Hosting::ElementCompositionPreview::GetElementVisual(targetElement());
    auto compositor = elementVisual.Compositor();

    // 创建旋转动画
    auto rotationAnimation = compositor.CreateScalarKeyFrameAnimation();
    rotationAnimation.InsertKeyFrame(0.0f, 0.0f);
    rotationAnimation.InsertKeyFrame(1.0f, 360.0f);
    rotationAnimation.Duration(winrt::Windows::Foundation::TimeSpan{std::chrono::seconds(2)});
    rotationAnimation.IterationBehavior(winrt::Microsoft::UI::Composition::AnimationIterationBehavior::Forever);

    // 创建缩放动画
    auto scaleAnimation = compositor.CreateVector3KeyFrameAnimation();
    scaleAnimation.InsertKeyFrame(0.0f, {1.0f, 1.0f, 1.0f});
    scaleAnimation.InsertKeyFrame(0.5f, {1.2f, 1.2f, 1.0f});
    scaleAnimation.InsertKeyFrame(1.0f, {1.0f, 1.0f, 1.0f});
    scaleAnimation.Duration(winrt::Windows::Foundation::TimeSpan{std::chrono::seconds(1)});
    scaleAnimation.IterationBehavior(winrt::Microsoft::UI::Composition::AnimationIterationBehavior::Forever);

    // 应用动画
    elementVisual.StartAnimation(L"RotationAngleInDegrees", rotationAnimation);
    elementVisual.StartAnimation(L"Scale", scaleAnimation);
}

// 创建自定义视觉效果
void CreateCustomVisualEffect()
{
    auto compositor = winrt::Microsoft::UI::Xaml::Window::Current().Compositor();
    
    // 创建模糊效果
    auto blurEffect = winrt::Microsoft::UI::Composition::Effects::GaussianBlurEffect{};
    blurEffect.Name(L"Blur");
    blurEffect.BlurAmount(10.0f);
    blurEffect.Source(winrt::Microsoft::UI::Composition::CompositionEffectSourceParameter{L"Source"});

    // 创建效果工厂
    auto effectFactory = compositor.CreateEffectFactory(blurEffect);
    
    // 创建效果画刷
    auto effectBrush = effectFactory.CreateBrush();
    effectBrush.SetSourceParameter(L"Source", compositor.CreateBackdropBrush());

    // 创建精灵视觉并应用效果
    auto spriteVisual = compositor.CreateSpriteVisual();
    spriteVisual.Brush(effectBrush);
    spriteVisual.Size({200.0f, 200.0f});

    // 将视觉添加到元素
    winrt::Microsoft::UI::Xaml::Hosting::ElementCompositionPreview::SetElementChildVisual(
        targetElement(), spriteVisual);
}
```

## 多线程与同步

### 调度器使用

```cpp
// UI 线程调度
winrt::fire_and_forget UpdateUIFromBackgroundThread()
{
    // 在后台线程执行
    co_await winrt::resume_background();
    
    // 执行耗时操作
    auto data = ProcessLargeDataSet();
    
    // 切换到 UI 线程
    co_await winrt::resume_foreground(Dispatcher());
    
    // 更新 UI
    dataList().ItemsSource(data);
}

// 使用特定调度器
void DispatchToSpecificQueue()
{
    auto dispatcherQueue = winrt::Microsoft::UI::Dispatching::DispatcherQueue::GetForCurrentThread();
    
    dispatcherQueue.TryEnqueue([this]()
    {
        // 在调度器队列中执行
        statusText().Text(L"更新完成");
    });
    
    // 高优先级任务
    dispatcherQueue.TryEnqueue(
        winrt::Microsoft::UI::Dispatching::DispatcherQueuePriority::High,
        [this]()
        {
            // 高优先级更新
            criticalStatusText().Text(L"紧急更新");
        });
}
```

### 线程同步

```cpp
// 使用互斥锁保护共享资源
class ThreadSafeContainer
{
private:
    mutable std::mutex m_mutex;
    std::vector<hstring> m_data;

public:
    void AddItem(hstring const& item)
    {
        std::lock_guard<std::mutex> lock(m_mutex);
        m_data.push_back(item);
    }

    std::vector<hstring> GetItems() const
    {
        std::lock_guard<std::mutex> lock(m_mutex);
        return m_data;
    }

    size_t Size() const
    {
        std::lock_guard<std::mutex> lock(m_mutex);
        return m_data.size();
    }
};

// 使用读写锁提高性能
class ReadWriteContainer
{
private:
    mutable std::shared_mutex m_mutex;
    std::unordered_map<hstring, winrt::Windows::Foundation::IInspectable> m_cache;

public:
    winrt::Windows::Foundation::IInspectable Get(hstring const& key) const
    {
        std::shared_lock<std::shared_mutex> lock(m_mutex);
        auto it = m_cache.find(key);
        return it != m_cache.end() ? it->second : nullptr;
    }

    void Set(hstring const& key, winrt::Windows::Foundation::IInspectable const& value)
    {
        std::unique_lock<std::shared_mutex> lock(m_mutex);
        m_cache[key] = value;
    }

    void Remove(hstring const& key)
    {
        std::unique_lock<std::shared_mutex> lock(m_mutex);
        m_cache.erase(key);
    }
};
```

## Win32 API 集成

### 混合 Win32 和 WinRT

```cpp
// 获取窗口句柄
HWND GetWindowHandle()
{
    auto windowNative = this->try_as<::IWindowNative>();
    HWND hwnd = nullptr;
    if (windowNative)
    {
        windowNative->get_WindowHandle(&hwnd);
    }
    return hwnd;
}

// 使用 Win32 API
void UseWin32APIs()
{
    HWND hwnd = GetWindowHandle();
    if (hwnd)
    {
        // 设置窗口属性
        SetWindowText(hwnd, L"自定义窗口标题");
        
        // 获取窗口位置
        RECT rect;
        GetWindowRect(hwnd, &rect);
        
        // 移动窗口
        SetWindowPos(hwnd, nullptr, 100, 100, 800, 600, SWP_NOZORDER);
        
        // 设置窗口图标
        HICON icon = LoadIcon(GetModuleHandle(nullptr), MAKEINTRESOURCE(IDI_APPLICATION));
        SendMessage(hwnd, WM_SETICON, ICON_BIG, reinterpret_cast<LPARAM>(icon));
    }
}

// 子类化窗口过程
LRESULT CALLBACK CustomWindowProc(HWND hwnd, UINT uMsg, WPARAM wParam, LPARAM lParam)
{
    switch (uMsg)
    {
    case WM_CLOSE:
        {
            // 自定义关闭处理
            int result = MessageBox(hwnd, L"确定要关闭窗口吗？", L"确认", MB_YESNO);
            if (result == IDNO)
            {
                return 0; // 阻止关闭
            }
        }
        break;
    
    case WM_SIZE:
        {
            // 处理窗口大小变化
            int width = LOWORD(lParam);
            int height = HIWORD(lParam);
            OutputDebugStringW((L"窗口大小: " + std::to_wstring(width) + 
                               L"x" + std::to_wstring(height) + L"\n").c_str());
        }
        break;
    }
    
    return CallWindowProc(reinterpret_cast<WNDPROC>(GetWindowLongPtr(hwnd, GWLP_USERDATA)), 
                          hwnd, uMsg, wParam, lParam);
}

void SubclassWindow()
{
    HWND hwnd = GetWindowHandle();
    if (hwnd)
    {
        // 保存原始窗口过程
        WNDPROC originalProc = reinterpret_cast<WNDPROC>(
            SetWindowLongPtr(hwnd, GWLP_WNDPROC, reinterpret_cast<LONG_PTR>(CustomWindowProc)));
        
        // 存储原始过程地址
        SetWindowLongPtr(hwnd, GWLP_USERDATA, reinterpret_cast<LONG_PTR>(originalProc));
    }
}
```

## 总结

本部分深入介绍了 WinUI 3 WinRT C++ 的高级特性：

1. **异步编程**：基于协程的现代异步模型
2. **COM 互操作**：与传统 COM 组件的集成
3. **内存管理**：RAII 原则和生命周期控制
4. **自定义控件**：用户控件和模板化控件开发
5. **依赖属性**：数据绑定和样式系统的基础
6. **动画效果**：故事板和 Composition API
7. **多线程**：线程同步和调度器使用
8. **Win32 集成**：混合使用 Win32 和 WinRT API

这些高级特性为开发复杂的企业级应用程序提供了强大的基础。

---

*这是 WinUI 3 WinRT C++ 完整教程的第三部分。下一部分将涵盖性能优化、部署发布和最佳实践等内容。*