import { defineConfig } from 'vitepress'

// https://vitepress.dev/reference/site-config
export default defineConfig({
    title: "Hoshiizumiya",
    base: "/vitepresspages/",
    description: "learn notes",
    themeConfig: {
        // https://vitepress.dev/reference/default-theme-config
        nav:
            [
                { text: 'Home', link: '/index.md' },
                { text: 'About me', link: '/README.md' }
            ],

        sidebar: [
            {
                text: '过时的项目指南',
                items: [
                    { text: 'gitbook本地部署', link: '/gitbook本地部署全指南/gitbook部署简介' }
                ]
            },
            {
                text: 'C++',
                items: [
                    { text: '目录', link: '/C++/目录' },
                    { text: '字符串', link: '/C++/字符串' },
                    { text: '指针', link: '/C++/指针' },
                    { text: '连续读取', link: '/C++/连续读取' },
                    { text: 'JAVA类数组和方法的重构', link: '/C++/2' },
                    { text: 'C++ 11 —— 移动语义', link: '/C++/memory1' }
                ]
            },
            {
                text: '计算机图形学',
                items: [
                    { text: '目录', link: '/计算机图形学/目录.md' }
                ]
            },
            {
                text: 'WinUI3 C++/WinRT 原理及实践',
                items: [
                    { text: '目录', link: '/WinUI3/index.md'},
                    { text: 'EP3', link: '/WinUI3/EP3.md' },
                    { text: 'cpp/WinRT入门-TitleBar标题栏', link: '/WinUI3/TitleBar.md' },
                    { text: 'cpp/WinRT入门-模板元编程在 WinRT 中的实现', link: '/WinUI3/Template.md' },
                    { text: 'cpp/WinRT入门-Loaded事件', link: '/WinUI3/Loaded.md'},
                    { text: 'cpp/WinRT入门-页面操作其一', link: '/WinUI3/Page&Window1.md'},
                    { text: 'cpp/WinRT入门-页面操作其二', link: '/WinUI3/Page&Window2.md'},
                    { text: 'cpp/WinRT入门-页面初始化', link: '/WinUI3/InitializeComponent.md'},
                    { text: 'cpp/WinRT入门-数据与界面绑定更新', link: '/WinUI3/data&ui.md'},
                    { text: 'cpp/WinRT入门-高级数据绑定与 MVVM 架构实践P1', link: '/WinUI3/winui3-advanced-binding.md'},
                    { text: 'cpp/WinRT入门-WinRT 接口机制与继承模型详解', link: '/WinUI3/interface.md'},
                    { text: '系列教程-第零部分-环境配置与基础概念', link: '/WinUI3/WinUI3-WinRT-CPP-完整教程-第零部分-环境配置与基础概念.md' },
                    { text: '系列教程-第一部分-基础概念与架构', link: '/WinUI3/WinUI3-WinRT-CPP-完整教程-第一部分-基础概念与架构.md' },
                    { text: '系列教程-第二部分-实践开发指南', link: '/WinUI3/WinUI3-WinRT-CPP-完整教程-第二部分-实践开发指南.md' },
                    { text: '系列教程-第三部分-高级特性与深度开发', link: '/WinUI3/WinUI3-WinRT-CPP-完整教程-第三部分-高级特性与深度开发.md' },
                    { text: '系列教程-第四部分-基础API与类型系统深度解析', link: '/WinUI3/WinUI3-WinRT-CPP-完整教程-第四部分-基础API与类型系统深度解析.md' },
                    { text: '系列教程-第五部分-XAML框架与数据绑定深层机制', link: '/WinUI3/WinUI3-WinRT-CPP-完整教程-第五部分-XAML框架与数据绑定深层机制.md' },
                    { text: '系列教程-第六部分-实战技巧与最佳实践', link: '/WinUI3/WinUI3-WinRT-CPP-完整教程-第六部分-实战技巧与最佳实践.md' },
                    { text: 'Windows 缩放控制', link: '/WinUI3/scale.md' },

                ]
            }
        ],

        socialLinks: [
            { icon: 'github', link: 'https://github.com/hoshiizumiya' }
        ]
    }
})
