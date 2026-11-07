import type { Metadata } from "next";
import { DataProvider } from "@/components/data-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Simulado CLA",
  description: "Painel de simulados do Colégio Leonel Amorim",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return <html lang="pt-BR"><body><DataProvider>{children}</DataProvider></body></html>;
}
