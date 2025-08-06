import React, { useState } from "react";
import Sidebar from "./components/Sidebar";
import Navbar from "./components/Navbar";

const Layout = ({ children }) => {
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);

    const toggleSidebar = () => {
        setIsSidebarOpen((prev) => !prev);
    };

    return (
        <div style={{ display: "flex", minHeight: "100vh" }}>
            <Sidebar isOpen={isSidebarOpen} toggleSidebar={toggleSidebar} />
            <div style={{ flex: 1 }}>
                <Navbar />
                <main style={{ padding: "20px" }}>{children}</main>
            </div>
        </div>
    );
};

export default Layout;
