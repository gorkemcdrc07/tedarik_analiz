import React from "react";
import "./OdakDetailModal.css";

const formatDate = (dateStr) => {
    if (!dateStr) return "-";
    const date = new Date(dateStr);
    if (isNaN(date)) return "-";
    return date.toLocaleDateString("tr-TR"); // GG.AA.YYYY
};

const OdakDetailModal = ({ projectName, records, onClose }) => {
    return (
        <div className="modal-overlay">
            <div className="modal-content">
                <button className="close-button" onClick={onClose}>×</button>
                <h2>{projectName} — REEL Detaylar</h2>
                <div className="table-wrapper">
                    <table className="detail-table">
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
                                    <td>{formatDate(item.OrderDate)}</td>
                                    <td>{formatDate(item.PickupDate)}</td>
                                    <td>{item.DocumentNo || "-"}</td>
                                    <td>{item.OrderStatu}</td>
                                    <td>{item.DeliveryAddressCode}</td>
                                    <td>{item.DeliveryCityName}</td>
                                    <td>{item.TMSDespatchDocumentNo || "-"}</td>
                                    <td>{formatDate(item.TMSDespatchDate)}</td>
                                    <td>{item.OrderCreatedBy}</td>
                                    <td>{formatDate(item.OrderCretedDate)}</td>
                                    <td>{item.TMSVehicleRequestDocumentNo}</td>
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
