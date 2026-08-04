import React from "react";
import { QRCodeCanvas } from "qrcode.react";

const REVIEW_URL =
  "https://search.google.com/local/writereview?placeid=ChIJdb_0Z7BwAjoRa15fsfstdfI";

export default function ReviewQRCodeModal({ open, onClose }) {
  if (!open) return null;

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.65)",
          backdropFilter: "blur(4px)",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          zIndex: 99999,
          padding: 20,
        }}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            width: "100%",
            maxWidth: 420,
            background: "#fff",
            borderRadius: 20,
            padding: 28,
            boxShadow: "0 25px 60px rgba(0,0,0,.25)",
            position: "relative",
            animation: "popup .25s ease",
          }}
        >
          {/* Close Button */}
          <button
            onClick={onClose}
            style={{
              position: "absolute",
              top: 14,
              right: 14,
              width: 38,
              height: 38,
              border: "none",
              borderRadius: "50%",
              background: "#F3F4F6",
              cursor: "pointer",
              fontSize: 22,
              fontWeight: 700,
              color: "#374151",
            }}
          >
            ×
          </button>

          <h2
            style={{
              textAlign: "center",
              margin: 0,
              fontSize: 26,
              fontWeight: 700,
              color: "#111827",
            }}
          >
            ⭐ Leave a Review
          </h2>

          <p
            style={{
              textAlign: "center",
              color: "#6B7280",
              marginTop: 10,
              marginBottom: 25,
              fontSize: 15,
            }}
          >
            We'd love to hear about your experience.
            <br />
            Scan the QR code or click the button below.
          </p>

          {/* QR Code */}
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              marginBottom: 25,
            }}
          >
            <div
              style={{
                background: "#fff",
                padding: 15,
                borderRadius: 16,
                border: "1px solid #E5E7EB",
                boxShadow: "0 8px 20px rgba(0,0,0,.08)",
              }}
            >
              <QRCodeCanvas
                value={REVIEW_URL}
                size={220}
                level="H"
                includeMargin={true}
                bgColor="#FFFFFF"
                fgColor="#000000"
              />
            </div>
          </div>

          <a
            href={REVIEW_URL}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "block",
              width: "100%",
              background: "linear-gradient(135deg, #FCE7F3, #FBCFE8)",
              color: "#BE185D",
    border: "1px solid #F9A8D4",
              textAlign: "center",
              padding: "14px",
              borderRadius: 12,
              textDecoration: "none",
              fontWeight: 600,
              fontSize: 16,
              boxSizing: "border-box",
            }}
          >
            ⭐ Open Google Review
          </a>
        </div>
      </div>

      <style>
        {`
          @keyframes popup {
            0% {
              opacity: 0;
              transform: scale(.85) translateY(20px);
            }
            100% {
              opacity: 1;
              transform: scale(1) translateY(0);
            }
          }
        `}
      </style>
    </>
  );
}