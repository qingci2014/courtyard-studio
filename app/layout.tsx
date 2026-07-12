import type { Metadata } from "next";
import "./globals.css";
import "./scene.css";
export const metadata: Metadata = {title:"庭院生活设计馆",description:"9×16米现代东方庭院住宅交互展示"};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="zh-CN"><body>{children}</body></html>}
