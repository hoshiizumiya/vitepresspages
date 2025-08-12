# 2.🎯gitbook使用
本文简要介绍用法，创建项目及进行编辑操作 
## 2.1 创建一个 gitbook 项目

文件资源管理器在本地磁盘中尽量选择一个空目录，创建你的 gitbook folder  
进入项目文件夹  
右键→在终端中打开  
你会发现命令行操作的目录即为当前打开的文件目录，当然也可以手动 cd 到此目录下进行操作  
命令行：
```Powershell
gitbook init
// 执行项目初始化，gitbook 会自动创建需要的文件
```
```Powershell
gitbook build
// 根据现有的文件创建 gitbook 页面, 页面不会自动生成，需要手动执行此命令构建
```
```Powershell
gitbook serve
// 启动本地端口快速进行网页预览
```
Gitbook serve 启动后会先将网页构建，之后会自动监听文件内容的变化，实时生成更新页面（插件等更改不会生效），可在浏览器中预览效果  
按住 Ctrl 和鼠标左键点击链接可在浏览器新标签页快速打开链接。
Ctrl+C 可以终止 serve 命令  

此为一个项目结构示例：
>my-gitbook/  
>├── book.json(配置文件，可能没有自动生成，需要手动创建)  
>├── README.md（gitbook 首页）  
>|── SUMMARY.md（gitbook 遵循此文件内容进行网页生成）  
>└── _book（gitbook 生成的静态页面文件夹）

你需要在根目录中建立你文件夹目录，然后在 SUMMARY.md 根据示例中添加目录链接，gitbook 会根据此文件生成目录结构  
链接语法遵循 markdown 语法，可参考 [markdown 语法](https://www.runoob.com/markdown/md-tutorial.html)

相对链接示例：
```Powershell
- [自定义标题名称](根目录下自创建的文件夹名称\文件名.md)
```

插件加载出错问题解决方案：
[Click here](https://www.cnblogs.com/lingchen-liang/p/13537685.html#:~:text=%E5%8E%9F%E5%9B%A0%EF%BC%9A%20theme.js%E9%97%AE%E9%A2%98%EF%BC%8Cgitbook%E4%BD%9C%E8%80%85%E5%B7%B2%E6%8F%90%E4%BE%9B%E4%BA%86%E8%A7%A3%E5%86%B3%E6%96%B9%E6%B3%95%EF%BC%8C%E7%94%B1%E4%BA%8Egitbook%E6%9C%AA%E5%86%8D%E6%9B%B4%E6%96%B0%EF%BC%88%E6%9C%80%E8%BF%91%E4%B8%80%E6%AC%A1%E6%9B%B4%E6%96%B0%E5%9C%A82018%E5%B9%B4%EF%BC%89%E6%89%80%E4%BB%A5%E8%BF%99%E4%B8%AA%E9%97%AE%E9%A2%98%E6%9C%AA%E8%83%BD%E7%9C%9F%E6%AD%A3%E7%9A%84%E8%A7%A3%E5%86%B3%E3%80%82%20%E8%A7%A3%E5%86%B3%E6%96%B9%E5%BC%8F%EF%BC%9A%20build%E8%BE%93%E5%87%BA%E7%9B%AE%E5%BD%95%E4%B8%8Bgitbook%E6%96%87%E4%BB%B6%E5%A4%B9%EF%BC%8C%E6%98%AF%E8%AF%A5%E6%96%87%E4%BB%B6%E5%A4%B9%E4%B8%8Btheme.js%E7%9A%84%E9%97%AE%E9%A2%98%E3%80%82,%E5%A6%82%E6%88%91%E7%9A%84%E8%BE%93%E5%87%BA%E7%9B%AE%E5%BD%95%E6%98%AFoutput%EF%BC%8C%E6%89%80%E4%BB%A5%E9%97%AE%E9%A2%98%E5%9C%A8%EF%BC%9Aoutputgitbooktheme.js%E3%80%82%20%E6%88%91%E4%BB%AC%E9%9C%80%E8%A6%81%E5%9C%A8theme.js%E4%B8%AD%E6%9F%A5%E6%89%BE%EF%BC%9Aif%20%28m%29for%EF%BC%8C%E5%B0%86%E5%85%B6%E4%B8%AD%E7%9A%84m%E6%8D%A2%E4%B8%BAfalse%E3%80%82%20%E6%B2%A1%E9%94%99%EF%BC%8C%E5%B0%B1%E5%8F%AA%E8%BF%99%E4%B8%80%E4%B8%AAm%E6%90%9E%E5%BE%97%E9%AC%BC%EF%BC%8C%E8%80%8C%E4%B8%94%E6%88%91%E4%BB%AC%E9%9C%80%E8%A6%81build%E4%B8%80%E6%AC%A1%EF%BC%8C%E4%BF%AE%E6%94%B9%E4%B8%80%E6%AC%A1%E3%80%82)  
修改用户目录（`$User$`）的`.gitbook\versions\3.2.3\lib\output\website\copyPluginAssets.js`文件，把112行的confirm改为false。