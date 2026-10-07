import type { ReactNode } from "react";

export function Badge({
  tone = "gray",
  children,
}: {
  tone?: "green" | "teal" | "amber" | "red" | "gray" | "blue";
  children: ReactNode;
}) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

export function pressTone(
  s: string
): "gray" | "amber" | "green" | "teal" {
  if (s === "已入库") return "green";
  if (s === "已压制") return "teal";
  return "amber";
}

export function detTone(s: string): "blue" | "gray" {
  return s === "已鉴定" ? "blue" : "gray";
}
