module.exports = {
  apps: [
    {
      name: "compos-pos",
      script: "node_modules/next/dist/bin/next",
      args: "start",
      instances: "max",
      exec_mode: "cluster",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
      },
      max_memory_restart: "1G",
      error_file: "/var/log/compos/err.log",
      out_file: "/var/log/compos/out.log",
      merge_logs: true,
      time: true,
    },
  ],
};
