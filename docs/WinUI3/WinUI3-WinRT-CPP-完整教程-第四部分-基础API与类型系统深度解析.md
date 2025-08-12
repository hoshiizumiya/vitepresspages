# WinUI 3 WinRT C++ 开发完整教程 - 第四部分：基础API与类型系统深度解析

## WinRT 类型系统详解

### 基础类型映射

WinRT 定义了一套跨语言的类型系统。理解这些类型对于有效使用 C++/WinRT 至关重要：

| WinRT 类型 | C++/WinRT 类型 | C++ 原生类型 | 说明 |
|-----------|---------------|-------------|------|
| `Boolean` | `bool` | `bool` | 布尔值 |
| `Int8` | `int8_t` | `signed char` | 8位有符号整数 |
| `UInt8` | `uint8_t` | `unsigned char` | 8位无符号整数 |
| `Int16` | `int16_t` | `short` | 16位有符号整数 |
| `UInt16` | `uint16_t` | `unsigned short` | 16位无符号整数 |
| `Int32` | `int32_t` | `int` | 32位有符号整数 |
| `UInt32` | `uint32_t` | `unsigned int` | 32位无符号整数 |
| `Int64` | `int64_t` | `long long` | 64位有符号整数 |
| `UInt64` | `uint64_t` | `unsigned long long` | 64位无符号整数 |
| `Single` | `float` | `float` | 32位浮点数 |
| `Double` | `double` | `double` | 64位浮点数 |
| `Char16` | `char16_t` | `wchar_t` | UTF-16字符 |
| `String` | `winrt::hstring` | - | 不可变字符串 |
| `Object` | `winrt::Windows::Foundation::IInspectable` | - | 基础对象类型 |

### 深入理解 hstring

**hstring** 是 WinRT 字符串的核心类型，让我们深入了解它：

```cpp
// hstring 的内部结构（简化版）
class hstring
{
private:
    HSTRING m_handle;  // 内部句柄

public:
    // 构造函数详解
    hstring() noexcept;                           // 默认构造：空字符串
    hstring(std::wstring_view value);             // 从 wstring_view 构造
    hstring(wchar_t const* value);                // 从 C 风格字符串构造
    hstring(wchar_t const* first, wchar_t const* last); // 从范围构造
    
    // 核心方法
    wchar_t const* c_str() const noexcept;       // 获取 C 风格字符串
    uint32_t size() const noexcept;              // 获取字符数
    bool empty() const noexcept;                 // 检查是否为空
    
    // 操作符重载
    hstring& operator=(hstring&& other) noexcept;
    bool operator==(hstring const& other) const noexcept;
    bool operator<(hstring const& other) const noexcept;
};
```

**hstring 的高级用法**：

```cpp
void DemonstrateHString()
{
    // 1. 创建 hstring 的各种方式
    hstring empty{};                              // 空字符串
    hstring fromLiteral{L"Hello World"};         // 从字面量
    hstring fromStdString{std::wstring{L"Test"}}; // 从 std::wstring
    
    // 2. 性能优化的创建方式
    hstring efficient = winrt::to_hstring(42);   // 数字转字符串
    hstring formatted = std::format(L"Number: {}", 42); // C++20 格式化
    
    // 3. hstring 与 std::wstring 的转换
    std::wstring stdStr = std::wstring{fromLiteral};
    hstring backToHString{stdStr};
    
    // 4. 字符串操作
    bool isEmpty = fromLiteral.empty();
    size_t length = fromLiteral.size();
    wchar_t const* cStr = fromLiteral.c_str();
    
    // 5. 比较操作
    bool equal = (fromLiteral == hstring{L"Hello World"});
    bool less = (hstring{L"A"} < hstring{L"B"});
    
    OutputDebugStringW((L"hstring length: " + winrt::to_hstring(length)).c_str());
}
```

**hstring 的内存管理原理**：

```cpp
// hstring 使用 Windows String API (HSTRING)
// 内部实现参考伪代码：
class hstring_implementation
{
private:
    HSTRING m_string;
    
public:
    hstring_implementation(wchar_t const* value)
    {
        // 使用 Windows Runtime String API
        HRESULT hr = WindowsCreateString(value, 
                                        static_cast<UINT32>(wcslen(value)), 
                                        &m_string);
        winrt::check_hresult(hr);
    }
    
    ~hstring_implementation()
    {
        if (m_string)
        {
            WindowsDeleteString(m_string);  // 自动释放
        }
    }
    
    // 写时复制 (Copy-on-Write) 优化
    // 多个 hstring 可以共享同一块内存
};
```

### IInspectable 接口详解

**IInspectable** 是 WinRT 对象的基础接口，相当于 .NET 中的 `Object`：

```cpp
// IInspectable 接口定义（简化版）
interface IInspectable : IUnknown
{
    // 从 IUnknown 继承的方法
    virtual HRESULT QueryInterface(REFIID riid, void** ppv) = 0;
    virtual ULONG AddRef() = 0;
    virtual ULONG Release() = 0;
    
    // IInspectable 特有的方法
    virtual HRESULT GetIids(ULONG* iidCount, IID** iids) = 0;        // 获取支持的接口
    virtual HRESULT GetRuntimeClassName(HSTRING* className) = 0;      // 获取运行时类名
    virtual HRESULT GetTrustLevel(TrustLevel* trustLevel) = 0;        // 获取信任级别
};
```

**实际使用中的 IInspectable**：

```cpp
void DemonstrateIInspectable()
{
    // 1. 创建一个 WinRT 对象
    auto button = winrt::Microsoft::UI::Xaml::Controls::Button();
    
    // 2. 获取 IInspectable 接口
    winrt::Windows::Foundation::IInspectable inspectable = button;
    
    // 3. 查询接口（安全转换）
    auto control = inspectable.try_as<winrt::Microsoft::UI::Xaml::Controls::Control>();
    if (control)
    {
        // 安全使用 Control 接口
        control.FontSize(16.0);
    }
    
    // 4. 强制转换（如果失败会抛出异常）
    auto frameworkElement = inspectable.as<winrt::Microsoft::UI::Xaml::FrameworkElement>();
    
    // 5. 检查对象类型
    auto typeName = winrt::get_class_name(inspectable);
    OutputDebugStringW((L"对象类型: " + typeName).c_str());
}
```

## 基础API深入讲解

### Windows.Foundation 命名空间

这是 WinRT 的核心命名空间，包含最基础的类型和接口：

#### 1. Uri 类详解

```cpp
// Uri 类的核心用法
void DemonstrateUri()
{
    // 1. 创建 Uri 对象
    auto uri = winrt::Windows::Foundation::Uri{L"https://www.example.com/path?query=value#fragment"};
    
    // 2. 访问 Uri 组件
    hstring scheme = uri.SchemeName();        // "https"
    hstring host = uri.Host();                // "www.example.com"
    hstring path = uri.Path();                // "/path"
    hstring query = uri.Query();              // "?query=value"
    hstring fragment = uri.Fragment();        // "#fragment"
    int32_t port = uri.Port();                // 443 (HTTPS 默认端口)
    
    // 3. 完整 Uri 字符串
    hstring absoluteUri = uri.AbsoluteUri();  // 完整 URL
    
    // 4. Uri 验证
    bool isAbsolute = uri.Absolute();         // true
    
    // 5. 相对 Uri 处理
    auto baseUri = winrt::Windows::Foundation::Uri{L"https://www.example.com/"};
    auto relativeUri = winrt::Windows::Foundation::Uri{baseUri, L"subpath/file.html"};
    
    OutputDebugStringW((L"绝对 Uri: " + absoluteUri).c_str());
}
```

#### 2. DateTime 和 TimeSpan

```cpp
// 时间处理详解
void DemonstrateDateTime()
{
    // 1. DateTime 创建
    auto now = winrt::clock::now();                    // 当前时间
    auto epoch = winrt::Windows::Foundation::DateTime{}; // Unix 纪元时间
    
    // 2. TimeSpan 创建
    using namespace std::chrono;
    auto oneSecond = winrt::Windows::Foundation::TimeSpan{seconds(1)};
    auto oneMinute = winrt::Windows::Foundation::TimeSpan{minutes(1)};
    auto oneHour = winrt::Windows::Foundation::TimeSpan{hours(1)};
    
    // 3. 时间算术运算
    auto futureTime = now + oneHour;
    auto duration = futureTime - now;
    
    // 4. 时间转换
    auto systemTime = winrt::clock::to_sys(now);       // 转换为 std::chrono
    auto fileTime = winrt::clock::to_file_time(now);   // 转换为 FILETIME
    
    // 5. 格式化输出
    auto timeString = winrt::to_hstring(now.time_since_epoch().count());
    OutputDebugStringW((L"当前时间 (ticks): " + timeString).c_str());
}
```

#### 3. PropertyValue 工厂

PropertyValue 用于创建基础类型的 WinRT 包装器：

```cpp
void DemonstratePropertyValue()
{
    // 1. 创建各种类型的 PropertyValue
    auto boolValue = winrt::Windows::Foundation::PropertyValue::CreateBoolean(true);
    auto intValue = winrt::Windows::Foundation::PropertyValue::CreateInt32(42);
    auto doubleValue = winrt::Windows::Foundation::PropertyValue::CreateDouble(3.14159);
    auto stringValue = winrt::Windows::Foundation::PropertyValue::CreateString(L"Hello");
    
    // 2. 创建数组 PropertyValue
    std::array<int32_t, 3> numbers = {1, 2, 3};
    auto arrayValue = winrt::Windows::Foundation::PropertyValue::CreateInt32Array(numbers);
    
    // 3. 检查 PropertyValue 类型
    auto type = boolValue.Type();  // PropertyType::Boolean
    
    // 4. 从 PropertyValue 提取值
    bool extractedBool = boolValue.GetBoolean();
    int32_t extractedInt = intValue.GetInt32();
    
    // 5. 安全类型检查
    if (stringValue.Type() == winrt::Windows::Foundation::PropertyType::String)
    {
        hstring extractedString = stringValue.GetString();
        OutputDebugStringW((L"提取的字符串: " + extractedString).c_str());
    }
}
```

## 集合类型与操作

### IObservableVector 详解

这是项目中使用的核心集合类型，支持变更通知：

```cpp
// 从项目代码中的实际使用
void DemonstrateIObservableVector()
{
    // 1. 创建可观察向量
    auto observableVector = winrt::single_threaded_observable_vector<hstring>();
    
    // 2. 注册变更通知
    observableVector.VectorChanged([](auto&& sender, auto&& args)
    {
        // 处理集合变更事件
        auto action = args.CollectionChange();
        uint32_t index = args.Index();
        
        switch (action)
        {
        case winrt::Windows::Foundation::Collections::CollectionChange::ItemInserted:
            OutputDebugStringW((L"项目已插入，索引: " + winrt::to_hstring(index)).c_str());
            break;
        case winrt::Windows::Foundation::Collections::CollectionChange::ItemRemoved:
            OutputDebugStringW((L"项目已移除，索引: " + winrt::to_hstring(index)).c_str());
            break;
        case winrt::Windows::Foundation::Collections::CollectionChange::ItemChanged:
            OutputDebugStringW((L"项目已更改，索引: " + winrt::to_hstring(index)).c_str());
            break;
        case winrt::Windows::Foundation::Collections::CollectionChange::Reset:
            OutputDebugStringW(L"集合已重置");
            break;
        }
    });
    
    // 3. 操作集合
    observableVector.Append(L"第一项");                // 添加项目
    observableVector.InsertAt(0, L"插入的第一项");      // 插入项目
    observableVector.SetAt(1, L"修改的项目");          // 修改项目
    observableVector.RemoveAt(0);                     // 移除项目
    observableVector.Clear();                         // 清空集合
    
    // 4. 查询集合
    uint32_t size = observableVector.Size();          // 获取大小
    bool isEmpty = (size == 0);                       // 检查是否为空
    
    // 5. 遍历集合
    for (auto&& item : observableVector)
    {
        OutputDebugStringW((L"项目: " + item).c_str());
    }
}
```

### IVector 与 IVectorView

```cpp
// 理解只读和可写集合的区别
void DemonstrateVectorTypes()
{
    // 1. 创建可写向量
    auto writableVector = winrt::single_threaded_vector<hstring>();
    writableVector.Append(L"项目1");
    writableVector.Append(L"项目2");
    
    // 2. 获取只读视图
    winrt::Windows::Foundation::Collections::IVectorView<hstring> readOnlyView = 
        writableVector.GetView();
    
    // 3. 只读视图只能查询，不能修改
    uint32_t count = readOnlyView.Size();             // ✓ 可以
    hstring firstItem = readOnlyView.GetAt(0);        // ✓ 可以
    // readOnlyView.Append(L"新项目");                 // ✗ 编译错误
    
    // 4. 查找操作
    uint32_t index;
    bool found = readOnlyView.IndexOf(L"项目1", index);
    if (found)
    {
        OutputDebugStringW((L"找到项目，索引: " + winrt::to_hstring(index)).c_str());
    }
    
    // 5. 转换为标准容器
    std::vector<hstring> stdVector;
    for (uint32_t i = 0; i < readOnlyView.Size(); ++i)
    {
        stdVector.push_back(readOnlyView.GetAt(i));
    }
}
```

### IMap 键值对集合

```cpp
// 映射集合的使用
void DemonstrateIMap()
{
    // 1. 创建映射
    auto map = winrt::single_threaded_map<hstring, int32_t>();
    
    // 2. 添加键值对
    map.Insert(L"apple", 1);
    map.Insert(L"banana", 2);
    map.Insert(L"cherry", 3);
    
    // 3. 查询值
    bool hasKey = map.HasKey(L"apple");
    if (hasKey)
    {
        int32_t value = map.Lookup(L"apple");
        OutputDebugStringW((L"apple 的值: " + winrt::to_hstring(value)).c_str());
    }
    
    // 4. 安全查询（不抛出异常）
    int32_t defaultValue = 0;
    int32_t result = map.TryLookup(L"grape").value_or(defaultValue);
    
    // 5. 遍历映射
    for (auto&& pair : map)
    {
        hstring key = pair.Key();
        int32_t value = pair.Value();
        OutputDebugStringW((key + L" = " + winrt::to_hstring(value)).c_str());
    }
    
    // 6. 移除项目
    map.Remove(L"banana");
    map.Clear();
}
```

## 事件系统底层原理

### 事件令牌管理

WinRT 事件使用令牌系统管理订阅：

```cpp
// 深入理解事件订阅和取消订阅
class EventDemonstration
{
private:
    std::vector<winrt::event_token> m_eventTokens;  // 存储事件令牌
    
public:
    void DemonstrateEventHandling()
    {
        auto button = winrt::Microsoft::UI::Xaml::Controls::Button();
        
        // 1. 订阅事件并保存令牌
        auto token1 = button.Click([this](auto&& sender, auto&& args)
        {
            OutputDebugStringW(L"处理器 1 被调用\n");
        });
        m_eventTokens.push_back(token1);
        
        // 2. 多个事件处理器
        auto token2 = button.Click([this](auto&& sender, auto&& args)
        {
            OutputDebugStringW(L"处理器 2 被调用\n");
        });
        m_eventTokens.push_back(token2);
        
        // 3. 取消订阅特定处理器
        button.Click(token1);  // 移除第一个处理器
        
        // 4. Lambda 捕获的生命周期管理
        auto weakThis = winrt::make_weak(*this);
        auto token3 = button.Click([weakThis](auto&& sender, auto&& args)
        {
            if (auto strongThis = weakThis.get())
            {
                // 安全访问对象成员
                strongThis->OnButtonClicked();
            }
        });
    }
    
    ~EventDemonstration()
    {
        // 5. 清理所有事件订阅
        // 通常不需要手动做，智能指针会自动处理
        // 但在某些情况下可能需要显式取消订阅
    }
    
private:
    void OnButtonClicked()
    {
        OutputDebugStringW(L"对象方法被调用\n");
    }
};
```

### 自定义事件实现

```cpp
// 实现自己的事件系统
template<typename... Args>
class custom_event
{
private:
    std::map<winrt::event_token, std::function<void(Args...)>> m_handlers;
    winrt::event_token m_nextToken{1};
    
public:
    winrt::event_token add(std::function<void(Args...)> handler)
    {
        auto token = m_nextToken++;
        m_handlers[token] = std::move(handler);
        return token;
    }
    
    void remove(winrt::event_token const& token)
    {
        m_handlers.erase(token);
    }
    
    void operator()(Args... args)
    {
        for (auto&& [token, handler] : m_handlers)
        {
            try
            {
                handler(args...);
            }
            catch (...)
            {
                // 处理事件处理器中的异常
                OutputDebugStringW(L"事件处理器异常\n");
            }
        }
    }
};

// 使用自定义事件
class CustomEventSource
{
private:
    custom_event<hstring> m_messageEvent;
    
public:
    winrt::event_token MessageReceived(std::function<void(hstring)> handler)
    {
        return m_messageEvent.add(std::move(handler));
    }
    
    void MessageReceived(winrt::event_token const& token)
    {
        m_messageEvent.remove(token);
    }
    
    void SendMessage(hstring const& message)
    {
        m_messageEvent(message);
    }
};
```

## 字符串处理与国际化

### 字符编码处理

```cpp
// 深入理解字符编码转换
class StringConversion
{
public:
    static std::string HStringToUtf8(hstring const& wideString)
    {
        if (wideString.empty())
            return {};
        
        // 计算需要的缓冲区大小
        int required = WideCharToMultiByte(
            CP_UTF8, 0,
            wideString.c_str(), static_cast<int>(wideString.size()),
            nullptr, 0,
            nullptr, nullptr);
        
        if (required <= 0)
            return {};
        
        // 执行转换
        std::string result(required, '\0');
        WideCharToMultiByte(
            CP_UTF8, 0,
            wideString.c_str(), static_cast<int>(wideString.size()),
            result.data(), required,
            nullptr, nullptr);
        
        return result;
    }
    
    static hstring Utf8ToHString(std::string const& utf8String)
    {
        if (utf8String.empty())
            return {};
        
        // 计算需要的缓冲区大小
        int required = MultiByteToWideChar(
            CP_UTF8, 0,
            utf8String.c_str(), static_cast<int>(utf8String.size()),
            nullptr, 0);
        
        if (required <= 0)
            return {};
        
        // 执行转换
        std::wstring wideString(required, L'\0');
        MultiByteToWideChar(
            CP_UTF8, 0,
            utf8String.c_str(), static_cast<int>(utf8String.size()),
            wideString.data(), required);
        
        return hstring{wideString};
    }
};
```

### 资源本地化

```cpp
// 使用 Windows 运行时资源系统
void DemonstrateLocalization()
{
    // 1. 获取资源加载器
    auto resourceLoader = winrt::Windows::ApplicationModel::Resources::ResourceLoader::GetForCurrentView();
    
    // 2. 加载字符串资源
    hstring localizedText = resourceLoader.GetString(L"WelcomeMessage");
    
    // 3. 带上下文的资源加载
    auto contextResourceLoader = winrt::Windows::ApplicationModel::Resources::ResourceLoader::GetForCurrentView(L"ErrorMessages");
    hstring errorText = contextResourceLoader.GetString(L"NetworkError");
    
    // 4. 格式化本地化字符串
    hstring userName = L"张三";
    hstring template = resourceLoader.GetString(L"WelcomeTemplate");  // "欢迎, {0}!"
    hstring welcomeMessage = std::format(template.c_str(), userName.c_str());
    
    OutputDebugStringW((L"本地化消息: " + localizedText).c_str());
}
```

## 异常处理机制

### WinRT 异常类型

```cpp
// 理解和处理 WinRT 异常
void DemonstrateExceptionHandling()
{
    try
    {
        // 可能抛出异常的 WinRT 操作
        auto invalidUri = winrt::Windows::Foundation::Uri{L"不是一个有效的 URI"};
    }
    catch (winrt::hresult_error const& ex)
    {
        // WinRT 异常包含丰富的错误信息
        HRESULT hr = ex.code();                    // 错误代码
        hstring message = ex.message();            // 错误消息
        
        // 常见的 HRESULT 值
        switch (hr)
        {
        case E_INVALIDARG:
            OutputDebugStringW(L"无效参数\n");
            break;
        case E_OUTOFMEMORY:
            OutputDebugStringW(L"内存不足\n");
            break;
        case E_NOTIMPL:
            OutputDebugStringW(L"功能未实现\n");
            break;
        default:
            OutputDebugStringW((L"未知错误: 0x" + 
                               winrt::to_hstring(static_cast<uint32_t>(hr))).c_str());
            break;
        }
        
        OutputDebugStringW((L"错误消息: " + message).c_str());
    }
    catch (std::exception const& ex)
    {
        // 标准 C++ 异常
        OutputDebugStringA(("标准异常: " + std::string(ex.what())).c_str());
    }
    catch (...)
    {
        // 捕获所有其他异常
        OutputDebugStringW(L"未知异常类型\n");
    }
}

// 检查 HRESULT 的辅助函数
void CheckHResult(HRESULT hr)
{
    if (FAILED(hr))
    {
        winrt::throw_hresult(hr);  // 将 HRESULT 转换为 WinRT 异常
    }
}

// 使用 winrt::check_hresult 简化错误检查
void SafeWinRTOperation()
{
    // 自动检查 HRESULT 并抛出异常
    winrt::check_hresult(SomeWin32APICall());
}
```

### 异常传播和处理策略

```cpp
// 异常处理的最佳实践
class ExceptionHandlingBestPractices
{
public:
    // 1. 在适当的层级处理异常
    void UIEventHandler()
    {
        try
        {
            BusinessLogicOperation();
        }
        catch (winrt::hresult_error const& ex)
        {
            // 在 UI 层显示用户友好的错误消息
            ShowErrorDialog(L"操作失败: " + ex.message());
        }
        catch (...)
        {
            // 处理意外异常
            ShowErrorDialog(L"发生了未知错误");
        }
    }
    
    // 2. 业务逻辑层：让异常向上传播
    void BusinessLogicOperation()
    {
        // 不要在这里捕获异常，让它传播到 UI 层
        DataAccessOperation();
    }
    
    // 3. 数据访问层：转换底层异常
    void DataAccessOperation()
    {
        try
        {
            LowLevelFileOperation();
        }
        catch (std::filesystem::filesystem_error const& ex)
        {
            // 将底层异常转换为 WinRT 异常
            winrt::throw_hresult(E_FAIL);
        }
    }
    
private:
    void ShowErrorDialog(hstring const& message)
    {
        // 显示错误对话框的实现
        OutputDebugStringW((L"错误对话框: " + message).c_str());
    }
    
    void LowLevelFileOperation()
    {
        // 可能抛出 std::filesystem 异常的操作
        throw std::filesystem::filesystem_error("文件不存在", std::error_code{});
    }
};
```

## 总结

本部分深入讲解了 WinRT 的基础概念：

1. **类型系统**：理解 WinRT 类型与 C++ 类型的映射关系
2. **字符串处理**：深入了解 hstring 的内部机制和用法
3. **集合操作**：掌握各种 WinRT 集合类型的特点和用法
4. **事件系统**：理解事件订阅、取消订阅和生命周期管理
5. **异常处理**：掌握 WinRT 异常系统和最佳实践

这些基础概念是深入学习 WinUI 3 开发的重要基石。

---

*这是 WinUI 3 WinRT C++ 完整教程的第四部分。下一部分我们将学习 XAML 框架和数据绑定的深层机制。*