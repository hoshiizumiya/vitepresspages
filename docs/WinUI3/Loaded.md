# C++/WinRT 原理及实践 —— WinUI3 的页面加载和关闭注册事件解析、以WPF为源、C#/cppwinRT为例

## 前言

如果你对 WPF 框架熟悉，那么在 WinUI 3 中，你同样可以直接对页面或控件注册 Loaded 事件，而且语法更清晰。你仍然需要 Loaded 事件来执行“页面加载完成后”的逻辑 —— 它没有被废弃，只是写法变了。本篇将以最详细的解释为你疏清相关知识。 

本节涉及到的概念有：

- 事件注册
- 事件处理
- XAML 根元素语法
- C++ 回调
- C++/WinRT 语法
- C++ 成员函数指针

## 回顾

让我们先看看大多数熟悉的 WPF 为了实现页面加载后的逻辑是如何实现的。
我们使用的是事件注册语法：
### 两种标准的 WPF（C#/XAML）中的 Loaded 事件写法

#### 在 WPF 里，你可以直接在 XAML 页面的根元素（如 Window 或 Page 类型）上写，这就可以了，相当于在 xaml 页面里注册了：
```xml
Mainwindow.xaml
<Window x:Class="Demo.MainWindow"
        Loaded="Window_Loaded"> 这里需要你自定义
    <!-- 你的页面内容 Your page content -->
</Window>
```
然后在 C# 代码里直接补充实现自动生成的事件处理函数：
```cs
// MainWindow.xaml.cs
private void Window_Loaded(object sender, RoutedEventArgs e)
{
    // 页面加载完成后的逻辑
}
```

#### 我们同样还有另外的方法——也经常使用**事件订阅**语法 用来简便的注册和使用：

我们在对应的窗口类的构造函数里，用 cs 独有的`+=`（事件注册操作符）来添加事件处理程序，这也是标准的写法！当然你大可不遵守。
意思是把这个方法添加到这个事件的监听列表中。表示：当 Loaded 事件发生时，调用后面的方法。

```cs
// MainWindow.xaml.cs 的构造函数或其他初始化方法中
public MainWindow()
{
    InitializeComponent();
    
    // 使用 += 简便地注册事件
    //将 Window_Loaded 方法注册为 Loaded 事件的处理程序。
    this.Loaded += Window_Loaded;
}
// 和前面所写的一致
private void Window_Loaded(object sender, RoutedEventArgs e)
{
    // 页面加载完成后的逻辑
}
```

#### 当然还有更简便的使用匿名方法（没有函数名字的方法）、 以 lambda 表达式注册：
```cs
this.Loaded += (sender, e) =>
{
    // 直接写加载完成后的逻辑，适用于简单的逻辑
    MessageBox.Show("窗口已加载！");
};
```
我们也再仔细回顾一下这个 C# 语法方便初学者理解：
-   ()内代表要传给后面方法的参数列表。在这里事件处理函数的两个参数：
-   sender：表示是哪个对象触发了这个事件（比如是哪个窗口）。
-   e：是事件的参数，包含事件相关的额外信息（比如鼠标点击位置、键盘按键等）。
-   参数的具体类型是编译器自动推断
#### => 到底是什么？
-    符号读作 “goes to” 或 “yields to”。
-    它的作用是：把左边的参数，连接到右边的代码块或表达式。
-    类似于说：“用 (sender, e) 作为输入，执行 => 后面的大括号里的代码”。

说的很详细了，不再过多解释。

## 在 WinUI3 里什么发生了变化

在 WinUI 3 C++/WinRT 框架中，Loaded 事件是 FrameworkElement 的成员。  
在 WPF（.NET 框架，C#/XAML）中，Window 和 Page 都继承自 FrameworkElement，而 FrameworkElement 有 Loaded 事件。所以你可以直接在 XAML 根元素这样写：
在 WinUI 3（无论 C# 还是 C++/WinRT），Window 和 Page 的继承体系发生了变化：（这点很坑）
-	Window 类不再继承自 FrameworkElement，而是直接继承自 IInspectable。
-	Window 类里没有 Loaded 事件。
-	Page 在 WinUI 3 里虽然继承自 FrameworkElement，但有些事件的实现和 WPF 不完全一致。

而只有属于 FrameworkElement 及其子类（如 Grid、StackPanel、Button 等）才有 Loaded 事件。你直接从主窗口使用该函数是会报错类中没有此成员函数的。

更清晰地来说，在 WinUI 3 的类型层次结构中，Window 直接继承自 IInspectable 属于 [Microsoft.UI.Xaml](https://learn.microsoft.com/zh-cn/uwp/api/windows.ui.xaml.window?view=winrt-26100) 命名空间，但它没有 Loaded 事件。FrameworkElement 则直接继承自 [UIElement](https://learn.microsoft.com/zh-cn/uwp/api/windows.ui.xaml.uielement?view=winrt-26100)。

### WinUI 3 中的 Loaded 事件写法

在 WinUI 3 里，Window 没有 Loaded 事件，Page 有，但仍然具有偶发的兼容性问题。具体来说在复杂的导航场景下，有些内容可能会被重新加载，导致 Loaded 事件可能会触发多次。生命周期和异步加载都有可能会影响 Loaded 事件的触发。所以需要仔细地控制页面的加载逻辑。 

推荐在 xaml 页面的某个控件（如 LayoutGrid）上绑定 Loaded 事件：

```XML
MainWindow.xaml
<Window
    x:Class="Demo.MainWindow"
    xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
    xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml">
    <Grid Loaded="RootGrid_Loaded">
        <!-- ... -->
    </Grid>
</Window>
```
-   C# 的 cs 页面代码同上，不再展出。
-   重点讲 C++/WinRT
```cpp
// MainWindow.xaml.cpp
RootGrid().Loaded({ this, &MainWindow::OnRootGridLoaded });

void MainWindow::OnRootGridLoaded(
    winrt::Windows::Foundation::IInspectable const& sender,
    winrt::Microsoft::UI::Xaml::RoutedEventArgs const& e)
{
    // 页面加载完成后的逻辑
}
 ```
### cpp/winrt 语法讲解：

##### 1.`RootGrid()`
-   这是 `C++/WinRT` 自动生成的**属性访问器**函数。
-   在 XAML 里 `<Grid x:Name="RootGrid"/>`，编译后会自动生成一个名为 RootGrid() 的成员函数，返回这个控件对应 x:Name 的实例。
-   用法类似 C# 的 RootGrid 属性，但 C++/WinRT 里是函数调用（带括号）。

##### 2.`.Loaded(...)`
-   Loaded 是 FrameworkElement 的一个事件，表示控件已经加载到可视树。
-   这里的 .Loaded(...) 是给这个事件注册一个处理函数（事件监听器）。

##### 3.`{ this, &MainWindow::OnRootGridLoaded }`
-   这是 C++/WinRT **事件注册**的标准写法，叫“**委托**”或“**事件回调**”。
`{ this, &MainWindow::OnRootGridLoaded } `表示用当前对象（`this`）的成员函数 `OnRootGridLoaded()` 作为事件处理器。 
-   看到&别急着认为是引用类型，这里是个大学问！
    -   此处代表了取地址动作，那学过cpp的都知道函数名字不就相当于地址（见 C++ primer plus 7.10.1节 P199），话说再取地址是什么了。NONONO。
    -   对于非成员的函数（也就是不属于任何类的），函数名确实可以在很多情况下隐式转换为函数指针，此处不再举例。
    -   对于成员函数来说，不用害怕，略有不同：
        -   当你处理的是类的成员函数时，情况变得更加复杂。因为成员函数的第一个**隐含参数**是`this`指针。这意味着成员函数指针不仅仅是简单的函数地址，它还需要知道它属于哪个对象实例。
        -   当你写`&MainWindow::OnRootGridLoaded`时，你实际上是显式地在获取该成员函数的指针，这个指针包含了如何调用该成员函数的信息（包括如何找到正确的对象实例）。因此，在这种情况下，使用&是必要的语法要求，以明确表达你正在获取成员函数的地址。
        -   实际上，你可以选择省略这个`&`。如果你不加`&`，MSVC 编译器也会自动推导出。 C++ 允许**在需要函数指针的地方**，**隐式**地将成员函数名转换为函数指针。但是为了可读性和避免使用模板时可能造成的错误，最好记得加上。
        -   我们再回忆成员函数概念，以解释清楚。作为成员函数，那么必须要绑定到一个具体的对象上才能被调用
        -   那函数名究竟是什么：func 的名字相当于一个特殊的左值（Ivalue），代表函数本身，但它不是指针类型。函数名会“隐式转换”为函数指针当编译器看到你把函数名用在需要函数指针的地方，它会自动帮你加上 `&`。即：**函数到函数指针的隐式转换**（function-to-pointer conversion）。
        -   所以，如果你随意一个地方直接写 `MainWindow::OnRootGridLoaded` 其实是不行的，因为它本身不是一个左值，而是一个名字或者说成员函数标识符。必须用 `&` 显式获取它的“成员函数指针”。那为什么我们在这里可以省略，因为因为 `C++/WinRT` 的 `Loaded` 事件接受的是一个**可调用对象**（Callable）。当编译器看到 MainWindow::OnRootGridLoaded 被用在需要“函数指针”的上下文中，于是自动把它加上了`&`。多亏隐式转换！
-   这种写法本质上是把**成员函数指针**和**对象指针**一起传递，`C++/WinRT` 框架会自动帮你在事件发生时调用这个成员函数。

#### 事件注册语法！

-   我们用花括号{}来注册事件，写在参数列表的`{}`里。
-   `C++/WinRT` 事件注册需要一个“**委托对象**”，即谁来处理事件、用哪个成员函数。
-   `{ this, &MainWindow::OnRootGridLoaded }` 是 `C++/WinRT` 的语法糖，等价于 C# 的 += 事件注册。
-   这样写可以让框架知道：当事件发生时，调用 this（当前窗口对象）的 `OnRootGridLoaded` 成员函数。

#### 相信你看完还是一头雾水！这贵物东西究竟是个啥啊！

`C++/WinRT` **事件监听器**（比如 Loaded）为什么在参数列表里要用大括号 { this, &MainWindow::OnRootGridLoaded }，而不是像 C# 那样直接写方法名或者用 +=？

再展开来讲，里面有关的众多绕耳名词，我们再来整理整理： 

-   记住`.Loaded()`就属于**事件监听器**，（）内就是 **事件注册** 函数，使用**注册监听器**语法，同时也是一个**事件**，需要传递一个**委托对象**（delegate）。不要纠结它的各种名字，越记越混。记住它不是一个简单的函数。
-   {}这种写法叫委托构造，会自动生成一个事件处理对象 也就是用来处理这个事件的对象。
-   既然是对象，它就保存了两个信息：
    -   this：当前类的实例指针（告诉框架事件发生时要调用哪个对象的方法）
    -   &MainWindow::OnRootGridLoaded：成员函数指针（告诉框架具体调用哪个成员函数）
-   作用：在这个事件函数发生时（也就是该绑定的界面元素被加载完成后）执行注册的函数，winRT会在此时帮你自动调用（依赖消息循环）
-   你写他.Loaded()，就是调用Loaded事件的`add`方法，将你的`回调`注册进去，这个回调是什么意思——

-   虽然我们不能直接写一个函数/函数名在里面，但是我们也还可以用 lambda 表达式类似 cs 的注册方式。
    -   它也支持 lambda 类型语法直接注册事件：
    ```cpp
       RootGrid().Loaded([](auto&& sender, auto&& e) {
        // 这里写要执行的内容
    }); 
    ```
    -   但是呢，我们使用 `{ this, &MainWindow::OnRootGridLoaded }`是最常见和推荐的注册方式！

## 回调

#### 我们刚才不停地提到了事件回调，回调在 cpp 里是一个很有深度的概念：
其实我们一直在讲的就是**事件回调**（Event Callback）的典型用法（统称**回调**）。 回调 = 把函数作为事件注册出去，等事件发生时系统自动调用它。 

`{ this, &MainWindow::OnRootGridLoaded }`这就是在注册一个回调函数。
```

    你写的代码：
    RootGrid().Loaded({ this, &MainWindow::OnRootGridLoaded });
            ↓
    你告诉 XAML 系统：
    “当 RootGrid 加载完成时，请调用 MainWindow 的 OnRootGridLoaded 函数”
            ↓
    XAML 系统记住了这个“请求”（注册了回调）
            ↓
    运行时：RootGrid 真的加载完成了！
            ↓
    系统回头调用你提供的函数：
    this->OnRootGridLoaded(sender, e);
            ↓
    你的代码执行：
    // 页面加载完成后的逻辑
```
##### 这里也有一些 C++/WinRT 中的语法细节

`{ this, &MainWindow::OnRootGridLoaded }` 是 `C++/WinRT` 的 事件处理程序语法，它等价于“绑定一个成员函数作为事件处理器”。底层使用了 `winrt::auto_revoke` 和**委托**（delegate）机制，确保对象销毁时自动取消注册，防止崩溃。我们可能以后会继续来解析。
值得一提的是这种方法非常利好于性能，因为回调的核心是在于提前告诉框架在哪一步要做什么。我们就不需要时时刻刻循环监听页面的变化进行处理，到达了我们已经设定的目标状态，winRT 就会来调用。 
因为系统在事件发生时“回头调用”它 → 所以叫“回调”。

#### 事件处理函数
```cpp
void MainWindow::OnRootGridLoaded(
    winrt::Windows::Foundation::IInspectable const& sender,winrt::Microsoft::UI::Xaml::RoutedEventArgs const& e)
```

##### `winrt::Windows::Foundation::IInspectable const& sender`
-   sender：事件的发送者，即哪个控件触发了这个事件。
-   类型是 `IInspectable` [MSLearn链接](https://learn.microsoft.com/en-us/windows/win32/api/inspectable/nn-inspectable-iinspectable) [讲解链接施工中]()，这是 WinRT 所有对象的基类，类似 C# 里的 object。
-   你还可以使常用的 sender.as<`Grid`>() 之类的方法把它转换成具体控件类型，当然也可以不转换。
    -    `sender`：事件的发送者，基类型为 `IInspectable`。
    -    .as<`T`>()：将 sender 转换为你需要的具体类型 T（如 Grid、Button 等）。
    -    返回值是 T 目标类型的智能指针对象（如 winrt::Grid），可以直接访问控件的属性和方法。
    -    在 C++/WinRT 中，事件处理函数的 sender 参数类型通常是 `winrt::Windows::Foundation::IInspectable`，这是 WinRT 所有对象的基类。
    -    但实际触发事件的控件类型可能更具体，比如 Grid、Button 等。为了方便获取具体类型的对象，C++/WinRT 提供了 as<`T`>() 方法进行类型转换。
    -    例如，你可以使用 sender.as<`winrt::Microsoft::UI::Xaml::Controls::Grid`>() 将 sender 转换为 Grid 类型，这样就可以访问 Grid 的特定属性和方法了。
    -    注意事项：
         - 我们不要使用 `dynamic_cast` 或 `static_cast` 来转换 sender，因为 WinRT 使用了自己的类型系统和智能指针，其次它只适用于原生指针或引用也不支持这些 C++ 的 RTTI （运行时类型识别）特性，性能开销也很大。
         - sender 的类型是 `IInspectable`，它是 WinRT 所有对象的基类。本身不包含具体控件的属性和方法，你就访问不到。
         - 如果 sender 实际不是你转换的类型，as<`T`>() 会抛出异常（`winrt::hresult_no_interface`）。
         - 通常只有在你确定 sender 的实际类型时才使用 as<`T`>()。
         - 这种写法类似于 C# 的 as 操作符，但 C++/WinRT 的 as<`T`>() 是强制转换，失败会抛异常。
         - 你可以使用 try-catch 块来捕获异常，确保转换安全。但不能用模板函数来实现，因为 C++/WinRT 的 as<`T`>() 是编译时确定的类型转换且类型是确定的，当然你可以把它封装成一个函数来稍微简化使用。
         - 底层调用 QueryInterface，只有在 sender 真正支持该类型时才会成功。

##### `winrt::Microsoft::UI::Xaml::RoutedEventArgs const& e`
-   e：事件参数，包含事件相关的额外信息。
-   类型是 RoutedEventArgs，和 WPF 里的类似，表示“路由事件”的参数。
-   这里的命名空间是 Microsoft::UI::Xaml，因为 WinUI 3 的控件和事件都在这个命名空间下。 

#### 那问题来了：为什么有 Windows 和 Microsoft 两个命名空间？
-   `winrt::Windows::Foundation::IInspectable：`

    -   Windows::Foundation 是 WinRT 的基础命名空间，所有 WinRT 对象都继承自 IInspectable。
    -   这是 WinRT 类型系统的根基，类似于 C# 的 object 或 C++ 的 void*，但有类型信息。
-   `winrt::Microsoft::UI::Xaml::RoutedEventArgs：`

    -   Microsoft::UI::Xaml 是 WinUI 3 的控件和事件相关命名空间。
    -   RoutedEventArgs 是所有路由事件的参数基类，包含事件路由相关信息。

## 使用及用例

核心：手动在 XAML 里绑定 Loaded 事件，以及绑定必须要监听你的界面控件，属于在界面控件的代码。因为直接在界面根元素上绑定是没有的，会报错。

### 什么时候，为什么要用 Loaded 事件？

Loaded 事件的典型应用场景包括：

- **初始化依赖于可视树的逻辑**：有些操作（如获取控件的实际大小、布局信息、父子关系等）只有在控件真正加载到可视树后才能进行。
- **动态数据绑定或界面刷新**：在 Loaded 事件中加载数据、刷新界面，确保控件已准备好显示内容。
- **动画、特效启动**：页面或控件加载完成后启动动画，避免动画在控件未显示时提前执行。
- **与外部资源交互**：如页面加载后请求网络数据、初始化硬件资源等。
- **只需执行一次的初始化逻辑**：Loaded 事件只会在控件第一次加载到可视树时触发一次，适合做一次性的初始化。

#### 注意事项

- **不要在 Loaded 事件中做耗时操作**，否则会阻塞 UI 线程，导致界面卡顿。耗时操作应放到后台线程。
- **Loaded 只触发一次**，如果控件被移除再重新添加到可视树，会再次触发。
- **Window 没有 Loaded 事件**，只能在 Page 或 FrameworkElement（如 Grid、Panel、Button 等）上使用。

#### 示例总结

- WPF（C#）：Window/Page/控件都可以直接用 Loaded 事件。
- WinUI 3（C#）：Page/控件可以用 Loaded，Window 不行。
- WinUI 3（C++/WinRT）：只能在 FrameworkElement 及其子类控件上注册 Loaded 事件，推荐在主布局 Grid 上注册。

#### 推荐实践

- 在 XAML 主布局控件（如 `<Grid x:Name="RootGrid" Loaded="RootGrid_Loaded">`）上注册相关 Loaded 事件。
- 在 C++/WinRT 代码中用 `{ this, &MainWindow::OnRootGridLoaded }` 注册事件处理器。
- 只在 Loaded 事件中做与 UI 相关的初始化，避免阻塞 UI。


## Close() 关闭事件

同样我们也有针对 Window 关闭要执行的事件 C++WinRT 事件绑定标准写法。注意 Page 没有 Closed 事件。

```cpp
// 简洁委托写法
this->Closed({ this, &MainWindow::OnWindowClosed });
// Lambda写法
this->Closed([this](auto const& sender, auto const& args) { this->OnWindowClosed(sender, args); });
```
两者都能实现事件绑定


下一章我们准备讲解 InitializeComponent 函数的原理和实现，敬请期待。