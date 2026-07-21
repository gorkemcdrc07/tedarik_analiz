import React, { useEffect, useMemo, useState } from 'react';

import {
    Alert,
    Box,
    Button,
    Chip,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    IconButton,
    InputAdornment,
    Paper,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    TextField,
    Tooltip,
    Typography
} from '@mui/material';
import { ThemeProvider, createTheme } from '@mui/material/styles';

import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import RefreshIcon from '@mui/icons-material/Refresh';
import BusinessIcon from '@mui/icons-material/Business';
import CloseIcon from '@mui/icons-material/Close';

import supabase from "../supabaseClient";
import './ProjeEkle.css';

// Scoped dark theme — only affects this page's MUI tree.
const darkTheme = createTheme({
    palette: {
        mode: 'dark',
        background: {
            default: '#0a0e14',
            paper: '#12171f'
        },
        primary: {
            main: '#f0a23c'
        },
        secondary: {
            main: '#4fd1c5'
        },
        error: {
            main: '#f87171'
        },
        text: {
            primary: '#eef1f6',
            secondary: '#9aa4b2'
        },
        divider: '#232b37'
    },
    shape: {
        borderRadius: 10
    },
    typography: {
        fontFamily: '"Inter", "Segoe UI", Roboto, sans-serif'
    },
    components: {
        MuiPaper: {
            styleOverrides: {
                root: {
                    backgroundImage: 'none'
                }
            }
        },
        MuiDialog: {
            styleOverrides: {
                paper: {
                    backgroundColor: '#12171f',
                    border: '1px solid #232b37'
                }
            }
        }
    }
});

// Fields the user is asked for when creating / editing a project.
// Everything else keeps whatever value it already has (or its default).
const initialFormData = {
    Proje_Adi: '',
    vkn: '',
    proje_id: '',
    Musteri_Siparis_No: '',
    Yukleme_Firma_Adres_Adi: '',
    Urun: '',
    // Hidden fields — not shown in the form, kept with sensible defaults.
    Alici_Firma_Cari_Unvani: '',
    Kap_Adet: '25',
    Ambalaj_Tipi: '1',
    Brut_KG: '25.000'
};

const createPayload = (formData) => ({
    Proje_Adi: formData.Proje_Adi.trim(),
    vkn: formData.vkn.trim(),
    proje_id: formData.proje_id.trim(),
    Musteri_Siparis_No:
        formData.Musteri_Siparis_No.trim() || null,
    Yukleme_Firma_Adres_Adi:
        formData.Yukleme_Firma_Adres_Adi.trim() || null,
    Alici_Firma_Cari_Unvani:
        formData.Alici_Firma_Cari_Unvani.trim() || null,
    Urun: formData.Urun.trim() || null,
    Kap_Adet: formData.Kap_Adet.trim() || null,
    Ambalaj_Tipi: formData.Ambalaj_Tipi.trim() || null,
    Brut_KG: formData.Brut_KG.trim() || null
});

export default function ProjeEkle() {
    const [projeler, setProjeler] = useState([]);
    const [formData, setFormData] = useState(initialFormData);

    const [searchText, setSearchText] = useState('');
    const [editingId, setEditingId] = useState(null);

    const [dialogOpen, setDialogOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    const [errorText, setErrorText] = useState('');
    const [successText, setSuccessText] = useState('');

    useEffect(() => {
        fetchProjeler();
    }, []);

    const fetchProjeler = async () => {
        setLoading(true);
        setErrorText('');

        const { data, error } = await supabase
            .from('Projeler')
            .select('*')
            .order('id', { ascending: false });

        if (error) {
            console.error('Proje listeleme hatası:', error);
            setErrorText(`Projeler alınamadı: ${error.message}`);
            setProjeler([]);
        } else {
            setProjeler(data || []);
        }

        setLoading(false);
    };

    const filteredProjeler = useMemo(() => {
        const search = searchText
            .toLocaleLowerCase('tr-TR')
            .trim();

        if (!search) {
            return projeler;
        }

        return projeler.filter((proje) => {
            const searchableValues = [
                proje.Proje_Adi,
                proje.vkn,
                proje.proje_id,
                proje.Musteri_Siparis_No,
                proje.Yukleme_Firma_Adres_Adi,
                proje.Alici_Firma_Cari_Unvani,
                proje.Urun
            ];

            return searchableValues.some((value) =>
                String(value ?? '')
                    .toLocaleLowerCase('tr-TR')
                    .includes(search)
            );
        });
    }, [projeler, searchText]);

    const handleInputChange = (event) => {
        const { name, value } = event.target;

        setFormData((previous) => ({
            ...previous,
            [name]: value
        }));
    };

    const handleOpenCreate = () => {
        setEditingId(null);
        setFormData(initialFormData);
        setErrorText('');
        setDialogOpen(true);
    };

    const handleOpenEdit = (proje) => {
        setEditingId(proje.id);

        // Full record is kept in state (including the hidden fields)
        // so an update never wipes out data the form doesn't show.
        setFormData({
            Proje_Adi: String(proje.Proje_Adi ?? ''),
            vkn: String(proje.vkn ?? ''),
            proje_id: String(proje.proje_id ?? ''),
            Musteri_Siparis_No: String(
                proje.Musteri_Siparis_No ?? ''
            ),
            Yukleme_Firma_Adres_Adi: String(
                proje.Yukleme_Firma_Adres_Adi ?? ''
            ),
            Urun: String(proje.Urun ?? ''),
            Alici_Firma_Cari_Unvani: String(
                proje.Alici_Firma_Cari_Unvani ?? ''
            ),
            Kap_Adet: String(
                proje.Kap_Adet ?? initialFormData.Kap_Adet
            ),
            Ambalaj_Tipi: String(
                proje.Ambalaj_Tipi ?? initialFormData.Ambalaj_Tipi
            ),
            Brut_KG: String(
                proje.Brut_KG ?? initialFormData.Brut_KG
            )
        });

        setErrorText('');
        setDialogOpen(true);
    };

    const handleCloseDialog = () => {
        if (saving) return;

        setDialogOpen(false);
        setEditingId(null);
        setFormData(initialFormData);
    };

    const validateForm = () => {
        if (!formData.Proje_Adi.trim()) {
            setErrorText('Proje adı zorunludur.');
            return false;
        }

        if (!formData.vkn.trim()) {
            setErrorText('VKN zorunludur.');
            return false;
        }

        if (!formData.proje_id.trim()) {
            setErrorText('Proje ID zorunludur.');
            return false;
        }

        if (
            formData.vkn.trim() &&
            !/^\d+$/.test(formData.vkn.trim())
        ) {
            setErrorText('VKN yalnızca rakamlardan oluşmalıdır.');
            return false;
        }

        return true;
    };

    const handleSave = async () => {
        setErrorText('');
        setSuccessText('');

        if (!validateForm()) {
            return;
        }

        setSaving(true);

        const payload = createPayload(formData);

        const result = editingId
            ? await supabase
                .from('Projeler')
                .update(payload)
                .eq('id', editingId)
            : await supabase
                .from('Projeler')
                .insert([payload]);

        if (result.error) {
            console.error('Proje kayıt hatası:', result.error);
            setErrorText(`Kayıt hatası: ${result.error.message}`);
            setSaving(false);
            return;
        }

        setSuccessText(
            editingId
                ? 'Proje başarıyla güncellendi.'
                : 'Proje başarıyla eklendi.'
        );

        setSaving(false);
        setDialogOpen(false);
        setEditingId(null);
        setFormData(initialFormData);

        await fetchProjeler();
    };

    const handleDelete = async (proje) => {
        const confirmed = window.confirm(
            `"${proje.Proje_Adi}" projesini silmek istediğinize emin misiniz?`
        );

        if (!confirmed) return;

        setErrorText('');
        setSuccessText('');

        const { error } = await supabase
            .from('Projeler')
            .delete()
            .eq('id', proje.id);

        if (error) {
            console.error('Proje silme hatası:', error);
            setErrorText(`Silme hatası: ${error.message}`);
            return;
        }

        setSuccessText('Proje başarıyla silindi.');
        await fetchProjeler();
    };

    return (
        <ThemeProvider theme={darkTheme}>
            <Box className="proje-ekle-page">
                <Box className="proje-ekle-shell">
                    <Box className="proje-ekle-header">
                        <Box className="proje-header-left">
                            <Box className="proje-header-icon">
                                <BusinessIcon />
                            </Box>

                            <Box>
                                <Typography className="proje-header-title">
                                    Proje Ekle
                                </Typography>

                                <Typography className="proje-header-subtitle">
                                    Proje tanımlarını görüntüleyin ve yönetin
                                </Typography>
                            </Box>
                        </Box>

                        <Button
                            variant="contained"
                            startIcon={<AddIcon />}
                            className="new-project-button"
                            onClick={handleOpenCreate}
                        >
                            Yeni Proje
                        </Button>
                    </Box>

                    {errorText && !dialogOpen && (
                        <Alert
                            severity="error"
                            className="proje-alert"
                            onClose={() => setErrorText('')}
                        >
                            {errorText}
                        </Alert>
                    )}

                    {successText && (
                        <Alert
                            severity="success"
                            className="proje-alert"
                            onClose={() => setSuccessText('')}
                        >
                            {successText}
                        </Alert>
                    )}

                    <Box className="project-stats">
                        <Box className="project-stat-card">
                            <Typography className="project-stat-label">
                                Toplam Proje
                            </Typography>

                            <Typography className="project-stat-value">
                                {projeler.length}
                            </Typography>
                        </Box>

                        <Box className="project-stat-card">
                            <Typography className="project-stat-label">
                                Listelenen
                            </Typography>

                            <Typography className="project-stat-value">
                                {filteredProjeler.length}
                            </Typography>
                        </Box>

                        <Box className="project-stat-card">
                            <Typography className="project-stat-label">
                                VKN Tanımlı
                            </Typography>

                            <Typography className="project-stat-value">
                                {
                                    projeler.filter(
                                        (proje) => Boolean(proje.vkn)
                                    ).length
                                }
                            </Typography>
                        </Box>
                    </Box>

                    <Paper className="project-list-card">
                        <Box className="project-toolbar">
                            <Box>
                                <Typography className="project-list-title">
                                    Proje Listesi
                                </Typography>

                                <Typography className="project-list-description">
                                    Mevcut proje tanımları
                                </Typography>
                            </Box>

                            <Box className="project-toolbar-actions">
                                <TextField
                                    size="small"
                                    placeholder="Proje, VKN veya ID ara..."
                                    value={searchText}
                                    onChange={(event) =>
                                        setSearchText(event.target.value)
                                    }
                                    InputProps={{
                                        startAdornment: (
                                            <InputAdornment position="start">
                                                <SearchIcon />
                                            </InputAdornment>
                                        )
                                    }}
                                />

                                <Tooltip title="Listeyi yenile">
                                    <IconButton
                                        className="refresh-project-button"
                                        onClick={fetchProjeler}
                                    >
                                        <RefreshIcon />
                                    </IconButton>
                                </Tooltip>
                            </Box>
                        </Box>

                        <TableContainer className="project-table-container">
                            <Table stickyHeader>
                                <TableHead>
                                    <TableRow>
                                        <TableCell>ID</TableCell>
                                        <TableCell>Proje Adı</TableCell>
                                        <TableCell>VKN</TableCell>
                                        <TableCell>Proje ID</TableCell>
                                        <TableCell>Yükleme Adresi</TableCell>
                                        <TableCell>Ürün</TableCell>
                                        <TableCell>Kap</TableCell>
                                        <TableCell>Brüt KG</TableCell>
                                        <TableCell align="right">
                                            İşlemler
                                        </TableCell>
                                    </TableRow>
                                </TableHead>

                                <TableBody>
                                    {loading ? (
                                        <TableRow>
                                            <TableCell
                                                colSpan={9}
                                                align="center"
                                                className="project-empty-cell"
                                            >
                                                <CircularProgress size={26} />
                                                <span>Projeler yükleniyor...</span>
                                            </TableCell>
                                        </TableRow>
                                    ) : filteredProjeler.length === 0 ? (
                                        <TableRow>
                                            <TableCell
                                                colSpan={9}
                                                align="center"
                                                className="project-empty-cell"
                                            >
                                                Kayıtlı proje bulunamadı.
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        filteredProjeler.map((proje) => (
                                            <TableRow key={proje.id} hover>
                                                <TableCell>
                                                    {proje.id}
                                                </TableCell>

                                                <TableCell>
                                                    <Typography className="project-name">
                                                        {proje.Proje_Adi || '-'}
                                                    </Typography>
                                                </TableCell>

                                                <TableCell>
                                                    {proje.vkn || '-'}
                                                </TableCell>

                                                <TableCell>
                                                    <Chip
                                                        size="small"
                                                        label={
                                                            proje.proje_id || '-'
                                                        }
                                                        className="project-id-chip"
                                                    />
                                                </TableCell>

                                                <TableCell>
                                                    {
                                                        proje
                                                            .Yukleme_Firma_Adres_Adi ||
                                                        '-'
                                                    }
                                                </TableCell>

                                                <TableCell>
                                                    {proje.Urun || '-'}
                                                </TableCell>

                                                <TableCell>
                                                    {proje.Kap_Adet || '-'}
                                                </TableCell>

                                                <TableCell>
                                                    {proje.Brut_KG || '-'}
                                                </TableCell>

                                                <TableCell align="right">
                                                    <Tooltip title="Düzenle">
                                                        <IconButton
                                                            className="project-edit-button"
                                                            onClick={() =>
                                                                handleOpenEdit(proje)
                                                            }
                                                        >
                                                            <EditIcon />
                                                        </IconButton>
                                                    </Tooltip>

                                                    <Tooltip title="Sil">
                                                        <IconButton
                                                            className="project-delete-button"
                                                            onClick={() =>
                                                                handleDelete(proje)
                                                            }
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
                    </Paper>
                </Box>

                <Dialog
                    open={dialogOpen}
                    onClose={handleCloseDialog}
                    fullWidth
                    maxWidth="sm"
                >
                    <DialogTitle className="project-dialog-title">
                        <Box>
                            <Typography className="project-dialog-heading">
                                {editingId
                                    ? 'Projeyi Düzenle'
                                    : 'Yeni Proje Ekle'}
                            </Typography>

                            <Typography className="project-dialog-subtitle">
                                Proje tanım bilgilerini doldurun
                            </Typography>
                        </Box>

                        <IconButton
                            onClick={handleCloseDialog}
                            disabled={saving}
                        >
                            <CloseIcon />
                        </IconButton>
                    </DialogTitle>

                    <DialogContent dividers>
                        {errorText && (
                            <Alert
                                severity="error"
                                className="dialog-alert"
                                onClose={() => setErrorText('')}
                            >
                                {errorText}
                            </Alert>
                        )}

                        <Box className="project-form-grid">
                            <TextField
                                name="Proje_Adi"
                                label="Proje Adı"
                                value={formData.Proje_Adi}
                                onChange={handleInputChange}
                                required
                                fullWidth
                            />

                            <TextField
                                name="vkn"
                                label="VKN"
                                value={formData.vkn}
                                onChange={handleInputChange}
                                required
                                fullWidth
                                inputProps={{ maxLength: 11 }}
                            />

                            <TextField
                                name="proje_id"
                                label="Proje ID"
                                value={formData.proje_id}
                                onChange={handleInputChange}
                                required
                                fullWidth
                            />

                            <TextField
                                name="Yukleme_Firma_Adres_Adi"
                                label="Yükleme Firma Adres ID"
                                value={formData.Yukleme_Firma_Adres_Adi}
                                onChange={handleInputChange}
                                fullWidth
                            />

                            <TextField
                                name="Urun"
                                label="Ürün ID"
                                value={formData.Urun}
                                onChange={handleInputChange}
                                fullWidth
                            />

                            <TextField
                                name="Musteri_Siparis_No"
                                label="Müşteri Sipariş No"
                                value={formData.Musteri_Siparis_No}
                                onChange={handleInputChange}
                                helperText="Zorunlu değil"
                                fullWidth
                                className="project-form-optional"
                            />
                        </Box>
                    </DialogContent>

                    <DialogActions className="project-dialog-actions">
                        <Button
                            onClick={handleCloseDialog}
                            disabled={saving}
                        >
                            İptal
                        </Button>

                        <Button
                            variant="contained"
                            onClick={handleSave}
                            disabled={saving}
                        >
                            {saving
                                ? 'Kaydediliyor...'
                                : editingId
                                    ? 'Güncelle'
                                    : 'Projeyi Kaydet'}
                        </Button>
                    </DialogActions>
                </Dialog>
            </Box>
        </ThemeProvider>
    );
}