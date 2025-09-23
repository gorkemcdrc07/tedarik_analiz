import React, { useEffect, useRef } from "react";
import "./OdakDetailModal.css";

const formatDate = (dateStr) => {
    if (!dateStr) return "-";
    const date = new Date(dateStr);
    if (isNaN(date)) return "-";
    return date.toLocaleDateString("tr-TR"); 
};


const statusClass = (txt = "") => {
    const t = String(txt).toLowerCase();
    if (t.includes("iptal") || t.includes("cancel")) return "pill-danger";
    if (t.includes("tamam") || t.includes("complete") || t.includes("kapandı")) return "pill-success";
    if (t.includes("bekle") || t.includes("pending") || t.includes("onay")) return "pill-warn";
    return "pill-neutral";
};

const OdakDetailModal = ({ projectName, records = [], onClose }) => {
    const modalRef = useRef(null);

    useEffect(() => {
        const onKey = (e) => e.key === "Escape" && onClose?.();
        document.addEventListener("keydown", onKey);
        const prevOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => {
            document.removeEventListener("keydown", onKey);
            document.body.style.overflow = prevOverflow;
        };
    }, [onClose]);

    const stop = (e) => e.stopPropagation(); 

    return (
        <div className="odak-overlay" onMouseDown={onClose}>
            <div
                className="odak-modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="odak-title"
                onMouseDown={stop}
                ref={modalRef}
            >
                <button className="odak-close" onClick={onClose} aria-label="Kapat">×</button>

                <h2 id="odak-title">
                    <span className="odak-dot" />
                    {projectName} — REEL Detaylar
                </h2>

                <div className="odak-table-wrapper">
                    <table className="odak-detail-table">
                        <thead>
                            <tr>
                                <th>SİPARİŞ TARİHİ</th>
                                <th>YÜKLEME TARİHİ</th>
                                <th>SİPARİŞ NO</th>
                                <th>SİPARİŞ DURUMU</th>
                                <th>TESLİM NOKTASI</th>
                                <th>TESLİM İL</th>
                                <th>SEFER NO</th>
                                <th>SEFER TARİHİ</th>
                                <th>SİPARİŞ AÇAN</th>
                                <th>SİPARİŞ AÇILIŞ</th>
                                <th>POZİSYON NO</th>
                            </tr>
                        </thead>

                        <tbody>
                            {records.map((item, i) => (
                                <tr key={i}>
                                    <td>{formatDate(item?.OrderDate)}</td>
                                    <td>{formatDate(item?.PickupDate)}</td>
                                    <td className="truncate" title={item?.DocumentNo || "-"}>{item?.DocumentNo || "-"}</td>
                                    <td>
                                        <span className={`pill ${statusClass(item?.OrderStatu)}`}>
                                            {item?.OrderStatu || "-"}
                                        </span>
                                    </td>
                                    <td className="truncate" title={item?.DeliveryAddressCode || "-"}>{item?.DeliveryAddressCode || "-"}</td>
                                    <td className="truncate" title={item?.DeliveryCityName || "-"}>{item?.DeliveryCityName || "-"}</td>
                                    <td className="truncate" title={item?.TMSDespatchDocumentNo || "-"}>{item?.TMSDespatchDocumentNo || "-"}</td>
                                    <td>{formatDate(item?.TMSDespatchDate)}</td>
                                    <td className="truncate" title={item?.OrderCreatedBy || "-"}>{item?.OrderCreatedBy || "-"}</td>
                                    <td>{formatDate(item?.OrderCretedDate)}</td>
                                    <td className="truncate" title={item?.TMSVehicleRequestDocumentNo || "-"}>{item?.TMSVehicleRequestDocumentNo || "-"}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

            </div>
        </div>
    );
};

export default OdakDetailModal;
