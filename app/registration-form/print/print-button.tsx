"use client";

export function PrintButton() {
  return <button type="button" className="print-action" onClick={() => window.print()}>Print full form / Save as PDF</button>;
}
