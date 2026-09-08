import React, { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import Sidebar from "./components/Sidebar";
import Navbar from "./components/Navbar";
import "./Layout.css";

const MOBILE_BREAKPOINT = 1024;

export default function Layout({ children }) {
    const location = useLocation();
    const [isMobile, setIsMobile] = useState(() => window.innerWidth <= MOBILE_BREAKPOINT);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    useEffect(() => {
        const onResize = () => {
            const mobile = window.innerWidth <= MOBILE_BREAKPOINT;
            setIsMobile(mobile);
            if (!mobile) setIsSidebarOpen(false);
        };

        window.addEventListener("resize", onResize);
        return () => window.removeEventListener("resize", onResize);
    }, []);

    const toggleSidebar = () => {
        if (isMobile) setIsSidebarOpen((value) => !value);
    };

    const closeSidebar = () => {
        if (isMobile) setIsSidebarOpen(false);
    };

    return (
        <div className="ots-layout">
            <Sidebar
                isOpen={isSidebarOpen}
                closeSidebar={closeSidebar}
                isMobile={isMobile}
            />

            {isMobile && isSidebarOpen && (
                <button
                    type="button"
                    className="ots-sidebar-overlay"
                    onClick={closeSidebar}
                    aria-label="Menüyü kapat"
                />
            )}

            <div className="ots-layout-main">
                <Navbar
                    toggleSidebar={toggleSidebar}
                    isSidebarOpen={isSidebarOpen}
                    isMobile={isMobile}
                />

                <main className="ots-layout-content">
                    <div key={location.pathname} className="ots-content-container ots-page-enter">{children}</div>
                </main>
            </div>
        </div>
    );
}
