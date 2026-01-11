# 1. 🌳环境准备: 安装兼容的 Node 版本

## 1.1. 首先检查电脑内是否安装过 Node.js
a. 在安装程序或PATH环境变量的界面里检查。如果没有安装过，请进入[第2步](#1.2.)。如果安装过，请务必卸载已安装的版本，
否则会出现版本不兼容的问题。  
	卸载系统 msi 安装的 node.js 出现未找到旧版本缓存包的问题可以
用 `winget download node.js --version <此处参数填写缺少的版本>` 对应版本安装包然后卸载
b. 确保在安装前卸载已存在的 node.js 客户端，并清空安装文件夹目录中的 node 缓存（包括 node_cache&node_global）。

c. 命令行
```Powershell
npm cache clean --force
```
以清空 npm 缓存。

d. 删除 Users\User\ 文件夹下的 .npmrc 文件，即有关 npm 的文件索引内容。
此项会导致安装的其他版本的 npm 包管理器无法正常查找路径及使用。
文件默认隐藏，需检查是否开启显示隐藏文件（Specify configs in the ini-formatted file）

## 1.2. 安装 Node.js 的版本管理器 fnm
TIPS：
a. 不要用 nvm(Node version manager)进行管理 node 版本。因为 nvm 在安装 node 时不自动安装 npm 包管理器，还需要手动加 npm 到环境变量的位置。

b. 请使用更先进的 **fnm**(fast node manager)管理并使用不同版本的 node。  
fnm 卸载 node 不成功的话任务管理器检查后台的 node.js 是否在运行中，结束任务。  
fnm 是一个高性能的 node版本命令行管理工具，方便安装，快捷切换使用 node 的不同版本以管理不同的项目
c. 使用 winget 安装 fnm，由于 winget 默认安装到` C:\Users\用户名\AppData\Local\Microsoft\WindowsApps\winget\`等过长路径，不便于环境变量等管理，所以推荐自定义路径安装。
此过程尽量简略，以安装使用，更多 fnm 详细请参考[fnm GitHub 项目](https://github.com/Schniz/fnm)
winget 详情请参考[微软官方文档](https://learn.microsoft.com/zh-cn/windows/package-manager/winget/)。

在命令行(cmd/git gui/**推荐 PowerShell v7.0** 也可以使用自带的 PowerShell v1.0，但v7.0具有更多先进特性，更多请参考[微软官方文档](https://learn.microsoft.com/zh-cn/powershell/scripting/install/installing-powershell-on-windows?view=powershell-7.4) )使用 winget 安装 fnm

### 安装 fnm

```PowerShell
winget install fnm -l "用户自定义路径"
```
安装完成后将找到自定义路径中的 fnm.exe 把其所在的目录添加的环境变量中，以便在命令行中使用 fnm 命令。操作路径：
设置-系统-关于-Related links-高级系统设置-高级-环境变量-系统变量-Path-编辑-新建-填入 fnm 安装路径。在此推荐 PowerToys 工具，可以方便快捷地 manage 环境变量。

PowerShell中运行`fnm`检查是否安装成功，若成功则会显示 fnm 的运行错误提示

## 1.3. 配置 Node.js 的版本管理器 fnm

TIPS: fnm 配置使用不易，请仔细阅读后再逐步实操

1. 设置 fnm 的命令行启动参数脚本，方便每次启动不用手动设置 fnm 的执行环境变量信息  

    fnm 环境变量的设置是为了确保在当前的 shell 会话中正确加载 fnm 的配置。每次使用 fnm 之前都需要加载环境变量的原因在于 fnm 需要修改系统的环境变量，以便能够在当前会话中正确识别和使用不同版本的 Node.js。

    **为什么需要加载 fnm 环境变量**
    1. 环境变量更新：  
        - fnm 需要修改系统路径（PATH）以及其他环境变量，以便能够正确识别和使用安装的不同版本的 Node.js。
    2. 多版本管理：  
        - fnm 允许你在不同的 Node.js 版本之间切换，因此需要确保当前会话中的环境变量正确反映了所使用的 Node.js 版本。  

    **如何永久加载 fnm 环境变量**  

    为了确保每次打开新的命令提示符或 PowerShell 会话时都能够自动加载 fnm 的环境变量，可以将加载环境变量的命令添加到你的 shell 配置文件中。  
    注意你当前在使用的是什么版本的PowerShell  
    在 PowerShell 中执行`$PROFILE`查看 PowerShell 的启动脚本配置文件路径，显示的当前用户的路径一般为`C:\Users\用户名\Documents\WindowsPowerShell\Microsoft.PowerShell_profile.ps1`。
>The locations (on Windows Vista) of the profiles for the PowerShell.exe(**v1.0**) host are as follows:
>
>- `%windir%\system32\Windows­PowerShell\v1.0\profile.ps1`  
>This is for all users of the computer and for all shells.
>
>- `%windir%\system32\Windows­PowerShell\v1.0\Microsoft.Power­Shell_profile.ps1`  
>This is for all users of the computer, but it is only for the Microsoft.PowerShell shell.
>
>- `%UserProfile%\Documents\Windows­PowerShell\profile.ps1`  
>This is for the current user only and all shells.
>
>- `%UserProfile%\Documents\WindowsPowerShell\Micro­soft.PowerShell_profile.ps1`
>This is for the current user only and only for the Microsoft.PowerShell shell.
>
>**These profiles aren't created by default. They exist only if you create them.**
>- PowerShell v7.x 使用` %\ ~~Windows~~PowerShell\ % `的文件夹，注意分辨

2. fnm 默认的 node 安装路径在C盘的用户目录下，建议更改安装和 node 的运行路径，以避免未来 node 的项目文件过大导致不易再管理
需要手动更改 node 运行变量位置。  
主要更改的是 `FNM_DIR` ，所有安装和数据都存储在 $FNM_DIR 环境变量指向的目录中。  
而 `FNM_MULTISHELL_PATH` 指向的是一个临时资源用于存储每个 shell 会话的状态信息（特定于 shell 会话的符号链接占用0B，指向 node 安装位置，此仅为 shell 的 node 临时运行位置），所以即使在C盘也不用管理  
fnm 会为每个 Node.js 版本创建一个独立的安装目录，并且它还会为每个版本维护相关的缓存。具体来说，fnm 会将 Node.js 版本安装在 FNM_DIR 指定的目录下，并且每个版本都会有自己的子目录。  
假设你设置了 `FNM_DIR` 为 `D:\Program Files\fnm-node`，那么安装的 Node.js 版本将被放置在这个目录下，每个版本会有自己的子目录。例如：  
```Powershell
D:\Program Files\fnm-node\
├── v14.17.0
├── v16.13.0
└── v18.0.0
```
### 配置 fnm
一般请按下面配置  
a. 前往`Documents\(Windows)PowerShell\`  
b. 新建`Microsoft.PowerShell_profile.ps1`文件  
c. Open it and 新增加入`fnm env --use-on-cd --shell power-shell | Out-String | Invoke-Expression`  
不建议使用 cmd 的原因也因未完全支持启动参数脚本，如过连 Windows 自带的 v1.0 版本也没有的话也请读者自行研究，或者每次使用前先运行上述命令  

d. 前往环境变量设置中添加`FNM_DIR`项目，并填入自定义的运行文件夹位置
![环境变量](https://raw.githubusercontent.com/hoshiizumiya/images/main/屏幕截图%202024-09-20%20114730.jpg)

e. 命令行中运行`fnm env`检测是否成功更改路径，注意输出结果后面的 FNM_DIR 的值
![FNM_DIR](https://raw.githubusercontent.com/hoshiizumiya/images/main/20240920115232.png)  
## 1.4. 安装适配 gitbook 的 node.js 版本

Gitbook 由于官方年久不再维护，主要开发已转移至网页端的 [gitbook.com](https://gitbook.com)。  
本地端的 gitbook client 需要特定旧版本的 node.js 版本才能正常运行才能不会报错，很多版本都有js的报错需要手动注释掉来排除  
在此推荐 `node.js v12.16.3` 版本，据大多网友反馈兼容良好不报错，本人也使用此版本  
### node 安装
命令行：
```Powershell
fnm install 12.16.3
```
安装过程出现问题自行改善网络环境  
命令行：
```Powershell
fnm use 12
```
命令行：
```Powershell
node -v
```
检查是否正常输出 node 版本号  
命令行：
```Powershell
npm
```
检查 npm 是否报错，正常是给出 npm 使用提示。  
如果执行 npm 命令之后出现报错，检查 npm 未删除的路径缓存文件是否存在，请跳转至[第一步卸载 node -d](#1.1.)  

__安装完成！__

接下来————**每次启动命令行使用 node 的流程应为首先执行**`fnm use 12`  

## 1.5. 安装 gitbook-cli
命令行：
```Powershell
npm install gitbook-cli -g
```
理论上这样就不会有错误了
命令行：
```Powershell
gitbook
```
正常显示的是 gitbook 的 usage
## 环境准备结束

如果今后使用其他版本的 node 也请效此步骤来使用 fnm 进行管理
fnm 的其他命令：
`fnm uninstall <node version>`：卸载对应版本的 node  
`fnm list`：显示当前 fnm 管理的 node 版本列表  
`fnm current`：显示当前 fnm 使用的 node 版本  

注意理论上使用 fnm 管理是会无法在全局使用 node 命令的
