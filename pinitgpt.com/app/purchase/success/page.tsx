'use client';

import Link from "next/link";
import { useEffect } from "react";
import { useSearchParams } from "next/navigation";

function toNumber(v: string | null, fallback: number) {
  if (!v) return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export default function PurchaseSuccessPage() {
  const params = useSearchParams();

  useEffect(() => {
    if (typeof window === "undefined") return;
    const w = window as any;
    const transactionId =
      params.get("sale_id") ||
      params.get("order_id") ||
      params.get("transaction_id") ||
      `gumroad-${Date.now()}`;
    const value = toNumber(params.get("price"), 4.99);
    const currency = (params.get("currency") || "USD").toUpperCase();
    const firedKey = `pinitgpt_purchase_${transactionId}`;
    if (window.sessionStorage.getItem(firedKey)) return;
    window.sessionStorage.setItem(firedKey, "1");

    const payload = {
      event: "purchase",
      transaction_id: transactionId,
      value,
      currency,
      item_name: "pinitgpt_early_supporter",
      source: "gumroad_redirect",
    };

    if (typeof w.gtag === "function") {
      w.gtag("event", "purchase", payload);
      return;
    }
    w.dataLayer = w.dataLayer || [];
    w.dataLayer.push(payload);
  }, [params]);

  return (
    <main className="simple-page">
      <div className="simple-card">
        <h1>Purchase completed</h1>
        <p>Thanks for supporting pinitgpt.</p>
        <p>You can now activate Pro using your Gumroad license key.</p>
        <p style={{ marginTop: 14 }}>
          <Link href="/">Back to pinitgpt.com</Link>
        </p>
      </div>
    </main>
  );
}

