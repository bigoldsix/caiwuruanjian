# 费用报销系统 — 免部署版

## 架构

```
前端: React + Ant Design (Vite)
后端: FastAPI + SQLAlchemy (async) + PostgreSQL
数据库: Supabase PostgreSQL (免费 500MB)
文件存储: Supabase Storage (免费 1GB)
部署平台: Vercel (免费 Hobby 套餐)
```

## 部署步骤（零命令行，仅需 GitHub 账号）

### 1. 注册 Supabase 并创建数据库

1. 打开 https://supabase.com，用 GitHub 账号登录
2. 点击 "New project"，填写项目名（如 `expense-system`）
3. 设置数据库密码（**记下来**），选择合适的区域
4. 等待创建完成（约 2 分钟）
5. 进入项目 → **Project Settings → Database → Connection string（URI）**
   - 复制 `postgresql://...` 格式的连接串
   - 将 `postgresql://` 改为 `postgresql+asyncpg://`
   - 这就是 `DATABASE_URL`

### 2. 创建发票存储 Bucket

1. 在 Supabase 项目 → **SQL Editor** 中执行：

```sql
INSERT INTO storage.buckets (id, name, public) VALUES ('invoices', 'invoices', true);
```

### 3. 获取 Supabase API 配置

项目 → **Settings → API** → 复制：
- `Project URL` → 作为 `SUPABASE_URL`
- `service_role key` → 作为 `SUPABASE_SERVICE_KEY`

### 4. 部署到 Vercel

1. 打开 https://vercel.com，用 GitHub 账号登录
2. 点击 **Add New → Project** → 导入本仓库
3. 框架选择 **Other**
4. 在 **Environment Variables** 中添加：

| 变量名 | 值 |
|--------|------|
| `DATABASE_URL` | `postgresql+asyncpg://...` |
| `JWT_SECRET_KEY` | 随机字符串 |
| `JWT_REFRESH_SECRET_KEY` | 另一随机字符串 |
| `SUPABASE_URL` | 第 3 步的 Project URL |
| `SUPABASE_SERVICE_KEY` | 第 3 步的 service_role key |
| `SUPABASE_STORAGE_BUCKET` | `invoices` |

5. 点击 **Deploy**，等待完成（约 2-3 分钟）

### 5. 使用

- 默认管理员：`admin@company.com` / `admin123`
- 首次登录后建议修改密码

## 本地开发

```bash
# 后端
cd backend
pip install -r ../requirements.txt
cp ../.env.example .env
# 编辑 .env 填写 Supabase 连接信息
python -m uvicorn app.main:app --reload

# 前端
cd frontend
npm install
npm run dev
```
