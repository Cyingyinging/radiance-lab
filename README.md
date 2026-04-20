# Radiance Lab

一个独立的静态网页项目，用于黑体/灰体红外辐射计算、辐亮度曲线展示和基础理论浏览。

## 当前功能

- 输入温度、发射率、起始波长、结束波长和采样点数
- 支持按波长或按波数显示
- 支持多种谱辐亮度单位换算
- 鼠标悬停查看曲线上对应点的数值
- 展示峰值波长、峰值谱辐亮度、波段积分辐亮度、总辐射出射度
- 提供 Planck、Wien、Stefan-Boltzmann 和红外波段简要理论说明

## 项目文件

- `index.html` 页面结构
- `styles.css` 页面样式
- `app.js` 计算和交互逻辑
- `launcher.py` 本地桌面启动器
- `start-radiance-lab.bat` Windows 双击启动脚本
- `vercel.json` 静态部署配置

## 本地作为网页打开

方法一：

- 直接打开 `index.html`

方法二：

- 双击 `start-radiance-lab.bat`
- 脚本会启动一个本地服务并自动打开浏览器
- 浏览器地址形如 `http://127.0.0.1:xxxxx/index.html`

## 打包为桌面可执行文件

当前环境已具备 Python，但未安装 PyInstaller。

当 PyInstaller 可用后，可以在项目目录执行：

```powershell
pyinstaller --noconsole --onefile launcher.py --name RadianceLab
```

生成的可执行文件会位于：

- `dist/RadianceLab.exe`

## 发布为可访问的网站

这个项目是纯静态网页，可以直接部署到以下平台：

- Vercel
- Netlify
- GitHub Pages

推荐方式：

1. 把 `radiance-lab` 上传到一个 GitHub 仓库
2. 在 Vercel 中导入该仓库
3. 保持入口文件为 `index.html`
4. 部署完成后即可获得公开网址

## 计算说明

- 谱辐亮度：按 Planck 定律计算，并乘以发射率 `epsilon`
- 波段积分：使用梯形积分
- 峰值波长：使用 Wien 位移定律
- 总辐射出射度：使用 `epsilon * sigma * T^4`
