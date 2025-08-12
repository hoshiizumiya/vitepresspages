# 补充与回忆

1.声明类型：

你可能不太熟悉这样的 C++ 声明并直接定义（C++ 11 统一初始化语法（uniform initialization）），`winrt::Windows::Foundation::Collections::IObservableVector<hstring>`使用`::`拓展了较长的命名空间前缀，显式明了地指出了完整类型名、接口类型  
这是一个可观察的向量（集合）接口类型 `Interface-Observable-Vector`  
`hstring` 是 WinRT 的字符串类型（类似于 C# 中的 string），并以T代表可替换的模板类型。与标准 C++ 的 `std::string` 或 `std::wstring` 有重要区别，支持 `UTF-16`。可观察集合会在数据发生变化时通知界面更新

2.变量名：sourceArray

这是声明的变量名称。值得一提的是抽象类（接口 Interface ）因其存在未实现的虚函数，所以不能直接实例化，对象必须通过对于接口具体的派生类创建对象。此即为熟知的多态，通过基类（通常是抽象类）的指针或引用来处理派生类对象，从而实现运行时多态。

3.初始化：

使用初始化列表，直接调用构造函数`winrt::single_threaded_observable_vector<hstring>()`
创建一个单线程的 observable vector，集合在单一线程上操作，不需要额外的线程安全处理。作为工厂函数（返回对象指针或引用的函数），其内部封装了具体实现类的创建逻辑，并返回一个符合接口实现规范的对象从而达到封装具体对象创建逻辑、根据条件返回不同子类、封装资源的初始化和释放逻辑以减少可能出现的错误。sourceArray 实际上是一个实现了` IObservableVector<int>` 接口的具体对象。调用基类对象方法时通过虚函数表动态绑定到派生类已实现的方法。

4.实际用途：

这个集合通常用于：
为 UI 控件（如 ListView、ComboBox 等）提供数据实现数据绑定，当集合内容改变时，UI 会自动更新存储用户界面需要显示的字符串项
在类中的 addSourceItemButton_Click 方法中使用。集合会在点击按钮时添加新项目，而 UI 会自动更新以显示这些新增的项目。
类方法：Append(T)
RemoveAt(i) i begin at 0
使用控件的ItemsSource()方法传入IObservableVector类型参数

More:
现代 C++ 快速开发中通常使用 auto 关键字简化写法，使用编译器进行类型推导、简洁易读，同时也需要包含正确的命名空间使用。如：`auto sourceArray = single_threaded_observable_vector<hstring>()`

