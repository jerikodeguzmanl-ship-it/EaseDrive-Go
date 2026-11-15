'use client'
import { useEffect, useState } from 'react'
export default function HeroSlider({ images }: { images: string[] }) {
  const [i, setI] = useState(0)
  useEffect(() => { if (images.length < 2) return; const t = setInterval(() => setI((x) => (x + 1) % images.length), 4000); return () => clearInterval(t) }, [images.length])
  return (<div className="hero">
    <div className="tr" style={{ transform: `translateX(-${i * 100}%)` }}>{images.map((s) => <img key={s} src={s} alt="" />)}</div>
    <div className="ov"><h1>Find Your Ride. Enjoy the Journey.</h1><p>Discover reliable vehicles for your next trip, available from trusted local rental partners.</p>
      <div><a href="#vehicles" className="btn">Get Started</a></div></div></div>)
}
