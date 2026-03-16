import React, { useState, useMemo } from 'react';
import CountUp from 'react-countup';
import {
    Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
    Paper, Typography, Box, Stack, Divider, Chip, styled, alpha,
    Tabs, Tab
} from '@mui/material';
import { MdLocalShipping, MdMap, MdError, MdCheckCircle, MdFilterList } from 'react-icons/md';

// --- STYLED COMPONENTS ---
const FilterBar = styled(Paper)(({ theme }) => ({
    padding: '8px',
    borderRadius: '16px',
    marginBottom: '24px',
    backgroundColor: alpha(theme.palette.primary.main, 0.03),
    border: '1px solid #e2e8f0',
    display: 'flex',
    alignItems: 'center'
}));

const StyledRow = styled(TableRow)(({ theme }) => ({
    '&:hover': { backgroundColor: '#f8fafc' },
    '& td': { borderBottom: '1px solid #f1f5f9', padding: '20px 16px' }
}));

// --- YARDIMCI FONKSİYONLAR ---
const norm = (s) => (s ?? "").toString().trim().toLocaleUpperCase("tr-TR").replace(/\s+/g, " ");

export default function ProjeTablosu({ data }) {
    const [selectedRegion, setSelectedRegion] = useState('TRAKYA');

    // 1. Veri İşleme ve Özel Şartlar Mantığı
    const processedData = useMemo(() => {
        if (!data) return {};

        const stats = {};
        const TRAKYA_CITIES = new Set(["EDİRNE", "KIRKLARELİ", "TEKİRDAĞ"].map(norm));

        data.forEach(item => {
            let finalProjectName = item.ProjectName;
            const pNorm = norm(item.ProjectName);
            const cityNorm = norm(item.PickupCityName);
            const countyNorm = norm(item.PickupCountyName);

            // --- ÖZEL ŞARTLAR ---

            // KÜÇÜKBAY SPLIT
            if (pNorm === norm("KÜÇÜKBAY FTL")) {
                if (TRAKYA_CITIES.has(cityNorm)) finalProjectName = "KÜÇÜKBAY TRAKYA FTL";
                else if (cityNorm === norm("İZMİR")) finalProjectName = "KÜÇÜKBAY İZMİR FTL";
                else return; // Diğer şehirler iptal
            }
            // PEPSİ ÇORLU ŞARTI
            else if (pNorm === norm("PEPSİ FTL") && countyNorm !== norm("ÇORLU")) return;
            // EBEBEK UŞAK ŞARTI
            else if (pNorm === norm("EBEBEK FTL") && cityNorm !== norm("UŞAK")) return;
            // BİM MERSİN ŞARTI
            else if (pNorm === norm("BİM / MERSİN") && cityNorm !== norm("MERSİN")) return;

            // İstatistik toplama
            if (!stats[finalProjectName]) {
                stats[finalProjectName] = { plan: new Set(), ted: new Set(), filo: new Set(), fail: new Set(), b: new Set(), bm: new Set() };
            }

            const s = stats[finalProjectName];
            const valid = ["YURTİÇİ FTL HİZMETLERİ", "FİLO DIŞ YÜK YÖNETİMİ"].includes(item.ServiceName);

            if (valid) {
                if (item.TMSVehicleRequestDocumentNo && !item.TMSVehicleRequestDocumentNo.startsWith("BOS")) s.plan.add(item.TMSVehicleRequestDocumentNo);
                if (item.TMSDespatchDocumentNo?.startsWith("SFR")) {
                    s.ted.add(item.TMSDespatchDocumentNo);
                    if (["FİLO", "ÖZMAL", "MODERN AMBALAJ FİLO"].includes(item.VehicleWorkingName)) s.filo.add(item.TMSDespatchDocumentNo);
                    item.IsPrint ? s.b.add(item.TMSDespatchDocumentNo) : s.bm.add(item.TMSDespatchDocumentNo);
                } else if (item.TMSVehicleRequestDocumentNo?.startsWith("VP")) {
                    s.fail.add(item.TMSVehicleRequestDocumentNo);
                }
            }
        });
        return stats;
    }, [data]);

    // 2. Bölge Tanımları
    const REGIONS = {
        TRAKYA: ["BUNGE LÜLEBURGAZ FTL", "BUNGE GEBZE FTL", "BUNGE PALET", "REKA FTL", "EKSUN GIDA FTL", "SARUHAN FTL", "PEPSİ FTL", "TEKİRDAĞ UN FTL", "AYDINLI MODA FTL", "ADKOTURK FTL", "ADKOTURK FTL ENERJİ İÇECEĞİ", "SGS FTL", "BSH FTL", "ALTERNA GIDA FTL", "BİLEŞİM KİMYA FTL", "DERYA OFİS FTL", "SAPRO FTL", "MARMARA CAM FTL", "FAKİR FTL", "MODERN KARTON FTL", "KÜÇÜKBAY TRAKYA FTL", "MODERN BOBİN FTL"],
        GEBZE: ["HEDEF FTL", "HEDEF DIŞ TEDARİK"],
        DERİNCE: ["ARKAS PETROL OFİSİ DERİNCE FTL", "ARKAS PETROL OFİSİ DIŞ TERMİNAL FTL"],
        İZMİR: ["EURO GIDA FTL", "EBEBEK FTL", "KİPAŞ SÖKE FTL", "CEYSU FTL", "TAT GIDA FTL", "ZER SALÇA", "ANKUTSAN FTL", "PELAGOS GIDA FTL", "KÜÇÜKBAY İZMİR FTL"],
        ÇUKUROVA: ["PEKER FTL", "GDP FTL", "ÖZMEN UN FTL", "KİPAŞ MARAŞ FTL", "TÜRK OLUKLU FTL", "İLKON TEKSTİL FTL", "BİM / MERSİN"],
        ESKİŞEHİR: ["ES FTL", "ES GLOBAL FRİGO FTL", "KİPAŞ BOZÜYÜK FTL", "2A TÜKETİM FTL", "MODERN HURDA DÖNÜŞ FTL", "MODERN HURDA ZONGULDAK FTL"],
        "İÇ ANADOLU": ["APAK FTL", "SER DAYANIKLI FTL", "UNIFO FTL", "UNIFO ASKERİ FTL"],
        AFYON: ["BİM AFYON PLATFORM FTL"]
    };

    // 3. Seçili Bölgeye Göre Satırları Oluştur
    const currentRows = (REGIONS[selectedRegion] || []).map(pName => {
        const s = processedData[pName] || { plan: new Set(), ted: new Set(), filo: new Set(), fail: new Set(), b: new Set(), bm: new Set() };
        return {
            name: pName,
            plan: s.plan.size,
            ted: s.ted.size,
            spot: s.ted.size - s.filo.size,
            filo: s.filo.size,
            fail: s.fail.size,
            b: s.b.size,
            bm: s.bm.size,
            yuzde: s.plan.size > 0 ? Math.round((s.ted.size / s.plan.size) * 100) : 0
        };
    }).filter(r => r.plan > 0); // Sadece o gün yükü olanları göster

    return (
        <Box sx={{ width: '100%', p: 1 }}>
            {/* BÖLGE SEÇİMİ (FİLTRE) */}
            <FilterBar elevation={0}>
                <Stack direction="row" spacing={2} alignItems="center" sx={{ width: '100%' }}>
                    <Box sx={{ p: 1, bgcolor: 'primary.main', borderRadius: '12px', color: 'white', ml: 1 }}>
                        <MdFilterList size={20} />
                    </Box>
                    <Tabs
                        value={selectedRegion}
                        onChange={(e, val) => setSelectedRegion(val)}
                        variant="scrollable"
                        scrollButtons="auto"
                        sx={{ '& .MuiTab-root': { fontWeight: 800, fontSize: '0.8rem' } }}
                    >
                        {Object.keys(REGIONS).map(reg => (
                            <Tab key={reg} label={reg} value={reg} />
                        ))}
                    </Tabs>
                </Stack>
            </FilterBar>

            {/* TABLO ALANI */}
            <TableContainer component={Paper} elevation={0} sx={{ borderRadius: '24px', border: '1px solid #e2e8f0' }}>
                <Table>
                    <TableHead sx={{ bgcolor: '#f8fafc' }}>
                        <TableRow>
                            <TableCell sx={{ fontWeight: 900 }}>PROJE</TableCell>
                            <TableCell align="center" sx={{ fontWeight: 900 }}>TALEP / TEDARİK</TableCell>
                            <TableCell align="center" sx={{ fontWeight: 900 }}>KAYNAK (S / F)</TableCell>
                            <TableCell align="center" sx={{ fontWeight: 900 }}>SHÖ (B / BM)</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 900 }}>BAŞARI</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {currentRows.length > 0 ? currentRows.map((row) => (
                            <StyledRow key={row.name}>
                                <TableCell>
                                    <Typography sx={{ fontWeight: 800, color: '#1e293b' }}>{row.name}</Typography>
                                    {row.fail > 0 && (
                                        <Chip label={`${row.fail} Eksik`} size="small" sx={{ height: 18, bgcolor: '#fee2e2', color: '#ef4444', fontWeight: 700, fontSize: '0.65rem' }} />
                                    )}
                                </TableCell>
                                <TableCell align="center">
                                    <Typography sx={{ fontWeight: 900, fontSize: '1.1rem' }}>
                                        {row.ted} <span style={{ color: '#cbd5e1', fontWeight: 400 }}>/</span> {row.plan}
                                    </Typography>
                                </TableCell>
                                <TableCell align="center">
                                    <Stack direction="row" spacing={1} justifyContent="center">
                                        <Chip label={`S: ${row.spot}`} size="small" sx={{ bgcolor: alpha('#2563eb', 0.1), color: '#2563eb', fontWeight: 700 }} />
                                        <Chip label={`F: ${row.filo}`} size="small" sx={{ bgcolor: alpha('#7c3aed', 0.1), color: '#7c3aed', fontWeight: 700 }} />
                                    </Stack>
                                </TableCell>
                                <TableCell align="center">
                                    <Stack direction="row" spacing={1.5} justifyContent="center" alignItems="center">
                                        <Box sx={{ textAlign: 'center' }}>
                                            <Typography sx={{ color: '#22c55e', fontWeight: 900 }}>{row.b}</Typography>
                                            <Typography variant="caption" sx={{ fontWeight: 700, color: '#94a3b8', fontSize: '0.6rem' }}>BASILAN</Typography>
                                        </Box>
                                        <Divider orientation="vertical" flexItem />
                                        <Box sx={{ textAlign: 'center' }}>
                                            <Typography sx={{ color: row.bm > 0 ? '#f59e0b' : '#64748b', fontWeight: 900 }}>{row.bm}</Typography>
                                            <Typography variant="caption" sx={{ fontWeight: 700, color: '#94a3b8', fontSize: '0.6rem' }}>BEKLEYEN</Typography>
                                        </Box>
                                    </Stack>
                                </TableCell>
                                <TableCell align="right">
                                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 1 }}>
                                        <Typography sx={{
                                            fontSize: '1.3rem', fontWeight: 950,
                                            color: row.yuzde >= 90 ? '#22c55e' : row.yuzde >= 70 ? '#f59e0b' : '#ef4444'
                                        }}>%{row.yuzde}</Typography>
                                        {row.yuzde === 100 && <MdCheckCircle color="#22c55e" size={20} />}
                                    </Box>
                                </TableCell>
                            </StyledRow>
                        )) : (
                            <TableRow>
                                <TableCell colSpan={5} align="center" sx={{ py: 10 }}>
                                    <Typography sx={{ color: '#94a3b8', fontWeight: 600 }}>Bu bölgede bugün için aktif talep bulunamadı.</Typography>
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </TableContainer>
        </Box>
    );
}