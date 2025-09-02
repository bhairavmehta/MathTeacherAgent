import type { Metadata } from "next";
import "./globals.css";
import "@copilotkit/react-ui/styles.css";
import { CopilotProvider } from "@/components/CopilotProvider";
import { ToolProvider } from "@/contexts/ToolContext";

export const metadata: Metadata = {
  title: "Math Teacher AI",
  description: "An AI-powered interactive math teacher for basic arithmetic",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <ToolProvider>
          <CopilotProvider>
            {children}
          </CopilotProvider>
        </ToolProvider>
      </body>
    </html>
  );
}