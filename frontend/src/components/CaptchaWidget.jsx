import React, { useEffect, useRef } from 'react'

let turnstileScriptLoaded = false

export default function CaptchaWidget({ provider, siteKey, onToken }) {
  const ref = useRef(null)

  useEffect(() => {
    if (provider === 'none') {
      onToken('dev')
      return
    }

    if (provider === 'turnstile') {
      const load = () => {
        if (!window.turnstile || !ref.current) return
        window.turnstile.render(ref.current, {
          sitekey: siteKey,
          callback: (token) => onToken(token)
        })
      }

      if (!turnstileScriptLoaded) {
        const script = document.createElement('script')
        script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js'
        script.async = true
        script.defer = true
        script.onload = () => {
          turnstileScriptLoaded = true
          load()
        }
        document.body.appendChild(script)
      } else {
        load()
      }
    }

    if (provider === 'recaptcha') {
      const scriptId = 'recaptcha-script'
      const load = () => {
        if (!window.grecaptcha || !ref.current) return
        window.grecaptcha.render(ref.current, {
          sitekey: siteKey,
          callback: (token) => onToken(token)
        })
      }

      if (!document.getElementById(scriptId)) {
        const script = document.createElement('script')
        script.id = scriptId
        script.src = 'https://www.google.com/recaptcha/api.js?render=explicit'
        script.async = true
        script.defer = true
        script.onload = load
        document.body.appendChild(script)
      } else {
        load()
      }
    }
  }, [provider, siteKey, onToken])

  if (provider === 'none') return null

  return <div ref={ref}></div>
}
