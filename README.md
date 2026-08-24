# SteganoBin

**Hide in plain sight.**

SteganoBin is a client-side Next.js web application that allows you to securely split and hide secrets within images using a combination of zero-knowledge cryptography, Shamir's Secret Sharing, and image steganography. No servers, no traces—your secrets stay yours.

## Features

- **Client-Side Only**: All cryptographic and steganographic operations run entirely in your browser. Nothing is ever sent to a server.
- **AES-256-GCM Encryption**: Your secret message is first encrypted using AES-256-GCM with a key derived from your passphrase (via PBKDF2).
- **Shamir's Secret Sharing (SSS)**: The encrypted payload is split into multiple pieces (shares). You define the total number of shares and the minimum threshold required to reconstruct the payload.
- **LSB Steganography**: Each generated share is discreetly embedded into the Least Significant Bits (LSB) of the RGB channels of a cover image (PNG/WebP). This ensures the hidden data is visually imperceptible.

## How it works

### 01. Shatter & Hide (Encoding)
1. Enter your secret message and a passphrase.
2. Define the total number of image shares you want to generate.
3. Define the threshold (the minimum number of shares needed to reconstruct the secret).
4. Select one or more cover images.
5. The app encrypts the secret, splits it using SSS, encodes each share into the LSBs of the cover image(s), and generates downloadable PNG files.

### 02. Reconstruct (Decoding)
1. Upload at least the minimum threshold of valid share images.
2. Enter the original passphrase used during encryption.
3. The app extracts the hidden shares from the images, recombines them into the encrypted payload using SSS, and decrypts the original secret.

## Tech Stack

- **Framework**: [Next.js](https://nextjs.org/) (React)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **Cryptography**: Web Crypto API (AES-GCM, PBKDF2)
- **Secret Sharing**: `secrets.js-grempe`
- **Image Processing**: HTML5 Canvas API (`ImageData`)

## Local Development

Ensure you have [Node.js](https://nodejs.org/) and [pnpm](https://pnpm.io/) installed.

1. Clone the repository and navigate into it.
2. Install the dependencies:
   ```bash
   pnpm install
   ```
3. Start the development server:
   ```bash
   pnpm dev
   ```
4. Open [http://localhost:3000](http://localhost:3000) in your browser to view the application.
