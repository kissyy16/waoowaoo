# waoowaoo 与 AI 培训平台共服部署

目标服务器：

- IP：`47.95.30.221`
- 系统：`Alibaba Cloud Linux 3.2104 LTS 64位`
- 当前系统域名：`https://aivideo.deheshuntian.com`
- MinIO 文件域名：`https://aivideo-files.deheshuntian.com`
- 管理员 owner：`superadmin`

本目录已固化部署参数，`docker-compose.yml` 可直接在服务器执行。部署方式统一为：本地当前代码构建成 `waoowaoo-local:latest` 镜像，再把源码、部署配置、Docker 镜像一起打成发布包，上传到服务器固定目录后执行 `docker load` 和 `docker compose up -d`。此部署流程不会拉取 `ghcr.io/saturndec/waoowaoo:latest`。

## 1. 本地打包

在 WebStorm 终端执行：

```bash
cd D:/projects/waoowaoo
node deploy/ai-training-shared/package-local.mjs
```

脚本会构建本地当前代码：

- `docker build --progress=plain --build-arg NODE_IMAGE=... --build-arg NPM_REGISTRY=... -t waoowaoo-local:latest .`
- `docker save -o image/waoowaoo-image-latest.tar waoowaoo-local:latest`

为了解决 `node:20-alpine` 拉取失败和 `npm ci` 依赖下载失败，脚本会先依次拉取这些基础镜像：

- `node:20-alpine`
- `docker.m.daocloud.io/library/node:20-alpine`
- `docker.1ms.run/library/node:20-alpine`
- `docker.1panel.live/library/node:20-alpine`
- `dockerpull.com/library/node:20-alpine`
- `public.ecr.aws/docker/library/node:20-alpine`

基础镜像拉取成功后，脚本会使用以下 npm 源依次构建；构建日志使用 `--progress=plain`，可以直接看到 `npm ci` 的完整错误：

- `https://registry.npmmirror.com`
- `https://registry.npmjs.org`
- `https://mirrors.cloud.tencent.com/npm/`
- `https://repo.huaweicloud.com/repository/npm/`

如果你已经手动构建过 `waoowaoo-local:latest`，只想重新打包已有镜像，可以使用：

```bash
node deploy/ai-training-shared/package-local.mjs --use-existing-image
```

生成文件：

```text
deploy/ai-training-shared/dist/waoowaoo-server-package.tar.gz
```

发布包内容：

- `image/`：由本地当前代码构建好的 Docker 镜像，服务器直接 `docker load`
- `source/`：当前项目源码，作为部署留档和备用
- `deploy/`：当前部署目录，用于服务器执行 `docker compose up -d`

## 2. 上传到服务器

在 WebStorm 终端执行：

```bash
ssh root@47.95.30.221 "mkdir -p /opt/waoowaoo/uploads"
scp deploy/ai-training-shared/dist/waoowaoo-server-package.tar.gz root@47.95.30.221:/opt/waoowaoo/uploads/
```

## 3. 服务器解包

登录服务器：

```bash
ssh root@47.95.30.221
```

解包到固定目录：

```bash
mkdir -p /opt/waoowaoo/package /opt/waoowaoo/source
rm -rf /opt/waoowaoo/package/source /opt/waoowaoo/package/deploy
tar -xzf /opt/waoowaoo/uploads/waoowaoo-server-package.tar.gz -C /opt/waoowaoo/package

cp -a /opt/waoowaoo/package/deploy/. /opt/waoowaoo/
rm -rf /opt/waoowaoo/source
cp -a /opt/waoowaoo/package/source /opt/waoowaoo/source

docker load -i /opt/waoowaoo/package/image/waoowaoo-image-latest.tar

cd /opt/waoowaoo
docker compose config --quiet
```

如果当前只开 HTTP、还没启用 HTTPS，启动前临时改成 HTTP：

```bash
cd /opt/waoowaoo
cp docker-compose.yml docker-compose.https.yml
sed -i \
  -e 's#https://aivideo.deheshuntian.com#http://aivideo.deheshuntian.com#g' \
  -e 's#https://aivideo-files.deheshuntian.com#http://aivideo-files.deheshuntian.com#g' \
  docker-compose.yml
```

正式启用 HTTPS 后恢复：

```bash
cd /opt/waoowaoo
cp docker-compose.https.yml docker-compose.yml
docker compose up -d
```

## 4. 初始化 MySQL

AI 培训平台 MySQL 容器名为 `mysql`。执行：

```bash
docker exec -i mysql mysql -uroot -p'2r9Li0QdnH6Absst0nJj' <<'SQL'
CREATE DATABASE IF NOT EXISTS `waoowaoo`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

CREATE USER IF NOT EXISTS 'waoowaoo'@'%'
  IDENTIFIED BY 'waoowaoo123';

ALTER USER 'waoowaoo'@'%'
  IDENTIFIED BY 'waoowaoo123';

GRANT ALL PRIVILEGES ON `waoowaoo`.* TO 'waoowaoo'@'%';
FLUSH PRIVILEGES;
SQL
```

## 5. 增加 Nginx 配置

编辑 AI 培训平台 Nginx 配置：

```bash
vi /opt/ai-training/nginx/conf/nginx.conf
```

在 `http { ... }` 内增加以下内容。当前先只启用 `80`，`443/ssl` 已注释。

```nginx
# ---------- waoowaoo upstream，建议放在 upstream kkfileview 后面 ----------
upstream waoowaoo_app {
    server 127.0.0.1:13000;
}

upstream waoowaoo_board {
    server 127.0.0.1:13010;
}

upstream waoowaoo_minio {
    server 127.0.0.1:19000;
}

# ---------- waoowaoo 主站，建议放在 AI 培训平台原 server 块后面 ----------
server {
    listen       80;
    server_name aivideo.deheshuntian.com;

    # listen       443 ssl;
    # ssl_certificate      /etc/nginx/cert/fullchain.pem;
    # ssl_certificate_key  /etc/nginx/cert/privkey.pem;
    # ssl_session_timeout 5m;
    # ssl_ciphers ECDHE-RSA-AES128-GCM-SHA256:ECDHE:ECDH:AES:HIGH:!NULL:!aNULL:!MD5:!ADH:!RC4;
    # ssl_protocols TLSv1.2 TLSv1.3;
    # ssl_prefer_server_ciphers on;

    client_max_body_size 500m;

    location /admin/queues/ {
        proxy_pass http://waoowaoo_board/admin/queues/;
        proxy_set_header Host $http_host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header REMOTE-HOST $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 600s;
        proxy_send_timeout 600s;
        proxy_buffering off;
        proxy_cache off;
    }

    location / {
        proxy_pass http://waoowaoo_app;
        proxy_set_header Host $http_host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header REMOTE-HOST $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 600s;
        proxy_send_timeout 600s;
        proxy_buffering off;
        proxy_cache off;
    }
}

# ---------- MinIO 文件访问 ----------
server {
    listen       80;
    server_name aivideo-files.deheshuntian.com;

    # listen       443 ssl;
    # ssl_certificate      /etc/nginx/cert/fullchain.pem;
    # ssl_certificate_key  /etc/nginx/cert/privkey.pem;
    # ssl_session_timeout 5m;
    # ssl_ciphers ECDHE-RSA-AES128-GCM-SHA256:ECDHE:ECDH:AES:HIGH:!NULL:!aNULL:!MD5:!ADH:!RC4;
    # ssl_protocols TLSv1.2 TLSv1.3;
    # ssl_prefer_server_ciphers on;

    client_max_body_size 500m;

    location / {
        proxy_pass http://waoowaoo_minio;
        proxy_set_header Host $http_host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header REMOTE-HOST $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_http_version 1.1;
        proxy_connect_timeout 60s;
        proxy_read_timeout 600s;
        proxy_send_timeout 600s;
        proxy_buffering off;
        proxy_request_buffering off;
    }
}
```

校验并重载：

```bash
docker exec nginx-web nginx -t
docker exec nginx-web nginx -s reload
```

## 6. 启动当前系统

```bash
cd /opt/waoowaoo
docker compose up -d
docker compose logs -f app
```

首次启动会自动执行 `npx prisma db push --skip-generate` 初始化数据库表。

## 7. 创建管理员

```bash
docker exec -it waoowaoo-app npm run admin:create -- --username superadmin --password 'admin123'
```

登录后进入设置中心配置 AI 服务 API Key。

## 8. 验证

HTTP 联调：

```bash
curl -I http://aivideo.deheshuntian.com
curl -I http://aivideo-files.deheshuntian.com/minio/health/live
```

浏览器访问：

- `http://aivideo.deheshuntian.com`
- `http://aivideo.deheshuntian.com/admin/queues/`

启用 HTTPS 后访问：

- `https://aivideo.deheshuntian.com`
- `https://aivideo.deheshuntian.com/admin/queues/`

## 9. 更新系统

本地重新打包并上传：

```bash
cd D:/projects/waoowaoo
node deploy/ai-training-shared/package-local.mjs
scp deploy/ai-training-shared/dist/waoowaoo-server-package.tar.gz root@47.95.30.221:/opt/waoowaoo/uploads/
```

服务器解包、构建并重启：

```bash
cd /opt/waoowaoo
cp docker-compose.yml "docker-compose.yml.bak.$(date +%Y%m%d%H%M%S)"
cp .env ".env.bak.$(date +%Y%m%d%H%M%S)"

rm -rf /opt/waoowaoo/package/source /opt/waoowaoo/package/deploy
tar -xzf /opt/waoowaoo/uploads/waoowaoo-server-package.tar.gz -C /opt/waoowaoo/package
cp -a /opt/waoowaoo/package/deploy/. /opt/waoowaoo/
rm -rf /opt/waoowaoo/source
cp -a /opt/waoowaoo/package/source /opt/waoowaoo/source

docker load -i /opt/waoowaoo/package/image/waoowaoo-image-latest.tar

cd /opt/waoowaoo
docker compose up -d --force-recreate app
docker compose logs -f app
```

## 10. 常用命令

```bash
cd /opt/waoowaoo
docker compose ps
docker compose logs -f app
docker compose logs -f minio
docker compose restart app
docker compose down
docker compose up -d
```

Nginx：

```bash
docker exec nginx-web nginx -t
docker exec nginx-web nginx -s reload
docker logs --tail=200 nginx-web
```

## 11. 备份

```bash
mkdir -p /opt/backups/waoowaoo

docker exec mysql mysqldump -uroot -p'2r9Li0QdnH6Absst0nJj' waoowaoo \
  > "/opt/backups/waoowaoo/waoowaoo_$(date +%Y%m%d%H%M%S).sql"

tar -czf "/opt/backups/waoowaoo/waoowaoo_files_$(date +%Y%m%d%H%M%S).tar.gz" \
  -C /opt/waoowaoo minio app docker-compose.yml .env
```
