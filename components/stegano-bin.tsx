'use client'

import { ChangeEvent, useMemo, useState } from 'react'
import { Check, Clipboard, Download, FileImage, LockKeyhole, Plus, Upload } from 'lucide-react'
import { decryptString, encryptString } from '@/lib/core/crypto'
import { reconstructPayload, shatterPayload } from '@/lib/core/sss'
import { decodeLSB, encodeLSB, getLSBCapacityBytes } from '@/lib/core/stego'

type EncodedShare = {
  index: number
  name: string
  url: string
}

type CanvasImage = {
  imageData: ImageData
  width: number
  height: number
}

async function fileToImageData(file: File): Promise<CanvasImage> {
  const bitmap = await createImageBitmap(file)
  const canvas = document.createElement('canvas')
  canvas.width = bitmap.width
  canvas.height = bitmap.height

  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) {
    throw new Error('Could not create a canvas context for this image.')
  }

  context.drawImage(bitmap, 0, 0)
  bitmap.close()

  return {
    imageData: context.getImageData(0, 0, canvas.width, canvas.height),
    width: canvas.width,
    height: canvas.height,
  }
}

async function imageDataToPngUrl(imageData: ImageData): Promise<string> {
  const canvas = document.createElement('canvas')
  canvas.width = imageData.width
  canvas.height = imageData.height

  const context = canvas.getContext('2d')
  if (!context) {
    throw new Error('Could not create a canvas context for the encoded image.')
  }

  context.putImageData(imageData, 0, 0)

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((pngBlob) => {
      if (!pngBlob) {
        reject(new Error('Could not export the encoded image as PNG.'))
        return
      }

      resolve(pngBlob)
    }, 'image/png')
  })

  return URL.createObjectURL(blob)
}

function downloadUrl(url: string, name: string): void {
  const link = document.createElement('a')
  link.href = url
  link.download = name
  link.click()
}

function parsePositiveInteger(value: string, label: string): number {
  const parsed = Number(value)

  if (!Number.isInteger(parsed) || parsed < 2) {
    throw new Error(`${label} must be an integer greater than 1.`)
  }

  return parsed
}

export function SteganoBin() {
  const [activeTab, setActiveTab] = useState<'shatter' | 'reconstruct'>('shatter')
  const [message, setMessage] = useState('')
  const [passphrase, setPassphrase] = useState('')
  const [totalShares, setTotalShares] = useState('4')
  const [threshold, setThreshold] = useState('3')
  const [coverFiles, setCoverFiles] = useState<File[]>([])
  const [encodedShares, setEncodedShares] = useState<EncodedShare[]>([])
  const [decodedShares, setDecodedShares] = useState<string[]>([])
  const [reconstructedMessage, setReconstructedMessage] = useState('')
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)

  const totalCount = Number(totalShares) || 4
  const thresholdCount = Number(threshold) || 3
  const shareSlots = useMemo(
    () => Array.from({ length: Math.min(Math.max(totalCount, 4), 12) }, (_, index) => index + 1),
    [totalCount],
  )
  const canShatter = Boolean(message.trim() && passphrase && coverFiles.length > 0 && !busy)
  const canAssemble = decodedShares.length >= thresholdCount && passphrase && !busy

  const handleCoverFiles = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []).filter((file) => file.type.startsWith('image/'))
    setCoverFiles(files)
    setEncodedShares((previous) => {
      previous.forEach((share) => URL.revokeObjectURL(share.url))
      return []
    })
    setStatus(files.length ? `${files.length} cover image${files.length === 1 ? '' : 's'} ready` : '')
    setError('')
  }

  const handleShareFiles = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []).filter((file) => file.type.startsWith('image/'))
    event.target.value = ''

    if (files.length === 0) {
      return
    }

    setBusy(true)
    setError('')
    setStatus('Extracting hidden shares...')
    setReconstructedMessage('')

    try {
      const extracted: string[] = []

      for (const file of files) {
        const { imageData } = await fileToImageData(file)
        extracted.push(decodeLSB(imageData))
      }

      setDecodedShares((previous) => Array.from(new Set([...previous, ...extracted])))
      setStatus(`${extracted.length} share image${extracted.length === 1 ? '' : 's'} extracted`)
    } catch (decodeError) {
      setError(decodeError instanceof Error ? decodeError.message : 'Could not extract shares from those images.')
    } finally {
      setBusy(false)
    }
  }

  const handleShatterAndHide = async () => {
    setBusy(true)
    setError('')
    setStatus('Encrypting and splitting secret...')
    setReconstructedMessage('')

    try {
      const total = parsePositiveInteger(totalShares, 'Total shares')
      const minimum = parsePositiveInteger(threshold, 'Threshold')

      if (minimum > total) {
        throw new Error('Threshold cannot be greater than total shares.')
      }

      if (!passphrase) {
        throw new Error('Enter a passphrase before encrypting.')
      }

      if (coverFiles.length === 0) {
        throw new Error('Choose at least one cover image.')
      }

      const encrypted = await encryptString(message, passphrase)
      const shares = shatterPayload(encrypted, total, minimum)
      const generated: EncodedShare[] = []

      for (let index = 0; index < shares.length; index += 1) {
        const coverFile = coverFiles[index] ?? coverFiles[0]
        const { imageData } = await fileToImageData(coverFile)
        const capacity = getLSBCapacityBytes(imageData)
        const shareBytes = new TextEncoder().encode(shares[index]).length

        if (shareBytes > capacity) {
          throw new Error(
            `Share ${index + 1} needs ${shareBytes} bytes, but ${coverFile.name} can store ${capacity} bytes.`,
          )
        }

        const encodedImageData = encodeLSB(imageData, shares[index])
        const url = await imageDataToPngUrl(encodedImageData)

        generated.push({
          index: index + 1,
          name: `steganobin-share-${String(index + 1).padStart(2, '0')}.png`,
          url,
        })
      }

      setEncodedShares((previous) => {
        previous.forEach((share) => URL.revokeObjectURL(share.url))
        return generated
      })
      setDecodedShares([])
      setStatus(`${generated.length} encoded PNG share${generated.length === 1 ? '' : 's'} ready`)
      setActiveTab('reconstruct')
    } catch (shatterError) {
      setError(shatterError instanceof Error ? shatterError.message : 'Could not shatter and hide the secret.')
    } finally {
      setBusy(false)
    }
  }

  const handleAssembleSecret = async () => {
    setBusy(true)
    setError('')
    setStatus('Reconstructing encrypted payload...')

    try {
      if (!passphrase) {
        throw new Error('Enter the same passphrase used for encryption.')
      }

      const encryptedPayload = reconstructPayload(decodedShares)
      const secret = await decryptString(encryptedPayload, passphrase)

      setReconstructedMessage(secret)
      setStatus('Secret reconstructed')
    } catch (assembleError) {
      setError(assembleError instanceof Error ? assembleError.message : 'Could not reconstruct the secret.')
      setReconstructedMessage('')
    } finally {
      setBusy(false)
    }
  }

  const handleCopy = async () => {
    await navigator.clipboard?.writeText(reconstructedMessage)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1400)
  }

  return (
    <main className="min-h-screen px-5 py-6 sm:px-10 sm:py-10">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-2xl flex-col">
        <header className="flex items-center justify-between border-b border-border pb-5">
          <div className="flex items-center gap-3">
            <LockKeyhole className="size-4" strokeWidth={1.5} aria-hidden="true" />
            <span className="font-mono text-sm font-medium tracking-tight">SteganoBin</span>
          </div>
          <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">v0.1 / local</span>
        </header>

        <div className="flex flex-1 flex-col justify-center py-12 sm:py-20">
          <div className="mb-10">
            <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">zero-knowledge cryptography</p>
            <h1 className="text-balance font-sans text-4xl font-medium tracking-[-0.04em] sm:text-5xl">Hide in plain sight.</h1>
            <p className="mt-4 max-w-md text-sm leading-6 text-muted-foreground">Split a secret across image shares. No server. No trace. Reconstruct only when enough pieces are present.</p>
          </div>

          <nav className="mb-8 flex border-b border-border" aria-label="Workflow">
            {(['shatter', 'reconstruct'] as const).map((tab) => (
              <button key={tab} onClick={() => setActiveTab(tab)} className={`border-b px-1 pb-3 font-mono text-xs uppercase tracking-[0.16em] transition-colors ${activeTab === tab ? 'border-foreground text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
                {tab}
              </button>
            ))}
            <span className="ml-auto pb-3 font-mono text-xs text-muted-foreground">{activeTab === 'shatter' ? '01' : '02'} / 02</span>
          </nav>

          <label className="mb-7 block">
            <span className="mb-2 block font-mono text-xs text-muted-foreground">passphrase</span>
            <input type="password" value={passphrase} onChange={(event) => setPassphrase(event.target.value)} placeholder="Used locally for AES-256-GCM" className="h-11 w-full border border-input bg-transparent px-3 font-mono text-sm outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-foreground" />
          </label>

          {activeTab === 'shatter' ? (
            <section aria-labelledby="shatter-heading" className="space-y-7">
              <h2 id="shatter-heading" className="sr-only">Shatter a secret</h2>
              <label className="block">
                <span className="mb-2 block font-mono text-xs text-muted-foreground">01 / secret message</span>
                <textarea value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Type something only you should know..." className="min-h-36 w-full resize-y border border-input bg-transparent p-4 font-mono text-sm leading-6 outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-foreground" />
              </label>

              <div className="grid grid-cols-2 gap-5 sm:max-w-xs">
                <label className="block"><span className="mb-2 block font-mono text-xs text-muted-foreground">02 / total shares</span><input type="number" min="2" max="99" value={totalShares} onChange={(event) => setTotalShares(event.target.value)} className="h-11 w-full border border-input bg-transparent px-3 font-mono text-sm outline-none focus:border-foreground" /></label>
                <label className="block"><span className="mb-2 block font-mono text-xs text-muted-foreground">03 / threshold</span><input type="number" min="2" max="99" value={threshold} onChange={(event) => setThreshold(event.target.value)} className="h-11 w-full border border-input bg-transparent px-3 font-mono text-sm outline-none focus:border-foreground" /></label>
              </div>

              <label className={`group flex min-h-32 w-full cursor-pointer flex-col items-center justify-center gap-3 border border-dashed border-input px-5 text-center transition-colors hover:border-foreground ${coverFiles.length ? 'border-foreground' : ''}`}>
                {coverFiles.length ? <Check className="size-5" strokeWidth={1.5} aria-hidden="true" /> : <Upload className="size-5" strokeWidth={1.5} aria-hidden="true" />}
                <span className="font-mono text-xs text-muted-foreground">{coverFiles.length ? `${coverFiles.length} cover image${coverFiles.length === 1 ? '' : 's'} ready` : 'choose PNG cover image(s)'}</span>
                <input type="file" accept="image/png,image/webp,image/*" multiple className="sr-only" onChange={handleCoverFiles} />
              </label>

              <button onClick={handleShatterAndHide} className="flex h-12 w-full items-center justify-center gap-2 bg-primary font-mono text-xs uppercase tracking-[0.14em] text-primary-foreground transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-40" disabled={!canShatter}>
                <FileImage className="size-4" strokeWidth={1.5} aria-hidden="true" />
                {busy ? 'Working...' : 'Shatter & Hide'}
              </button>
            </section>
          ) : (
            <section aria-labelledby="reconstruct-heading" className="space-y-7">
              <div className="flex items-end justify-between"><div><span className="mb-2 block font-mono text-xs text-muted-foreground">01 / image shares</span><h2 id="reconstruct-heading" className="font-sans text-2xl font-medium tracking-tight">Bring the pieces together.</h2></div><span className="font-mono text-xs text-muted-foreground">{decodedShares.length} / {threshold || '3'} valid</span></div>

              {encodedShares.length > 0 && (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {encodedShares.map((share) => (
                    <button key={share.index} onClick={() => downloadUrl(share.url, share.name)} className="flex h-12 items-center justify-between border border-input px-3 font-mono text-xs text-muted-foreground transition-colors hover:border-foreground hover:text-foreground">
                      <span>{share.name}</span>
                      <Download className="size-4" strokeWidth={1.5} aria-hidden="true" />
                    </button>
                  ))}
                </div>
              )}

              <div className="space-y-3">
                <label htmlFor="share-images" className="group flex min-h-24 w-full cursor-pointer flex-col items-center justify-center gap-3 border border-dashed border-input px-5 text-center transition-colors hover:border-foreground">
                  <Upload className="size-5" strokeWidth={1.5} aria-hidden="true" />
                  <span className="font-mono text-xs text-muted-foreground">{decodedShares.length ? 'add or replace share PNGs' : 'upload encoded share PNGs'}</span>
                </label>
                <input id="share-images" type="file" accept="image/png,image/webp,image/*" multiple className="sr-only" onChange={handleShareFiles} />

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {shareSlots.map((share) => <div key={share} className={`flex aspect-square flex-col items-center justify-center gap-2 border border-dashed transition-colors ${decodedShares.length >= share ? 'border-foreground bg-secondary' : 'border-input'}`}>{decodedShares.length >= share ? <Check className="size-4 text-muted-foreground" strokeWidth={1.5} aria-hidden="true" /> : <Plus className="size-4 text-muted-foreground" strokeWidth={1.5} aria-hidden="true" />}<span className="font-mono text-[10px] text-muted-foreground">share_{String(share).padStart(2, '0')}</span></div>)}
                </div>
              </div>

              <p className="font-mono text-xs text-muted-foreground">{canAssemble ? 'threshold met - safe to assemble' : `add ${threshold || '3'} shares to unlock reconstruction`}</p>
              <button onClick={handleAssembleSecret} disabled={!canAssemble} className="h-12 w-full bg-primary font-mono text-xs uppercase tracking-[0.14em] text-primary-foreground transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-40">{busy ? 'Working...' : 'Assemble Secret'}</button>
              <div className="relative border border-input"><div className="min-h-28 whitespace-pre-wrap p-4 pr-12 font-mono text-sm leading-6 text-muted-foreground">{reconstructedMessage || 'output will appear here...'}</div><button onClick={handleCopy} aria-label="Copy reconstructed secret" disabled={!reconstructedMessage} className="absolute right-3 top-3 p-1 text-muted-foreground transition-colors hover:text-foreground disabled:opacity-30">{copied ? <Check className="size-4" strokeWidth={1.5} /> : <Clipboard className="size-4" strokeWidth={1.5} />}</button></div>
            </section>
          )}

          {(status || error) && (
            <p className={`mt-7 font-mono text-xs ${error ? 'text-destructive' : 'text-muted-foreground'}`}>
              {error || status}
            </p>
          )}
        </div>
        <footer className="flex justify-between border-t border-border pt-5 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground"><span>all operations client-side</span><span>your secrets stay yours</span></footer>
      </div>
    </main>
  )
}
