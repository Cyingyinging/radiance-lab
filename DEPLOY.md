# 部署说明

当前项目已经整理为静态网站结构，可直接用于 Vercel、Netlify 或 GitHub Pages。

## 推荐部署方式

优先推荐 GitHub Pages。

项目中已经包含：

- `.github/workflows/deploy-pages.yml`
- `.nojekyll`

上传到 GitHub 仓库后，推送到 `main` 分支即可自动触发 Pages 部署。

## GitHub Pages

1. 在 GitHub 新建一个公开仓库
2. 将 `radiance-lab` 目录中的全部文件上传到仓库根目录
3. 仓库默认分支使用 `main`
4. 进入仓库 `Settings > Pages`
5. 在 `Source` 中选择 `GitHub Actions`
6. 返回仓库主页，等待 `Actions` 中的 `Deploy Pages` 工作流运行完成

公网地址通常为：

- `https://<你的 GitHub 用户名>.github.io/<仓库名>/`

如果仓库名使用：

- `<你的 GitHub 用户名>.github.io`

则公网地址通常为：

- `https://<你的 GitHub 用户名>.github.io/`

## Vercel

1. 新建一个 GitHub 仓库
2. 将 `radiance-lab` 目录内容上传到仓库根目录
3. 登录 Vercel
4. 选择 `Add New Project`
5. 导入该 GitHub 仓库
6. 保持默认静态站点设置并部署

## 当前已准备好的文件

- `index.html`
- `styles.css`
- `app.js`
- `vercel.json`
- `.nojekyll`
- `.github/workflows/deploy-pages.yml`

## 本地预览

- 双击 `start-radiance-lab.bat`
- 或直接打开 `index.html`
