import React, { useEffect, useMemo, useState } from 'react';
import supabase from "./supabaseClient";

import {
    Box, Typography, Button, Table, TableBody, TableCell,
    TableContainer, TableHead, TableRow, Paper, IconButton,
    Chip, Dialog, DialogTitle, DialogContent, DialogActions,
    TextField, MenuItem, Select, InputLabel, FormControl, Avatar, Alert,
    Tooltip, Divider, InputAdornment
} from '@mui/material';

import PersonAddIcon from '@mui/icons-material/PersonAdd';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import SearchIcon from '@mui/icons-material/Search';
import SecurityIcon from '@mui/icons-material/Security';
import PeopleAltIcon from '@mui/icons-material/PeopleAlt';
import AppsIcon from '@mui/icons-material/Apps';
import BoltIcon from '@mui/icons-material/Bolt';
import RefreshIcon from '@mui/icons-material/Refresh';

import './AdminPanel.css';

const screens = [
    { label: "Dashboard", path: "/dashboard", group: "Genel" },
    { label: "Sipariş Oluştur", path: "/SiparisIslemleri/SiparisOlustur", group: "Sipariş" },
    { label: "Parsiyel Sipariş Oluştur", path: "/SiparisIslemleri/ParsiyelSiparisOlustur", group: "Sipariş" },
    { label: "Sipariş Açanlar", path: "/SiparisIslemleri/SiparisAcanlar", group: "Sipariş" },
    { label: "Arkas", path: "/SiparisIslemleri/Arkas", group: "Sipariş" },
    { label: "Fasdat", path: "/SiparisIslemleri/Fasdat", group: "Sipariş" },
    { label: "Teslim Noktaları", path: "/SiparisIslemleri/TeslimNoktalari", group: "Sipariş" },
    { label: "Gelir Ekleme", path: "/GelirGider/GelirEkleme", group: "Gelir / Gider" },
    { label: "Gider Ekleme", path: "/GelirGider/GiderEkleme", group: "Gelir / Gider" },
    { label: "Test Gelir", path: "/GelirGider/TestGelir", group: "Gelir / Gider" },
    { label: "Test Gider", path: "/GelirGider/TestGider", group: "Gelir / Gider" },
    { label: "Sefer Fiyatlandırma", path: "/fiyatlandirma/seferFiyatlandirma", group: "Fiyatlandırma" },
    { label: "Özet Tablo", path: "/analiz/ozet", group: "Analiz" },
    { label: "Görsel", path: "/gorsel", group: "Görsel" }
];

const screenButtons = {
    "/dashboard": ["Görüntüle", "Kullanıcı Ekle", "Kullanıcı Sil", "Yetki Düzenle"],
    "/SiparisIslemleri/SiparisOlustur": ["Görüntüle", "Kaydet", "Sil", "Güncelle"],
    "/SiparisIslemleri/ParsiyelSiparisOlustur": ["Görüntüle", "Kaydet", "Sil", "Güncelle"],
    "/SiparisIslemleri/SiparisAcanlar": ["Görüntüle", "Filtrele", "Dışa Aktar"],
    "/SiparisIslemleri/Arkas": ["Görüntüle", "Kaydet", "Dışa Aktar"],
    "/SiparisIslemleri/Fasdat": ["Görüntüle", "Kaydet", "Dışa Aktar"],
    "/SiparisIslemleri/TeslimNoktalari": ["Görüntüle", "Ekle", "Sil", "Güncelle"],
    "/GelirGider/GelirEkleme": ["Görüntüle", "Ekle", "Sil", "Güncelle"],
    "/GelirGider/GiderEkleme": ["Görüntüle", "Ekle", "Sil", "Güncelle"],
    "/GelirGider/TestGelir": ["Görüntüle", "Dışa Aktar"],
    "/GelirGider/TestGider": ["Görüntüle", "Dışa Aktar"],
    "/fiyatlandirma/seferFiyatlandirma": ["Görüntüle", "Hesapla", "Kaydet"],
    "/analiz/ozet": ["Görüntüle", "Filtrele", "Dışa Aktar"],
    "/gorsel": ["Görüntüle"]
};

export default function AdminPanel() {
    const [users, setUsers] = useState([]);
    const [open, setOpen] = useState(false);
    const [editingUserId, setEditingUserId] = useState(null);
    const [loading, setLoading] = useState(false);
    const [errorText, setErrorText] = useState('');
    const [searchText, setSearchText] = useState('');

    const [formData, setFormData] = useState({
        kullanici_adi: '',
        sifre: '',
        kullanici: '',
        Reel_kullanici: '',
        Reel_sifre: '',
        rol: 'kullanici',
        allowedScreens: [],
        allowedButtons: []
    });

    useEffect(() => {
        fetchLoginUsers();
    }, []);

    const parseArray = (value) => {
        if (!value) return [];
        if (Array.isArray(value)) return value;

        try {
            return JSON.parse(value);
        } catch {
            return String(value).split(',').map(x => x.trim()).filter(Boolean);
        }
    };

    const fetchLoginUsers = async () => {
        setLoading(true);
        setErrorText('');

        const { data, error } = await supabase
            .from('Login')
            .select('*')
            .order('id', { ascending: true });

        if (error) {
            setErrorText(error.message);
            setUsers([]);
        } else {
            const mappedUsers = data.map((item) => ({
                id: item.id,
                kullanici_adi: item.kullanici_adi || '',
                sifre: item.sifre || '',
                kullanici: item.kullanici || '',
                Reel_kullanici: item.Reel_kullanici || '',
                Reel_sifre: item.Reel_sifre || '',
                rol: item.rol || 'kullanici',
                allowedScreens: parseArray(item.allowedScreens),
                allowedButtons: parseArray(item.allowedButtons)
            }));

            setUsers(mappedUsers);
        }

        setLoading(false);
    };

    const filteredUsers = useMemo(() => {
        const q = searchText.toLowerCase().trim();

        if (!q) return users;

        return users.filter(user =>
            user.kullanici?.toLowerCase().includes(q) ||
            user.kullanici_adi?.toLowerCase().includes(q) ||
            user.rol?.toLowerCase().includes(q)
        );
    }, [users, searchText]);

    const adminCount = users.filter(user => user.rol === 'admin').length;
    const totalPermissions = users.reduce((sum, user) => sum + user.allowedScreens.length + user.allowedButtons.length, 0);

    const availableButtons = [
        ...new Set(formData.allowedScreens.flatMap((path) => screenButtons[path] || []))
    ];

    const handleOpen = () => {
        setEditingUserId(null);
        setFormData({
            kullanici_adi: '',
            sifre: '',
            kullanici: '',
            Reel_kullanici: '',
            Reel_sifre: '',
            rol: 'kullanici',
            allowedScreens: [],
            allowedButtons: []
        });
        setOpen(true);
    };

    const handleClose = () => {
        setOpen(false);
        setEditingUserId(null);
    };

    const handleEdit = (user) => {
        setEditingUserId(user.id);

        setFormData({
            kullanici_adi: user.kullanici_adi || '',
            sifre: user.sifre || '',
            kullanici: user.kullanici || '',
            Reel_kullanici: user.Reel_kullanici || '',
            Reel_sifre: user.Reel_sifre || '',
            rol: user.rol || 'kullanici',
            allowedScreens: user.allowedScreens || [],
            allowedButtons: user.allowedButtons || []
        });

        setOpen(true);
    };

    const handleDelete = async (id) => {
        const confirmDelete = window.confirm('Bu kullanıcıyı silmek istiyor musunuz?');
        if (!confirmDelete) return;

        const { error } = await supabase
            .from('Login')
            .delete()
            .eq('id', id);

        if (error) {
            alert('Silme hatası: ' + error.message);
            return;
        }

        await fetchLoginUsers();
    };

    const handleScreenChange = (screenPath) => {
        const selected = formData.allowedScreens.includes(screenPath);

        setFormData((prev) => {
            const nextScreens = selected
                ? prev.allowedScreens.filter((item) => item !== screenPath)
                : [...prev.allowedScreens, screenPath];

            const validButtons = [
                ...new Set(nextScreens.flatMap((path) => screenButtons[path] || []))
            ];

            return {
                ...prev,
                allowedScreens: nextScreens,
                allowedButtons: prev.allowedButtons.filter((button) =>
                    validButtons.includes(button)
                )
            };
        });
    };

    const handleButtonChange = (button) => {
        const selected = formData.allowedButtons.includes(button);

        setFormData((prev) => ({
            ...prev,
            allowedButtons: selected
                ? prev.allowedButtons.filter((item) => item !== button)
                : [...prev.allowedButtons, button]
        }));
    };

    const handleSave = async () => {
        if (!formData.kullanici_adi || !formData.kullanici) {
            alert('Kullanıcı maili ve kullanıcı adı zorunludur.');
            return;
        }

        const payload = {
            kullanici_adi: formData.kullanici_adi,
            sifre: formData.sifre,
            kullanici: formData.kullanici,
            Reel_kullanici: formData.Reel_kullanici || null,
            Reel_sifre: formData.Reel_sifre || null,
            rol: formData.rol,
            allowedScreens: JSON.stringify(formData.allowedScreens),
            allowedButtons: JSON.stringify(formData.allowedButtons)
        };

        const result = editingUserId
            ? await supabase.from('Login').update(payload).eq('id', editingUserId)
            : await supabase.from('Login').insert([payload]);

        if (result.error) {
            alert('Kayıt hatası: ' + result.error.message);
            return;
        }

        handleClose();
        await fetchLoginUsers();
    };

    return (
        <Box className="admin-container">
            <Box className="admin-shell">

                <Box className="topbar">
                    <Box className="brand-area">
                        <Box className="brand-logo">
                            <AdminPanelSettingsIcon />
                        </Box>

                        <Box>
                            <Typography className="brand-title">NEXORA</Typography>
                            <Typography className="brand-subtitle">ACCESS CONTROL</Typography>
                        </Box>
                    </Box>

                    <Box className="topbar-actions">
                        <TextField
                            className="top-search"
                            placeholder="Kullanıcı ara..."
                            value={searchText}
                            onChange={(e) => setSearchText(e.target.value)}
                            InputProps={{
                                startAdornment: (
                                    <InputAdornment position="start">
                                        <SearchIcon />
                                    </InputAdornment>
                                )
                            }}
                        />

                        <Button
                            variant="contained"
                            startIcon={<PersonAddIcon />}
                            className="add-button"
                            onClick={handleOpen}
                        >
                            Yeni Kullanıcı
                        </Button>
                    </Box>
                </Box>

                {errorText && (
                    <Alert severity="error" className="api-alert">
                        Supabase hatası: {errorText}
                    </Alert>
                )}

                <Box className="stats-grid">
                    <Box className="stat-card">
                        <Box className="stat-icon users">
                            <PeopleAltIcon />
                        </Box>
                        <Box>
                            <Typography className="stat-label">Toplam Kullanıcı</Typography>
                            <Typography className="stat-value">{users.length}</Typography>
                        </Box>
                    </Box>

                    <Box className="stat-card">
                        <Box className="stat-icon screens">
                            <AppsIcon />
                        </Box>
                        <Box>
                            <Typography className="stat-label">Toplam Ekran</Typography>
                            <Typography className="stat-value">{screens.length}</Typography>
                        </Box>
                    </Box>

                    <Box className="stat-card">
                        <Box className="stat-icon admin">
                            <SecurityIcon />
                        </Box>
                        <Box>
                            <Typography className="stat-label">Admin Sayısı</Typography>
                            <Typography className="stat-value">{adminCount}</Typography>
                        </Box>
                    </Box>

                    <Box className="stat-card">
                        <Box className="stat-icon permission">
                            <BoltIcon />
                        </Box>
                        <Box>
                            <Typography className="stat-label">Aktif Yetki</Typography>
                            <Typography className="stat-value">{totalPermissions}</Typography>
                        </Box>
                    </Box>
                </Box>

                <Box className="content-card">
                    <Box className="panel-toolbar">
                        <Box className="toolbar-left">
                            <Typography className="toolbar-title">Kullanıcı Listesi</Typography>
                            <Chip label={filteredUsers.length} className="list-count-chip" />
                        </Box>

                        <Button
                            startIcon={<RefreshIcon />}
                            className="refresh-button"
                            onClick={fetchLoginUsers}
                        >
                            Yenile
                        </Button>
                    </Box>

                    <TableContainer component={Paper} className="table-wrapper">
                        <Table stickyHeader>
                            <TableHead className="table-head">
                                <TableRow>
                                    <TableCell>Kullanıcı</TableCell>
                                    <TableCell>Giriş Maili</TableCell>
                                    <TableCell>Rol</TableCell>
                                    <TableCell>Ekran Yetkileri</TableCell>
                                    <TableCell>Buton Yetkileri</TableCell>
                                    <TableCell align="right">İşlemler</TableCell>
                                </TableRow>
                            </TableHead>

                            <TableBody>
                                {loading ? (
                                    <TableRow>
                                        <TableCell colSpan={6} align="center">
                                            Kullanıcılar yükleniyor...
                                        </TableCell>
                                    </TableRow>
                                ) : filteredUsers.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={6} align="center">
                                            Kayıtlı kullanıcı bulunamadı.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filteredUsers.map((user) => (
                                        <TableRow key={user.id} hover>
                                            <TableCell>
                                                <Box className="user-info">
                                                    <Avatar className="user-avatar">
                                                        {user.kullanici?.charAt(0)?.toUpperCase()}
                                                    </Avatar>

                                                    <Box>
                                                        <Typography className="user-name">
                                                            {user.kullanici}
                                                        </Typography>
                                                        <Typography className="user-email">
                                                            Reel: {user.Reel_kullanici || '-'}
                                                        </Typography>
                                                    </Box>
                                                </Box>
                                            </TableCell>

                                            <TableCell>{user.kullanici_adi}</TableCell>

                                            <TableCell>
                                                <Chip
                                                    label={user.rol}
                                                    className={`role-chip ${user.rol?.toLowerCase()}`}
                                                />
                                            </TableCell>

                                            <TableCell>
                                                <Typography className="permission-count">
                                                    {user.allowedScreens.length} ekran
                                                </Typography>
                                            </TableCell>

                                            <TableCell>
                                                <Typography className="permission-count">
                                                    {user.allowedButtons.length} buton
                                                </Typography>
                                            </TableCell>

                                            <TableCell align="right">
                                                <Tooltip title="Düzenle">
                                                    <IconButton
                                                        className="edit-button"
                                                        onClick={() => handleEdit(user)}
                                                    >
                                                        <EditIcon />
                                                    </IconButton>
                                                </Tooltip>

                                                <Tooltip title="Sil">
                                                    <IconButton
                                                        className="delete-button"
                                                        onClick={() => handleDelete(user.id)}
                                                    >
                                                        <DeleteIcon />
                                                    </IconButton>
                                                </Tooltip>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </TableContainer>
                </Box>

                <Dialog open={open} onClose={handleClose} fullWidth maxWidth="lg">
                    <DialogTitle>
                        {editingUserId ? 'Kullanıcıyı Düzenle' : 'Yeni Kullanıcı'}
                    </DialogTitle>

                    <DialogContent dividers>
                        <Box className="form-grid">
                            <TextField
                                label="Kullanıcı Maili"
                                fullWidth
                                value={formData.kullanici_adi}
                                onChange={(e) =>
                                    setFormData({ ...formData, kullanici_adi: e.target.value })
                                }
                            />

                            <TextField
                                label="Şifre"
                                fullWidth
                                value={formData.sifre}
                                onChange={(e) =>
                                    setFormData({ ...formData, sifre: e.target.value })
                                }
                            />

                            <TextField
                                label="Kullanıcı Adı"
                                fullWidth
                                value={formData.kullanici}
                                onChange={(e) =>
                                    setFormData({ ...formData, kullanici: e.target.value })
                                }
                            />

                            <TextField
                                label="Reel Kullanıcı"
                                fullWidth
                                value={formData.Reel_kullanici}
                                onChange={(e) =>
                                    setFormData({ ...formData, Reel_kullanici: e.target.value })
                                }
                            />

                            <TextField
                                label="Reel Şifre"
                                fullWidth
                                value={formData.Reel_sifre}
                                onChange={(e) =>
                                    setFormData({ ...formData, Reel_sifre: e.target.value })
                                }
                            />

                            <FormControl fullWidth>
                                <InputLabel>Rol</InputLabel>
                                <Select
                                    label="Rol"
                                    value={formData.rol}
                                    onChange={(e) =>
                                        setFormData({ ...formData, rol: e.target.value })
                                    }
                                >
                                    <MenuItem value="admin">admin</MenuItem>
                                    <MenuItem value="kullanici">kullanici</MenuItem>
                                </Select>
                            </FormControl>
                        </Box>

                        <Divider className="dialog-divider" />

                        <Box className="permission-dialog">
                            <Box className="permission-sidebar">
                                <Typography className="permission-title">
                                    Yetkiler
                                </Typography>

                                <Box className="mini-stat">
                                    <span>{formData.allowedScreens.length}</span>
                                    <small>Ekran</small>
                                </Box>

                                <Box className="mini-stat purple">
                                    <span>{formData.allowedButtons.length}</span>
                                    <small>Buton</small>
                                </Box>
                            </Box>

                            <Box className="permission-content">
                                <Box className="permission-block">
                                    <Box className="permission-block-head">
                                        <Typography className="permission-block-title">
                                            Ekran Yetkileri
                                        </Typography>
                                        <Chip label={`${formData.allowedScreens.length} seçili`} className="count-chip" />
                                    </Box>

                                    <Box className="screen-card-grid">
                                        {screens.map((screen) => {
                                            const selected = formData.allowedScreens.includes(screen.path);

                                            return (
                                                <Box
                                                    key={screen.path}
                                                    className={`modern-screen-card ${selected ? 'selected' : ''}`}
                                                    onClick={() => handleScreenChange(screen.path)}
                                                >
                                                    <Box>
                                                        <Typography className="modern-screen-title">
                                                            {screen.label}
                                                        </Typography>
                                                        <Typography className="modern-screen-group">
                                                            {screen.group}
                                                        </Typography>
                                                    </Box>

                                                    <Box className="modern-check">
                                                        {selected ? '✓' : '+'}
                                                    </Box>
                                                </Box>
                                            );
                                        })}
                                    </Box>
                                </Box>

                                <Box className="permission-block">
                                    <Box className="permission-block-head">
                                        <Typography className="permission-block-title">
                                            Buton Yetkileri
                                        </Typography>
                                        <Chip label={`${formData.allowedButtons.length} seçili`} className="count-chip purple" />
                                    </Box>

                                    {availableButtons.length === 0 ? (
                                        <Box className="empty-permission-box">
                                            Önce ekran seçin.
                                        </Box>
                                    ) : (
                                        <Box className="modern-button-grid">
                                            {availableButtons.map((button) => {
                                                const selected = formData.allowedButtons.includes(button);

                                                return (
                                                    <Box
                                                        key={button}
                                                        className={`modern-button-card ${selected ? 'selected' : ''}`}
                                                        onClick={() => handleButtonChange(button)}
                                                    >
                                                        <span>{button}</span>
                                                        <strong>{selected ? '✓' : '+'}</strong>
                                                    </Box>
                                                );
                                            })}
                                        </Box>
                                    )}
                                </Box>
                            </Box>
                        </Box>
                    </DialogContent>

                    <DialogActions>
                        <Button onClick={handleClose} className="cancel-button">
                            İptal
                        </Button>

                        <Button onClick={handleSave} variant="contained" className="save-button">
                            Kaydet
                        </Button>
                    </DialogActions>
                </Dialog>
            </Box>
        </Box>
    );
}