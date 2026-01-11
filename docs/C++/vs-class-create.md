vs创建class的自动补全为什么是先public再private：

Visual Studio 的类自动补全功能默认将 public 放在最前面，这是因为 C++ 的类成员默认访问权限是 private，而 public 通常需要显式声明以便更清晰地表达意图。目前，Visual Studio 并未提供直接修改此顺序的设置选项。
如果需要自定义类模板，可以通过修改 Visual Studio 的代码片段（Code Snippets）来实现。你可以创建或编辑 .snippet 文件，定义自己的类模板以满足需求。
