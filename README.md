<div align="center">
  <br />
  <h1>🕵️ SteganoBin</h1>
  <p><strong>Hide in plain sight. Zero-knowledge cryptography meets image steganography.</strong></p>
  
  <p>
    <img src="https://img.shields.io/badge/Next.js-black?style=for-the-badge&logo=next.js&logoColor=white" alt="Next.js" />
    <img src="https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB" alt="React" />
    <img src="https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white" alt="Tailwind" />
    <img src="https://img.shields.io/badge/Security-AES--256--GCM-green?style=for-the-badge" alt="AES-256" />
  </p>
</div>

<br />

SteganoBin is a privacy-first web application that allows you to securely shatter and hide text secrets across multiple images. It combines **AES-256-GCM encryption**, **Shamir's Secret Sharing (SSS)**, and **Least Significant Bit (LSB) steganography**.

No servers, no databases, no traces—your secrets stay entirely in your browser.

---

## ✨ Key Features

- 🔒 **100% Client-Side**: All cryptographic and steganographic operations run exclusively in your browser. Your data never touches a server.
- 🛡️ **Military-Grade Encryption**: Before hiding, your secret is encrypted using **AES-256-GCM**, keyed via a passphrase using PBKDF2.
- 🧩 **Shamir's Secret Sharing**: The encrypted payload is shattered into distributed shares. You define the total shares and the minimum threshold needed to reconstruct them.
- 🖼️ **Invisible Steganography**: Shares are discreetly encoded into the Least Significant Bits (LSB) of cover images (PNG/WebP), making the hidden data visually imperceptible.

---

## 🚀 How it Works

### 🥷 1. Shatter & Hide (Encoding)
1. **Enter your secret** and choose a strong passphrase.
2. **Define distribution**: Set the total number of shares and the required threshold (e.g., generate 5 shares, require 3 to unlock).
3. **Select cover images**: Pick one or more images to act as vessels.
4. **Generate**: The app encrypts your secret, shatters it via SSS, encodes the pieces into the images' pixels, and provides downloadable, innocent-looking PNG files.

### 🔓 2. Reconstruct (Decoding)
1. **Gather the pieces**: Upload the minimum threshold of valid share images.
2. **Enter the passphrase**: Provide the original passphrase used during encryption.
3. **Unlock**: The app extracts the data from the pixels, reconstructs the encrypted payload, decrypts it, and reveals your original secret.

---

## 🛠️ Tech Stack

* **Framework**: [Next.js](https://nextjs.org/) (React 19)
* **Styling**: [Tailwind CSS v4](https://tailwindcss.com/)
* **Cryptography**: Native Browser Web Crypto API (AES-GCM, PBKDF2)
* **Secret Sharing**: `secrets.js-grempe`
* **Image Processing**: HTML5 Canvas API (`ImageData`)

---

## 💻 Local Development

Want to run SteganoBin locally? It's simple.

**Prerequisites:** [Node.js](https://nodejs.org/) (v18+) and [pnpm](https://pnpm.io/)

```bash
# 1. Clone the repository
git clone https://github.com/nerdskp/stegano-bin.git
cd stegano-bin

# 2. Install dependencies
pnpm install

# 3. Start the development server
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser to view the application.

<br />

<div align="center">
  <i>Your secrets stay yours.</i>
</div>
