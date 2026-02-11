export async function apiGet(path) {
  const res = await fetch(path, { credentials: 'include' })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function apiPost(path, body) {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body)
  })
  if (!res.ok) {
    const text = await res.text()
    let msg = text
    try {
      const data = JSON.parse(text)
      msg = data.error || data.message || text
    } catch {
      // ignore
    }
    const err = new Error(msg)
    err.status = res.status
    throw err
  }
  return res.json()
}
