export const PERMISSION_MODULES = [
    {
        id: "siparis",
        label: "Sipariş İşlemleri",
        description: "Sipariş, müşteri ve teslimat operasyonları",
        screens: [
            {
                label: "Sipariş Oluştur",
                path: "/SiparisIslemleri/SiparisOlustur",
                actions: ["Görüntüle", "Kaydet", "Sil", "Güncelle"]
            },
            {
                label: "Yeni Sipariş",
                path: "/SiparisIslemleri/YeniSiparis",
                actions: [
                    "Görüntüle",
                    "Kaydet",
                    "Sil",
                    "Güncelle",
                    "Şablon İndir",
                    "Excel Yükle"
                ]
            },
            {
                label: "Parsiyel Sipariş Oluştur",
                path: "/SiparisIslemleri/ParsiyelSiparisOlustur",
                actions: ["Görüntüle", "Kaydet", "Sil", "Güncelle"]
            },
            {
                label: "Sipariş Açanlar",
                path: "/SiparisIslemleri/SiparisAcanlar",
                actions: ["Görüntüle", "Filtrele", "Dışa Aktar"]
            },
            {
                label: "Arkas",
                path: "/SiparisIslemleri/Arkas",
                actions: ["Görüntüle", "Kaydet", "Dışa Aktar"]
            },
            {
                label: "Fasdat",
                path: "/SiparisIslemleri/Fasdat",
                actions: ["Görüntüle", "Kaydet", "Dışa Aktar"]
            },
            {
                label: "Teslim Noktaları",
                path: "/SiparisIslemleri/TeslimNoktalari",
                actions: ["Görüntüle", "Ekle", "Sil", "Güncelle"]
            }
        ]
    },

    {
        id: "tanimlamalar",
        label: "Tanımlamalar",
        description: "Sistem ve proje tanımları",
        screens: [
            {
                label: "Proje Ekle",
                path: "/Tanimlamalar/ProjeEkle",
                actions: ["Görüntüle", "Ekle", "Güncelle", "Sil"]
            }
        ]
    },

    {
        id: "gelir-gider",
        label: "Gelir / Gider",
        description: "Gelir ve gider işlemleri",
        screens: [
            {
                label: "Gelir Ekleme",
                path: "/GelirGider/GelirEkleme",
                actions: ["Görüntüle", "Ekle", "Sil", "Güncelle"]
            },
            {
                label: "Gider Ekleme",
                path: "/GelirGider/GiderEkleme",
                actions: ["Görüntüle", "Ekle", "Sil", "Güncelle"]
            },
            {
                label: "Test Gelir",
                path: "/GelirGider/TestGelir",
                actions: ["Görüntüle", "Dışa Aktar"]
            },
            {
                label: "Test Gider",
                path: "/GelirGider/TestGider",
                actions: ["Görüntüle", "Dışa Aktar"]
            }
        ]
    },

    {
        id: "fiyatlandirma",
        label: "Fiyatlandırma",
        description: "Sefer ve fiyatlandırma işlemleri",
        screens: [
            {
                label: "Sefer Fiyatlandırma",
                path: "/fiyatlandirma/seferFiyatlandirma",
                actions: ["Görüntüle", "Hesapla", "Kaydet"]
            }
        ]
    },

    {
        id: "finans",
        label: "Finans",
        description: "Yakıt, tarife ve finans operasyonları",
        screens: [
            {
                label: "Yakıt Hesaplama",
                path: "/finans/yakit-hesaplama",
                actions: [
                    "Görüntüle",
                    "Kaydet",
                    "Güncelle",
                    "Geri Al",
                    "Excel Yükle"
                ]
            },
            {
                label: "Yakıt Onayları",
                path: "/finans/yakit-onaylar",
                actions: ["Görüntüle"]
            },
            {
                label: "Tarife Kontrol Merkezi",
                path: "/finans/yakit-kontrol-merkezi",
                actions: ["Görüntüle"]
            }
        ]
    },

    {
        id: "analiz",
        label: "Analiz",
        description: "Raporlama ve analiz ekranları",
        screens: [
            {
                label: "Özet Tablo",
                path: "/analiz/ozet",
                actions: ["Görüntüle", "Filtrele", "Dışa Aktar"]
            }
        ]
    },

    {
        id: "gorsel",
        label: "Görsel",
        description: "Görsel ve sunum ekranları",
        screens: [
            {
                label: "Görsel",
                path: "/gorsel",
                actions: ["Görüntüle"]
            }
        ]
    }
];

export const PERMISSION_SCREENS = PERMISSION_MODULES.flatMap(
    (module) =>
        module.screens.map((screen) => ({
            ...screen,
            group: module.label,
            moduleId: module.id
        }))
);

export const SCREEN_ACTIONS = Object.fromEntries(
    PERMISSION_SCREENS.map((screen) => [
        screen.path,
        screen.actions
    ])
);

export function getScreenByPath(path) {
    return PERMISSION_SCREENS.find(
        (screen) => screen.path === path
    ) || null;
}

export function getModuleById(moduleId) {
    return PERMISSION_MODULES.find(
        (module) => module.id === moduleId
    ) || null;
}

export function getAvailableActions(screenPaths = []) {
    return [
        ...new Set(
            screenPaths.flatMap(
                (path) => SCREEN_ACTIONS[path] || []
            )
        )
    ];
}