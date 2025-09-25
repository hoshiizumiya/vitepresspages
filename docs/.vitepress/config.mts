import { defineConfig } from 'vitepress'

// https://vitepress.dev/reference/site-config
export default defineConfig({
    title: "Hoshiizumiya",
    base: "/vitepresspages/",
    description: "learn notes",
    themeConfig: {
        // https://vitepress.dev/reference/default-theme-config
        logo: '/favicon.jpg',
        lastUpdated: {
            text: 'Updated at',
            formatOptions: {
                dateStyle: 'full',
                timeStyle: 'medium'
            }
        },
        search: {
            provider: 'local'
        },
        nav:
            [
                { text: 'Home', link: '/index.md' },
                { text: 'About me', link: '/README.md' }
            ],

        sidebar:
        {
            '/gitbook本地部署全指南/': [
                {
                    text: '过时的项目指南',
                    collapsed: false,
                    items: [
                        { text: 'gitbook本地部署', link: '/gitbook本地部署全指南/gitbook部署简介' }
                    ]
                }
            ],
            '/C++/': [
                {
                    text: 'C++',
                    collapsed: false,
                    items: [
                        { text: '目录', link: '/C++/目录' },
                        { text: '字符串', link: '/C++/字符串' },
                        { text: '指针', link: '/C++/指针' },
                        { text: '连续读取', link: '/C++/连续读取' },
                        { text: 'JAVA类数组和方法的重构', link: '/C++/2' },
                        { text: 'C++ 11 —— 移动语义', link: '/C++/memory1' },
                        { text: 'const 笔记', link: '/C++/cpp-const-usage' },
                        { text: '头文件包含', link: '/C++/cpp-headinclude.md' },
                        { text: '模板继承/多继承', link: '/C++/cpp-inheritance.md' },
                        { text: '解决方案依赖', link: '/C++/cpp-solutionDependency.md' },
                        { text: 'Visual Studio类创建', link: '/C++/vs-class-create.md' },
                        { text: 'VS项目资源文件未加载', link: '/C++/vscpp-resourcefilenotload.md' },
                        { text: 'CRTP 模式讲解', link: '/C++/zerohajimeideicrtp.md' },
                    ]
                }
            ],
            '/计算机图形学/': [
                {
                    text: '计算机图形学',
                    collapsed: false,
                    items: [
                        { text: '目录', link: '/计算机图形学/index.md' }
                    ]
                }
            ],
            '/计算机网络/': [
                {
                    text: '计算机网络',
                    collapsed: false,
                    items: [
                        { text: '目录', link: '/计算机网络/index.md' },
                        { text: '5G NR-ARFCN 解析', link: '/计算机网络/5G.md' },
                        { text: 'BT识别', link: '/计算机网络/BT.md' },
                        { text: '系统代理', link: '/计算机网络/系统代理.md' },
                        { text: 'tcp/ip协议交换开销', link: '/计算机网络/tcpip协议开销.md' },
                    ]
                }
            ],
            '/Windows/': [
                {
                    text: 'Windows',
                    collapsed: false,
                    items: [
                        { text: '目录', link: '/Windows/index.md' },
                        { text: 'Windows内核', link: '/Windows/Windows内核.md' },
                        { text: 'Windows 缩放控制', link: '/Windows/scale.md' },
                    ]
                }
            ],
            '/WinUI3/': [
                {
                    text: 'WinUI3 C++/WinRT——入门详解——原理及实践系列',
                    collapsed: false,
                    items: [
                        { text: '目录', link: '/WinUI3/index.md' },
                        { text: 'EP3', link: '/WinUI3/EP3.md' },
                        { text: '原理及实践-WinRT 命名空间基础', link: '/WinUI3/WinUI3-WinRT-namespaceBasement.md' },
                        { text: '原理及实践-TitleBar标题栏', link: '/WinUI3/TitleBar.md' },
                        { text: '原理及实践-模板元编程在 WinRT 中的实现', link: '/WinUI3/Template.md' },
                        { text: '原理及实践-页面加载事件', link: '/WinUI3/Loaded.md' },
                        { text: '原理及实践-页面操作其一', link: '/WinUI3/Page&Window1.md' },
                        { text: '原理及实践-页面操作其二', link: '/WinUI3/Page&Window2.md' },
                        { text: '原理及实践-现代C++ 中智能指针使用', link: '/WinUI3/Cppwinrt-ptr.md' },
                        { text: 'C++ / XAML 连接架构', link: '/WinUI3/CPPXAML-framework.md' },
                        { text: '原理及实践-页面初始化', link: '/WinUI3/InitializeComponent.md' },
                        {
                            text: '原理及实践-数据绑定',
                            items: [
                                { text: '数据与界面绑定更新（综述入口）', link: '/WinUI3/data&ui.md' },
                                { text: 'WinRT 集合接口全览', link: '/WinUI3/winrt-collections-overview.md' },
                                { text: '数据绑定基础模型', link: '/WinUI3/data-binding-basics.md' },
                                { text: '集合绑定与 IObservableVector', link: '/WinUI3/collection-binding.md' },
                                { text: '单属性通知与 INotifyPropertyChanged', link: '/WinUI3/property-change-notification.md' },
                                { text: '依赖属性与附加属性', link: '/WinUI3/dependency-attached-properties.md' },
                                { text: 'ComboBox 三种绑定模式示例', link: '/WinUI3/combobox-binding-examples.md' },
                                { text: '绑定调试与常见错误', link: '/WinUI3/binding-debugging-and-pitfalls.md' },
                                { text: '', link: '/WinUI3/' },
                            ]
                        },
                        {
                            text: '原理及实践-MVVM & 高级数据绑定深入实践系列',
                            items: [
                                { text: '第1篇：基础与核心实现', link: '/WinUI3/winui3-advanced-binding.md' },
                                { text: '第2篇：高级绑定与结构深化', link: '/WinUI3/winui3-mvvm-part2-advanced-binding.md' },
                                { text: '第3篇：异步服务注入与测试', link: '/WinUI3/winui3-mvvm-part3-async-services-testing.md' },
                                { text: '第4篇：性能诊断与架构演进', link: '/WinUI3/winui3-mvvm-part4-performance-diagnostics-architecture.md' },
                                { text: 'Window 与 AppWindow 自定义', link: '/WinUI3/winrt-appWindow-custom.md' },
                                { text: 'MVVM 从入门到精通指南', link: '/WinUI3/mvvm-bind-V-VM.md' },
                                { text: 'MVVM 模式速查与实例', link: '/WinUI3/mvvm-build.md' },
                                { text: 'C++/WinRT 命名空间要求', link: '/WinUI3/mvvm-namespace.md' },
                                { text: 'XAML 附加属性', link: '/WinUI3/Xaml-register.md' },
                                { text: 'XAML 模板绑定TemplateBinding', link: '/WinUI3/Xaml-TemplateBinding.md' },
                                { text: '窗口材质', link: '/WinUI3/Xaml-Window-Material.md' },
                            ]
                        },
                        { text: '原理及实践-WinRT 接口机制与继承模型详解', link: '/WinUI3/interface.md' },
                        { text: '原理及实践-WinRT C++和C#语言实现区别', link: '/WinUI3/winrt-cs-grammer.md' },
                        { text: '原理及实践-WinRT hstring类型精讲', link: '/WinUI3/winrt-hstring.md' },

                    ]
                },
                {
                    text: 'WinUI3 C++/WinRT——开发教程系列',
                    collapsed: false,
                    items: [
                        { text: '系列教程-第零部分-环境配置与基础概念', link: '/WinUI3/WinUI3-WinRT-CPP-完整教程-第零部分-环境配置与基础概念.md' },
                        { text: '系列教程-第一部分-基础概念与架构', link: '/WinUI3/WinUI3-WinRT-CPP-完整教程-第一部分-基础概念与架构.md' },
                        { text: '系列教程-第二部分-实践开发指南', link: '/WinUI3/WinUI3-WinRT-CPP-完整教程-第二部分-实践开发指南.md' },
                        { text: '系列教程-第三部分-高级特性与深度开发', link: '/WinUI3/WinUI3-WinRT-CPP-完整教程-第三部分-高级特性与深度开发.md' },
                        { text: '系列教程-第四部分-基础API与类型系统深度解析', link: '/WinUI3/WinUI3-WinRT-CPP-完整教程-第四部分-基础API与类型系统深度解析.md' },
                        { text: '系列教程-第五部分-XAML框架与数据绑定深层机制', link: '/WinUI3/WinUI3-WinRT-CPP-完整教程-第五部分-XAML框架与数据绑定深层机制.md' },
                        { text: '系列教程-第六部分-实战技巧与最佳实践', link: '/WinUI3/WinUI3-WinRT-CPP-完整教程-第六部分-实战技巧与最佳实践.md' },

                    ]
                }
            ]
        }
        ,

        socialLinks: [
            { icon: 'github', link: 'https://github.com/hoshiizumiya' }
        ]
    }
})
