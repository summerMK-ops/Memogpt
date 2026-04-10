module.exports = {
  apps: [
    {
      name: "chatgpt-memo",
      script: "server.js",
      cwd: __dirname,
      env: {
        HOST: "0.0.0.0",
        PORT: 4173
      }
    }
  ]
};
