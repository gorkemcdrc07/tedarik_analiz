import React, { useMemo, useState } from "react";
import {
    Box,
    Typography,
    Card,
    Grid,
    Paper,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Chip,
    useTheme,
    useMediaQuery,
    TextField,
    Autocomplete,
    Button,
    Stack,
    MenuItem,
    Container,
    Divider
} from "@mui/material";
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    Tooltip,
    CartesianGrid,
    ResponsiveContainer,
    BarChart,
    Bar,
    Cell
} from "recharts";
import AssessmentIcon from "@mui/icons-material/Assessment";
import ShowChartRoundedIcon from "@mui/icons-material/ShowChartRounded";
import BarChartRoundedIcon from "@mui/icons-material/BarChartRounded";
import FilterAltRoundedIcon from "@mui/icons-material/FilterAltRounded";

const COLORS = [
    "#6366f1",
    "#10b981",
    "#f59e0b",
    "#ef4444",
    "#8b5cf6",
    "#14b8a6",
    "#f97316",
    "#84cc16",
    "#06b6d4",
    "#ec4899",
    "#a855f7",
    "#22c55e",
    "#eab308",
    "#3b82f6"
];

const rawData = [
    { customer: "BUNGE", d1: 63.37, d2: 70.96, d3: 77.54, d4: 73.84 },
    { customer: "SUDESAN", d1: 63.53, d2: 70.10, d3: 77.68, d4: 73.98 },
    { customer: "PALEKS / AKTÜL", d1: 64.20, d2: 71.77, d3: 78.36, d4: 74.66 },
    { customer: "MİLHANS", d1: 63.90, d2: 71.47, d3: 78.06, d4: 74.36 },
    { customer: "NAZAR KİMYA", d1: 63.37, d2: 70.96, d3: 77.54, d4: 73.84 },
    { customer: "KALE KİLİT", d1: 63.53, d2: 71.10, d3: 77.68, d4: 73.98 },
    { customer: "REKA", d1: 66.75, d2: 71.96, d3: 78.51, d4: 74.81 },
    { customer: "BİM", d1: 65.84, d2: 67.0, d3: 73.42, d4: null },
    { customer: "MODERN BOBİN ( ZONGULDAK )", d1: 61.46, d2: 72.29, d3: 78.88, d4: 75.18 },
    { customer: "MODERN FTL ( ESKİŞEHİR )", d1: 60.23, d2: null, d3: 77.54, d4: null },
    { customer: "MODERN BOBİN ( TEKİRDAĞ )", d1: 61.12, d2: 71.95, d3: 78.5, d4: 74.88 },
    { customer: "HEDEF", d1: 65.03, d2: 71.48, d3: 78.03, d4: 74.33 },
    { customer: "RHI MAGNESITA", d1: 64.72, d2: 72.3, d3: 78.85, d4: 75.23 },
    { customer: "ES GLOBAL ( FTL )", d1: 53.95, d2: 60.25, d3: 65.75, d4: 62.66 },
    { customer: "ES GLOBAL ( FRİGO )", d1: 64.73, d2: 72.3, d3: 78.89, d4: 75.19 },
    { customer: "TEKİRDAĞ UN", d1: 64.38, d2: 71.96, d3: 78.51, d4: 74.81 },
    { customer: "ADKOTÜRK", d1: 64.38, d2: 71.95, d3: 78.54, d4: 74.84 },
    { customer: "EKSUN", d1: 64.38, d2: 71.95, d3: 78.54, d4: 74.84 },
    { customer: "SARUHAN", d1: 61.13, d2: 71.95, d3: 78.54, d4: 74.84 },
    { customer: "MARMARA CAM", d1: 64.38, d2: 71.95, d3: 78.54, d4: 74.84 },
    { customer: "PEKER", d1: 65.5, d2: 73.08, d3: 79.63, d4: 75.93 },
    { customer: "UNIFO", d1: 65.32, d2: 72.9, d3: 79.48, d4: 75.78 },
    { customer: "2A TÜKETİM", d1: 64.41, d2: 71.98, d3: 78.57, d4: 74.87 },
    { customer: "SİMFER", d1: 65.64, d2: 73.22, d3: 79.81, d4: 76.11 },
    { customer: "TURAP KAYGUSUZ", d1: 65.47, d2: 73.06, d3: 79.65, d4: 75.95 },
    { customer: "EURO GIDA", d1: 64.93, d2: 72.5, d3: 79.09, d4: 75.39 },
    { customer: "KÜÇÜKBAY GIDA", d1: 64.93, d2: 72.5, d3: 79.09, d4: 75.39 },
    { customer: "AYDINLI MODA", d1: 52.95, d2: 59.25, d3: 64.74, d4: 61.65 },
    { customer: "AYDIN KURUYEMİŞ", d1: 63.9, d2: 71.47, d3: 78.06, d4: 74.36 },
    { customer: "SAPRO", d1: 63.53, d2: 71.1, d3: 77.68, d4: 73.98 },
    { customer: "DSV", d1: 65.06, d2: 72.63, d3: 79.21, d4: 75.51 },
    { customer: "GALEN ÇOCUK", d1: 63.37, d2: 70.96, d3: 77.54, d4: 73.84 },
    { customer: "SERANİT", d1: 64.41, d2: 71.98, d3: 78.57, d4: 75.19 },
    { customer: "HAYAT KİMYA", d1: 65.47, d2: 73.05, d3: 79.64, d4: 75.94 },
    { customer: "AKTÜL", d1: 64.2, d2: 71.77, d3: 78.36, d4: 74.66 },
    { customer: "KRİSTAL GIDA", d1: 64.2, d2: 71.77, d3: 78.36, d4: 74.66 },
    { customer: "EFOR ÇAY", d1: 67.02, d2: 72.86, d3: 79.46, d4: 75.76 },
    { customer: "DİKTAŞ ( KONTEYNER )", d1: 60.3, d2: 70.96, d3: 77.54, d4: 73.84 },
    { customer: "DENTAŞ ( ESKİŞEHİR )", d1: 64.72, d2: 72.3, d3: 78.85, d4: 75.23 },
    { customer: "DENTAŞ ( ÇORLU )", d1: 64.38, d2: 71.96, d3: 78.51, d4: 74.81 },
    { customer: "MUTLU UN", d1: 64.38, d2: 71.95, d3: 78.54, d4: 74.84 },
    { customer: "CAN KARTON", d1: 65.66, d2: 73.24, d3: 79.79, d4: 76.09 },
    { customer: "CANPED ( DILEXA TÜKETİM )", d1: 55.01, d2: 71.1, d3: 77.65, d4: 74.03 },
    { customer: "KUTAY AMBALAJ", d1: 65.64, d2: 73.21, d3: 79.82, d4: 76.12 },
    { customer: "KİPAŞ ( BOZÜYÜK )", d1: 64.4, d2: 71.98, d3: 78.53, d4: 74.83 },
    { customer: "AJİNOMOTO ( ESKİŞEHİR )", d1: 64.73, d2: 72.3, d3: 78.89, d4: 75.19 },
    { customer: "AJİNOMOTO ( İZMİR )", d1: 64.93, d2: 72.5, d3: 79.09, d4: 75.39 },
    { customer: "HEDEF ( KONTEYNER )", d1: 57.68, d2: 57.68, d3: 78.06, d4: 74.36 }
].map((item, index) => ({
    ...item,
    color: COLORS[index % COLORS.length]
}));

const DATE_COLUMNS = [
    { key: "d1", label: "19.03.2026" },
    { key: "d2", label: "20.03.2026" },
    { key: "d3", label: "24.03.2026" },
    { key: "d4", label: "25.03.2026" }
];

const SIDEBAR_OFFSET = {
    md: "88px",
    lg: "96px"
};

const formatCurrency = (value) => {
    if (value === null || value === undefined || Number.isNaN(value)) return "-";
    return `₺${Number(value).toFixed(2).replace(".", ",")}`;
};

const calcPct = (start, end) => {
    if (start == null || end == null || start === 0) return null;
    return Number((((end - start) / start) * 100).toFixed(2));
};

const formatPercent = (value) => {
    if (value == null || Number.isNaN(value)) return "-";
    return `%${Number(value).toFixed(2).replace(".", ",")}`;
};

const getChangeChipSx = (value) => ({
    bgcolor: value >= 0 ? "#ecfdf5" : "#fef2f2",
    color: value >= 0 ? "#059669" : "#dc2626",
    fontWeight: 800,
    minWidth: 78
});

const sectionCardSx = {
    p: { xs: 2, md: 3 },
    borderRadius: 4,
    boxShadow: "0 10px 30px rgba(15,23,42,0.06)",
    border: "1px solid #e5e7eb",
    backgroundColor: "#ffffff",
    height: "100%"
};

export default function MultiCustomerDashboard() {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down("md"));

    const [selectedCustomers, setSelectedCustomers] = useState(
        rawData.slice(0, 8).map((item) => item.customer)
    );
    const [barSort, setBarSort] = useState("desc");

    const customerOptions = useMemo(() => rawData.map((item) => item.customer), []);

    const selectedData = useMemo(
        () => rawData.filter((item) => selectedCustomers.includes(item.customer)),
        [selectedCustomers]
    );

    const multiLineData = useMemo(() => {
        return DATE_COLUMNS.map((date) =>
            Object.fromEntries([
                ["name", date.label],
                ...selectedData.map((item) => [item.customer, item[date.key]])
            ])
        );
    }, [selectedData]);

    const totalChangeData = useMemo(() => {
        const result = rawData
            .map((item) => ({
                name: item.customer,
                value: calcPct(item.d1, item.d4),
                color: item.color
            }))
            .filter((item) => item.value !== null);

        return result.sort((a, b) =>
            barSort === "desc" ? b.value - a.value : a.value - b.value
        );
    }, [barSort]);

    const barChartHeight = Math.max(520, totalChangeData.length * 28);

    return (
        <Box
            sx={{
                minHeight: "100vh",
                bgcolor: "#f8fafc",
                position: "relative",
                zIndex: 1,
                overflowX: "hidden"
            }}
        >
            <Box
                sx={{
                    ml: { xs: 0, md: SIDEBAR_OFFSET.md, lg: SIDEBAR_OFFSET.lg },
                    width: {
                        xs: "100%",
                        md: `calc(100% - ${SIDEBAR_OFFSET.md})`,
                        lg: `calc(100% - ${SIDEBAR_OFFSET.lg})`
                    },
                    transition: "all 0.25s ease"
                }}
            >
                <Container
                    maxWidth={false}
                    sx={{
                        px: { xs: 2, sm: 3, md: 4 },
                        py: { xs: 2, md: 4 }
                    }}
                >
                    <Box sx={{ mb: 3, px: { xs: 0.5, md: 1 } }}>
                        <Typography
                            variant="h4"
                            sx={{
                                fontWeight: 900,
                                color: "#2563eb",
                                letterSpacing: "-0.02em",
                                mb: 1
                            }}
                        >
                            Karşılaştırmalı Analiz
                        </Typography>

                        <Typography
                            variant="body1"
                            sx={{
                                color: "#64748b",
                                maxWidth: 900
                            }}
                        >
                            Müşteriler tablo üzerinde tam görünür. Grafik alanları daha temiz ve okunabilir şekilde gösterilir.
                        </Typography>
                    </Box>

                    <Paper sx={{ ...sectionCardSx, mb: 3 }}>
                        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
                            <FilterAltRoundedIcon sx={{ color: "#2563eb" }} />
                            <Typography variant="h6" fontWeight={800}>
                                Grafik Filtreleri
                            </Typography>
                        </Stack>

                        <Grid container spacing={2}>
                            <Grid item xs={12} xl={7}>
                                <Autocomplete
                                    multiple
                                    options={customerOptions}
                                    value={selectedCustomers}
                                    onChange={(_, newValue) => setSelectedCustomers(newValue)}
                                    renderInput={(params) => (
                                        <TextField
                                            {...params}
                                            label="Line chart için müşteri seç"
                                            placeholder="Müşteri ara..."
                                        />
                                    )}
                                    sx={{
                                        "& .MuiOutlinedInput-root": {
                                            minHeight: 56,
                                            alignItems: "flex-start"
                                        }
                                    }}
                                />
                            </Grid>

                            <Grid item xs={12} sm={6} md={4} xl={2}>
                                <TextField
                                    fullWidth
                                    select
                                    label="Bar sıralama"
                                    value={barSort}
                                    onChange={(e) => setBarSort(e.target.value)}
                                >
                                    <MenuItem value="desc">Yüksekten düşüğe</MenuItem>
                                    <MenuItem value="asc">Düşükten yükseğe</MenuItem>
                                </TextField>
                            </Grid>

                            <Grid item xs={12} sm={6} md={8} xl={3}>
                                <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ height: "100%" }}>
                                    <Button
                                        fullWidth
                                        variant="contained"
                                        onClick={() => setSelectedCustomers(rawData.slice(0, 8).map((item) => item.customer))}
                                        sx={{ minHeight: 56, fontWeight: 700 }}
                                    >
                                        İlk 8
                                    </Button>

                                    <Button
                                        fullWidth
                                        variant="outlined"
                                        onClick={() => setSelectedCustomers(rawData.map((item) => item.customer))}
                                        sx={{ minHeight: 56, fontWeight: 700 }}
                                    >
                                        Tümünü Seç
                                    </Button>

                                    <Button
                                        fullWidth
                                        variant="text"
                                        color="inherit"
                                        onClick={() => setSelectedCustomers([])}
                                        sx={{ minHeight: 56, fontWeight: 700 }}
                                    >
                                        Temizle
                                    </Button>
                                </Stack>
                            </Grid>
                        </Grid>
                    </Paper>

                    <Grid container spacing={3} sx={{ mb: 3 }}>
                        <Grid item xs={12} xl={7}>
                            <Paper sx={sectionCardSx}>
                                <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                                    <ShowChartRoundedIcon sx={{ color: "#2563eb" }} />
                                    <Typography variant="h6" fontWeight={800}>
                                        Fiyat Kıyaslama (Seçilen Müşteriler)
                                    </Typography>
                                </Stack>

                                <Typography variant="body2" sx={{ color: "#64748b", mb: 2 }}>
                                    Aynı anda 6–10 müşteri seçildiğinde grafik daha okunabilir olur.
                                </Typography>

                                <Divider sx={{ mb: 2 }} />

                                <Box sx={{ width: "100%", overflowX: "auto" }}>
                                    <Box sx={{ minWidth: 760, height: 430 }}>
                                        <ResponsiveContainer width="100%" height="100%">
                                            <LineChart data={multiLineData} margin={{ top: 16, right: 16, left: 0, bottom: 8 }}>
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 12 }} />
                                                <YAxis axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 12 }} />
                                                <Tooltip
                                                    formatter={(value) => (value == null ? "-" : formatCurrency(Number(value)))}
                                                    contentStyle={{
                                                        borderRadius: 12,
                                                        border: "1px solid #e5e7eb",
                                                        boxShadow: "0 10px 24px rgba(15,23,42,0.10)"
                                                    }}
                                                />

                                                {selectedData.map((customer) => (
                                                    <Line
                                                        key={customer.customer}
                                                        type="monotone"
                                                        dataKey={customer.customer}
                                                        stroke={customer.color}
                                                        strokeWidth={2.5}
                                                        dot={{ r: 3.5 }}
                                                        activeDot={{ r: 5 }}
                                                        connectNulls={false}
                                                    />
                                                ))}
                                            </LineChart>
                                        </ResponsiveContainer>
                                    </Box>
                                </Box>

                                <Box
                                    sx={{
                                        mt: 2,
                                        display: "flex",
                                        flexWrap: "wrap",
                                        gap: 1,
                                        maxHeight: 120,
                                        overflowY: "auto",
                                        pr: 1
                                    }}
                                >
                                    {selectedData.map((item) => (
                                        <Chip
                                            key={item.customer}
                                            label={item.customer}
                                            size="small"
                                            sx={{
                                                border: `1px solid ${item.color}`,
                                                backgroundColor: "#fff",
                                                fontWeight: 600
                                            }}
                                        />
                                    ))}
                                </Box>
                            </Paper>
                        </Grid>

                        <Grid item xs={12} xl={5}>
                            <Paper sx={sectionCardSx}>
                                <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                                    <BarChartRoundedIcon sx={{ color: "#2563eb" }} />
                                    <Typography variant="h6" fontWeight={800}>
                                        Genel Performans %
                                    </Typography>
                                </Stack>

                                <Typography variant="body2" sx={{ color: "#64748b", mb: 2 }}>
                                    İlk ve son tarih arasındaki net yüzde değişim gösterilir.
                                </Typography>

                                <Divider sx={{ mb: 2 }} />

                                <Box
                                    sx={{
                                        width: "100%",
                                        maxHeight: 700,
                                        overflowY: "auto",
                                        overflowX: "hidden",
                                        pr: 1
                                    }}
                                >
                                    <Box sx={{ minWidth: 420, height: barChartHeight }}>
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart
                                                data={totalChangeData}
                                                layout="vertical"
                                                margin={{ top: 8, right: 20, left: 85, bottom: 8 }}
                                            >
                                                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e7eb" />
                                                <XAxis
                                                    type="number"
                                                    tickFormatter={(v) => `%${v}`}
                                                    tick={{ fill: "#64748b", fontSize: 12 }}
                                                    axisLine={false}
                                                    tickLine={false}
                                                />
                                                <YAxis
                                                    dataKey="name"
                                                    type="category"
                                                    width={170}
                                                    tick={{ fill: "#475569", fontSize: 11 }}
                                                    axisLine={false}
                                                    tickLine={false}
                                                />
                                                <Tooltip
                                                    formatter={(value) => formatPercent(Number(value))}
                                                    contentStyle={{
                                                        borderRadius: 12,
                                                        border: "1px solid #e5e7eb",
                                                        boxShadow: "0 10px 24px rgba(15,23,42,0.10)"
                                                    }}
                                                />
                                                <Bar dataKey="value" radius={[0, 8, 8, 0]}>
                                                    {totalChangeData.map((entry, index) => (
                                                        <Cell key={`bar-${index}`} fill={entry.color} />
                                                    ))}
                                                </Bar>
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </Box>
                                </Box>
                            </Paper>
                        </Grid>
                    </Grid>

                    <Card
                        sx={{
                            borderRadius: 4,
                            overflow: "hidden",
                            border: "1px solid #e5e7eb",
                            boxShadow: "0 10px 30px rgba(15,23,42,0.06)"
                        }}
                    >
                        <Box
                            sx={{
                                p: 2,
                                bgcolor: "#f8fafc",
                                display: "flex",
                                alignItems: "center",
                                gap: 1.25,
                                borderBottom: "1px solid #e5e7eb"
                            }}
                        >
                            <AssessmentIcon sx={{ color: "#2563eb" }} />
                            <Typography variant="subtitle1" fontWeight={800}>
                                Veri Tablosu
                            </Typography>
                        </Box>

                        <TableContainer sx={{ maxHeight: 720, overflowX: "auto", backgroundColor: "#fff" }}>
                            <Table
                                stickyHeader
                                size={isMobile ? "small" : "medium"}
                                sx={{
                                    minWidth: 1120,
                                    "& .MuiTableCell-root": { borderColor: "#eef2f7" }
                                }}
                            >
                                <TableHead>
                                    <TableRow>
                                        <TableCell
                                            sx={{
                                                fontWeight: 800,
                                                minWidth: 280,
                                                backgroundColor: "#fff",
                                                position: "sticky",
                                                left: 0,
                                                zIndex: 3
                                            }}
                                        >
                                            Müşteri
                                        </TableCell>

                                        {DATE_COLUMNS.map((col) => (
                                            <TableCell
                                                key={col.key}
                                                align="right"
                                                sx={{ fontWeight: 800, minWidth: 130, backgroundColor: "#fff" }}
                                            >
                                                {col.label}
                                            </TableCell>
                                        ))}

                                        <TableCell
                                            align="right"
                                            sx={{ fontWeight: 800, minWidth: 150, backgroundColor: "#fff" }}
                                        >
                                            Net Değişim
                                        </TableCell>
                                    </TableRow>
                                </TableHead>

                                <TableBody>
                                    {rawData.map((row) => {
                                        const change = calcPct(row.d1, row.d4);

                                        return (
                                            <TableRow
                                                key={row.customer}
                                                hover
                                                sx={{
                                                    "&:nth-of-type(even)": {
                                                        backgroundColor: "#fcfdff"
                                                    }
                                                }}
                                            >
                                                <TableCell
                                                    sx={{
                                                        fontWeight: 700,
                                                        position: "sticky",
                                                        left: 0,
                                                        backgroundColor: "inherit",
                                                        zIndex: 2
                                                    }}
                                                >
                                                    <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
                                                        <Box
                                                            sx={{
                                                                width: 12,
                                                                height: 12,
                                                                borderRadius: "50%",
                                                                bgcolor: row.color,
                                                                flexShrink: 0
                                                            }}
                                                        />
                                                        <Typography variant="body2" sx={{ fontWeight: 700, color: "#0f172a" }}>
                                                            {row.customer}
                                                        </Typography>
                                                    </Box>
                                                </TableCell>

                                                <TableCell align="right">{formatCurrency(row.d1)}</TableCell>
                                                <TableCell align="right">{formatCurrency(row.d2)}</TableCell>
                                                <TableCell align="right">{formatCurrency(row.d3)}</TableCell>
                                                <TableCell align="right">{formatCurrency(row.d4)}</TableCell>

                                                <TableCell align="right">
                                                    {change == null ? (
                                                        "-"
                                                    ) : (
                                                        <Chip label={formatPercent(change)} size="small" sx={getChangeChipSx(change)} />
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    </Card>
                </Container>
            </Box>
        </Box>
    );
}