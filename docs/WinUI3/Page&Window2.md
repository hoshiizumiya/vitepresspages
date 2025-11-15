# WinUI 3 (C++/WinRT) 自定义导航实践指南

> 面向已经了解 WinUI 3 基础控件与 C++/WinRT 语法、希望设计一套可维护、可扩展导航体系的开发者。  
> ⚠️目前并非最佳的自定义导航实践，仍有改进空间，欢迎反馈与讨论。
> 示例代码都可以在我的仓库里找到
---
## 1. 目标与设计原则
一个良好的导航层应满足：
- 统一入口：所有页面跳转经同一 `Navigate(tag)` 路由；
- 可防重入：避免重复导航造成闪烁 / 状态重置；
- 可扩展：新增页面时只添加一个 tag + 一个 openXPage()；
- 线程安全：始终在 UI 线程执行；
- 方向同步：Frame 导航后能正确反选对应 `NavigationViewItem`；
- 与视图模型（ViewModel）解耦：VM 不直接依赖页面类型。

本指南以“标签驱动 (Tag Routing)”模式为范例进行拆解与扩展。

---
## 2. 基础结构：NavigationView + Frame
典型 XAML 结构：
```xml
<NavigationView x:Name="NavView"
                IsSettingsVisible="False"
                ItemInvoked="NavView_ItemInvoked">
  <NavigationView.MenuItems>
    <NavigationViewItem Tag="home" Icon="Home" />
    <NavigationViewItem Tag="contacts" />
    <NavigationViewItem Tag="tasks" />
    <NavigationViewItem Tag="files" />
    <NavigationViewItem Tag="net" />
    <NavigationViewItem Tag="servers" />
  </NavigationView.MenuItems>
  <NavigationView.FooterMenuItems>
    <NavigationViewItem Tag="Settings" Icon="Setting" />
  </NavigationView.FooterMenuItems>
  <NavigationView.Content>
    <Frame x:Name="NavFrame"
           Navigated="NavFrame_Navigated"
           Navigating="NavFrame_Navigating" />
  </NavigationView.Content>
</NavigationView>
```
核心：`NavigationView` 负责展示导航项；`Frame` 承载页面内容。

---
## 3. 标签驱动导航（Tag Routing Pattern）
用 `NavigationViewItem.Tag` 作为**逻辑路由键**（而不是直接写页面类型判断散落各处）。  
优点：
- 统一抽象：`Navigate(hstring tag)`；
- 支持动态扩展（运行时添加收藏 / 服务器等项时，只需约定 tag）；
- 便于持久化最近访问（只存 tag）。

Tag 约定建议：
- 全小写：`home / contacts / tasks / files / net / servers`；
- 预留前缀：如 `fav_` / `srv_` 代表动态数据项。

---
## 4. 防重复导航 + UI 线程调度
避免二次导航（Frame 已在目标页）和跨线程调用：
```cpp
void MainWindow::Navigate(hstring const& tag)
{
    auto weak = get_weak();
    DispatcherQueue().TryEnqueue([weak, tag]() {
        if (auto self = weak.get()) {
            auto frame = self->NavFrame();
            auto content = frame.Content();
            // 路由分发（示例片段）
            if (tag == L"home") {
                if (content && content.try_as<Pages::HomePage>()) return;
                self->openHomePage();
                return;
            }
            // ... 其它 tag ...
            if (tag == L"settings") {
                if (content && content.try_as<Pages::SettingsPage>()) return;
                self->openSettingsPage();
                return;
            }
            // 默认回退
            if (!(content && content.try_as<Pages::HomePage>())) self->openHomePage();
        }
    });
}
```
关键点：
- `content.try_as<T>()` 检测是否已在该页面；
- 避免 `Navigate()` 中直接 `frame.Navigate()` 后又额外更新选中项（委派给 openXPage()）；
- 使用 `TryEnqueue` 保障在 UI 线程；

---
## 5. openXPage() 单一职责
每个 helper 仅做两件事：
1. `NavFrame().Navigate(PageType)`
2. `UpdateNavigationSelection(tag)`

示例：
```cpp
void MainWindow::openFilesPage()
{
    if (NavFrame().SourcePageType() == xaml_typename<Pages::FilesPage>()) {
        UpdateNavigationSelection(L"files");
        return;
    }
    NavFrame().Navigate(xaml_typename<Pages::FilesPage>());
    UpdateNavigationSelection(L"files");
}
```
这样 `Navigate()` 只负责路由逻辑，不关心具体页面类型字符串。

---
## 6. 反向同步：Frame -> NavigationView
在用户通过 Back、前进或代码 `Frame.GoBack()` 导航时，需要把当前页面反射为 tag：
```cpp
void MainWindow::NavFrame_Navigated(..., NavigationEventArgs const& e)
{
    auto name = e.SourcePageType().Name; hstring tag;
    if (name == xaml_typename<Pages::HomePage>().Name) tag = L"home";
    else if (name == xaml_typename<Pages::ContactsPage>().Name) tag = L"contacts";
    // ... 其它映射 ...
    else if (name == xaml_typename<Pages::SettingsPage>().Name) tag = L"Settings";
    if (!tag.empty()) UpdateNavigationSelection(tag);
}
```
保持“页面类型 <-> tag”仅在一处映射，避免散乱重复。

---
## 7. UpdateNavigationSelection 实现要点
```cpp
void MainWindow::UpdateNavigationSelection(hstring const& tag)
{
    if (tag.empty()) return; auto nav = NavView();
    for (auto const& i : nav.MenuItems()) {
        if (auto nvi = i.try_as<NavigationViewItem>()) {
            if (unbox_value_or<hstring>(nvi.Tag(), L"") == tag) { nav.SelectedItem(nvi); return; }
        }
    }
    for (auto const& i : nav.FooterMenuItems()) {
        if (auto nvi = i.try_as<NavigationViewItem>()) {
            auto t = unbox_value_or<hstring>(nvi.Tag(), L"");
            if (t == tag || (tag == L"settings" && t == L"Settings")) { nav.SelectedItem(nvi); return; }
        }
    }
}
```
注意：一定要兼容 footer 菜单；避免在 `Navigate()` 执行时重复设置 `SelectedItem` 产生无意义的 SelectionChanged 循环。

---
## 8. Back 支持
- 标题栏 Back 按钮：绑定 `AppTitleBar_BackRequested` 调用 `NavFrame().GoBack()`。
- `IsBackButtonVisible="{x:Bind NavFrame.CanGoBack, Mode=OneWay}"` 直接数据绑定。
- 自定义逻辑可在 `NavFrame_Navigating` 中检查是否需要阻止（`e.Cancel(true)`）。

---
## 9. MVVM 协调
导航通常是“视图行为”，在多数桌面场景不强制放入 ViewModel，在对应的 xaml.cpp 文件进行 code-behind 处理即可。若需要：
- 定义 `INavigationService` 接口（暴露 `Navigate(tag)`）；
- 在 VM 中注入（构造函数或属性设置）；
- VM 触发命令 -> 调用接口；
- 确保接口不暴露页面类型（只暴露 tag / 业务枚举）。

---
## 10. 动态导航项（收藏 / 服务器 / 会话）
策略：
1. 运行时为 `NavigationView` 插入 `NavigationViewItem`；
2. 生成唯一 tag（如 `srv_<id>` / `fav_<url>`）；
3. `Navigate(tag)` 中添加前缀解析：
```cpp
if (tag.size() > 4 && tag.starts_with(L"fav_")) {
    auto url = tag.substr(4);
    // 导航到 WebView 容器页 + 参数
    openWebViewPage(url);
    return;
}
```
4. 反向同步（`NavFrame_Navigated`）时若页面携带参数，可在页面 `OnNavigatedTo` 中回调主窗更新 tag（或保持“不反选”以免覆盖当前菜单状态）。

---
## 11. 启动参数 / 深度链接
- 在 `App::OnLaunched` / 协议激活中解析参数 -> 映射 tag；
- 等窗口初始化完后调度：
```cpp
DispatcherQueue().TryEnqueue([win = m_windowWeak, tag]() {
    if (auto w = win.get()) w->Navigate(tag);
});
```
避免窗口控件尚未完成 `InitializeComponent()` 就导航导致空引用。

---
## 12. 可复用 NavigationService 示例（可选）
```cpp
struct INavigationService { virtual void Navigate(winrt::hstring const& tag) = 0; };

struct NavigationService : INavigationService {
    NavigationService(winrt::weak_ref<OpenNet::MainWindow> host) : m_host(host) {}
    void Navigate(hstring const& tag) override {
        if (auto h = m_host.get()) h->Navigate(tag);
    }
private:
    winrt::weak_ref<OpenNet::MainWindow> m_host;
};
```
在 VM：保存一个 `std::shared_ptr<INavigationService>`，通过命令触发导航。

---
## 13. 常见陷阱 & 规避
| 问题 | 原因 | 解决 |
|------|------|------|
| 频繁重新实例化页面 | 每次都 Navigate 无检查 | 先比较 `content.try_as<T>()` |
| Back 按钮不更新 | 未在 `Navigated` 中同步 | 实现 pageType -> tag 反射 |
| Settings 无法选中 | Tag 大小写不一致 | 在匹配中兼容 "settings" / "Settings" |
| 动态项不生效 | 未给 Tag | 添加唯一 tag 并在路由中解析 |
| 跨线程异常 | 后台任务直接调用导航 | 用 `DispatcherQueue().TryEnqueue` |
| 选中项闪烁 | 重复设置 SelectedItem | 仅在 tag 变化时更新 |

---
## 14. 状态保存与恢复（可扩展）
可记录：
- 当前 tag；
- 页面内部滚动 / 选中状态（通过页面自身保存）；
- 最近访问历史（栈）。

存储策略：`Windows::Storage::ApplicationData::Current().LocalSettings().Values().Insert(L"CurrentPage", box_value(tag));`
恢复：窗口构造 -> 读取 -> 延迟调用 `Navigate(savedTag)`。

---
## 15. 完整最小整合代码（裁剪版）
```cpp
// MainWindow.xaml.cpp (核心片段)
MainWindow::MainWindow() {
    InitializeComponent();
    SetTitleBar(AppTitleBar());
    InitWindowStyle(*this);
    m_viewModel = MainViewModel{}; m_viewModel.Initialize();
    NavFrame().Navigated({ this, &MainWindow::NavFrame_Navigated });
    NavView().ItemInvoked({ this, &MainWindow::NavView_ItemInvoked });
    openHomePage();
}

void MainWindow::Navigate(hstring const& tag) {
    auto weak = get_weak();
    DispatcherQueue().TryEnqueue([weak, tag]() {
        if (auto self = weak.get()) {
            auto frame = self->NavFrame(); auto content = frame.Content();
            if (tag == L"home") { if (content && content.try_as<Pages::HomePage>()) return; self->openHomePage(); return; }
            if (tag == L"files") { if (content && content.try_as<Pages::FilesPage>()) return; self->openFilesPage(); return; }
            if (tag == L"settings") { if (content && content.try_as<Pages::SettingsPage>()) return; self->openSettingsPage(); return; }
            if (!(content && content.try_as<Pages::HomePage>())) self->openHomePage();
        }
    });
}
```

---
## 16. AppWindow 补充（窗口不是导航核心）
导航逻辑与窗口管理解耦，但常见需求：
```cpp
void CustomizeWindow(winrt::Microsoft::UI::Xaml::Window const& win) {
    if (auto appWindow = win.AppWindow()) {
        // 标题栏高度
        appWindow.TitleBar().PreferredHeightOption(Microsoft::UI::Windowing::TitleBarHeightOption::Standard);
        // Presenter（覆盖窗口行为）
        if (auto presenter = appWindow.Presenter().try_as<Microsoft::UI::Windowing::OverlappedPresenter>()) {
            presenter.IsResizable(true);
            presenter.IsMaximizable(true);
        }
        appWindow.SetIcon(L"Assets/Icon.ico");
    }
}
```
> 旧示例中伪造的 `AppWindowPresenter presenter; presenter.Title(...);` 用法并不存在，正确方式是通过 `appWindow.Presenter().try_as<OverlappedPresenter>()` 访问并设置。

---
## 17. 迭代方向
- 抽象出可配置路由表（`std::unordered_map<hstring, std::function<void()>>`）减少 if 链；
- 支持参数化导航（`Navigate(L"files?mode=recent")` 解析查询）；
- 集成日志 & 性能追踪（记录导航耗时）；
- 引入“区域保活”策略（对重资源页缓存实例）。

---
## 18. 总结
标签驱动 + 去重导航 + 反向同步 = 一个稳定可扩展的 WinUI3 C++/WinRT 导航骨架。后续只需：
1. 新页面 -> 定义 tag；
2. 写 openXPage();
3. 在路由中添加判断；
4. 映射 pageType -> tag（Navigated 中）。

保持映射集中 & 线程安全，你的导航层会保持清晰与可维护。

---
**附：快速检查清单**
- [x] 单一 `Navigate(tag)` 入口
- [x] openXPage() 做导航 + 选中
- [x] 去重 try_as 检测
- [x] Navigated 反射选中
- [x] Settings 大小写兼容
- [x] UI 线程调度 TryEnqueue
- [x] 动态项 tag 约定

如需进一步抽象（路由表 / 参数化 / 多窗口复用），可在此基础继续演进。