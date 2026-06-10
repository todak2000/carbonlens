import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'

/**
 * Silently generates and downloads a PDF from an HTML string.
 * No print dialog — file is saved directly to the user's Downloads folder.
 */
export async function downloadPDFSilently(htmlContent: string, filename: string): Promise<void> {
  // Parse HTML and extract styles + body
  const parser = new DOMParser()
  const parsed = parser.parseFromString(htmlContent, 'text/html')

  // Build hidden render container
  const wrapper = document.createElement('div')
  wrapper.style.cssText = 'position:fixed;left:-9999px;top:0;width:794px;background:white;z-index:-1;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;'

  // Inject styles
  const styleEl = document.createElement('style')
  styleEl.textContent = Array.from(parsed.querySelectorAll('style')).map((s) => s.textContent ?? '').join('\n')
    // Remove @page and @media print rules (they don't apply for canvas render)
    .replace(/@page\s*\{[^}]*\}/g, '')
    .replace(/@media\s+print\s*\{[^}]*(?:\{[^}]*\}[^}]*)*\}/g, '')
  wrapper.appendChild(styleEl)

  // Inject body
  const bodyDiv = document.createElement('div')
  bodyDiv.style.cssText = 'padding:18mm 14mm 16mm 14mm;background:white;width:794px;box-sizing:border-box;'
  bodyDiv.innerHTML = parsed.body.innerHTML

  // Remove scripts (html2canvas can't execute them)
  bodyDiv.querySelectorAll('script').forEach((s) => s.remove())

  wrapper.appendChild(bodyDiv)
  document.body.appendChild(wrapper)

  // Wait for layout
  await new Promise((r) => setTimeout(r, 400))

  try {
    const canvas = await html2canvas(wrapper, {
      scale: 2,
      useCORS: true,
      allowTaint: false,
      backgroundColor: '#ffffff',
      width: 794,
      logging: false,
      windowWidth: 794,
    })

    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    const A4_W = 210
    const A4_H = 297
    const imgW = A4_W
    const imgH = (canvas.height / canvas.width) * imgW

    const imgData = canvas.toDataURL('image/jpeg', 0.95)
    let remaining = imgH
    let offset = 0
    let firstPage = true

    while (remaining > 0) {
      if (!firstPage) pdf.addPage()
      pdf.addImage(imgData, 'JPEG', 0, -offset, imgW, imgH)
      offset += A4_H
      remaining -= A4_H
      firstPage = false
    }

    pdf.save(filename)
  } finally {
    document.body.removeChild(wrapper)
  }
}
