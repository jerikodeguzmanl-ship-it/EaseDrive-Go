'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'

const slides = [
  {
    id: 'find-your-ride',
    eyebrow: 'FIND YOUR RIDE',
    title: 'Find Your Ride. Enjoy the Journey.',
    description: 'Discover reliable vehicles for your next trip, available from trusted local rental partners.',
    image: '/images/hero-slide-1.jpg',
  },
  {
    id: 'your-journey',
    eyebrow: 'YOUR JOURNEY, YOUR WAY',
    title: 'Choose How You Want to Travel.',
    description: 'Enjoy the freedom of Self Drive or travel comfortably with a professional driver.',
    image: '/images/hero-slide-2.jpg',
  },
  {
    id: 'book-with-confidence',
    eyebrow: 'BOOK WITH CONFIDENCE',
    title: 'Easy Booking. Trusted Partners.',
    description: 'Find the right vehicle, check availability, and book your next journey with confidence.',
    image: '/images/hero-slide-3.jpg',
  },
]

type Props = {
  images: string[]
  loggedIn: boolean
}

export default function HeroSlider({ images, loggedIn }: Props) {
  const [active, setActive] = useState(0)
  const [paused, setPaused] = useState(false)
  const [pageVisible, setPageVisible] = useState(true)
  const [reducedMotion, setReducedMotion] = useState(false)
  const touchStart = useRef<{ x: number; y: number } | null>(null)

  useEffect(() => {
    const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)')
    const syncMotionPreference = () => setReducedMotion(motionPreference.matches)
    const syncPageVisibility = () => setPageVisible(document.visibilityState === 'visible')

    syncMotionPreference()
    syncPageVisibility()
    motionPreference.addEventListener('change', syncMotionPreference)
    document.addEventListener('visibilitychange', syncPageVisibility)

    return () => {
      motionPreference.removeEventListener('change', syncMotionPreference)
      document.removeEventListener('visibilitychange', syncPageVisibility)
    }
  }, [])

  useEffect(() => {
    if (paused || !pageVisible || reducedMotion) return

    const timer = window.setInterval(() => {
      setActive((current) => (current + 1) % slides.length)
    }, 3500)

    return () => window.clearInterval(timer)
  }, [paused, pageVisible, reducedMotion])

  function moveTo(index: number) {
    setActive((index + slides.length) % slides.length)
  }

  function handleTouchEnd(event: React.TouchEvent<HTMLElement>) {
    const start = touchStart.current
    const touch = event.changedTouches[0]
    touchStart.current = null
    if (!start || !touch) return

    const deltaX = touch.clientX - start.x
    const deltaY = touch.clientY - start.y
    if (Math.abs(deltaX) < 48 || Math.abs(deltaX) < Math.abs(deltaY)) return

    moveTo(active + (deltaX < 0 ? 1 : -1))
  }

  const currentSlides = slides.map((slide, index) => ({
    ...slide,
    image: images[index] || slide.image,
  }))

  return (
    <section
      className="hero-carousel"
      role="region"
      aria-label="Featured EaseDrive Go journeys"
      aria-roledescription="carousel"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={(event) => {
        const touch = event.touches[0]
        if (touch) touchStart.current = { x: touch.clientX, y: touch.clientY }
      }}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={() => { touchStart.current = null }}
    >
      <div className="welcome-brand"><i>E</i>EaseDrive Go</div>

      <div className="hero-track" style={{ transform: `translateX(-${active * 100}%)` }}>
        {currentSlides.map((slide, index) => (
          <div
            className={`hero-slide hero-slide-${index + 1}`}
            key={slide.id}
            aria-hidden="true"
          >
            <img
              className="hero-image"
              src={slide.image}
              alt=""
              fetchPriority={index === 0 ? 'high' : 'auto'}
              decoding="async"
            />
          </div>
        ))}
      </div>

      <div className="hero-content">
        <div className="hero-copy-viewport">
          <div className="hero-copy-track" style={{ transform: `translateX(-${active * 100}%)` }}>
            {currentSlides.map((slide, index) => (
              <div
                className="hero-copy"
                key={slide.id}
                role="group"
                aria-roledescription="slide"
                aria-label={`${index + 1} of ${slides.length}`}
                aria-hidden={index !== active}
                inert={index !== active}
              >
                <p className="hero-kicker">{slide.eyebrow}</p>
                <h1>{slide.title}</h1>
                <p className="hero-description">{slide.description}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="hero-actions">
          <Link className="btn hero-cta" href="/?view=explore#vehicles">
            Get Started <span aria-hidden="true">→</span>
          </Link>
          {!loggedIn && (
            <p className="welcome-login">Already have an account? <Link href="/login">Log In</Link></p>
          )}
        </div>
      </div>

      <button className="hero-arrow hero-arrow-previous" type="button" aria-label="Previous slide" onClick={() => moveTo(active - 1)}>
        <svg aria-hidden="true" viewBox="0 0 24 24"><path d="m15 18-6-6 6-6" /></svg>
      </button>
      <button className="hero-arrow hero-arrow-next" type="button" aria-label="Next slide" onClick={() => moveTo(active + 1)}>
        <svg aria-hidden="true" viewBox="0 0 24 24"><path d="m9 18 6-6-6-6" /></svg>
      </button>

      <div className="hero-indicators" aria-label="Choose a slide">
        {slides.map((slide, index) => (
          <button
            className="hero-indicator"
            key={slide.id}
            type="button"
            aria-label={`Show slide ${index + 1}: ${slide.eyebrow}`}
            aria-current={index === active ? 'true' : undefined}
            onClick={() => moveTo(index)}
          >
            <span />
          </button>
        ))}
      </div>
    </section>
  )
}
