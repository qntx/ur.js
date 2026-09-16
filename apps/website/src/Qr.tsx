import { toQrString } from "@qntx/ur";
import { QRCodeSVG } from "qrcode.react";

export function Qr({ value, label }: { value: string; label?: string }) {
  return (
    <figure className="qr">
      <QRCodeSVG value={toQrString(value)} size={168} marginSize={2} title={label ?? "UR QR"} />
      {label !== undefined ? <figcaption>{label}</figcaption> : null}
    </figure>
  );
}
