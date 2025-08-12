# WinUI 3 WinRT C++ 开发完整教程 - 第六部分：实战技巧与最佳实践

## 常见开发问题与解决方案

### 1. 编译错误解决

#### 问题：找不到生成的头文件

```cpp
// 错误示例：包含顺序错误
#include "MainWindow.xaml.h"
#include "pch.h"  // 应该在最前面

// 正确做法
#include "pch.h"
#include "MainWindow.xaml.h"
#if __has_include("MainWindow.g.cpp")
#include "MainWindow.g.cpp"
#endif
```

**解决方案**：
1. 确保 `pch.h` 始终第一个包含
2. 使用条件包含生成的文件
3. 检查项目的"预编译头文件"设置

#### 问题：IDL 编译失败

```idl
// 错误示例：语法错误
namespace WinUI3App1C__
{
    runtimeclass MainWindow : Microsoft.UI.Xaml.Window
    {
        MainWindow();
        String GetData();  // 缺少参数会导致编译错误
    }
}

// 正确做法
namespace WinUI3App1C__
{
    [default_interface]
    runtimeclass MainWindow : Microsoft.UI.Xaml.Window
    {
        MainWindow();
        String GetData(String input);  // 明确指定参数
    }
}
```

**解决方案**：
1. 仔细检查 IDL 语法
2. 确保所有方法都有明确的参数和返回类型
3. 使用 `default_interface` 标记默认接口
4. 确保 IDL 文件与 C++ 代码一致，但凡哪边缺少都会出现意料之外的编译错误难以排查！
5. 确保 runtimeclass 的继承关系正确，例如继承自 `Microsoft.UI.Xaml.Window`。不能缺少继承，否则错误也难以排查。

### 2. 运行时错误处理

#### 问题：访问空指针

```cpp
// 危险代码：未检查空指针
void MainWindow::OnButtonClick()
{
    auto item = listView().SelectedItem();
    auto text = winrt::unbox_value<hstring>(item);  // 如果 item 为 null 会崩溃
    statusText().Text(text);
}

// 安全做法
void MainWindow::OnButtonClick()
{
    auto item = listView().SelectedItem();
    if (item != nullptr)
    {
        try
        {
            auto text = winrt::unbox_value<hstring>(item);
            statusText().Text(text);
        }
        catch (winrt::hresult_error const& ex)
        {
            // 处理类型转换错误
            OutputDebugStringW((L"类型转换失败: " + ex.message()).c_str());
        }
    }
    else
    {
        statusText().Text(L"请先选择一个项目");
    }
}
```

#### 问题：事件处理器中的异常

```cpp
// 项目中的安全事件处理模式
void MainWindow::addManualListButton_Click(
    winrt::Windows::Foundation::IInspectable const& sender,
    winrt::Microsoft::UI::Xaml::RoutedEventArgs const& e)
{
    try
    {
        manualIndex++;
        manualList().Items().Append(winrt::box_value(hstring{L"Item" + winrt::to_hstring(manualIndex)}));
        
        if (manualList().SelectedItem() == nullptr)
        {
            manualList().SelectedIndex(0);
        }
    }
    catch (winrt::hresult_error const& ex)
    {
        // 记录错误但不让应用程序崩溃
        OutputDebugStringW((L"按钮点击处理失败: " + ex.message()).c_str());
        
        // 可选：显示用户友好的错误消息
        ShowErrorMessage(L"操作失败，请重试");
    }
    catch (...)
    {
        OutputDebugStringW(L"按钮点击处理出现未知错误\n");
    }
}

// 错误消息显示辅助函数
void MainWindow::ShowErrorMessage(hstring const& message)
{
    // 使用 ContentDialog 显示错误
    auto dialog = winrt::Microsoft::UI::Xaml::Controls::ContentDialog{};
    dialog.Title(winrt::box_value(L"错误"));
    dialog.Content(winrt::box_value(message));
    dialog.CloseButtonText(L"确定");
    dialog.XamlRoot(this->Content().XamlRoot());
    
    // 异步显示对话框
    dialog.ShowAsync();
}
```

### 3. 线程安全问题

#### 问题：在后台线程访问 UI

```cpp
// 错误做法：直接在后台线程访问 UI
void MainWindow::LoadDataInBackground()
{
    std::thread([this]()
    {
        // 后台线程
        auto data = LoadLargeDataSet();
        
        // 错误！在后台线程直接访问 UI 会崩溃
        dataList().ItemsSource(data);
    }).detach();
}

// 正确做法：使用调度器切换到 UI 线程
winrt::fire_and_forget MainWindow::LoadDataInBackgroundSafe()
{
    // 切换到后台线程
    co_await winrt::resume_background();
    
    // 在后台线程执行耗时操作
    auto data = LoadLargeDataSet();
    
    // 切换回 UI 线程
    co_await winrt::resume_foreground(Dispatcher());
    
    // 安全地更新 UI
    dataList().ItemsSource(data);
}
```

#### 使用调度器模式

```cpp
// 调度器辅助类
class UIDispatcher
{
private:
    winrt::Microsoft::UI::Dispatching::DispatcherQueue m_dispatcherQueue{nullptr};
    
public:
    UIDispatcher()
    {
        m_dispatcherQueue = winrt::Microsoft::UI::Dispatching::DispatcherQueue::GetForCurrentThread();
    }
    
    // 在 UI 线程执行操作
    template<typename TAction>
    void BeginInvoke(TAction&& action)
    {
        if (m_dispatcherQueue)
        {
            m_dispatcherQueue.TryEnqueue([action = std::forward<TAction>(action)]()
            {
                try
                {
                    action();
                }
                catch (...)
                {
                    OutputDebugStringW(L"UI 调度器中的操作失败\n");
                }
            });
        }
    }
    
    // 检查是否在 UI 线程
    bool HasThreadAccess() const
    {
        return m_dispatcherQueue && m_dispatcherQueue.HasThreadAccess();
    }
};

// 使用示例
class MainWindow
{
private:
    UIDispatcher m_uiDispatcher;
    
public:
    void UpdateUIFromAnyThread(hstring const& message)
    {
        if (m_uiDispatcher.HasThreadAccess())
        {
            // 已经在 UI 线程
            statusText().Text(message);
        }
        else
        {
            // 调度到 UI 线程
            m_uiDispatcher.BeginInvoke([this, message]()
            {
                statusText().Text(message);
            });
        }
    }
};
```

## 性能优化最佳实践

### 1. 避免不必要的装箱/拆箱

```cpp
// 低效代码：频繁装箱
void AddManyItemsInefficient()
{
    auto items = winrt::single_threaded_observable_vector<winrt::Windows::Foundation::IInspectable>();
    
    for (int i = 0; i < 10000; ++i)
    {
        // 每次都进行装箱操作
        items.Append(winrt::box_value(winrt::to_hstring(i)));
    }
    
    listView().ItemsSource(items);
}

// 高效代码：减少装箱
void AddManyItemsEfficient()
{
    // 使用强类型集合
    auto items = winrt::single_threaded_observable_vector<hstring>();
    
    // 预分配空间（如果可能）
    std::vector<hstring> tempItems;
    tempItems.reserve(10000);
    
    for (int i = 0; i < 10000; ++i)
    {
        tempItems.push_back(winrt::to_hstring(i));
    }
    
    // 批量添加
    for (auto&& item : tempItems)
    {
        items.Append(item);
    }
    
    listView().ItemsSource(items);
}
```

### 2. 使用虚拟化

```xml
<!-- 对大数据集启用虚拟化 -->
<ListView x:Name="largeDataList"
          VirtualizationMode="Recycling"
          IncrementalLoadingThreshold="10"
          DataVirtualizationEnabled="True">
    <ListView.ItemsPanel>
        <ItemsPanelTemplate>
            <VirtualizingStackPanel/>
        </ItemsPanelTemplate>
    </ListView.ItemsPanel>
    
    <ListView.ItemTemplate>
        <DataTemplate>
            <Grid Height="50">
                <TextBlock Text="{Binding}" VerticalAlignment="Center"/>
            </Grid>
        </DataTemplate>
    </ListView.ItemTemplate>
</ListView>
```

```cpp
// 实现增量加载
class IncrementalDataSource : public winrt::implements<IncrementalDataSource, 
    winrt::Windows::Foundation::Collections::IObservableVector<hstring>,
    winrt::Microsoft::UI::Xaml::Data::ISupportIncrementalLoading>
{
private:
    std::vector<hstring> m_data;
    bool m_hasMoreItems = true;
    uint32_t m_currentIndex = 0;
    
public:
    // 实现增量加载
    winrt::Windows::Foundation::IAsyncOperation<winrt::Microsoft::UI::Xaml::Data::LoadMoreItemsResult> 
    LoadMoreItemsAsync(uint32_t count)
    {
        co_await winrt::resume_background();
        
        // 模拟数据加载
        std::this_thread::sleep_for(std::chrono::milliseconds(100));
        
        uint32_t loadedCount = 0;
        for (uint32_t i = 0; i < count && m_currentIndex < 10000; ++i)
        {
            m_data.push_back(L"项目 " + winrt::to_hstring(m_currentIndex++));
            loadedCount++;
        }
        
        m_hasMoreItems = m_currentIndex < 10000;
        
        co_await winrt::resume_foreground(winrt::Microsoft::UI::Dispatching::DispatcherQueue::GetForCurrentThread());
        
        // 通知集合变更
        if (loadedCount > 0)
        {
            NotifyItemsAdded(m_data.size() - loadedCount, loadedCount);
        }
        
        co_return winrt::Microsoft::UI::Xaml::Data::LoadMoreItemsResult{ loadedCount };
    }
    
    bool HasMoreItems() const
    {
        return m_hasMoreItems;
    }
    
private:
    void NotifyItemsAdded(uint32_t startIndex, uint32_t count)
    {
        // 触发集合变更事件
        for (uint32_t i = 0; i < count; ++i)
        {
            if (m_vectorChanged)
            {
                m_vectorChanged(*this, winrt::Windows::Foundation::Collections::VectorChangedEventArgs{
                    winrt::Windows::Foundation::Collections::CollectionChange::ItemInserted,
                    startIndex + i
                });
            }
        }
    }
    
    winrt::event<winrt::Windows::Foundation::Collections::VectorChangedEventHandler<hstring>> m_vectorChanged;
};
```

### 3. 优化数据绑定

```cpp
// 使用 x:Bind 而不是 Binding（更高性能）
// XAML:
// <TextBlock Text="{x:Bind Item.Title, Mode=OneWay}"/> // 优先选择
// <TextBlock Text="{Binding Title, Mode=OneWay}"/>     // 性能较低

// 实现高效的属性变更通知
class OptimizedViewModel : public winrt::implements<OptimizedViewModel, 
    winrt::Microsoft::UI::Xaml::Data::INotifyPropertyChanged>
{
private:
    hstring m_title;
    int32_t m_count;
    bool m_isNotifying = false;  // 防止递归通知
    
    winrt::event<winrt::Microsoft::UI::Xaml::Data::PropertyChangedEventHandler> m_propertyChanged;
    
public:
    // 批量属性更新
    template<typename TAction>
    void BatchUpdate(TAction&& action)
    {
        m_isNotifying = true;
        action();
        m_isNotifying = false;
        
        // 批量通知所有变更
        RaisePropertyChanged(L"");  // 空字符串表示所有属性
    }
    
    hstring Title() const { return m_title; }
    void Title(hstring const& value)
    {
        if (m_title != value)
        {
            m_title = value;
            if (!m_isNotifying)
            {
                RaisePropertyChanged(L"Title");
            }
        }
    }
    
    int32_t Count() const { return m_count; }
    void Count(int32_t value)
    {
        if (m_count != value)
        {
            m_count = value;
            if (!m_isNotifying)
            {
                RaisePropertyChanged(L"Count");
            }
        }
    }
    
private:
    void RaisePropertyChanged(hstring const& propertyName)
    {
        if (m_propertyChanged)
        {
            m_propertyChanged(*this, winrt::Microsoft::UI::Xaml::Data::PropertyChangedEventArgs{propertyName});
        }
    }
};
```

## 内存管理和泄漏预防

### 1. 理解引用计数

```cpp
// 项目中的引用计数调试功能
bool DebugGetCurrentRefCount(winrt::Windows::Foundation::IInspectable const& obj, uint32_t& refCount)
{
    IUnknown* pUnk = winrt::get_unknown(obj);
    if (pUnk)
    {
        // 临时增加引用计数来获取当前值
        refCount = pUnk->AddRef() - 1;
        pUnk->Release();  // 立即释放增加的引用
        return true;
    }
    return false;
}

// 在构造函数中使用（来自项目代码）
MainWindow::MainWindow()
{
    InitializeComponent();

    uint32_t refCount = 0;
    if (DebugGetCurrentRefCount(*this, refCount))
    {
        OutputDebugStringW((L"MainWindow 构造后引用计数 = " + winrt::to_hstring(refCount)).c_str());
    }
}
```

### 2. 避免循环引用

```cpp
// 问题：父子对象相互引用导致内存泄漏
class Parent
{
private:
    std::vector<std::shared_ptr<Child>> m_children;
    
public:
    void AddChild(std::shared_ptr<Child> child)
    {
        child->SetParent(shared_from_this());  // 危险：可能创建循环引用
        m_children.push_back(child);
    }
};

class Child
{
private:
    std::shared_ptr<Parent> m_parent;  // 强引用可能导致循环引用
    
public:
    void SetParent(std::shared_ptr<Parent> parent)
    {
        m_parent = parent;
    }
};

// 解决方案：使用弱引用
class SafeParent
{
private:
    std::vector<std::shared_ptr<SafeChild>> m_children;
    
public:
    void AddChild(std::shared_ptr<SafeChild> child)
    {
        child->SetParent(shared_from_this());
        m_children.push_back(child);
    }
};

class SafeChild
{
private:
    std::weak_ptr<SafeParent> m_parent;  // 使用弱引用
    
public:
    void SetParent(std::shared_ptr<SafeParent> parent)
    {
        m_parent = parent;
    }
    
    void DoSomethingWithParent()
    {
        if (auto parent = m_parent.lock())  // 安全地获取强引用
        {
            // 使用父对象
            parent->SomeMethod();
        }
    }
};
```

### 3. 事件处理器的生命周期管理

```cpp
// 使用弱引用防止事件处理器导致的内存泄漏
class EventSafeWindow
{
private:
    winrt::event_token m_buttonClickToken;
    
public:
    EventSafeWindow()
    {
        InitializeComponent();
        
        // 使用弱引用的事件处理器
        auto weakThis = winrt::make_weak(*this);
        m_buttonClickToken = myButton().Click([weakThis](auto&&, auto&&)
        {
            if (auto strongThis = weakThis.get())
            {
                strongThis->OnButtonClicked();
            }
        });
    }
    
    ~EventSafeWindow()
    {
        // 清理事件订阅
        myButton().Click(m_buttonClickToken);
    }
    
private:
    void OnButtonClicked()
    {
        // 处理按钮点击
    }
};
```

## 调试技巧和工具使用

### 1. Visual Studio 调试技巧

#### 条件断点

```cpp
void MainWindow::addManualListButton_Click(
    winrt::Windows::Foundation::IInspectable const& sender,
    winrt::Microsoft::UI::Xaml::RoutedEventArgs const& e)
{
    manualIndex++;
    
    // 设置条件断点：manualIndex > 5
    if (manualIndex > 5)
    {
        __debugbreak();  // 仅在特定条件下中断
    }
    
    manualList().Items().Append(winrt::box_value(hstring{L"Item" + winrt::to_hstring(manualIndex)}));
}
```

#### 监视窗口使用

```cpp
// 在监视窗口中使用这些表达式：
// 1. winrt::get_class_name(sender)  - 查看对象类型
// 2. sender.try_as<Button>() != nullptr  - 检查类型转换
// 3. manualList().Items().Size()  - 查看集合大小
```

### 2. 输出调试信息

```cpp
// 结构化调试输出
class DebugLogger
{
public:
    static void LogInfo(hstring const& message)
    {
        auto timestamp = std::chrono::system_clock::now();
        auto time_t = std::chrono::system_clock::to_time_t(timestamp);
        
        std::wostringstream ss;
        ss << L"[INFO " << std::put_time(std::localtime(&time_t), L"%H:%M:%S") << L"] " 
           << message.c_str() << L"\n";
        
        OutputDebugStringW(ss.str().c_str());
    }
    
    static void LogError(hstring const& message)
    {
        OutputDebugStringW((L"[ERROR] " + message + L"\n").c_str());
    }
    
    template<typename... Args>
    static void LogFormat(hstring const& format, Args&&... args)
    {
        try
        {
            auto formatted = std::format(format.c_str(), std::forward<Args>(args)...);
            LogInfo(hstring{formatted});
        }
        catch (...)
        {
            LogError(L"格式化日志消息失败");
        }
    }
};

// 使用示例
void MainWindow::OnSomeEvent()
{
    DebugLogger::LogInfo(L"事件处理开始");
    DebugLogger::LogFormat(L"当前项目数量: {}", manualList().Items().Size());
    DebugLogger::LogError(L"发生了错误");
}
```

### 3. 内存泄漏检测

```cpp
// 自定义内存跟踪器
class MemoryTracker
{
private:
    static std::atomic<size_t> s_allocCount;
    static std::atomic<size_t> s_deallocCount;
    static std::mutex s_mutex;
    static std::unordered_map<void*, size_t> s_allocations;
    
public:
    static void* TrackedAlloc(size_t size)
    {
        void* ptr = malloc(size);
        if (ptr)
        {
            std::lock_guard<std::mutex> lock(s_mutex);
            s_allocations[ptr] = size;
            s_allocCount++;
        }
        return ptr;
    }
    
    static void TrackedFree(void* ptr)
    {
        if (ptr)
        {
            std::lock_guard<std::mutex> lock(s_mutex);
            auto it = s_allocations.find(ptr);
            if (it != s_allocations.end())
            {
                s_allocations.erase(it);
                s_deallocCount++;
            }
            free(ptr);
        }
    }
    
    static void ReportLeaks()
    {
        std::lock_guard<std::mutex> lock(s_mutex);
        if (!s_allocations.empty())
        {
            DebugLogger::LogFormat(L"检测到 {} 处内存泄漏", s_allocations.size());
            for (auto&& [ptr, size] : s_allocations)
            {
                DebugLogger::LogFormat(L"泄漏: 地址={:p}, 大小={}", ptr, size);
            }
        }
    }
};
```

## 代码组织和架构模式

### 1. MVVM 模式实现

```cpp
// Model 层
namespace Models
{
    struct User
    {
        hstring Name;
        int32_t Age;
        hstring Email;
    };
}

// ViewModel 层
namespace ViewModels
{
    struct UserViewModel : winrt::implements<UserViewModel, winrt::Microsoft::UI::Xaml::Data::INotifyPropertyChanged>
    {
    private:
        Models::User m_user;
        winrt::Windows::Foundation::Collections::IObservableVector<hstring> m_validationErrors;
        winrt::event<winrt::Microsoft::UI::Xaml::Data::PropertyChangedEventHandler> m_propertyChanged;
        
    public:
        UserViewModel()
        {
            m_validationErrors = winrt::single_threaded_observable_vector<hstring>();
        }
        
        // 属性
        hstring Name() const { return m_user.Name; }
        void Name(hstring const& value)
        {
            if (m_user.Name != value)
            {
                m_user.Name = value;
                ValidateName();
                RaisePropertyChanged(L"Name");
            }
        }
        
        int32_t Age() const { return m_user.Age; }
        void Age(int32_t value)
        {
            if (m_user.Age != value)
            {
                m_user.Age = value;
                ValidateAge();
                RaisePropertyChanged(L"Age");
            }
        }
        
        winrt::Windows::Foundation::Collections::IObservableVector<hstring> ValidationErrors() const
        {
            return m_validationErrors;
        }
        
        bool IsValid() const
        {
            return m_validationErrors.Size() == 0;
        }
        
        // 命令
        winrt::fire_and_forget SaveAsync()
        {
            if (!IsValid()) return;
            
            // 保存逻辑
            co_await SaveUserToDatabase(m_user);
        }
        
    private:
        void ValidateName()
        {
            m_validationErrors.Clear();
            if (m_user.Name.empty())
            {
                m_validationErrors.Append(L"姓名不能为空");
            }
            RaisePropertyChanged(L"IsValid");
        }
        
        void ValidateAge()
        {
            if (m_user.Age < 0 || m_user.Age > 150)
            {
                m_validationErrors.Append(L"年龄必须在 0-150 之间");
            }
            RaisePropertyChanged(L"IsValid");
        }
        
        winrt::Windows::Foundation::IAsyncAction SaveUserToDatabase(Models::User const& user)
        {
            // 模拟异步保存
            co_await winrt::resume_background();
            std::this_thread::sleep_for(std::chrono::seconds(1));
        }
        
        void RaisePropertyChanged(hstring const& propertyName)
        {
            if (m_propertyChanged)
            {
                m_propertyChanged(*this, winrt::Microsoft::UI::Xaml::Data::PropertyChangedEventArgs{propertyName});
            }
        }
    };
}

// View 层（XAML + Code-behind）
namespace Views
{
    struct UserView
    {
        UserView()
        {
            m_viewModel = winrt::make<ViewModels::UserViewModel>();
            DataContext(m_viewModel);
        }
        
    private:
        winrt::ViewModels::UserViewModel m_viewModel{nullptr};
    };
}
```

### 2. 服务容器模式

```cpp
// 服务接口定义
namespace Services
{
    struct IDataService
    {
        virtual winrt::Windows::Foundation::IAsyncOperation<std::vector<Models::User>> GetUsersAsync() = 0;
        virtual winrt::Windows::Foundation::IAsyncAction SaveUserAsync(Models::User const& user) = 0;
    };
    
    struct INavigationService
    {
        virtual void NavigateTo(hstring const& pageType) = 0;
        virtual void GoBack() = 0;
    };
}

// 服务容器
class ServiceContainer
{
private:
    static std::unordered_map<winrt::guid, std::shared_ptr<void>> s_services;
    
public:
    template<typename TInterface, typename TImplementation, typename... Args>
    static void RegisterSingleton(Args&&... args)
    {
        auto service = std::make_shared<TImplementation>(std::forward<Args>(args)...);
        s_services[winrt::guid_of<TInterface>()] = service;
    }
    
    template<typename TInterface>
    static std::shared_ptr<TInterface> GetService()
    {
        auto it = s_services.find(winrt::guid_of<TInterface>());
        if (it != s_services.end())
        {
            return std::static_pointer_cast<TInterface>(it->second);
        }
        return nullptr;
    }
};

// 服务注册
void RegisterServices()
{
    ServiceContainer::RegisterSingleton<Services::IDataService, ConcreteDataService>();
    ServiceContainer::RegisterSingleton<Services::INavigationService, ConcreteNavigationService>();
}
```

## 部署和发布注意事项

### 1. 应用程序清单配置

```xml
<!-- Package.appxmanifest -->
<Package>
    <Identity Name="YourApp" 
              Publisher="CN=YourCompany" 
              Version="1.0.0.0" />
    
    <Properties>
        <DisplayName>WinUI 3 应用程序</DisplayName>
        <PublisherDisplayName>您的公司</PublisherDisplayName>
        <Logo>Assets\StoreLogo.png</Logo>
    </Properties>
    
    <Dependencies>
        <TargetDeviceFamily Name="Windows.Universal" 
                            MinVersion="10.0.17763.0" 
                            MaxVersionTested="10.0.22000.0" />
        <PackageDependency Name="Microsoft.WindowsAppRuntime.1.4" 
                           MinVersion="1.4.231008000.0" 
                           Publisher="CN=Microsoft Corporation, O=Microsoft Corporation, L=Redmond, S=Washington, C=US" />
    </Dependencies>
    
    <Applications>
        <Application Id="App" 
                     Executable="$targetnametoken$.exe" 
                     EntryPoint="$targetentrypoint$">
            <uap:VisualElements DisplayName="WinUI 3 应用程序"
                                Description="应用程序描述"
                                BackgroundColor="transparent"
                                Square150x150Logo="Assets\Square150x150Logo.png"
                                Square44x44Logo="Assets\Square44x44Logo.png">
                <uap:DefaultTile Wide310x150Logo="Assets\Wide310x150Logo.png" />
            </uap:VisualElements>
        </Application>
    </Applications>
</Package>
```

### 2. 发布配置

```xml
<!-- 项目文件中的发布配置 -->
<PropertyGroup Condition="'$(Configuration)'=='Release'">
    <Optimize>true</Optimize>
    <DebugType>pdbonly</DebugType>
    <DefineConstants>NDEBUG</DefineConstants>
    <TreatWarningsAsErrors>true</TreatWarningsAsErrors>
    <WarningsNotAsErrors>4996</WarningsNotAsErrors>
</PropertyGroup>
```

### 3. 性能分析和优化

```cpp
// 性能计时器
class PerformanceTimer
{
private:
    std::chrono::high_resolution_clock::time_point m_start;
    hstring m_name;
    
public:
    PerformanceTimer(hstring const& name) : m_name(name)
    {
        m_start = std::chrono::high_resolution_clock::now();
    }
    
    ~PerformanceTimer()
    {
        auto end = std::chrono::high_resolution_clock::now();
        auto duration = std::chrono::duration_cast<std::chrono::milliseconds>(end - m_start);
        
        DebugLogger::LogFormat(L"性能: {} 用时 {}ms", m_name, duration.count());
    }
};

// 使用宏简化性能测量
#define MEASURE_PERFORMANCE(name) PerformanceTimer timer(name)

// 使用示例
void MainWindow::LoadLargeDataSet()
{
    MEASURE_PERFORMANCE(L"LoadLargeDataSet");
    
    // 执行耗时操作
    for (int i = 0; i < 100000; ++i)
    {
        // 处理数据
    }
}
```

## 总结

本部分涵盖了 WinUI 3 开发的实战技巧：

1. **问题解决**：常见编译和运行时错误的解决方案
2. **性能优化**：提升应用程序响应性和效率的技巧
3. **内存管理**：避免内存泄漏和正确管理对象生命周期
4. **调试技巧**：有效的调试方法和工具使用
5. **架构模式**：MVVM 和服务容器等设计模式
6. **部署发布**：应用程序打包和发布的注意事项

这些实战技巧将帮助您开发出高质量、高性能的 WinUI 3 应用程序。

---

*这是 WinUI 3 WinRT C++ 完整教程的最后一部分。通过这六个部分的学习，您应该已经掌握了从基础概念到高级技巧的完整知识体系。*