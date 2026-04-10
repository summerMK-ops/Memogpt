module.exports = {
  apps: [
    {
      name: "memogpt",
      script: "server.js",
      cwd: __dirname,
      env: {
        HOST: "0.0.0.0",
        PORT: 4173
      }
    }
  ]
};
