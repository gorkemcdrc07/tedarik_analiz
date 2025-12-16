const { createProxyMiddleware } = require("http-proxy-middleware");

module.exports = function (app) {
    console.log("[proxy] setupProxy loaded");

    // ----------------------------------------------------------
    // 🟢 1) TEST NEXT.JS API ROUTELARINI PROXY'DEN HARİÇ TUT
    // ----------------------------------------------------------
    // Next.js test API route: /api/reel-api/tmsdespatchincomeexpenses/test/*
    app.use((req, res, next) => {
        if (req.url.startsWith("/api/reel-api/tmsdespatchincomeexpenses/test")) {
            console.log("➡ [BYPASS] TEST API → Next.js", req.url);
            return next(); // Next.js API'ye gönder
        }
        next();
    });

    // ----------------------------------------------------------
    // 🟡 2) TEST TMS PROXY
    // ----------------------------------------------------------
    app.use(
        "/reel-api-test",
        createProxyMiddleware({
            target: "https://testtms.odaklojistik.com.tr",
            changeOrigin: true,
            secure: true,
            pathRewrite: { "^/reel-api-test": "" },
        })
    );

    app.use(
        "/reel-auth-test",
        createProxyMiddleware({
            target: "https://testtms.odaklojistik.com.tr",
            changeOrigin: true,
            secure: true,
            pathRewrite: { "^/reel-auth-test": "" },
        })
    );

    // ----------------------------------------------------------
    // 🔴 3) CANLI / PROD PROXY
    // ----------------------------------------------------------
    // Canlı TMS: /reel-api → https://tms.odaklojistik.com.tr
    app.use(
        "/reel-api",
        createProxyMiddleware({
            target: "https://tms.odaklojistik.com.tr",
            changeOrigin: true,
            secure: true,
            pathRewrite: { "^/reel-api": "" },
        })
    );

    app.use(
        "/reel-auth",
        createProxyMiddleware({
            target: "https://tms.odaklojistik.com.tr",
            changeOrigin: true,
            secure: true,
            pathRewrite: { "^/reel-auth": "" },
        })
    );
};
