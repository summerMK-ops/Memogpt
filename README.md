# ChatGPT Memo

ChatGPTの内容を題目ごとに整理できる、シンプルなメモアプリです。

## 主な機能

- 左上の三本線で開閉できる目次
- 題目と本文の検索
- 画像添付
- 画像の長押しでサイズ変更
- メモの編集と削除
- JSONファイルでの保存と読み込み
- PWA対応

## ローカル起動

```powershell
npm start
```

起動後は次のURLで開けます。

- `http://localhost:4173`

## VPSデプロイ例

Node.js が入っているVPSで、アプリのフォルダに移動して次を実行します。

```powershell
npm start
```

常時運用する場合は `pm2` や `systemd` で `node server.js` を常駐化してください。

## Gitの基本手順

```powershell
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin <YOUR_GIT_REMOTE_URL>
git push -u origin main
```
