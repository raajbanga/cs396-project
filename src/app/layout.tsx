import "~/styles/globals.css";

import { type Metadata } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import { ThemeProvider } from "next-themes";

import { AppShell } from "~/app/_components/app-shell";
import { TRPCReactProvider } from "~/trpc/react";

export const metadata: Metadata = {
  title: { default: "epaData", template: "%s · epaData" },
  description:
    "Retrieve, validate, store, search, and download EPA Clean Air Markets (CAMPD) power-sector emissions data.",
  icons: [{ rel: "icon", url: "/favicon.ico" }],
};

const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-sans",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-plex-mono",
});

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${plexSans.variable} ${plexMono.variable}`}
      suppressHydrationWarning
    >
      <body>
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem={false}
          scriptProps={{ suppressHydrationWarning: true }}
        >
          <TRPCReactProvider>
            <AppShell>{children}</AppShell>
          </TRPCReactProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
