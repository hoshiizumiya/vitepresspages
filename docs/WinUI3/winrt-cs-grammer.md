# 在 C++/WinRT 中，方法调用和属性访问的语法与 C# 有明显区别，主要原因如下：

## 1. C++/WinRT 的方法和属性本质
- 在 C++/WinRT 里，很多 WinRT API 的“属性”其实是 get/set 方法（getter/setter），并不是像 C# 那样的自动属性。
- 例如 `AppWindow()` 实际上是一个方法，返回一个对象（不是字段或属性），所以必须加括号调用。

## 2. C# 的属性语法
- C# 支持属性语法，允许你像访问字段一样访问属性（例如 `window.AppWindow.TitleBar.PreferredHeightOption = ...`），编译器会自动转为方法调用。
- C++ 没有这种语法糖，必须显式调用方法。

## 3. C++/WinRT 的链式调用
- 你看到的 `window.AppWindow().TitleBar().PreferredHeightOption(...)`，每一步都是方法调用，返回下一个对象或设置属性。
- 每个 `()` 都是必须的，因为它们是方法，不是字段或属性。

## 示例对比

### C# 示例
```csharp
window.AppWindow.TitleBar.PreferredHeightOption = TitleBarHeightOption.Tall;
```
### C++/WinRT 示例
```cpp
window.AppWindow().TitleBar().PreferredHeightOption(winrt::Microsoft::UI::Windowing::TitleBarHeightOption::Tall);
```

## 总结
- C++/WinRT 需要显式调用方法（加括号），因为没有 C# 的属性语法糖。
- 这是 C++ 语言和 C# 语言设计上的差异，属于语法层面的不同。

进一步了解 C++/WinRT 的属性和方法映射，查阅 [uwp 官方文档以初步了解](https://learn.microsoft.com/windows/uwp/cpp-and-winrt-apis/)。使用api时请查询 windows app sdk 文档，不要与 windows sdk 文档看混。

## 示例

```csharp
public AppWindowTitleBar TitleBar => IAppWindowMethods.get_TitleBar(_objRef_global__Microsoft_UI_Windowing_IAppWindow);
```

## 1. 属性表达式（表达式体属性）

- `public AppWindowTitleBar TitleBar => ...;`
- 这是 C# 6.0 引入的“表达式体成员”语法，意思是定义一个只读属性，返回 `=>` 右边的表达式结果。
- 等价于：
```csharp
public AppWindowTitleBar TitleBar
{
    get { return IAppWindowMethods.get_TitleBar(_objRef_global__Microsoft_UI_Windowing_IAppWindow); }
  }
```

### 2. 属性类型

- `AppWindowTitleBar` 是属性的返回类型，表示窗口标题栏的相关对象。

### 3. 属性实现

- `IAppWindowMethods.get_TitleBar(...)` 是一个静态方法调用，参数是 `_objRef_global__Microsoft_UI_Windowing_IAppWindow`。
- 这个方法返回一个 `AppWindowTitleBar` 对象。

### 4. 语法特点

- `TitleBar` 是一个只读属性（没有 `set`），每次访问都会调用 `get_TitleBar` 方法。
- `=>` 是表达式体成员语法，只能用于简单返回值的场景。