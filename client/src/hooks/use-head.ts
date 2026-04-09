import { useEffect } from 'react'

const DEFAULTS = {
  title: 'Futbol Grade - Rate Youth Soccer Coaches',
  description: 'Rate and discover youth soccer coaches in Southern California. Honest, anonymous reviews from the community.',
  image: 'https://futbolgrade.com/og-image.png',
  url: 'https://futbolgrade.com',
}

function setMeta(property: string, content: string) {
  // Handle both property="" and name="" attributes
  let el = document.querySelector(`meta[property="${property}"]`) ||
           document.querySelector(`meta[name="${property}"]`)
  if (el) {
    el.setAttribute('content', content)
  }
}

export function useHead(opts: {
  title?: string
  description?: string
  url?: string
} = {}) {
  useEffect(() => {
    const title = opts.title || DEFAULTS.title
    const desc = opts.description || DEFAULTS.description
    const url = opts.url || DEFAULTS.url

    document.title = title
    setMeta('description', desc)
    setMeta('og:title', title)
    setMeta('og:description', desc)
    setMeta('og:url', url)
    setMeta('twitter:title', title)
    setMeta('twitter:description', desc)

    return () => {
      // Reset to defaults on unmount
      document.title = DEFAULTS.title
      setMeta('description', DEFAULTS.description)
      setMeta('og:title', DEFAULTS.title)
      setMeta('og:description', DEFAULTS.description)
      setMeta('og:url', DEFAULTS.url)
      setMeta('twitter:title', DEFAULTS.title)
      setMeta('twitter:description', DEFAULTS.description)
    }
  }, [opts.title, opts.description, opts.url])
}
