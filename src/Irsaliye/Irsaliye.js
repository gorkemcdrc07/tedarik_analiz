import React from "react";
import { FileText } from "lucide-react";

export default function Irsaliye() {
  return (
    <div style={{ padding: "28px" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "12px",
          marginBottom: "24px"
        }}
      >
        <div
          style={{
            width: "46px",
            height: "46px",
            borderRadius: "14px",
            display: "grid",
            placeItems: "center",
            background: "rgba(239, 52, 59, 0.1)",
            color: "#ef343b"
          }}
        >
          <FileText size={23} />
        </div>

        <div>
          <h1
            style={{
              margin: 0,
              fontSize: "24px",
              fontWeight: 800
            }}
          >
            İrsaliye
          </h1>

          <p
            style={{
              margin: "4px 0 0",
              opacity: 0.65,
              fontSize: "13px"
            }}
          >
            İrsaliye işlemleri ve doküman yönetimi
          </p>
        </div>
      </div>

      <div
        style={{
          padding: "24px",
          borderRadius: "18px",
          border: "1px solid rgba(128,128,128,.15)",
          background: "rgba(128,128,128,.04)"
        }}
      >
        İrsaliye ekranı hazırlanıyor.
      </div>
    </div>
  );
}