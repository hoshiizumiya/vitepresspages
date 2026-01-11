# 绑定调试、性能与常见错误

本篇提供系统排错清单与性能基线策略。

---
## 1. 快速诊断步骤

1. XAML 是否加载？（构造后 `InitializeComponent()` 是否调用）
2. 绑定属性是否在 IDL 声明？
3. 模式是否需要通知（OneTime vs OneWay/TwoWay）？
4. 集合是否为 `IObservableVector<T>`？
5. setter 是否实际改变值才 Raise？
6. 输出调试：事件是否触发？

---
## 2. 调试脚手架

```cpp
#define DBG_TRACE(name) OutputDebugStringW((name + L"\n").c_str())

void WatchCollection(IObservableVector<hstring> const& vec)
{
    vec.VectorChanged([](auto const&, auto const& a){
        auto kind = a.CollectionChange();
        OutputDebugStringW((L"[VectorChanged] kind=" + winrt::to_hstring((int)kind) + L"\n").c_str());
    });
}

void RaiseProperty(winrt::event<winrt::PropertyChangedEventHandler>& evt,
                   winrt::hstring const& n)
{
    OutputDebugStringW((L"[INPC] " + n + L"\n").c_str());
    evt(nullptr, { n });
}
```

---
## 3. 常见错误与定位

| 症状 | 可能原因 | 排查 |
|------|----------|------|
| 列表不刷新 | 用 IVector / std::vector | 打印 typeid / 看集合接口 |
| 单属性不更新 | 未触发 PropertyChanged | setter 加断点 |
| XAML 编译报绑定错误 | 名称拼写、大小写 | 查看生成 g.h 搜索成员 |
| 运行期静默 | IDL 遗漏属性 | 补充 IDL 重编译 |
| 动画无法作用 | 目标非依赖属性 | 改用 DependencyProperty |
| Converter 不执行 | 用 x:Bind | 换 Binding 或包装函数 |

---
## 4. 性能基线

| 项 | 影响 | 建议 |
|----|------|------|
| 频繁小粒度列表更新 | 多帧布局抖动 | 合并写操作 / Clear+批量添加 |
| 多级嵌套绑定 | 初始化开销 | 必要属性 x:Bind，其他 Binding |
| 滥用 TwoWay | 冗余回写 | 降级为 OneWay / 命令提交 |
| 大对象在 getter 构造 | 每帧成本 | 预缓存，getter 仅返回 |

---
## 5. 内存与生命周期

| 场景 | 风险 | 对策 |
|------|------|------|
| Lambda 捕获 this | 悬空调用 | 使用 weak_ref / auto token 保存后撤销 |
| 集合事件未注销 | 长期持有对象 | 在析构或 Unloaded 事件移除 |

示例：
```cpp
winrt::event_token token;
void Hook(){ token = vec.VectorChanged([weak = get_weak()](auto&&...){ if (auto self = weak.get()) {/*...*/} }); }
void Unhook(){ vec.VectorChanged(token); }
```

---
## 6. 升级路径

| 初始实现 | 痛点 | 升级 |
|----------|------|------|
| 手写 setter + Raise | 重复模板化 | 抽取 SetProperty 模板 |
| 大量 UI 逻辑在代码后 | 难测试 | 引入 ViewModel + DataContext |
| 每次全量重建集合 | 闪烁 | 增量 Append / Diff 策略 |

---
## 7. FAQ 精选

| 问题 | 答案 |
|------|------|
| 能在不改集合的情况下强制刷新吗？ | 重新设置 ItemsSource；或虚拟化控件自带重绘。 |
| 属性名常量如何集中？ | constexpr wchar_t Name_Title[] = L"Title"; 或 enum + 映射。 |
| 支持多值绑定吗？ | x:Bind 不直接支持，使用函数参数或 Binding + MultiBinding（WinUI 3 暂缺官方 MultiBinding，需自定义）。 |

---
（完）
