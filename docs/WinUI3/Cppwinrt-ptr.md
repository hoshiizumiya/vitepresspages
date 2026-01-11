# 简述
- `std::shared_ptr<T>` 是带引用计数的智能指针，表示“共享所有权”。最后一个持有者销毁时自动 delete 对象。
- 适合“同一对象被多处持有”的场景；复制/赋值会增加计数，销毁/重置会减少计数。
常用用法
- 创建:  
`auto p = std::make_shared<Foo>(args...);`
- 复制共享: auto q = p;  // use_count++，两者指向同一对象
- 访问: p->method(); (*p).field; p.get();  // get() 返回裸指针（只读，不接管所有权）
- 释放: p.reset();  // use_count--，到 0 时析构
- 计数: p.use_count();  // 调试用，别依赖它做逻辑
- 自定义删除器: `std::shared_ptr<Foo> p(ptr, [](Foo* x){ /.../ delete x; });`
和其他指针的对比
- unique_ptr: 独占所有权，不能随意拷贝（只能移动）。shared_ptr 可拷贝，适合共享。
- weak_ptr: 弱引用，不增加计数，避免循环引用。用 weak.lock() 获取 shared_ptr。
- 原始指针: 不管理生命周期，易泄漏。优先用智能指针管理动态对象。
易错点
- 循环引用泄漏：A 持有 `shared_ptr<B>`，B 又持有 `shared_ptr<A>`，两者都不会析构。解决：把一侧改为 weak_ptr。
- 性能细节：计数是原子操作，频繁复制有成本。函数参数尽量用 `const std::shared_ptr<T>&`，不要无谓按值传递。
- 线程安全：控制块（计数）增减是线程安全的，但对象本身不是；并发访问对象要自行加锁。
在你项目里的用法要点
- `vector<shared_ptr<TabData>>`：多个 Tab 与系统事件共享同一个 TabData，合适。
- 传参/捕获：异步/事件里捕获 shared_ptr 会延长对象生命周期，避免早析构；若担心长链条持有造成循环，考虑捕获 weak_ptr 再 lock。
- 与 C++/WinRT 类型混用：TabData 里装的是 WinRT 对象（如 WebView2、TextBlock），它们自己有 COM 引用计数；shared_ptr 只管理 TabData，不会干扰 WinRT 对象的内部计数。
小范式
- 工厂创建：`auto tab = std::make_shared<TabData>();`
- 放容器：m_tabs.push_back(tab);
- 传参（避免多余计数变动）：`void UseTab(const std::shared_ptr<TabData>& tab);`
- 弱引用打破环：`std::weak_ptr<TabData> back_; if (auto s = back_.lock()) { /* use s */ }`
什么时候别用 shared_ptr
- 明确唯一所有权时，用 unique_ptr 更简单高效。
- 仅做“观察者”时，用 weak_ptr 或裸指针（不转交所有权）更合适。
