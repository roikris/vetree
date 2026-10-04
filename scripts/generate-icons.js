const sharp = require('sharp')
const fs = require('fs')
const path = require('path')

const sizes = [72, 96, 128, 144, 152, 192, 384, 512]
const outputDir = path.join(__dirname, '../public/icons')

// Create icons directory if it doesn't exist
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true })
}

// Base SVG: sage green rounded square with the app's white leaf, centred. The leaf path is drawn in a
// 24×24 box (centre ≈ 12, 12.5); scale 13 makes it ~60% of the icon, and the translation subtracts the
// scaled centre. (Until 2026-10-04 it translated by 256 without subtracting the scaled leaf centre,
// which pushed the leaf into the bottom-right corner.)
const LEAF = 'M17,8C8,10 5.9,16.17 3.82,21.34L5.71,22L6.66,19.7C7.14,19.87 7.64,20 8,20C19,20 22,3 22,3C21,5 14,5.25 9,6.25C4,7.25 2,11.5 2,13.5C2,15.5 3.75,17.25 3.75,17.25C7,8 17,8 17,8Z'
const S = 13
const baseSVG = `<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <rect width="512" height="512" fill="#3D7A5F" rx="96"/>
  <path transform="translate(${256 - 12 * S} ${256 - 12.5 * S}) scale(${S})" d="${LEAF}" fill="#ffffff"/>
</svg>
`

// A .ico holding PNG images (valid for every current browser): 6-byte header + 16-byte entry each
function buildIco(pngs) {
  if (pngs.some(p => p.size > 256)) throw new Error('ICO entries can be at most 256 px')
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0); header.writeUInt16LE(1, 2); header.writeUInt16LE(pngs.length, 4)
  let offset = 6 + 16 * pngs.length
  const entries = pngs.map(({ size, data }) => {
    const e = Buffer.alloc(16)
    e.writeUInt8(size >= 256 ? 0 : size, 0); e.writeUInt8(size >= 256 ? 0 : size, 1)
    e.writeUInt16LE(1, 4); e.writeUInt16LE(32, 6)
    e.writeUInt32LE(data.length, 8); e.writeUInt32LE(offset, 12)
    offset += data.length
    return e
  })
  return Buffer.concat([header, ...entries, ...pngs.map(p => p.data)])
}

async function generateIcons() {
  console.log('🌿 Generating Vetree PWA icons...')

  for (const size of sizes) {
    const outputPath = path.join(outputDir, `icon-${size}x${size}.png`)

    await sharp(Buffer.from(baseSVG))
      .resize(size, size)
      .png()
      .toFile(outputPath)

    console.log(`✓ Generated ${size}x${size} icon`)
  }

  // Browser tab icon: app/icon.svg (sharp, any size) + app/favicon.ico (16/32/48 PNGs) for browsers
  // and tools that ask for /favicon.ico directly. Next.js serves both from the app/ directory.
  const appDir = path.join(__dirname, '../app')
  fs.writeFileSync(path.join(appDir, 'icon.svg'), baseSVG)
  const icoPngs = []
  for (const size of [16, 32, 48]) {
    icoPngs.push({ size, data: await sharp(Buffer.from(baseSVG)).resize(size, size).png().toBuffer() })
  }
  fs.writeFileSync(path.join(appDir, 'favicon.ico'), buildIco(icoPngs))
  console.log('✓ Generated app/icon.svg and app/favicon.ico (16, 32, 48)')

  console.log('✅ All icons generated successfully!')
}

generateIcons().catch(console.error)
