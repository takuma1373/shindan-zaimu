import { ImageResponse } from "next/og";

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#2563eb",
        }}
      >
        <div style={{ fontSize: 260, fontWeight: 700, color: "#fff", fontFamily: "sans-serif" }}>簿</div>
      </div>
    ),
    { width: 512, height: 512 }
  );
}
