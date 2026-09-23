const { createProxyMiddleware } = require("http-proxy-middleware");

module.exports = function (app) {
    console.log("[proxy] setupProxy loaded");

    // Fuel price service -> local Node backend
    app.use(
        createProxyMiddleware({
            target: "http://localhost:5000",
            changeOrigin: true,
            pathFilter: "/api/fuel-check",
        })
    );
};