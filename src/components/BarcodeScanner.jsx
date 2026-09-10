import { useEffect, useRef, useState } from 'react'
import { BrowserMultiFormatReader } from '@zxing/browser'

// Opens the device camera and reads a barcode using @zxing — works on
// mobile Chrome/Safari and desktop browsers with a webcam. Physical
// USB/Bluetooth barcode scanners don't need this at all: they type digits
// straight into whatever text input is focused, like a fast keyboard.
export default function BarcodeScanner({ onDetected, onClose }) {
  const videoRef = useRef(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    const reader = new BrowserMultiFormatReader()
    let stopped = false
    let controls = null

    reader
      .decodeFromConstraints({ video: { facingMode: 'environment' } }, videoRef.current, (result) => {
        if (result && !stopped) {
          stopped = true
          onDetected(result.getText())
        }
      })
      .then((c) => {
        controls = c
      })
      .catch((e) => {
        setError(e?.message || 'Could not access the camera. Check camera permission for this site.')
      })

    return () => {
      stopped = true
      controls?.stop()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="scanner-overlay" onClick={onClose}>
      <div className="scanner-box" onClick={(e) => e.stopPropagation()}>
        <p className="sub" style={{ marginBottom: 10, color: '#fff' }}>Point the camera at the barcode</p>
        {error ? (
          <div className="login-error">{error}</div>
        ) : (
          <video ref={videoRef} className="scanner-video" muted playsInline />
        )}
        <button className="btn btn-ghost btn-block" style={{ marginTop: 14 }} onClick={onClose}>
          Cancel
        </button>
      </div>
    </div>
  )
}
