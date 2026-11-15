export default function CarArt({ color = '#2a2a2a', className = '' }: { color?: string; className?: string }) {
  return <svg aria-hidden="true" className={`car ${className}`} viewBox="0 0 200 80">
    <path d="M10 54c0-8 4-12 12-14l22-4 18-18c3-3 6-4 10-4h50c6 0 9 1 12 4l16 18 20 4c8 2 10 6 10 14v4c0 3-2 5-5 5h-10a16 16 0 0 0-32 0H65a16 16 0 0 0-32 0H15c-3 0-5-2-5-5z" fill={color} />
    <path d="M62 36l12-12c2-2 4-3 7-3h24v15zM124 21h8c3 0 5 1 7 3l12 12h-27z" fill="#fff" opacity=".75" />
    <circle cx="49" cy="63" r="12" fill="#111" /><circle cx="49" cy="63" r="5" fill="#aaa" />
    <circle cx="151" cy="63" r="12" fill="#111" /><circle cx="151" cy="63" r="5" fill="#aaa" />
  </svg>;
}
