# 窗口材质
```xml
<Window.SystemBackdrop>
   <MicaBackdrop />
</Window.SystemBackdrop>
```
> 这段代码是 WinUI 3 中用于设置窗口背景效果的 XAML 代码

## `<Window.SystemBackdrop>` 是什么？

这是 WinUI 3 中的一个窗口属性，用于设置窗口的系统背景效果。它允许您为应用程序窗口应用现代的 Windows 11 风格的背景材质。修改此项在调试状态不会热重载，需要重新启动调试运行部分编译。

## `<MicaBackdrop />` 的作用

`MicaBackdrop` 是 Windows 11 中引入的一种新的背景材质效果，具有以下特点：

1. **半透明效果**：创建一种微妙的半透明背景
2. **桌面壁纸融合**：背景会与用户的桌面壁纸颜色产生融合效果
3. **现代设计语言**：符合 Windows 11 的 Fluent Design 设计理念
4. **性能优化**：相比其他背景效果，Mica 材质性能更好

## 视觉效果

使用 Mica 背景后，应用窗口会：
- 呈现出柔和的半透明效果
- 背景颜色会根据用户的桌面壁纸主色调进行调整
- 在深色和浅色主题下都有良好的视觉表现
- 让应用更好地融入 Windows 11 的整体视觉风格
- 注意 Win10 系统不支持此效果

## 其他可选的背景类型

除了 `MicaBackdrop`，WinUI 3 还支持其他背景类型：
- `AcrylicBackdrop`：亚克力材质（更强的模糊效果）
- `MicaBackdrop Alt`：替代 Mica 材质（不同的模糊效果）具有更强的模糊效果
- `DesktopAcrylicBackdrop`：桌面亚克力材质

如果不设置 `<Window.SystemBackdrop>`，WinUI 3 应用窗口将不会有 Mica、Acrylic 等特殊背景效果，而是使用系统默认的普通窗口背景
（纯色，跟随系统主题的浅色或深色）。也就是说，窗口背景不会有半透明、模糊或壁纸融合等现代视觉效果，只是普通的实色背景。