import React, { useEffect, useMemo, useState } from 'react';

import {
    Alert,
    Box,
    Button,
    Chip,
    CircularProgress,
    LinearProgress,
    Skeleton,
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
import OdakMuiTheme from '../theme/OdakMuiTheme';

import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import RefreshIcon from '@mui/icons-material/Refresh';
import BusinessIcon from '@mui/icons-material/Business';
import CloseIcon from '@mui/icons-material/Close';
import FolderRoundedIcon from '@mui/icons-material/FolderRounded';
import GridViewRoundedIcon from '@mui/icons-material/GridViewRounded';
import BadgeRoundedIcon from '@mui/icons-material/BadgeRounded';
import FilterAltRoundedIcon from '@mui/icons-material/FilterAltRounded';
import SaveRoundedIcon from '@mui/icons-material/SaveRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import DomainRoundedIcon from '@mui/icons-material/DomainRounded';
import LocationOnRoundedIcon from '@mui/icons-material/LocationOnRounded';
import Inventory2RoundedIcon from '@mui/icons-material/Inventory2Rounded';
import ReceiptLongRoundedIcon from '@mui/icons-material/ReceiptLongRounded';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';

import supabase from "../supabaseClient";
import './ProjeEkle.css';

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
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [deleting, setDeleting] = useState(false);

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

    const handleDelete = (proje) => {
        setDeleteTarget(proje);
    };

    const handleConfirmDelete = async () => {
        if (!deleteTarget || deleting) return;

        setDeleting(true);
        setErrorText('');
        setSuccessText('');

        const { error } = await supabase
            .from('Projeler')
            .delete()
            .eq('id', deleteTarget.id);

        if (error) {
            console.error('Proje silme hatası:', error);
            setErrorText(`Silme hatası: ${error.message}`);
            setDeleting(false);
            setDeleteTarget(null);
            return;
        }

        setSuccessText('Proje başarıyla silindi.');
        setDeleting(false);
        setDeleteTarget(null);
        await fetchProjeler();
    };

    const vknDefinedCount = useMemo(
        () => projeler.filter((proje) => Boolean(proje.vkn)).length,
        [projeler]
    );

    return (
        <OdakMuiTheme>
            <Box className="proje-ekle-page">
                <Box className="proje-ekle-shell">
                    <Box className="proje-hero-card">
                        <Box className="proje-hero-main">
                            <Box className="proje-header-icon">
                                <FolderRoundedIcon />
                            </Box>
                            <Box className="proje-hero-copy">
                                <Box className="proje-eyebrow">
                                    <GridViewRoundedIcon />
                                    TANIMLAMALAR · PROJE YÖNETİMİ
                                </Box>
                                <Typography className="proje-header-title">Proje Tanımları</Typography>
                                <Typography className="proje-header-subtitle">
                                    Sipariş akışında kullanılan proje, VKN ve operasyon tanımlarını tek merkezden yönetin.
                                </Typography>
                            </Box>
                        </Box>

                        <Button
                            variant="contained"
                            startIcon={<AddIcon />}
                            endIcon={<ArrowForwardRoundedIcon />}
                            className="new-project-button"
                            onClick={handleOpenCreate}
                        >
                            Yeni Proje
                        </Button>
                    </Box>

                    {loading && <LinearProgress className="project-top-progress" />}

                    {errorText && !dialogOpen && (
                        <Alert severity="error" className="proje-alert" onClose={() => setErrorText('')}>
                            {errorText}
                        </Alert>
                    )}

                    {successText && (
                        <Alert severity="success" className="proje-alert" onClose={() => setSuccessText('')}>
                            {successText}
                        </Alert>
                    )}

                    <Box className="project-stats">
                        <Box className="project-stat-card project-stat-card--primary">
                            <Box className="project-stat-icon"><FolderRoundedIcon /></Box>
                            <Box>
                                <Typography className="project-stat-label">Toplam Proje</Typography>
                                <Typography className="project-stat-value">{projeler.length}</Typography>
                                <Typography className="project-stat-meta">Sistemdeki tüm proje tanımları</Typography>
                            </Box>
                        </Box>

                        <Box className="project-stat-card">
                            <Box className="project-stat-icon project-stat-icon--blue"><FilterAltRoundedIcon /></Box>
                            <Box>
                                <Typography className="project-stat-label">Listelenen</Typography>
                                <Typography className="project-stat-value">{filteredProjeler.length}</Typography>
                                <Typography className="project-stat-meta">Aktif arama sonucundaki kayıtlar</Typography>
                            </Box>
                        </Box>

                        <Box className="project-stat-card">
                            <Box className="project-stat-icon project-stat-icon--green"><BadgeRoundedIcon /></Box>
                            <Box>
                                <Typography className="project-stat-label">VKN Tanımlı</Typography>
                                <Typography className="project-stat-value">{vknDefinedCount}</Typography>
                                <Typography className="project-stat-meta">Vergi numarası eşleşmesi hazır</Typography>
                            </Box>
                        </Box>
                    </Box>

                    <Paper className="project-list-card">
                        <Box className="project-toolbar">
                            <Box className="project-toolbar-heading">
                                <Box className="project-toolbar-icon"><BusinessIcon /></Box>
                                <Box>
                                    <Typography className="project-list-title">Proje Kataloğu</Typography>
                                    <Typography className="project-list-description">
                                        Kayıtları arayın, düzenleyin veya yeni proje tanımlayın.
                                    </Typography>
                                </Box>
                            </Box>

                            <Box className="project-toolbar-actions">
                                <TextField
                                    size="small"
                                    placeholder="Proje adı, VKN, proje ID veya ürün ara..."
                                    value={searchText}
                                    onChange={(event) => setSearchText(event.target.value)}
                                    InputProps={{
                                        startAdornment: (
                                            <InputAdornment position="start"><SearchIcon /></InputAdornment>
                                        ),
                                        endAdornment: searchText ? (
                                            <InputAdornment position="end">
                                                <Tooltip title="Aramayı temizle">
                                                    <IconButton size="small" onClick={() => setSearchText('')}>
                                                        <CloseIcon fontSize="small" />
                                                    </IconButton>
                                                </Tooltip>
                                            </InputAdornment>
                                        ) : null
                                    }}
                                />

                                {searchText && (
                                    <Chip
                                        className="project-filter-chip"
                                        icon={<FilterAltRoundedIcon />}
                                        label={`${filteredProjeler.length} sonuç`}
                                        size="small"
                                    />
                                )}

                                <Tooltip title="Listeyi yenile">
                                    <IconButton
                                        className={`refresh-project-button ${loading ? 'is-loading' : ''}`}
                                        onClick={fetchProjeler}
                                        disabled={loading}
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
                                        <TableCell>Proje</TableCell>
                                        <TableCell>VKN</TableCell>
                                        <TableCell>Proje ID</TableCell>
                                        <TableCell>Yükleme Adresi</TableCell>
                                        <TableCell>Ürün</TableCell>
                                        <TableCell>Kap</TableCell>
                                        <TableCell>Brüt KG</TableCell>
                                        <TableCell align="right">İşlemler</TableCell>
                                    </TableRow>
                                </TableHead>

                                <TableBody>
                                    {loading ? (
                                        Array.from({ length: 5 }).map((_, index) => (
                                            <TableRow key={`skeleton-${index}`}>
                                                {Array.from({ length: 9 }).map((__, cellIndex) => (
                                                    <TableCell key={cellIndex}>
                                                        <Skeleton animation="wave" height={24} />
                                                    </TableCell>
                                                ))}
                                            </TableRow>
                                        ))
                                    ) : filteredProjeler.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={9} align="center" className="project-empty-cell">
                                                <Box className="project-empty-icon"><SearchIcon /></Box>
                                                <strong>{searchText ? 'Aramanızla eşleşen proje bulunamadı' : 'Henüz proje tanımı yok'}</strong>
                                                <span>{searchText ? 'Farklı bir anahtar kelime deneyin.' : 'İlk proje kaydını oluşturarak başlayabilirsiniz.'}</span>
                                                {!searchText && (
                                                    <Button variant="outlined" startIcon={<AddIcon />} onClick={handleOpenCreate}>
                                                        Proje Oluştur
                                                    </Button>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        filteredProjeler.map((proje) => (
                                            <TableRow key={proje.id} hover className="project-row">
                                                <TableCell><span className="project-db-id">#{proje.id}</span></TableCell>
                                                <TableCell>
                                                    <Box className="project-name-cell">
                                                        <Box className="project-avatar">
                                                            {String(proje.Proje_Adi || 'P').trim().charAt(0).toLocaleUpperCase('tr-TR')}
                                                        </Box>
                                                        <Box>
                                                            <Typography className="project-name">{proje.Proje_Adi || '-'}</Typography>
                                                            <Typography className="project-name-sub">Proje tanımı</Typography>
                                                        </Box>
                                                    </Box>
                                                </TableCell>
                                                <TableCell>
                                                    <Box className="project-inline-value"><ReceiptLongRoundedIcon />{proje.vkn || '-'}</Box>
                                                </TableCell>
                                                <TableCell>
                                                    <Chip size="small" label={proje.proje_id || '-'} className="project-id-chip" />
                                                </TableCell>
                                                <TableCell>
                                                    <Box className="project-inline-value project-address-value"><LocationOnRoundedIcon />{proje.Yukleme_Firma_Adres_Adi || '-'}</Box>
                                                </TableCell>
                                                <TableCell>
                                                    <Box className="project-inline-value"><Inventory2RoundedIcon />{proje.Urun || '-'}</Box>
                                                </TableCell>
                                                <TableCell>{proje.Kap_Adet || '-'}</TableCell>
                                                <TableCell>{proje.Brut_KG || '-'}</TableCell>
                                                <TableCell align="right">
                                                    <Box className="project-row-actions">
                                                        <Tooltip title="Projeyi düzenle">
                                                            <IconButton className="project-edit-button" onClick={() => handleOpenEdit(proje)}>
                                                                <EditIcon />
                                                            </IconButton>
                                                        </Tooltip>
                                                        <Tooltip title="Projeyi sil">
                                                            <IconButton className="project-delete-button" onClick={() => handleDelete(proje)}>
                                                                <DeleteIcon />
                                                            </IconButton>
                                                        </Tooltip>
                                                    </Box>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </TableContainer>

                        {!loading && filteredProjeler.length > 0 && (
                            <Box className="project-table-footer">
                                <span><GridViewRoundedIcon /> {filteredProjeler.length} proje görüntüleniyor</span>
                                <span>Sonuçlar en yeni kayıttan eskiye sıralanır.</span>
                            </Box>
                        )}
                    </Paper>
                </Box>

                <Dialog open={dialogOpen} onClose={handleCloseDialog} fullWidth maxWidth="sm" className="project-dialog">
                    <DialogTitle className="project-dialog-title">
                        <Box className="project-dialog-title-main">
                            <Box className="project-dialog-icon">{editingId ? <EditIcon /> : <AddIcon />}</Box>
                            <Box>
                                <Typography className="project-dialog-heading">
                                    {editingId ? 'Projeyi Düzenle' : 'Yeni Proje Tanımla'}
                                </Typography>
                                <Typography className="project-dialog-subtitle">
                                    Sipariş akışında kullanılacak temel proje bilgilerini girin.
                                </Typography>
                            </Box>
                        </Box>
                        <IconButton onClick={handleCloseDialog} disabled={saving}><CloseIcon /></IconButton>
                    </DialogTitle>

                    {saving && <LinearProgress className="project-dialog-progress" />}

                    <DialogContent dividers className="project-dialog-content">
                        {errorText && (
                            <Alert severity="error" className="dialog-alert" onClose={() => setErrorText('')}>
                                {errorText}
                            </Alert>
                        )}

                        <Box className="project-form-section">
                            <Box className="project-form-section-title">
                                <DomainRoundedIcon />
                                <Box>
                                    <strong>Temel Proje Bilgileri</strong>
                                    <span>Projenin sistemde eşleşmesini sağlayan zorunlu alanlar.</span>
                                </Box>
                            </Box>
                            <Box className="project-form-grid">
                                <TextField name="Proje_Adi" label="Proje Adı" value={formData.Proje_Adi} onChange={handleInputChange} required fullWidth />
                                <TextField name="vkn" label="VKN" value={formData.vkn} onChange={handleInputChange} required fullWidth inputProps={{ maxLength: 11 }} />
                                <TextField name="proje_id" label="Proje ID" value={formData.proje_id} onChange={handleInputChange} required fullWidth />
                            </Box>
                        </Box>

                        <Box className="project-form-section">
                            <Box className="project-form-section-title">
                                <LocationOnRoundedIcon />
                                <Box>
                                    <strong>Operasyon Bilgileri</strong>
                                    <span>Yükleme, ürün ve müşteri sipariş eşleşmelerinde kullanılır.</span>
                                </Box>
                            </Box>
                            <Box className="project-form-grid">
                                <TextField name="Yukleme_Firma_Adres_Adi" label="Yükleme Firma Adres ID" value={formData.Yukleme_Firma_Adres_Adi} onChange={handleInputChange} fullWidth />
                                <TextField name="Urun" label="Ürün ID" value={formData.Urun} onChange={handleInputChange} fullWidth />
                                <TextField name="Musteri_Siparis_No" label="Müşteri Sipariş No" value={formData.Musteri_Siparis_No} onChange={handleInputChange} helperText="Zorunlu değil" fullWidth className="project-form-optional" />
                            </Box>
                        </Box>
                    </DialogContent>

                    <DialogActions className="project-dialog-actions">
                        <Button onClick={handleCloseDialog} disabled={saving}>İptal</Button>
                        <Button variant="contained" onClick={handleSave} disabled={saving} startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <SaveRoundedIcon />}>
                            {saving ? 'Kaydediliyor...' : editingId ? 'Değişiklikleri Kaydet' : 'Projeyi Kaydet'}
                        </Button>
                    </DialogActions>
                </Dialog>

                <Dialog open={Boolean(deleteTarget)} onClose={() => !deleting && setDeleteTarget(null)} maxWidth="xs" fullWidth className="project-delete-dialog">
                    <DialogContent className="project-delete-content">
                        <Box className="project-delete-icon"><DeleteOutlineRoundedIcon /></Box>
                        <Typography className="project-delete-title">Projeyi silmek istiyor musunuz?</Typography>
                        <Typography className="project-delete-text">
                            <strong>{deleteTarget?.Proje_Adi}</strong> proje tanımı kalıcı olarak silinecek. Bu işlem geri alınamaz.
                        </Typography>
                    </DialogContent>
                    <DialogActions className="project-dialog-actions project-delete-actions">
                        <Button onClick={() => setDeleteTarget(null)} disabled={deleting}>Vazgeç</Button>
                        <Button color="error" variant="contained" onClick={handleConfirmDelete} disabled={deleting} startIcon={deleting ? <CircularProgress size={16} color="inherit" /> : <DeleteOutlineRoundedIcon />}>
                            {deleting ? 'Siliniyor...' : 'Projeyi Sil'}
                        </Button>
                    </DialogActions>
                </Dialog>
            </Box>
        </OdakMuiTheme>
    );
}
