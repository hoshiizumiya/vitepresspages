# 进阶
## 安装插件

推荐资源：

- [gitbook使用及 book.json 详细配置](https://blog.csdn.net/gongch0604/article/details/107494736)
- [推荐12个实用的 gitbook 插件](https://juejin.cn/post/6844903865146441741#heading-12)

## 自动编译推送脚本：  
根目录新建 text 文档，输入以下内容：


```bash
cd _book
git init
git checkout -b master
git add .
git commit -am "Update"
git push git@github.com:hoshiizumiya/gitbookpages master --force"
```
更改文件名和后缀，将上述脚本保存为 `deploy.bat`，然后在根目录下执行 `bash deploy.sh` 即可推送到远程仓库(无编译)  
解释：  
每次编译后都会重建 `_book` 文件夹，丢失 git 的更改信息，直接使用传统方式的推送会导致与 origin 大量的更改难以合并分支。  
所以需要重新新建 git 仓库，然后将 `_book` 文件夹下的所有文件强制提交覆盖远程仓库，`--force` 参数是强制推送，因为每次都是新的 `_book` 文件夹，所以需要强制推送，注意此操作也会删除 origin 的提交记录，毕竟本地没有保留更改信息。  
也在此推荐Visual Studio 的 git 管理工具，非常方便。  

## 使用 JsDelivr 加速本地静态资源

图床使用 Github 仓库，但是由于国内网络原因，Github 的资源加载速度较慢，所以可以使用 jsdelivr 加速加载。

直接上操作：
格式：`https://cdn.jsdelivr.net/gh/用户名/文件路径`（无分支）
举例：`https://cdn.jsdelivr.net/gh/hoshiizumiya/images（仓库名）/Image_1714537953090.jpg（根目录）`



## 项目迁移

正在迁移项目到 [博客园](https://www.cnblogs.com/hoshiizumiya/)