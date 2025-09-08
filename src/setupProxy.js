// src/setupProxy.js
const { createProxyMiddleware } = require("http-proxy-middleware");

module.exports = function (app) {
    console.log("[proxy] setupProxy loaded");

    // 🔑 Auth -> TMS
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

    // 🔑 TMS API -> TMS
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

    // 🔑 Odak API -> api.odaklojistik.com.tr
    app.use(
        "/api",
        createProxyMiddleware({
            target: "https://api.odaklojistik.com.tr",
            changeOrigin: true,
            secure: true,
            pathRewrite: { "^/api": "/api" },
            logLevel: "debug",
        })
    );
};
