import React, { useEffect, useMemo, useState } from "react";
import { createTheme, ThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";

const DARK = {
    bg: "#07111d",
    paper: "#0d1b2a",
    paper2: "#102235",
    border: "#20364a",
    border2: "#294158",
    text: "#edf4fb",
    text2: "#8498ab",
};

function buildTheme(mode) {
    const dark = mode === "dark";

    return createTheme({
        palette: {
            mode,
            primary: { main: "#e5252a", dark: "#c9181e", light: dark ? "#ff676b" : "#fff1f2", contrastText: "#ffffff" },
            secondary: { main: dark ? "#6aa5d8" : "#0b2744", dark: "#071a2d", light: dark ? "#102235" : "#eaf1f7", contrastText: "#ffffff" },
            success: { main: "#16a34a" },
            warning: { main: "#d97706" },
            error: { main: "#dc2626" },
            info: { main: dark ? "#38bdf8" : "#0369a1" },
            background: { default: dark ? DARK.bg : "#f3f6fa", paper: dark ? DARK.paper : "#ffffff" },
            text: { primary: dark ? DARK.text : "#152238", secondary: dark ? DARK.text2 : "#64748b" },
            divider: dark ? DARK.border : "#e2e8f0",
        },
        shape: { borderRadius: 12 },
        typography: {
            fontFamily: 'Inter, "Segoe UI Variable", "Segoe UI", -apple-system, BlinkMacSystemFont, Roboto, Arial, sans-serif',
            button: { textTransform: "none", fontWeight: 750, letterSpacing: 0 },
        },
        components: {
            MuiCssBaseline: {
                styleOverrides: {
                    body: { backgroundColor: dark ? DARK.bg : "#f3f6fa", color: dark ? DARK.text : "#152238" },
                },
            },
            MuiPaper: {
                styleOverrides: {
                    root: { backgroundImage: "none", borderColor: dark ? DARK.border : "#e2e8f0" },
                },
            },
            MuiButton: {
                defaultProps: { disableElevation: true },
                styleOverrides: {
                    root: {
                        minHeight: 42,
                        borderRadius: 11,
                        paddingInline: 15,
                        fontSize: 12,
                        fontWeight: 750,
                        boxShadow: "none",
                        transition: "transform .16s ease, box-shadow .16s ease, background-color .16s ease, border-color .16s ease",
                        "&:hover": { transform: "translateY(-1px)" },
                        "&:active": { transform: "translateY(0) scale(.985)" },
                    },
                    containedPrimary: {
                        boxShadow: "0 8px 18px rgba(229,37,42,.16)",
                        "&:hover": { boxShadow: "0 10px 22px rgba(229,37,42,.20)" },
                    },
                    containedSecondary: { boxShadow: "0 7px 17px rgba(7,26,45,.12)" },
                },
            },
            MuiIconButton: {
                styleOverrides: {
                    root: {
                        width: 38,
                        height: 38,
                        borderRadius: 10,
                        color: dark ? "#a9bac9" : "#64748b",
                        transition: "background-color .16s ease, color .16s ease, transform .16s ease",
                        "&:hover": { color: "#e5252a", backgroundColor: dark ? "rgba(229,37,42,.12)" : "#fff1f2", transform: "translateY(-1px)" },
                    },
                },
            },
            MuiOutlinedInput: {
                styleOverrides: {
                    root: {
                        minHeight: 42,
                        borderRadius: 11,
                        backgroundColor: dark ? "#0a1724" : "#ffffff",
                        color: dark ? DARK.text : "#334155",
                        fontSize: 12,
                        "& .MuiOutlinedInput-notchedOutline": { borderColor: dark ? DARK.border2 : "#d8e1ec" },
                        "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: dark ? "#3b5870" : "#b9c7d6" },
                        "&.Mui-focused .MuiOutlinedInput-notchedOutline": { borderColor: "#e5252a", borderWidth: 1 },
                        "&.Mui-focused": { boxShadow: "0 0 0 3px rgba(229,37,42,.10)" },
                    },
                },
            },
            MuiInputLabel: {
                styleOverrides: { root: { fontSize: 12, color: dark ? DARK.text2 : "#64748b", "&.Mui-focused": { color: "#e5252a" } } },
            },
            MuiChip: { styleOverrides: { root: { height: 28, borderRadius: 999, fontWeight: 750, fontSize: 10.5 } } },
            MuiDialog: {
                styleOverrides: {
                    paper: {
                        borderRadius: 20,
                        border: `1px solid ${dark ? DARK.border : "#e2e8f0"}`,
                        backgroundColor: dark ? DARK.paper : "#ffffff",
                        boxShadow: dark ? "0 30px 80px rgba(0,0,0,.48)" : "0 30px 80px rgba(15,23,42,.22)",
                    },
                },
            },
            MuiTableCell: {
                styleOverrides: {
                    head: {
                        color: dark ? "#aebed0" : "#526174",
                        backgroundColor: dark ? DARK.paper2 : "#f7f9fc",
                        borderBottom: `1px solid ${dark ? DARK.border2 : "#dfe6ee"}`,
                        fontSize: 10,
                        fontWeight: 800,
                        letterSpacing: ".035em",
                    },
                    body: {
                        color: dark ? "#dce7f2" : "#334155",
                        backgroundColor: dark ? DARK.paper : "#ffffff",
                        borderBottom: `1px solid ${dark ? "#183047" : "#edf1f5"}`,
                        fontSize: 11.5,
                    },
                },
            },
            MuiMenu: { styleOverrides: { paper: { backgroundColor: dark ? DARK.paper : "#ffffff", border: `1px solid ${dark ? DARK.border : "#e2e8f0"}` } } },
            MuiPopover: { styleOverrides: { paper: { backgroundColor: dark ? DARK.paper : "#ffffff" } } },
            MuiTooltip: {
                styleOverrides: { tooltip: { borderRadius: 8, backgroundColor: dark ? "#172b3f" : "#071a2d", fontSize: 10, fontWeight: 650 } },
            },
        },
    });
}

export default function OdakMuiTheme({ children }) {
    const [mode, setMode] = useState(() => document.documentElement.dataset.odakTheme === "dark" || localStorage.getItem("odak-theme") === "dark" ? "dark" : "light");

    useEffect(() => {
        const html = document.documentElement;
        const sync = () => setMode(html.dataset.odakTheme === "dark" ? "dark" : "light");
        sync();
        const observer = new MutationObserver(sync);
        observer.observe(html, { attributes: true, attributeFilter: ["data-odak-theme"] });
        return () => observer.disconnect();
    }, []);

    const theme = useMemo(() => buildTheme(mode), [mode]);

    return (
        <ThemeProvider theme={theme}>
            <CssBaseline />
            {children}
        </ThemeProvider>
    );
}
