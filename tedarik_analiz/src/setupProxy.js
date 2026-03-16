// src/setupProxy.js
const { createProxyMiddleware } = require("http-proxy-middleware");

module.exports = function (app) {
    console.log("[proxy] setupProxy loaded");

    // Login (mevcut)
    app.use(
        "/reel-auth",
        createProxyMiddleware({
            target: "https://tms.odaklojistik.com.tr",
            changeOrigin: true,
            secure: true,
            pathRewrite: { "^/reel-auth": "" },
            logLevel: "debug",
        })
    );

    // 🔑 GENEL kural: /reel-api/* -> https://tms.../*  (hiçbir ek rewrite yok)
    app.use(
        "/reel-api",
        createProxyMiddleware({
            target: "https://tms.odaklojistik.com.tr",
            changeOrigin: true,
            secure: true,
            pathRewrite: { "^/reel-api": "" },
            logLevel: "debug",
        })
    );
};
