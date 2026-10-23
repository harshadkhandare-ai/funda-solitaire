import type { Metadata, Viewport } from 'next';
import './globals.css';
export const metadata: Metadata = {metadataBase:new URL('https://funda-solataire.vercel.app'),title:'Funda Solataire — Your moment of calm',description:'A beautifully crafted portrait solitaire game. Unwind with classic Klondike, helpful hints, and a fresh deck.',openGraph:{images:['/og.png'],title:'Funda Solataire',description:'Your moment of calm. Classic solitaire, beautifully reimagined.'},twitter:{images:['/og.png'],card:'summary_large_image',title:'Funda Solataire',description:'Your moment of calm. Classic solitaire, beautifully reimagined.'}};
export const viewport: Viewport={width:'device-width',initialScale:1,viewportFit:'cover',themeColor:'#081d19'};
export default function RootLayout({children}:Readonly<{children:React.ReactNode}>){return <html lang="en"><body>{children}</body></html>;}
