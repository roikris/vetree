const sharp = require('sharp')
const fs = require('fs')
const path = require('path')

const sizes = [72, 96, 128, 144, 152, 192, 384, 512]
const outputDir = path.join(__dirname, '../public/icons')

// Create icons directory if it doesn't exist
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true })
}

// Create base SVG with sage green background and white leaf/V
const baseSVG = `
<svg width="512" height="512" xmlns="http://www.w3.org/2000/svg">
  <!-- Sage green background -->
  <rect width="512" height="512" fill="#3D7A5F" rx="80"/>

  <!-- White leaf icon (same as in the app) -->
  <g transform="translate(256, 256) scale(12)">
    <path d="M17,8C8,10 5.9,16.17 3.82,21.34L5.71,22L6.66,19.7C7.14,19.87 7.64,20 8,20C19,20 22,3 22,3C21,5 14,5.25 9,6.25C4,7.25 2,11.5 2,13.5C2,15.5 3.75,17.25 3.75,17.25C7,8 17,8 17,8Z"
          fill="white"/>
  </g>
</svg>
`

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

  console.log('✅ All icons generated successfully!')
}

generateIcons().catch(console.error)
