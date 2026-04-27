import { useLocation } from "react-router-dom";
import Layout from "./Layout";
import Yetkisiz from "./Yetkisiz";

export default function ProtectedRoute({ children }) {
    const location = useLocation();
    const user = JSON.parse(localStorage.getItem("loginUser") || "null");

    // kullanıcı yoksa (login ekranı zaten App.js'te)
    if (!user) {
        return <Layout>{children}</Layout>;
    }

    const allowedScreens = user.allowedScreens || [];
    const currentPath = location.pathname;

    // admin her yere girsin
    if (user.rol === "admin") {
        return <Layout>{children}</Layout>;
    }

    // ❌ yetki yoksa sayfadan atma, içerik değiştir
    if (!allowedScreens.includes(currentPath)) {
        return (
            <Layout>
                <Yetkisiz />
            </Layout>
        );
    }

    return <Layout>{children}</Layout>;
}