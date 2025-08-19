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
                        { text: 'C++ 11 —— 移动语义', link: '/C++/memory1' }
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
                        { text: '原理及实践-页面初始化', link: '/WinUI3/InitializeComponent.md' },
                        { text: '原理及实践-数据绑定总览（入口）', link: '/WinUI3/data&ui.md' },
                        { text: '原理及实践-高级数据绑定与 MVVM 架构实践P1', link: '/WinUI3/winui3-advanced-binding.md' },
                        { text: '原理及实践-WinRT 接口机制与继承模型详解', link: '/WinUI3/interface.md' },

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
